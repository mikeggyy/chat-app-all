/**
 * Firestore 快取層 - 減少資料庫讀取成本
 *
 * 使用場景：
 * - 角色資料（characters）- 變動少，讀取頻繁
 * - 系統配置（gifts, membership_tiers）- 幾乎不變
 * - 會員資料 - 變動少
 *
 * 成本節省：可減少 70-90% 的 Firestore 讀取次數
 */

import NodeCache from 'node-cache';

// 配置不同資料類型的快取時間（秒）
const CACHE_TTL = {
  CHARACTERS: 60 * 60,        // 1 小時（角色資料很少變動）
  SYSTEM_CONFIG: 60 * 60 * 24, // 24 小時（系統配置幾乎不變）
  USER_PROFILE: 60 * 5,        // 5 分鐘（用戶資料可能變動）
  MEMBERSHIP: 60 * 10,         // 10 分鐘（會員狀態中等變動）
};

// 建立快取實例
const cache = new NodeCache({
  stdTTL: CACHE_TTL.SYSTEM_CONFIG,
  checkperiod: 120, // 每 2 分鐘檢查過期項目
  useClones: false, // 不複製物件，提高效能
  maxKeys: 1000,    // 最多快取 1000 個項目
});

/**
 * 取得快取資料，如果不存在則執行 fetcher 函數
 * @param {string} key - 快取鍵
 * @param {Function} fetcher - 取得資料的函數
 * @param {number} ttl - 快取時間（秒）
 * @returns {Promise<any>}
 */
export async function getCached(key, fetcher, ttl = CACHE_TTL.SYSTEM_CONFIG) {
  // 檢查快取
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // 快取未命中，執行 fetcher
  const data = await fetcher();

  // 儲存到快取
  cache.set(key, data, ttl);

  return data;
}

/**
 * 手動設置快取
 */
export function setCache(key, value, ttl = CACHE_TTL.SYSTEM_CONFIG) {
  cache.set(key, value, ttl);
}

/**
 * 清除特定快取
 */
export function clearCache(key) {
  cache.del(key);
}

/**
 * 清除所有快取
 */
export function clearAllCache() {
  cache.flushAll();
}

/**
 * 取得快取統計資訊
 */
export function getCacheStats() {
  return cache.getStats();
}

export { CACHE_TTL };
