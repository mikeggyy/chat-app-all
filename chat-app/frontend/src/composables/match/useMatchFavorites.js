/**
 * Match 收藏管理 Composable
 *
 * 管理角色收藏功能：
 * - 收藏/取消收藏
 * - 收藏列表同步
 * - Optimistic UI 更新
 * - 錯誤處理和回滾
 *
 * @example
 * const favorites = useMatchFavorites({
 *   user: userRef,
 *   firebaseAuth,
 *   onUpdateProfile: (newProfile) => setUserProfile(newProfile)
 * });
 *
 * // 切換收藏狀態
 * await favorites.toggleFavorite('match-001');
 *
 * // 檢查是否已收藏
 * const isFavorited = favorites.isFavorited('match-001');
 */

import { ref, reactive, computed } from 'vue';
import { apiJson } from '../../utils/api';

/**
 * 創建收藏管理
 *
 * @param {Object} options - 配置選項
 * @param {import('vue').Ref} options.user - 用戶資料 ref
 * @param {Object} options.firebaseAuth - Firebase 認證實例
 * @param {Function} options.onUpdateProfile - 更新用戶資料回調
 * @param {Function} options.requireLogin - 遊客登入提示函數
 * @returns {Object} 收藏管理方法和狀態
 */
export function useMatchFavorites(options = {}) {
  const { user, firebaseAuth, onUpdateProfile, requireLogin } = options;

  // 收藏狀態
  const favoriteIds = ref(new Set());
  const favoriteMutating = ref(false);
  const favoriteError = ref('');

  // 請求狀態（防止重複請求）
  const favoriteRequestState = reactive({
    loading: false,
    lastUserId: '',
  });

  /**
   * 同步收藏 Set
   * @param {Array<string>} favorites - 收藏列表
   */
  const syncFavoriteSet = (favorites) => {
    const list = Array.isArray(favorites) ? favorites : [];
    favoriteIds.value = new Set(list);
  };

  /**
   * 獲取當前用戶的收藏列表
   * @param {Object} options - 配置選項
   * @param {boolean} options.skipGlobalLoading - 是否跳過全局載入提示
   * @returns {Promise<void>}
   */
  const fetchFavoritesForCurrentUser = async (options = {}) => {
    const targetProfile = user?.value;
    const targetUserId = targetProfile?.id;
    if (!targetUserId) {
      return;
    }

    // 防止重複請求
    if (favoriteRequestState.loading) {
      return;
    }

    favoriteRequestState.loading = true;

    let headers = {};
    try {
      const token = await firebaseAuth.getCurrentUserIdToken();
      headers = {
        Authorization: `Bearer ${token}`,
      };
    } catch (tokenError) {
      const currentProfile = user?.value;
      const profileMismatch =
        !currentProfile?.id || currentProfile.id !== targetUserId;

      if (profileMismatch) {
        favoriteRequestState.loading = false;
        return;
      }

      const expectedUnauthenticated =
        (tokenError instanceof Error &&
          tokenError.message.includes('尚未登入')) ||
        (typeof tokenError?.code === 'string' &&
          tokenError.code.includes('auth/'));

      if (!expectedUnauthenticated && import.meta.env.DEV) {
        console.warn('獲取認證 token 失敗:', tokenError);
      }
    }

    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(targetUserId)}/favorites`,
        {
          method: 'GET',
          headers: Object.keys(headers).length ? headers : undefined,
          skipGlobalLoading: options.skipGlobalLoading ?? true,
        }
      );

      const favorites = Array.isArray(response?.favorites)
        ? response.favorites
        : [];

      const currentProfile = user?.value;
      if (currentProfile?.id !== targetUserId) {
        return;
      }

      const existingFavorites = Array.isArray(currentProfile.favorites)
        ? currentProfile.favorites
        : [];

      const isSameFavorites =
        existingFavorites.length === favorites.length &&
        existingFavorites.every((value, index) => value === favorites[index]);

      favoriteRequestState.lastUserId = targetUserId;

      syncFavoriteSet(favorites);

      // 只在數據不同時更新 profile
      if (!isSameFavorites && onUpdateProfile) {
        onUpdateProfile({
          ...currentProfile,
          favorites,
        });
      }
    } catch (err) {
      if (err?.status === 404) {
        favoriteRequestState.lastUserId = targetUserId;
        syncFavoriteSet([]);
        const currentProfile = user?.value;
        if (currentProfile?.id === targetUserId && onUpdateProfile) {
          onUpdateProfile({
            ...currentProfile,
            favorites: [],
          });
        }
        return;
      }
      if (import.meta.env.DEV) {
        console.error('獲取收藏列表失敗:', err);
      }
    } finally {
      favoriteRequestState.loading = false;
    }
  };

  /**
   * 切換收藏狀態
   * @param {string} matchId - 配對角色 ID
   * @returns {Promise<boolean>} 是否成功
   */
  const toggleFavorite = async (matchId) => {
    favoriteError.value = '';

    if (favoriteMutating.value || !matchId) {
      return false;
    }

    // 檢查是否為遊客
    if (requireLogin && requireLogin({ feature: '收藏角色' })) {
      return false;
    }

    const currentProfile = user?.value;
    if (!currentProfile?.id) {
      favoriteError.value = '請登入後才能收藏角色。';
      return false;
    }

    let token;
    try {
      token = await firebaseAuth.getCurrentUserIdToken();
    } catch (authError) {
      favoriteError.value =
        authError instanceof Error
          ? authError.message
          : '取得登入資訊時發生錯誤，請重新登入後再試。';
      return false;
    }

    favoriteMutating.value = true;
    const wasFavorited = favoriteIds.value.has(matchId);
    const previousSet = new Set(favoriteIds.value);
    const optimisticSet = new Set(previousSet);

    // Optimistic UI 更新
    if (wasFavorited) {
      optimisticSet.delete(matchId);
    } else {
      optimisticSet.add(matchId);
    }

    favoriteIds.value = optimisticSet;

    try {
      const endpoint = wasFavorited
        ? `/api/users/${encodeURIComponent(
            currentProfile.id
          )}/favorites/${encodeURIComponent(matchId)}`
        : `/api/users/${encodeURIComponent(currentProfile.id)}/favorites`;

      const response = await apiJson(endpoint, {
        method: wasFavorited ? 'DELETE' : 'POST',
        body: wasFavorited ? undefined : { matchId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        skipGlobalLoading: true,
      });

      const favoritesList = Array.isArray(response?.favorites)
        ? response.favorites
        : [];

      favoriteIds.value = new Set(favoritesList);
      if (onUpdateProfile) {
        onUpdateProfile({
          ...currentProfile,
          favorites: favoritesList,
        });
      }

      return true;
    } catch (requestError) {
      // 錯誤時回滾
      favoriteIds.value = previousSet;
      favoriteError.value =
        requestError instanceof Error
          ? requestError.message
          : '更新收藏時發生錯誤，請稍後再試。';
      if (import.meta.env.DEV) {
        console.error('切換收藏失敗:', requestError);
      }
      return false;
    } finally {
      favoriteMutating.value = false;
    }
  };

  /**
   * 檢查角色是否已收藏
   * @param {string} matchId - 配對角色 ID
   * @returns {boolean} 是否已收藏
   */
  const isFavorited = (matchId) => {
    return favoriteIds.value.has(matchId);
  };

  /**
   * 清除收藏錯誤
   */
  const clearError = () => {
    favoriteError.value = '';
  };

  return {
    // 狀態
    favoriteIds,
    favoriteMutating,
    favoriteError,
    favoriteRequestState,

    // 方法
    syncFavoriteSet,
    fetchFavoritesForCurrentUser,
    toggleFavorite,
    isFavorited,
    clearError,
  };
}
