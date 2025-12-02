/**
 * 統一緩存註冊表
 * ✅ 2025-12-02 新增：集中管理所有緩存實例，提供統一的監控和管理功能
 *
 * 功能：
 * - 註冊和管理所有緩存實例
 * - 提供全局緩存統計
 * - 支持按名稱獲取緩存
 * - 批量清理和重置功能
 * - 監控端點支持
 */

import logger from "./logger.js";
import { CacheManager } from "./CacheManager.js";
import { LRUCache } from "./LRUCache.js";

/**
 * 緩存類型枚舉
 */
export const CACHE_TYPES = {
  TTL: "ttl",       // CacheManager 類型（帶 TTL）
  LRU: "lru",       // LRUCache 類型（帶最大容量）
};

/**
 * 預定義的緩存配置
 * 用於標準化各服務的緩存設置
 */
export const CACHE_CONFIGS = {
  // 配置類緩存（較長 TTL）
  CONFIG: {
    type: CACHE_TYPES.TTL,
    ttl: 5 * 60 * 1000,  // 5 分鐘
    name: "ConfigCache",
  },

  // 用戶數據緩存（中等 TTL）
  USER_DATA: {
    type: CACHE_TYPES.LRU,
    maxSize: 1000,
    ttl: 60 * 1000,  // 1 分鐘
    updateAgeOnGet: true,
    name: "UserDataCache",
  },

  // 限制狀態緩存（較短 TTL）
  LIMIT_STATUS: {
    type: CACHE_TYPES.LRU,
    maxSize: 5000,
    ttl: 60 * 1000,  // 1 分鐘
    updateAgeOnGet: true,
    name: "LimitStatusCache",
  },

  // 角色數據緩存（較長 TTL，啟動時預加載）
  CHARACTER: {
    type: CACHE_TYPES.TTL,
    ttl: 30 * 60 * 1000,  // 30 分鐘
    name: "CharacterCache",
  },

  // 圖片緩存（大容量，較長 TTL）
  IMAGE: {
    type: CACHE_TYPES.LRU,
    maxSize: 200,
    ttl: 60 * 60 * 1000,  // 1 小時
    updateAgeOnGet: true,
    name: "ImageCache",
  },

  // AI 功能價格緩存
  AI_FEATURE_PRICES: {
    type: CACHE_TYPES.TTL,
    ttl: 60 * 1000,  // 1 分鐘
    name: "AIFeaturePricesCache",
  },

  // 金幣套餐緩存
  COIN_PACKAGES: {
    type: CACHE_TYPES.TTL,
    ttl: 60 * 1000,  // 1 分鐘
    name: "CoinPackagesCache",
  },

  // 會員配置緩存
  MEMBERSHIP: {
    type: CACHE_TYPES.TTL,
    ttl: 60 * 1000,  // 1 分鐘
    name: "MembershipCache",
  },
};

/**
 * 緩存註冊表類
 */
class CacheRegistry {
  constructor() {
    this.caches = new Map();
    this.createdAt = new Date().toISOString();
    logger.info("[CacheRegistry] 緩存註冊表已初始化");
  }

  /**
   * 註冊緩存實例
   * @param {string} name - 緩存名稱
   * @param {Object} cache - 緩存實例（CacheManager 或 LRUCache）
   * @param {Object} metadata - 元數據
   */
  register(name, cache, metadata = {}) {
    if (this.caches.has(name)) {
      logger.warn(`[CacheRegistry] 緩存 "${name}" 已存在，將被覆蓋`);
    }

    this.caches.set(name, {
      cache,
      type: cache instanceof LRUCache ? CACHE_TYPES.LRU : CACHE_TYPES.TTL,
      registeredAt: new Date().toISOString(),
      ...metadata,
    });

    logger.info(`[CacheRegistry] 已註冊緩存: ${name}`);
    return cache;
  }

  /**
   * 根據配置創建並註冊緩存
   * @param {string} configName - CACHE_CONFIGS 中的配置名稱
   * @param {string} customName - 自定義名稱（可選）
   * @returns {Object} 創建的緩存實例
   */
  createFromConfig(configName, customName = null) {
    const config = CACHE_CONFIGS[configName];
    if (!config) {
      throw new Error(`未知的緩存配置: ${configName}`);
    }

    const name = customName || config.name;

    let cache;
    if (config.type === CACHE_TYPES.LRU) {
      cache = new LRUCache(
        config.maxSize,
        config.ttl,
        config.updateAgeOnGet || false
      );
    } else {
      cache = new CacheManager({
        name,
        ttl: config.ttl,
        enableAutoCleanup: true,
      });
    }

    return this.register(name, cache, { configName });
  }

  /**
   * 獲取緩存實例
   * @param {string} name - 緩存名稱
   * @returns {Object|null} 緩存實例
   */
  get(name) {
    const entry = this.caches.get(name);
    return entry ? entry.cache : null;
  }

  /**
   * 獲取或創建緩存
   * @param {string} name - 緩存名稱
   * @param {Object} options - 創建選項（如果需要創建）
   * @returns {Object} 緩存實例
   */
  getOrCreate(name, options = {}) {
    let cache = this.get(name);
    if (!cache) {
      const { type = CACHE_TYPES.TTL, ...config } = options;

      if (type === CACHE_TYPES.LRU) {
        cache = new LRUCache(
          config.maxSize || 100,
          config.ttl || 0,
          config.updateAgeOnGet || false
        );
      } else {
        cache = new CacheManager({
          name,
          ttl: config.ttl || 60000,
          enableAutoCleanup: true,
        });
      }

      this.register(name, cache, { autoCreated: true });
    }

    return cache;
  }

  /**
   * 檢查緩存是否存在
   * @param {string} name - 緩存名稱
   * @returns {boolean}
   */
  has(name) {
    return this.caches.has(name);
  }

  /**
   * 移除緩存
   * @param {string} name - 緩存名稱
   * @returns {boolean} 是否成功移除
   */
  unregister(name) {
    const entry = this.caches.get(name);
    if (entry) {
      // 清理緩存資源
      if (entry.cache.destroy) {
        entry.cache.destroy();
      } else if (entry.cache.clear) {
        entry.cache.clear();
      }

      this.caches.delete(name);
      logger.info(`[CacheRegistry] 已移除緩存: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 獲取所有緩存名稱
   * @returns {string[]}
   */
  listCaches() {
    return Array.from(this.caches.keys());
  }

  /**
   * 獲取所有緩存的統計信息
   * @returns {Object}
   */
  getAllStats() {
    const stats = {
      registryCreatedAt: this.createdAt,
      totalCaches: this.caches.size,
      caches: {},
      summary: {
        totalSize: 0,
        totalHits: 0,
        totalMisses: 0,
      },
    };

    for (const [name, entry] of this.caches.entries()) {
      const cacheStats = entry.cache.getStats
        ? entry.cache.getStats()
        : { size: entry.cache.size || 0 };

      stats.caches[name] = {
        type: entry.type,
        registeredAt: entry.registeredAt,
        ...cacheStats,
      };

      // 累計統計
      stats.summary.totalSize += cacheStats.size || 0;
      stats.summary.totalHits += cacheStats.hits || 0;
      stats.summary.totalMisses += cacheStats.misses || 0;
    }

    // 計算總體命中率
    const totalRequests = stats.summary.totalHits + stats.summary.totalMisses;
    stats.summary.overallHitRate = totalRequests > 0
      ? `${((stats.summary.totalHits / totalRequests) * 100).toFixed(2)}%`
      : "N/A";

    return stats;
  }

  /**
   * 清除所有緩存
   */
  clearAll() {
    let clearedCount = 0;

    for (const [name, entry] of this.caches.entries()) {
      if (entry.cache.clear) {
        entry.cache.clear();
        clearedCount++;
        logger.debug(`[CacheRegistry] 已清除緩存: ${name}`);
      }
    }

    logger.info(`[CacheRegistry] 已清除 ${clearedCount} 個緩存`);
    return { clearedCount };
  }

  /**
   * 清除特定緩存
   * @param {string} name - 緩存名稱
   * @returns {boolean} 是否成功清除
   */
  clearCache(name) {
    const entry = this.caches.get(name);
    if (entry && entry.cache.clear) {
      entry.cache.clear();
      logger.info(`[CacheRegistry] 已清除緩存: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 重置所有統計數據
   */
  resetAllStats() {
    for (const [name, entry] of this.caches.entries()) {
      if (entry.cache.resetStats) {
        entry.cache.resetStats();
      } else if (entry.cache instanceof LRUCache) {
        entry.cache.hits = 0;
        entry.cache.misses = 0;
      }
    }

    logger.info("[CacheRegistry] 已重置所有緩存統計");
  }

  /**
   * 執行所有緩存的清理（清除過期項）
   */
  cleanupAll() {
    let totalCleaned = 0;

    for (const [name, entry] of this.caches.entries()) {
      if (entry.cache.cleanup) {
        const cleaned = entry.cache.cleanup();
        totalCleaned += cleaned || 0;
      }
    }

    if (totalCleaned > 0) {
      logger.info(`[CacheRegistry] 共清理 ${totalCleaned} 個過期項`);
    }

    return { totalCleaned };
  }

  /**
   * 銷毀所有緩存（用於應用關閉時）
   */
  destroyAll() {
    for (const [name, entry] of this.caches.entries()) {
      if (entry.cache.destroy) {
        entry.cache.destroy();
      } else if (entry.cache.clear) {
        entry.cache.clear();
      }
    }

    this.caches.clear();
    logger.info("[CacheRegistry] 已銷毀所有緩存");
  }
}

// 創建全局單例
export const cacheRegistry = new CacheRegistry();

// 導出便捷方法
export const registerCache = (name, cache, metadata) =>
  cacheRegistry.register(name, cache, metadata);

export const getCache = (name) => cacheRegistry.get(name);

export const getCacheOrCreate = (name, options) =>
  cacheRegistry.getOrCreate(name, options);

export const getAllCacheStats = () => cacheRegistry.getAllStats();

export const clearAllCaches = () => cacheRegistry.clearAll();

export default cacheRegistry;
