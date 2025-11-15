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

import { ref, type Ref } from 'vue';
import { apiJsonCached } from '../../utils/api.js';
import { fallbackMatches } from '../../utils/matchFallback.js';
import { cacheKeys, cacheTTL } from '../../services/apiCache.service.js';
import { logger } from '../../utils/logger.js';
import type { User, Partner } from '../../types';

/**
 * 配對數據管理選項
 */
export interface UseMatchDataOptions {
  /** 用戶資料 ref */
  user?: Ref<User | null>;
}

/**
 * 配對數據管理返回類型
 */
export interface UseMatchDataReturn {
  /** 配對角色列表 */
  matches: Ref<Partner[]>;
  /** 載入狀態 */
  isLoading: Ref<boolean>;
  /** 錯誤訊息 */
  error: Ref<string>;
  /** 載入配對列表 */
  loadMatches: () => Promise<Partner[]>;
  /** 清除錯誤 */
  clearError: () => void;
}

/**
 * 創建配對數據管理
 *
 * @param options - 配置選項
 * @returns 配對數據方法和狀態
 */
export function useMatchData(options: UseMatchDataOptions = {}): UseMatchDataReturn {
  const { user } = options;

  // 數據狀態
  const matches = ref<Partner[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<string>('');

  /**
   * 載入配對列表
   * @returns 配對角色列表
   */
  const loadMatches = async (): Promise<Partner[]> => {
    isLoading.value = true;
    error.value = '';

    try {
      const currentUserId = user?.value?.id;
      const endpoint = currentUserId
        ? `/match/all?userId=${encodeURIComponent(currentUserId)}`
        : '/match/all';

      // 使用統一的 API 緩存服務，5 分鐘緩存
      const data = await apiJsonCached<Partner[]>(endpoint, {
        cacheKey: cacheKeys.matches({ userId: currentUserId || 'guest' }),
        cacheTTL: cacheTTL.MATCHES,
        skipGlobalLoading: true,
      });

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
        logger.error('載入匹配列表失敗:', err);
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
  const clearError = (): void => {
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
