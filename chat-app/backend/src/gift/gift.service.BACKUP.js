/**
 * 禮物系統服務
 */

import { getGiftById, isValidGift, getGiftList } from "../config/gifts.js";
import { getUserById, upsertUser } from "../user/user.service.js";
import { getCoinsBalance } from "../payment/coins.service.js";
import { getUserTier } from "../utils/membershipUtils.js";

/**
 * 禮物交易記錄
 * Map<userId, GiftTransaction[]>
 */
const giftTransactions = new Map();

/**
 * 用戶收到的禮物統計
 * Map<userId, Map<characterId, Map<giftId, count>>>
 */
const receivedGifts = new Map();

/**
 * 禮物交易記錄結構
 */
class GiftTransaction {
  constructor(userId, characterId, giftId, cost) {
    this.id = `gift_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.userId = userId;
    this.characterId = characterId;
    this.giftId = giftId;
    this.cost = cost;
    this.timestamp = new Date().toISOString();
    this.status = "completed";
  }
}

/**
 * 初始化用戶禮物記錄
 */
const initUserGiftRecords = (userId) => {
  if (!giftTransactions.has(userId)) {
    giftTransactions.set(userId, []);
  }
  return giftTransactions.get(userId);
};

/**
 * 初始化角色收到的禮物統計
 */
const initCharacterGiftStats = (userId, characterId) => {
  if (!receivedGifts.has(userId)) {
    receivedGifts.set(userId, new Map());
  }
  const userGifts = receivedGifts.get(userId);
  if (!userGifts.has(characterId)) {
    userGifts.set(characterId, new Map());
  }
  return userGifts.get(characterId);
};

/**
 * 計算禮物價格（考慮會員折扣）
 */
const calculateGiftPrice = (giftId, membershipTier) => {
  const gift = getGiftById(giftId);
  if (!gift) {
    throw new Error(`找不到禮物：${giftId}`);
  }

  // 根據會員等級計算折扣
  const discountMap = {
    free: 0,
    vip: 0.1,    // 9折
    vvip: 0.2,   // 8折
  };

  const discount = discountMap[membershipTier] || 0;
  const finalPrice = Math.ceil(gift.price * (1 - discount));

  return {
    basePrice: gift.price,
    discount,
    finalPrice,
    saved: gift.price - finalPrice,
  };
};

/**
 * 送禮物給角色
 */
export const sendGift = async (userId, characterId, giftId) => {
  // 驗證禮物是否存在
  if (!isValidGift(giftId)) {
    throw new Error(`無效的禮物ID：${giftId}`);
  }

  // 獲取用戶資料
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 獲取禮物資料
  const gift = getGiftById(giftId);

  // 計算價格
  const tier = await getUserTier(userId);
  const pricing = calculateGiftPrice(giftId, tier);

  // 檢查金幣餘額
  const balance = getCoinsBalance(userId);
  if (balance.balance < pricing.finalPrice) {
    throw new Error(`金幣不足，需要 ${pricing.finalPrice} 金幣，目前餘額：${balance.balance}`);
  }

  // 扣除金幣
  const currentBalance = user.walletBalance || 0;
  const newBalance = currentBalance - pricing.finalPrice;

  await upsertUser({
    ...user,
    walletBalance: newBalance,
    wallet: {
      ...user.wallet,
      balance: newBalance,
      updatedAt: new Date().toISOString(),
    },
    coins: newBalance,
    updatedAt: new Date().toISOString(),
  });

  // 記錄交易
  const records = initUserGiftRecords(userId);
  const transaction = new GiftTransaction(userId, characterId, giftId, pricing.finalPrice);
  records.push(transaction);

  // 更新角色收到的禮物統計
  const characterGifts = initCharacterGiftStats(userId, characterId);
  const currentCount = characterGifts.get(giftId) || 0;
  characterGifts.set(giftId, currentCount + 1);

  return {
    success: true,
    transactionId: transaction.id,
    gift: {
      id: gift.id,
      name: gift.name,
      emoji: gift.emoji,
    },
    pricing,
    previousBalance: currentBalance,
    newBalance,
    thankYouMessage: gift.thankYouMessage,
  };
};

/**
 * 獲取用戶送禮記錄
 */
export const getUserGiftHistory = (userId, options = {}) => {
  const records = initUserGiftRecords(userId);
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const characterId = options.characterId;

  // 過濾特定角色
  let filtered = records;
  if (characterId) {
    filtered = records.filter((tx) => tx.characterId === characterId);
  }

  // 按時間降序排序
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  const paginated = sorted.slice(offset, offset + limit);

  // 附加禮物詳細資訊
  const withDetails = paginated.map((tx) => {
    const gift = getGiftById(tx.giftId);
    return {
      ...tx,
      gift: gift ? {
        id: gift.id,
        name: gift.name,
        emoji: gift.emoji,
      } : null,
    };
  });

  return {
    userId,
    total: filtered.length,
    offset,
    limit,
    transactions: withDetails,
  };
};

/**
 * 獲取角色收到的禮物統計
 */
export const getCharacterGiftStats = (userId, characterId) => {
  const characterGifts = initCharacterGiftStats(userId, characterId);
  const stats = {};

  for (const [giftId, count] of characterGifts.entries()) {
    const gift = getGiftById(giftId);
    if (gift) {
      stats[giftId] = {
        gift: {
          id: gift.id,
          name: gift.name,
          emoji: gift.emoji,
        },
        count,
      };
    }
  }

  return {
    userId,
    characterId,
    stats,
    totalGifts: Array.from(characterGifts.values()).reduce((sum, count) => sum + count, 0),
  };
};

/**
 * 獲取禮物價格列表（考慮用戶會員等級）
 */
export const getGiftPricing = async (userId) => {
  const user = await getUserById(userId);
  const tier = user ? await getUserTier(userId) : "free";

  // 獲取所有禮物
  const gifts = getGiftList();

  const pricing = gifts.map((gift) => {
    const priceInfo = calculateGiftPrice(gift.id, tier);
    return {
      id: gift.id,
      name: gift.name,
      emoji: gift.emoji,
      description: gift.description,
      rarity: gift.rarity,
      ...priceInfo,
    };
  });

  const balance = user ? (user.walletBalance || 0) : 0;

  return {
    userId,
    tier,
    balance,
    gifts: pricing,
  };
};

export default {
  sendGift,
  getUserGiftHistory,
  getCharacterGiftStats,
  getGiftPricing,
};
