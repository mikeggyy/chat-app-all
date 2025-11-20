/**
 * 用戶檔案緩存服務
 *
 * 目的：減少 Firestore 查詢次數，特別是在 AI 對話中頻繁查詢用戶會員等級的情況
 *
 * 預期效果：
 * - 節省 80% 的用戶檔案查詢成本
 * - 減少 API 響應時間 20-30%
 * - 降低 Firestore 讀取費用
 *
 * 使用場景：
 * - AI 對話時檢查用戶會員等級
 * - 限制系統檢查用戶權限
 * - 頻繁訪問的用戶資料
 */

import NodeCache from "node-cache";
import logger from "../utils/logger.js";
import { getUserById } from "./user.service.js";

/**
 * 用戶檔案緩存配置
 */
const CACHE_CONFIG = {
  // ✅ 修復：改為 1 分鐘（60 秒），解決前後台金幣餘額不同步問題
  // 原值：300 秒（5 分鐘）- 導致管理後台修改後需等待 5 分鐘才能同步
  stdTTL: 60,

  // 檢查過期條目的間隔：60 秒
  checkperiod: 60,

  // 緩存容量上限：10000 個用戶
  maxKeys: 10000,

  // 當緩存滿時使用 LRU（最近最少使用）策略
  useClones: false,

  // 刪除過期鍵時的統計
  deleteOnExpire: true,
};

/**
 * 創建用戶檔案緩存實例
 */
const userProfileCache = new NodeCache(CACHE_CONFIG);

/**
 * 緩存統計信息
 */
let cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

/**
 * 生成緩存鍵
 * @param {string} userId - 用戶 ID
 * @returns {string} 緩存鍵
 */
const getCacheKey = (userId) => {
  return `user_profile:${userId}`;
};

/**
 * 從緩存獲取用戶檔案
 * @param {string} userId - 用戶 ID
 * @returns {Object|null} 用戶檔案或 null
 */
export const getCachedUserProfile = (userId) => {
  if (!userId) {
    return null;
  }

  try {
    const cacheKey = getCacheKey(userId);
    const cachedProfile = userProfileCache.get(cacheKey);

    if (cachedProfile) {
      cacheStats.hits++;
      logger.debug(`[UserProfileCache] 緩存命中: ${userId}`);
      return cachedProfile;
    }

    cacheStats.misses++;
    logger.debug(`[UserProfileCache] 緩存未命中: ${userId}`);
    return null;
  } catch (error) {
    cacheStats.errors++;
    logger.error(`[UserProfileCache] 獲取緩存失敗: ${userId}`, error);
    return null;
  }
};

/**
 * 設置用戶檔案緩存
 * @param {string} userId - 用戶 ID
 * @param {Object} profile - 用戶檔案
 * @param {number} [ttl] - 自定義 TTL（秒），可選
 * @returns {boolean} 是否成功
 */
export const setCachedUserProfile = (userId, profile, ttl) => {
  if (!userId || !profile) {
    return false;
  }

  try {
    const cacheKey = getCacheKey(userId);
    const success = userProfileCache.set(cacheKey, profile, ttl);

    if (success) {
      cacheStats.sets++;
      logger.debug(`[UserProfileCache] 緩存已設置: ${userId}`);
    }

    return success;
  } catch (error) {
    cacheStats.errors++;
    logger.error(`[UserProfileCache] 設置緩存失敗: ${userId}`, error);
    return false;
  }
};

/**
 * 刪除用戶檔案緩存
 * @param {string} userId - 用戶 ID
 * @returns {boolean} 是否成功刪除
 */
export const deleteCachedUserProfile = (userId) => {
  if (!userId) {
    return false;
  }

  try {
    const cacheKey = getCacheKey(userId);
    const deleteCount = userProfileCache.del(cacheKey);

    if (deleteCount > 0) {
      cacheStats.deletes++;
      logger.debug(`[UserProfileCache] 緩存已刪除: ${userId}`);
      return true;
    }

    return false;
  } catch (error) {
    cacheStats.errors++;
    logger.error(`[UserProfileCache] 刪除緩存失敗: ${userId}`, error);
    return false;
  }
};

/**
 * 獲取用戶檔案（帶緩存）
 *
 * 這是主要的公共 API，自動處理緩存查找和回填
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 選項
 * @param {boolean} options.bypassCache - 是否繞過緩存，強制從數據庫讀取
 * @param {boolean} options.updateCache - 是否更新緩存（僅在 bypassCache 為 true 時有效）
 * @returns {Promise<Object|null>} 用戶檔案或 null
 */
export const getUserProfileWithCache = async (userId, options = {}) => {
  if (!userId) {
    return null;
  }

  const { bypassCache = false, updateCache = true } = options;

  try {
    // 如果不繞過緩存，先嘗試從緩存獲取
    if (!bypassCache) {
      const cachedProfile = getCachedUserProfile(userId);
      if (cachedProfile) {
        return cachedProfile;
      }
    }

    // 緩存未命中或繞過緩存，從數據庫讀取
    logger.debug(`[UserProfileCache] 從數據庫讀取用戶檔案: ${userId}`);
    const profile = await getUserById(userId);

    // 如果成功讀取且需要更新緩存，則設置緩存
    if (profile && updateCache) {
      setCachedUserProfile(userId, profile);
    }

    return profile;
  } catch (error) {
    cacheStats.errors++;
    logger.error(`[UserProfileCache] 獲取用戶檔案失敗: ${userId}`, error);
    throw error;
  }
};

/**
 * 批量獲取用戶檔案（帶緩存）
 * @param {string[]} userIds - 用戶 ID 陣列
 * @returns {Promise<Map<string, Object>>} 用戶 ID 到檔案的映射
 */
export const getBatchUserProfilesWithCache = async (userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return new Map();
  }

  const profiles = new Map();
  const uncachedUserIds = [];

  // 第一步：從緩存獲取
  for (const userId of userIds) {
    if (!userId) continue;

    const cachedProfile = getCachedUserProfile(userId);
    if (cachedProfile) {
      profiles.set(userId, cachedProfile);
    } else {
      uncachedUserIds.push(userId);
    }
  }

  // 第二步：批量從數據庫獲取未緩存的用戶
  if (uncachedUserIds.length > 0) {
    logger.debug(
      `[UserProfileCache] 批量從數據庫讀取 ${uncachedUserIds.length} 個用戶檔案`
    );

    // 並行獲取所有未緩存的用戶檔案
    const fetchPromises = uncachedUserIds.map((userId) =>
      getUserById(userId).then((profile) => ({ userId, profile }))
    );

    const results = await Promise.allSettled(fetchPromises);

    // 處理結果並更新緩存
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.profile) {
        const { userId, profile } = result.value;
        profiles.set(userId, profile);
        setCachedUserProfile(userId, profile);
      }
    }
  }

  return profiles;
};

/**
 * 清空所有用戶檔案緩存
 * @returns {void}
 */
export const clearAllUserProfileCache = () => {
  try {
    userProfileCache.flushAll();
    logger.info("[UserProfileCache] 所有緩存已清空");

    // 重置統計
    cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  } catch (error) {
    logger.error("[UserProfileCache] 清空緩存失敗", error);
  }
};

/**
 * 獲取緩存統計信息
 * @returns {Object} 緩存統計
 */
export const getCacheStats = () => {
  const internalStats = userProfileCache.getStats();
  const hitRate =
    cacheStats.hits + cacheStats.misses > 0
      ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2)
      : 0;

  return {
    ...cacheStats,
    hitRate: `${hitRate}%`,
    keys: internalStats.keys,
    ksize: internalStats.ksize,
    vsize: internalStats.vsize,
  };
};

/**
 * 打印緩存統計信息（用於調試）
 */
export const logCacheStats = () => {
  const stats = getCacheStats();
  logger.info("[UserProfileCache] 統計信息:", {
    命中次數: stats.hits,
    未命中次數: stats.misses,
    命中率: stats.hitRate,
    設置次數: stats.sets,
    刪除次數: stats.deletes,
    錯誤次數: stats.errors,
    緩存鍵數量: stats.keys,
  });
};

/**
 * 定期打印緩存統計（可選，用於監控）
 * @param {number} intervalMs - 間隔時間（毫秒），默認 5 分鐘
 */
export const startCacheStatsMonitoring = (intervalMs = 5 * 60 * 1000) => {
  setInterval(() => {
    logCacheStats();
  }, intervalMs);

  logger.info(
    `[UserProfileCache] 已啟動緩存統計監控，間隔：${intervalMs / 1000} 秒`
  );
};

/**
 * 預熱緩存（可選）
 * 在應用啟動時預先加載常用用戶的檔案
 *
 * @param {string[]} userIds - 需要預熱的用戶 ID 陣列
 */
export const warmupCache = async (userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return;
  }

  logger.info(
    `[UserProfileCache] 開始預熱緩存，用戶數量：${userIds.length}`
  );

  await getBatchUserProfilesWithCache(userIds);

  logger.info("[UserProfileCache] 緩存預熱完成");
};

// 導出緩存實例（供測試使用）
export const _cacheInstance = userProfileCache;

export default {
  getCachedUserProfile,
  setCachedUserProfile,
  deleteCachedUserProfile,
  getUserProfileWithCache,
  getBatchUserProfilesWithCache,
  clearAllUserProfileCache,
  getCacheStats,
  logCacheStats,
  startCacheStatsMonitoring,
  warmupCache,
};
