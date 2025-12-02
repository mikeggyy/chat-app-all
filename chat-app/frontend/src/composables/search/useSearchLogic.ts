import { ref, computed, onMounted, type Ref, type ComputedRef } from "vue";
import { fallbackMatches } from "../../utils/matchFallback.js";
import { apiJsonCached } from "../../utils/api.js";
import { logger } from "../../utils/logger.js";

// 定義角色匹配介面
interface Match {
  id: string;
  locale: string;
  creatorUid: string;
  creatorDisplayName?: string;
  creator?: string;
  display_name?: string;
  gender: string;
  voice: string;
  background?: string;
  first_message: string;
  secret_background: string;
  totalChatUsers: number;
  totalFavorites: number;
  portraitUrl: string;
}

// 定義顯示結果介面
// 與 SearchResults.vue 的 CharacterProfile 類型兼容
interface DisplayResult {
  id: string;
  matchId: string;
  name: string;
  description: string;
  image: string;
  author: string;
}

// 定義 composable 返回型別
interface UseSearchLogicReturn {
  searchQuery: Ref<string>;
  submittedQuery: Ref<string>;
  hasSubmittedQuery: ComputedRef<boolean>;
  filteredMatches: ComputedRef<Match[]>;
  displayedResults: ComputedRef<DisplayResult[]>;
  isFallbackResult: ComputedRef<boolean>;
  handleSearch: () => void;
  resetSearch: () => void;
  isLoadingCharacters: Ref<boolean>;
}

export function useSearchLogic(): UseSearchLogicReturn {
  const searchQuery: Ref<string> = ref("");
  const submittedQuery: Ref<string> = ref("");
  const allCharacters: Ref<Match[]> = ref([]);
  const isLoadingCharacters: Ref<boolean> = ref(false);

  // 從後端 API 獲取所有角色
  const loadAllCharacters = async (): Promise<void> => {
    try {
      isLoadingCharacters.value = true;
      const data = await apiJsonCached("/match/all", {
        cacheKey: "search-all-characters",
        cacheTTL: 300000, // 5 分鐘緩存
        skipGlobalLoading: true,
      });

      if (Array.isArray(data) && data.length > 0) {
        allCharacters.value = data;
        logger.log(`[搜尋] 成功載入 ${data.length} 個角色`);
      } else {
        logger.warn("[搜尋] API 返回空數據，使用 fallback 數據");
        allCharacters.value = fallbackMatches;
      }
    } catch (error) {
      logger.error("[搜尋] 載入角色失敗:", error);
      // 失敗時使用 fallback 數據
      allCharacters.value = fallbackMatches;
    } finally {
      isLoadingCharacters.value = false;
    }
  };

  // 組件掛載時載入角色數據
  onMounted(() => {
    loadAllCharacters();
  });

  // 是否已提交搜尋
  const hasSubmittedQuery: ComputedRef<boolean> = computed(
    () => submittedQuery.value.trim().length > 0
  );

  // 篩選後的結果
  const filteredMatches: ComputedRef<Match[]> = computed(() => {
    if (!hasSubmittedQuery.value) {
      return [];
    }

    const keyword: string = submittedQuery.value.trim().toLowerCase();

    // 使用從 API 獲取的角色數據進行搜尋（如果已載入）
    const charactersToSearch = allCharacters.value.length > 0
      ? allCharacters.value
      : fallbackMatches;

    return charactersToSearch.filter((match: Match) => {
      const name: string = match.display_name?.toLowerCase() ?? "";
      const background: string = match.background?.toLowerCase() ?? "";

      return name.includes(keyword) || background.includes(keyword);
    });
  });

  // 格式化創建者名稱
  const formatCreatorHandle = (match: Match | null | undefined): string => {
    if (!match || typeof match !== "object") {
      return "@system";
    }

    const displayName: string =
      typeof match.creatorDisplayName === "string"
        ? match.creatorDisplayName.trim()
        : "";
    if (displayName.length) {
      return `@${displayName}`;
    }

    const fallbackCreator: string =
      typeof match.creator === "string" ? match.creator.trim() : "";
    if (fallbackCreator.length) {
      return `@${fallbackCreator}`;
    }

    const uid: string =
      typeof match.creatorUid === "string" ? match.creatorUid.trim() : "";
    if (uid.length) {
      return `@${uid}`;
    }

    return "@system";
  };

  // 顯示的搜尋結果
  const displayedResults: ComputedRef<DisplayResult[]> = computed(() => {
    if (!hasSubmittedQuery.value) {
      return [];
    }

    const source: Match[] = filteredMatches.value.length
      ? filteredMatches.value
      : fallbackMatches;

    return source.map((match: Match, index: number): DisplayResult => ({
      id: `search-result-${match.id}-${index}`,
      matchId: match.id,
      name: match.display_name || '未知角色',
      description: match.background || '',
      image: match.portraitUrl,
      author: formatCreatorHandle(match),
    }));
  });

  // 是否為 fallback 結果（無完全符合）
  const isFallbackResult: ComputedRef<boolean> = computed(
    () => hasSubmittedQuery.value && filteredMatches.value.length === 0
  );

  // 提交搜尋
  const handleSearch = (): void => {
    const keyword: string = searchQuery.value.trim();

    if (!keyword) {
      submittedQuery.value = "";
      return;
    }

    submittedQuery.value = keyword;
  };

  // 重置搜尋
  const resetSearch = (): void => {
    searchQuery.value = "";
    submittedQuery.value = "";
  };

  return {
    searchQuery,
    submittedQuery,
    hasSubmittedQuery,
    filteredMatches,
    displayedResults,
    isFallbackResult,
    handleSearch,
    resetSearch,
    isLoadingCharacters,
  };
}
