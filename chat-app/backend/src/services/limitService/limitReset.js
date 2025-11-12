/**
 * 限制重置邏輯 - 修復版本
 * 修復內容：
 * ✅ 分離基礎限制（永不重置）和廣告解鎖（每日重置）的邏輯
 * ✅ 對話/語音限制：基礎次數永不重置，但廣告解鎖次數每日重置
 */

import logger from "../../utils/logger.js";

export const RESET_PERIOD = {
  DAILY: "daily",
  MONTHLY: "monthly",
  NONE: "none",
};

/**
 * 檢查並執行基礎限制的重置
 * （對話/語音的基礎限制永不重置，照片限制按原有邏輯）
 *
 * @param {Object} limitData - 限制數據
 * @param {string} resetPeriod - 重置週期
 * @returns {boolean} 是否已重置
 */
export const checkAndResetBaseLimit = (limitData, resetPeriod) => {
  if (!limitData) return false;

  // 如果沒有設置重置週期，不重置
  if (resetPeriod === RESET_PERIOD.NONE) {
    return false;
  }

  const now = new Date();
  const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const lastResetDate = limitData.lastResetDate;

  let shouldReset = false;

  if (resetPeriod === RESET_PERIOD.DAILY) {
    // 每日重置：檢查是否跨天
    shouldReset = lastResetDate !== currentDate;
  } else if (resetPeriod === RESET_PERIOD.MONTHLY) {
    // 每月重置：檢查是否跨月
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const lastResetMonth = lastResetDate ? lastResetDate.slice(0, 7) : null;
    shouldReset = lastResetMonth !== currentMonth;
  }

  if (shouldReset) {
    logger.info(
      `[限制重置] 重置基礎限制: resetPeriod=${resetPeriod}, lastResetDate=${lastResetDate}, currentDate=${currentDate}`
    );

    // ⚠️ 注意：只重置 count（基礎使用次數）
    // 不重置 unlocked（廣告解鎖次數，那個有獨立的重置邏輯）
    limitData.count = 0;
    limitData.lastResetDate = currentDate;
    limitData.lastResetAt = now.toISOString();

    return true;
  }

  return false;
};

/**
 * 檢查並重置廣告解鎖次數（每日重置）
 * ✅ 修復：不再重置 unlocked 字段，改為清理過期的解鎖記錄
 *
 * 說明：
 * - 廣告解鎖現在使用獨立的 24 小時過期時間（unlockHistory）
 * - 每日重置只重置統計數據（adsWatchedToday），不影響未過期的解鎖次數
 *
 * @param {Object} limitData - 限制數據
 * @returns {boolean} 是否已重置
 */
export const checkAndResetAdUnlocks = (limitData) => {
  if (!limitData) return false;

  const now = new Date();
  const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const lastAdResetDate = limitData.lastAdResetDate;

  // 檢查是否跨天
  const shouldReset = lastAdResetDate !== currentDate;

  if (shouldReset) {
    logger.info(
      `[限制重置] 重置廣告統計數據: lastAdResetDate=${lastAdResetDate}, currentDate=${currentDate}`
    );

    // ✅ 修復：清理過期的解鎖記錄（基於獨立過期時間）
    if (Array.isArray(limitData.unlockHistory)) {
      const beforeCount = limitData.unlockHistory.length;

      // 只保留未過期的解鎖記錄
      limitData.unlockHistory = limitData.unlockHistory.filter(unlock => {
        if (!unlock.expiresAt) return false;
        const expiresAt = new Date(unlock.expiresAt);
        return expiresAt > now;
      });

      const afterCount = limitData.unlockHistory.length;
      const cleanedCount = beforeCount - afterCount;

      if (cleanedCount > 0) {
        logger.info(`[限制重置] 清理了 ${cleanedCount} 個過期的廣告解鎖記錄`);
      }
    }

    // ✅ 只重置每日統計數據（不影響解鎖次數）
    limitData.adsWatchedToday = 0; // 今日觀看廣告次數
    limitData.lastAdResetDate = currentDate;
    limitData.lastAdResetAt = now.toISOString();

    // ⚠️ 不再重置 unlocked 和 lastAdTime（這些由過期時間控制）

    return true;
  }

  return false;
};

/**
 * 檢查並執行所有重置（基礎 + 廣告）
 * ✅ 修復：同時檢查兩種重置邏輯
 *
 * @param {Object} limitData - 限制數據
 * @param {string} resetPeriod - 基礎限制的重置週期
 * @returns {boolean} 是否有任何重置發生
 */
export const checkAndResetAll = (limitData, resetPeriod) => {
  const baseReset = checkAndResetBaseLimit(limitData, resetPeriod);
  const adReset = checkAndResetAdUnlocks(limitData);

  return baseReset || adReset;
};

/**
 * 初始化限制數據（如果不存在）
 *
 * @param {string} resetPeriod - 重置週期
 * @returns {Object} 初始化的限制數據
 */
export const createLimitData = (resetPeriod) => {
  const now = new Date();
  const currentDate = now.toISOString().split("T")[0];

  return {
    count: 0, // 基礎使用次數
    unlocked: 0, // 廣告解鎖的額外次數
    cards: 0, // ⚠️ 已廢棄，保留向後兼容
    resetPeriod,
    lastResetDate: currentDate,
    lastResetAt: now.toISOString(),
    // 廣告相關
    adsWatchedToday: 0,
    lastAdTime: null,
    lastAdResetDate: currentDate,
    lastAdResetAt: now.toISOString(),
    // 臨時解鎖（解鎖券）
    temporaryUnlockUntil: null,
    permanentUnlock: false,
  };
};

export default {
  RESET_PERIOD,
  checkAndResetBaseLimit,
  checkAndResetAdUnlocks,
  checkAndResetAll,
  createLimitData,
};
