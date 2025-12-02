import { ref, computed, onMounted, type Ref, type ComputedRef } from "vue";
import { apiJson } from "../../utils/api.js";
import { fallbackMatches } from "../../utils/matchFallback.js";
import { logger } from "../../utils/logger.js";

// Character data structure from API
interface CharacterData {
  id: string;
  display_name?: string;
  name?: string;
  background?: string;
  portraitUrl?: string;
  avatar?: string;
  messageCount?: number;
  totalFavorites?: number;
}

// API response structure
interface PopularCharactersResponse {
  characters: CharacterData[];
  hasMore?: boolean;
}

// Formatted ranking item structure
interface RankingItem {
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

// Fetch options interface
interface FetchOptions {
  reset?: boolean;
}

// Return type interface
interface UsePopularRankingReturn {
  popularCharacters: Ref<CharacterData[]>;
  isLoadingPopular: Ref<boolean>;
  popularOffset: Ref<number>;
  popularHasMore: Ref<boolean>;
  popularRanking: ComputedRef<RankingItem[]>;
  fetchPopularCharacters: (options?: FetchOptions) => Promise<void>;
}

// 格式化數字為簡短形式（K, M）
const formatNumber = (num: number | undefined): string => {
  if (!num || num === 0) return "0";
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};

export function usePopularRanking(): UsePopularRankingReturn {
  const popularCharacters = ref<CharacterData[]>([]);
  const isLoadingPopular = ref<boolean>(false);
  const popularOffset = ref<number>(0);
  const popularHasMore = ref<boolean>(true);
  const POPULAR_PAGE_SIZE = 20; // 每次加載 20 個

  // 獲取人氣排行角色
  const fetchPopularCharacters = async (
    { reset = false }: FetchOptions = {}
  ): Promise<void> => {
    // 如果不是重置且已經沒有更多數據，或者正在加載中，則不執行
    if (!reset && (!popularHasMore.value || isLoadingPopular.value)) {
      return;
    }

    // 如果是重置，清空數據並重置狀態
    if (reset) {
      popularCharacters.value = [];
      popularOffset.value = 0;
      popularHasMore.value = true;
    }

    isLoadingPopular.value = true;
    try {
      const response = await apiJson<PopularCharactersResponse>(
        `/api/match/popular?limit=${POPULAR_PAGE_SIZE}&offset=${popularOffset.value}`,
        { skipGlobalLoading: true }
      );

      if (response?.characters && Array.isArray(response.characters)) {
        // 如果是重置，直接替換；否則追加
        if (reset) {
          popularCharacters.value = response.characters;
        } else {
          popularCharacters.value = [
            ...popularCharacters.value,
            ...response.characters,
          ];
        }

        // 更新 offset 和 hasMore
        popularOffset.value += response.characters.length;
        popularHasMore.value =
          response.hasMore !== false &&
          response.characters.length === POPULAR_PAGE_SIZE;
      }
    } catch (error) {
      logger.error("獲取人氣排行失敗:", error);
      if (reset) {
        popularCharacters.value = [];
      }
    } finally {
      isLoadingPopular.value = false;
    }
  };

  // 頁面掛載時獲取人氣排行
  onMounted(() => {
    fetchPopularCharacters({ reset: true });
  });

  // 格式化後的人氣排行列表（前 10 個用於預覽）
  const popularRanking = computed<RankingItem[]>(() => {
    // 如果有真實的人氣數據，使用真實數據
    if (popularCharacters.value.length > 0) {
      return popularCharacters.value.slice(0, 10).map((char, index) => ({
        id: `popular-${char.id}-${index}`,
        matchId: char.id,
        name: char.display_name || char.name || "未知角色",
        description: char.background || "",
        image: char.portraitUrl || char.avatar || "/ai-role/match-role-01.webp",
        messageCount: char.messageCount || 0,
        favoritesCount: char.totalFavorites || 0,
        messageCountFormatted: formatNumber(char.messageCount || 0),
        favoritesCountFormatted: formatNumber(char.totalFavorites || 0),
      }));
    }

    // 沒有數據時使用 fallback
    return fallbackMatches.slice(0, 10).map((item, index) => ({
      id: `popular-${item.id}-${index}`,
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
    popularCharacters,
    isLoadingPopular,
    popularOffset,
    popularHasMore,
    popularRanking,
    fetchPopularCharacters,
  };
}
