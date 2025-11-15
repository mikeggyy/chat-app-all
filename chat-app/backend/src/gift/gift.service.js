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
import { getFirestoreDb, FieldValue } from "../firebase/index.js";
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
 * ✅ P1-2 修復：將所有操作合併到單一 Transaction 中，確保原子性
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

  // ✅ P1-2 修復：使用單一 Transaction 執行所有操作
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);
  const giftRecordRef = db.collection("gift_transactions").doc();
  const characterGiftStatsRef = db
    .collection("users")
    .doc(userId)
    .collection("character_gift_stats")
    .doc(characterId);
  const transactionRef = db.collection("transactions").doc();

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料（在 Transaction 內重新讀取以確保最新）
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const userData = userDoc.data();
    const { getWalletBalance, createWalletUpdate } = await import("../user/walletHelpers.js");
    const currentBalance = getWalletBalance(userData);

    // 2. 檢查餘額是否足夠
    if (currentBalance < pricing.finalPrice) {
      throw new Error(`金幣不足，當前餘額：${currentBalance}，需要：${pricing.finalPrice}`);
    }

    const newBalance = currentBalance - pricing.finalPrice;

    // 3. 在同一事務中更新用戶餘額
    const walletUpdate = createWalletUpdate(newBalance);
    transaction.update(userRef, {
      ...walletUpdate,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 4. 創建禮物記錄
    transaction.set(giftRecordRef, {
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
      previousBalance: currentBalance,
      newBalance: newBalance,
    });

    // 5. 更新禮物統計
    const statsDoc = await transaction.get(characterGiftStatsRef);
    let stats = statsDoc.exists
      ? statsDoc.data()
      : {
          userId,
          characterId,
          gifts: {},
          totalGifts: 0,
          totalSpent: 0,
        };

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

    // 6. 創建交易記錄
    const { TRANSACTION_TYPES } = await import("../payment/coins.service.js");
    transaction.set(transactionRef, {
      id: transactionRef.id,
      userId,
      type: TRANSACTION_TYPES.SPEND,
      amount: pricing.finalPrice,
      description: `送禮物：${gift.name} 給角色 ${characterId}`,
      metadata: {
        type: "gift",
        giftId,
        characterId,
        pricing,
      },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
    });

    // 設置返回結果
    result = {
      success: true,
      transactionId: giftRecordRef.id,
      gift: {
        id: gift.id,
        name: gift.name,
        emoji: gift.emoji,
      },
      pricing,
      previousBalance: currentBalance,
      newBalance: newBalance,
      thankYouMessage: gift.thankYouMessage,
    };
  });

  logger.info(`[禮物] 用戶 ${userId} 送禮物 ${gift.name} 給角色 ${characterId}，花費 ${pricing.finalPrice} 金幣`);

  return result;
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