/**
 * 錢包輔助函數
 *
 * 提供統一的錢包餘額存取介面，支援舊格式向後兼容
 *
 * 舊格式（已廢棄）：
 * - user.walletBalance
 * - user.coins
 *
 * 新格式（推薦）：
 * - user.wallet.balance
 */

/**
 * 獲取用戶錢包餘額（向後兼容）
 * @param {Object} user - 用戶對象
 * @returns {number} 餘額
 */
export const getWalletBalance = (user) => {
  if (!user) {
    return 0;
  }

  // 優先使用新格式
  if (user.wallet && typeof user.wallet.balance === "number") {
    return user.wallet.balance;
  }

  // 向後兼容：嘗試舊格式
  if (typeof user.walletBalance === "number") {
    return user.walletBalance;
  }

  if (typeof user.coins === "number") {
    return user.coins;
  }

  return 0;
};

/**
 * 獲取錢包幣別
 * @param {Object} user - 用戶對象
 * @returns {string} 幣別
 */
export const getWalletCurrency = (user) => {
  if (!user) {
    return "TWD";
  }

  if (user.wallet && user.wallet.currency) {
    return user.wallet.currency;
  }

  return "TWD";
};

/**
 * 創建錢包更新數據（只更新新格式字段）
 * @param {number} newBalance - 新餘額
 * @param {string} currency - 幣別（可選）
 * @returns {Object} 更新數據
 */
export const createWalletUpdate = (newBalance, currency = "TWD") => {
  if (typeof newBalance !== "number" || newBalance < 0) {
    throw new Error("無效的餘額值");
  }

  return {
    wallet: {
      balance: newBalance,
      currency,
      updatedAt: new Date().toISOString(),
    },
  };
};

/**
 * 驗證用戶餘額是否足夠
 * @param {Object} user - 用戶對象
 * @param {number} requiredAmount - 所需金額
 * @returns {boolean} 是否足夠
 */
export const hasEnoughBalance = (user, requiredAmount) => {
  const currentBalance = getWalletBalance(user);
  return currentBalance >= requiredAmount;
};

/**
 * 檢查用戶文檔是否使用舊格式（需要遷移）
 * @param {Object} user - 用戶對象
 * @returns {Object} 檢查結果
 */
export const checkWalletFormat = (user) => {
  if (!user) {
    return { needsMigration: false, reason: "no_user" };
  }

  const hasOldWalletBalance = typeof user.walletBalance !== "undefined";
  const hasOldCoins = typeof user.coins !== "undefined";
  const hasNewWallet = user.wallet && typeof user.wallet.balance === "number";

  if (!hasOldWalletBalance && !hasOldCoins) {
    return {
      needsMigration: false,
      format: "new",
      reason: "using_new_format",
    };
  }

  if (hasOldWalletBalance || hasOldCoins) {
    return {
      needsMigration: true,
      format: "old",
      reason: "has_legacy_fields",
      legacyFields: {
        walletBalance: hasOldWalletBalance,
        coins: hasOldCoins,
      },
    };
  }

  return {
    needsMigration: false,
    format: "new",
  };
};

/**
 * 將舊格式用戶數據轉換為新格式（用於遷移）
 * @param {Object} user - 用戶對象
 * @returns {Object} 遷移後的數據
 */
export const migrateUserWalletFormat = (user) => {
  if (!user) {
    return null;
  }

  const check = checkWalletFormat(user);

  if (!check.needsMigration) {
    return null; // 不需要遷移
  }

  // 提取餘額（優先順序：wallet.balance > walletBalance > coins > 0）
  const balance = getWalletBalance(user);

  // 創建遷移後的用戶數據（移除舊字段）
  const migratedUser = { ...user };

  // 確保 wallet 對象存在且正確
  migratedUser.wallet = {
    balance,
    currency: user.wallet?.currency || "TWD",
    updatedAt: user.wallet?.updatedAt || new Date().toISOString(),
  };

  // 移除舊字段
  delete migratedUser.walletBalance;
  delete migratedUser.coins;

  return {
    before: {
      walletBalance: user.walletBalance,
      coins: user.coins,
      wallet: user.wallet,
    },
    after: {
      wallet: migratedUser.wallet,
    },
    migratedUser,
  };
};

export default {
  getWalletBalance,
  getWalletCurrency,
  createWalletUpdate,
  hasEnoughBalance,
  checkWalletFormat,
  migrateUserWalletFormat,
};
