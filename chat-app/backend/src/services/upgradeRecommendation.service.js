/**
 * 智能升級推薦服務
 *
 * P2 優化：根據用戶行為分析，推薦最適合的會員升級方案
 * - 分析用戶使用習慣
 * - 計算限制達標頻率
 * - 預估升級後節省金額
 * - 個性化推薦理由
 *
 * @module upgradeRecommendation.service
 */

import { getFirestoreDb } from "../firebase/index.js";
import { getWalletBalance } from "../user/walletHelpers.js";
import logger from "../utils/logger.js";

// ============================================
// 推薦配置
// ============================================

export const RECOMMENDATION_CONFIG = {
  // 分析週期（天）
  ANALYSIS_PERIOD_DAYS: 30,

  // 觸發推薦的閾值
  THRESHOLDS: {
    // 每日對話達到限制的頻率（超過此百分比則推薦升級）
    conversationLimitHitRate: 0.3, // 30%
    // 每日語音達到限制的頻率
    voiceLimitHitRate: 0.2, // 20%
    // 每月照片達到限制的頻率
    photoLimitHitRate: 0.5, // 50%
    // 最低活躍天數
    minActiveDays: 7,
    // 最低對話數
    minConversations: 20,
  },

  // 會員方案配置（從 Firestore 讀取，這裡是預設值）
  MEMBERSHIP_TIERS: {
    free: {
      name: "免費會員",
      order: 0,
      price: 0,
      features: {
        dailyConversations: 20,
        dailyVoice: 5,
        monthlyPhotos: 3,
        unlockTickets: 0,
      },
    },
    lite: {
      name: "Lite 會員",
      order: 1,
      monthlyPrice: 99,
      yearlyPrice: 990,
      features: {
        dailyConversations: 50,
        dailyVoice: 20,
        monthlyPhotos: 15,
        unlockTickets: 1,
      },
    },
    vip: {
      name: "VIP 會員",
      order: 2,
      monthlyPrice: 299,
      yearlyPrice: 2990,
      features: {
        dailyConversations: 200,
        dailyVoice: 100,
        monthlyPhotos: 50,
        unlockTickets: 3,
      },
    },
    vvip: {
      name: "VVIP 會員",
      order: 3,
      monthlyPrice: 599,
      yearlyPrice: 5990,
      features: {
        dailyConversations: -1, // 無限
        dailyVoice: -1, // 無限
        monthlyPhotos: 200,
        unlockTickets: 10,
      },
    },
  },

  // 推薦優先級權重
  WEIGHTS: {
    conversationUsage: 0.4,
    voiceUsage: 0.25,
    photoUsage: 0.2,
    spendingPotential: 0.15,
  },
};

// ============================================
// 用戶行為分析
// ============================================

/**
 * 分析用戶使用行為
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 用戶行為分析結果
 */
export const analyzeUserBehavior = async (userId) => {
  const db = getFirestoreDb();
  const periodDays = RECOMMENDATION_CONFIG.ANALYSIS_PERIOD_DAYS;
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  // 獲取用戶資料
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error("用戶不存在");
  }

  const userData = userDoc.data();
  const currentTier = userData.membershipTier || "free";

  // 1. 分析對話使用量
  const conversationStats = await analyzeConversationUsage(db, userId, periodStart);

  // 2. 分析語音使用量
  const voiceStats = await analyzeVoiceUsage(db, userId, periodStart);

  // 3. 分析照片使用量
  const photoStats = await analyzePhotoUsage(db, userId, periodStart);

  // 4. 分析消費行為
  const spendingStats = await analyzeSpending(db, userId, periodStart);

  // 5. 計算活躍度
  const activeDays = calculateActiveDays(conversationStats, voiceStats, photoStats);

  return {
    userId,
    currentTier,
    membershipStatus: userData.membershipStatus,
    membershipExpiresAt: userData.membershipExpiresAt?.toDate?.()?.toISOString(),
    periodDays,
    periodStart: periodStart.toISOString(),
    conversation: conversationStats,
    voice: voiceStats,
    photo: photoStats,
    spending: spendingStats,
    activeDays,
    walletBalance: getWalletBalance(userData),
  };
};

/**
 * 分析對話使用量
 * @private
 */
const analyzeConversationUsage = async (db, userId, periodStart) => {
  // 從 conversation_limits 集合獲取每日使用記錄
  const limitsSnapshot = await db.collection("conversation_limits")
    .where("userId", "==", userId)
    .get();

  let totalUsage = 0;
  let daysAtLimit = 0;
  let maxDailyUsage = 0;
  let usageDays = 0;

  limitsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const dailyUsage = Object.values(data.dailyUsage || {}).reduce((sum, count) => sum + count, 0);

    if (dailyUsage > 0) {
      usageDays++;
      totalUsage += dailyUsage;
      maxDailyUsage = Math.max(maxDailyUsage, dailyUsage);

      // 檢查是否達到限制（假設免費用戶每日 20 次）
      if (dailyUsage >= 20) {
        daysAtLimit++;
      }
    }
  });

  return {
    totalUsage,
    averageDailyUsage: usageDays > 0 ? Math.round(totalUsage / usageDays) : 0,
    maxDailyUsage,
    daysAtLimit,
    usageDays,
    limitHitRate: usageDays > 0 ? daysAtLimit / usageDays : 0,
  };
};

/**
 * 分析語音使用量
 * @private
 */
const analyzeVoiceUsage = async (db, userId, periodStart) => {
  const limitsSnapshot = await db.collection("voice_limits")
    .where("userId", "==", userId)
    .get();

  let totalUsage = 0;
  let daysAtLimit = 0;
  let usageDays = 0;

  limitsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const dailyUsage = Object.values(data.dailyUsage || {}).reduce((sum, count) => sum + count, 0);

    if (dailyUsage > 0) {
      usageDays++;
      totalUsage += dailyUsage;

      if (dailyUsage >= 5) { // 免費用戶每日 5 次
        daysAtLimit++;
      }
    }
  });

  return {
    totalUsage,
    averageDailyUsage: usageDays > 0 ? Math.round(totalUsage / usageDays) : 0,
    daysAtLimit,
    usageDays,
    limitHitRate: usageDays > 0 ? daysAtLimit / usageDays : 0,
  };
};

/**
 * 分析照片使用量
 * @private
 */
const analyzePhotoUsage = async (db, userId, periodStart) => {
  const limitsSnapshot = await db.collection("photo_limits")
    .where("userId", "==", userId)
    .get();

  let totalUsage = 0;
  let monthsAtLimit = 0;
  let usageMonths = 0;

  limitsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const monthlyUsage = data.monthlyUsage || 0;

    if (monthlyUsage > 0) {
      usageMonths++;
      totalUsage += monthlyUsage;

      if (monthlyUsage >= 3) { // 免費用戶每月 3 次
        monthsAtLimit++;
      }
    }
  });

  return {
    totalUsage,
    averageMonthlyUsage: usageMonths > 0 ? Math.round(totalUsage / usageMonths) : 0,
    monthsAtLimit,
    usageMonths,
    limitHitRate: usageMonths > 0 ? monthsAtLimit / usageMonths : 0,
  };
};

/**
 * 分析消費行為
 * @private
 */
const analyzeSpending = async (db, userId, periodStart) => {
  const transactionsSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("createdAt", ">=", periodStart)
    .get();

  let totalSpent = 0;
  let coinPurchases = 0;
  let giftPurchases = 0;
  let assetPurchases = 0;

  transactionsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const amount = Math.abs(data.amount || 0);

    if (data.type === "purchase" || data.type === "coin_purchase") {
      totalSpent += amount;
      coinPurchases++;
    } else if (data.type === "gift") {
      giftPurchases++;
    } else if (data.type === "asset_purchase") {
      assetPurchases++;
    }
  });

  return {
    totalSpent,
    coinPurchases,
    giftPurchases,
    assetPurchases,
    averageSpentPerMonth: totalSpent / (RECOMMENDATION_CONFIG.ANALYSIS_PERIOD_DAYS / 30),
  };
};

/**
 * 計算活躍天數
 * @private
 */
const calculateActiveDays = (conversationStats, voiceStats, photoStats) => {
  return Math.max(
    conversationStats.usageDays,
    voiceStats.usageDays,
    photoStats.usageMonths * 5 // 假設每月使用照片的用戶平均活躍 5 天
  );
};

// ============================================
// 升級推薦生成
// ============================================

/**
 * 生成智能升級推薦
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 升級推薦
 */
export const generateUpgradeRecommendation = async (userId) => {
  const behavior = await analyzeUserBehavior(userId);
  const currentTier = behavior.currentTier;
  const tiers = RECOMMENDATION_CONFIG.MEMBERSHIP_TIERS;

  // 如果已經是最高級別，不推薦升級
  if (currentTier === "vvip") {
    return {
      hasRecommendation: false,
      currentTier: "vvip",
      reason: "您已經是最高級別會員",
      behavior,
    };
  }

  // 檢查是否達到推薦閾值
  const thresholds = RECOMMENDATION_CONFIG.THRESHOLDS;
  const shouldRecommend =
    behavior.activeDays >= thresholds.minActiveDays &&
    (behavior.conversation.limitHitRate >= thresholds.conversationLimitHitRate ||
      behavior.voice.limitHitRate >= thresholds.voiceLimitHitRate ||
      behavior.photo.limitHitRate >= thresholds.photoLimitHitRate);

  if (!shouldRecommend) {
    return {
      hasRecommendation: false,
      currentTier,
      reason: "目前的會員方案足以滿足您的使用需求",
      behavior,
      tips: generateUsageTips(behavior),
    };
  }

  // 計算每個高級方案的匹配分數
  const currentTierOrder = tiers[currentTier]?.order || 0;
  const candidates = [];

  for (const [tierKey, tierConfig] of Object.entries(tiers)) {
    if (tierConfig.order <= currentTierOrder) continue;

    const score = calculateTierMatchScore(behavior, tierConfig);
    const savings = calculatePotentialSavings(behavior, currentTier, tierKey);
    const reasons = generateUpgradeReasons(behavior, tierKey, tierConfig);

    candidates.push({
      tier: tierKey,
      name: tierConfig.name,
      monthlyPrice: tierConfig.monthlyPrice,
      yearlyPrice: tierConfig.yearlyPrice,
      yearlySavings: tierConfig.monthlyPrice * 12 - tierConfig.yearlyPrice,
      score,
      potentialSavings: savings,
      reasons,
      features: tierConfig.features,
    });
  }

  // 按分數排序，選擇最佳推薦
  candidates.sort((a, b) => b.score - a.score);

  const primaryRecommendation = candidates[0];
  const alternativeRecommendation = candidates[1] || null;

  return {
    hasRecommendation: true,
    currentTier,
    recommendation: {
      ...primaryRecommendation,
      isPrimary: true,
      matchPercentage: Math.round(primaryRecommendation.score * 100),
    },
    alternative: alternativeRecommendation ? {
      ...alternativeRecommendation,
      isPrimary: false,
      matchPercentage: Math.round(alternativeRecommendation.score * 100),
    } : null,
    behavior,
    promotions: await getActivePromotions(primaryRecommendation.tier),
  };
};

/**
 * 計算方案匹配分數
 * @private
 */
const calculateTierMatchScore = (behavior, tierConfig) => {
  const weights = RECOMMENDATION_CONFIG.WEIGHTS;
  let score = 0;

  // 對話使用匹配
  const conversationNeed = behavior.conversation.averageDailyUsage;
  const conversationProvided = tierConfig.features.dailyConversations;
  if (conversationProvided === -1 || conversationNeed <= conversationProvided) {
    score += weights.conversationUsage * Math.min(conversationNeed / Math.max(conversationProvided, 1), 1);
  } else {
    score += weights.conversationUsage * 0.5; // 部分匹配
  }

  // 語音使用匹配
  const voiceNeed = behavior.voice.averageDailyUsage;
  const voiceProvided = tierConfig.features.dailyVoice;
  if (voiceProvided === -1 || voiceNeed <= voiceProvided) {
    score += weights.voiceUsage * Math.min(voiceNeed / Math.max(voiceProvided, 1), 1);
  }

  // 照片使用匹配
  const photoNeed = behavior.photo.averageMonthlyUsage;
  const photoProvided = tierConfig.features.monthlyPhotos;
  score += weights.photoUsage * Math.min(photoNeed / Math.max(photoProvided, 1), 1);

  // 消費潛力
  const spendingRatio = behavior.spending.averageSpentPerMonth / (tierConfig.monthlyPrice || 1);
  score += weights.spendingPotential * Math.min(spendingRatio, 1);

  return Math.min(score, 1);
};

/**
 * 計算潛在節省金額
 * @private
 */
const calculatePotentialSavings = (behavior, currentTier, targetTier) => {
  // 計算如果繼續以當前模式使用，需要額外購買的金幣
  const extraCoinsNeeded = Math.max(0, behavior.conversation.daysAtLimit * 5 * 10); // 假設每次對話 10 金幣
  const extraVoiceCoins = Math.max(0, behavior.voice.daysAtLimit * 3 * 20); // 假設每次語音 20 金幣
  const extraPhotoCoins = Math.max(0, behavior.photo.monthsAtLimit * 2 * 50); // 假設每次照片 50 金幣

  const monthlyExtraCost = (extraCoinsNeeded + extraVoiceCoins + extraPhotoCoins) /
    (RECOMMENDATION_CONFIG.ANALYSIS_PERIOD_DAYS / 30);

  const targetTierPrice = RECOMMENDATION_CONFIG.MEMBERSHIP_TIERS[targetTier]?.monthlyPrice || 0;

  return {
    monthlyExtraCostWithoutUpgrade: Math.round(monthlyExtraCost),
    upgradeMonthlyPrice: targetTierPrice,
    netSavings: Math.round(monthlyExtraCost - targetTierPrice),
    yearlyNetSavings: Math.round((monthlyExtraCost - targetTierPrice) * 12),
  };
};

/**
 * 生成升級理由
 * @private
 */
const generateUpgradeReasons = (behavior, tierKey, tierConfig) => {
  const reasons = [];

  // 對話相關
  if (behavior.conversation.limitHitRate > 0.3) {
    const dailyLimit = tierConfig.features.dailyConversations;
    reasons.push({
      icon: "💬",
      title: "對話更自由",
      description: dailyLimit === -1
        ? "無限對話次數，聊到盡興"
        : `每日 ${dailyLimit} 次對話，是目前的 ${Math.round(dailyLimit / 20)}x`,
    });
  }

  // 語音相關
  if (behavior.voice.limitHitRate > 0.2) {
    const dailyLimit = tierConfig.features.dailyVoice;
    reasons.push({
      icon: "🎧",
      title: "更多語音互動",
      description: dailyLimit === -1
        ? "無限語音播放，享受聲音陪伴"
        : `每日 ${dailyLimit} 次語音，滿足聽覺享受`,
    });
  }

  // 照片相關
  if (behavior.photo.limitHitRate > 0.5) {
    const monthlyLimit = tierConfig.features.monthlyPhotos;
    reasons.push({
      icon: "📸",
      title: "更多專屬照片",
      description: `每月 ${monthlyLimit} 張 AI 生成照片，收藏更多精彩`,
    });
  }

  // 解鎖券
  if (tierConfig.features.unlockTickets > 0) {
    reasons.push({
      icon: "🎫",
      title: "免費解鎖券",
      description: `每月贈送 ${tierConfig.features.unlockTickets} 張角色解鎖券`,
    });
  }

  // 省錢角度
  if (behavior.spending.totalSpent > 0) {
    reasons.push({
      icon: "💰",
      title: "更划算的選擇",
      description: "訂閱制比單次購買更省錢，長期使用更優惠",
    });
  }

  return reasons;
};

/**
 * 生成使用建議
 * @private
 */
const generateUsageTips = (behavior) => {
  const tips = [];

  if (behavior.conversation.averageDailyUsage < 5) {
    tips.push("💡 試試每天和 AI 角色多聊幾句，發現更多有趣話題");
  }

  if (behavior.voice.totalUsage === 0) {
    tips.push("🎧 試試語音功能，聽聽角色的聲音會更有沉浸感");
  }

  if (behavior.photo.totalUsage === 0) {
    tips.push("📸 試試 AI 生成照片功能，獲取角色的專屬照片");
  }

  return tips;
};

/**
 * 獲取當前有效的促銷活動
 * @private
 */
const getActivePromotions = async (tierKey) => {
  const db = getFirestoreDb();
  const now = new Date();

  const promotionsSnapshot = await db.collection("promotions")
    .where("status", "==", "active")
    .where("applicableTiers", "array-contains", tierKey)
    .where("endTime", ">", now)
    .limit(3)
    .get();

  return promotionsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      discountType: data.discountType,
      discountValue: data.discountValue,
      endTime: data.endTime?.toDate?.()?.toISOString(),
    };
  });
};

// ============================================
// 推薦追蹤
// ============================================

/**
 * 記錄推薦展示
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} recommendation - 推薦結果
 */
export const trackRecommendationShown = async (userId, recommendation) => {
  const db = getFirestoreDb();

  await db.collection("recommendation_events").add({
    userId,
    type: "shown",
    recommendedTier: recommendation.recommendation?.tier,
    matchPercentage: recommendation.recommendation?.matchPercentage,
    createdAt: new Date(),
  });
};

/**
 * 記錄推薦點擊
 *
 * @param {string} userId - 用戶 ID
 * @param {string} tier - 點擊的方案
 */
export const trackRecommendationClick = async (userId, tier) => {
  const db = getFirestoreDb();

  await db.collection("recommendation_events").add({
    userId,
    type: "click",
    clickedTier: tier,
    createdAt: new Date(),
  });
};

/**
 * 記錄推薦轉化
 *
 * @param {string} userId - 用戶 ID
 * @param {string} tier - 購買的方案
 */
export const trackRecommendationConversion = async (userId, tier) => {
  const db = getFirestoreDb();

  await db.collection("recommendation_events").add({
    userId,
    type: "conversion",
    convertedTier: tier,
    createdAt: new Date(),
  });
};

export default {
  RECOMMENDATION_CONFIG,
  analyzeUserBehavior,
  generateUpgradeRecommendation,
  trackRecommendationShown,
  trackRecommendationClick,
  trackRecommendationConversion,
};
