/**
 * 統一的緩存管理器
 * 提供 TTL（過期時間）支持的內存緩存
 *
 * ✅ 優化點：
 * - 統一的緩存實現，減少代碼重複
 * - 自動過期清理機制
 * - 支持自定義 TTL
 * - 提供緩存統計功能
 *
 * 使用場景：
 * - 會員配置緩存（membership.service.js）
 * - 金幣套餐緩存（coins.service.js）
 * - AI 功能價格緩存
 * - 其他需要 TTL 緩存的場景
 */

import logger from "./logger.js";

export class CacheManager {
  /**
   * 創建緩存管理器實例
   * @param {Object} options - 配置選項
   * @param {number} options.ttl - 默認過期時間（毫秒），默認 60000 (1 分鐘)
   * @param {string} options.name - 緩存名稱（用於日誌）
   * @param {boolean} options.enableAutoCleanup - 是否啟用自動清理過期項，默認 true
   * @param {number} options.cleanupInterval - 自動清理間隔（毫秒），默認 5 分鐘
   */
  constructor(options = {}) {
    this.ttl = options.ttl || 60000; // 默認 1 分鐘
    this.name = options.name || "Cache";
    this.enableAutoCleanup = options.enableAutoCleanup !== false;
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 默認 5 分鐘

    // 存儲數據和過期時間
    this.cache = new Map();
    this.expiryMap = new Map();

    // 統計數據
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expirations: 0,
    };

    // 啟動自動清理
    if (this.enableAutoCleanup) {
      this.startAutoCleanup();
    }

    logger.info(`[CacheManager] ${this.name} 已初始化 (TTL: ${this.ttl}ms)`);
  }

  /**
   * 獲取緩存值
   * @param {string} key - 緩存鍵
   * @returns {*} 緩存值，如果不存在或已過期則返回 null
   */
  get(key) {
    const now = Date.now();
    const expiry = this.expiryMap.get(key);

    // 檢查是否存在且未過期
    if (expiry && now < expiry) {
      this.stats.hits++;
      return this.cache.get(key);
    }

    // 已過期或不存在
    if (expiry) {
      // 已過期，清理
      this.cache.delete(key);
      this.expiryMap.delete(key);
      this.stats.expirations++;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 設置緩存值
   * @param {string} key - 緩存鍵
   * @param {*} value - 緩存值
   * @param {number} [customTTL] - 自定義 TTL（毫秒），不提供則使用默認 TTL
   */
  set(key, value, customTTL = null) {
    const ttl = customTTL !== null ? customTTL : this.ttl;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, value);
    this.expiryMap.set(key, expiresAt);
    this.stats.sets++;
  }

  /**
   * 檢查緩存鍵是否存在且未過期
   * @param {string} key - 緩存鍵
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * 刪除緩存項
   * @param {string} key - 緩存鍵。如果不提供，則清除所有緩存
   */
  delete(key = null) {
    if (key) {
      const deleted = this.cache.delete(key);
      this.expiryMap.delete(key);
      if (deleted) {
        this.stats.deletes++;
      }
    } else {
      // 清除所有緩存
      this.cache.clear();
      this.expiryMap.clear();
      logger.info(`[CacheManager] ${this.name} 已清除所有緩存`);
    }
  }

  /**
   * 清除所有緩存（別名方法）
   */
  clear() {
    this.delete();
  }

  /**
   * 獲取緩存大小
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }

  /**
   * 獲取所有緩存鍵
   * @returns {string[]}
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * 獲取所有有效的緩存項（未過期）
   * @returns {Map}
   */
  getAll() {
    const now = Date.now();
    const validEntries = new Map();

    for (const [key, expiry] of this.expiryMap.entries()) {
      if (now < expiry) {
        validEntries.set(key, this.cache.get(key));
      }
    }

    return validEntries;
  }

  /**
   * 手動清理所有過期的緩存項
   * @returns {number} 清理的項目數量
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, expiry] of this.expiryMap.entries()) {
      if (now >= expiry) {
        this.cache.delete(key);
        this.expiryMap.delete(key);
        cleaned++;
        this.stats.expirations++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[CacheManager] ${this.name} 清理了 ${cleaned} 個過期項`);
    }

    return cleaned;
  }

  /**
   * 啟動自動清理定時器
   */
  startAutoCleanup() {
    if (this.cleanupTimer) {
      return; // 已經啟動
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    // 確保 Node.js 進程退出時清理定時器
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    logger.debug(`[CacheManager] ${this.name} 自動清理已啟動 (間隔: ${this.cleanupInterval}ms)`);
  }

  /**
   * 停止自動清理定時器
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.debug(`[CacheManager] ${this.name} 自動清理已停止`);
    }
  }

  /**
   * 獲取緩存統計信息
   * @returns {Object}
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      name: this.name,
      size: this.size(),
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      expirations: this.stats.expirations,
      hitRate: `${hitRate}%`,
      ttl: this.ttl,
    };
  }

  /**
   * 重置統計數據
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expirations: 0,
    };
  }

  /**
   * 銷毀緩存管理器（清理所有資源）
   */
  destroy() {
    this.stopAutoCleanup();
    this.clear();
    logger.info(`[CacheManager] ${this.name} 已銷毀`);
  }
}

/**
 * 創建一個新的緩存管理器實例
 * @param {Object} options - 配置選項
 * @returns {CacheManager}
 */
export const createCacheManager = (options) => {
  return new CacheManager(options);
};

/**
 * 預設的緩存管理器實例（全局共享）
 * 用於不需要自定義配置的場景
 */
export const defaultCache = new CacheManager({
  name: "DefaultCache",
  ttl: 60000, // 1 分鐘
});

export default CacheManager;
