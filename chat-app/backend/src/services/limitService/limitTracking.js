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

  // 永久解鎖（向後兼容舊數據）
  if (limitData.permanentUnlock) {
    return {
      allowed: true,
      reason: "permanent_unlock",
      remaining: -1,
      used: limitData.count,
      total: -1
    };
  }

  // 限時解鎖檢查
  if (limitData.temporaryUnlockUntil) {
    const now = new Date();
    const unlockUntil = new Date(limitData.temporaryUnlockUntil);

    if (now < unlockUntil) {
      // 仍在解鎖期間內
      const remainingDays = Math.ceil((unlockUntil - now) / (1000 * 60 * 60 * 24));
      return {
        allowed: true,
        reason: "temporary_unlock",
        remaining: -1,
        used: limitData.count,
        total: -1,
        temporaryUnlock: true,
        unlockUntil: limitData.temporaryUnlockUntil,
        remainingDays,
      };
    } else {
      // 解鎖已過期，清除標記
      delete limitData.temporaryUnlockUntil;
    }
  }

  // 計算總可用次數
  // 注意：limitData.cards 已廢棄，保留用於向後兼容
  // 新的卡片資產應使用 users/{userId}/assets 系統管理
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
 *
 * @deprecated 此方法已廢棄，請使用 assets.service.js 的 addUserAsset() 管理卡片資產
 *
 * 原因：
 * - 舊系統將卡片儲存在 usage_limits collection 中
 * - 新系統統一在 users/{userId}/assets 中管理所有卡片類資產
 * - 新系統提供更完善的審計日誌功能
 *
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
 * 限時解鎖（7 天）
 * @param {Object} limitData - 限制數據
 * @param {number} days - 解鎖天數（預設 7 天）
 * @returns {Object} 解鎖結果
 */
export const unlockPermanently = (limitData, days = 7) => {
  // 計算到期時間（當前時間 + 指定天數）
  const now = new Date();
  const unlockUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  limitData.temporaryUnlockUntil = unlockUntil.toISOString();

  // 記錄解鎖歷史
  if (Array.isArray(limitData.history)) {
    limitData.history.push({
      timestamp: now.toISOString(),
      action: 'temporary_unlock',
      days,
      unlockUntil: unlockUntil.toISOString(),
    });

    // 限制歷史記錄數量
    if (limitData.history.length > 100) {
      limitData.history.shift();
    }
  }

  return {
    success: true,
    temporaryUnlock: true,
    days,
    unlockUntil: unlockUntil.toISOString(),
    unlockUntilReadable: unlockUntil.toLocaleString('zh-TW'),
  };
};

/**
 * 回滾使用次數（用於失敗的操作）
 *
 * 用途：當操作記錄了使用次數但最終失敗時，可以回滾計數
 * 例如：記錄了角色創建次數，但角色創建失敗
 *
 * 注意：
 * - 只減少本期使用次數（count），不減少終生計數（lifetimeCount）
 * - 會記錄回滾歷史用於審計
 * - 不能回滾到負數（最小為 0）
 * - 支援冪等性：使用 metadata.idempotencyKey 防止重複回滾
 *
 * @param {Object} limitData - 限制數據
 * @param {Object} metadata - 回滾元數據（用於審計）
 * @param {string} metadata.idempotencyKey - 冪等性鍵（例如 tempCharacterId），防止重複回滾
 * @returns {Object} 回滾結果
 */
export const decrementUse = (limitData, metadata = {}) => {
  const { idempotencyKey, ...restMetadata } = metadata;

  // ⚠️ 冪等性檢查：如果提供了 idempotencyKey，檢查是否已經回滾過
  if (idempotencyKey && Array.isArray(limitData.history)) {
    const alreadyRolledBack = limitData.history.some(
      (entry) =>
        entry.action === 'rollback' &&
        entry.idempotencyKey === idempotencyKey
    );

    if (alreadyRolledBack) {
      // 已經回滾過，返回冪等結果（不修改數據）
      return {
        success: true,
        idempotent: true, // 標記為冪等操作
        message: `已使用冪等性鍵 ${idempotencyKey} 執行過回滾，跳過重複操作`,
        previousCount: limitData.count,
        newCount: limitData.count,
        decremented: 0,
      };
    }
  }

  const previousCount = limitData.count;

  // 減少計數，但不能小於 0
  limitData.count = Math.max(0, limitData.count - 1);

  // 記錄回滾歷史
  if (Array.isArray(limitData.history)) {
    limitData.history.push({
      timestamp: new Date().toISOString(),
      action: 'rollback', // 標記為回滾操作
      previousCount,
      newCount: limitData.count,
      idempotencyKey, // 記錄冪等性鍵
      ...restMetadata,
    });

    // 限制歷史記錄數量
    if (limitData.history.length > 100) {
      limitData.history.shift();
    }
  }

  return {
    success: true,
    idempotent: false, // 非冪等操作（實際執行了回滾）
    previousCount,
    newCount: limitData.count,
    decremented: previousCount - limitData.count,
  };
};

export default {
  checkCanUse,
  recordUse,
  decrementUse,
  unlockByAd,
  purchaseCards,
  unlockPermanently,
};
