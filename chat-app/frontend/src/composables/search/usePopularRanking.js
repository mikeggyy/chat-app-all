import { ref, computed, onMounted } from "vue";
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

export function usePopularRanking() {
  const popularCharacters = ref([]);
  const isLoadingPopular = ref(false);
  const popularOffset = ref(0);
  const popularHasMore = ref(true);
  const POPULAR_PAGE_SIZE = 20; // 每次加載 20 個

  // 獲取人氣排行角色
  const fetchPopularCharacters = async ({ reset = false } = {}) => {
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
      const response = await apiJson(
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
  const popularRanking = computed(() => {
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
