/**
 * 登入獎勵服務
 * 處理每日登入獎勵、連續登入追蹤、里程碑獎勵
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import {
  getDailyRewardsConfig,
  getStreakMilestonesConfig,
  REWARD_TYPES,
  DEFAULT_DAILY_REWARDS,
  DEFAULT_STREAK_MILESTONES,
} from "../config/rewards.js";
import logger from "../utils/logger.js";

/**
 * 獲取每日獎勵（動態配置）
 * @param {number} currentStreak - 當前連續登入天數
 * @param {Array} dailyRewards - 每日獎勵配置
 * @returns {Object} 當日獎勵配置
 */
const getDailyReward = (currentStreak, dailyRewards) => {
  const rewards = dailyRewards || DEFAULT_DAILY_REWARDS;
  // 使用 30 天循環
  const dayInCycle = ((currentStreak - 1) % 30) + 1;
  return rewards.find(r => r.day === dayInCycle) || rewards[0];
};

/**
 * 檢查是否達到里程碑（動態配置）
 * @param {number} currentStreak - 當前連續登入天數
 * @param {Array} claimedMilestones - 已領取的里程碑天數列表
 * @param {Array} streakMilestones - 里程碑配置
 * @returns {Object|null} 可領取的里程碑獎勵
 */
const getUnclaimedMilestone = (currentStreak, claimedMilestones = [], streakMilestones) => {
  const milestones = streakMilestones || DEFAULT_STREAK_MILESTONES;
  return milestones.find(
    m => currentStreak >= m.days && !claimedMilestones.includes(m.days)
  ) || null;
};

/**
 * 獲取下一個里程碑（動態配置）
 * @param {number} currentStreak - 當前連續登入天數
 * @param {Array} streakMilestones - 里程碑配置
 * @returns {Object|null} 下一個里程碑配置
 */
const getNextMilestone = (currentStreak, streakMilestones) => {
  const milestones = streakMilestones || DEFAULT_STREAK_MILESTONES;
  return milestones.find(m => m.days > currentStreak) || null;
};

/**
 * 獲取今天的日期字符串（UTC+8 台灣時區）
 * @returns {string} YYYY-MM-DD 格式
 */
const getTodayDateString = () => {
  const now = new Date();
  // 轉換為台灣時區 (UTC+8)
  const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return taiwanTime.toISOString().split("T")[0];
};

/**
 * 獲取昨天的日期字符串（UTC+8 台灣時區）
 * @returns {string} YYYY-MM-DD 格式
 */
const getYesterdayDateString = () => {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  taiwanTime.setDate(taiwanTime.getDate() - 1);
  return taiwanTime.toISOString().split("T")[0];
};

/**
 * 獲取用戶的登入獎勵狀態
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 登入獎勵狀態
 */
export const getLoginRewardStatus = async (userId) => {
  const db = getFirestoreDb();
  const rewardRef = db.collection("users").doc(userId).collection("rewards").doc("login_streak");

  // 並行載入用戶狀態和動態配置
  const [rewardDoc, dailyRewards, streakMilestones] = await Promise.all([
    rewardRef.get(),
    getDailyRewardsConfig(),
    getStreakMilestonesConfig(),
  ]);

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // 默認狀態
  let status = {
    currentStreak: 0,
    lastClaimDate: null,
    totalLoginDays: 0,
    claimedMilestones: [],
    createdAt: null,
  };

  if (rewardDoc.exists) {
    status = { ...status, ...rewardDoc.data() };
  }

  // 檢查連續登入是否中斷
  const lastClaim = status.lastClaimDate;
  let streakBroken = false;

  if (lastClaim && lastClaim !== today && lastClaim !== yesterday) {
    // 連續登入中斷，重置 streak
    streakBroken = true;
    status.currentStreak = 0;
  }

  // 計算今日是否可領取
  const canClaimToday = lastClaim !== today;

  // 獲取今日獎勵預覽（使用動態配置）
  const nextStreak = canClaimToday ? status.currentStreak + 1 : status.currentStreak;
  const todayReward = getDailyReward(nextStreak, dailyRewards);

  // 獲取可領取的里程碑（使用動態配置）
  const unclaimedMilestone = canClaimToday
    ? getUnclaimedMilestone(nextStreak, status.claimedMilestones, streakMilestones)
    : null;

  // 獲取下一個里程碑（包含計算 daysRemaining，使用動態配置）
  const rawNextMilestone = getNextMilestone(nextStreak, streakMilestones);
  const nextMilestone = rawNextMilestone
    ? {
        days: rawNextMilestone.days,
        title: rawNextMilestone.title,
        daysRemaining: rawNextMilestone.days - nextStreak,
      }
    : null;

  // 獲取本月獎勵預覽（30天循環，使用動態配置）
  // currentStreak 是已完成的連續登入天數
  // 使用 30 天週期內的位置來計算
  const currentDayInCycle = status.currentStreak % 30; // 0-29，0 表示剛完成第 30 天
  const todayDayInCycle = canClaimToday
    ? (currentDayInCycle === 0 && status.currentStreak > 0 ? 30 : currentDayInCycle + 1)
    : (currentDayInCycle === 0 ? 30 : currentDayInCycle);

  const monthRewards = (dailyRewards || []).map((reward, index) => {
    const dayNumber = index + 1; // Day 1, Day 2, ..., Day 30

    // 在當前週期內，已領取的天數
    const cycleCompletedDays = currentDayInCycle === 0 && status.currentStreak > 0
      ? 30
      : currentDayInCycle;
    const isClaimed = dayNumber <= cycleCompletedDays;
    const isToday = dayNumber === todayDayInCycle;

    return {
      ...reward,
      isClaimed,
      isToday,
    };
  });

  // 獲取要在彈窗中顯示的主要里程碑 (7/14/30天)
  const displayMilestones = (streakMilestones || DEFAULT_STREAK_MILESTONES)
    .filter(m => m.showInModal || m.days <= 30)
    .slice(0, 3) // 只取前三個
    .map(m => ({
      ...m,
      isCompleted: status.currentStreak >= m.days || status.claimedMilestones.includes(m.days),
      isClaimed: status.claimedMilestones.includes(m.days),
      progress: Math.min((status.currentStreak / m.days) * 100, 100),
    }));

  return {
    success: true,
    userId,
    currentStreak: status.currentStreak,
    totalLoginDays: status.totalLoginDays,
    lastClaimDate: status.lastClaimDate,
    canClaimToday,
    streakBroken,
    todayReward: canClaimToday ? todayReward : null,
    unclaimedMilestone,
    nextMilestone,
    claimedMilestones: status.claimedMilestones,
    monthRewards,
    displayMilestones,
    // 向後兼容，保留 weekRewards（取前 7 天）
    weekRewards: monthRewards.slice(0, 7),
  };
};

/**
 * 領取每日登入獎勵
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 領取結果
 */
export const claimDailyReward = async (userId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);
  const rewardRef = db.collection("users").doc(userId).collection("rewards").doc("login_streak");

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // 在事務外載入動態配置（配置有緩存）
  const [dailyRewards, streakMilestones] = await Promise.all([
    getDailyRewardsConfig(),
    getStreakMilestonesConfig(),
  ]);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶和獎勵狀態
    const [userDoc, rewardDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(rewardRef),
    ]);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const userData = userDoc.data();
    const currentBalance = getWalletBalance(userData);
    const currentAssets = userData.assets || {};

    // 2. 獲取或初始化獎勵狀態
    let rewardStatus = {
      currentStreak: 0,
      lastClaimDate: null,
      totalLoginDays: 0,
      claimedMilestones: [],
    };

    if (rewardDoc.exists) {
      rewardStatus = { ...rewardStatus, ...rewardDoc.data() };
    }

    // 3. 檢查今日是否已領取
    if (rewardStatus.lastClaimDate === today) {
      throw new Error("今日獎勵已領取");
    }

    // 4. 計算連續登入
    let newStreak = rewardStatus.currentStreak;
    let streakBroken = false;

    if (rewardStatus.lastClaimDate === yesterday) {
      // 連續登入
      newStreak += 1;
    } else if (rewardStatus.lastClaimDate === null) {
      // 首次登入
      newStreak = 1;
    } else {
      // 連續登入中斷
      streakBroken = true;
      newStreak = 1;
    }

    // 5. 計算獎勵（使用動態配置）
    const dailyReward = getDailyReward(newStreak, dailyRewards);
    let totalCoinsEarned = dailyReward.coins;
    let milestoneReward = null;

    // 更新資產
    const newAssets = { ...currentAssets };

    // 6. 檢查里程碑獎勵（使用動態配置）
    const unclaimedMilestone = getUnclaimedMilestone(newStreak, rewardStatus.claimedMilestones, streakMilestones);
    if (unclaimedMilestone) {
      milestoneReward = unclaimedMilestone;
      totalCoinsEarned += unclaimedMilestone.rewards.coins || 0;

      // 添加卡片獎勵
      if (unclaimedMilestone.rewards.photoUnlockCards) {
        newAssets.photoUnlockCards = (newAssets.photoUnlockCards || 0) + unclaimedMilestone.rewards.photoUnlockCards;
      }
      if (unclaimedMilestone.rewards.characterUnlockCards) {
        newAssets.characterUnlockCards = (newAssets.characterUnlockCards || 0) + unclaimedMilestone.rewards.characterUnlockCards;
      }
      if (unclaimedMilestone.rewards.videoUnlockCards) {
        newAssets.videoUnlockCards = (newAssets.videoUnlockCards || 0) + unclaimedMilestone.rewards.videoUnlockCards;
      }
    }

    // 7. 更新用戶金幣和資產
    const newBalance = currentBalance + totalCoinsEarned;
    const userUpdate = {
      ...createWalletUpdate(newBalance),
      assets: newAssets,
      unlockTickets: newAssets, // 向後兼容
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.update(userRef, userUpdate);

    // 8. 更新獎勵狀態
    const newClaimedMilestones = milestoneReward
      ? [...rewardStatus.claimedMilestones, milestoneReward.days]
      : rewardStatus.claimedMilestones;

    const rewardUpdate = {
      currentStreak: newStreak,
      lastClaimDate: today,
      totalLoginDays: rewardStatus.totalLoginDays + 1,
      claimedMilestones: newClaimedMilestones,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!rewardDoc.exists) {
      rewardUpdate.createdAt = FieldValue.serverTimestamp();
    }

    transaction.set(rewardRef, rewardUpdate, { merge: true });

    // 9. 記錄獎勵歷史
    const historyRef = db.collection("users").doc(userId).collection("reward_history").doc();
    transaction.set(historyRef, {
      type: REWARD_TYPES.DAILY_LOGIN,
      date: today,
      streak: newStreak,
      dailyReward: {
        coins: dailyReward.coins,
        description: dailyReward.description,
      },
      milestoneReward: milestoneReward ? {
        days: milestoneReward.days,
        title: milestoneReward.title,
        rewards: milestoneReward.rewards,
      } : null,
      totalCoinsEarned,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 10. 設置返回結果（使用動態配置）
    const nextMilestone = getNextMilestone(newStreak, streakMilestones);

    result = {
      success: true,
      claimed: true,
      currentStreak: newStreak,
      streakBroken,
      dailyReward: {
        coins: dailyReward.coins,
        description: dailyReward.description,
        highlight: dailyReward.highlight || false,
      },
      milestoneReward: milestoneReward ? {
        days: milestoneReward.days,
        title: milestoneReward.title,
        description: milestoneReward.description,
        badge: milestoneReward.badge,
        rewards: milestoneReward.rewards,
        isLegendary: milestoneReward.isLegendary || false,
      } : null,
      totalCoinsEarned,
      newBalance,
      newAssets,
      nextMilestone: nextMilestone ? {
        days: nextMilestone.days,
        title: nextMilestone.title,
        daysRemaining: nextMilestone.days - newStreak,
      } : null,
      totalLoginDays: rewardStatus.totalLoginDays + 1,
    };

    logger.info(
      `[登入獎勵] 用戶 ${userId} 領取獎勵: 連續 ${newStreak} 天, ` +
      `獲得 ${totalCoinsEarned} 金幣${milestoneReward ? `, 達成里程碑: ${milestoneReward.title}` : ""}`
    );
  });

  return result;
};

/**
 * 獲取用戶的獎勵歷史
 * @param {string} userId - 用戶 ID
 * @param {number} limit - 返回數量限制
 * @returns {Promise<Object>} 獎勵歷史
 */
export const getRewardHistory = async (userId, limit = 30) => {
  const db = getFirestoreDb();
  const historyRef = db.collection("users").doc(userId).collection("reward_history");
  const snapshot = await historyRef
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const history = [];
  snapshot.forEach(doc => {
    history.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return {
    success: true,
    history,
  };
};

/**
 * 獲取所有里程碑及其狀態
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 里程碑列表及狀態
 */
export const getMilestones = async (userId) => {
  const db = getFirestoreDb();
  const rewardRef = db.collection("users").doc(userId).collection("rewards").doc("login_streak");

  // 並行載入用戶狀態和動態配置
  const [rewardDoc, streakMilestones] = await Promise.all([
    rewardRef.get(),
    getStreakMilestonesConfig(),
  ]);

  let currentStreak = 0;
  let claimedMilestones = [];

  if (rewardDoc.exists) {
    const data = rewardDoc.data();
    currentStreak = data.currentStreak || 0;
    claimedMilestones = data.claimedMilestones || [];
  }

  const milestones = streakMilestones.map(milestone => ({
    ...milestone,
    isClaimed: claimedMilestones.includes(milestone.days),
    isUnlocked: currentStreak >= milestone.days,
    progress: Math.min(currentStreak / milestone.days, 1),
    daysRemaining: Math.max(milestone.days - currentStreak, 0),
  }));

  return {
    success: true,
    currentStreak,
    milestones,
  };
};

export default {
  getLoginRewardStatus,
  claimDailyReward,
  getRewardHistory,
  getMilestones,
};
