/**
 * 金幣系統服務
 * 處理金幣的消費、充值、交易記錄
 */

import { getUserById, upsertUser } from "../user/user.service.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import { AI_FEATURE_PRICES, getFeaturePrice, COIN_PACKAGES } from "../membership/membership.config.js";
import { unlockPermanently } from "../conversation/conversationLimit.service.js";
import {
  getTicketBalance,
  usePhotoUnlockCard,
  useVideoUnlockCard,
  useCharacterUnlockTicket
} from "../membership/unlockTickets.service.js";
import {
  createTransaction,
  createTransactionInTx,
  getUserTransactions,
  getUserTransactionStats,
  TRANSACTION_TYPES as TX_TYPES
} from "./transaction.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import logger from "../utils/logger.js";

// 緩存 AI 功能價格和金幣套餐（避免重複查詢 Firestore）
const aiFeaturePricesCache = new Map();
const coinPackagesCache = [];
let pricesCacheExpiry = 0;
let packagesCacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 分鐘緩存

/**
 * 從 Firestore 獲取 AI 功能價格
 * @returns {Promise<Object>} AI 功能價格配置
 */
const getAiFeaturePricesFromFirestore = async () => {
  const now = Date.now();

  // 檢查緩存
  if (aiFeaturePricesCache.size > 0 && now < pricesCacheExpiry) {
    return Object.fromEntries(aiFeaturePricesCache);
  }

  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection("ai_feature_prices").get();

    if (!snapshot.empty) {
      aiFeaturePricesCache.clear();
      snapshot.forEach(doc => {
        const data = doc.data();
        aiFeaturePricesCache.set(doc.id, data);
      });
      pricesCacheExpiry = now + CACHE_TTL;
      logger.debug(`[金幣服務] 從 Firestore 讀取 AI 功能價格: ${aiFeaturePricesCache.size} 個`);
      return Object.fromEntries(aiFeaturePricesCache);
    }
  } catch (error) {
    logger.warn(`[金幣服務] 從 Firestore 讀取 AI 功能價格失敗: ${error.message}`);
  }

  // 如果 Firestore 中沒有，使用代碼中的默認值
  logger.debug(`[金幣服務] 使用代碼中的 AI 功能價格`);
  return AI_FEATURE_PRICES;
};

/**
 * 從 Firestore 獲取金幣充值套餐
 * @returns {Promise<Array>} 金幣套餐列表
 */
const getCoinPackagesFromFirestore = async () => {
  const now = Date.now();

  // 檢查緩存
  if (coinPackagesCache.length > 0 && now < packagesCacheExpiry) {
    return coinPackagesCache;
  }

  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection("coin_packages").where("status", "==", "active").get();

    if (!snapshot.empty) {
      coinPackagesCache.length = 0;
      snapshot.forEach(doc => {
        coinPackagesCache.push(doc.data());
      });
      packagesCacheExpiry = now + CACHE_TTL;
      logger.debug(`[金幣服務] 從 Firestore 讀取金幣套餐: ${coinPackagesCache.length} 個`);
      return coinPackagesCache;
    }
  } catch (error) {
    logger.warn(`[金幣服務] 從 Firestore 讀取金幣套餐失敗: ${error.message}`);
  }

  // 如果 Firestore 中沒有，使用代碼中的默認值
  logger.debug(`[金幣服務] 使用代碼中的金幣套餐`);
  return Object.values(COIN_PACKAGES);
};

/**
 * 交易類型（從 transaction.service 導出）
 */
export const TRANSACTION_TYPES = TX_TYPES;

/**
 * 獲取用戶金幣餘額
 */
export const getCoinsBalance = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  return {
    userId,
    balance: getWalletBalance(user),
    currency: "coins",
  };
};

/**
 * 扣除金幣（使用 Firestore Transaction 確保原子性）
 */
export const deductCoins = async (userId, amount, description, metadata = {}) => {
  if (amount <= 0) {
    throw new Error("扣除金額必須大於 0");
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);

    // 2. 檢查餘額是否足夠
    if (currentBalance < amount) {
      throw new Error(`金幣不足，當前餘額：${currentBalance}，需要：${amount}`);
    }

    const newBalance = currentBalance - amount;

    // 3. 在同一事務中更新用戶餘額
    const walletUpdate = createWalletUpdate(newBalance);
    transaction.update(userRef, {
      ...walletUpdate,
      updatedAt: new Date().toISOString(),
    });

    // 4. 在同一事務中創建交易記錄
    createTransactionInTx(transaction, {
      userId,
      type: TRANSACTION_TYPES.SPEND,
      amount: -amount,
      description,
      metadata,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    // 5. 設置返回結果
    result = {
      success: true,
      previousBalance: currentBalance,
      newBalance,
      amount,
    };

    logger.info(`[金幣服務] 扣除金幣: 用戶 ${userId}, 金額 ${amount}, 餘額 ${currentBalance} → ${newBalance}`);
  });

  return result;
};

/**
 * 增加金幣（使用 Firestore Transaction 確保原子性）
 */
export const addCoins = async (userId, amount, type, description, metadata = {}) => {
  if (amount <= 0) {
    throw new Error("增加金額必須大於 0");
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);
    const newBalance = currentBalance + amount;

    // 2. 在同一事務中更新用戶餘額
    const walletUpdate = createWalletUpdate(newBalance);
    transaction.update(userRef, {
      ...walletUpdate,
      updatedAt: new Date().toISOString(),
    });

    // 3. 在同一事務中創建交易記錄
    createTransactionInTx(transaction, {
      userId,
      type,
      amount,
      description,
      metadata,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    // 4. 設置返回結果
    result = {
      success: true,
      previousBalance: currentBalance,
      newBalance,
      amount,
    };

    logger.info(`[金幣服務] 增加金幣: 用戶 ${userId}, 金額 ${amount}, 餘額 ${currentBalance} → ${newBalance}`);
  });

  return result;
};

/**
 * 購買 AI 拍照功能
 */
export const purchaseAiPhoto = async (userId, characterId, options = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 檢查是否有拍照解鎖卡
  const ticketBalance = await getTicketBalance(userId);
  const useCard = options.useCard !== false; // 預設使用解鎖卡

  if (useCard && ticketBalance.photoUnlockCards > 0) {
    // 使用拍照解鎖卡
    await usePhotoUnlockCard(userId, characterId);

    return {
      success: true,
      featureId: "ai_photo",
      characterId,
      cost: 0,
      paymentMethod: "unlock_card",
      remainingCards: ticketBalance.photoUnlockCards - 1,
      // TODO: 實際應該排隊生成圖片，返回任務 ID
      taskId: `photo_${Date.now()}`,
    };
  }

  // 如果沒有解鎖卡，使用金幣購買
  const tier = user.membershipTier || "free";
  const pricing = getFeaturePrice("aiPhoto", tier);

  // 扣除金幣
  const result = await deductCoins(
    userId,
    pricing.finalPrice,
    `AI 拍照 - ${characterId}`,
    {
      featureId: "ai_photo",
      characterId,
      basePrice: pricing.basePrice,
      discount: pricing.discount,
      saved: pricing.saved,
    }
  );

  return {
    success: true,
    featureId: "ai_photo",
    characterId,
    cost: pricing.finalPrice,
    paymentMethod: "coins",
    balance: result.newBalance,
    // TODO: 實際應該排隊生成圖片，返回任務 ID
    taskId: `photo_${Date.now()}`,
  };
};

/**
 * 購買 AI 影片功能
 */
export const purchaseAiVideo = async (userId, characterId, options = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 檢查是否有影片解鎖卡
  const ticketBalance = await getTicketBalance(userId);
  const useCard = options.useCard !== false; // 預設使用解鎖卡

  if (useCard && ticketBalance.videoUnlockCards > 0) {
    // 使用影片解鎖卡
    await useVideoUnlockCard(userId, characterId);

    return {
      success: true,
      featureId: "ai_video",
      characterId,
      cost: 0,
      paymentMethod: "unlock_card",
      remainingCards: ticketBalance.videoUnlockCards - 1,
      // TODO: 實際應該排隊生成影片，返回任務 ID
      taskId: `video_${Date.now()}`,
    };
  }

  // 如果沒有解鎖卡，使用金幣購買
  const tier = user.membershipTier || "free";
  const pricing = getFeaturePrice("aiVideo", tier);

  // 扣除金幣
  const result = await deductCoins(
    userId,
    pricing.finalPrice,
    `AI 影片 - ${characterId}`,
    {
      featureId: "ai_video",
      characterId,
      basePrice: pricing.basePrice,
      discount: pricing.discount,
      saved: pricing.saved,
    }
  );

  return {
    success: true,
    featureId: "ai_video",
    characterId,
    cost: pricing.finalPrice,
    paymentMethod: "coins",
    balance: result.newBalance,
    // TODO: 實際應該排隊生成影片，返回任務 ID
    taskId: `video_${Date.now()}`,
  };
};

/**
 * 購買角色無限對話解鎖（使用角色解鎖票或金幣）
 */
export const purchaseUnlimitedChat = async (userId, characterId, options = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 檢查是否有角色解鎖票
  const ticketBalance = await getTicketBalance(userId);
  const useTicket = options.useTicket !== false; // 預設使用解鎖票

  if (useTicket && ticketBalance.characterUnlockCards > 0) {
    // 使用角色解鎖票
    await useCharacterUnlockTicket(userId, characterId);

    // 永久解鎖該角色的對話
    unlockPermanently(userId, characterId);

    return {
      success: true,
      featureId: "character_unlock_ticket",
      characterId,
      cost: 0,
      paymentMethod: "unlock_ticket",
      remainingTickets: ticketBalance.characterUnlockCards - 1,
      permanent: true,
    };
  }

  // 如果沒有解鎖票，使用金幣購買
  const aiFeaturePrices = await getAiFeaturePricesFromFirestore();
  const feature = aiFeaturePrices.character_unlock_ticket || aiFeaturePrices.characterUnlockTicket;

  if (!feature) {
    throw new Error("找不到角色解鎖票價格配置");
  }

  const result = await deductCoins(
    userId,
    feature.basePrice,
    `${feature.description} - ${characterId}`,
    {
      featureId: feature.id,
      characterId,
    }
  );

  // 永久解鎖該角色的對話
  unlockPermanently(userId, characterId);

  return {
    success: true,
    featureId: feature.id,
    characterId,
    cost: feature.basePrice,
    paymentMethod: "coins",
    balance: result.newBalance,
    permanent: true,
  };
};

/**
 * 獲取功能價格（考慮會員折扣）
 */
export const getFeaturePricing = async (userId, featureId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const tier = user.membershipTier || "free";
  const pricing = getFeaturePrice(featureId, tier);

  return {
    featureId,
    tier,
    ...pricing,
  };
};

/**
 * 獲取所有可購買功能的價格列表
 */
export const getAllFeaturePrices = async (userId) => {
  const user = await getUserById(userId);
  const tier = user?.membershipTier || "free";

  const aiFeaturePrices = await getAiFeaturePricesFromFirestore();
  const features = {};

  for (const [featureId, feature] of Object.entries(aiFeaturePrices)) {
    const pricing = getFeaturePrice(featureId, tier);
    features[featureId] = {
      ...feature,
      ...pricing,
    };
  }

  return {
    tier,
    balance: getWalletBalance(user),
    features,
  };
};

/**
 * 獲取用戶交易記錄
 */
export const getTransactionHistory = async (userId, options = {}) => {
  const transactions = await getUserTransactions(userId, options);

  return {
    userId,
    total: transactions.length,
    offset: options.offset || 0,
    limit: options.limit || 50,
    transactions,
  };
};

/**
 * 獲取金幣充值套餐列表
 */
export const getCoinPackages = async () => {
  const packages = await getCoinPackagesFromFirestore();
  return {
    success: true,
    packages,
  };
};

/**
 * 充值金幣（管理員或支付成功後呼叫）
 */
export const rechargeCoins = (userId, amount, paymentInfo = {}) => {
  return addCoins(
    userId,
    amount,
    TRANSACTION_TYPES.PURCHASE,
    `購買金幣 x${amount}`,
    {
      payment: paymentInfo,
    }
  );
};

/**
 * 購買金幣套餐（整合支付系統後使用）
 */
export const purchaseCoinPackage = async (userId, packageId, paymentInfo = {}) => {
  const packages = await getCoinPackagesFromFirestore();
  const coinPackage = packages.find(pkg => pkg.id === packageId);

  if (!coinPackage) {
    throw new Error(`找不到金幣套餐：${packageId}`);
  }

  // TODO: 整合支付系統
  // 目前直接發放金幣，實際應用應先驗證付款成功

  return addCoins(
    userId,
    coinPackage.totalCoins,
    TRANSACTION_TYPES.PURCHASE,
    `購買 ${coinPackage.name}`,
    {
      packageId,
      baseCoins: coinPackage.coins,
      bonus: coinPackage.bonus,
      payment: paymentInfo,
    }
  );
};

/**
 * 退款（管理員功能）
 */
export const refundCoins = (userId, amount, reason) => {
  return addCoins(
    userId,
    amount,
    TRANSACTION_TYPES.REFUND,
    `退款：${reason}`,
    { reason }
  );
};

/**
 * 設定金幣餘額（測試帳號專用，使用 Firestore Transaction 確保原子性）
 * 直接設定金幣數量，不考慮原有餘額
 */
export const setCoinsBalance = async (userId, newBalance) => {
  if (newBalance < 0) {
    throw new Error("金幣餘額不能為負數");
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);
    const difference = newBalance - currentBalance;

    // 2. 在同一事務中更新用戶餘額
    const walletUpdate = createWalletUpdate(newBalance);
    transaction.update(userRef, {
      ...walletUpdate,
      updatedAt: new Date().toISOString(),
    });

    // 3. 記錄交易到 Firestore
    const description = difference > 0
      ? `測試帳號設定金幣 +${difference}`
      : `測試帳號設定金幣 ${difference}`;

    createTransactionInTx(transaction, {
      userId,
      type: TRANSACTION_TYPES.ADMIN,
      amount: difference,
      description,
      metadata: { previousBalance: currentBalance },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    // 4. 設置返回結果
    result = {
      success: true,
      previousBalance: currentBalance,
      newBalance,
      difference,
    };

    logger.info(`[金幣服務] 設定金幣餘額: 用戶 ${userId}, 餘額 ${currentBalance} → ${newBalance}`);
  });

  return result;
};

/**
 * 獲取交易記錄統計資訊（使用 Firestore）
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 統計選項
 * @returns {Promise<Object>} 統計資訊
 */
export const getTransactionStats = async (userId, options = {}) => {
  return await getUserTransactionStats(userId, options);
};

export default {
  getCoinsBalance,
  addCoins,
  purchaseAiPhoto,
  purchaseAiVideo,
  purchaseUnlimitedChat,
  getFeaturePricing,
  getAllFeaturePrices,
  getTransactionHistory,
  getCoinPackages,
  purchaseCoinPackage,
  rechargeCoins,
  refundCoins,
  setCoinsBalance,
  getTransactionStats,
};
