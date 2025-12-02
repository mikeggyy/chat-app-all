/**
 * usePhotoLimit.ts
 * 拍照限制 Composable（TypeScript 版本）
 * 管理用戶的 AI 自拍照片生成次數限制
 * 使用統一的基礎限制服務模組
 */

import { computed, type ComputedRef, type Ref } from 'vue';
import { createLimitService, type LimitServiceReturn, type PaymentInfo } from './useBaseLimitService.js';
import { useUserProfile } from './useUserProfile.js';
import { isGuestUser } from '../../../../shared/config/testAccounts.js';
import type { LimitCheckResult, PhotoLimitInfo } from '../types';

// ==================== 類型定義 ====================

/**
 * 拍照檢查結果
 */
export interface PhotoCheckResult {
  allowed: boolean;
  reason?: string;
  requireLogin?: boolean;
}

/**
 * 拍照限制返回類型
 */
export interface UsePhotoLimitReturn {
  // State
  photoLimitData: Ref<LimitCheckResult | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;

  // Computed
  tier: ComputedRef<string>;
  remaining: ComputedRef<number>;
  used: ComputedRef<number>;
  total: ComputedRef<number>;
  cards: ComputedRef<number>;
  resetPeriod: ComputedRef<string>;
  getLimitDescription: ComputedRef<string>;

  // Methods
  fetchPhotoStats: () => Promise<any>;
  canGeneratePhoto: () => Promise<PhotoCheckResult | LimitCheckResult>;
  purchasePhotoCards: (quantity: number, paymentInfo: PaymentInfo) => Promise<any>;
}

// ==================== Composable 主函數 ====================

// 創建拍照限制服務實例
// 🔒 安全配置：publicCheck=false, publicStats=false 表示 API 需要認證，userId 從 token 獲取
const photoLimitService: LimitServiceReturn = createLimitService({
  serviceName: '拍照限制',
  apiBasePath: '/api/photo-limit',
  perCharacter: false, // 不按角色追蹤
  publicCheck: false, // check 路由需要認證，userId 從 token 獲取
  publicStats: false, // stats 路由需要認證，userId 從 token 獲取
  // 使用預設端點，不需要覆蓋
  // 預設端點會自動生成正確的路由：
  // - check: /api/photo-limit/check（需要認證，不帶 userId）
  // - stats: /api/photo-limit/stats（需要認證，不帶 userId）
});

export function usePhotoLimit(): UsePhotoLimitReturn {
  const { user } = useUserProfile();

  const {
    limitData: photoLimitData,
    isLoading,
    error,
    checkLimit,
    getStats,
    purchaseCards,
    // clearState, // 未使用
  } = photoLimitService;

  const userId = computed(() => user.value?.id || '');

  const tier = computed(() => {
    const data = photoLimitData.value as PhotoLimitInfo | null;
    return data?.tier || 'free';
  });

  const remaining = computed(() => {
    const data = photoLimitData.value as PhotoLimitInfo | LimitCheckResult | null;
    return data?.remaining || 0;
  });

  const used = computed(() => {
    const data = photoLimitData.value as PhotoLimitInfo | null;
    return data?.used || 0;
  });

  const total = computed(() => {
    const data = photoLimitData.value as PhotoLimitInfo | null;
    // API 可能返回 photosLimit 或 total
    return data?.photosLimit ?? data?.total ?? 0;
  });

  const cards = computed(() => {
    const data = photoLimitData.value as PhotoLimitInfo | null;
    // API 返回 photoCards 或 cards
    return data?.photoCards ?? data?.cards ?? 0;
  });

  const resetPeriod = computed(() => {
    const data = photoLimitData.value as PhotoLimitInfo | null;
    return data?.resetPeriod || 'lifetime';
  });

  /**
   * 取得拍照限制統計
   */
  const fetchPhotoStats = async (): Promise<any> => {
    if (!userId.value || isGuestUser(userId.value)) {
      return;
    }

    return getStats(userId.value, { skipGlobalLoading: true });
  };

  /**
   * 檢查是否可以生成拍照
   */
  const canGeneratePhoto = async (): Promise<PhotoCheckResult | LimitCheckResult> => {
    if (!userId.value || isGuestUser(userId.value)) {
      return {
        allowed: false,
        reason: 'guest_user',
        requireLogin: true,
      };
    }

    try {
      const result = await checkLimit(userId.value, undefined, { skipGlobalLoading: true });
      return result || {
        allowed: false,
        reason: 'error',
      };
    } catch (err) {
      return {
        allowed: false,
        reason: 'error',
      };
    }
  };

  /**
   * 購買照片解鎖卡
   */
  const purchasePhotoCards = async (quantity: number, paymentInfo: PaymentInfo): Promise<any> => {
    if (!userId.value || isGuestUser(userId.value)) {
      throw new Error('遊客無法購買照片解鎖卡');
    }

    return purchaseCards(userId.value, quantity, paymentInfo);
  };

  /**
   * 格式化限制說明文字
   */
  const getLimitDescription = computed(() => {
    const data = photoLimitData.value as PhotoLimitInfo | null;
    if (!data) {
      return '';
    }

    const tierValue = data.tier || 'free';
    const resetPeriodValue = data.resetPeriod || 'lifetime';
    const photosLimit = data.photosLimit ?? data.total ?? 0;

    // ✅ 2025-11-30 更新：新增 Lite 等級支援
    if (resetPeriodValue === 'lifetime' || resetPeriodValue === 'none') {
      if (tierValue === 'lite') {
        return `Lite 會員可用金幣購買 AI 照片`;
      }
      return `免費用戶終生 ${photosLimit} 次`;
    } else if (resetPeriodValue === 'monthly') {
      if (tierValue === 'vvip') {
        return `VVIP 會員每月 ${photosLimit} 次`;
      } else if (tierValue === 'vip') {
        return `VIP 會員每月 ${photosLimit} 次`;
      } else if (tierValue === 'lite') {
        return `Lite 會員可用金幣購買 AI 照片`;
      }
    }

    return '';
  });

  return {
    // 狀態
    photoLimitData: photoLimitData as Ref<LimitCheckResult | null>,
    isLoading,
    error,

    // 計算屬性
    tier,
    remaining,
    used,
    total,
    cards,
    resetPeriod,
    getLimitDescription,

    // 方法
    fetchPhotoStats,
    canGeneratePhoto,
    purchasePhotoCards,
  };
}
