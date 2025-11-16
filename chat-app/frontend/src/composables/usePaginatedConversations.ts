import { ref, unref, Ref } from 'vue';
import { apiJson } from '../utils/api.js';
import { logger } from '../utils/logger.js';

/**
 * 對話基本信息接口
 */
interface Conversation {
  [key: string]: any;
}

/**
 * 分頁載入對話列表 API 響應接口
 */
interface PaginatedConversationsResponse {
  conversations: Conversation[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * 載入更多返回值接口
 */
interface LoadMoreResult {
  hasMore: boolean;
}

/**
 * 分頁載入對話列表 Composable 返回值接口
 */
interface UsePaginatedConversationsReturn {
  conversations: Ref<Conversation[]>;
  hasMore: Ref<boolean>;
  isLoading: Ref<boolean>;
  isLoadingMore: Ref<boolean>;
  loadInitial: () => Promise<void>;
  loadMore: () => Promise<LoadMoreResult>;
  reload: () => Promise<void>;
}

/**
 * 分頁載入對話列表 Composable
 *
 * @param userId - 用戶 ID（可以是 ref 或普通值）
 * @param pageSize - 每頁數量，默認 20
 * @returns 對話列表和相關方法
 */
export function usePaginatedConversations(
  userId: Ref<string> | string,
  pageSize: number = 20
): UsePaginatedConversationsReturn {
  const conversations: Ref<Conversation[]> = ref([]);
  const nextCursor: Ref<string | null> = ref(null);
  const hasMore: Ref<boolean> = ref(true);
  const isLoading: Ref<boolean> = ref(false);
  const isLoadingMore: Ref<boolean> = ref(false);

  /**
   * 初始載入（第一頁）
   */
  const loadInitial = async (): Promise<void> => {
    const currentUserId = unref(userId);

    if (!currentUserId) {
      conversations.value = [];
      return;
    }

    isLoading.value = true;

    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(currentUserId)}/conversations?limit=${pageSize}`,
        { skipGlobalLoading: true }
      ) as any;

      // ✅ 修復：處理包裝在 data 字段中的響應
      const data = response?.data || response;
      conversations.value = data.conversations || [];
      nextCursor.value = data.nextCursor || null;
      hasMore.value = data.hasMore || false;
    } catch (error) {
      logger.error('[對話載入] 初始載入失敗:', error);
      conversations.value = [];
      hasMore.value = false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入更多（分頁）
   */
  const loadMore = async (): Promise<LoadMoreResult> => {
    const currentUserId = unref(userId);

    if (!currentUserId || !hasMore.value || isLoadingMore.value || !nextCursor.value) {
      return { hasMore: hasMore.value };
    }

    isLoadingMore.value = true;

    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(currentUserId)}/conversations?limit=${pageSize}&cursor=${nextCursor.value}`,
        { skipGlobalLoading: true }
      ) as any;

      // ✅ 修復：處理包裝在 data 字段中的響應
      const data = response?.data || response;
      const newConversations = data.conversations || [];

      // 將新對話添加到列表末尾
      conversations.value = [...conversations.value, ...newConversations];

      nextCursor.value = data.nextCursor || null;
      hasMore.value = data.hasMore || false;

      return { hasMore: hasMore.value };
    } catch (error) {
      logger.error('[對話載入] 分頁載入失敗:', error);
      hasMore.value = false;
      return { hasMore: false };
    } finally {
      isLoadingMore.value = false;
    }
  };

  /**
   * 重新載入（清空後重新載入第一頁）
   */
  const reload = async (): Promise<void> => {
    conversations.value = [];
    nextCursor.value = null;
    hasMore.value = true;
    await loadInitial();
  };

  return {
    conversations,
    hasMore,
    isLoading,
    isLoadingMore,
    loadInitial,
    loadMore,
    reload,
  };
}
