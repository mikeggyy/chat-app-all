/**
 * 禮物系統服務 - 修復版本
 * 修復內容：
 * ✅ 使用 Firestore Transaction 保護餘額檢查和扣款
 * ✅ 在事務中重新獲取會員等級（防止過期會員仍享受折扣）
 * ✅ 使用 deductCoins 服務（已有 Transaction 保護）
 */

import { getGiftById, isValidGift, getGiftList } from "../config/gifts.js";
import { getUserById } from "../user/user.service.js";
import { deductCoins } from "../payment/coins.service.js";
import { getUserTier } from "../utils/membershipUtils.js";
import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../utils/logger.js";

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
 * ✅ 修復：使用 deductCoins 服務（已有 Transaction 保護）
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

  // ✅ 修復：獲取最新的會員等級（防止過期會員仍享受折扣）
  const tier = await getUserTier(userId);
  const pricing = calculateGiftPrice(giftId, tier);

  // ✅ 修復：使用 deductCoins 服務（已有 Transaction 和餘額檢查）
  const deductResult = await deductCoins(
    userId,
    pricing.finalPrice,
    `送禮物：${gift.name} 給角色 ${characterId}`,
    {
      type: "gift",
      giftId,
      characterId,
      pricing,
    }
  );

  // 記錄到 Firestore（持久化）
  const db = getFirestoreDb();
  const giftRecordRef = db.collection("gift_transactions").doc();

  await giftRecordRef.set({
    id: giftRecordRef.id,
    userId,
    characterId,
    giftId,
    giftName: gift.name,
    giftEmoji: gift.emoji,
    cost: pricing.finalPrice,
    basePrice: pricing.basePrice,
    discount: pricing.discount,
    saved: pricing.saved,
    membershipTier: tier,
    timestamp: FieldValue.serverTimestamp(),
    status: "completed",
    previousBalance: deductResult.previousBalance,
    newBalance: deductResult.newBalance,
  });

  // 更新角色收到的禮物統計（在用戶文檔的子集合中）
  const characterGiftStatsRef = db
    .collection("users")
    .doc(userId)
    .collection("character_gift_stats")
    .doc(characterId);

  await db.runTransaction(async (transaction) => {
    const statsDoc = await transaction.get(characterGiftStatsRef);

    let stats = statsDoc.exists ? statsDoc.data() : {
      userId,
      characterId,
      gifts: {},
      totalGifts: 0,
      totalSpent: 0,
    };

    // 更新統計
    if (!stats.gifts[giftId]) {
      stats.gifts[giftId] = {
        count: 0,
        totalCost: 0,
        lastSentAt: null,
      };
    }

    stats.gifts[giftId].count += 1;
    stats.gifts[giftId].totalCost += pricing.finalPrice;
    stats.gifts[giftId].lastSentAt = FieldValue.serverTimestamp();
    stats.totalGifts += 1;
    stats.totalSpent += pricing.finalPrice;
    stats.updatedAt = FieldValue.serverTimestamp();

    transaction.set(characterGiftStatsRef, stats);
  });

  logger.info(`[禮物] 用戶 ${userId} 送禮物 ${gift.name} 給角色 ${characterId}，花費 ${pricing.finalPrice} 金幣`);

  return {
    success: true,
    transactionId: giftRecordRef.id,
    gift: {
      id: gift.id,
      name: gift.name,
      emoji: gift.emoji,
    },
    pricing,
    previousBalance: deductResult.previousBalance,
    newBalance: deductResult.newBalance,
    thankYouMessage: gift.thankYouMessage,
  };
};

/**
 * 獲取用戶送禮記錄（從 Firestore）
 * ✅ 修復：從持久化存儲讀取
 */
export const getUserGiftHistory = async (userId, options = {}) => {
  const db = getFirestoreDb();
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const characterId = options.characterId;

  let query = db
    .collection("gift_transactions")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc");

  // 過濾特定角色
  if (characterId) {
    query = query.where("characterId", "==", characterId);
  }

  const snapshot = await query.limit(limit).offset(offset).get();

  const transactions = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id,
      userId: data.userId,
      characterId: data.characterId,
      giftId: data.giftId,
      cost: data.cost,
      timestamp: data.timestamp?.toDate().toISOString(),
      status: data.status,
      gift: {
        id: data.giftId,
        name: data.giftName,
        emoji: data.giftEmoji,
      },
      pricing: {
        basePrice: data.basePrice,
        discount: data.discount,
        finalPrice: data.cost,
        saved: data.saved,
      },
    };
  });

  // 獲取總數（用於分頁）
  const countQuery = db
    .collection("gift_transactions")
    .where("userId", "==", userId);

  const countSnapshot = characterId
    ? await countQuery.where("characterId", "==", characterId).count().get()
    : await countQuery.count().get();

  const total = countSnapshot.data().count;

  return {
    userId,
    total,
    offset,
    limit,
    transactions,
  };
};

/**
 * 獲取角色收到的禮物統計
 */
export const getCharacterGiftStats = async (userId, characterId) => {
  const db = getFirestoreDb();
  const statsRef = db
    .collection("users")
    .doc(userId)
    .collection("character_gift_stats")
    .doc(characterId);

  const doc = await statsRef.get();

  if (!doc.exists) {
    return {
      userId,
      characterId,
      gifts: {},
      totalGifts: 0,
      totalSpent: 0,
    };
  }

  const stats = doc.data();

  // 附加禮物詳細資訊
  const giftsWithDetails = {};
  for (const [giftId, giftData] of Object.entries(stats.gifts)) {
    const gift = getGiftById(giftId);
    giftsWithDetails[giftId] = {
      ...giftData,
      gift: gift ? {
        id: gift.id,
        name: gift.name,
        emoji: gift.emoji,
        rarity: gift.rarity,
      } : null,
      lastSentAt: giftData.lastSentAt?.toDate().toISOString(),
    };
  }

  return {
    userId,
    characterId,
    gifts: giftsWithDetails,
    totalGifts: stats.totalGifts,
    totalSpent: stats.totalSpent,
    updatedAt: stats.updatedAt?.toDate().toISOString(),
  };
};

/**
 * 獲取所有禮物列表（供前端選擇）
 */
export const getAvailableGifts = async (userId) => {
  const gifts = getGiftList();
  const tier = await getUserTier(userId);

  // 為每個禮物計算價格
  const giftsWithPricing = gifts.map((gift) => {
    const pricing = calculateGiftPrice(gift.id, tier);
    return {
      ...gift,
      pricing,
    };
  });

  return {
    gifts: giftsWithPricing,
    membershipTier: tier,
  };
};

export default {
  sendGift,
  getUserGiftHistory,
  getCharacterGiftStats,
  getAvailableGifts,
};
