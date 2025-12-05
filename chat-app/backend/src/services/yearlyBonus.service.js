/**
 * 年訂閱額外激勵服務
 *
 * P2 優化：鼓勵用戶選擇年訂閱，提供額外獎勵
 * - 年訂閱專屬禮包
 * - 每月額外獎勵發放
 * - 週年紀念獎勵
 * - VIP 專屬活動資格
 *
 * @module yearlyBonus.service
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import { createTransactionInTx } from "../payment/transaction.service.js";
import logger from "../utils/logger.js";

// ============================================
// 年訂閱獎勵配置
// ============================================

export const YEARLY_BONUS_CONFIG = {
  // 訂閱時立即獲得的一次性獎勵
  SIGNUP_BONUS: {
    lite: {
      coins: 100,
      photoCards: 3,
      unlockCards: 0,
      badge: "年度 Lite 會員",
    },
    vip: {
      coins: 300,
      photoCards: 10,
      unlockCards: 1,
      badge: "年度 VIP 會員",
    },
    vvip: {
      coins: 600,
      photoCards: 20,
      unlockCards: 3,
      badge: "年度 VVIP 會員",
      exclusiveAvatar: true,
    },
  },

  // 每月額外獎勵（年訂閱用戶專屬）
  MONTHLY_BONUS: {
    lite: {
      coins: 20,
      photoCards: 1,
    },
    vip: {
      coins: 50,
      photoCards: 2,
    },
    vvip: {
      coins: 100,
      photoCards: 5,
      unlockCards: 1,
    },
  },

  // 續訂獎勵（年訂閱續訂時）
  RENEWAL_BONUS: {
    lite: {
      coins: 150,
      photoCards: 5,
      discountPercent: 5, // 續訂折扣
    },
    vip: {
      coins: 400,
      photoCards: 15,
      unlockCards: 2,
      discountPercent: 8,
    },
    vvip: {
      coins: 800,
      photoCards: 30,
      unlockCards: 5,
      discountPercent: 10,
      exclusiveFrame: true,
    },
  },

  // 週年紀念獎勵
  ANNIVERSARY_BONUS: {
    1: { // 1 週年
      coins: 500,
      photoCards: 10,
      badge: "一週年紀念",
    },
    2: { // 2 週年
      coins: 800,
      photoCards: 20,
      unlockCards: 2,
      badge: "二週年紀念",
    },
    3: { // 3 週年
      coins: 1200,
      photoCards: 30,
      unlockCards: 5,
      badge: "三週年紀念",
      exclusiveTitle: "資深會員",
    },
  },

  // 專屬活動資格
  EXCLUSIVE_EVENTS: {
    vip: [
      "monthly_vip_lottery",      // 每月 VIP 抽獎
      "early_access_features",    // 新功能優先體驗
    ],
    vvip: [
      "monthly_vip_lottery",
      "early_access_features",
      "exclusive_character_vote", // 專屬角色投票
      "vvip_only_events",        // VVIP 專屬活動
      "priority_support",        // 優先客服支援
    ],
  },
};

// ============================================
// 獎勵發放
// ============================================

/**
 * 發放年訂閱註冊獎勵
 *
 * @param {string} userId - 用戶 ID
 * @param {string} tier - 訂閱等級 (lite, vip, vvip)
 * @returns {Promise<Object>} 發放結果
 */
export const grantSignupBonus = async (userId, tier) => {
  const bonusConfig = YEARLY_BONUS_CONFIG.SIGNUP_BONUS[tier];
  if (!bonusConfig) {
    throw new Error(`無效的訂閱等級: ${tier}`);
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("用戶不存在");
    }

    const userData = userDoc.data();
    const currentBalance = getWalletBalance(userData);
    const newBalance = currentBalance + (bonusConfig.coins || 0);

    const update = {
      yearlySubscription: true,
      yearlySubscriptionTier: tier,
      yearlySubscriptionStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 金幣獎勵
    if (bonusConfig.coins > 0) {
      Object.assign(update, createWalletUpdate(newBalance));
    }

    // 徽章
    if (bonusConfig.badge) {
      update.badges = FieldValue.arrayUnion(bonusConfig.badge);
    }

    // 資產獎勵
    const currentAssets = userData.assets || {};
    if (bonusConfig.photoCards > 0 || bonusConfig.unlockCards > 0) {
      update.assets = {
        ...currentAssets,
        photoUnlockCards: (currentAssets.photoUnlockCards || 0) + (bonusConfig.photoCards || 0),
        characterUnlockCards: (currentAssets.characterUnlockCards || 0) + (bonusConfig.unlockCards || 0),
      };
    }

    // 專屬頭像框
    if (bonusConfig.exclusiveAvatar) {
      update.exclusiveAvatarUnlocked = true;
    }

    transaction.update(userRef, update);

    // 創建交易記錄
    if (bonusConfig.coins > 0) {
      createTransactionInTx(transaction, {
        userId,
        type: "yearly_bonus",
        amount: bonusConfig.coins,
        description: `年訂閱註冊獎勵 (${tier.toUpperCase()})`,
        metadata: {
          tier,
          bonusType: "signup",
          photoCards: bonusConfig.photoCards,
          unlockCards: bonusConfig.unlockCards,
        },
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
      });
    }

    // 記錄獎勵發放
    const bonusRef = db.collection("yearly_bonuses").doc();
    transaction.set(bonusRef, {
      userId,
      tier,
      bonusType: "signup",
      rewards: bonusConfig,
      grantedAt: FieldValue.serverTimestamp(),
    });

    result = {
      success: true,
      tier,
      rewards: bonusConfig,
      newBalance,
    };
  });

  logger.info(`[年訂閱獎勵] 發放註冊獎勵: userId=${userId}, tier=${tier}`);

  return result;
};

/**
 * 發放每月額外獎勵
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 發放結果
 */
export const grantMonthlyBonus = async (userId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error("用戶不存在");
  }

  const userData = userDoc.data();

  // 檢查是否是年訂閱用戶
  if (!userData.yearlySubscription) {
    return { success: false, reason: "NOT_YEARLY_SUBSCRIBER" };
  }

  // 檢查會員是否有效
  if (userData.membershipStatus !== "active") {
    return { success: false, reason: "MEMBERSHIP_INACTIVE" };
  }

  const tier = userData.yearlySubscriptionTier || userData.membershipTier;
  const bonusConfig = YEARLY_BONUS_CONFIG.MONTHLY_BONUS[tier];

  if (!bonusConfig) {
    return { success: false, reason: "NO_BONUS_CONFIG" };
  }

  // 檢查本月是否已領取
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const existingBonus = await db.collection("yearly_bonuses")
    .where("userId", "==", userId)
    .where("bonusType", "==", "monthly")
    .where("month", "==", currentMonth)
    .limit(1)
    .get();

  if (!existingBonus.empty) {
    return { success: false, reason: "ALREADY_CLAIMED" };
  }

  let result = null;

  await db.runTransaction(async (transaction) => {
    const currentBalance = getWalletBalance(userData);
    const newBalance = currentBalance + (bonusConfig.coins || 0);

    const update = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (bonusConfig.coins > 0) {
      Object.assign(update, createWalletUpdate(newBalance));
    }

    const currentAssets = userData.assets || {};
    if (bonusConfig.photoCards > 0 || bonusConfig.unlockCards > 0) {
      update.assets = {
        ...currentAssets,
        photoUnlockCards: (currentAssets.photoUnlockCards || 0) + (bonusConfig.photoCards || 0),
        characterUnlockCards: (currentAssets.characterUnlockCards || 0) + (bonusConfig.unlockCards || 0),
      };
    }

    transaction.update(userRef, update);

    if (bonusConfig.coins > 0) {
      createTransactionInTx(transaction, {
        userId,
        type: "yearly_bonus",
        amount: bonusConfig.coins,
        description: `年訂閱每月獎勵 (${currentMonth})`,
        metadata: {
          tier,
          bonusType: "monthly",
          month: currentMonth,
        },
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
      });
    }

    const bonusRef = db.collection("yearly_bonuses").doc();
    transaction.set(bonusRef, {
      userId,
      tier,
      bonusType: "monthly",
      month: currentMonth,
      rewards: bonusConfig,
      grantedAt: FieldValue.serverTimestamp(),
    });

    result = {
      success: true,
      tier,
      month: currentMonth,
      rewards: bonusConfig,
      newBalance,
    };
  });

  logger.info(`[年訂閱獎勵] 發放每月獎勵: userId=${userId}, month=${currentMonth}`);

  return result;
};

/**
 * 發放續訂獎勵
 *
 * @param {string} userId - 用戶 ID
 * @param {string} tier - 訂閱等級
 * @returns {Promise<Object>} 發放結果
 */
export const grantRenewalBonus = async (userId, tier) => {
  const bonusConfig = YEARLY_BONUS_CONFIG.RENEWAL_BONUS[tier];
  if (!bonusConfig) {
    throw new Error(`無效的訂閱等級: ${tier}`);
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("用戶不存在");
    }

    const userData = userDoc.data();
    const currentBalance = getWalletBalance(userData);
    const newBalance = currentBalance + (bonusConfig.coins || 0);

    // 計算訂閱年數
    const startedAt = userData.yearlySubscriptionStartedAt?.toDate() || new Date();
    const yearsSubscribed = Math.floor(
      (new Date() - startedAt) / (365 * 24 * 60 * 60 * 1000)
    ) + 1;

    const update = {
      yearlyRenewalCount: FieldValue.increment(1),
      lastYearlyRenewalAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (bonusConfig.coins > 0) {
      Object.assign(update, createWalletUpdate(newBalance));
    }

    const currentAssets = userData.assets || {};
    if (bonusConfig.photoCards > 0 || bonusConfig.unlockCards > 0) {
      update.assets = {
        ...currentAssets,
        photoUnlockCards: (currentAssets.photoUnlockCards || 0) + (bonusConfig.photoCards || 0),
        characterUnlockCards: (currentAssets.characterUnlockCards || 0) + (bonusConfig.unlockCards || 0),
      };
    }

    if (bonusConfig.exclusiveFrame) {
      update.exclusiveFrameUnlocked = true;
    }

    transaction.update(userRef, update);

    if (bonusConfig.coins > 0) {
      createTransactionInTx(transaction, {
        userId,
        type: "yearly_bonus",
        amount: bonusConfig.coins,
        description: `年訂閱續訂獎勵 (第${yearsSubscribed}年)`,
        metadata: {
          tier,
          bonusType: "renewal",
          yearsSubscribed,
        },
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
      });
    }

    const bonusRef = db.collection("yearly_bonuses").doc();
    transaction.set(bonusRef, {
      userId,
      tier,
      bonusType: "renewal",
      yearsSubscribed,
      rewards: bonusConfig,
      grantedAt: FieldValue.serverTimestamp(),
    });

    result = {
      success: true,
      tier,
      yearsSubscribed,
      rewards: bonusConfig,
      discountPercent: bonusConfig.discountPercent,
      newBalance,
    };
  });

  logger.info(`[年訂閱獎勵] 發放續訂獎勵: userId=${userId}, tier=${tier}`);

  return result;
};

/**
 * 檢查並發放週年紀念獎勵
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 發放結果
 */
export const checkAndGrantAnniversaryBonus = async (userId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return { success: false, reason: "USER_NOT_FOUND" };
  }

  const userData = userDoc.data();

  if (!userData.yearlySubscription || !userData.yearlySubscriptionStartedAt) {
    return { success: false, reason: "NOT_YEARLY_SUBSCRIBER" };
  }

  const startedAt = userData.yearlySubscriptionStartedAt.toDate();
  const now = new Date();
  const yearsSubscribed = Math.floor(
    (now - startedAt) / (365 * 24 * 60 * 60 * 1000)
  );

  if (yearsSubscribed < 1) {
    return { success: false, reason: "NOT_ANNIVERSARY_YET" };
  }

  const bonusConfig = YEARLY_BONUS_CONFIG.ANNIVERSARY_BONUS[yearsSubscribed];
  if (!bonusConfig) {
    return { success: false, reason: "NO_BONUS_FOR_YEAR" };
  }

  // 檢查是否已領取該週年獎勵
  const existingBonus = await db.collection("yearly_bonuses")
    .where("userId", "==", userId)
    .where("bonusType", "==", "anniversary")
    .where("anniversaryYear", "==", yearsSubscribed)
    .limit(1)
    .get();

  if (!existingBonus.empty) {
    return { success: false, reason: "ALREADY_CLAIMED" };
  }

  let result = null;

  await db.runTransaction(async (transaction) => {
    const currentBalance = getWalletBalance(userData);
    const newBalance = currentBalance + (bonusConfig.coins || 0);

    const update = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (bonusConfig.coins > 0) {
      Object.assign(update, createWalletUpdate(newBalance));
    }

    if (bonusConfig.badge) {
      update.badges = FieldValue.arrayUnion(bonusConfig.badge);
    }

    if (bonusConfig.exclusiveTitle) {
      update.exclusiveTitle = bonusConfig.exclusiveTitle;
    }

    const currentAssets = userData.assets || {};
    if (bonusConfig.photoCards > 0 || bonusConfig.unlockCards > 0) {
      update.assets = {
        ...currentAssets,
        photoUnlockCards: (currentAssets.photoUnlockCards || 0) + (bonusConfig.photoCards || 0),
        characterUnlockCards: (currentAssets.characterUnlockCards || 0) + (bonusConfig.unlockCards || 0),
      };
    }

    transaction.update(userRef, update);

    if (bonusConfig.coins > 0) {
      createTransactionInTx(transaction, {
        userId,
        type: "yearly_bonus",
        amount: bonusConfig.coins,
        description: `${yearsSubscribed}週年紀念獎勵`,
        metadata: {
          bonusType: "anniversary",
          anniversaryYear: yearsSubscribed,
        },
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
      });
    }

    const bonusRef = db.collection("yearly_bonuses").doc();
    transaction.set(bonusRef, {
      userId,
      bonusType: "anniversary",
      anniversaryYear: yearsSubscribed,
      rewards: bonusConfig,
      grantedAt: FieldValue.serverTimestamp(),
    });

    result = {
      success: true,
      anniversaryYear: yearsSubscribed,
      rewards: bonusConfig,
      newBalance,
    };
  });

  logger.info(`[年訂閱獎勵] 發放${yearsSubscribed}週年獎勵: userId=${userId}`);

  return result;
};

// ============================================
// 查詢功能
// ============================================

/**
 * 獲取用戶的年訂閱狀態和可用獎勵
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 年訂閱狀態
 */
export const getYearlySubscriptionStatus = async (userId) => {
  const db = getFirestoreDb();

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error("用戶不存在");
  }

  const userData = userDoc.data();
  const isYearly = userData.yearlySubscription === true;
  const tier = userData.yearlySubscriptionTier || userData.membershipTier || "free";

  if (!isYearly) {
    // 返回年訂閱的優惠說明
    return {
      isYearlySubscriber: false,
      currentTier: tier,
      yearlyBenefits: getYearlyBenefitsPreview(tier),
      savings: calculateYearlySavings(tier),
    };
  }

  const startedAt = userData.yearlySubscriptionStartedAt?.toDate();
  const yearsSubscribed = startedAt
    ? Math.floor((new Date() - startedAt) / (365 * 24 * 60 * 60 * 1000))
    : 0;

  // 檢查每月獎勵是否可領取
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyBonusClaimed = await db.collection("yearly_bonuses")
    .where("userId", "==", userId)
    .where("bonusType", "==", "monthly")
    .where("month", "==", currentMonth)
    .limit(1)
    .get();

  // 檢查週年獎勵
  const nextAnniversary = yearsSubscribed + 1;
  const anniversaryBonusAvailable = YEARLY_BONUS_CONFIG.ANNIVERSARY_BONUS[yearsSubscribed] &&
    !(await db.collection("yearly_bonuses")
      .where("userId", "==", userId)
      .where("bonusType", "==", "anniversary")
      .where("anniversaryYear", "==", yearsSubscribed)
      .limit(1)
      .get()).empty === false;

  // 獲取已領取的獎勵歷史
  const bonusHistory = await db.collection("yearly_bonuses")
    .where("userId", "==", userId)
    .orderBy("grantedAt", "desc")
    .limit(10)
    .get();

  return {
    isYearlySubscriber: true,
    tier,
    startedAt: startedAt?.toISOString(),
    yearsSubscribed,
    renewalCount: userData.yearlyRenewalCount || 0,
    exclusiveEvents: YEARLY_BONUS_CONFIG.EXCLUSIVE_EVENTS[tier] || [],
    availableBonuses: {
      monthlyBonus: {
        available: monthlyBonusClaimed.empty,
        rewards: YEARLY_BONUS_CONFIG.MONTHLY_BONUS[tier],
      },
      anniversaryBonus: anniversaryBonusAvailable ? {
        available: true,
        year: yearsSubscribed,
        rewards: YEARLY_BONUS_CONFIG.ANNIVERSARY_BONUS[yearsSubscribed],
      } : null,
    },
    bonusHistory: bonusHistory.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.bonusType,
        rewards: data.rewards,
        grantedAt: data.grantedAt?.toDate?.()?.toISOString(),
      };
    }),
    badges: userData.badges || [],
  };
};

/**
 * 獲取年訂閱優惠預覽
 * @private
 */
const getYearlyBenefitsPreview = (tier) => {
  const signupBonus = YEARLY_BONUS_CONFIG.SIGNUP_BONUS[tier];
  const monthlyBonus = YEARLY_BONUS_CONFIG.MONTHLY_BONUS[tier];
  const renewalBonus = YEARLY_BONUS_CONFIG.RENEWAL_BONUS[tier];

  if (!signupBonus) return null;

  return {
    signup: signupBonus,
    monthly: monthlyBonus,
    renewal: renewalBonus,
    totalFirstYearValue: calculateFirstYearValue(tier),
    exclusiveEvents: YEARLY_BONUS_CONFIG.EXCLUSIVE_EVENTS[tier] || [],
  };
};

/**
 * 計算年訂閱節省金額
 * @private
 */
const calculateYearlySavings = (tier) => {
  const prices = {
    lite: { monthly: 99, yearly: 990 },
    vip: { monthly: 299, yearly: 2990 },
    vvip: { monthly: 599, yearly: 5990 },
  };

  const tierPrice = prices[tier];
  if (!tierPrice) return null;

  const monthlyTotal = tierPrice.monthly * 12;
  const savings = monthlyTotal - tierPrice.yearly;
  const savingsPercent = Math.round((savings / monthlyTotal) * 100);

  return {
    monthlyPrice: tierPrice.monthly,
    yearlyPrice: tierPrice.yearly,
    monthlyTotal,
    savings,
    savingsPercent,
  };
};

/**
 * 計算第一年總價值
 * @private
 */
const calculateFirstYearValue = (tier) => {
  const signupBonus = YEARLY_BONUS_CONFIG.SIGNUP_BONUS[tier];
  const monthlyBonus = YEARLY_BONUS_CONFIG.MONTHLY_BONUS[tier];

  if (!signupBonus || !monthlyBonus) return 0;

  // 假設金幣價值：1 金幣 = 1 元，照片卡 = 50 元，解鎖卡 = 100 元
  const signupValue = (signupBonus.coins || 0) +
    (signupBonus.photoCards || 0) * 50 +
    (signupBonus.unlockCards || 0) * 100;

  const monthlyValue = ((monthlyBonus.coins || 0) +
    (monthlyBonus.photoCards || 0) * 50 +
    (monthlyBonus.unlockCards || 0) * 100) * 12;

  return signupValue + monthlyValue;
};

/**
 * 批量處理每月獎勵發放（定時任務調用）
 *
 * @returns {Promise<Object>} 處理結果
 */
export const processMonthlyBonuses = async () => {
  const db = getFirestoreDb();
  const currentMonth = new Date().toISOString().slice(0, 7);

  // 查找所有年訂閱用戶
  const usersSnapshot = await db.collection("users")
    .where("yearlySubscription", "==", true)
    .where("membershipStatus", "==", "active")
    .get();

  let processed = 0;
  let granted = 0;
  let skipped = 0;
  const errors = [];

  for (const userDoc of usersSnapshot.docs) {
    try {
      const result = await grantMonthlyBonus(userDoc.id);
      processed++;

      if (result.success) {
        granted++;
      } else {
        skipped++;
      }
    } catch (error) {
      errors.push({ userId: userDoc.id, error: error.message });
      logger.error(`[年訂閱獎勵] 處理失敗: ${userDoc.id} - ${error.message}`);
    }
  }

  logger.info(`[年訂閱獎勵] 每月獎勵處理完成`, {
    month: currentMonth,
    processed,
    granted,
    skipped,
    errors: errors.length,
  });

  return { month: currentMonth, processed, granted, skipped, errors };
};

export default {
  YEARLY_BONUS_CONFIG,
  grantSignupBonus,
  grantMonthlyBonus,
  grantRenewalBonus,
  checkAndGrantAnniversaryBonus,
  getYearlySubscriptionStatus,
  processMonthlyBonuses,
};
