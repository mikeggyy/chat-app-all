/**
 * 會員配置服務
 * 從 Firestore 讀取和更新會員配置
 *
 * ✅ 2025-12-03 新增：支援資料庫驅動的會員配置
 */

import { db, FieldValue } from "../../../../shared/backend-utils/firebase.js";
import logger from "../utils/logger.js";

// 集合名稱
const COLLECTIONS = {
  MEMBERSHIP_TIERS: "membership_tiers",
  COMPARISON_FEATURES: "comparison_features",
  AD_LIMITS: "ad_limits",
};

// 內存緩存
let tiersCache = null;
let comparisonCache = null;
let adLimitsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘緩存

/**
 * 清除緩存（管理後台更新後調用）
 */
export const clearMembershipConfigCache = () => {
  tiersCache = null;
  comparisonCache = null;
  adLimitsCache = null;
  cacheTimestamp = 0;
  logger.info("[MembershipConfig] 緩存已清除");
};

/**
 * 檢查緩存是否有效
 */
const isCacheValid = () => {
  return Date.now() - cacheTimestamp < CACHE_TTL;
};

// ==================== 會員等級配置 ====================

/**
 * 獲取所有會員等級配置
 * @returns {Promise<Array>} 會員等級配置陣列
 */
export const getMembershipTiers = async () => {
  // 檢查緩存
  if (tiersCache && isCacheValid()) {
    return tiersCache;
  }

  try {
    const snapshot = await db.collection(COLLECTIONS.MEMBERSHIP_TIERS).orderBy("order").get();

    if (snapshot.empty) {
      logger.warn("[MembershipConfig] 資料庫中沒有會員等級配置，使用預設值");
      return getDefaultTiers();
    }

    tiersCache = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    cacheTimestamp = Date.now();

    return tiersCache;
  } catch (error) {
    logger.error("[MembershipConfig] 獲取會員等級失敗:", error);
    return getDefaultTiers();
  }
};

/**
 * 獲取單一會員等級配置
 * @param {string} tierId - 等級 ID (lite, vip, vvip)
 */
export const getMembershipTierById = async (tierId) => {
  const tiers = await getMembershipTiers();
  return tiers.find((t) => t.id === tierId) || null;
};

/**
 * 更新會員等級配置
 * @param {string} tierId - 等級 ID
 * @param {Object} data - 更新資料
 */
export const updateMembershipTier = async (tierId, data) => {
  try {
    const docRef = db.collection(COLLECTIONS.MEMBERSHIP_TIERS).doc(tierId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`會員等級 ${tierId} 不存在`);
    }

    await docRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 清除緩存
    clearMembershipConfigCache();

    logger.info(`[MembershipConfig] 更新會員等級 ${tierId}:`, data);
    return { success: true, tierId };
  } catch (error) {
    logger.error(`[MembershipConfig] 更新會員等級 ${tierId} 失敗:`, error);
    throw error;
  }
};

// ==================== 功能對比表配置 ====================

/**
 * 獲取功能對比表配置
 */
export const getComparisonFeatures = async () => {
  // 檢查緩存
  if (comparisonCache && isCacheValid()) {
    return comparisonCache;
  }

  try {
    const snapshot = await db.collection(COLLECTIONS.COMPARISON_FEATURES).orderBy("order").get();

    if (snapshot.empty) {
      logger.warn("[MembershipConfig] 資料庫中沒有對比表配置，使用預設值");
      return getDefaultComparisonFeatures();
    }

    comparisonCache = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    cacheTimestamp = Date.now();

    return comparisonCache;
  } catch (error) {
    logger.error("[MembershipConfig] 獲取對比表失敗:", error);
    return getDefaultComparisonFeatures();
  }
};

/**
 * 更新功能對比表配置
 * @param {string} categoryId - 類別 ID
 * @param {Object} data - 更新資料
 */
export const updateComparisonFeature = async (categoryId, data) => {
  try {
    const docRef = db.collection(COLLECTIONS.COMPARISON_FEATURES).doc(categoryId);

    await docRef.set(
      {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 清除緩存
    clearMembershipConfigCache();

    logger.info(`[MembershipConfig] 更新對比表 ${categoryId}`);
    return { success: true, categoryId };
  } catch (error) {
    logger.error(`[MembershipConfig] 更新對比表 ${categoryId} 失敗:`, error);
    throw error;
  }
};

// ==================== 廣告限制配置 ====================

/**
 * 獲取廣告限制配置
 */
export const getAdLimits = async () => {
  // 檢查緩存
  if (adLimitsCache && isCacheValid()) {
    return adLimitsCache;
  }

  try {
    const doc = await db.collection(COLLECTIONS.AD_LIMITS).doc("config").get();

    if (!doc.exists) {
      logger.warn("[MembershipConfig] 資料庫中沒有廣告限制配置，使用預設值");
      return getDefaultAdLimits();
    }

    adLimitsCache = doc.data();
    cacheTimestamp = Date.now();

    return adLimitsCache;
  } catch (error) {
    logger.error("[MembershipConfig] 獲取廣告限制失敗:", error);
    return getDefaultAdLimits();
  }
};

/**
 * 更新廣告限制配置
 */
export const updateAdLimits = async (data) => {
  try {
    const docRef = db.collection(COLLECTIONS.AD_LIMITS).doc("config");

    await docRef.set(
      {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 清除緩存
    clearMembershipConfigCache();

    logger.info("[MembershipConfig] 更新廣告限制配置");
    return { success: true };
  } catch (error) {
    logger.error("[MembershipConfig] 更新廣告限制失敗:", error);
    throw error;
  }
};

// ==================== 預設值（資料庫為空時使用）====================

/**
 * 預設會員等級配置
 */
const getDefaultTiers = () => [
  {
    id: "lite",
    order: 1,
    label: "Lite",
    headline: "Lite 入門體驗",
    description: "低門檻體驗付費服務，移除廣告，享受更好的對話體驗。",
    highlight: "入門首選",
    highlightColor: "from-green-500 to-teal-600",
    cardGradient: "from-green-600/20 via-teal-600/20 to-cyan-600/20",
    prices: {
      monthly: { price: 99, currency: "TWD", monthlyEquivalent: 99, discountPercent: 0 },
      quarterly: { price: 249, currency: "TWD", monthlyEquivalent: 83, discountPercent: 16 },
      yearly: { price: 799, currency: "TWD", monthlyEquivalent: 67, discountPercent: 32 },
    },
    features: [
      { icon: "BoltIcon", title: "無強制廣告", detail: "不再被廣告打擾，享受純淨體驗", badge: "✓" },
      { icon: "SpeakerWaveIcon", title: "30 次對話/角色", detail: "每個角色每日 30 次對話（免費: 10）", badge: "3倍提升" },
      { icon: "UserGroupIcon", title: "10 次配對/日", detail: "每日 10 次角色配對（免費: 5）", badge: "2倍提升" },
      { icon: "PhotoIcon", title: "10 張 AI 照片/月", detail: "每月可生成 10 張 AI 照片", badge: null },
      { icon: "StarIcon", title: "9.5 折優惠", detail: "金幣購買、AI 拍照/影片享 9.5 折", badge: null },
    ],
    limits: {
      messagesPerCharacter: 30,
      voicesPerCharacter: 15,
      dailyMatchLimit: 10,
      monthlyPhotos: 10,
      discount: 0.95,
    },
  },
  {
    id: "vip",
    order: 2,
    label: "VIP",
    headline: "VIP 尊榮體驗",
    description: "大幅提升對話額度，享受更好的 AI 體驗，每月贈送解鎖券。",
    highlight: "人氣首選",
    highlightColor: "from-blue-500 to-indigo-600",
    cardGradient: "from-blue-600/20 via-indigo-600/20 to-purple-600/20",
    prices: {
      monthly: { price: 299, currency: "TWD", monthlyEquivalent: 299, discountPercent: 0 },
      quarterly: { price: 749, currency: "TWD", monthlyEquivalent: 250, discountPercent: 16 },
      yearly: { price: 2399, currency: "TWD", monthlyEquivalent: 200, discountPercent: 33 },
    },
    features: [
      { icon: "BoltIcon", title: "無強制廣告", detail: "不再被廣告打擾，享受純淨體驗", badge: "✓" },
      { icon: "SpeakerWaveIcon", title: "100 次對話/角色", detail: "每個角色每日 100 次對話", badge: "10倍提升" },
      { icon: "UserGroupIcon", title: "50 次配對/日", detail: "每日 50 次角色配對，進階搜尋功能", badge: "10倍提升" },
      { icon: "PhotoIcon", title: "30 張 AI 照片/月", detail: "每月可生成 30 張 AI 照片", badge: null },
      { icon: "GiftIcon", title: "每月贈送解鎖券", detail: "每月贈送 1 張角色解鎖券（7天無限對話）", badge: "每月送" },
      { icon: "StarIcon", title: "9 折優惠", detail: "金幣購買、AI 拍照/影片享 9 折", badge: null },
    ],
    limits: {
      messagesPerCharacter: 100,
      voicesPerCharacter: 50,
      dailyMatchLimit: 50,
      monthlyPhotos: 30,
      discount: 0.9,
      monthlyUnlockTickets: 1,
    },
  },
  {
    id: "vvip",
    order: 3,
    label: "VVIP",
    headline: "VVIP 黑卡禮遇",
    description: "超大額度對話、語音，極致體驗，每月豐厚贈禮。",
    highlight: "極致尊榮",
    highlightColor: "from-amber-500 via-orange-500 to-pink-600",
    cardGradient: "from-amber-600/20 via-orange-600/20 to-pink-600/20",
    prices: {
      monthly: { price: 599, currency: "TWD", monthlyEquivalent: 599, discountPercent: 0 },
      quarterly: { price: 1499, currency: "TWD", monthlyEquivalent: 500, discountPercent: 17 },
      yearly: { price: 4799, currency: "TWD", monthlyEquivalent: 400, discountPercent: 33 },
    },
    features: [
      { icon: "SparklesIcon", title: "500 次對話/角色", detail: "每個角色每日 500 次對話", badge: "超大額度" },
      { icon: "SpeakerWaveIcon", title: "200 次語音/角色", detail: "每個角色每日 200 次語音播放", badge: "超大額度" },
      { icon: "UserGroupIcon", title: "100 次配對/日", detail: "每日 100 次角色配對", badge: "超大額度" },
      { icon: "PhotoIcon", title: "100 張 AI 照片/月", detail: "每月可生成 100 張 AI 照片", badge: null },
      { icon: "GiftIcon", title: "每月豪華贈禮", detail: "每月贈送 3 張解鎖券 + 100 金幣", badge: "價值最高" },
      { icon: "StarIcon", title: "8 折優惠", detail: "金幣購買、AI 拍照/影片享 8 折", badge: null },
      { icon: "CpuChipIcon", title: "VVIP 專屬特權", detail: "新功能搶先體驗、獨家角色優先解鎖", badge: "獨家" },
    ],
    limits: {
      messagesPerCharacter: 500,
      voicesPerCharacter: 200,
      dailyMatchLimit: 100,
      monthlyPhotos: 100,
      discount: 0.8,
      monthlyUnlockTickets: 3,
      monthlyCoins: 100,
    },
  },
];

/**
 * 預設功能對比表
 */
const getDefaultComparisonFeatures = () => [
  {
    id: "conversation",
    order: 1,
    category: "對話功能",
    items: [
      { name: "每角色對話次數", free: "10 次", lite: "30 次", vip: "100 次", vvip: "500 次" },
      { name: "語音播放", free: "10 次/角色", lite: "15 次/角色", vip: "50 次/角色", vvip: "200 次/角色" },
    ],
  },
  {
    id: "match",
    order: 2,
    category: "配對功能",
    items: [
      { name: "每日配對次數", free: "5 次", lite: "10 次", vip: "50 次", vvip: "100 次" },
      { name: "進階搜尋", free: "✗", lite: "✗", vip: "✓", vvip: "✓" },
    ],
  },
  {
    id: "ai",
    order: 3,
    category: "AI 功能",
    items: [
      { name: "每月 AI 照片", free: "3 張", lite: "10 張", vip: "30 張", vvip: "100 張" },
      { name: "AI 回覆長度", free: "短", lite: "中短", vip: "中", vvip: "長" },
    ],
  },
  {
    id: "benefits",
    order: 4,
    category: "每月福利",
    items: [
      { name: "角色解鎖券", free: "-", lite: "-", vip: "1 張/月", vvip: "3 張/月" },
      { name: "贈送金幣", free: "-", lite: "-", vip: "-", vvip: "100/月" },
      { name: "購買折扣", free: "-", lite: "9.5 折", vip: "9 折", vvip: "8 折" },
    ],
  },
  {
    id: "ads_support",
    order: 5,
    category: "廣告與客服",
    items: [
      { name: "無強制廣告", free: "✗", lite: "✓", vip: "✓", vvip: "✓" },
      { name: "廣告獎勵可用", free: "✓", lite: "✓", vip: "✓", vvip: "✓" },
      { name: "每次廣告解鎖對話", free: "5 次", lite: "8 次", vip: "10 次", vvip: "20 次" },
      { name: "優先客服", free: "✗", lite: "✗", vip: "✓", vvip: "✓" },
    ],
  },
];

/**
 * 預設廣告限制配置
 */
const getDefaultAdLimits = () => ({
  conversation: {
    free: { dailyAdLimit: 10, unlockedPerAd: 5 },
    lite: { dailyAdLimit: 10, unlockedPerAd: 8 },
    vip: { dailyAdLimit: 10, unlockedPerAd: 10 },
    vvip: { dailyAdLimit: 10, unlockedPerAd: 20 },
  },
  voice: {
    free: { dailyAdLimit: 10, unlockedPerAd: 5 },
    lite: { dailyAdLimit: 10, unlockedPerAd: 8 },
    vip: { dailyAdLimit: 10, unlockedPerAd: 10 },
    vvip: { dailyAdLimit: 10, unlockedPerAd: 15 },
  },
  match: {
    free: { dailyAdLimit: 10, unlockedPerAd: 1 },
    lite: { dailyAdLimit: 10, unlockedPerAd: 2 },
    vip: { dailyAdLimit: 10, unlockedPerAd: 5 },
    vvip: { dailyAdLimit: 10, unlockedPerAd: 10 },
  },
});

// ==================== 初始化資料庫 ====================

/**
 * 初始化資料庫（將預設值寫入 Firestore）
 * 只在資料庫為空時執行
 */
export const initializeMembershipConfig = async () => {
  try {
    // 檢查是否已有資料
    const tiersSnapshot = await db.collection(COLLECTIONS.MEMBERSHIP_TIERS).limit(1).get();

    if (!tiersSnapshot.empty) {
      logger.info("[MembershipConfig] 資料庫已有配置，跳過初始化");
      return { initialized: false, message: "已有配置" };
    }

    logger.info("[MembershipConfig] 開始初始化資料庫配置...");

    const batch = db.batch();
    const now = FieldValue.serverTimestamp();

    // 寫入會員等級
    const tiers = getDefaultTiers();
    for (const tier of tiers) {
      const ref = db.collection(COLLECTIONS.MEMBERSHIP_TIERS).doc(tier.id);
      batch.set(ref, { ...tier, createdAt: now, updatedAt: now });
    }

    // 寫入對比表
    const comparison = getDefaultComparisonFeatures();
    for (const category of comparison) {
      const ref = db.collection(COLLECTIONS.COMPARISON_FEATURES).doc(category.id);
      batch.set(ref, { ...category, createdAt: now, updatedAt: now });
    }

    // 寫入廣告限制
    const adLimits = getDefaultAdLimits();
    const adRef = db.collection(COLLECTIONS.AD_LIMITS).doc("config");
    batch.set(adRef, { ...adLimits, createdAt: now, updatedAt: now });

    await batch.commit();

    logger.info("[MembershipConfig] 資料庫配置初始化完成");
    return { initialized: true, message: "初始化完成" };
  } catch (error) {
    logger.error("[MembershipConfig] 初始化失敗:", error);
    throw error;
  }
};

export default {
  getMembershipTiers,
  getMembershipTierById,
  updateMembershipTier,
  getComparisonFeatures,
  updateComparisonFeature,
  getAdLimits,
  updateAdLimits,
  clearMembershipConfigCache,
  initializeMembershipConfig,
};
