/**
 * 通用廣告驗證服務
 * ✅ 2025-12-02 新增：從 conversationLimit.service.js 提取，供所有限制服務重用
 *
 * 功能：
 * - 每日廣告次數限制驗證
 * - 廣告冷卻時間檢查
 * - adId 格式和時間戳驗證
 * - 重放攻擊防護（adId 去重）
 * - 廣告觀看記錄管理
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

const AD_WATCH_STATS_COLLECTION = "ad_watch_stats";

/**
 * 廣告驗證配置
 */
export const AD_VALIDATION_CONFIG = {
  // 每日廣告次數上限
  DAILY_LIMIT: 10,

  // 廣告冷卻時間（秒）
  COOLDOWN_SECONDS: 60,

  // 廣告 ID 有效期（毫秒）
  AD_VALID_WINDOW: 5 * 60 * 1000, // 5 分鐘

  // 保留的已使用 adId 數量
  MAX_USED_AD_IDS: 100,
};

/**
 * 驗證結果類型
 */
export const AD_VALIDATION_RESULT = {
  VALID: "valid",
  DAILY_LIMIT_EXCEEDED: "daily_limit_exceeded",
  COOLDOWN_ACTIVE: "cooldown_active",
  INVALID_AD_ID_FORMAT: "invalid_ad_id_format",
  AD_ID_EXPIRED: "ad_id_expired",
  AD_ID_FUTURE: "ad_id_future",
  AD_ID_REUSED: "ad_id_reused",
};

/**
 * 驗證 adId 格式
 * 預期格式：ad-{timestamp}-{random8}，例如 ad-1705123456789-a1b2c3d4
 *
 * @param {string} adId - 廣告 ID
 * @returns {Object} 驗證結果
 */
export const validateAdIdFormat = (adId) => {
  if (!adId || !adId.match(/^ad-\d{13}-[a-z0-9]{8}$/)) {
    return {
      valid: false,
      result: AD_VALIDATION_RESULT.INVALID_AD_ID_FORMAT,
      message: "無效的廣告 ID 格式",
    };
  }

  return { valid: true };
};

/**
 * 驗證 adId 時間戳
 *
 * @param {string} adId - 廣告 ID
 * @param {number} validWindow - 有效期窗口（毫秒）
 * @returns {Object} 驗證結果
 */
export const validateAdIdTimestamp = (adId, validWindow = AD_VALIDATION_CONFIG.AD_VALID_WINDOW) => {
  const adTimestamp = parseInt(adId.split("-")[1], 10);
  const now = Date.now();
  const timeDiff = now - adTimestamp;

  if (isNaN(adTimestamp)) {
    return {
      valid: false,
      result: AD_VALIDATION_RESULT.INVALID_AD_ID_FORMAT,
      message: "廣告 ID 時間戳無效",
    };
  }

  // 檢查是否為未來時間戳
  if (timeDiff < 0) {
    logger.warn(`[廣告驗證] ⚠️ 檢測到未來時間戳: ${adId}, timestamp: ${adTimestamp}, now: ${now}`);
    return {
      valid: false,
      result: AD_VALIDATION_RESULT.AD_ID_FUTURE,
      message: "無效的廣告 ID（時間異常），請重新觀看廣告",
    };
  }

  // 檢查是否已過期
  if (timeDiff > validWindow) {
    logger.warn(`[廣告驗證] ⚠️ 廣告時間戳已過期: ${adId}, elapsed: ${timeDiff}ms`);
    return {
      valid: false,
      result: AD_VALIDATION_RESULT.AD_ID_EXPIRED,
      message: "廣告 ID 已過期，請重新觀看廣告",
    };
  }

  return { valid: true, timestamp: adTimestamp };
};

/**
 * 檢查每日廣告次數限制
 *
 * @param {Object} statsData - 廣告統計數據
 * @param {number} dailyLimit - 每日限制
 * @returns {Object} 驗證結果
 */
export const checkDailyLimit = (statsData, dailyLimit = AD_VALIDATION_CONFIG.DAILY_LIMIT) => {
  const today = new Date().toISOString().split("T")[0];
  const todayCount = statsData[today] || 0;

  if (todayCount >= dailyLimit) {
    return {
      valid: false,
      result: AD_VALIDATION_RESULT.DAILY_LIMIT_EXCEEDED,
      message: `今日廣告觀看次數已達上限（${dailyLimit} 次），請明天再來`,
      todayCount,
      dailyLimit,
    };
  }

  return { valid: true, todayCount, dailyLimit };
};

/**
 * 檢查冷卻時間
 *
 * @param {Object} statsData - 廣告統計數據
 * @param {number} cooldownSeconds - 冷卻時間（秒）
 * @returns {Object} 驗證結果
 */
export const checkCooldown = (statsData, cooldownSeconds = AD_VALIDATION_CONFIG.COOLDOWN_SECONDS) => {
  const lastWatchTime = statsData.lastWatchTime || 0;
  const cooldownRemaining = Math.ceil(
    (lastWatchTime + cooldownSeconds * 1000 - Date.now()) / 1000
  );

  if (cooldownRemaining > 0) {
    return {
      valid: false,
      result: AD_VALIDATION_RESULT.COOLDOWN_ACTIVE,
      message: `請等待 ${cooldownRemaining} 秒後再觀看下一個廣告`,
      cooldownRemaining,
    };
  }

  return { valid: true, cooldownRemaining: 0 };
};

/**
 * 檢查 adId 是否已被使用（防止重放攻擊）
 *
 * @param {Object} statsData - 廣告統計數據
 * @param {string} adId - 廣告 ID
 * @returns {Object} 驗證結果
 */
export const checkAdIdReuse = (statsData, adId) => {
  const usedAdIds = statsData.usedAdIds || [];

  if (usedAdIds.includes(adId)) {
    logger.warn(`[廣告驗證] ⚠️ 檢測到重複 adId: ${adId.substring(0, 20)}...`);
    return {
      valid: false,
      result: AD_VALIDATION_RESULT.AD_ID_REUSED,
      message: "該廣告獎勵已領取，請勿重複領取",
    };
  }

  return { valid: true };
};

/**
 * 完整的廣告驗證流程
 *
 * @param {string} userId - 用戶 ID
 * @param {string} adId - 廣告 ID
 * @param {Object} options - 選項
 * @param {number} options.dailyLimit - 每日限制
 * @param {number} options.cooldownSeconds - 冷卻時間（秒）
 * @param {number} options.adValidWindow - adId 有效期（毫秒）
 * @returns {Promise<Object>} 驗證結果
 */
export const validateAdWatch = async (userId, adId, options = {}) => {
  const {
    dailyLimit = AD_VALIDATION_CONFIG.DAILY_LIMIT,
    cooldownSeconds = AD_VALIDATION_CONFIG.COOLDOWN_SECONDS,
    adValidWindow = AD_VALIDATION_CONFIG.AD_VALID_WINDOW,
  } = options;

  // 1. 驗證 adId 格式
  const formatResult = validateAdIdFormat(adId);
  if (!formatResult.valid) {
    return formatResult;
  }

  // 2. 驗證 adId 時間戳
  const timestampResult = validateAdIdTimestamp(adId, adValidWindow);
  if (!timestampResult.valid) {
    return timestampResult;
  }

  // 3. 從 Firestore 獲取用戶廣告統計
  const db = getFirestoreDb();
  const adStatsRef = db.collection(AD_WATCH_STATS_COLLECTION).doc(userId);
  const statsDoc = await adStatsRef.get();
  const statsData = statsDoc.exists ? statsDoc.data() : {};

  // 4. 檢查每日限制
  const dailyResult = checkDailyLimit(statsData, dailyLimit);
  if (!dailyResult.valid) {
    return dailyResult;
  }

  // 5. 檢查冷卻時間
  const cooldownResult = checkCooldown(statsData, cooldownSeconds);
  if (!cooldownResult.valid) {
    return cooldownResult;
  }

  // 6. 檢查 adId 重用
  const reuseResult = checkAdIdReuse(statsData, adId);
  if (!reuseResult.valid) {
    return reuseResult;
  }

  // 所有驗證通過
  return {
    valid: true,
    result: AD_VALIDATION_RESULT.VALID,
    statsData,
    todayCount: dailyResult.todayCount,
  };
};

/**
 * 在 Transaction 中執行廣告驗證
 * 用於需要原子性操作的場景
 *
 * @param {Object} transaction - Firestore Transaction
 * @param {string} userId - 用戶 ID
 * @param {string} adId - 廣告 ID
 * @param {Object} options - 驗證選項
 * @returns {Object} 驗證結果和統計數據
 */
export const validateAdWatchInTransaction = async (transaction, userId, adId, options = {}) => {
  const {
    dailyLimit = AD_VALIDATION_CONFIG.DAILY_LIMIT,
    cooldownSeconds = AD_VALIDATION_CONFIG.COOLDOWN_SECONDS,
    adValidWindow = AD_VALIDATION_CONFIG.AD_VALID_WINDOW,
  } = options;

  // 1. 驗證 adId 格式
  const formatResult = validateAdIdFormat(adId);
  if (!formatResult.valid) {
    return formatResult;
  }

  // 2. 驗證 adId 時間戳
  const timestampResult = validateAdIdTimestamp(adId, adValidWindow);
  if (!timestampResult.valid) {
    return timestampResult;
  }

  // 3. 在 Transaction 中讀取廣告統計
  const db = getFirestoreDb();
  const adStatsRef = db.collection(AD_WATCH_STATS_COLLECTION).doc(userId);
  const statsDoc = await transaction.get(adStatsRef);
  const statsData = statsDoc.exists ? statsDoc.data() : {};

  // 4. 檢查每日限制
  const dailyResult = checkDailyLimit(statsData, dailyLimit);
  if (!dailyResult.valid) {
    return dailyResult;
  }

  // 5. 檢查冷卻時間
  const cooldownResult = checkCooldown(statsData, cooldownSeconds);
  if (!cooldownResult.valid) {
    return cooldownResult;
  }

  // 6. 檢查 adId 重用
  const reuseResult = checkAdIdReuse(statsData, adId);
  if (!reuseResult.valid) {
    return reuseResult;
  }

  // 所有驗證通過
  return {
    valid: true,
    result: AD_VALIDATION_RESULT.VALID,
    statsData,
    statsRef: adStatsRef,
    todayCount: dailyResult.todayCount,
  };
};

/**
 * 記錄廣告觀看（在 Transaction 中使用）
 *
 * @param {Object} transaction - Firestore Transaction
 * @param {Object} statsRef - 統計文檔引用
 * @param {Object} statsData - 現有統計數據
 * @param {string} adId - 廣告 ID
 * @param {Object} metadata - 額外元數據
 */
export const recordAdWatchInTransaction = (transaction, statsRef, statsData, adId, metadata = {}) => {
  const today = new Date().toISOString().split("T")[0];
  const todayCount = statsData[today] || 0;
  const usedAdIds = statsData.usedAdIds || [];

  const updateData = {
    [today]: todayCount + 1,
    lastWatchTime: Date.now(),
    usedAdIds: [...usedAdIds.slice(-AD_VALIDATION_CONFIG.MAX_USED_AD_IDS), adId],
    lastAdId: adId,
    totalAdsWatched: (statsData.totalAdsWatched || 0) + 1,
    updatedAt: new Date().toISOString(),
    ...metadata,
  };

  transaction.set(statsRef, updateData, { merge: true });

  logger.info(`[廣告驗證] ✅ 已記錄廣告觀看: adId=${adId.substring(0, 20)}..., todayCount=${todayCount + 1}`);
};

/**
 * 獲取用戶今日廣告觀看統計
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 統計數據
 */
export const getAdWatchStats = async (userId) => {
  const db = getFirestoreDb();
  const statsRef = db.collection(AD_WATCH_STATS_COLLECTION).doc(userId);
  const doc = await statsRef.get();

  if (!doc.exists) {
    return {
      todayCount: 0,
      dailyLimit: AD_VALIDATION_CONFIG.DAILY_LIMIT,
      remaining: AD_VALIDATION_CONFIG.DAILY_LIMIT,
      cooldownActive: false,
      cooldownRemaining: 0,
      totalAdsWatched: 0,
    };
  }

  const data = doc.data();
  const today = new Date().toISOString().split("T")[0];
  const todayCount = data[today] || 0;

  const lastWatchTime = data.lastWatchTime || 0;
  const cooldownRemaining = Math.max(
    0,
    Math.ceil((lastWatchTime + AD_VALIDATION_CONFIG.COOLDOWN_SECONDS * 1000 - Date.now()) / 1000)
  );

  return {
    todayCount,
    dailyLimit: AD_VALIDATION_CONFIG.DAILY_LIMIT,
    remaining: Math.max(0, AD_VALIDATION_CONFIG.DAILY_LIMIT - todayCount),
    cooldownActive: cooldownRemaining > 0,
    cooldownRemaining,
    totalAdsWatched: data.totalAdsWatched || 0,
    lastWatchTime: lastWatchTime ? new Date(lastWatchTime).toISOString() : null,
  };
};

export default {
  AD_VALIDATION_CONFIG,
  AD_VALIDATION_RESULT,
  validateAdIdFormat,
  validateAdIdTimestamp,
  checkDailyLimit,
  checkCooldown,
  checkAdIdReuse,
  validateAdWatch,
  validateAdWatchInTransaction,
  recordAdWatchInTransaction,
  getAdWatchStats,
};
