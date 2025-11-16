/**
 * useFavoriteManagement.ts
 * 收藏管理 Composable（TypeScript 版本）
 * 管理角色收藏功能，包括樂觀更新和錯誤回滾
 */

import { ref, type Ref } from 'vue';
import { apiJson } from '../../utils/api.js';
import type { FirebaseAuthService, User } from '../../types';

// ==================== 類型定義 ====================

/**
 * useFavoriteManagement 依賴項
 */
export interface UseFavoriteManagementDeps {
  getCurrentUserId: () => string;
  getPartnerId: () => string;
  getPartnerName?: () => string;
  getUser: () => User | null;
  getFirebaseAuth: () => FirebaseAuthService;
  setUserProfile: (profile: User) => void;
  requireLogin: (options: { feature: string }) => boolean;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

/**
 * useFavoriteManagement 返回類型
 */
export interface UseFavoriteManagementReturn {
  isFavoriteMutating: Ref<boolean>;
  toggleFavorite: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 創建收藏管理 composable
 * @param deps - 依賴項
 * @returns 收藏管理相關的狀態和方法
 */
export function useFavoriteManagement(deps: UseFavoriteManagementDeps): UseFavoriteManagementReturn {
  const {
    getCurrentUserId,
    getPartnerId,
    getPartnerName,
    getUser,
    getFirebaseAuth,
    setUserProfile,
    requireLogin,
    showError,
    showSuccess,
  } = deps;

  // ====================
  // 狀態
  // ====================
  const isFavoriteMutating: Ref<boolean> = ref(false);

  // ====================
  // 核心方法
  // ====================

  /**
   * 切換收藏狀態（使用樂觀更新）
   */
  const toggleFavorite = async (): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    // 檢查遊客權限
    if (requireLogin({ feature: '收藏角色' })) {
      return;
    }

    // 防止重複操作
    if (isFavoriteMutating.value) return;

    const currentProfile = getUser();
    if (!currentProfile?.id) {
      showError('請登入後才能收藏角色。');
      return;
    }

    isFavoriteMutating.value = true;

    // 保存當前的收藏列表（用於錯誤回滾）
    const previousFavorites = Array.isArray(currentProfile.favorites)
      ? [...currentProfile.favorites]
      : [];

    const wasFavorited = previousFavorites.includes(matchId);
    const optimisticSet = new Set(previousFavorites);

    // 樂觀更新：立即更新 UI
    if (wasFavorited) {
      optimisticSet.delete(matchId);
    } else {
      optimisticSet.add(matchId);
    }

    // 立即更新本地狀態
    setUserProfile({
      ...currentProfile,
      favorites: Array.from(optimisticSet),
    });

    try {
      // 調用後端 API
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();
      const endpoint = wasFavorited
        ? `/api/users/${encodeURIComponent(
            userId
          )}/favorites/${encodeURIComponent(matchId)}`
        : `/api/users/${encodeURIComponent(userId)}/favorites`;

      const response = await apiJson(endpoint, {
        method: wasFavorited ? 'DELETE' : 'POST',
        body: wasFavorited ? undefined : { matchId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        skipGlobalLoading: true,
      });

      // 使用後端返回的收藏列表（如果有的話）
      const favoritesList = Array.isArray(response?.favorites)
        ? response.favorites
        : Array.from(optimisticSet);

      // 更新為後端返回的最新狀態
      setUserProfile({
        ...currentProfile,
        favorites: favoritesList,
      });

      // 顯示提示消息（包含角色名稱）
      const partnerName = getPartnerName ? getPartnerName() : '';
      const message = wasFavorited
        ? `已取消收藏${partnerName ? ` ${partnerName}` : ''}`
        : `已收藏${partnerName ? ` ${partnerName}` : ''}`;
      showSuccess(message);
    } catch (error: any) {
      // 錯誤回滾：恢復到之前的狀態
      setUserProfile({
        ...currentProfile,
        favorites: previousFavorites,
      });
      showError(
        error instanceof Error
          ? error.message
          : '更新收藏時發生錯誤，請稍後再試。'
      );
    } finally {
      isFavoriteMutating.value = false;
    }
  };

  // ====================
  // 返回 API
  // ====================
  return {
    // 狀態
    isFavoriteMutating,

    // 方法
    toggleFavorite,
  };
}
