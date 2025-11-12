import { ref, computed, watch } from "vue";
import { apiJson } from "../../utils/api";
import { fallbackMatches } from "../../utils/matchFallback";
import { logger } from "../../utils/logger";

// 格式化數字為簡短形式（K, M）
const formatNumber = (num) => {
  if (!num || num === 0) return "0";
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};

export function useRecentConversations(user) {
  const recentConversations = ref([]);
  const isLoadingRecent = ref(false);

  // 獲取真實的最近對話列表
  const fetchRecentConversations = async () => {
    if (!user.value?.id) {
      return;
    }

    isLoadingRecent.value = true;
    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(user.value.id)}/conversations?limit=10`,
        { skipGlobalLoading: true }
      );

      if (response?.conversations && Array.isArray(response.conversations)) {
        recentConversations.value = response.conversations;
      }
    } catch (error) {
      logger.error("獲取最近對話失敗:", error);
      recentConversations.value = [];
    } finally {
      isLoadingRecent.value = false;
    }
  };

  // 當用戶登入時自動獲取
  watch(
    () => user.value?.id,
    (newId) => {
      if (newId) {
        fetchRecentConversations();
      }
    },
    { immediate: true }
  );

  // 格式化後的最近對話列表
  const recentlyViewed = computed(() => {
    // 如果有真實的對話數據，使用真實數據
    if (recentConversations.value.length > 0) {
      return recentConversations.value.slice(0, 10).map((conv, index) => ({
        id: `recent-${conv.conversationId || conv.id}-${index}`,
        matchId: conv.conversationId || conv.characterId || conv.id,
        name: conv.character?.display_name || conv.character?.name || "未知角色",
        description: conv.character?.background || "",
        image:
          conv.character?.portraitUrl ||
          conv.character?.avatar ||
          "/ai-role/match-role-01.webp",
        messageCount: conv.character?.messageCount || 0,
        favoritesCount: conv.character?.totalFavorites || 0,
        messageCountFormatted: formatNumber(conv.character?.messageCount || 0),
        favoritesCountFormatted: formatNumber(
          conv.character?.totalFavorites || 0
        ),
      }));
    }

    // 如果用戶已登入但沒有對話數據，返回空數組（顯示空狀態提示）
    if (user.value?.id) {
      return [];
    }

    // 未登入用戶使用 fallback 數據
    return fallbackMatches.slice(0, 10).map((item, index) => ({
      id: `recent-${item.id}-${index}`,
      matchId: item.id,
      name: item.display_name,
      description: item.background,
      image: item.portraitUrl,
      messageCount: 0,
      favoritesCount: item.totalFavorites || 0,
      messageCountFormatted: "0",
      favoritesCountFormatted: formatNumber(item.totalFavorites || 0),
    }));
  });

  return {
    recentConversations,
    isLoadingRecent,
    recentlyViewed,
    fetchRecentConversations,
  };
}
