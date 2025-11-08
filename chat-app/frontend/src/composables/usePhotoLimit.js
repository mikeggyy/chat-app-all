/**
 * 拍照限制 Composable
 * 管理用戶的 AI 自拍照片生成次數限制
 * 使用統一的基礎限制服務模組
 */

import { computed } from 'vue';
import { createLimitService } from './useBaseLimitService.js';
import { useUserProfile } from './useUserProfile';
import { isGuestUser, isDevUser } from '../../../../shared/config/testAccounts';

// 創建拍照限制服務實例
// 🔒 安全配置：publicCheck=false, publicStats=false 表示 API 需要認證，userId 從 token 獲取
const photoLimitService = createLimitService({
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

export function usePhotoLimit() {
  const { user } = useUserProfile();

  const {
    limitData: photoLimitData,
    isLoading,
    error,
    checkLimit,
    getStats,
    purchaseCards,
    clearState,
  } = photoLimitService;

  const userId = computed(() => user.value?.id || '');

  // 測試帳號特殊處理
  const isTestAccount = computed(() => isDevUser(userId.value));

  const tier = computed(() => {
    return photoLimitData.value?.tier || 'free';
  });

  const remaining = computed(() => {
    return photoLimitData.value?.remaining || 0;
  });

  const used = computed(() => {
    return photoLimitData.value?.used || 0;
  });

  const total = computed(() => {
    return photoLimitData.value?.photosLimit || 0;
  });

  const cards = computed(() => photoLimitData.value?.photoCards || 0); // ✅ 修復：後端返回的是 photoCards

  const resetPeriod = computed(() => {
    return photoLimitData.value?.resetPeriod || 'lifetime';
  });

  /**
   * 取得拍照限制統計
   */
  const fetchPhotoStats = async () => {
    if (!userId.value || isGuestUser(userId.value)) {
      return;
    }

    return getStats(userId.value, { skipGlobalLoading: true });
  };

  /**
   * 檢查是否可以生成拍照
   */
  const canGeneratePhoto = async () => {
    if (!userId.value || isGuestUser(userId.value)) {
      return {
        allowed: false,
        reason: 'guest_user',
        requireLogin: true,
      };
    }

    try {
      return await checkLimit(userId.value, null, { skipGlobalLoading: true });
    } catch (err) {
      return {
        allowed: false,
        reason: 'error',
      };
    }
  };

  /**
   * 購買拍照卡
   */
  const purchasePhotoCards = async (quantity, paymentInfo) => {
    if (!userId.value || isGuestUser(userId.value)) {
      throw new Error('遊客無法購買拍照卡');
    }

    return purchaseCards(userId.value, quantity, paymentInfo);
  };

  /**
   * 格式化限制說明文字
   */
  const getLimitDescription = computed(() => {
    if (!photoLimitData.value) {
      return '';
    }

    const { tier: tierValue, resetPeriod: resetPeriodValue, photosLimit } = photoLimitData.value;

    if (resetPeriodValue === 'lifetime') {
      return `免費用戶終生 ${photosLimit} 次`;
    } else if (resetPeriodValue === 'monthly') {
      if (tierValue === 'vvip') {
        return `VVIP 會員每月 ${photosLimit} 次`;
      } else if (tierValue === 'vip') {
        return `VIP 會員每月 ${photosLimit} 次`;
      }
    }

    return '';
  });

  return {
    // 狀態
    photoLimitData,
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
