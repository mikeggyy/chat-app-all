/**
 * 指數退避重試工具
 * 用於處理 429 配額超限錯誤
 */

import logger from "./logger.js";

/**
 * 使用指數退避策略重試函數
 * @param {Function} fn - 要重試的異步函數
 * @param {object} options - 選項
 * @param {number} options.maxRetries - 最大重試次數（預設 3）
 * @param {number} options.baseDelay - 基礎延遲（毫秒，預設 1000）
 * @param {number} options.maxDelay - 最大延遲（毫秒，預設 10000）
 * @param {Function} options.shouldRetry - 判斷是否應重試的函數
 * @param {Function} options.onRetry - 重試前的回調函數
 * @returns {Promise<any>} - 函數執行結果
 */
export async function retryWithExponentialBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => {
      // 預設：只重試 429 錯誤
      return error.message && error.message.includes("429");
    },
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 執行函數
      const result = await fn();

      // 如果之前有重試，記錄成功
      if (attempt > 0) {
        logger.info(`[重試] 第 ${attempt + 1} 次嘗試成功`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // 檢查是否應該重試
      const canRetry = attempt < maxRetries - 1;
      const willRetry = canRetry && shouldRetry(error);

      if (!willRetry) {
        // 不應重試或重試次數用盡，拋出錯誤
        throw error;
      }

      // 計算延遲時間（指數增長 + 隨機抖動）
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = Math.random() * 1000; // 0-1000ms 隨機抖動
      const delay = exponentialDelay + jitter;

      logger.warn(
        `[重試] 嘗試 ${attempt + 1}/${maxRetries} 失敗: ${error.message}`
      );
      logger.info(`[重試] ${Math.round(delay)}ms 後重試...`);

      // 執行重試前的回調（如果有）
      if (onRetry) {
        try {
          await onRetry(error, attempt, delay);
        } catch (callbackError) {
          logger.error(`[重試] 回調函數執行失敗:`, callbackError);
        }
      }

      // 等待後重試
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 所有重試都失敗，拋出最後一個錯誤
  throw lastError;
}

/**
 * 專門用於 VEO API 的重試函數
 * @param {Function} fn - VEO API 調用函數
 * @returns {Promise<any>}
 */
export async function retryVeoApiCall(fn) {
  return retryWithExponentialBackoff(fn, {
    maxRetries: 3,
    baseDelay: 2000, // VEO 生成較慢，使用較長的延遲
    maxDelay: 16000, // 最多等待 16 秒
    shouldRetry: (error) => {
      // 只重試配額超限錯誤
      if (error.message && error.message.includes("429")) {
        return true;
      }
      // 也可以重試網絡錯誤
      if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
        return true;
      }
      return false;
    },
    onRetry: (error, attempt, delay) => {
      logger.warn(
        `[Veo 重試] 配額超限，將在 ${Math.round(delay / 1000)} 秒後重試 (${attempt + 1}/3)`
      );
    },
  });
}

/**
 * 簡單的線性重試（不使用指數退避）
 * @param {Function} fn - 要重試的函數
 * @param {number} maxRetries - 最大重試次數
 * @param {number} delay - 固定延遲（毫秒）
 * @returns {Promise<any>}
 */
export async function retryWithFixedDelay(fn, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        logger.warn(`[重試] 嘗試 ${attempt + 1}/${maxRetries} 失敗，${delay}ms 後重試`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * 帶有超時的重試
 * @param {Function} fn - 要重試的函數
 * @param {number} timeout - 總超時時間（毫秒）
 * @param {object} retryOptions - 重試選項
 * @returns {Promise<any>}
 */
export async function retryWithTimeout(fn, timeout = 30000, retryOptions = {}) {
  return Promise.race([
    retryWithExponentialBackoff(fn, retryOptions),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`操作超時（${timeout}ms）`)), timeout)
    ),
  ]);
}
