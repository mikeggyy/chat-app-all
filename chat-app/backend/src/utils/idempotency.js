/**
 * 冪等性處理工具 (Firestore 版本)
 * 確保相同請求不會重複執行，防止重複扣費
 *
 * 修復說明:
 * - 將內存緩存改為 Firestore 存儲，支持多服務器環境
 * - 使用 Firestore Transaction 確保原子性
 * - 保留本地鎖處理單服務器並發
 * - 自動清理過期記錄
 */

import logger from "./logger.js";
import { getFirestoreDb, FieldValue } from "../firebase/index.js";

/**
 * 本地處理鎖（防止同一服務器的重複請求）
 * Map<requestId, Promise>
 */
const processingLocks = new Map();

/**
 * 本地緩存（L1緩存，減少 Firestore 讀取）
 * Map<requestId, { result, expiresAt }>
 */
const localCache = new Map();

/**
 * 預設配置
 */
const DEFAULT_CONFIG = {
  ttl: 24 * 60 * 60 * 1000, // 24 小時（Firestore 存儲可以更長）
  localCacheTtl: 5 * 60 * 1000, // 本地緩存 5 分鐘
  cleanupInterval: 60 * 60 * 1000, // 每小時清理一次過期記錄
  collectionName: 'idempotency_keys',
};

let cleanupTimer = null;

/**
 * 清理過期的 Firestore 記錄
 */
const cleanupExpiredRecords = async () => {
  try {
    const db = getFirestoreDb();
    const now = Date.now();

    // 查詢過期記錄（最多 500 條）
    const snapshot = await db.collection(DEFAULT_CONFIG.collectionName)
      .where('expiresAt', '<', now)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return;
    }

    // 批量刪除
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    logger.info(`[冪等性-Firestore] 清理了 ${snapshot.size} 個過期記錄`);
  } catch (error) {
    logger.error('[冪等性-Firestore] 清理過期記錄失敗:', error);
  }

  // 清理本地緩存
  const now = Date.now();
  let cleanedCount = 0;
  for (const [requestId, entry] of localCache.entries()) {
    if (entry.expiresAt < now) {
      localCache.delete(requestId);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    logger.info(`[冪等性-本地] 清理了 ${cleanedCount} 個過期本地緩存`);
  }
};

/**
 * 啟動定期清理
 */
export const startIdempotencyCleanup = () => {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(cleanupExpiredRecords, DEFAULT_CONFIG.cleanupInterval);
  logger.info('[冪等性] 已啟動定期清理任務（Firestore 模式）');
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
 * 處理冪等性請求（Firestore 版本）
 * @param {string} requestId - 請求唯一標識
 * @param {Function} operation - 要執行的操作
 * @param {Object} options - 選項
 * @param {number} options.ttl - 緩存過期時間（毫秒）
 * @param {boolean} options.useLocalCache - 是否使用本地緩存（默認 true）
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
  const useLocalCache = options.useLocalCache !== false;
  const now = Date.now();
  const db = getFirestoreDb();
  const idempotencyRef = db.collection(DEFAULT_CONFIG.collectionName).doc(requestId);

  // 1. 檢查本地緩存（L1）
  if (useLocalCache) {
    const localCached = localCache.get(requestId);
    if (localCached && localCached.expiresAt > now) {
      logger.info(`[冪等性-本地] 請求 ${requestId.substring(0, 20)}... 已處理，返回本地緩存`);
      return {
        ...localCached.result,
        _idempotent: true,
        _cached: true,
        _source: 'local',
      };
    }
  }

  // 2. 檢查是否正在處理（同一服務器）
  const existingLock = processingLocks.get(requestId);
  if (existingLock) {
    logger.info(`[冪等性-鎖] 請求 ${requestId.substring(0, 20)}... 正在處理，等待結果`);
    return existingLock;
  }

  // 3. 創建處理鎖並執行操作
  const processingPromise = (async () => {
    try {
      // 3.1 檢查 Firestore 中是否已存在（跨服務器檢查）
      const doc = await idempotencyRef.get();

      if (doc.exists) {
        const data = doc.data();

        // 檢查是否過期
        if (data.expiresAt > now) {
          logger.info(`[冪等性-Firestore] 請求 ${requestId.substring(0, 20)}... 已處理，返回 Firestore 結果`);

          const result = {
            ...data.result,
            _idempotent: true,
            _cached: true,
            _source: 'firestore',
          };

          // 更新本地緩存
          if (useLocalCache) {
            localCache.set(requestId, {
              result: data.result,
              expiresAt: now + DEFAULT_CONFIG.localCacheTtl,
            });
          }

          return result;
        } else {
          // 過期了，刪除舊記錄
          await idempotencyRef.delete();
          logger.info(`[冪等性-Firestore] 請求 ${requestId.substring(0, 20)}... 已過期，刪除舊記錄`);
        }
      }

      // 3.2 使用 Transaction 執行操作並存儲結果
      logger.info(`[冪等性] 開始處理新請求 ${requestId.substring(0, 20)}...`);

      const result = await db.runTransaction(async (transaction) => {
        // 再次檢查是否已存在（防止並發）
        const freshDoc = await transaction.get(idempotencyRef);

        if (freshDoc.exists) {
          const data = freshDoc.data();
          if (data.expiresAt > now) {
            logger.info(`[冪等性-Transaction] 請求 ${requestId.substring(0, 20)}... 已被其他服務器處理`);
            return {
              ...data.result,
              _idempotent: true,
              _cached: true,
              _source: 'firestore-concurrent',
            };
          }
        }

        // 執行實際操作
        const opResult = await operation();

        // 存儲結果到 Firestore
        const idempotencyData = {
          result: opResult,
          expiresAt: now + ttl,
          status: 'success',
          createdAt: FieldValue.serverTimestamp(),
          timestamp: new Date().toISOString(),
        };

        transaction.set(idempotencyRef, idempotencyData);

        logger.info(`[冪等性] 請求 ${requestId.substring(0, 20)}... 處理成功，已存儲到 Firestore`);

        return {
          ...opResult,
          _idempotent: false,
          _cached: false,
          _source: 'fresh',
        };
      });

      // 更新本地緩存
      if (useLocalCache && result._source === 'fresh') {
        localCache.set(requestId, {
          result: { ...result },
          expiresAt: now + DEFAULT_CONFIG.localCacheTtl,
        });
      }

      return result;

    } catch (error) {
      logger.error(`[冪等性] 請求 ${requestId.substring(0, 20)}... 處理失敗:`, error);

      // 不緩存失敗結果，允許重試
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
 * 手動清除緩存（Firestore + 本地）
 * @param {string} requestId - 請求ID（可選，不提供則清除本地緩存）
 */
export const clearIdempotencyCache = async (requestId = null) => {
  const db = getFirestoreDb();

  if (requestId) {
    // 清除特定請求的緩存
    localCache.delete(requestId);

    try {
      await db.collection(DEFAULT_CONFIG.collectionName).doc(requestId).delete();
      logger.info(`[冪等性] 已清除請求 ${requestId.substring(0, 20)}... 的緩存（Firestore + 本地）`);
    } catch (error) {
      logger.error(`[冪等性] 清除 Firestore 緩存失敗:`, error);
    }
  } else {
    // 清除所有本地緩存（不清除 Firestore，避免意外）
    const size = localCache.size;
    localCache.clear();
    logger.info(`[冪等性] 已清除所有本地緩存（${size} 個條目）`);
    logger.warn('[冪等性] 注意：Firestore 中的記錄未清除，會在過期後自動清理');
  }
};

/**
 * 獲取緩存統計
 */
export const getIdempotencyStats = async () => {
  const now = Date.now();
  const db = getFirestoreDb();

  // 本地緩存統計
  let localValidCount = 0;
  let localExpiredCount = 0;

  for (const entry of localCache.values()) {
    if (entry.expiresAt > now) {
      localValidCount++;
    } else {
      localExpiredCount++;
    }
  }

  // Firestore 統計（採樣，避免全表掃描）
  let firestoreCount = 0;
  try {
    const snapshot = await db.collection(DEFAULT_CONFIG.collectionName)
      .limit(1000)
      .count()
      .get();
    firestoreCount = snapshot.data().count;
  } catch (error) {
    logger.error('[冪等性] 獲取 Firestore 統計失敗:', error);
  }

  return {
    local: {
      total: localCache.size,
      valid: localValidCount,
      expired: localExpiredCount,
    },
    firestore: {
      count: firestoreCount,
      note: '如果超過 1000，顯示為採樣值',
    },
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
