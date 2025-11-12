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

    // 2. 檢查多個位置的角色解鎖卡餘額
    let currentCards = 0;
    let storageLocation = null;
    let storageKey = null;

    if (user?.unlockTickets?.characterUnlockCards > 0) {
      currentCards = user.unlockTickets.characterUnlockCards;
      storageLocation = "unlockTickets";
      storageKey = "characterUnlockCards";
    } else if (user?.unlockTickets?.characterUnlockTickets > 0) {
      currentCards = user.unlockTickets.characterUnlockTickets;
      storageLocation = "unlockTickets";
      storageKey = "characterUnlockTickets";
    } else if (user?.assets?.characterUnlockCards > 0) {
      currentCards = user.assets.characterUnlockCards;
      storageLocation = "assets";
      storageKey = "characterUnlockCards";
    } else if (user?.assets?.characterUnlockTickets > 0) {
      currentCards = user.assets.characterUnlockTickets;
      storageLocation = "assets";
      storageKey = "characterUnlockTickets";
    } else if (user?.characterUnlockCards > 0) {
      currentCards = user.characterUnlockCards;
      storageLocation = "root";
      storageKey = "characterUnlockCards";
    } else if (user?.characterUnlockTickets > 0) {
      currentCards = user.characterUnlockTickets;
      storageLocation = "root";
      storageKey = "characterUnlockTickets";
    }

    // 3. 檢查餘額
    if (currentCards < 1) {
      throw new Error("角色解鎖票不足");
    }

    // 4. 計算解鎖到期時間（7 天後）
    const now = new Date();
    const unlockDays = 7;
    const unlockUntil = new Date(now.getTime() + unlockDays * 24 * 60 * 60 * 1000);

    // 5. 根據儲存位置扣除卡片（在 Transaction 內）
    const updateData = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (storageLocation === "unlockTickets") {
      // 初始化 unlockTickets（如果不存在）
      const tickets = user.unlockTickets || {
        characterUnlockCards: 0,
        photoUnlockCards: 0,
        videoUnlockCards: 0,
        voiceUnlockCards: 0,
        usageHistory: [],
      };

      tickets[storageKey] = currentCards - 1;
      tickets.usageHistory.push({
        type: "use",
        ticketType: TICKET_TYPES.CHARACTER,
        characterId,
        timestamp: FieldValue.serverTimestamp(),
        unlockDays,
        unlockUntil: unlockUntil.toISOString(),
      });

      updateData.unlockTickets = tickets;
    } else if (storageLocation === "assets") {
      updateData[`assets.${storageKey}`] = currentCards - 1;
    } else if (storageLocation === "root") {
      updateData[storageKey] = currentCards - 1;
    }

    // 6. 更新用戶資料（在 Transaction 內）
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

    // 檢查多個位置的照片卡餘額
    let currentCards = 0;
    let storageLocation = null;

    if (user?.unlockTickets?.photoUnlockCards > 0) {
      currentCards = user.unlockTickets.photoUnlockCards;
      storageLocation = "unlockTickets";
    } else if (user?.assets?.photoUnlockCards > 0) {
      currentCards = user.assets.photoUnlockCards;
      storageLocation = "assets";
    } else if (user?.photoUnlockCards > 0) {
      currentCards = user.photoUnlockCards;
      storageLocation = "root";
    }

    // 檢查餘額
    if (currentCards < 1) {
      throw new Error("拍照解鎖卡不足");
    }

    // 扣除卡片
    const updateData = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (storageLocation === "unlockTickets") {
      const tickets = user.unlockTickets || {};
      tickets.photoUnlockCards = currentCards - 1;
      updateData.unlockTickets = tickets;
    } else if (storageLocation === "assets") {
      updateData["assets.photoUnlockCards"] = currentCards - 1;
    } else if (storageLocation === "root") {
      updateData.photoUnlockCards = currentCards - 1;
    }

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

    // 檢查多個位置的影片卡餘額
    let currentCards = 0;
    let storageLocation = null;

    if (user?.unlockTickets?.videoUnlockCards > 0) {
      currentCards = user.unlockTickets.videoUnlockCards;
      storageLocation = "unlockTickets";
    } else if (user?.assets?.videoUnlockCards > 0) {
      currentCards = user.assets.videoUnlockCards;
      storageLocation = "assets";
    } else if (user?.videoUnlockCards > 0) {
      currentCards = user.videoUnlockCards;
      storageLocation = "root";
    }

    // 檢查餘額
    if (currentCards < 1) {
      throw new Error("影片解鎖卡不足");
    }

    // 扣除卡片
    const updateData = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (storageLocation === "unlockTickets") {
      const tickets = user.unlockTickets || {};
      tickets.videoUnlockCards = currentCards - 1;
      updateData.unlockTickets = tickets;
    } else if (storageLocation === "assets") {
      updateData["assets.videoUnlockCards"] = currentCards - 1;
    } else if (storageLocation === "root") {
      updateData.videoUnlockCards = currentCards - 1;
    }

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
      if (user?.unlockTickets?.videoUnlockCards > 0) {
        balance = user.unlockTickets.videoUnlockCards;
      } else if (user?.assets?.videoUnlockCards > 0) {
        balance = user.assets.videoUnlockCards;
      } else if (user?.videoUnlockCards > 0) {
        balance = user.videoUnlockCards;
      }
      break;

    case TICKET_TYPES.VOICE:
      if (user?.unlockTickets?.voiceUnlockCards > 0) {
        balance = user.unlockTickets.voiceUnlockCards;
      } else if (user?.assets?.voiceUnlockCards > 0) {
        balance = user.assets.voiceUnlockCards;
      } else if (user?.voiceUnlockCards > 0) {
        balance = user.voiceUnlockCards;
      }
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

export default {
  useCharacterUnlockTicket,
  usePhotoUnlockCard,
  useVideoUnlockCard,
  getTicketBalance,
  getAllTicketBalances,
  TICKET_TYPES,
};
