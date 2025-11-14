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
import { logger } from '../../utils/logger';

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

  // 收藏狀態（使用數組而非 Set，確保 Vue 響應式系統能正確追蹤）
  const favoriteIds = ref([]);
  const favoriteMutating = ref(false);
  const favoriteError = ref('');

  // 請求狀態（防止重複請求）
  const favoriteRequestState = reactive({
    loading: false,
    lastUserId: '',
  });

  /**
   * 同步收藏列表
   * @param {Array<string>} favorites - 收藏列表
   */
  const syncFavoriteSet = (favorites) => {
    const list = Array.isArray(favorites) ? favorites : [];
    favoriteIds.value = [...list]; // 創建新數組確保響應式更新
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

      if (!expectedUnauthenticated) {
        logger.warn('獲取認證 token 失敗:', tokenError);
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

      // ✅ 修復：favorites 在 response.data 裡面
      const responseData = response?.data || response;
      const favorites = Array.isArray(responseData?.favorites)
        ? responseData.favorites
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
      logger.error('獲取收藏列表失敗:', err);
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
    const requestUserId = currentProfile.id; // 保存請求時的用戶 ID
    const wasFavorited = favoriteIds.value.includes(matchId);
    const previousList = [...favoriteIds.value]; // 保存舊列表

    // Optimistic UI 更新
    if (wasFavorited) {
      favoriteIds.value = favoriteIds.value.filter(id => id !== matchId);
      logger.log(`[收藏] Optimistic 移除: ${matchId}`);
    } else {
      favoriteIds.value = [...favoriteIds.value, matchId];
      logger.log(`[收藏] Optimistic 添加: ${matchId}`);
    }

    logger.log(`[收藏] favoriteIds 已更新, length: ${favoriteIds.value.length}, list:`, favoriteIds.value);

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

      logger.log('[收藏] 完整 API 響應:', response);

      // 檢查競態條件：如果請求完成時用戶已切換，忽略響應數據
      if (user?.value?.id !== requestUserId) {
        logger.warn('用戶已切換，忽略過期的收藏更新');
        // 不回滾，保持當前用戶的狀態（可能已被 watch 更新為新用戶的收藏）
        return false;
      }

      // ✅ 修復：favorites 在 response.data 裡面，不是在 response 根部
      const responseData = response?.data || response; // 兼容不同的響應格式
      const favoritesList = Array.isArray(responseData?.favorites)
        ? responseData.favorites
        : [];

      favoriteIds.value = [...favoritesList];
      logger.log(`[收藏] API 成功，更新 favoriteIds, length: ${favoriteIds.value.length}, list:`, favoritesList);

      // 使用最新的用戶資料，並保護回調執行
      if (onUpdateProfile) {
        try {
          const latestProfile = user?.value;
          if (latestProfile?.id === requestUserId) {
            onUpdateProfile({
              ...latestProfile,
              favorites: favoritesList,
            });
          }
        } catch (callbackError) {
          logger.warn('更新用戶資料回調失敗:', callbackError);
          // 不中斷主流程，繼續返回成功
        }
      }

      return true;
    } catch (requestError) {
      // 檢查競態條件：如果請求失敗時用戶已切換，不回滾
      if (user?.value?.id !== requestUserId) {
        logger.warn('用戶已切換，忽略過期的收藏更新錯誤');
        return false;
      }

      // 錯誤時回滾（僅當用戶未切換時）
      favoriteIds.value = previousList;
      favoriteError.value =
        requestError instanceof Error
          ? requestError.message
          : '更新收藏時發生錯誤，請稍後再試。';
      logger.error('切換收藏失敗:', requestError);
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
    return favoriteIds.value.includes(matchId);
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
