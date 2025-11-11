/**
 * 解鎖票系統服務
 * 管理角色解鎖票、拍照解鎖卡、影片解鎖卡
 */

import { getUserById, upsertUser } from "../user/user.service.js";
import { photoLimitService } from "../ai/photoLimit.service.js";
import { videoLimitService } from "../ai/videoLimit.service.js";

/**
 * 解鎖票類型
 */
export const TICKET_TYPES = {
  CHARACTER: "character_unlock_ticket",   // 角色解鎖票
  PHOTO: "photo_unlock_card",             // 拍照解鎖卡
  VIDEO: "video_unlock_card",             // 影片解鎖卡
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
      usageHistory: [],
    };
  }
  return user.unlockTickets;
};

/**
 * 獲取用戶的解鎖票餘額（支持多種資料結構，向後兼容）
 */
export const getTicketBalance = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const tickets = initUserTickets(user);

  // 優先從 unlockTickets 讀取，然後是 assets，最後是頂層
  // 如果某個位置的值為 0，繼續查找下一個位置
  const getCardCount = (cardType) => {
    if (user?.unlockTickets?.[cardType] !== undefined && user.unlockTickets[cardType] > 0) {
      return user.unlockTickets[cardType];
    }
    if (user?.assets?.[cardType] !== undefined && user.assets[cardType] > 0) {
      return user.assets[cardType];
    }
    if (user?.[cardType] !== undefined && user[cardType] > 0) {
      return user[cardType];
    }
    return 0;
  };

  // ⚠️ 向後兼容：同時支持 characterUnlockCards（新）和 characterUnlockTickets（舊）
  // 優先使用 Cards，如果找不到則嘗試 Tickets
  const characterCards = getCardCount("characterUnlockCards") || getCardCount("characterUnlockTickets");

  return {
    userId,
    characterUnlockCards: characterCards,
    photoUnlockCards: getCardCount("photoUnlockCards"),
    videoUnlockCards: getCardCount("videoUnlockCards"),
    voiceUnlockCards: getCardCount("voiceUnlockCards"),
    createCards: getCardCount("createCards"),
  };
};

/**
 * 發放解鎖票（會員開通時使用）
 */
export const grantTickets = async (userId, ticketAmounts) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const tickets = initUserTickets(user);

  // 增加票數（統一使用 Cards 命名）
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

  // 記錄發放歷史
  tickets.usageHistory.push({
    type: "grant",
    amounts: ticketAmounts,
    timestamp: new Date().toISOString(),
    reason: "membership_activation",
  });

  // 更新用戶資料
  await upsertUser({
    ...user,
    unlockTickets: tickets,
    updatedAt: new Date().toISOString(),
  });

  // 同步更新 usage_limits 集合中的卡片數量
  if (ticketAmounts.photoUnlockCards) {
    try {
      await photoLimitService.purchaseCards(userId, ticketAmounts.photoUnlockCards, {
        source: "membership_grant",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // 同步失敗，靜默處理
    }
  }

  if (ticketAmounts.videoUnlockCards) {
    try {
      await videoLimitService.purchaseCards(userId, ticketAmounts.videoUnlockCards, {
        source: "membership_grant",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // 同步失敗，靜默處理
    }
  }

  return {
    success: true,
    granted: ticketAmounts,
    newBalance: {
      characterUnlockCards: tickets.characterUnlockCards,
      photoUnlockCards: tickets.photoUnlockCards,
      videoUnlockCards: tickets.videoUnlockCards,
    },
  };
};

/**
 * 使用角色解鎖票（限時 7 天）
 */
export const useCharacterUnlockTicket = async (userId, characterId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // ⚠️ 向後兼容：檢查多個位置的角色解鎖卡餘額（支持 Cards 和 Tickets 兩種命名）
  let currentCards = 0;
  let storageLocation = null;
  let storageKey = null;

  // 優先順序：unlockTickets.characterUnlockCards > unlockTickets.characterUnlockTickets >
  //          assets.characterUnlockCards > assets.characterUnlockTickets >
  //          頂層 characterUnlockCards > 頂層 characterUnlockTickets
  if (user?.unlockTickets?.characterUnlockCards !== undefined && user.unlockTickets.characterUnlockCards > 0) {
    currentCards = user.unlockTickets.characterUnlockCards;
    storageLocation = "unlockTickets";
    storageKey = "characterUnlockCards";
  } else if (user?.unlockTickets?.characterUnlockTickets !== undefined && user.unlockTickets.characterUnlockTickets > 0) {
    currentCards = user.unlockTickets.characterUnlockTickets;
    storageLocation = "unlockTickets";
    storageKey = "characterUnlockTickets";
  } else if (user?.assets?.characterUnlockCards !== undefined && user.assets.characterUnlockCards > 0) {
    currentCards = user.assets.characterUnlockCards;
    storageLocation = "assets";
    storageKey = "characterUnlockCards";
  } else if (user?.assets?.characterUnlockTickets !== undefined && user.assets.characterUnlockTickets > 0) {
    currentCards = user.assets.characterUnlockTickets;
    storageLocation = "assets";
    storageKey = "characterUnlockTickets";
  } else if (user?.characterUnlockCards !== undefined && user.characterUnlockCards > 0) {
    currentCards = user.characterUnlockCards;
    storageLocation = "root";
    storageKey = "characterUnlockCards";
  } else if (user?.characterUnlockTickets !== undefined && user.characterUnlockTickets > 0) {
    currentCards = user.characterUnlockTickets;
    storageLocation = "root";
    storageKey = "characterUnlockTickets";
  }

  // 檢查餘額
  if (currentCards < 1) {
    throw new Error("角色解鎖票不足");
  }

  // 計算解鎖到期時間（7 天後）
  const now = new Date();
  const unlockDays = 7;
  const unlockUntil = new Date(now.getTime() + unlockDays * 24 * 60 * 60 * 1000);

  // 根據儲存位置扣除卡片
  const updateData = { ...user, updatedAt: new Date().toISOString() };

  if (storageLocation === "unlockTickets") {
    const tickets = initUserTickets(user);
    tickets[storageKey] = currentCards - 1;
    tickets.usageHistory.push({
      type: "use",
      ticketType: TICKET_TYPES.CHARACTER,
      characterId,
      timestamp: now.toISOString(),
      unlockDays,
      unlockUntil: unlockUntil.toISOString(),
    });
    updateData.unlockTickets = tickets;
  } else if (storageLocation === "assets") {
    updateData.assets = { ...user.assets, [storageKey]: currentCards - 1 };
  } else if (storageLocation === "root") {
    updateData[storageKey] = currentCards - 1;
  }

  // 更新用戶資料
  await upsertUser(updateData);

  // 使用對話限制服務的 unlockPermanently 函數設置限時解鎖
  const { conversationLimitService } = await import("../conversation/conversationLimit.service.js");
  const unlockResult = await conversationLimitService.unlockPermanently(userId, characterId);

  return {
    success: true,
    characterId,
    remainingTickets: currentCards - 1,
    unlockDays,
    unlockUntil: unlockUntil.toISOString(),
    unlockUntilReadable: unlockUntil.toLocaleString('zh-TW'),
    ...unlockResult,
  };
};

/**
 * 使用拍照解鎖卡（支持多種資料結構，向後兼容）
 */
export const usePhotoUnlockCard = async (userId, characterId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 檢查多個位置的照片卡餘額（優先順序：unlockTickets > assets > 頂層）
  // ✅ 修復：只有值 > 0 才使用該位置（與 getPhotoUnlockCards 邏輯一致）
  let currentCards = 0;
  let storageLocation = null;

  if (user?.unlockTickets?.photoUnlockCards !== undefined && user.unlockTickets.photoUnlockCards > 0) {
    currentCards = user.unlockTickets.photoUnlockCards;
    storageLocation = "unlockTickets";
  } else if (user?.assets?.photoUnlockCards !== undefined && user.assets.photoUnlockCards > 0) {
    currentCards = user.assets.photoUnlockCards;
    storageLocation = "assets";
  } else if (user?.photoUnlockCards !== undefined && user.photoUnlockCards > 0) {
    currentCards = user.photoUnlockCards;
    storageLocation = "root";
  }

  // 檢查餘額
  if (currentCards < 1) {
    throw new Error("拍照解鎖卡不足");
  }

  // 根據儲存位置扣除卡片
  const updateData = { ...user, updatedAt: new Date().toISOString() };

  if (storageLocation === "unlockTickets") {
    const tickets = initUserTickets(user);
    tickets.photoUnlockCards -= 1;
    tickets.usageHistory.push({
      type: "use",
      ticketType: TICKET_TYPES.PHOTO,
      characterId,
      timestamp: new Date().toISOString(),
    });
    updateData.unlockTickets = tickets;
  } else if (storageLocation === "assets") {
    updateData.assets = { ...user.assets, photoUnlockCards: currentCards - 1 };
  } else if (storageLocation === "root") {
    updateData.photoUnlockCards = currentCards - 1;
  }

  // 更新用戶資料
  await upsertUser(updateData);

  return {
    success: true,
    characterId,
    remaining: currentCards - 1,
  };
};

/**
 * 使用影片解鎖卡（支持多種資料結構，向後兼容）
 */
export const useVideoUnlockCard = async (userId, characterId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 檢查多個位置的影片卡餘額（優先順序：unlockTickets > assets > 頂層）
  // ✅ 修復：只有值 > 0 才使用該位置（與 getVideoUnlockCards 邏輯一致）
  let currentCards = 0;
  let storageLocation = null;

  if (user?.unlockTickets?.videoUnlockCards !== undefined && user.unlockTickets.videoUnlockCards > 0) {
    currentCards = user.unlockTickets.videoUnlockCards;
    storageLocation = "unlockTickets";
  } else if (user?.assets?.videoUnlockCards !== undefined && user.assets.videoUnlockCards > 0) {
    currentCards = user.assets.videoUnlockCards;
    storageLocation = "assets";
  } else if (user?.videoUnlockCards !== undefined && user.videoUnlockCards > 0) {
    currentCards = user.videoUnlockCards;
    storageLocation = "root";
  }

  // 檢查餘額
  if (currentCards < 1) {
    throw new Error("影片解鎖卡不足");
  }

  // 根據儲存位置扣除卡片
  const updateData = { ...user, updatedAt: new Date().toISOString() };

  if (storageLocation === "unlockTickets") {
    const tickets = initUserTickets(user);
    tickets.videoUnlockCards -= 1;
    tickets.usageHistory.push({
      type: "use",
      ticketType: TICKET_TYPES.VIDEO,
      characterId,
      timestamp: new Date().toISOString(),
    });
    updateData.unlockTickets = tickets;
  } else if (storageLocation === "assets") {
    updateData.assets = { ...user.assets, videoUnlockCards: currentCards - 1 };
  } else if (storageLocation === "root") {
    updateData.videoUnlockCards = currentCards - 1;
  }

  // 更新用戶資料
  await upsertUser(updateData);

  return {
    success: true,
    characterId,
    remaining: currentCards - 1,
  };
};

/**
 * 獲取用戶的拍照解鎖卡數量（支持多種資料結構，向後兼容）
 */
export const getPhotoUnlockCards = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 優先順序：
  // 1. unlockTickets.photoUnlockCards（新系統）
  // 2. assets.photoUnlockCards（舊系統）
  // 3. photoUnlockCards（頂層，最舊的結構）
  if (user?.unlockTickets?.photoUnlockCards !== undefined && user.unlockTickets.photoUnlockCards > 0) {
    return user.unlockTickets.photoUnlockCards;
  }
  if (user?.assets?.photoUnlockCards !== undefined && user.assets.photoUnlockCards > 0) {
    return user.assets.photoUnlockCards;
  }
  if (user?.photoUnlockCards !== undefined && user.photoUnlockCards > 0) {
    return user.photoUnlockCards;
  }

  return 0;
};

/**
 * 獲取用戶的語音解鎖卡數量（支持多種資料結構，向後兼容）
 */
export const getVoiceUnlockCards = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 優先順序：
  // 1. unlockTickets.voiceUnlockCards（新系統）
  // 2. assets.voiceUnlockCards（舊系統）
  // 3. voiceUnlockCards（頂層，最舊的結構）
  if (user?.unlockTickets?.voiceUnlockCards !== undefined && user.unlockTickets.voiceUnlockCards > 0) {
    return user.unlockTickets.voiceUnlockCards;
  }
  if (user?.assets?.voiceUnlockCards !== undefined && user.assets.voiceUnlockCards > 0) {
    return user.assets.voiceUnlockCards;
  }
  if (user?.voiceUnlockCards !== undefined && user.voiceUnlockCards > 0) {
    return user.voiceUnlockCards;
  }

  return 0;
};

/**
 * 使用語音解鎖卡（支持多種資料結構，向後兼容）
 */
export const useVoiceUnlockCard = async (userId, characterId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 檢查多個位置的語音卡餘額（優先順序：unlockTickets > assets > 頂層）
  // ✅ 修復：只有值 > 0 才使用該位置（與 getVoiceUnlockCards 邏輯一致）
  let currentCards = 0;
  let storageLocation = null;

  if (user?.unlockTickets?.voiceUnlockCards !== undefined && user.unlockTickets.voiceUnlockCards > 0) {
    currentCards = user.unlockTickets.voiceUnlockCards;
    storageLocation = "unlockTickets";
  } else if (user?.assets?.voiceUnlockCards !== undefined && user.assets.voiceUnlockCards > 0) {
    currentCards = user.assets.voiceUnlockCards;
    storageLocation = "assets";
  } else if (user?.voiceUnlockCards !== undefined && user.voiceUnlockCards > 0) {
    currentCards = user.voiceUnlockCards;
    storageLocation = "root";
  }

  // 檢查餘額
  if (currentCards < 1) {
    throw new Error("語音解鎖卡不足");
  }

  // 根據儲存位置扣除卡片
  const updateData = { ...user, updatedAt: new Date().toISOString() };

  if (storageLocation === "unlockTickets") {
    const tickets = initUserTickets(user);
    tickets.voiceUnlockCards = (tickets.voiceUnlockCards || 0) - 1;
    tickets.usageHistory.push({
      type: "use",
      ticketType: "voice_unlock_card",
      characterId,
      timestamp: new Date().toISOString(),
    });
    updateData.unlockTickets = tickets;
  } else if (storageLocation === "assets") {
    updateData.assets = { ...user.assets, voiceUnlockCards: currentCards - 1 };
  } else if (storageLocation === "root") {
    updateData.voiceUnlockCards = currentCards - 1;
  }

  // 更新用戶資料
  await upsertUser(updateData);

  return {
    success: true,
    characterId,
    remaining: currentCards - 1,
  };
};

/**
 * 檢查是否有足夠的解鎖票
 */
export const hasEnoughTickets = async (userId, ticketType, amount = 1) => {
  const balance = await getTicketBalance(userId);

  switch (ticketType) {
    case TICKET_TYPES.CHARACTER:
      return balance.characterUnlockCards >= amount;
    case TICKET_TYPES.PHOTO:
      return balance.photoUnlockCards >= amount;
    case TICKET_TYPES.VIDEO:
      return balance.videoUnlockCards >= amount;
    default:
      return false;
  }
};

/**
 * 獲取使用歷史
 */
export const getUsageHistory = async (userId, options = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const tickets = initUserTickets(user);
  const history = tickets.usageHistory || [];

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  // 按時間降序排序
  const sorted = [...history].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  const paginated = sorted.slice(offset, offset + limit);

  return {
    userId,
    total: history.length,
    offset,
    limit,
    history: paginated,
  };
};

/**
 * 獲取用戶的活躍解鎖記錄
 * 類似藥水效果，返回所有未過期的角色解鎖
 */
export const getActiveUnlocks = async (userId) => {
  // 動態導入以避免循環依賴問題
  const { getFirestoreDb } = await import("../firebase/index.js");
  const loggerModule = await import("../utils/logger.js");
  const logger = loggerModule.default;

  const db = getFirestoreDb();
  const now = new Date();

  try {
    // 從 usage_limits 獲取用戶的限制數據
    const limitDoc = await db.collection('usage_limits').doc(userId).get();

    if (!limitDoc.exists) {
      return [];
    }

    const limitData = limitDoc.data();
    const activeUnlocks = [];

    // 檢查 conversation 字段中的角色解鎖記錄
    if (limitData.conversation && typeof limitData.conversation === 'object') {
      for (const [characterId, charData] of Object.entries(limitData.conversation)) {
        // 跳過非對象類型的數據
        if (typeof charData !== 'object' || !charData) continue;

        // 檢查是否有限時解鎖記錄
        if (charData.temporaryUnlockUntil) {
          const unlockUntil = new Date(charData.temporaryUnlockUntil);

          // 只返回未過期的解鎖記錄
          if (unlockUntil > now) {
            // 計算剩餘天數
            const remainingMs = unlockUntil.getTime() - now.getTime();
            const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

            activeUnlocks.push({
              characterId,
              unlockType: 'character',
              unlockUntil: charData.temporaryUnlockUntil,
              unlockUntilReadable: unlockUntil.toLocaleString('zh-TW'),
              remainingDays,
              activatedAt: charData.history?.[charData.history.length - 1]?.timestamp || charData.temporaryUnlockUntil,
            });
          }
        }
      }
    }

    return activeUnlocks;
  } catch (error) {
    logger.error('[getActiveUnlocks] 獲取活躍解鎖記錄失敗:', error);
    return [];
  }
};
