/**
 * 冪等性處理工具
 * 確保相同請求不會重複執行，防止重複扣費
 */

import logger from "./logger.js";

/**
 * 冪等性請求緩存
 * Map<requestId, { result, expiresAt, status }>
 */
const idempotencyCache = new Map();

/**
 * 冪等性鎖
 * Map<requestId, Promise>
 */
const processingLocks = new Map();

/**
 * 預設配置
 */
const DEFAULT_CONFIG = {
  ttl: 15 * 60 * 1000, // 15 分鐘
  maxCacheSize: 10000, // 最多緩存 10000 個請求
  cleanupInterval: 5 * 60 * 1000, // 每 5 分鐘清理一次
};

let cleanupTimer = null;

/**
 * 清理過期的緩存
 */
const cleanupExpiredCache = () => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [requestId, entry] of idempotencyCache.entries()) {
    if (entry.expiresAt < now) {
      idempotencyCache.delete(requestId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info(`[冪等性] 清理了 ${cleanedCount} 個過期緩存，剩餘 ${idempotencyCache.size} 個`);
  }

  // 如果緩存過大，清理最舊的條目
  if (idempotencyCache.size > DEFAULT_CONFIG.maxCacheSize) {
    const entries = Array.from(idempotencyCache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    const toRemove = entries.slice(0, idempotencyCache.size - DEFAULT_CONFIG.maxCacheSize);
    toRemove.forEach(([requestId]) => idempotencyCache.delete(requestId));

    logger.info(`[冪等性] 緩存過大，清理了 ${toRemove.length} 個最舊的條目`);
  }
};

/**
 * 啟動定期清理
 */
export const startIdempotencyCleanup = () => {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(cleanupExpiredCache, DEFAULT_CONFIG.cleanupInterval);
  logger.info('[冪等性] 已啟動定期清理任務');
};

/**
 * 停止定期清理
 */
export const stopIdempotencyCleanup = () => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    logger.info('[冪等性] 已停止定期清理任務');
  }
};

/**
 * 處理冪等性請求
 * @param {string} requestId - 請求唯一標識
 * @param {Function} operation - 要執行的操作
 * @param {Object} options - 選項
 * @param {number} options.ttl - 緩存過期時間（毫秒）
 * @returns {Promise<Object>} 操作結果
 */
export const handleIdempotentRequest = async (requestId, operation, options = {}) => {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('請求ID必須是非空字符串');
  }

  if (typeof operation !== 'function') {
    throw new Error('操作必須是一個函數');
  }

  const ttl = options.ttl || DEFAULT_CONFIG.ttl;
  const now = Date.now();

  // 1. 檢查是否已經處理過
  const cached = idempotencyCache.get(requestId);
  if (cached) {
    // 檢查是否過期
    if (cached.expiresAt > now) {
      logger.info(`[冪等性] 請求 ${requestId} 已處理，返回緩存結果`);
      return {
        ...cached.result,
        _idempotent: true, // 標記為冪等性返回
        _cached: true,
      };
    } else {
      // 過期了，移除
      idempotencyCache.delete(requestId);
    }
  }

  // 2. 檢查是否正在處理
  const existingLock = processingLocks.get(requestId);
  if (existingLock) {
    logger.info(`[冪等性] 請求 ${requestId} 正在處理，等待結果`);
    return existingLock;
  }

  // 3. 創建處理鎖並執行操作
  const processingPromise = (async () => {
    try {
      logger.info(`[冪等性] 開始處理請求 ${requestId}`);

      // 執行實際操作
      const result = await operation();

      // 緩存成功結果
      const cacheEntry = {
        result,
        expiresAt: now + ttl,
        status: 'success',
        timestamp: new Date().toISOString(),
      };

      idempotencyCache.set(requestId, cacheEntry);
      logger.info(`[冪等性] 請求 ${requestId} 處理成功，已緩存結果`);

      return {
        ...result,
        _idempotent: false, // 標記為新執行
        _cached: false,
      };
    } catch (error) {
      logger.error(`[冪等性] 請求 ${requestId} 處理失敗:`, error);

      // 不緩存失敗結果，允許重試
      // 但可以記錄失敗，避免頻繁重試同一失敗操作
      throw error;
    } finally {
      // 移除處理鎖
      processingLocks.delete(requestId);
    }
  })();

  // 設置處理鎖
  processingLocks.set(requestId, processingPromise);

  return processingPromise;
};

/**
 * 手動清除緩存
 * @param {string} requestId - 請求ID（可選，不提供則清除所有）
 */
export const clearIdempotencyCache = (requestId = null) => {
  if (requestId) {
    idempotencyCache.delete(requestId);
    logger.info(`[冪等性] 已清除請求 ${requestId} 的緩存`);
  } else {
    const size = idempotencyCache.size;
    idempotencyCache.clear();
    logger.info(`[冪等性] 已清除所有緩存（${size} 個條目）`);
  }
};

/**
 * 獲取緩存統計
 */
export const getIdempotencyStats = () => {
  const now = Date.now();
  let validCount = 0;
  let expiredCount = 0;

  for (const entry of idempotencyCache.values()) {
    if (entry.expiresAt > now) {
      validCount++;
    } else {
      expiredCount++;
    }
  }

  return {
    total: idempotencyCache.size,
    valid: validCount,
    expired: expiredCount,
    processing: processingLocks.size,
  };
};

// 自動啟動清理
startIdempotencyCleanup();

export default {
  handleIdempotentRequest,
  clearIdempotencyCache,
  getIdempotencyStats,
  startIdempotencyCleanup,
  stopIdempotencyCleanup,
};
