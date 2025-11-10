import { ref, unref } from "vue";
import { apiJson } from "../utils/api";

/**
 * 分頁載入對話列表 Composable
 *
 * @param {Ref<string>|string} userId - 用戶 ID（可以是 ref 或普通值）
 * @param {number} pageSize - 每頁數量
 * @returns {Object} - 對話列表和相關方法
 */
export function usePaginatedConversations(userId, pageSize = 20) {
  const conversations = ref([]);
  const nextCursor = ref(null);
  const hasMore = ref(true);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);

  /**
   * 初始載入（第一頁）
   */
  const loadInitial = async () => {
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
      );

      conversations.value = response.conversations || [];
      nextCursor.value = response.nextCursor || null;
      hasMore.value = response.hasMore || false;
    } catch (error) {
      console.error('[對話載入] 初始載入失敗:', error);
      conversations.value = [];
      hasMore.value = false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 載入更多（分頁）
   */
  const loadMore = async () => {
    const currentUserId = unref(userId);

    if (!currentUserId || !hasMore.value || isLoadingMore.value || !nextCursor.value) {
      return { hasMore: hasMore.value };
    }

    isLoadingMore.value = true;

    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(currentUserId)}/conversations?limit=${pageSize}&cursor=${nextCursor.value}`,
        { skipGlobalLoading: true }
      );

      const newConversations = response.conversations || [];

      // 將新對話添加到列表末尾
      conversations.value = [...conversations.value, ...newConversations];

      nextCursor.value = response.nextCursor || null;
      hasMore.value = response.hasMore || false;

      return { hasMore: hasMore.value };
    } catch (error) {
      console.error('[對話載入] 分頁載入失敗:', error);
      hasMore.value = false;
      return { hasMore: false };
    } finally {
      isLoadingMore.value = false;
    }
  };

  /**
   * 重新載入（清空後重新載入第一頁）
   */
  const reload = async () => {
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
