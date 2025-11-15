/**
 * useCoins.ts
 * 金幣系統 Composable（TypeScript 版本）
 * 管理用戶的金幣餘額、交易記錄、充值套餐等
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { apiJson } from '../utils/api.js';
import { generateIdempotencyKey } from '../utils/idempotency.js';
import { logger } from '../utils/logger';
import { coinQueue } from '../utils/requestQueue.js';
import type { CoinsState, CoinPackage, CoinTransaction } from '../types';

// ==================== 類型定義 ====================

export interface UseCoinsOptions {
  skipGlobalLoading?: boolean;
}

export interface PurchaseOptions extends UseCoinsOptions {
  paymentMethod?: string;
  paymentId?: string;
}

export interface UseCoinsReturn {
  // State
  coins: Ref<CoinsState>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;

  // Actions
  loadBalance: (userId?: string, options?: UseCoinsOptions) => Promise<any>;
  loadPackages: (options?: UseCoinsOptions) => Promise<any>;
  loadTransactions: (userId?: string, options?: UseCoinsOptions) => Promise<any>;
  purchasePackage: (userId: string | undefined, packageId: string, options?: PurchaseOptions) => Promise<any>;
  loadPricing: (userId?: string, options?: UseCoinsOptions) => Promise<any>;

  // Computed
  balance: ComputedRef<number>;
  packages: ComputedRef<CoinPackage[]>;
  transactions: ComputedRef<CoinTransaction[]>;
  formattedBalance: ComputedRef<string>;
  popularPackage: ComputedRef<CoinPackage | undefined>;
  bestValuePackage: ComputedRef<CoinPackage | undefined>;

  // Utilities
  hasEnoughCoins: (amount: number) => boolean;
}

// ==================== 狀態 ====================

// 金幣狀態的全域管理
const coinsState: Ref<CoinsState> = ref({
  balance: 0,
  transactions: [],
  packages: [],
});

const isLoading = ref(false);
const error: Ref<string | null> = ref(null);

// ==================== Composable 主函數 ====================

/**
 * 金幣系統 composable
 */
export function useCoins(): UseCoinsReturn {
  /**
   * 載入金幣餘額
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param options - 選項
   */
  const loadBalance = async (userId?: string, options: UseCoinsOptions = {}): Promise<any> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId
    void userId; // 標記參數已被認知

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/coins/balance', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      coinsState.value.balance = data.balance || 0;
      return data;
    } catch (err: any) {
      error.value = err?.message || '載入金幣餘額失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入金幣套餐
   * @param options - 選項
   */
  const loadPackages = async (options: UseCoinsOptions = {}): Promise<any> => {
    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/coins/packages', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 按照 order 欄位排序
      const packages = data.packages || [];
      packages.sort((a: CoinPackage, b: CoinPackage) => (a.order || 0) - (b.order || 0));

      coinsState.value.packages = packages;
      return data;
    } catch (err: any) {
      error.value = err?.message || '載入金幣套餐失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入交易記錄
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param options - 選項
   */
  const loadTransactions = async (userId?: string, options: UseCoinsOptions = {}): Promise<any> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId
    void userId; // 標記參數已被認知

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/coins/transactions', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      coinsState.value.transactions = data.transactions || [];
      return data;
    } catch (err: any) {
      error.value = err?.message || '載入交易記錄失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 購買金幣套餐
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param packageId - 套餐 ID (small, medium, large, xlarge)
   * @param options - 選項
   */
  const purchasePackage = async (
    userId: string | undefined,
    packageId: string,
    options: PurchaseOptions = {}
  ): Promise<any> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId
    void userId; // 標記參數已被認知

    if (!packageId) {
      error.value = '需要提供套餐 ID';
      throw new Error('需要提供套餐 ID');
    }

    // ✅ 修復: 使用請求隊列確保購買操作順序執行，避免並發衝突
    return await coinQueue.enqueue(async () => {
      isLoading.value = true;
      error.value = null;

      try {
        // 生成冪等性鍵，防止重複購買
        const idempotencyKey = generateIdempotencyKey();

        const data = await apiJson('/api/coins/purchase/package', {
          method: 'POST',
          body: {
            packageId,
            idempotencyKey, // 添加冪等性鍵（必填）
            paymentInfo: {
              method: options.paymentMethod || 'credit_card',
              paymentId: options.paymentId,
            },
          },
          skipGlobalLoading: options.skipGlobalLoading ?? false,
        });

        // 檢查是否為重複請求（來自緩存）
        if (data._idempotent || data._cached) {
          logger.log('[購買金幣] 檢測到重複請求，返回了緩存結果');
        }

        // ✅ 修復: 使用增量更新或確保順序更新，避免並發覆蓋問題
        // 優先使用增量信息，如果沒有則使用絕對值
        if (data.coinsAdded !== undefined) {
          // 增量更新（更安全）
          coinsState.value.balance += data.coinsAdded;
          logger.log(`[金幣] 增量更新: +${data.coinsAdded}, 新餘額: ${coinsState.value.balance}`);
        } else if (data.newBalance !== undefined) {
          // 絕對值更新（作為後備）
          coinsState.value.balance = data.newBalance;
          logger.log(`[金幣] 絕對值更新: ${data.newBalance}`);
        }

        return data;
      } catch (err: any) {
        error.value = err?.message || '購買金幣套餐失敗';
        throw err;
      } finally {
        isLoading.value = false;
      }
    });
  };

  /**
   * 獲取功能定價（考慮會員折扣）
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param options - 選項
   */
  const loadPricing = async (userId?: string, options: UseCoinsOptions = {}): Promise<any> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId
    void userId; // 標記參數已被認知

    try {
      const data = await apiJson('/api/coins/pricing', {
        skipGlobalLoading: options.skipGlobalLoading ?? true,
      });

      return data;
    } catch (err: any) {
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
  const hasEnoughCoins = (amount: number): boolean => {
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
