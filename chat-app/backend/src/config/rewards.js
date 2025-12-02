/**
 * 獎勵系統配置
 * 包含每日登入獎勵、連續登入里程碑、首購優惠
 *
 * 注意：這些是預設配置，實際運行時會優先從 Firestore (reward_configs 集合) 讀取
 * 可透過管理後台修改獎勵配置
 */

import { getFirestoreDb } from "../firebase/index.js";

// 獎勵配置緩存
let rewardsConfigCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘緩存

/**
 * 每日登入獎勵（30天週期）- 預設值
 * 每月循環，關鍵日期給額外獎勵激勵用戶維持連續登入
 */
export const DEFAULT_DAILY_REWARDS = [
  // 第一週
  { day: 1, coins: 5, description: "每日獎勵", week: 1 },
  { day: 2, coins: 5, description: "每日獎勵", week: 1 },
  { day: 3, coins: 5, description: "每日獎勵", week: 1 },
  { day: 4, coins: 5, description: "每日獎勵", week: 1 },
  { day: 5, coins: 5, description: "每日獎勵", week: 1 },
  { day: 6, coins: 10, description: "週末驚喜", week: 1 },
  { day: 7, coins: 20, description: "一週達成", week: 1, highlight: true, milestone: true },
  // 第二週
  { day: 8, coins: 5, description: "每日獎勵", week: 2 },
  { day: 9, coins: 5, description: "每日獎勵", week: 2 },
  { day: 10, coins: 10, description: "十天驚喜", week: 2 },
  { day: 11, coins: 5, description: "每日獎勵", week: 2 },
  { day: 12, coins: 5, description: "每日獎勵", week: 2 },
  { day: 13, coins: 10, description: "週末驚喜", week: 2 },
  { day: 14, coins: 25, description: "兩週達成", week: 2, highlight: true, milestone: true },
  // 第三週
  { day: 15, coins: 5, description: "每日獎勵", week: 3 },
  { day: 16, coins: 5, description: "每日獎勵", week: 3 },
  { day: 17, coins: 5, description: "每日獎勵", week: 3 },
  { day: 18, coins: 5, description: "每日獎勵", week: 3 },
  { day: 19, coins: 5, description: "每日獎勵", week: 3 },
  { day: 20, coins: 15, description: "週末驚喜", week: 3 },
  { day: 21, coins: 30, description: "三週達成", week: 3, highlight: true, milestone: true },
  // 第四週
  { day: 22, coins: 5, description: "每日獎勵", week: 4 },
  { day: 23, coins: 5, description: "每日獎勵", week: 4 },
  { day: 24, coins: 5, description: "每日獎勵", week: 4 },
  { day: 25, coins: 10, description: "倒數五天", week: 4 },
  { day: 26, coins: 10, description: "倒數四天", week: 4 },
  { day: 27, coins: 15, description: "倒數三天", week: 4 },
  { day: 28, coins: 15, description: "倒數兩天", week: 4 },
  { day: 29, coins: 20, description: "倒數一天", week: 4 },
  { day: 30, coins: 50, description: "月度達成", week: 4, highlight: true, milestone: true, isMonthly: true },
];

/**
 * 連續登入里程碑獎勵 - 預設值
 * 達到特定天數時額外發放獎勵
 * 前三個里程碑 (7/14/30) 會在彈窗中特別顯示
 */
export const DEFAULT_STREAK_MILESTONES = [
  {
    days: 7,
    rewards: { coins: 30, photoUnlockCards: 1 },
    title: "一週達成",
    description: "連續登入 7 天",
    badge: "🎯",
    color: "#22c55e", // 綠色
    showInModal: true,
  },
  {
    days: 14,
    rewards: { coins: 50, photoUnlockCards: 2 },
    title: "兩週達成",
    description: "連續登入 14 天",
    badge: "⭐",
    color: "#eab308", // 黃色
    showInModal: true,
  },
  {
    days: 21,
    rewards: { coins: 30 },
    title: "三週達成",
    description: "連續登入 21 天",
    badge: "🌟",
    color: "#f97316", // 橙色
    showInModal: false,
  },
  {
    days: 30,
    rewards: { coins: 100, characterUnlockCards: 1, photoUnlockCards: 3 },
    title: "月度達成",
    description: "連續登入 30 天",
    badge: "🏆",
    color: "#ec4899", // 粉色
    showInModal: true,
    isMonthly: true,
  },
  {
    days: 60,
    rewards: { coins: 150, photoUnlockCards: 2 },
    title: "雙月達成",
    description: "連續登入 60 天",
    badge: "💎",
    color: "#8b5cf6", // 紫色
  },
  {
    days: 90,
    rewards: { coins: 300, photoUnlockCards: 5, characterUnlockCards: 2 },
    title: "傳奇達成",
    description: "連續登入 90 天",
    badge: "👑",
    color: "#f59e0b", // 金色
    isLegendary: true,
  },
];

/**
 * 首購優惠配置 - 預設值
 * 僅限從未購買過任何付費商品的用戶
 */
export const DEFAULT_FIRST_PURCHASE_OFFER = {
  id: "first_purchase_special",
  name: "新手首儲禮包",
  description: "限時首儲，超值優惠只給新朋友",
  price: 99,
  originalPrice: 299,  // 原價，用於顯示折扣
  currency: "TWD",
  discount: "67%",     // 折扣標籤
  contents: {
    coins: 300,
    photoUnlockCards: 5,
    characterUnlockCards: 1,
  },
  badge: "🎁 限時首儲",
  validDays: 7,        // 註冊後 7 天內有效
  purchaseLimit: "first_purchase",  // 特殊限制類型
  enabled: true,
};

/**
 * 回歸用戶優惠配置 - 預設值
 * 超過 7 天未登入的用戶
 */
export const DEFAULT_RETURNING_USER_OFFER = {
  id: "returning_user_special",
  name: "回歸禮包",
  description: "好久不見！歡迎回來",
  price: 149,
  originalPrice: 299,
  currency: "TWD",
  discount: "50%",
  contents: {
    coins: 200,
    photoUnlockCards: 3,
  },
  badge: "💝 歡迎回歸",
  inactiveDays: 7,     // 需要 7 天未登入才顯示
  validHours: 48,      // 回歸後 48 小時內有效
  purchaseLimit: "returning_once",
};

/**
 * 從 Firestore 載入獎勵配置（帶緩存）
 * @returns {Promise<Object>} 獎勵配置
 */
async function loadRewardsConfig() {
  // 檢查緩存是否有效
  if (rewardsConfigCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return rewardsConfigCache;
  }

  try {
    const db = getFirestoreDb();
    const configRef = db.collection("reward_configs");

    const [dailyDoc, milestonesDoc, firstPurchaseDoc, returningUserDoc] = await Promise.all([
      configRef.doc("daily_rewards").get(),
      configRef.doc("streak_milestones").get(),
      configRef.doc("first_purchase_offer").get(),
      configRef.doc("returning_user_offer").get(),
    ]);

    // 確保即使文檔存在但欄位為空時，也會使用預設值
    const dailyData = dailyDoc.exists ? dailyDoc.data() : null;
    const milestonesData = milestonesDoc.exists ? milestonesDoc.data() : null;

    rewardsConfigCache = {
      dailyRewards: (dailyData?.rewards && dailyData.rewards.length > 0)
        ? dailyData.rewards
        : DEFAULT_DAILY_REWARDS,
      streakMilestones: (milestonesData?.milestones && milestonesData.milestones.length > 0)
        ? milestonesData.milestones
        : DEFAULT_STREAK_MILESTONES,
      firstPurchaseOffer: firstPurchaseDoc.exists ? firstPurchaseDoc.data() : DEFAULT_FIRST_PURCHASE_OFFER,
      returningUserOffer: returningUserDoc.exists ? returningUserDoc.data() : DEFAULT_RETURNING_USER_OFFER,
    };

    cacheTimestamp = Date.now();

    return rewardsConfigCache;
  } catch (error) {
    console.error("載入獎勵配置失敗，使用預設值:", error.message);
    // 返回預設值
    return {
      dailyRewards: DEFAULT_DAILY_REWARDS,
      streakMilestones: DEFAULT_STREAK_MILESTONES,
      firstPurchaseOffer: DEFAULT_FIRST_PURCHASE_OFFER,
      returningUserOffer: DEFAULT_RETURNING_USER_OFFER,
    };
  }
}

/**
 * 清除獎勵配置緩存（管理員更新配置後調用）
 */
export function clearRewardsConfigCache() {
  rewardsConfigCache = null;
  cacheTimestamp = null;
}

/**
 * 獲取每日獎勵配置
 * @returns {Promise<Array>}
 */
export async function getDailyRewardsConfig() {
  const config = await loadRewardsConfig();
  return config.dailyRewards;
}

/**
 * 獲取里程碑配置
 * @returns {Promise<Array>}
 */
export async function getStreakMilestonesConfig() {
  const config = await loadRewardsConfig();
  return config.streakMilestones;
}

/**
 * 獲取首購優惠配置
 * @returns {Promise<Object>}
 */
export async function getFirstPurchaseOfferConfig() {
  const config = await loadRewardsConfig();
  return config.firstPurchaseOffer;
}

/**
 * 獲取回歸用戶優惠配置
 * @returns {Promise<Object>}
 */
export async function getReturningUserOfferConfig() {
  const config = await loadRewardsConfig();
  return config.returningUserOffer;
}

// 保持向後兼容的靜態導出（用於不需要動態更新的場景）
export const DAILY_REWARDS = DEFAULT_DAILY_REWARDS;
export const STREAK_MILESTONES = DEFAULT_STREAK_MILESTONES;
export const FIRST_PURCHASE_OFFER = DEFAULT_FIRST_PURCHASE_OFFER;
export const RETURNING_USER_OFFER = DEFAULT_RETURNING_USER_OFFER;

/**
 * 獎勵類型常量
 */
export const REWARD_TYPES = {
  DAILY_LOGIN: "daily_login",
  STREAK_MILESTONE: "streak_milestone",
  FIRST_PURCHASE: "first_purchase",
  RETURNING_USER: "returning_user",
};

/**
 * 計算當日應得的每日獎勵
 * @param {number} currentStreak - 當前連續登入天數
 * @returns {Object} 當日獎勵配置
 */
export const getDailyReward = (currentStreak) => {
  // 使用 30 天循環，取餘數決定當天獎勵
  const dayInCycle = ((currentStreak - 1) % 30) + 1;
  return DAILY_REWARDS.find(r => r.day === dayInCycle) || DAILY_REWARDS[0];
};

/**
 * 檢查是否達到里程碑
 * @param {number} currentStreak - 當前連續登入天數
 * @param {Array} claimedMilestones - 已領取的里程碑天數列表
 * @returns {Object|null} 可領取的里程碑獎勵，若無則返回 null
 */
export const getUnclaimedMilestone = (currentStreak, claimedMilestones = []) => {
  return STREAK_MILESTONES.find(
    m => currentStreak >= m.days && !claimedMilestones.includes(m.days)
  ) || null;
};

/**
 * 獲取下一個里程碑
 * @param {number} currentStreak - 當前連續登入天數
 * @returns {Object|null} 下一個里程碑配置
 */
export const getNextMilestone = (currentStreak) => {
  return STREAK_MILESTONES.find(m => m.days > currentStreak) || null;
};

export default {
  DAILY_REWARDS,
  STREAK_MILESTONES,
  FIRST_PURCHASE_OFFER,
  RETURNING_USER_OFFER,
  REWARD_TYPES,
  getDailyReward,
  getUnclaimedMilestone,
  getNextMilestone,
};
