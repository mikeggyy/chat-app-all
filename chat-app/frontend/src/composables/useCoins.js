import { ref, computed } from 'vue';
import { apiJson } from '../utils/api.js';

// 金幣狀態的全域管理
const coinsState = ref({
  balance: 0,
  transactions: [],
  packages: [],
});

const isLoading = ref(false);
const error = ref(null);

/**
 * 金幣系統 composable
 * 管理用戶的金幣餘額、交易記錄、充值套餐等
 */
export function useCoins() {
  /**
   * 載入金幣餘額
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {object} options - 選項
   */
  const loadBalance = async (userId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/coins/balance', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      coinsState.value.balance = data.balance || 0;
      return data;
    } catch (err) {
      error.value = err?.message || '載入金幣餘額失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入金幣套餐
   * @param {object} options - 選項
   */
  const loadPackages = async (options = {}) => {
    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/coins/packages', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 按照 order 欄位排序
      const packages = data.packages || [];
      packages.sort((a, b) => (a.order || 0) - (b.order || 0));

      coinsState.value.packages = packages;
      return data;
    } catch (err) {
      error.value = err?.message || '載入金幣套餐失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入交易記錄
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {object} options - 選項
   */
  const loadTransactions = async (userId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/coins/transactions', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      coinsState.value.transactions = data.transactions || [];
      return data;
    } catch (err) {
      error.value = err?.message || '載入交易記錄失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 購買金幣套餐
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {string} packageId - 套餐 ID (small, medium, large, xlarge)
   * @param {object} options - 選項
   */
  const purchasePackage = async (userId, packageId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    if (!packageId) {
      error.value = '需要提供套餐 ID';
      throw new Error('需要提供套餐 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/coins/purchase/package', {
        method: 'POST',
        body: {
          packageId,
          paymentInfo: {
            method: options.paymentMethod || 'credit_card',
            paymentId: options.paymentId,
          },
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新本地餘額
      if (data.newBalance !== undefined) {
        coinsState.value.balance = data.newBalance;
      }

      return data;
    } catch (err) {
      error.value = err?.message || '購買金幣套餐失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 獲取功能定價（考慮會員折扣）
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {object} options - 選項
   */
  const loadPricing = async (userId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    try {
      const data = await apiJson('/api/coins/pricing', {
        skipGlobalLoading: options.skipGlobalLoading ?? true,
      });

      return data;
    } catch (err) {
      error.value = err?.message || '載入功能定價失敗';
      throw err;
    }
  };

  // Computed properties
  const balance = computed(() => coinsState.value.balance);
  const packages = computed(() => coinsState.value.packages);
  const transactions = computed(() => coinsState.value.transactions);

  // 格式化金幣數量
  const formattedBalance = computed(() => {
    return new Intl.NumberFormat('zh-TW').format(balance.value);
  });

  // 是否有足夠的金幣
  const hasEnoughCoins = (amount) => {
    return balance.value >= amount;
  };

  // 找到推薦的套餐（標記為 popular）
  const popularPackage = computed(() => {
    return packages.value.find(pkg => pkg.popular);
  });

  // 找到最佳價值套餐（標記為 bestValue）
  const bestValuePackage = computed(() => {
    return packages.value.find(pkg => pkg.bestValue);
  });

  return {
    // State
    coins: coinsState,
    isLoading,
    error,

    // Actions
    loadBalance,
    loadPackages,
    loadTransactions,
    purchasePackage,
    loadPricing,

    // Computed
    balance,
    packages,
    transactions,
    formattedBalance,
    popularPackage,
    bestValuePackage,

    // Utilities
    hasEnoughCoins,
  };
}
