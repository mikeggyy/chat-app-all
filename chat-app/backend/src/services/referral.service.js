/**
 * 邀請獎勵服務
 *
 * P2 優化：實現用戶邀請獎勵系統
 * - 生成唯一邀請碼
 * - 追蹤邀請關係
 * - 發放雙方獎勵
 * - 邀請統計和排行榜
 *
 * @module referral.service
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import { createTransactionInTx, TRANSACTION_TYPES } from "../payment/transaction.service.js";
import logger from "../utils/logger.js";

// ============================================
// 邀請獎勵配置
// ============================================

export const REFERRAL_CONFIG = {
  // 邀請碼長度
  CODE_LENGTH: 8,

  // 邀請碼有效期（天，0 表示永久有效）
  CODE_EXPIRY_DAYS: 0,

  // 邀請人獎勵（每成功邀請一人）
  REFERRER_REWARDS: {
    coins: 50,              // 金幣獎勵
    photoCards: 0,          // 拍照卡
    unlockCards: 0,         // 解鎖卡
  },

  // 被邀請人獎勵（新用戶註冊）
  REFEREE_REWARDS: {
    coins: 30,              // 金幣獎勵
    photoCards: 1,          // 拍照卡
    unlockCards: 0,         // 解鎖卡
  },

  // 邀請人額外獎勵（被邀請人首次付費）
  FIRST_PURCHASE_BONUS: {
    enabled: true,
    coins: 100,             // 額外金幣獎勵
  },

  // 邀請等級獎勵（累計邀請達到里程碑）
  MILESTONE_REWARDS: {
    5: { coins: 100, badge: "邀請達人" },
    10: { coins: 200, badge: "社交達人" },
    25: { coins: 500, badge: "人氣王", photoCards: 5 },
    50: { coins: 1000, badge: "超級推薦官", photoCards: 10, unlockCards: 1 },
    100: { coins: 2000, badge: "傳奇推薦官", photoCards: 20, unlockCards: 3 },
  },

  // 每日邀請上限
  DAILY_INVITE_LIMIT: 10,

  // 防作弊：最少活躍天數才算有效邀請
  MIN_ACTIVE_DAYS: 1,
};

// ============================================
// 邀請碼管理
// ============================================

/**
 * 生成隨機邀請碼
 * @returns {string} 邀請碼
 */
const generateReferralCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除容易混淆的字符
  let code = "";
  for (let i = 0; i < REFERRAL_CONFIG.CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * 獲取或創建用戶的邀請碼
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 邀請碼信息
 */
export const getOrCreateReferralCode = async (userId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error("用戶不存在");
  }

  const userData = userDoc.data();

  // 如果已有邀請碼，直接返回
  if (userData.referralCode) {
    return {
      code: userData.referralCode,
      createdAt: userData.referralCodeCreatedAt,
      totalReferrals: userData.totalReferrals || 0,
      totalRewardsEarned: userData.totalReferralRewardsEarned || 0,
    };
  }

  // 生成新的邀請碼（確保唯一）
  let code = generateReferralCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // 檢查是否已存在
    const existingUser = await db.collection("users")
      .where("referralCode", "==", code)
      .limit(1)
      .get();

    if (existingUser.empty) {
      break;
    }

    code = generateReferralCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error("無法生成唯一邀請碼，請稍後再試");
  }

  // 保存邀請碼
  await userRef.update({
    referralCode: code,
    referralCodeCreatedAt: FieldValue.serverTimestamp(),
    totalReferrals: 0,
    totalReferralRewardsEarned: 0,
  });

  logger.info(`[邀請獎勵] 為用戶 ${userId} 生成邀請碼: ${code}`);

  return {
    code,
    createdAt: new Date().toISOString(),
    totalReferrals: 0,
    totalRewardsEarned: 0,
  };
};

/**
 * 根據邀請碼查找邀請人
 *
 * @param {string} code - 邀請碼
 * @returns {Promise<Object|null>} 邀請人信息
 */
export const findReferrerByCode = async (code) => {
  if (!code || code.length !== REFERRAL_CONFIG.CODE_LENGTH) {
    return null;
  }

  const db = getFirestoreDb();

  const usersSnapshot = await db.collection("users")
    .where("referralCode", "==", code.toUpperCase())
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return null;
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();

  return {
    userId: userDoc.id,
    displayName: userData.displayName || userData.name,
    referralCode: userData.referralCode,
    totalReferrals: userData.totalReferrals || 0,
  };
};

// ============================================
// 邀請處理
// ============================================

/**
 * 處理新用戶通過邀請註冊
 *
 * @param {string} newUserId - 新用戶 ID
 * @param {string} referralCode - 邀請碼
 * @returns {Promise<Object>} 處理結果
 */
export const processReferralSignup = async (newUserId, referralCode) => {
  if (!referralCode) {
    return { success: false, reason: "NO_CODE" };
  }

  const db = getFirestoreDb();

  // 查找邀請人
  const referrer = await findReferrerByCode(referralCode);
  if (!referrer) {
    return { success: false, reason: "INVALID_CODE" };
  }

  // 不能自己邀請自己
  if (referrer.userId === newUserId) {
    return { success: false, reason: "SELF_REFERRAL" };
  }

  // 檢查新用戶是否已被邀請過
  const newUserRef = db.collection("users").doc(newUserId);
  const newUserDoc = await newUserRef.get();

  if (!newUserDoc.exists) {
    return { success: false, reason: "NEW_USER_NOT_FOUND" };
  }

  const newUserData = newUserDoc.data();
  if (newUserData.referredBy) {
    return { success: false, reason: "ALREADY_REFERRED" };
  }

  // 檢查邀請人今日邀請次數
  const today = new Date().toISOString().split("T")[0];
  const referrerRef = db.collection("users").doc(referrer.userId);
  const referrerDoc = await referrerRef.get();
  const referrerData = referrerDoc.data();

  const dailyReferrals = referrerData.dailyReferrals || {};
  if ((dailyReferrals[today] || 0) >= REFERRAL_CONFIG.DAILY_INVITE_LIMIT) {
    return { success: false, reason: "DAILY_LIMIT_REACHED" };
  }

  // 使用 Transaction 處理獎勵發放
  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 記錄邀請關係
    const referralRef = db.collection("referrals").doc();
    transaction.set(referralRef, {
      referrerId: referrer.userId,
      referredUserId: newUserId,
      referralCode: referralCode,
      status: "pending", // pending -> active -> rewarded
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. 更新新用戶的被邀請信息
    transaction.update(newUserRef, {
      referredBy: referrer.userId,
      referralCode: referralCode,
      referredAt: FieldValue.serverTimestamp(),
    });

    // 3. 更新邀請人的統計
    const newDailyCount = (dailyReferrals[today] || 0) + 1;
    transaction.update(referrerRef, {
      [`dailyReferrals.${today}`]: newDailyCount,
      totalReferrals: FieldValue.increment(1),
    });

    // 4. 發放被邀請人獎勵（立即）
    const refereeRewards = REFERRAL_CONFIG.REFEREE_REWARDS;
    const newUserBalance = getWalletBalance(newUserData);
    const newBalance = newUserBalance + refereeRewards.coins;

    const newUserUpdate = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (refereeRewards.coins > 0) {
      Object.assign(newUserUpdate, createWalletUpdate(newBalance));
    }

    const currentAssets = newUserData.assets || {};
    if (refereeRewards.photoCards > 0 || refereeRewards.unlockCards > 0) {
      newUserUpdate.assets = {
        ...currentAssets,
        photoUnlockCards: (currentAssets.photoUnlockCards || 0) + (refereeRewards.photoCards || 0),
        characterUnlockCards: (currentAssets.characterUnlockCards || 0) + (refereeRewards.unlockCards || 0),
      };
    }

    transaction.update(newUserRef, newUserUpdate);

    // 5. 創建被邀請人獎勵交易記錄
    if (refereeRewards.coins > 0) {
      createTransactionInTx(transaction, {
        userId: newUserId,
        type: "referral_bonus",
        amount: refereeRewards.coins,
        description: "邀請註冊獎勵",
        metadata: {
          referrerId: referrer.userId,
          referralCode,
          rewardType: "referee",
        },
        balanceBefore: newUserBalance,
        balanceAfter: newBalance,
      });
    }

    result = {
      success: true,
      referrerId: referrer.userId,
      referrerName: referrer.displayName,
      refereeRewards,
    };
  });

  logger.info(`[邀請獎勵] 用戶 ${newUserId} 通過邀請碼 ${referralCode} 註冊成功`);

  return result;
};

/**
 * 激活邀請（被邀請人達到活躍標準後）
 *
 * @param {string} referredUserId - 被邀請用戶 ID
 * @returns {Promise<Object>} 激活結果
 */
export const activateReferral = async (referredUserId) => {
  const db = getFirestoreDb();

  // 查找邀請記錄
  const referralSnapshot = await db.collection("referrals")
    .where("referredUserId", "==", referredUserId)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (referralSnapshot.empty) {
    return { success: false, reason: "NO_PENDING_REFERRAL" };
  }

  const referralDoc = referralSnapshot.docs[0];
  const referralData = referralDoc.data();

  // 發放邀請人獎勵
  const referrerRewards = REFERRAL_CONFIG.REFERRER_REWARDS;

  await db.runTransaction(async (transaction) => {
    const referrerRef = db.collection("users").doc(referralData.referrerId);
    const referrerDoc = await transaction.get(referrerRef);

    if (!referrerDoc.exists) {
      throw new Error("邀請人不存在");
    }

    const referrerData = referrerDoc.data();
    const currentBalance = getWalletBalance(referrerData);
    const newBalance = currentBalance + referrerRewards.coins;

    const referrerUpdate = {
      totalReferralRewardsEarned: FieldValue.increment(referrerRewards.coins),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (referrerRewards.coins > 0) {
      Object.assign(referrerUpdate, createWalletUpdate(newBalance));
    }

    const currentAssets = referrerData.assets || {};
    if (referrerRewards.photoCards > 0 || referrerRewards.unlockCards > 0) {
      referrerUpdate.assets = {
        ...currentAssets,
        photoUnlockCards: (currentAssets.photoUnlockCards || 0) + (referrerRewards.photoCards || 0),
        characterUnlockCards: (currentAssets.characterUnlockCards || 0) + (referrerRewards.unlockCards || 0),
      };
    }

    transaction.update(referrerRef, referrerUpdate);

    // 更新邀請記錄狀態
    transaction.update(referralDoc.ref, {
      status: "active",
      activatedAt: FieldValue.serverTimestamp(),
      referrerRewardsGranted: referrerRewards,
    });

    // 創建交易記錄
    if (referrerRewards.coins > 0) {
      createTransactionInTx(transaction, {
        userId: referralData.referrerId,
        type: "referral_bonus",
        amount: referrerRewards.coins,
        description: "邀請好友獎勵",
        metadata: {
          referredUserId,
          rewardType: "referrer",
        },
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
      });
    }

    // 檢查里程碑獎勵
    const newTotalReferrals = (referrerData.totalReferrals || 0) + 1;
    await checkAndGrantMilestoneReward(transaction, referralData.referrerId, newTotalReferrals, referrerData);
  });

  logger.info(`[邀請獎勵] 邀請激活：邀請人 ${referralData.referrerId}，被邀請人 ${referredUserId}`);

  return {
    success: true,
    referrerId: referralData.referrerId,
    rewards: referrerRewards,
  };
};

/**
 * 處理被邀請人首次付費（發放額外獎勵）
 *
 * @param {string} userId - 付費用戶 ID
 * @returns {Promise<Object>} 處理結果
 */
export const processReferralFirstPurchase = async (userId) => {
  if (!REFERRAL_CONFIG.FIRST_PURCHASE_BONUS.enabled) {
    return { success: false, reason: "BONUS_DISABLED" };
  }

  const db = getFirestoreDb();

  // 查找邀請記錄
  const referralSnapshot = await db.collection("referrals")
    .where("referredUserId", "==", userId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (referralSnapshot.empty) {
    return { success: false, reason: "NO_ACTIVE_REFERRAL" };
  }

  const referralDoc = referralSnapshot.docs[0];
  const referralData = referralDoc.data();

  // 檢查是否已發放過首購獎勵
  if (referralData.firstPurchaseBonusGranted) {
    return { success: false, reason: "BONUS_ALREADY_GRANTED" };
  }

  const bonus = REFERRAL_CONFIG.FIRST_PURCHASE_BONUS;

  await db.runTransaction(async (transaction) => {
    const referrerRef = db.collection("users").doc(referralData.referrerId);
    const referrerDoc = await transaction.get(referrerRef);

    if (!referrerDoc.exists) {
      throw new Error("邀請人不存在");
    }

    const referrerData = referrerDoc.data();
    const currentBalance = getWalletBalance(referrerData);
    const newBalance = currentBalance + bonus.coins;

    transaction.update(referrerRef, {
      ...createWalletUpdate(newBalance),
      totalReferralRewardsEarned: FieldValue.increment(bonus.coins),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.update(referralDoc.ref, {
      status: "rewarded",
      firstPurchaseBonusGranted: true,
      firstPurchaseBonusAt: FieldValue.serverTimestamp(),
    });

    createTransactionInTx(transaction, {
      userId: referralData.referrerId,
      type: "referral_bonus",
      amount: bonus.coins,
      description: "邀請好友首購獎勵",
      metadata: {
        referredUserId: userId,
        rewardType: "first_purchase_bonus",
      },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });
  });

  logger.info(`[邀請獎勵] 發放首購獎勵：邀請人 ${referralData.referrerId}，被邀請人 ${userId}`);

  return {
    success: true,
    referrerId: referralData.referrerId,
    bonusCoins: bonus.coins,
  };
};

/**
 * 檢查並發放里程碑獎勵
 * @private
 */
const checkAndGrantMilestoneReward = async (transaction, userId, totalReferrals, userData) => {
  const milestone = REFERRAL_CONFIG.MILESTONE_REWARDS[totalReferrals];
  if (!milestone) return;

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  const currentBalance = getWalletBalance(userData);
  const newBalance = currentBalance + (milestone.coins || 0);

  const update = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (milestone.coins > 0) {
    Object.assign(update, createWalletUpdate(newBalance));
    update.totalReferralRewardsEarned = FieldValue.increment(milestone.coins);
  }

  if (milestone.badge) {
    const currentBadges = userData.badges || [];
    if (!currentBadges.includes(milestone.badge)) {
      update.badges = FieldValue.arrayUnion(milestone.badge);
    }
  }

  const currentAssets = userData.assets || {};
  if (milestone.photoCards || milestone.unlockCards) {
    update.assets = {
      ...currentAssets,
      photoUnlockCards: (currentAssets.photoUnlockCards || 0) + (milestone.photoCards || 0),
      characterUnlockCards: (currentAssets.characterUnlockCards || 0) + (milestone.unlockCards || 0),
    };
  }

  transaction.update(userRef, update);

  // 記錄里程碑達成
  const milestoneRef = db.collection("referral_milestones").doc();
  transaction.set(milestoneRef, {
    userId,
    milestone: totalReferrals,
    rewards: milestone,
    achievedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`[邀請獎勵] 用戶 ${userId} 達成邀請里程碑: ${totalReferrals} 人`);
};

// ============================================
// 查詢和統計
// ============================================

/**
 * 獲取用戶的邀請列表
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} 邀請列表
 */
export const getUserReferrals = async (userId, options = {}) => {
  const db = getFirestoreDb();
  const { limit = 50, status } = options;

  let query = db.collection("referrals")
    .where("referrerId", "==", userId)
    .orderBy("createdAt", "desc");

  if (status) {
    query = query.where("status", "==", status);
  }

  query = query.limit(limit);

  const snapshot = await query.get();

  const referrals = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();

    // 獲取被邀請人基本信息
    const referredUserDoc = await db.collection("users").doc(data.referredUserId).get();
    const referredUserData = referredUserDoc.exists ? referredUserDoc.data() : {};

    referrals.push({
      id: doc.id,
      referredUserId: data.referredUserId,
      referredUserName: referredUserData.displayName || referredUserData.name || "未知用戶",
      status: data.status,
      createdAt: data.createdAt?.toDate?.()?.toISOString(),
      activatedAt: data.activatedAt?.toDate?.()?.toISOString(),
      firstPurchaseBonusGranted: data.firstPurchaseBonusGranted || false,
    });
  }

  return {
    referrals,
    total: referrals.length,
  };
};

/**
 * 獲取用戶的邀請統計
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 邀請統計
 */
export const getUserReferralStats = async (userId) => {
  const db = getFirestoreDb();

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error("用戶不存在");
  }

  const userData = userDoc.data();

  // 統計各狀態的邀請數
  const statsSnapshot = await db.collection("referrals")
    .where("referrerId", "==", userId)
    .get();

  let pending = 0;
  let active = 0;
  let rewarded = 0;

  statsSnapshot.docs.forEach(doc => {
    const status = doc.data().status;
    if (status === "pending") pending++;
    else if (status === "active") active++;
    else if (status === "rewarded") rewarded++;
  });

  // 計算下一個里程碑
  const totalReferrals = userData.totalReferrals || 0;
  const milestones = Object.keys(REFERRAL_CONFIG.MILESTONE_REWARDS)
    .map(Number)
    .sort((a, b) => a - b);
  const nextMilestone = milestones.find(m => m > totalReferrals) || null;

  return {
    referralCode: userData.referralCode,
    totalReferrals,
    totalRewardsEarned: userData.totalReferralRewardsEarned || 0,
    byStatus: { pending, active, rewarded },
    badges: userData.badges || [],
    nextMilestone,
    progressToNextMilestone: nextMilestone ? totalReferrals / nextMilestone : 1,
  };
};

/**
 * 獲取邀請排行榜
 *
 * @param {Object} options - 選項
 * @returns {Promise<Array>} 排行榜
 */
export const getReferralLeaderboard = async (options = {}) => {
  const db = getFirestoreDb();
  const { limit = 20, period = "all" } = options;

  let query = db.collection("users")
    .where("totalReferrals", ">", 0)
    .orderBy("totalReferrals", "desc")
    .limit(limit);

  const snapshot = await query.get();

  return snapshot.docs.map((doc, index) => {
    const data = doc.data();
    return {
      rank: index + 1,
      userId: doc.id,
      displayName: data.displayName || data.name || "匿名用戶",
      totalReferrals: data.totalReferrals || 0,
      totalRewardsEarned: data.totalReferralRewardsEarned || 0,
      badges: data.badges || [],
    };
  });
};

export default {
  REFERRAL_CONFIG,
  getOrCreateReferralCode,
  findReferrerByCode,
  processReferralSignup,
  activateReferral,
  processReferralFirstPurchase,
  getUserReferrals,
  getUserReferralStats,
  getReferralLeaderboard,
};
