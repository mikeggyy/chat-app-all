/**
 * 解鎖券服務 - 修復版本
 * 修復內容：
 * ✅ 使用 Firestore Transaction 保護卡片餘額檢查和扣除
 * ✅ 確保解鎖操作和卡片扣除的原子性
 * ✅ 在路由層添加冪等性保護（見 unlockTickets.routes.FIXED.js）
 */

import { getUserById } from "../user/user.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../utils/logger.js";

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
    // 1. 在 Transaction 內讀取用戶資料
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();

    // 2. 讀取角色解鎖卡餘額（✅ 統一從 assets 讀取）
    const currentCards = user?.assets?.characterUnlockCards || user?.assets?.characterUnlockTickets || 0;

    // 3. 檢查餘額
    if (currentCards < 1) {
      throw new Error("角色解鎖票不足");
    }

    // 4. 計算解鎖到期時間（7 天後）
    const now = new Date();
    const unlockDays = 7;
    const unlockUntil = new Date(now.getTime() + unlockDays * 24 * 60 * 60 * 1000);

    // 5. ✅ 統一寫入新位置 assets（不論從哪裡讀取）
    const updateData = {
      'assets.characterUnlockCards': currentCards - 1,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 6. 記錄使用歷史到 unlockTickets（僅用於審計，不用於查詢餘額）
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

    // 7. 更新用戶資料（在 Transaction 內）
    transaction.update(userRef, updateData);

    // 7. 設置解鎖限制（在 Transaction 內）
    const limitRef = db.collection("usage_limits").doc(userId);
    const limitDoc = await transaction.get(limitRef);

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

    transaction.set(limitRef, limitData, { merge: true });

    // 8. 設置返回結果
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

  // 根據券類型檢查餘額
  let balance = 0;

  switch (ticketType) {
    case TICKET_TYPES.CHARACTER:
      // 檢查多個位置
      if (user?.unlockTickets?.characterUnlockCards > 0) {
        balance = user.unlockTickets.characterUnlockCards;
      } else if (user?.assets?.characterUnlockCards > 0) {
        balance = user.assets.characterUnlockCards;
      } else if (user?.characterUnlockCards > 0) {
        balance = user.characterUnlockCards;
      }
      break;

    case TICKET_TYPES.PHOTO:
      if (user?.unlockTickets?.photoUnlockCards > 0) {
        balance = user.unlockTickets.photoUnlockCards;
      } else if (user?.assets?.photoUnlockCards > 0) {
        balance = user.assets.photoUnlockCards;
      } else if (user?.photoUnlockCards > 0) {
        balance = user.photoUnlockCards;
      }
      break;

    case TICKET_TYPES.VIDEO:
      balance = user?.assets?.videoUnlockCards || 0;
      break;

    case TICKET_TYPES.VOICE:
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
 */
export const getAllTicketBalances = async (userId) => {
  const [character, photo, video, voice] = await Promise.all([
    getTicketBalance(userId, TICKET_TYPES.CHARACTER),
    getTicketBalance(userId, TICKET_TYPES.PHOTO),
    getTicketBalance(userId, TICKET_TYPES.VIDEO),
    getTicketBalance(userId, TICKET_TYPES.VOICE),
  ]);

  return {
    userId,
    balances: {
      characterUnlock: character.balance,
      photoUnlock: photo.balance,
      videoUnlock: video.balance,
      voiceUnlock: voice.balance,
    },
  };
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