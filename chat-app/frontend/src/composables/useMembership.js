import { ref, computed } from 'vue';
import { apiJson } from '../utils/api.js';
import { generateIdempotencyKey } from '../utils/idempotency.js';
import { logger } from '../utils/logger';

// 會員資訊的全域狀態
const membershipState = ref(null);
const isLoading = ref(false);
const error = ref(null);

/**
 * 會員系統 composable
 * 管理用戶的會員資訊、等級、功能權限等
 */
export function useMembership() {
  /**
   * 載入用戶的會員資訊
   * @param {string} userId - 用戶 ID
   * @param {object} options - 選項
   */
  const loadMembership = async (userId, options = {}) => {
    if (!userId) {
      error.value = '需要提供用戶 ID';
      return null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson(`/api/membership/${encodeURIComponent(userId)}`, {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      membershipState.value = data;
      return data;
    } catch (err) {
      error.value = err?.message || '載入會員資訊失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 升級會員等級
   * @param {string} userId - 用戶 ID
   * @param {string} targetTier - 目標等級 ('vip' | 'vvip')
   * @param {object} options - 選項
   */
  const upgradeMembership = async (userId, targetTier, options = {}) => {
    if (!userId || !targetTier) {
      error.value = '需要提供用戶 ID 和目標等級';
      throw new Error('需要提供用戶 ID 和目標等級');
    }

    if (!['vip', 'vvip'].includes(targetTier)) {
      error.value = '無效的會員等級';
      throw new Error('無效的會員等級');
    }

    isLoading.value = true;
    error.value = null;

    try {
      // 生成冪等性鍵，防止重複升級
      const idempotencyKey = generateIdempotencyKey();

      const data = await apiJson(`/api/membership/${encodeURIComponent(userId)}/upgrade`, {
        method: 'POST',
        body: {
          tier: targetTier, // 後端參數名為 tier
          idempotencyKey, // 添加冪等性鍵（必填）
          durationMonths: options.durationMonths || 1,
          autoRenew: options.autoRenew || false,
          paymentMethod: options.paymentMethod || 'credit_card',
          paymentId: options.paymentId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 檢查是否為重複請求（來自緩存）
      if (data._idempotent || data._cached) {
        logger.log('[會員升級] 檢測到重複請求，返回了緩存結果');
      }

      membershipState.value = data.membership || data;
      return data;
    } catch (err) {
      error.value = err?.message || '升級會員失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 取消會員訂閱
   * @param {string} userId - 用戶 ID
   */
  const cancelMembership = async (userId) => {
    if (!userId) {
      error.value = '需要提供用戶 ID';
      throw new Error('需要提供用戶 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson(`/api/membership/${encodeURIComponent(userId)}/cancel`, {
        method: 'POST',
      });

      membershipState.value = data;
      return data;
    } catch (err) {
      error.value = err?.message || '取消會員訂閱失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Computed properties
  const tier = computed(() => membershipState.value?.tier || 'free');
  const tierName = computed(() => {
    const names = {
      free: '免費會員',
      vip: 'VIP',
      vvip: 'VVIP'
    };
    return names[tier.value] || '免費會員';
  });

  const features = computed(() => membershipState.value?.features || {});
  const pricing = computed(() => membershipState.value?.pricing || {});
  const expiresAt = computed(() => membershipState.value?.expiresAt);
  const isActive = computed(() => membershipState.value?.isActive || false);

  // 是否為付費會員
  const isPaidMember = computed(() => ['vip', 'vvip'].includes(tier.value));

  // 是否為 VIP
  const isVIP = computed(() => tier.value === 'vip');

  // 是否為 VVIP
  const isVVIP = computed(() => tier.value === 'vvip');

  // 訂閱狀態
  const subscriptionStatus = computed(() => membershipState.value?.subscriptionStatus || 'none');

  // 格式化到期日期
  const formattedExpiryDate = computed(() => {
    if (!expiresAt.value) return null;
    try {
      const date = new Date(expiresAt.value);
      return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return null;
    }
  });

  // 距離到期的天數
  const daysUntilExpiry = computed(() => {
    if (!expiresAt.value) return null;
    try {
      const now = new Date();
      const expiry = new Date(expiresAt.value);
      const diffTime = expiry - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch {
      return null;
    }
  });

  // 是否即將到期（少於 7 天）
  const isExpiringSoon = computed(() => {
    const days = daysUntilExpiry.value;
    return days !== null && days > 0 && days <= 7;
  });

  // 是否已過期
  const isExpired = computed(() => {
    const days = daysUntilExpiry.value;
    return days !== null && days === 0;
  });

  return {
    // State
    membership: membershipState,
    isLoading,
    error,

    // Actions
    loadMembership,
    upgradeMembership,
    cancelMembership,

    // Computed
    tier,
    tierName,
    features,
    pricing,
    expiresAt,
    isActive,
    isPaidMember,
    isVIP,
    isVVIP,
    subscriptionStatus,
    formattedExpiryDate,
    daysUntilExpiry,
    isExpiringSoon,
    isExpired,
  };
}
