/**
 * 收藏管理 Composable
 *
 * 管理角色收藏功能，包括：
 * - 收藏/取消收藏角色
 * - 樂觀更新（Optimistic Update）
 * - 錯誤回滾（Error Rollback）
 */

import { ref } from 'vue';
import { apiJson } from '../../utils/api';

/**
 * 創建收藏管理 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.getPartnerId - 獲取角色 ID
 * @param {Function} deps.getUser - 獲取用戶資料
 * @param {Function} deps.getFirebaseAuth - 獲取 Firebase Auth 實例
 * @param {Function} deps.setUserProfile - 更新用戶資料
 * @param {Function} deps.requireLogin - 遊客登錄檢查
 * @param {Function} deps.showError - 顯示錯誤提示
 * @param {Function} deps.showSuccess - 顯示成功提示
 * @returns {Object} 收藏管理相關的狀態和方法
 */
export function useFavoriteManagement(deps) {
  const {
    getCurrentUserId,
    getPartnerId,
    getUser,
    getFirebaseAuth,
    setUserProfile,
    requireLogin,
    showError,
    showSuccess,
  } = deps;

  // ==========================================
  // 狀態
  // ==========================================
  const isFavoriteMutating = ref(false);

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 切換收藏狀態（使用樂觀更新）
   * @returns {Promise<void>}
   */
  const toggleFavorite = async () => {
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

      showSuccess(wasFavorited ? '已取消收藏' : '已加入收藏');
    } catch (error) {
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

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 狀態
    isFavoriteMutating,

    // 方法
    toggleFavorite,
  };
}
