/**
 * Match 數據載入 Composable
 *
 * 管理配對角色數據的載入和狀態：
 * - 從 API 載入配對列表
 * - 使用 API 緩存服務
 * - Fallback 數據處理
 * - 錯誤處理
 *
 * @example
 * const matchData = useMatchData({
 *   user: userRef
 * });
 *
 * // 載入配對列表
 * await matchData.loadMatches();
 *
 * // 獲取配對數據
 * const matches = matchData.matches.value;
 */

import { ref } from 'vue';
import { apiJson } from '../../utils/api';
import { fallbackMatches } from '../../utils/matchFallback';
import { apiCache, cacheKeys, cacheTTL } from '../../services/apiCache.service';

/**
 * 創建配對數據管理
 *
 * @param {Object} options - 配置選項
 * @param {import('vue').Ref} options.user - 用戶資料 ref
 * @returns {Object} 配對數據方法和狀態
 */
export function useMatchData(options = {}) {
  const { user } = options;

  // 數據狀態
  const matches = ref([]);
  const isLoading = ref(false);
  const error = ref('');

  /**
   * 載入配對列表
   * @returns {Promise<Array>} 配對角色列表
   */
  const loadMatches = async () => {
    isLoading.value = true;
    error.value = '';

    try {
      const currentUserId = user?.value?.id;
      const endpoint = currentUserId
        ? `/match/all?userId=${encodeURIComponent(currentUserId)}`
        : '/match/all';

      // 使用 API 緩存服務，5 分鐘緩存
      const data = await apiCache.fetch(
        cacheKeys.matches({ userId: currentUserId || 'guest' }),
        () => apiJson(endpoint, { skipGlobalLoading: true }),
        cacheTTL.MATCHES
      );

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('尚未建立配對角色資料');
      }

      matches.value = data;
      return data;
    } catch (err) {
      // 使用 fallback 數據
      const fallbackData = Array.isArray(fallbackMatches)
        ? fallbackMatches.map((item) => ({ ...item }))
        : [];

      if (fallbackData.length) {
        matches.value = fallbackData;
        error.value = '暫時無法連線至配對服務，已載入示範角色資料。';
        if (import.meta.env.DEV) {
          console.error('載入匹配列表失敗:', err);
        }
        return fallbackData;
      } else {
        matches.value = [];
        error.value =
          err instanceof Error ? err.message : '取得配對資料時發生錯誤';
        throw err;
      }
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 清除錯誤
   */
  const clearError = () => {
    error.value = '';
  };

  return {
    // 狀態
    matches,
    isLoading,
    error,

    // 方法
    loadMatches,
    clearError,
  };
}
