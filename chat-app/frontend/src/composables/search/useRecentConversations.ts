// @ts-nocheck
import { ref, computed, watch, type Ref, type ComputedRef } from "vue";
import { apiJson } from "../../utils/api.js";
import { fallbackMatches } from "../../utils/matchFallback.js";
import { logger } from "../../utils/logger.js";
import { useIsMounted } from "../useIsMounted.js";

/**
 * 對話記錄的角色資訊
 */
interface ConversationCharacter {
  display_name?: string;
  name?: string;
  background?: string;
  portraitUrl?: string;
  avatar?: string;
  messageCount?: number;
  totalFavorites?: number;
}

/**
 * API 返回的對話記錄項目
 */
interface ConversationItem {
  conversationId?: string;
  characterId?: string;
  id?: string;
  character?: ConversationCharacter;
}

/**
 * API 返回的對話列表響應
 */
interface ConversationsResponse {
  success?: boolean;
  data?: {
    conversations?: ConversationItem[];
  };
  // 兼容直接返回 conversations 的情況
  conversations?: ConversationItem[];
}

/**
 * 格式化後的最近對話項目
 */
interface FormattedConversation {
  id: string;
  matchId: string;
  name: string;
  description: string;
  image: string;
  messageCount: number;
  favoritesCount: number;
  messageCountFormatted: string;
  favoritesCountFormatted: string;
}

/**
 * 用戶資訊介面
 */
interface User {
  id?: string;
}

/**
 * 格式化數字為簡短形式（K, M）
 * @param num - 要格式化的數字
 * @returns 格式化後的字串
 */
const formatNumber = (num: number | undefined | null): string => {
  if (!num || num === 0) return "0";
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};

/**
 * 最近對話管理 composable
 * @param user - 用戶資訊 ref
 * @returns 最近對話相關的狀態和方法
 */
export function useRecentConversations(user: Ref<User | null>) {
  const recentConversations = ref<ConversationItem[]>([]);
  const isLoadingRecent = ref<boolean>(false);

  // ✅ 追蹤組件掛載狀態，防止快速路由切換時的競態條件
  const isMounted = useIsMounted();

  /**
   * 獲取真實的最近對話列表
   */
  const fetchRecentConversations = async (): Promise<void> => {
    if (!user.value?.id) {
      return;
    }

    isLoadingRecent.value = true;
    try {
      const response = await apiJson<ConversationsResponse>(
        `/api/users/${encodeURIComponent(user.value.id)}/conversations?limit=10`,
        { skipGlobalLoading: true }
      );

      // ✅ 檢查組件是否已卸載
      if (!isMounted.value) {
        return;
      }

      // 兼容兩種 API 響應格式：
      // 1. { success: true, data: { conversations: [...] } }
      // 2. { conversations: [...] }
      const conversations = response?.data?.conversations || response?.conversations;
      if (conversations && Array.isArray(conversations)) {
        recentConversations.value = conversations;
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
    async (newId) => {
      if (newId) {
        await fetchRecentConversations();

        // ✅ 檢查組件是否已卸載
        if (!isMounted.value) {
          return;
        }
      }
    },
    { immediate: true }
  );

  /**
   * 格式化後的最近對話列表
   */
  const recentlyViewed: ComputedRef<FormattedConversation[]> = computed(() => {
    // 如果有真實的對話數據，使用真實數據
    if (recentConversations.value.length > 0) {
      return recentConversations.value.slice(0, 10).map((conv, index) => ({
        id: `recent-${conv.conversationId || conv.id}-${index}`,
        matchId: conv.conversationId || conv.characterId || conv.id || "",
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
