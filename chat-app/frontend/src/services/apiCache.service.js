import { reactive } from 'vue';
import { logger } from '../utils/logger.js';

/**
 * 統一的 API 緩存服務
 * 提供長期數據緩存，減少重複的 API 請求
 *
 * 特性：
 * - 自動過期清理
 * - 防止請求競爭（同一請求只執行一次）
 * - 支持模式匹配清除緩存
 * - 響應式緩存（Vue reactive）
 *
 * @example
 * ```js
 * import { apiCache, cacheKeys } from '@/services/apiCache.service';
 *
 * // 使用緩存包裝 API 調用
 * const character = await apiCache.fetch(
 *   cacheKeys.character(characterId),
 *   () => apiJson(`/match/${characterId}`),
 *   5 * 60 * 1000 // 5 分鐘緩存
 * );
 *
 * // 清除特定緩存
 * apiCache.clear('character:123');
 *
 * // 清除所有角色緩存
 * apiCache.clear(/^character:/);
 * ```
 */
class ApiCacheService {
  constructor() {
    // 響應式緩存存儲，可用於 Vue 組件
    this.cache = reactive(new Map());

    // 緩存時間戳
    this.timestamps = new Map();

    // 進行中的請求（防止重複請求）
    this.pendingRequests = new Map();

    // 統計信息
    this.stats = reactive({
      hits: 0,      // 緩存命中次數
      misses: 0,    // 緩存未命中次數
      sets: 0,      // 設置緩存次數
      clears: 0,    // 清除緩存次數
    });

    // 自動清理定時器
    this.cleanupInterval = null;
    this.startAutoCleanup();
  }

  /**
   * 獲取緩存數據
   * @param {string} key - 緩存鍵
   * @param {number} ttl - 緩存過期時間（毫秒）
   * @returns {any|null} - 緩存的數據或 null
   */
  get(key, ttl = 5 * 60 * 1000) {
    const cached = this.cache.get(key);
    const timestamp = this.timestamps.get(key);

    if (cached !== undefined && timestamp) {
      const age = Date.now() - timestamp;

      if (age < ttl) {
        this.stats.hits++;
        logger.debug(`[API Cache] ✅ 命中: ${key} (age: ${Math.round(age / 1000)}s)`);
        return cached;
      }

      // 過期，清除
      this.delete(key);
      logger.debug(`[API Cache] ⏱️ 過期: ${key} (age: ${Math.round(age / 1000)}s)`);
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 設置緩存數據
   * @param {string} key - 緩存鍵
   * @param {any} value - 要緩存的數據
   */
  set(key, value) {
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
    this.stats.sets++;
    logger.debug(`[API Cache] 💾 設置: ${key}`);
  }

  /**
   * 刪除單個緩存
   * @param {string} key - 緩存鍵
   */
  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  /**
   * 帶去重和緩存的 API 調用
   *
   * 工作流程：
   * 1. 檢查緩存，如果未過期則返回
   * 2. 檢查是否有進行中的相同請求，有則等待並返回相同結果
   * 3. 發起新請求，完成後緩存結果
   *
   * @param {string} key - 緩存鍵
   * @param {Function} fetcher - API 調用函數，返回 Promise
   * @param {number} ttl - 緩存時間（毫秒），默認 5 分鐘
   * @returns {Promise<any>}
   */
  async fetch(key, fetcher, ttl = 5 * 60 * 1000) {
    // 1. 檢查緩存
    const cached = this.get(key, ttl);
    if (cached !== null) {
      return cached;
    }

    // 2. 檢查是否有進行中的請求
    const pending = this.pendingRequests.get(key);
    if (pending) {
      logger.debug(`[API Cache] ⏳ 等待進行中的請求: ${key}`);
      return pending;
    }

    // 3. 發起新請求
    logger.debug(`[API Cache] 🌐 發起新請求: ${key}`);

    const promise = fetcher()
      .then(data => {
        this.set(key, data);
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        // 請求失敗，清理並拋出錯誤
        this.pendingRequests.delete(key);
        logger.error(`[API Cache] ❌ 請求失敗: ${key}`, error);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * 清除匹配的緩存
   *
   * @param {string|RegExp|null} pattern - 匹配模式
   *   - string: 包含該字符串的鍵
   *   - RegExp: 匹配正則的鍵
   *   - null/undefined: 清除所有緩存
   *
   * @example
   * ```js
   * // 清除所有緩存
   * apiCache.clear();
   *
   * // 清除特定緩存
   * apiCache.clear('character:123');
   *
   * // 清除所有角色緩存
   * apiCache.clear(/^character:/);
   *
   * // 清除多個用戶的緩存
   * apiCache.clear(/^user:(abc|def|xyz)/);
   * ```
   */
  clear(pattern) {
    if (!pattern) {
      const count = this.cache.size;
      this.cache.clear();
      this.timestamps.clear();
      this.stats.clears += count;
      logger.debug(`[API Cache] 🧹 清除所有緩存 (${count} 項)`);
      return;
    }

    const isRegex = pattern instanceof RegExp;
    const keys = Array.from(this.cache.keys());
    let cleared = 0;

    for (const key of keys) {
      const shouldDelete = isRegex
        ? pattern.test(key)
        : key.includes(pattern);

      if (shouldDelete) {
        this.delete(key);
        cleared++;
        logger.debug(`[API Cache] 🧹 清除: ${key}`);
      }
    }

    this.stats.clears += cleared;

    if (cleared > 0) {
      logger.debug(`[API Cache] 🧹 清除完成，共 ${cleared} 項`);
    }
  }

  /**
   * 啟動自動清理
   * 每 5 分鐘檢查一次，清理超過最大 TTL 的緩存
   */
  startAutoCleanup() {
    if (this.cleanupInterval) {
      return;
    }

    // 最大 TTL 設為 60 分鐘，超過這個時間的緩存必定過期
    const MAX_TTL = 60 * 60 * 1000;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keys = Array.from(this.timestamps.keys());
      let cleaned = 0;

      for (const key of keys) {
        const timestamp = this.timestamps.get(key);
        if (timestamp && now - timestamp > MAX_TTL) {
          this.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug(`[API Cache] 🧹 自動清理: 移除 ${cleaned} 個過期緩存`);
      }
    }, 5 * 60 * 1000); // 每 5 分鐘
  }

  /**
   * 停止自動清理
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 獲取緩存統計信息
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      pending: this.pendingRequests.size,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * 重置統計信息
   */
  resetStats() {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.clears = 0;
  }

  /**
   * 預熱緩存
   * 預先加載常用數據
   * @param {Array<{key: string, fetcher: Function, ttl?: number}>} items
   */
  async warmup(items) {
    logger.debug(`[API Cache] 🔥 開始預熱 ${items.length} 個緩存項`);

    const promises = items.map(({ key, fetcher, ttl }) =>
      this.fetch(key, fetcher, ttl).catch(error => {
        logger.warn(`[API Cache] ⚠️ 預熱失敗: ${key}`, error);
        return null;
      })
    );

    await Promise.all(promises);
    logger.debug(`[API Cache] 🔥 預熱完成`);
  }
}

/**
 * 單例實例
 */
export const apiCache = new ApiCacheService();

/**
 * 預定義的緩存鍵生成器
 * 統一管理緩存鍵的命名規範
 */
export const cacheKeys = {
  /**
   * 角色緩存
   * @param {string} characterId - 角色 ID
   * @returns {string} 緩存鍵
   */
  character: (characterId) => `character:${characterId}`,

  /**
   * 對話緩存
   * @param {string} userId - 用戶 ID
   * @param {string} characterId - 角色 ID
   * @returns {string} 緩存鍵
   */
  conversation: (userId, characterId) => `conversation:${userId}:${characterId}`,

  /**
   * 用戶資料緩存
   * @param {string} userId - 用戶 ID
   * @returns {string} 緩存鍵
   */
  userProfile: (userId) => `user:${userId}`,

  /**
   * 排名列表緩存
   * @param {string} type - 排名類型（hot, new, etc）
   * @returns {string} 緩存鍵
   */
  ranking: (type = 'all') => `ranking:${type}`,

  /**
   * 匹配列表緩存
   * @param {Object} params - 查詢參數
   * @returns {string} 緩存鍵
   */
  matches: (params = {}) => {
    const paramsStr = Object.keys(params).length > 0
      ? JSON.stringify(params)
      : 'all';
    return `matches:${paramsStr}`;
  },

  /**
   * 會員資訊緩存
   * @param {string} userId - 用戶 ID
   * @returns {string} 緩存鍵
   */
  membership: (userId) => `membership:${userId}`,

  /**
   * 語音列表緩存
   * @returns {string} 緩存鍵
   */
  voices: () => 'voices:all',

  /**
   * 系統配置緩存
   * @param {string} configKey - 配置鍵
   * @returns {string} 緩存鍵
   */
  config: (configKey) => `config:${configKey}`,

  /**
   * 禮物列表緩存
   * @returns {string} 緩存鍵
   */
  gifts: () => 'gifts:all',

  /**
   * 照片相簿緩存
   * @param {string} characterId - 角色 ID
   * @returns {string} 緩存鍵
   */
  photoAlbum: (characterId) => `photo-album:${characterId}`,
};

/**
 * TTL 配置（毫秒）
 * 根據數據變化頻率設定不同的緩存時間
 */
export const cacheTTL = {
  // 角色數據變化較少，可以緩存較長時間
  CHARACTER: 10 * 60 * 1000,      // 10 分鐘

  // 用戶資料可能經常變化（錢包、會員等）
  USER_PROFILE: 2 * 60 * 1000,    // 2 分鐘

  // 會員資訊相對穩定
  MEMBERSHIP: 5 * 60 * 1000,      // 5 分鐘

  // 排名列表變化頻繁，緩存時間短
  RANKING: 1 * 60 * 1000,         // 1 分鐘

  // 匹配列表可以緩存較長時間
  MATCHES: 5 * 60 * 1000,         // 5 分鐘

  // 系統配置幾乎不變
  CONFIG: 30 * 60 * 1000,         // 30 分鐘

  // 語音列表、禮物列表等靜態數據
  STATIC_DATA: 30 * 60 * 1000,    // 30 分鐘

  // 照片相簿可能經常更新
  PHOTO_ALBUM: 3 * 60 * 1000,     // 3 分鐘
};

/**
 * 開發環境工具
 * 在瀏覽器控制台中暴露緩存服務，方便調試
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__apiCache = apiCache;
  window.__cacheKeys = cacheKeys;
  window.__cacheTTL = cacheTTL;

  logger.debug('[API Cache] 🛠️ 開發工具已啟用，可在控制台使用:');
  logger.debug('  - window.__apiCache.getStats() - 查看統計');
  logger.debug('  - window.__apiCache.clear() - 清除所有緩存');
  logger.debug('  - window.__apiCache.clear(/pattern/) - 清除匹配緩存');
}
