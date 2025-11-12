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

import { ref, computed } from "vue";
import { useUserProfile } from "./useUserProfile";
import { useMembership } from "./useMembership";
import { useCoins } from "./useCoins";
import { useUnlockTickets } from "./useUnlockTickets";
import { useNotifications } from "./useNotifications";
import { useGuestGuard } from "./useGuestGuard";
import { FALLBACK_USER, DEFAULT_USER_ASSETS } from "../config/profile";
import { logger } from "../utils/logger";

export function useProfileData() {
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
    tier,
    tierName,
    isVIP,
    isVVIP,
    isPaidMember,
    formattedExpiryDate,
    daysUntilExpiry,
    isExpiringSoon,
    loadMembership,
  } = useMembership();

  // 金幣系統
  const { balance, formattedBalance, loadBalance } = useCoins();

  // 解鎖票券
  const { loadBalance: loadTicketsBalance } = useUnlockTickets();

  // 通知狀態
  const { hasUnreadNotifications } = useNotifications();

  // 訪客檢查
  const { requireLogin, isGuest } = useGuestGuard();

  // 用戶資產
  const userAssets = ref({ ...DEFAULT_USER_ASSETS });
  const isLoadingAssets = ref(false);

  // 計算屬性
  const profile = computed(() => user.value ?? FALLBACK_USER);

  const targetUserId = computed(() => profile.value.id ?? FALLBACK_USER.id ?? "");

  const displayedId = computed(
    () => profile.value.uid ?? profile.value.id ?? "尚未設定"
  );

  const avatarUrl = computed(() => profile.value.photoURL ?? FALLBACK_USER.photoURL);

  /**
   * 加載用戶資產數據
   * @param {string} userId - 用戶 ID
   */
  const loadUserAssets = async (userId) => {
    if (!userId) return;

    isLoadingAssets.value = true;
    try {
      const { apiJson } = await import("../utils/api.js");
      const data = await apiJson(
        `/api/users/${encodeURIComponent(userId)}/assets`,
        {
          skipGlobalLoading: true,
        }
      );

      // 只更新已定義的欄位，避免訪問未定義的屬性
      if (data && typeof data === "object") {
        userAssets.value = {
          characterUnlockCards: data.characterUnlockCards ?? 0,
          photoUnlockCards: data.photoUnlockCards ?? 0,
          videoUnlockCards: data.videoUnlockCards ?? 0,
          voiceUnlockCards: data.voiceUnlockCards ?? 0,
          createCards: data.createCards ?? 0,
          potions: data.potions ?? userAssets.value.potions,
        };
      }
    } catch (err) {
      logger.error("[useProfileData] 加載用戶資產失敗:", err);
    } finally {
      isLoadingAssets.value = false;
    }
  };

  /**
   * 初始化加載所有數據
   * @param {string} userId - 用戶 ID
   */
  const initializeProfileData = async (userId) => {
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
   * 刷新用戶資料
   * @param {string} userId - 用戶 ID
   */
  const refreshProfileData = async (userId) => {
    if (!userId) return;

    try {
      await Promise.allSettled([
        loadUserProfile(userId),
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
  const refreshMembershipData = async () => {
    try {
      await loadMembership();
    } catch (error) {
      logger.error("[useProfileData] 刷新會員資料失敗:", error);
    }
  };

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
