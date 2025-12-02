/**
 * 首購優惠服務
 * 處理首購禮包的資格檢查和購買
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import { getUserById } from "../user/user.service.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import { FIRST_PURCHASE_OFFER } from "../config/rewards.js";
import {
  createTransactionInTx,
  TRANSACTION_TYPES,
} from "../payment/transaction.service.js";
import logger from "../utils/logger.js";

/**
 * 檢查用戶是否有資格購買首購禮包
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 資格檢查結果
 */
export const checkFirstPurchaseEligibility = async (userId) => {
  const db = getFirestoreDb();

  // 1. 獲取用戶資料
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return {
      eligible: false,
      reason: "找不到用戶",
    };
  }

  const userData = userDoc.data();

  // 2. 檢查是否已購買過首購禮包
  const purchaseRef = db.collection("users").doc(userId).collection("special_purchases").doc("first_purchase");
  const purchaseDoc = await purchaseRef.get();

  if (purchaseDoc.exists) {
    return {
      eligible: false,
      reason: "您已購買過首購禮包",
      purchasedAt: purchaseDoc.data().purchasedAt,
    };
  }

  // 3. 檢查是否有任何付費購買記錄
  const transactionsRef = db.collection("user_transactions").doc(userId).collection("transactions");
  const purchaseTransactions = await transactionsRef
    .where("type", "==", TRANSACTION_TYPES.PURCHASE)
    .limit(1)
    .get();

  if (!purchaseTransactions.empty) {
    return {
      eligible: false,
      reason: "首購優惠僅限從未購買過的用戶",
    };
  }

  // 4. 檢查註冊時間（7天內有效）
  const createdAt = userData.createdAt?.toDate?.() || new Date(userData.createdAt);
  const now = new Date();
  const daysSinceRegistration = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

  if (daysSinceRegistration > FIRST_PURCHASE_OFFER.validDays) {
    return {
      eligible: false,
      reason: `首購優惠已過期（註冊後 ${FIRST_PURCHASE_OFFER.validDays} 天內有效）`,
      expiredAt: new Date(createdAt.getTime() + FIRST_PURCHASE_OFFER.validDays * 24 * 60 * 60 * 1000),
    };
  }

  // 5. 計算剩餘有效時間
  const expiresAt = new Date(createdAt.getTime() + FIRST_PURCHASE_OFFER.validDays * 24 * 60 * 60 * 1000);
  const hoursRemaining = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60 * 60)));

  return {
    eligible: true,
    offer: FIRST_PURCHASE_OFFER,
    expiresAt,
    hoursRemaining,
    daysRemaining: Math.ceil(hoursRemaining / 24),
  };
};

/**
 * 獲取首購禮包（如果有資格）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 首購禮包信息
 */
export const getFirstPurchaseOffer = async (userId) => {
  const eligibility = await checkFirstPurchaseEligibility(userId);

  if (!eligibility.eligible) {
    return {
      success: true,
      available: false,
      reason: eligibility.reason,
    };
  }

  return {
    success: true,
    available: true,
    offer: {
      ...eligibility.offer,
      expiresAt: eligibility.expiresAt,
      hoursRemaining: eligibility.hoursRemaining,
      daysRemaining: eligibility.daysRemaining,
    },
  };
};

/**
 * 購買首購禮包
 * @param {string} userId - 用戶 ID
 * @param {Object} paymentInfo - 支付信息
 * @returns {Promise<Object>} 購買結果
 */
export const purchaseFirstPurchaseOffer = async (userId, paymentInfo = {}) => {
  // 1. 檢查資格
  const eligibility = await checkFirstPurchaseEligibility(userId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason);
  }

  const offer = FIRST_PURCHASE_OFFER;
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);
  const purchaseRef = db.collection("users").doc(userId).collection("special_purchases").doc("first_purchase");

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料和購買記錄
    const [userDoc, purchaseDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(purchaseRef),
    ]);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    // 2. 再次檢查是否已購買（Transaction 內確保原子性）
    if (purchaseDoc.exists) {
      throw new Error("您已購買過首購禮包");
    }

    const userData = userDoc.data();
    const currentBalance = getWalletBalance(userData);
    const currentAssets = userData.assets || {};

    // 3. 計算新的金幣餘額和資產
    const contents = offer.contents;
    const coinsToAdd = contents.coins || 0;
    const newBalance = currentBalance + coinsToAdd;

    // 計算新的資產數量
    const newAssets = { ...currentAssets };

    if (contents.photoUnlockCards) {
      newAssets.photoUnlockCards = (newAssets.photoUnlockCards || 0) + contents.photoUnlockCards;
    }
    if (contents.videoUnlockCards) {
      newAssets.videoUnlockCards = (newAssets.videoUnlockCards || 0) + contents.videoUnlockCards;
    }
    if (contents.characterUnlockCards) {
      newAssets.characterUnlockCards = (newAssets.characterUnlockCards || 0) + contents.characterUnlockCards;
    }
    if (contents.characterCreationCards) {
      newAssets.characterCreationCards = (newAssets.characterCreationCards || 0) + contents.characterCreationCards;
    }
    if (contents.voiceUnlockCards) {
      newAssets.voiceUnlockCards = (newAssets.voiceUnlockCards || 0) + contents.voiceUnlockCards;
    }

    // 4. 更新用戶資料
    const updateData = {
      ...createWalletUpdate(newBalance),
      assets: newAssets,
      unlockTickets: newAssets,
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.update(userRef, updateData);

    // 5. 記錄首購購買
    const purchaseData = {
      offerId: offer.id,
      offerName: offer.name,
      price: offer.price,
      originalPrice: offer.originalPrice,
      contents: offer.contents,
      purchasedAt: FieldValue.serverTimestamp(),
      paymentInfo,
    };
    transaction.set(purchaseRef, purchaseData);

    // 6. 創建交易記錄
    createTransactionInTx(transaction, {
      userId,
      type: TRANSACTION_TYPES.PURCHASE,
      amount: offer.price,
      description: `購買 ${offer.name}`,
      metadata: {
        offerId: offer.id,
        offerName: offer.name,
        contents: offer.contents,
        originalPrice: offer.originalPrice,
        discount: offer.discount,
        currency: offer.currency,
        isFirstPurchase: true,
        payment: paymentInfo,
      },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    // 7. 設置返回結果
    result = {
      success: true,
      offerId: offer.id,
      offerName: offer.name,
      pricePaid: offer.price,
      originalPrice: offer.originalPrice,
      discount: offer.discount,
      currency: offer.currency,
      received: {
        coins: coinsToAdd,
        photoUnlockCards: contents.photoUnlockCards || 0,
        videoUnlockCards: contents.videoUnlockCards || 0,
        characterUnlockCards: contents.characterUnlockCards || 0,
        characterCreationCards: contents.characterCreationCards || 0,
        voiceUnlockCards: contents.voiceUnlockCards || 0,
      },
      newBalance,
      newAssets,
    };

    logger.info(
      `[首購優惠] 用戶 ${userId} 購買首購禮包: ${offer.name}, ` +
      `金幣 ${currentBalance} → ${newBalance}`
    );
  });

  return result;
};

export default {
  checkFirstPurchaseEligibility,
  getFirstPurchaseOffer,
  purchaseFirstPurchaseOffer,
};
