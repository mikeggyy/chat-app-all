// @ts-nocheck
/**
 * useProfileData - 個人資料頁面數據管理 composable
 *
 * 整合並管理個人資料頁面所需的所有數據，包括：
 * - 用戶基本資料
 * - 會員狀態
 * - 金幣餘額
 * - 解鎖票券
 * - 用戶資產
 * - 通知狀態
 */

import { ref, computed, Ref, ComputedRef } from "vue";
import { useUserProfile } from "./useUserProfile.js";
import { useMembership } from "./useMembership.js";
import { useCoins } from "./useCoins.js";
import { useUnlockTickets } from "./useUnlockTickets.js";
import { useNotifications } from "./useNotifications.js";
import { useGuestGuard } from "./useGuestGuard.js";
import { FALLBACK_USER, DEFAULT_USER_ASSETS } from "../config/profile.js";
import { logger } from "../utils/logger.js";

// ==================== 類型定義 ====================

/**
 * 用戶資料類型
 */
interface UserProfile {
  id: string;
  uid?: string;
  displayName?: string;
  locale?: string;
  createdAt?: string;
  defaultPrompt?: string;
  email?: string;
  photoURL?: string;
  lastLoginAt?: string;
  phoneNumber?: string | null;
  gender?: string;
  notificationOptIn?: boolean;
  signInProvider?: string;
  updatedAt?: string;
  conversations?: Array<unknown>;
  favorites?: Array<unknown>;
}

/**
 * 用戶資產類型
 */
interface UserAssets {
  characterUnlockCards: number;
  photoUnlockCards: number;
  videoUnlockCards: number;
  voiceUnlockCards: number;
  createCards: number;
  potions: {
    memoryBoost: number;
    brainBoost: number;
  };
}

/**
 * API 返回的資產數據類型
 */
interface AssetApiResponse {
  characterUnlockCards?: number;
  photoUnlockCards?: number;
  videoUnlockCards?: number;
  voiceUnlockCards?: number;
  createCards?: number;
  potions?: {
    memoryBoost: number;
    brainBoost: number;
  };
}

/**
 * useProfileData 返回類型
 */
interface UseProfileDataReturn {
  // 用戶基本資料
  user: Ref<UserProfile | null | undefined>;
  profile: ComputedRef<UserProfile>;
  targetUserId: ComputedRef<string>;
  displayedId: ComputedRef<string>;
  avatarUrl: ComputedRef<string | undefined>;
  loadUserProfile: (userId: string, options?: any) => Promise<UserProfile>;
  updateUserAvatar: (photoURL: string) => Promise<UserProfile>;
  updateUserProfileDetails: (patch: Partial<UserProfile>) => Promise<UserProfile>;
  clearUserProfile: () => void;

  // 會員狀態
  tier: ComputedRef<string>;
  tierName: ComputedRef<string>;
  isVIP: ComputedRef<boolean>;
  isVVIP: ComputedRef<boolean>;
  isPaidMember: ComputedRef<boolean>;
  formattedExpiryDate: ComputedRef<string>;
  daysUntilExpiry: ComputedRef<number>;
  isExpiringSoon: ComputedRef<boolean>;
  loadMembership: () => Promise<any>;

  // 金幣系統
  balance: Ref<number>;
  formattedBalance: Ref<string>;
  loadBalance: () => Promise<void>;

  // 解鎖票券
  loadTicketsBalance: (userId: string, options?: any) => Promise<any>;

  // 通知狀態
  hasUnreadNotifications: Ref<boolean>;

  // 訪客檢查
  requireLogin: (options?: any) => boolean;
  isGuest: Ref<boolean>;

  // 用戶資產
  userAssets: Ref<UserAssets>;
  isLoadingAssets: Ref<boolean>;
  loadUserAssets: (userId: string) => Promise<void>;

  // 批次操作
  initializeProfileData: (userId: string) => Promise<void>;
  refreshProfileData: (userId: string) => Promise<void>;
  refreshMembershipData: () => Promise<void>;
}

// ==================== 主函數 ====================

/**
 * 個人資料頁面數據管理 composable
 * 整合並管理個人資料頁面所需的所有數據
 *
 * @returns {UseProfileDataReturn} 返回個人資料數據和操作函數
 */
export function useProfileData(): UseProfileDataReturn {
  // 用戶基本資料
  const {
    user,
    loadUserProfile,
    updateUserAvatar,
    updateUserProfileDetails,
    clearUserProfile,
  } = useUserProfile();

  // 會員狀態
  const {
    currentTier,
    isVIP,
    isVVIP,
    expiresAt,
    loadMembershipInfo,
  } = useMembership();

  // 計算會員相關屬性
  const tier = currentTier;
  const tierName = computed(() => {
    switch (currentTier.value) {
      case 'vip': return 'VIP 會員';
      case 'vvip': return 'VVIP 會員';
      default: return '免費會員';
    }
  });
  const isPaidMember = computed(() => isVIP.value || isVVIP.value);
  const formattedExpiryDate = computed(() => {
    if (!expiresAt.value) return '無限期';
    try {
      return new Date(expiresAt.value).toLocaleDateString('zh-TW');
    } catch {
      return expiresAt.value;
    }
  });
  const daysUntilExpiry = computed(() => {
    if (!expiresAt.value) return 0;
    try {
      const expiry = new Date(expiresAt.value);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  });
  const isExpiringSoon = computed(() => {
    const days = daysUntilExpiry.value;
    return days > 0 && days <= 7;
  });
  const loadMembership = loadMembershipInfo;

  // 金幣系統
  const { balance, formattedBalance, loadBalance } = useCoins();

  // 解鎖票券
  const { loadBalance: loadTicketsBalance } = useUnlockTickets();

  // 通知狀態
  const { hasUnreadNotifications } = useNotifications();

  // 訪客檢查
  const { requireLogin, isGuest } = useGuestGuard();

  // 用戶資產
  const userAssets: Ref<UserAssets> = ref({ ...DEFAULT_USER_ASSETS });
  const isLoadingAssets: Ref<boolean> = ref(false);

  // ==================== 計算屬性 ====================

  /**
   * 計算用戶資料（使用備用值防止 null）
   */
  const profile: ComputedRef<UserProfile> = computed(() => user.value ?? FALLBACK_USER);

  /**
   * 計算目標用戶 ID
   */
  const targetUserId: ComputedRef<string> = computed(() => profile.value.id ?? FALLBACK_USER.id ?? "");

  /**
   * 計算顯示的用戶 ID
   */
  const displayedId: ComputedRef<string> = computed(
    () => profile.value.uid ?? profile.value.id ?? "尚未設定"
  );

  /**
   * 計算頭像 URL
   */
  const avatarUrl: ComputedRef<string | undefined> = computed(() => profile.value.photoURL ?? FALLBACK_USER.photoURL);

  // ==================== 函數定義 ====================

  /**
   * 加載用戶資產數據
   * @param userId - 用戶 ID
   */
  const loadUserAssets = async (userId: string): Promise<void> => {
    if (!userId) return;

    isLoadingAssets.value = true;
    try {
      const { apiJson } = await import("../utils/api.js");
      const response: any = await apiJson(
        `/api/users/${encodeURIComponent(userId)}/assets`,
        {
          skipGlobalLoading: true,
        }
      );

      logger.log('[useProfileData] 收到資產響應（原始）:', response);

      // ✅ 關鍵修復：處理 sendSuccess 的響應格式
      // sendSuccess 返回 { success: true, data: {...} }
      const data = response.data || response;

      logger.log('[useProfileData] 解析後的資產數據:', data);

      // ✅ 合併：同時更新資產和金幣餘額
      if (data && typeof data === "object") {
        // 更新資產
        userAssets.value = {
          characterUnlockCards: data.characterUnlockCards ?? 0,
          photoUnlockCards: data.photoUnlockCards ?? 0,
          videoUnlockCards: data.videoUnlockCards ?? 0,
          voiceUnlockCards: data.voiceUnlockCards ?? 0,
          createCards: data.createCards ?? 0,
          potions: data.potions ?? userAssets.value.potions,
        };

        // ✅ 同時更新金幣餘額（從同一個 API）
        if (data.balance !== undefined) {
          balance.value = data.balance;
          logger.log('[useProfileData] 金幣餘額已更新:', data.balance);
        }

        logger.log('[useProfileData] 資產已更新:', userAssets.value);
        logger.log('[useProfileData] 當前金幣餘額:', balance.value);
      } else {
        logger.error('[useProfileData] 收到的資產數據格式錯誤:', response);
      }
    } catch (err) {
      logger.error("[useProfileData] 加載用戶資產失敗:", err);
    } finally {
      isLoadingAssets.value = false;
    }
  };

  /**
   * 初始化加載所有數據
   * @param userId - 用戶 ID
   */
  const initializeProfileData = async (userId: string): Promise<void> => {
    if (!userId || isGuest.value) return;

    try {
      await Promise.allSettled([
        loadUserProfile(userId),
        loadMembership(),
        loadBalance(),
        loadTicketsBalance(),
        loadUserAssets(userId),
      ]);
    } catch (error) {
      logger.error("[useProfileData] 初始化資料失敗:", error);
    }
  };

  /**
   * 刷新用戶資料（強制繞過緩存）
   * @param userId - 用戶 ID
   */
  const refreshProfileData = async (userId: string): Promise<void> => {
    if (!userId) return;

    try {
      await Promise.allSettled([
        loadUserProfile(userId, { force: true }), // 強制刷新，繞過緩存
        loadBalance(),
        loadUserAssets(userId),
      ]);
    } catch (error) {
      logger.error("[useProfileData] 刷新資料失敗:", error);
    }
  };

  /**
   * 刷新會員資料
   */
  const refreshMembershipData = async (): Promise<void> => {
    try {
      await loadMembership();
    } catch (error) {
      logger.error("[useProfileData] 刷新會員資料失敗:", error);
    }
  };

  // ==================== 返回值 ====================

  return {
    // 用戶基本資料
    user,
    profile,
    targetUserId,
    displayedId,
    avatarUrl,
    loadUserProfile,
    updateUserAvatar,
    updateUserProfileDetails,
    clearUserProfile,

    // 會員狀態
    tier,
    tierName,
    isVIP,
    isVVIP,
    isPaidMember,
    formattedExpiryDate,
    daysUntilExpiry,
    isExpiringSoon,
    loadMembership,

    // 金幣系統
    balance,
    formattedBalance,
    loadBalance,

    // 解鎖票券
    loadTicketsBalance,

    // 通知狀態
    hasUnreadNotifications,

    // 訪客檢查
    requireLogin,
    isGuest,

    // 用戶資產
    userAssets,
    isLoadingAssets,
    loadUserAssets,

    // 批次操作
    initializeProfileData,
    refreshProfileData,
    refreshMembershipData,
  };
}
