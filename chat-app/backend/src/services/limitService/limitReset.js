/**
 * 限制重置邏輯模組
 * 負責檢查和執行限制重置
 */

import { RESET_PERIOD } from "./constants.js";

/**
 * 檢查並重置限制（如果需要）
 * @param {Object} limitData - 限制數據
 * @param {string} resetPeriod - 重置週期
 * @returns {boolean} 是否執行了重置
 */
export const checkAndReset = (limitData, resetPeriod) => {
  if (resetPeriod === RESET_PERIOD.NONE || resetPeriod === RESET_PERIOD.LIFETIME) {
    return false;
  }

  const now = new Date();
  const lastResetDate = limitData.lastResetDate;

  if (!lastResetDate) {
    // 首次使用，設定重置日期
    limitData.lastResetDate =
      resetPeriod === RESET_PERIOD.MONTHLY
        ? now.toISOString().slice(0, 7) // YYYY-MM
        : now.toISOString().slice(0, 10); // YYYY-MM-DD
    return false;
  }

  let shouldReset = false;

  if (resetPeriod === RESET_PERIOD.DAILY) {
    const today = now.toISOString().slice(0, 10);
    shouldReset = lastResetDate !== today;
    if (shouldReset) {
      limitData.lastResetDate = today;
    }
  } else if (resetPeriod === RESET_PERIOD.WEEKLY) {
    // 計算當前週的開始日期（週一）
    const currentWeekStart = getWeekStart(now);
    const lastResetWeekStart = lastResetDate ? getWeekStart(new Date(lastResetDate)) : null;

    shouldReset = !lastResetWeekStart || currentWeekStart !== lastResetWeekStart;
    if (shouldReset) {
      limitData.lastResetDate = currentWeekStart;
    }
  } else if (resetPeriod === RESET_PERIOD.MONTHLY) {
    const currentMonth = now.toISOString().slice(0, 7);
    shouldReset = lastResetDate !== currentMonth;
    if (shouldReset) {
      limitData.lastResetDate = currentMonth;
    }
  }

  if (shouldReset) {
    limitData.count = 0;
    limitData.unlocked = 0;
    limitData.adsWatchedToday = 0;
    limitData.lastAdTime = null;
  }

  return shouldReset;
};

/**
 * 獲取週開始日期（週一）
 * @param {Date} date - 日期
 * @returns {string} 週開始日期字串 (YYYY-MM-DD)
 */
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 調整為週一
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
};

/**
 * 創建初始限制數據
 * @param {string} resetPeriod - 重置週期
 * @returns {Object} 限制數據
 */
export const createLimitData = (resetPeriod) => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  return {
    count: 0, // 本期已使用次數
    lifetimeCount: 0, // 終生使用次數
    unlocked: 0, // 透過廣告等方式解鎖的額外次數
    cards: 0, // 擁有的使用卡數量（如拍照卡）
    permanentUnlock: false, // 是否永久解鎖
    lastResetDate:
      resetPeriod === RESET_PERIOD.MONTHLY ? dateStr.slice(0, 7) : dateStr, // YYYY-MM 或 YYYY-MM-DD
    lastAdTime: null, // 上次看廣告時間
    adsWatchedToday: 0, // 今日觀看廣告次數
    history: [], // 使用歷史記錄
  };
};

export default {
  checkAndReset,
  createLimitData,
};
