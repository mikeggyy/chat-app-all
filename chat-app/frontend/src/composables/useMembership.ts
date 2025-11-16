/**
 * useMembership.ts
 * 會員系統 Composable（TypeScript 版本）
 * 管理用戶會員等級、升級、取消等功能
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { apiJson } from '../utils/api.js';
import { logger } from '../utils/logger';
import type { MembershipTier, MembershipInfo, MembershipPricing, UpgradeProgress } from '../types';

// ==================== 類型定義 ====================

export interface MembershipFeatures {
  conversationLimit: number;
  voiceLimit: number;
  photoLimit: number;
  unlimitedConversation?: boolean;
  unlimitedVoice?: boolean;
}

export interface MembershipTierConfig {
  tier: MembershipTier;
  features: MembershipFeatures;
  pricing: MembershipPricing;
}

export interface UseMembershipOptions {
  skipGlobalLoading?: boolean;
}

export interface UpgradeOptions extends UseMembershipOptions {
  plan?: 'monthly' | 'quarterly' | 'yearly';
  paymentMethod?: string;
}

export interface UseMembershipReturn {
  // State
  membershipInfo: Ref<MembershipInfo>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  upgradeProgress: Ref<UpgradeProgress>;

  // Actions
  loadMembershipInfo: (userId?: string, options?: UseMembershipOptions) => Promise<any>;
  upgradeMembership: (userId: string | undefined, targetTier: MembershipTier, options?: UpgradeOptions) => Promise<any>;
  cancelMembership: (userId?: string, options?: UseMembershipOptions) => Promise<any>;

  // Computed
  currentTier: ComputedRef<MembershipTier>;
  isActive: ComputedRef<boolean>;
  isFree: ComputedRef<boolean>;
  isVIP: ComputedRef<boolean>;
  isVVIP: ComputedRef<boolean>;
  features: ComputedRef<MembershipFeatures>;
  expiresAt: ComputedRef<string | null | undefined>;
  canUpgrade: ComputedRef<boolean>;
  canCancel: ComputedRef<boolean>;

  // Utilities
  hasFeature: (feature: keyof MembershipFeatures) => boolean;
  getFeatureValue: (feature: keyof MembershipFeatures) => number | boolean | undefined;
}

// ==================== 狀態 ====================

// 會員信息的全域管理
const membershipInfo: Ref<MembershipInfo> = ref({
  tier: 'free',
  features: {
    conversationLimit: 0,
    voiceLimit: 0,
    photoLimit: 0,
  },
  isActive: false,
});

const isLoading = ref(false);
const error: Ref<string | null> = ref(null);
const upgradeProgress: Ref<UpgradeProgress> = ref({
  step: '',
  message: '',
});

// ==================== Composable 主函數 ====================

/**
 * 會員系統 composable
 */
export function useMembership(): UseMembershipReturn {
  /**
   * 載入會員信息
   * @param userId - 用戶 ID（必須提供）
   * @param options - 選項
   */
  const loadMembershipInfo = async (userId?: string, options: UseMembershipOptions = {}): Promise<any> => {
    if (!userId) {
      error.value = '缺少用戶 ID';
      throw new Error('缺少用戶 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson(`/api/membership/${encodeURIComponent(userId)}`, {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      if (data) {
        membershipInfo.value = {
          tier: data.tier || 'free',
          features: data.features || {
            conversationLimit: 0,
            voiceLimit: 0,
            photoLimit: 0,
          },
          pricing: data.pricing,
          expiresAt: data.expiresAt,
          isActive: data.isActive ?? false,
          subscriptionStatus: data.subscriptionStatus,
        };
      }

      return data;
    } catch (err: any) {
      error.value = err?.message || '載入會員信息失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 升級會員
   * @param userId - 用戶 ID（必須提供）
   * @param targetTier - 目標會員等級 (vip 或 vvip)
   * @param options - 選項
   */
  const upgradeMembership = async (
    userId: string | undefined,
    targetTier: MembershipTier,
    options: UpgradeOptions = {}
  ): Promise<any> => {
    if (!userId) {
      error.value = '缺少用戶 ID';
      throw new Error('缺少用戶 ID');
    }

    if (!targetTier || (targetTier !== 'vip' && targetTier !== 'vvip')) {
      error.value = '無效的目標會員等級';
      throw new Error('無效的目標會員等級');
    }

    isLoading.value = true;
    error.value = null;

    // 設置進度：驗證中
    upgradeProgress.value = {
      step: 'validating',
      message: '驗證升級資格...',
    };

    try {
      // 設置進度：處理中
      upgradeProgress.value = {
        step: 'processing',
        message: '處理升級請求...',
      };

      const data = await apiJson(`/api/membership/${encodeURIComponent(userId)}/upgrade`, {
        method: 'POST',
        body: {
          targetTier,
          plan: options.plan || 'monthly',
          paymentInfo: {
            method: options.paymentMethod || 'credit_card',
          },
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 設置進度：完成
      upgradeProgress.value = {
        step: 'finalizing',
        message: '正在更新會員信息...',
      };

      // 更新本地會員信息
      if (data && data.membership) {
        membershipInfo.value = {
          tier: data.membership.tier || targetTier,
          features: data.membership.features || membershipInfo.value.features,
          pricing: data.membership.pricing,
          expiresAt: data.membership.expiresAt,
          isActive: true,
          subscriptionStatus: data.membership.subscriptionStatus || 'active',
        };
      }

      // 設置進度：完成
      upgradeProgress.value = {
        step: 'completed',
        message: '升級成功！',
      };

      logger.log('[會員] 升級成功:', targetTier);

      return data;
    } catch (err: any) {
      error.value = err?.message || '升級會員失敗';
      upgradeProgress.value = {
        step: '',
        message: '',
      };
      throw err;
    } finally {
      isLoading.value = false;
      // 清除進度（延遲 2 秒）
      setTimeout(() => {
        upgradeProgress.value = {
          step: '',
          message: '',
        };
      }, 2000);
    }
  };

  /**
   * 取消會員
   * @param userId - 用戶 ID（必須提供）
   * @param options - 選項
   */
  const cancelMembership = async (userId?: string, options: UseMembershipOptions = {}): Promise<any> => {
    if (!userId) {
      error.value = '缺少用戶 ID';
      throw new Error('缺少用戶 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson(`/api/membership/${encodeURIComponent(userId)}/cancel`, {
        method: 'POST',
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新本地會員信息
      if (data) {
        // 取消後會員信息可能會變更（例如：保留到期日但狀態變為非活躍）
        if (data.membership) {
          membershipInfo.value = {
            tier: data.membership.tier || membershipInfo.value.tier,
            features: data.membership.features || membershipInfo.value.features,
            pricing: data.membership.pricing,
            expiresAt: data.membership.expiresAt,
            isActive: data.membership.isActive ?? false,
            subscriptionStatus: data.membership.subscriptionStatus || 'cancelled',
          };
        }
      }

      logger.log('[會員] 取消成功');

      return data;
    } catch (err: any) {
      error.value = err?.message || '取消會員失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Computed properties
  const currentTier = computed(() => membershipInfo.value.tier);
  const isActive = computed(() => membershipInfo.value.isActive);
  const isFree = computed(() => membershipInfo.value.tier === 'free');
  const isVIP = computed(() => membershipInfo.value.tier === 'vip' && membershipInfo.value.isActive);
  const isVVIP = computed(() => membershipInfo.value.tier === 'vvip' && membershipInfo.value.isActive);
  const features = computed(() => membershipInfo.value.features);
  const expiresAt = computed(() => membershipInfo.value.expiresAt);

  // 是否可以升級
  const canUpgrade = computed(() => {
    const tier = membershipInfo.value.tier;
    // Free 用戶可以升級到 VIP 或 VVIP
    if (tier === 'free') return true;
    // VIP 用戶可以升級到 VVIP
    if (tier === 'vip') return true;
    // VVIP 用戶無法再升級
    return false;
  });

  // 是否可以取消
  const canCancel = computed(() => {
    // 只有活躍的 VIP 或 VVIP 用戶可以取消
    return (
      membershipInfo.value.isActive &&
      (membershipInfo.value.tier === 'vip' || membershipInfo.value.tier === 'vvip')
    );
  });

  // Utility functions

  /**
   * 檢查是否有某個功能
   * @param feature - 功能名稱
   */
  const hasFeature = (feature: keyof MembershipFeatures): boolean => {
    return feature in membershipInfo.value.features;
  };

  /**
   * 獲取功能的值
   * @param feature - 功能名稱
   */
  const getFeatureValue = (feature: keyof MembershipFeatures): number | boolean | undefined => {
    return membershipInfo.value.features[feature];
  };

  return {
    // State
    membershipInfo,
    isLoading,
    error,
    upgradeProgress,

    // Actions
    loadMembershipInfo,
    upgradeMembership,
    cancelMembership,

    // Computed
    currentTier,
    isActive,
    isFree,
    isVIP,
    isVVIP,
    features,
    expiresAt,
    canUpgrade,
    canCancel,

    // Utilities
    hasFeature,
    getFeatureValue,
  };
}
