/**
 * 限制追蹤邏輯模組
 * 負責檢查使用權限和記錄使用
 */

/**
 * 檢查是否可以使用
 * @param {Object} limitData - 限制數據
 * @param {number} limit - 限制值 (-1 表示無限制)
 * @returns {Object} 檢查結果
 */
export const checkCanUse = (limitData, limit) => {
  // 無限制
  if (limit === -1) {
    return {
      allowed: true,
      reason: "unlimited",
      remaining: -1,
      used: limitData.count,
      total: -1
    };
  }

  // 永久解鎖
  if (limitData.permanentUnlock) {
    return {
      allowed: true,
      reason: "permanent_unlock",
      remaining: -1,
      used: limitData.count,
      total: -1
    };
  }

  // 計算總可用次數
  const totalAllowed = limit + limitData.unlocked + limitData.cards;
  const used = limitData.count;
  const remaining = totalAllowed - used;

  if (remaining > 0) {
    return {
      allowed: true,
      remaining,
      used,
      total: totalAllowed
    };
  }

  return {
    allowed: false,
    reason: "limit_exceeded",
    used,
    limit: totalAllowed,
    remaining: 0,
    total: totalAllowed
  };
};

/**
 * 記錄使用
 * @param {Object} limitData - 限制數據
 * @param {Object} metadata - 使用元數據
 */
export const recordUse = (limitData, metadata = {}) => {
  limitData.count += 1;
  limitData.lifetimeCount += 1;

  // 記錄使用歷史
  if (Array.isArray(limitData.history)) {
    limitData.history.push({
      timestamp: new Date().toISOString(),
      ...metadata,
    });

    // 限制歷史記錄數量
    if (limitData.history.length > 100) {
      limitData.history.shift();
    }
  }
};

/**
 * 解鎖額外次數（通過廣告）
 * @param {Object} limitData - 限制數據
 * @param {number} amount - 解鎖數量
 * @returns {Object} 解鎖結果
 */
export const unlockByAd = (limitData, amount) => {
  limitData.unlocked += amount;
  limitData.adsWatchedToday += 1;
  limitData.lastAdTime = new Date().toISOString();

  return {
    success: true,
    unlockedAmount: amount,
    totalUnlocked: limitData.unlocked,
    adsWatchedToday: limitData.adsWatchedToday,
  };
};

/**
 * 購買使用卡
 * @param {Object} limitData - 限制數據
 * @param {number} amount - 購買數量
 * @returns {Object} 購買結果
 */
export const purchaseCards = (limitData, amount) => {
  limitData.cards += amount;

  return {
    success: true,
    purchasedAmount: amount,
    totalCards: limitData.cards,
  };
};

/**
 * 永久解鎖
 * @param {Object} limitData - 限制數據
 * @returns {Object} 解鎖結果
 */
export const unlockPermanently = (limitData) => {
  limitData.permanentUnlock = true;

  return {
    success: true,
    permanentUnlock: true,
  };
};

export default {
  checkCanUse,
  recordUse,
  unlockByAd,
  purchaseCards,
  unlockPermanently,
};
