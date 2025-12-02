/**
 * useMembership.ts
 * 會員系統 Composable（TypeScript 版本）
 * 管理用戶會員等級、升級、取消等功能
 */

import { ref, computed, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
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

/**
 * ✅ 2025-11-30 新增：升級價格預覽（補差價計算）
 */
export interface UpgradePriceInfo {
  currentTier: MembershipTier;
  targetTier: MembershipTier;
  currentTierName: string;
  targetTierName: string;
  currentDailyRate: number;
  daysRemaining: number;
  remainingValue: number;
  targetMonthlyPrice: number;
  upgradePrice: number;
  savings: number;
  newExpiryDays: number;
  description: string;
  message: string;
}

export interface UseMembershipReturn {
  // State
  membershipInfo: Ref<MembershipInfo>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  upgradeProgress: Ref<UpgradeProgress>;

  // Actions
  loadMembershipInfo: (userId?: string, options?: UseMembershipOptions) => Promise<any>;
  loadMembership: (userId?: string, options?: UseMembershipOptions) => Promise<any>; // 別名
  upgradeMembership: (userId: string | undefined, targetTier: MembershipTier, options?: UpgradeOptions) => Promise<any>;
  cancelMembership: (userId?: string, options?: UseMembershipOptions) => Promise<any>;
  getUpgradePricePreview: (userId: string, targetTier: MembershipTier, options?: UseMembershipOptions) => Promise<UpgradePriceInfo>; // ✅ 2025-11-30 新增

  // Computed
  currentTier: ComputedRef<MembershipTier>;
  isActive: ComputedRef<boolean>;
  isFree: ComputedRef<boolean>;
  isLite: ComputedRef<boolean>; // ✅ 2025-11-30 新增
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
  // ✅ 修復：追蹤定時器以便清理
  let progressTimer: ReturnType<typeof setTimeout> | null = null;

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
   * @param targetTier - 目標會員等級 (lite, vip 或 vvip)
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

    // ✅ 2025-11-30 更新：新增 lite 等級驗證
    if (!targetTier || (targetTier !== 'lite' && targetTier !== 'vip' && targetTier !== 'vvip')) {
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
      // ✅ 修復：追蹤定時器以便清理
      if (progressTimer) {
        clearTimeout(progressTimer);
      }
      progressTimer = setTimeout(() => {
        progressTimer = null;
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

  /**
   * ✅ 2025-11-30 新增：獲取升級價格預覽（補差價計算）
   * @param userId - 用戶 ID（必須提供）
   * @param targetTier - 目標會員等級 (lite, vip 或 vvip)
   * @param options - 選項
   * @returns 升級價格詳情
   */
  const getUpgradePricePreview = async (
    userId: string,
    targetTier: MembershipTier,
    options: UseMembershipOptions = {}
  ): Promise<UpgradePriceInfo> => {
    if (!userId) {
      error.value = '缺少用戶 ID';
      throw new Error('缺少用戶 ID');
    }

    if (!targetTier || (targetTier !== 'lite' && targetTier !== 'vip' && targetTier !== 'vvip')) {
      error.value = '無效的目標會員等級';
      throw new Error('無效的目標會員等級');
    }

    try {
      const data = await apiJson(
        `/api/membership/${encodeURIComponent(userId)}/upgrade-price/${encodeURIComponent(targetTier)}`,
        {
          skipGlobalLoading: options.skipGlobalLoading ?? true, // 預覽不需要全局 loading
        }
      );

      logger.log('[會員] 升級價格預覽:', data);

      return {
        currentTier: data.currentTier,
        targetTier: data.targetTier,
        currentTierName: data.currentTierName,
        targetTierName: data.targetTierName,
        currentDailyRate: data.currentDailyRate,
        daysRemaining: data.daysRemaining,
        remainingValue: data.remainingValue,
        targetMonthlyPrice: data.targetMonthlyPrice,
        upgradePrice: data.upgradePrice,
        savings: data.savings,
        newExpiryDays: data.newExpiryDays,
        description: data.description,
        message: data.message,
      };
    } catch (err: any) {
      error.value = err?.message || '獲取升級價格失敗';
      throw err;
    }
  };

  // Computed properties
  const currentTier = computed(() => membershipInfo.value.tier);
  const isActive = computed(() => membershipInfo.value.isActive);
  const isFree = computed(() => membershipInfo.value.tier === 'free');
  // ✅ 2025-11-30 新增：Lite 等級判斷
  const isLite = computed(() => membershipInfo.value.tier === 'lite' && membershipInfo.value.isActive);
  const isVIP = computed(() => membershipInfo.value.tier === 'vip' && membershipInfo.value.isActive);
  const isVVIP = computed(() => membershipInfo.value.tier === 'vvip' && membershipInfo.value.isActive);
  const features = computed(() => membershipInfo.value.features);
  const expiresAt = computed(() => membershipInfo.value.expiresAt);

  // 是否可以升級
  // ✅ 2025-11-30 更新：支援 Lite 等級
  const canUpgrade = computed(() => {
    const tier = membershipInfo.value.tier;
    // Free 用戶可以升級到 Lite, VIP 或 VVIP
    if (tier === 'free') return true;
    // Lite 用戶可以升級到 VIP 或 VVIP
    if (tier === 'lite') return true;
    // VIP 用戶可以升級到 VVIP
    if (tier === 'vip') return true;
    // VVIP 用戶無法再升級
    return false;
  });

  // 是否可以取消
  // ✅ 2025-11-30 更新：支援 Lite 等級
  const canCancel = computed(() => {
    // 只有活躍的 Lite, VIP 或 VVIP 用戶可以取消
    return (
      membershipInfo.value.isActive &&
      (membershipInfo.value.tier === 'lite' || membershipInfo.value.tier === 'vip' || membershipInfo.value.tier === 'vvip')
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

  // ✅ 修復：組件卸載時清理定時器
  onBeforeUnmount(() => {
    if (progressTimer) {
      clearTimeout(progressTimer);
      progressTimer = null;
    }
  });

  return {
    // State
    membershipInfo,
    isLoading,
    error,
    upgradeProgress,

    // Actions
    loadMembershipInfo,
    loadMembership: loadMembershipInfo, // 別名，用於向後兼容
    upgradeMembership,
    cancelMembership,
    getUpgradePricePreview, // ✅ 2025-11-30 新增

    // Computed
    currentTier,
    isActive,
    isFree,
    isLite, // ✅ 2025-11-30 新增
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
