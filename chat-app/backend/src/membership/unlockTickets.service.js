/**
 * 解鎖券服務 - 修復版本
 * 修復內容：
 * ✅ 使用 Firestore Transaction 保護卡片餘額檢查和扣除
 * ✅ 確保解鎖操作和卡片扣除的原子性
 * ✅ 在路由層添加冪等性保護（見 unlockTickets.routes.FIXED.js）
 */

import { getUserById } from "../user/user.service.js";
import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";
import { getUserProfileWithCache } from "../user/userProfileCache.service.js";

// 券類型常量
export const TICKET_TYPES = {
  CHARACTER: "characterUnlock",
  PHOTO: "photoUnlock",
  VIDEO: "videoUnlock",
  VOICE: "voiceUnlock",
};

/**
 * 初始化用戶的解鎖票數據
 */
const initUserTickets = (user) => {
  if (!user.unlockTickets) {
    user.unlockTickets = {
      characterUnlockCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,
      voiceUnlockCards: 0,
      usageHistory: [],
    };
  }
  return user.unlockTickets;
};

/**
 * 發放解鎖票（會員開通時使用）
 * ✅ 修復：使用 Firestore Transaction 確保原子性
 */
export const grantTickets = async (userId, ticketAmounts) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內讀取用戶資料
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const tickets = initUserTickets(user);

    // 2. 增加票數（統一使用 Cards 命名）
    if (ticketAmounts.characterUnlockCards) {
      tickets.characterUnlockCards = (tickets.characterUnlockCards || 0) + ticketAmounts.characterUnlockCards;
    }
    // ⚠️ 向後兼容：如果傳入的是舊的 Tickets 命名，也能處理
    if (ticketAmounts.characterUnlockTickets) {
      tickets.characterUnlockCards = (tickets.characterUnlockCards || 0) + ticketAmounts.characterUnlockTickets;
    }
    if (ticketAmounts.photoUnlockCards) {
      tickets.photoUnlockCards = (tickets.photoUnlockCards || 0) + ticketAmounts.photoUnlockCards;
    }
    if (ticketAmounts.videoUnlockCards) {
      tickets.videoUnlockCards = (tickets.videoUnlockCards || 0) + ticketAmounts.videoUnlockCards;
    }
    if (ticketAmounts.voiceUnlockCards) {
      tickets.voiceUnlockCards = (tickets.voiceUnlockCards || 0) + ticketAmounts.voiceUnlockCards;
    }

    // 3. 記錄發放歷史
    tickets.usageHistory.push({
      type: "grant",
      amounts: ticketAmounts,
      timestamp: new Date().toISOString(),
      reason: "membership_activation",
    });

    // 4. 在 Transaction 內更新（統一使用 assets 對象）
    transaction.update(userRef, {
      // ✅ 統一寫入新位置：assets
      'assets.characterUnlockCards': tickets.characterUnlockCards || 0,
      'assets.photoUnlockCards': tickets.photoUnlockCards || 0,
      'assets.videoUnlockCards': tickets.videoUnlockCards || 0,
      'assets.voiceUnlockCards': tickets.voiceUnlockCards || 0,
      // ⚠️ 保留 unlockTickets 用於歷史記錄（不再用於查詢餘額）
      'unlockTickets.usageHistory': tickets.usageHistory,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 5. 設置返回結果
    result = {
      success: true,
      granted: ticketAmounts,
      newBalance: {
        characterUnlockCards: tickets.characterUnlockCards,
        photoUnlockCards: tickets.photoUnlockCards,
        videoUnlockCards: tickets.videoUnlockCards,
        voiceUnlockCards: tickets.voiceUnlockCards,
      },
    };
  });

  logger.info(`[發放券] 用戶 ${userId} 獲得解鎖券：`, ticketAmounts);

  return result;
};

/**
 * 使用角色解鎖票（限時 7 天）
 * ✅ 修復：使用 Firestore Transaction 確保原子性
 */
export const useCharacterUnlockTicket = async (userId, characterId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  // ✅ 修復：使用 Transaction 確保原子性
  await db.runTransaction(async (transaction) => {
    // ==================== 階段 1: 所有讀取操作 ====================
    // ⚠️ 重要：Firestore 要求所有讀取必須在寫入之前完成

    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    // 2. 讀取使用限制資料
    const limitRef = db.collection("usage_limits").doc(userId);
    const limitDoc = await transaction.get(limitRef);

    // ==================== 階段 2: 數據處理 ====================

    const user = userDoc.data();

    // 3. 讀取角色解鎖卡餘額（✅ 統一從 assets 讀取）
    const currentCards = user?.assets?.characterUnlockCards || user?.assets?.characterUnlockTickets || 0;

    // 4. 檢查餘額
    if (currentCards < 1) {
      throw new Error("角色解鎖票不足");
    }

    // 5. 計算解鎖到期時間（7 天後）
    const now = new Date();
    const unlockDays = 7;
    const unlockUntil = new Date(now.getTime() + unlockDays * 24 * 60 * 60 * 1000);

    // 6. 準備用戶資料更新
    const updateData = {
      'assets.characterUnlockCards': currentCards - 1,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 7. 記錄使用歷史到 unlockTickets（僅用於審計，不用於查詢餘額）
    const usageHistory = user?.unlockTickets?.usageHistory || [];
    usageHistory.push({
      type: "use",
      ticketType: TICKET_TYPES.CHARACTER,
      characterId,
      timestamp: new Date().toISOString(),
      unlockDays,
      unlockUntil: unlockUntil.toISOString(),
    });
    updateData['unlockTickets.usageHistory'] = usageHistory;

    // 8. 準備 unlockedCharacters 更新
    const unlockedCharactersUpdate = {
      [`unlockedCharacters.${characterId}`]: {
        unlockedAt: FieldValue.serverTimestamp(),
        unlockedBy: "ticket", // ticket | vvip | purchase
        expiresAt: unlockUntil.toISOString(), // 臨時解鎖的過期時間
        unlockDays, // 解鎖天數
      },
    };

    // 9. 準備限制資料更新
    let limitData = limitDoc.exists ? limitDoc.data() : {
      userId,
      conversation: {},
      voice: {},
      photos: {},
      videos: {},
    };

    // 初始化該角色的對話限制
    if (!limitData.conversation) limitData.conversation = {};
    if (!limitData.conversation[characterId]) {
      limitData.conversation[characterId] = {
        count: 0,
        unlocked: 0,
        permanentUnlock: false,
        temporaryUnlockUntil: null,
        resetPeriod: "none",
        lastResetDate: null,
      };
    }

    // 設置臨時解鎖（7 天）
    limitData.conversation[characterId].temporaryUnlockUntil = unlockUntil.toISOString();
    limitData.conversation[characterId].permanentUnlock = false;
    limitData.updatedAt = FieldValue.serverTimestamp();

    // ==================== 階段 3: 所有寫入操作 ====================
    // ⚠️ 重要：所有寫入必須在所有讀取之後執行

    // 10. 更新用戶資料（卡片數量和使用歷史）
    transaction.update(userRef, updateData);

    // 11. 更新解鎖角色記錄
    transaction.update(userRef, unlockedCharactersUpdate);

    // 12. 更新使用限制
    transaction.set(limitRef, limitData, { merge: true });

    // ==================== 階段 4: 準備返回結果 ====================

    // 13. 設置返回結果
    result = {
      success: true,
      characterId,
      remainingTickets: currentCards - 1,
      unlockDays,
      unlockUntil: unlockUntil.toISOString(),
      unlockUntilReadable: unlockUntil.toLocaleString('zh-TW'),
      unlocked: true,
      permanentUnlock: false,
      temporaryUnlockUntil: unlockUntil.toISOString(),
    };
  });

  logger.info(`[解鎖券] 用戶 ${userId} 使用角色解鎖票解鎖角色 ${characterId}（7天），剩餘 ${result.remainingTickets} 張`);

  return result;
};

/**
 * 使用拍照解鎖卡
 * ✅ 修復：使用 Firestore Transaction 確保原子性
 */
export const usePhotoUnlockCard = async (userId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();

    // 讀取照片卡餘額（✅ 統一從 assets 讀取）
    const currentCards = user?.assets?.photoUnlockCards || 0;

    // 檢查餘額
    if (currentCards < 1) {
      throw new Error("拍照解鎖卡不足");
    }

    // ✅ 統一寫入 assets
    const updateData = {
      "assets.photoUnlockCards": currentCards - 1,
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.update(userRef, updateData);

    result = {
      success: true,
      remainingCards: currentCards - 1,
      message: "成功使用拍照解鎖卡",
    };
  });

  logger.info(`[解鎖券] 用戶 ${userId} 使用拍照解鎖卡，剩餘 ${result.remainingCards} 張`);

  return result;
};

/**
 * 使用影片解鎖卡
 * ✅ 修復：使用 Firestore Transaction 確保原子性
 */
export const useVideoUnlockCard = async (userId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();

    // 讀取影片卡餘額（✅ 統一從 assets 讀取）
    const currentCards = user?.assets?.videoUnlockCards || 0;

    // 檢查餘額
    if (currentCards < 1) {
      throw new Error("影片解鎖卡不足");
    }

    // ✅ 統一寫入 assets
    const updateData = {
      "assets.videoUnlockCards": currentCards - 1,
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.update(userRef, updateData);

    result = {
      success: true,
      remainingCards: currentCards - 1,
      message: "成功使用影片解鎖卡",
    };
  });

  logger.info(`[解鎖券] 用戶 ${userId} 使用影片解鎖卡，剩餘 ${result.remainingCards} 張`);

  return result;
};

/**
 * 獲取用戶解鎖券餘額
 */
export const getTicketBalance = async (userId, ticketType) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // ✅ Quick Win #2: 統一從 assets 讀取所有卡片數據
  // 所有寫入操作都寫到 assets.*Cards (見 membership.service.js)
  // 為了數據一致性，讀取也統一從 assets 讀取
  let balance = 0;

  switch (ticketType) {
    case TICKET_TYPES.CHARACTER:
      // ✅ 統一從 assets 讀取（移除舊的 unlockTickets 和直接掛在 user 上的字段）
      balance = user?.assets?.characterUnlockCards || 0;
      break;

    case TICKET_TYPES.PHOTO:
      // ✅ 統一從 assets 讀取
      balance = user?.assets?.photoUnlockCards || 0;
      break;

    case TICKET_TYPES.VIDEO:
      // ✅ 統一從 assets 讀取
      balance = user?.assets?.videoUnlockCards || 0;
      break;

    case TICKET_TYPES.VOICE:
      // ✅ 統一從 assets 讀取
      balance = user?.assets?.voiceUnlockCards || 0;
      break;

    default:
      throw new Error(`未知的券類型：${ticketType}`);
  }

  return {
    userId,
    ticketType,
    balance,
  };
};

/**
 * 獲取所有解鎖券餘額
 * ✅ 修復：返回格式與前端期望匹配
 */
export const getAllTicketBalances = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // ✅ 統一從 assets 讀取所有卡片數據
  const assets = user?.assets || {};

  // ✅ 獲取使用歷史
  const usageHistory = user?.unlockTickets?.usageHistory || [];

  // ✅ 返回前端期望的格式（頂層字段，不嵌套在 balances 中）
  return {
    characterUnlockCards: assets.characterUnlockCards || 0,
    photoUnlockCards: assets.photoUnlockCards || 0,
    videoUnlockCards: assets.videoUnlockCards || 0,
    voiceUnlockCards: assets.voiceUnlockCards || 0,
    createCards: assets.createCards || 0,
    usageHistory,
  };
};

/**
 * 獲取用戶的照片解鎖卡數量
 */
export const getPhotoUnlockCards = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // ✅ 統一從 assets 讀取
  return user?.assets?.photoUnlockCards || 0;
};

/**
 * 獲取用戶的語音解鎖卡數量（支持多種資料結構，向後兼容）
 */
export const getVoiceUnlockCards = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // ✅ 統一從 assets 讀取
  return user?.assets?.voiceUnlockCards || 0;
};

/**
 * 使用語音解鎖卡（使用 Transaction 保護）
 * ✅ 修復：使用 Firestore Transaction 確保原子性
 */
export const useVoiceUnlockCard = async (userId, characterId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  // ✅ 修復：使用 Transaction 確保原子性
  await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內讀取用戶資料
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();

    // 2. 讀取語音卡餘額（✅ 統一從 assets 讀取）
    const currentCards = user?.assets?.voiceUnlockCards || 0;

    // 3. 檢查餘額
    if (currentCards < 1) {
      throw new Error("語音解鎖卡不足");
    }

    // 4. ✅ 統一寫入 assets
    const updateData = {
      "assets.voiceUnlockCards": currentCards - 1,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 5. 在 Transaction 內更新
    transaction.update(userRef, updateData);

    // 6. 設置返回結果
    result = {
      success: true,
      characterId,
      remaining: currentCards - 1,
    };
  });

  logger.info(`[語音卡] 用戶 ${userId} 使用語音解鎖卡，剩餘 ${result.remaining} 張`);

  return result;
};

/**
 * 獲取用戶已解鎖的角色列表
 * ✅ P2-7 新增：快速查詢已解鎖角色
 * ✅ P1-5 優化：使用用戶緩存減少 Firestore 查詢
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Array>} 已解鎖角色列表
 */
export const getUserUnlockedCharacters = async (userId) => {
  // ✅ P1-5 修復：使用緩存獲取用戶資料，減少 Firestore 讀取
  const user = await getUserProfileWithCache(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const unlockedCharacters = user.unlockedCharacters || {};
  const now = new Date();
  const result = [];

  // 過濾有效的解鎖記錄
  for (const [characterId, unlockData] of Object.entries(unlockedCharacters)) {
    // ✅ P2-6 優化：數據驗證增強
    // 檢查邏輯矛盾：permanent=true 但 expiresAt 有值
    if (unlockData.permanent && unlockData.expiresAt) {
      logger.warn(
        `[數據驗證] 用戶 ${userId} 的角色 ${characterId} 解鎖數據存在邏輯矛盾：` +
        `permanent=true 但 expiresAt=${unlockData.expiresAt}，將以 permanent 為準`
      );
      // 以 permanent 為準，忽略 expiresAt
    }

    // 檢查是否過期
    let isValid = false;

    if (unlockData.permanent) {
      // 永久解鎖永遠有效
      isValid = true;
    } else if (unlockData.expiresAt) {
      // ✅ P2-6 優化：添加日期解析錯誤處理
      try {
        // 檢查臨時解鎖是否過期
        const expiresAt = new Date(unlockData.expiresAt);

        // 驗證日期是否有效
        if (isNaN(expiresAt.getTime())) {
          logger.error(
            `[數據驗證] 用戶 ${userId} 的角色 ${characterId} 解鎖數據包含無效日期：` +
            `expiresAt=${unlockData.expiresAt}`
          );
          isValid = false;
        } else {
          isValid = expiresAt > now;
        }
      } catch (error) {
        logger.error(
          `[數據驗證] 用戶 ${userId} 的角色 ${characterId} 日期解析失敗：` +
          `expiresAt=${unlockData.expiresAt}`,
          error
        );
        isValid = false;
      }
    } else {
      // ✅ P2-6 優化：檢查缺少必要字段
      logger.warn(
        `[數據驗證] 用戶 ${userId} 的角色 ${characterId} 解鎖數據不完整：` +
        `permanent=false 但缺少 expiresAt 字段`
      );
      isValid = false;
    }

    if (isValid) {
      // ✅ 計算剩餘天數
      let remainingDays = null;
      if (!unlockData.permanent && unlockData.expiresAt) {
        try {
          const expiresAt = new Date(unlockData.expiresAt);
          if (!isNaN(expiresAt.getTime())) {
            remainingDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
          }
        } catch (error) {
          logger.error(`[計算剩餘天數] 用戶 ${userId} 角色 ${characterId} 日期解析失敗`, error);
        }
      }

      // ✅ 轉換 Firestore Timestamp 為 ISO 字符串
      let unlockedAt = unlockData.unlockedAt;
      if (unlockedAt && typeof unlockedAt.toDate === 'function') {
        // Firestore Timestamp 對象，轉換為 ISO 字符串
        unlockedAt = unlockedAt.toDate().toISOString();
      } else if (unlockedAt instanceof Date) {
        // JavaScript Date 對象，轉換為 ISO 字符串
        unlockedAt = unlockedAt.toISOString();
      }

      result.push({
        characterId,
        ...unlockData,
        unlockedAt, // ✅ 確保是 ISO 字符串格式
        isExpired: false,
        remainingDays, // ✅ 添加剩餘天數
      });
    }
  }

  return result;
};

/**
 * 檢查用戶是否已解鎖特定角色
 * ✅ P2-7 新增：快速檢查單個角色解鎖狀態
 * ✅ P1-5 優化：使用用戶緩存減少 Firestore 查詢
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @returns {Promise<Object>} 解鎖狀態
 */
export const checkCharacterUnlocked = async (userId, characterId) => {
  // ✅ P1-5 修復：使用緩存獲取用戶資料，減少 Firestore 讀取
  const user = await getUserProfileWithCache(userId);
  if (!user) {
    return { unlocked: false, reason: "user_not_found" };
  }

  // 檢查 VVIP 用戶（所有角色免費解鎖）
  if (user.membershipTier === "vvip") {
    return {
      unlocked: true,
      reason: "vvip",
      permanent: true,
      unlockedBy: "vvip",
    };
  }

  const unlockedCharacters = user.unlockedCharacters || {};
  const unlockData = unlockedCharacters[characterId];

  if (!unlockData) {
    return { unlocked: false, reason: "not_unlocked" };
  }

  // ✅ P2-6 優化：數據驗證增強
  // 檢查邏輯矛盾：permanent=true 但 expiresAt 有值
  if (unlockData.permanent && unlockData.expiresAt) {
    logger.warn(
      `[數據驗證] 用戶 ${userId} 的角色 ${characterId} 解鎖數據存在邏輯矛盾：` +
      `permanent=true 但 expiresAt=${unlockData.expiresAt}，將以 permanent 為準`
    );
    // 以 permanent 為準，忽略 expiresAt
  }

  // 檢查是否過期
  if (unlockData.permanent) {
    return {
      unlocked: true,
      ...unlockData,
      isExpired: false,
    };
  }

  if (unlockData.expiresAt) {
    // ✅ P2-6 優化：添加日期解析錯誤處理
    try {
      const expiresAt = new Date(unlockData.expiresAt);
      const now = new Date();

      // 驗證日期是否有效
      if (isNaN(expiresAt.getTime())) {
        logger.error(
          `[數據驗證] 用戶 ${userId} 的角色 ${characterId} 解鎖數據包含無效日期：` +
          `expiresAt=${unlockData.expiresAt}`
        );
        return { unlocked: false, reason: "invalid_date_format" };
      }

      if (expiresAt > now) {
        return {
          unlocked: true,
          ...unlockData,
          isExpired: false,
          remainingDays: Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)),
        };
      } else {
        return {
          unlocked: false,
          reason: "expired",
          isExpired: true,
          expiredAt: unlockData.expiresAt,
        };
      }
    } catch (error) {
      logger.error(
        `[數據驗證] 用戶 ${userId} 的角色 ${characterId} 日期解析失敗：` +
        `expiresAt=${unlockData.expiresAt}`,
        error
      );
      return { unlocked: false, reason: "date_parse_error" };
    }
  }

  // ✅ P2-6 優化：檢查缺少必要字段
  logger.warn(
    `[數據驗證] 用戶 ${userId} 的角色 ${characterId} 解鎖數據不完整：` +
    `permanent=false 但缺少 expiresAt 字段`
  );
  return { unlocked: false, reason: "invalid_unlock_data" };
};