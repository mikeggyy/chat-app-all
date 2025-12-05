/**
 * useMembershipConfig.ts
 * 從 API 獲取會員配置的 Composable
 *
 * ✅ 2025-12-03 新增：支援資料庫驅動的會員配置
 *
 * 用法：
 * ```ts
 * const { tiers, comparisonFeatures, isLoading, error, loadConfig } = useMembershipConfig();
 *
 * onMounted(() => {
 *   loadConfig();
 * });
 * ```
 */

import { ref, computed, type Ref, type ComputedRef } from "vue";
import { apiJson } from "../utils/api.js";
import { logger } from "../utils/logger";

// ==================== 類型定義 ====================

/**
 * 訂閱週期價格
 */
export interface CyclePrice {
  price: number;
  currency: string;
  monthlyEquivalent: number;
  discountPercent: number;
}

/**
 * 會員功能特性
 */
export interface TierFeature {
  icon: string;
  title: string;
  detail: string;
  badge?: string | null;
}

/**
 * 會員等級配置（從 API 獲取）
 */
export interface MembershipTierConfig {
  id: string;
  order: number;
  label: string;
  headline: string;
  description: string;
  highlight: string;
  highlightColor: string;
  cardGradient: string;
  prices: {
    monthly: CyclePrice;
    quarterly: CyclePrice;
    yearly: CyclePrice;
  };
  features: TierFeature[];
  limits: {
    messagesPerCharacter: number;
    voicesPerCharacter: number;
    dailyMatchLimit: number;
    monthlyPhotos: number;
    discount?: number;
    monthlyUnlockTickets?: number;
    monthlyCoins?: number;
  };
}

/**
 * 對比表項目
 */
export interface ComparisonItem {
  name: string;
  free: string;
  lite: string;
  vip: string;
  vvip: string;
}

/**
 * 對比表類別
 */
export interface ComparisonCategory {
  id: string;
  order: number;
  category: string;
  items: ComparisonItem[];
}

/**
 * 廣告限制配置
 */
export interface AdLimitsConfig {
  conversation: Record<string, { dailyAdLimit: number; unlockedPerAd: number }>;
  voice: Record<string, { dailyAdLimit: number; unlockedPerAd: number }>;
  match: Record<string, { dailyAdLimit: number; unlockedPerAd: number }>;
}

// ==================== 全局狀態 ====================

// 全局緩存（避免重複請求）
const tiersCache: Ref<MembershipTierConfig[]> = ref([]);
const comparisonCache: Ref<ComparisonCategory[]> = ref([]);
const adLimitsCache: Ref<AdLimitsConfig | null> = ref(null);
const isLoading = ref(false);
const error: Ref<string | null> = ref(null);
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘緩存

// ==================== Composable ====================

export function useMembershipConfig() {
  /**
   * 檢查緩存是否有效
   */
  const isCacheValid = (): boolean => {
    return Date.now() - lastFetchTime < CACHE_TTL && tiersCache.value.length > 0;
  };

  /**
   * 載入會員等級配置
   */
  const loadTiers = async (forceRefresh = false): Promise<MembershipTierConfig[]> => {
    if (!forceRefresh && isCacheValid()) {
      return tiersCache.value;
    }

    try {
      isLoading.value = true;
      error.value = null;

      const response = await apiJson("/api/config/membership-tiers", {
        skipGlobalLoading: true,
      });

      if (response?.success && response.data) {
        tiersCache.value = response.data;
        lastFetchTime = Date.now();
        logger.log("[MembershipConfig] 載入會員等級配置成功:", response.data.length, "個等級");
      }

      return tiersCache.value;
    } catch (err: any) {
      error.value = err?.message || "載入會員配置失敗";
      logger.error("[MembershipConfig] 載入失敗:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入對比表配置
   */
  const loadComparisonFeatures = async (forceRefresh = false): Promise<ComparisonCategory[]> => {
    if (!forceRefresh && comparisonCache.value.length > 0) {
      return comparisonCache.value;
    }

    try {
      isLoading.value = true;
      error.value = null;

      const response = await apiJson("/api/config/comparison-features", {
        skipGlobalLoading: true,
      });

      if (response?.success && response.data) {
        comparisonCache.value = response.data;
        logger.log("[MembershipConfig] 載入對比表配置成功:", response.data.length, "個類別");
      }

      return comparisonCache.value;
    } catch (err: any) {
      error.value = err?.message || "載入對比表失敗";
      logger.error("[MembershipConfig] 載入對比表失敗:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入廣告限制配置
   */
  const loadAdLimits = async (forceRefresh = false): Promise<AdLimitsConfig | null> => {
    if (!forceRefresh && adLimitsCache.value) {
      return adLimitsCache.value;
    }

    try {
      isLoading.value = true;
      error.value = null;

      const response = await apiJson("/api/config/ad-limits", {
        skipGlobalLoading: true,
      });

      if (response?.success && response.data) {
        adLimitsCache.value = response.data;
        logger.log("[MembershipConfig] 載入廣告限制配置成功");
      }

      return adLimitsCache.value;
    } catch (err: any) {
      error.value = err?.message || "載入廣告限制失敗";
      logger.error("[MembershipConfig] 載入廣告限制失敗:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入所有配置
   */
  const loadAllConfig = async (forceRefresh = false): Promise<void> => {
    await Promise.all([
      loadTiers(forceRefresh),
      loadComparisonFeatures(forceRefresh),
      loadAdLimits(forceRefresh),
    ]);
  };

  /**
   * 根據 ID 獲取會員等級
   */
  const getTierById = (tierId: string): MembershipTierConfig | undefined => {
    return tiersCache.value.find((t) => t.id === tierId);
  };

  /**
   * 清除緩存
   */
  const clearCache = (): void => {
    tiersCache.value = [];
    comparisonCache.value = [];
    adLimitsCache.value = null;
    lastFetchTime = 0;
  };

  // Computed
  const tiers: ComputedRef<MembershipTierConfig[]> = computed(() => tiersCache.value);
  const comparisonFeatures: ComputedRef<ComparisonCategory[]> = computed(() => comparisonCache.value);
  const adLimits: ComputedRef<AdLimitsConfig | null> = computed(() => adLimitsCache.value);
  const hasData: ComputedRef<boolean> = computed(() => tiersCache.value.length > 0);

  return {
    // State
    tiers,
    comparisonFeatures,
    adLimits,
    isLoading,
    error,
    hasData,

    // Actions
    loadTiers,
    loadComparisonFeatures,
    loadAdLimits,
    loadAllConfig,
    getTierById,
    clearCache,
  };
}

export default useMembershipConfig;
