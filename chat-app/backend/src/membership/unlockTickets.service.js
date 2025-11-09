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
      characterUnlockTickets: 0,
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

  return {
    userId,
    characterUnlockTickets: getCardCount("characterUnlockTickets"),
    photoUnlockCards: getCardCount("photoUnlockCards"),
    videoUnlockCards: getCardCount("videoUnlockCards"),
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

  // 增加票數
  if (ticketAmounts.characterUnlockTickets) {
    tickets.characterUnlockTickets = (tickets.characterUnlockTickets || 0) + ticketAmounts.characterUnlockTickets;
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
      characterUnlockTickets: tickets.characterUnlockTickets,
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

  const tickets = initUserTickets(user);

  // 檢查餘額
  if ((tickets.characterUnlockTickets || 0) < 1) {
    throw new Error("角色解鎖票不足");
  }

  // 扣除票數
  tickets.characterUnlockTickets -= 1;

  // 計算解鎖到期時間（7 天後）
  const now = new Date();
  const unlockDays = 7;
  const unlockUntil = new Date(now.getTime() + unlockDays * 24 * 60 * 60 * 1000);

  // 記錄使用歷史
  tickets.usageHistory.push({
    type: "use",
    ticketType: TICKET_TYPES.CHARACTER,
    characterId,
    timestamp: now.toISOString(),
    unlockDays,
    unlockUntil: unlockUntil.toISOString(),
  });

  // 更新用戶資料
  await upsertUser({
    ...user,
    unlockTickets: tickets,
    updatedAt: new Date().toISOString(),
  });

  // 使用對話限制服務的 unlockPermanently 函數設置限時解鎖
  const { conversationLimitService } = await import("../conversation/conversationLimit.service.js");
  const unlockResult = await conversationLimitService.unlockPermanently(userId, characterId);

  return {
    success: true,
    characterId,
    remaining: tickets.characterUnlockTickets,
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
      return balance.characterUnlockTickets >= amount;
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

export default {
  TICKET_TYPES,
  getTicketBalance,
  grantTickets,
  useCharacterUnlockTicket,
  usePhotoUnlockCard,
  useVideoUnlockCard,
  hasEnoughTickets,
  getUsageHistory,
};
