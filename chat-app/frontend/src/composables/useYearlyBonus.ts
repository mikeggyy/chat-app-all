/**
 * 年訂閱獎勵 Composable
 *
 * 提供年訂閱狀態查詢、獎勵領取、優惠預覽等功能
 *
 * @module composables/useYearlyBonus
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { apiJson } from '../utils/api';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export interface YearlyBonusRewards {
  coins: number;
  photoCards?: number;
  unlockCards?: number;
  badge?: string;
}

export interface YearlyBonusConfig {
  signupBonus: Record<string, YearlyBonusRewards>;
  monthlyBonus: Record<string, YearlyBonusRewards>;
  renewalBonus: Record<string, YearlyBonusRewards & { discountPercent: number }>;
  anniversaryMilestones: number[];
  exclusiveEvents: Record<string, string[]>;
}

export interface YearlySubscriptionStatus {
  isYearlySubscriber: boolean;
  tier?: string;
  startedAt?: string;
  yearsSubscribed?: number;
  renewalCount?: number;
  exclusiveEvents?: string[];
  availableBonuses?: {
    monthlyBonus?: {
      available: boolean;
      rewards: YearlyBonusRewards;
    };
    anniversaryBonus?: {
      available: boolean;
      year: number;
      rewards: YearlyBonusRewards;
    } | null;
  };
  bonusHistory?: Array<{
    id: string;
    type: string;
    rewards: YearlyBonusRewards;
    grantedAt: string;
  }>;
  badges?: string[];
  // For non-yearly subscribers
  yearlyBenefits?: {
    signup: YearlyBonusRewards;
    monthly: { rewards: YearlyBonusRewards; yearlyValue: number };
    renewal: YearlyBonusRewards & { discountPercent: number };
    totalFirstYearValue: number;
    exclusiveEvents: string[];
  };
  savings?: {
    monthlyPrice: number;
    yearlyPrice: number;
    monthlyTotal: number;
    savings: number;
    savingsPercent: number;
  };
}

export interface YearlyPreview {
  tier: string;
  pricing: {
    monthly: number;
    yearly: number;
    monthlyTotal: number;
    savings: number;
    savingsPercent: number;
  };
  benefits: {
    signup: { rewards: YearlyBonusRewards; value: number };
    monthly: { rewards: YearlyBonusRewards; yearlyValue: number };
    renewal: { rewards: YearlyBonusRewards; discountPercent: number };
  };
  totalFirstYearValue: number;
  exclusiveEvents: string[];
  highlights: Array<{ icon: string; text: string }>;
}

// ============================================
// State
// ============================================

const config: Ref<YearlyBonusConfig | null> = ref(null);
const status: Ref<YearlySubscriptionStatus | null> = ref(null);
const preview: Ref<Record<string, YearlyPreview>> = ref({});
const isLoading: Ref<boolean> = ref(false);
const error: Ref<string | null> = ref(null);

// ============================================
// Composable
// ============================================

export function useYearlyBonus() {
  // Computed
  const isYearlySubscriber: ComputedRef<boolean> = computed(() => {
    return status.value?.isYearlySubscriber ?? false;
  });

  const availableMonthlyBonus: ComputedRef<YearlyBonusRewards | null> = computed(() => {
    if (!status.value?.availableBonuses?.monthlyBonus?.available) {
      return null;
    }
    return status.value.availableBonuses.monthlyBonus.rewards;
  });

  const availableAnniversaryBonus: ComputedRef<{ year: number; rewards: YearlyBonusRewards } | null> = computed(() => {
    if (!status.value?.availableBonuses?.anniversaryBonus?.available) {
      return null;
    }
    return {
      year: status.value.availableBonuses.anniversaryBonus.year,
      rewards: status.value.availableBonuses.anniversaryBonus.rewards,
    };
  });

  // ============================================
  // API Methods
  // ============================================

  /**
   * 獲取年訂閱配置
   */
  const fetchConfig = async (): Promise<void> => {
    try {
      const response = await apiJson('/api/yearly-bonus/config');
      if (response.success) {
        config.value = response.data;
      }
    } catch (err: any) {
      logger.error('[YearlyBonus] 獲取配置失敗', err);
    }
  };

  /**
   * 獲取用戶年訂閱狀態
   */
  const fetchStatus = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiJson('/api/yearly-bonus/status');
      if (response.success) {
        status.value = response.data;
      }
    } catch (err: any) {
      error.value = err.message || '獲取狀態失敗';
      logger.error('[YearlyBonus] 獲取狀態失敗', err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 獲取特定等級的年訂閱優惠預覽
   */
  const fetchPreview = async (tier: string): Promise<YearlyPreview | null> => {
    if (preview.value[tier]) {
      return preview.value[tier];
    }

    try {
      const response = await apiJson(`/api/yearly-bonus/preview/${tier}`);
      if (response.success) {
        preview.value[tier] = response.data;
        return response.data;
      }
      return null;
    } catch (err: any) {
      logger.error(`[YearlyBonus] 獲取 ${tier} 預覽失敗`, err);
      return null;
    }
  };

  /**
   * 領取每月獎勵
   */
  const claimMonthlyBonus = async (): Promise<{ success: boolean; rewards?: YearlyBonusRewards; error?: string }> => {
    try {
      const idempotencyKey = `monthly_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const response = await apiJson('/api/yearly-bonus/claim/monthly', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey }),
      });

      if (response.success) {
        // 刷新狀態
        await fetchStatus();
        return { success: true, rewards: response.data.rewards };
      }
      return { success: false, error: response.message };
    } catch (err: any) {
      return { success: false, error: err.message || '領取失敗' };
    }
  };

  /**
   * 領取週年獎勵
   */
  const claimAnniversaryBonus = async (): Promise<{ success: boolean; rewards?: YearlyBonusRewards; error?: string }> => {
    try {
      const idempotencyKey = `anniversary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const response = await apiJson('/api/yearly-bonus/claim/anniversary', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey }),
      });

      if (response.success) {
        await fetchStatus();
        return { success: true, rewards: response.data.rewards };
      }
      return { success: false, error: response.message };
    } catch (err: any) {
      return { success: false, error: err.message || '領取失敗' };
    }
  };

  /**
   * 獲取年訂閱節省說明
   */
  const getYearlySavingsText = (tier: string): string => {
    const tierPreview = preview.value[tier];
    if (!tierPreview) return '';

    const { savings, savingsPercent } = tierPreview.pricing;
    return `年繳省 NT$ ${savings}（${savingsPercent}% OFF）`;
  };

  /**
   * 獲取年訂閱獎勵說明
   */
  const getYearlyBonusText = (tier: string): string[] => {
    const tierPreview = preview.value[tier];
    if (!tierPreview) return [];

    const texts: string[] = [];
    const { signup, monthly } = tierPreview.benefits;

    if (signup.rewards.coins > 0) {
      texts.push(`註冊送 ${signup.rewards.coins} 金幣`);
    }
    if (signup.rewards.photoCards && signup.rewards.photoCards > 0) {
      texts.push(`註冊送 ${signup.rewards.photoCards} 張拍照卡`);
    }
    if (monthly.rewards.coins > 0) {
      texts.push(`每月額外送 ${monthly.rewards.coins} 金幣`);
    }

    return texts;
  };

  return {
    // State
    config,
    status,
    preview,
    isLoading,
    error,

    // Computed
    isYearlySubscriber,
    availableMonthlyBonus,
    availableAnniversaryBonus,

    // Methods
    fetchConfig,
    fetchStatus,
    fetchPreview,
    claimMonthlyBonus,
    claimAnniversaryBonus,
    getYearlySavingsText,
    getYearlyBonusText,
  };
}
