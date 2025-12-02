/**
 * 特殊優惠服務
 * 處理首購優惠、回歸用戶優惠等特殊促銷活動
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import {
  getFirstPurchaseOfferConfig,
  getReturningUserOfferConfig,
  DEFAULT_RETURNING_USER_OFFER,
  REWARD_TYPES,
} from "../config/rewards.js";
import logger from "../utils/logger.js";

/**
 * 獲取台灣時區當前時間
 * @returns {Date}
 */
const getTaiwanTime = () => {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
};

/**
 * 檢查用戶是否為首購用戶（從未購買過付費商品）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<boolean>}
 */
export const isFirstPurchaseUser = async (userId) => {
  const db = getFirestoreDb();

  // 檢查用戶的交易記錄
  const transactionsRef = db.collection("users").doc(userId).collection("transactions");
  const paidTransactions = await transactionsRef
    .where("type", "in", ["coin_purchase", "membership_purchase", "special_offer"])
    .where("status", "==", "completed")
    .limit(1)
    .get();

  return paidTransactions.empty;
};

/**
 * 檢查首購優惠是否在有效期內
 * @param {Object} userData - 用戶數據
 * @param {Object} offerConfig - 首購優惠配置
 * @returns {boolean}
 */
const isFirstPurchaseOfferValid = (userData, offerConfig) => {
  if (!offerConfig.enabled) return false;

  const createdAt = userData.createdAt;
  if (!createdAt) return true; // 如果沒有創建時間，假設有效

  const createdDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const validUntil = new Date(createdDate.getTime() + offerConfig.validDays * 24 * 60 * 60 * 1000);
  const now = getTaiwanTime();

  return now < validUntil;
};

/**
 * 獲取用戶的首購優惠狀態
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>}
 */
export const getFirstPurchaseOfferStatus = async (userId) => {
  const db = getFirestoreDb();

  const [userDoc, isFirstPurchase, offerConfig] = await Promise.all([
    db.collection("users").doc(userId).get(),
    isFirstPurchaseUser(userId),
    getFirstPurchaseOfferConfig(),
  ]);

  if (!userDoc.exists) {
    return { eligible: false, reason: "user_not_found" };
  }

  const userData = userDoc.data();

  // 檢查是否已購買過
  if (!isFirstPurchase) {
    return { eligible: false, reason: "already_purchased" };
  }

  // 檢查優惠是否啟用
  if (!offerConfig.enabled) {
    return { eligible: false, reason: "offer_disabled" };
  }

  // 檢查是否在有效期內
  const isValid = isFirstPurchaseOfferValid(userData, offerConfig);
  if (!isValid) {
    return { eligible: false, reason: "offer_expired" };
  }

  // 計算剩餘時間
  const createdAt = userData.createdAt;
  const createdDate = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt || Date.now());
  const validUntil = new Date(createdDate.getTime() + offerConfig.validDays * 24 * 60 * 60 * 1000);
  const now = getTaiwanTime();
  const remainingMs = validUntil.getTime() - now.getTime();
  const remainingHours = Math.max(0, Math.floor(remainingMs / (60 * 60 * 1000)));
  const remainingDays = Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000)));

  return {
    eligible: true,
    offer: {
      id: offerConfig.id,
      name: offerConfig.name,
      description: offerConfig.description,
      price: offerConfig.price,
      originalPrice: offerConfig.originalPrice,
      currency: offerConfig.currency,
      discount: offerConfig.discount,
      contents: offerConfig.contents,
      badge: offerConfig.badge,
    },
    validUntil: validUntil.toISOString(),
    remainingHours,
    remainingDays,
  };
};

/**
 * 檢查用戶是否為回歸用戶
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>}
 */
export const checkReturningUserStatus = async (userId) => {
  const db = getFirestoreDb();
  const [userDoc, returningUserConfig] = await Promise.all([
    db.collection("users").doc(userId).get(),
    getReturningUserOfferConfig(),
  ]);

  if (!userDoc.exists) {
    return { isReturning: false, reason: "user_not_found" };
  }

  const userData = userDoc.data();
  const lastLoginAt = userData.lastLoginAt;

  if (!lastLoginAt) {
    return { isReturning: false, reason: "no_login_record" };
  }

  const lastLoginDate = lastLoginAt.toDate ? lastLoginAt.toDate() : new Date(lastLoginAt);
  const now = getTaiwanTime();
  const daysSinceLastLogin = Math.floor((now.getTime() - lastLoginDate.getTime()) / (24 * 60 * 60 * 1000));

  return {
    isReturning: daysSinceLastLogin >= returningUserConfig.inactiveDays,
    daysSinceLastLogin,
    lastLoginAt: lastLoginDate.toISOString(),
  };
};

/**
 * 獲取用戶的回歸優惠狀態
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>}
 */
export const getReturningUserOfferStatus = async (userId) => {
  const db = getFirestoreDb();

  // 並行載入配置和用戶數據
  const [returningUserConfig, userDoc] = await Promise.all([
    getReturningUserOfferConfig(),
    db.collection("users").doc(userId).get(),
  ]);

  // 檢查用戶是否已購買過回歸禮包
  const specialOffersRef = db.collection("users").doc(userId).collection("special_offers");
  const returningOfferDoc = await specialOffersRef.doc("returning_user").get();

  if (returningOfferDoc.exists) {
    const offerData = returningOfferDoc.data();
    // 如果已經購買過，檢查是否還在展示期
    if (offerData.purchased) {
      return { eligible: false, reason: "already_purchased" };
    }
  }

  if (!userDoc.exists) {
    return { eligible: false, reason: "user_not_found" };
  }

  const userData = userDoc.data();

  // 檢查是否有回歸優惠記錄
  if (returningOfferDoc.exists) {
    const offerData = returningOfferDoc.data();
    const activatedAt = offerData.activatedAt?.toDate ? offerData.activatedAt.toDate() : new Date(offerData.activatedAt);
    const validUntil = new Date(activatedAt.getTime() + returningUserConfig.validHours * 60 * 60 * 1000);
    const now = getTaiwanTime();

    if (now > validUntil) {
      return { eligible: false, reason: "offer_expired" };
    }

    // 計算剩餘時間
    const remainingMs = validUntil.getTime() - now.getTime();
    const remainingHours = Math.max(0, Math.floor(remainingMs / (60 * 60 * 1000)));

    return {
      eligible: true,
      offer: {
        id: returningUserConfig.id,
        name: returningUserConfig.name,
        description: returningUserConfig.description,
        price: returningUserConfig.price,
        originalPrice: returningUserConfig.originalPrice,
        currency: returningUserConfig.currency,
        discount: returningUserConfig.discount,
        contents: returningUserConfig.contents,
        badge: returningUserConfig.badge,
      },
      validUntil: validUntil.toISOString(),
      remainingHours,
      activatedAt: activatedAt.toISOString(),
    };
  }

  // 檢查是否符合回歸用戶條件
  const lastLoginAt = userData.lastLoginAt;
  if (!lastLoginAt) {
    return { eligible: false, reason: "no_login_record" };
  }

  const lastLoginDate = lastLoginAt.toDate ? lastLoginAt.toDate() : new Date(lastLoginAt);
  const now = getTaiwanTime();
  const daysSinceLastLogin = Math.floor((now.getTime() - lastLoginDate.getTime()) / (24 * 60 * 60 * 1000));

  if (daysSinceLastLogin < returningUserConfig.inactiveDays) {
    return {
      eligible: false,
      reason: "not_inactive_enough",
      daysSinceLastLogin,
      requiredDays: returningUserConfig.inactiveDays,
    };
  }

  return { eligible: false, reason: "not_activated" };
};

/**
 * 激活回歸用戶優惠（用戶登入時調用）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>}
 */
export const activateReturningUserOffer = async (userId) => {
  const db = getFirestoreDb();

  // 並行載入配置和檢查狀態
  const [returningUserConfig, returningStatus] = await Promise.all([
    getReturningUserOfferConfig(),
    checkReturningUserStatus(userId),
  ]);

  if (!returningStatus.isReturning) {
    return { activated: false, reason: returningStatus.reason || "not_returning_user" };
  }

  // 檢查是否已有優惠記錄
  const specialOffersRef = db.collection("users").doc(userId).collection("special_offers");
  const returningOfferDoc = await specialOffersRef.doc("returning_user").get();

  if (returningOfferDoc.exists) {
    const offerData = returningOfferDoc.data();
    if (offerData.purchased) {
      return { activated: false, reason: "already_purchased" };
    }
    // 已激活，返回現有狀態
    return { activated: true, alreadyActive: true };
  }

  // 創建回歸優惠記錄
  const now = getTaiwanTime();
  const validUntil = new Date(now.getTime() + returningUserConfig.validHours * 60 * 60 * 1000);

  await specialOffersRef.doc("returning_user").set({
    activatedAt: FieldValue.serverTimestamp(),
    validUntil: validUntil,
    purchased: false,
    daysSinceLastLogin: returningStatus.daysSinceLastLogin,
  });

  logger.info(`[回歸優惠] 用戶 ${userId} 激活回歸優惠，已 ${returningStatus.daysSinceLastLogin} 天未登入`);

  return {
    activated: true,
    validUntil: validUntil.toISOString(),
    remainingHours: returningUserConfig.validHours,
  };
};

/**
 * 購買特殊優惠（首購/回歸）
 * @param {string} userId - 用戶 ID
 * @param {string} offerType - 優惠類型 ("first_purchase" | "returning_user")
 * @returns {Promise<Object>}
 */
export const purchaseSpecialOffer = async (userId, offerType) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let offerConfig;
  let offerStatus;

  // 驗證優惠資格
  if (offerType === "first_purchase") {
    [offerStatus, offerConfig] = await Promise.all([
      getFirstPurchaseOfferStatus(userId),
      getFirstPurchaseOfferConfig(),
    ]);
  } else if (offerType === "returning_user") {
    [offerStatus, offerConfig] = await Promise.all([
      getReturningUserOfferStatus(userId),
      getReturningUserOfferConfig(),
    ]);
  } else {
    throw new Error("無效的優惠類型");
  }

  if (!offerStatus.eligible) {
    throw new Error(`無法購買此優惠：${offerStatus.reason}`);
  }

  let result = null;

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const userData = userDoc.data();
    const currentBalance = getWalletBalance(userData);
    const currentAssets = userData.assets || {};

    // 發放獎勵內容
    const contents = offerConfig.contents;
    const newBalance = currentBalance + (contents.coins || 0);
    const newAssets = { ...currentAssets };

    if (contents.photoUnlockCards) {
      newAssets.photoUnlockCards = (newAssets.photoUnlockCards || 0) + contents.photoUnlockCards;
    }
    if (contents.characterUnlockCards) {
      newAssets.characterUnlockCards = (newAssets.characterUnlockCards || 0) + contents.characterUnlockCards;
    }
    if (contents.videoUnlockCards) {
      newAssets.videoUnlockCards = (newAssets.videoUnlockCards || 0) + contents.videoUnlockCards;
    }

    // 更新用戶資料
    const userUpdate = {
      ...createWalletUpdate(newBalance),
      assets: newAssets,
      unlockTickets: newAssets,
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.update(userRef, userUpdate);

    // 記錄交易
    const transactionRef = db.collection("users").doc(userId).collection("transactions").doc();
    transaction.set(transactionRef, {
      type: "special_offer",
      offerType,
      offerId: offerConfig.id,
      offerName: offerConfig.name,
      amount: offerConfig.price,
      currency: offerConfig.currency,
      contents,
      status: "completed",
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 標記優惠已使用
    if (offerType === "first_purchase") {
      const specialOffersRef = db.collection("users").doc(userId).collection("special_offers");
      transaction.set(specialOffersRef.doc("first_purchase"), {
        purchased: true,
        purchasedAt: FieldValue.serverTimestamp(),
        offerConfig: {
          price: offerConfig.price,
          contents,
        },
      });
    } else if (offerType === "returning_user") {
      const specialOffersRef = db.collection("users").doc(userId).collection("special_offers");
      transaction.update(specialOffersRef.doc("returning_user"), {
        purchased: true,
        purchasedAt: FieldValue.serverTimestamp(),
      });
    }

    result = {
      success: true,
      offerType,
      offerName: offerConfig.name,
      price: offerConfig.price,
      contents,
      newBalance,
      newAssets,
    };

    logger.info(
      `[特殊優惠] 用戶 ${userId} 購買 ${offerConfig.name}，` +
      `獲得 ${contents.coins || 0} 金幣` +
      (contents.photoUnlockCards ? `、${contents.photoUnlockCards} 照片卡` : "") +
      (contents.characterUnlockCards ? `、${contents.characterUnlockCards} 角色卡` : "")
    );
  });

  return result;
};

/**
 * 獲取用戶所有可用的特殊優惠
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>}
 */
export const getAllSpecialOffers = async (userId) => {
  const [firstPurchaseStatus, returningUserStatus] = await Promise.all([
    getFirstPurchaseOfferStatus(userId),
    getReturningUserOfferStatus(userId),
  ]);

  const offers = [];

  if (firstPurchaseStatus.eligible) {
    offers.push({
      type: "first_purchase",
      ...firstPurchaseStatus.offer,
      validUntil: firstPurchaseStatus.validUntil,
      remainingHours: firstPurchaseStatus.remainingHours,
      remainingDays: firstPurchaseStatus.remainingDays,
      priority: 1, // 首購優先顯示
    });
  }

  if (returningUserStatus.eligible) {
    offers.push({
      type: "returning_user",
      ...returningUserStatus.offer,
      validUntil: returningUserStatus.validUntil,
      remainingHours: returningUserStatus.remainingHours,
      priority: 2,
    });
  }

  // 按優先級排序
  offers.sort((a, b) => a.priority - b.priority);

  return {
    hasOffers: offers.length > 0,
    offers,
    firstPurchase: firstPurchaseStatus,
    returningUser: returningUserStatus,
  };
};

export default {
  isFirstPurchaseUser,
  getFirstPurchaseOfferStatus,
  checkReturningUserStatus,
  getReturningUserOfferStatus,
  activateReturningUserOffer,
  purchaseSpecialOffer,
  getAllSpecialOffers,
};
