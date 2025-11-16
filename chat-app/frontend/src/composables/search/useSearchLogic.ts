import { ref, computed, type Ref, type ComputedRef } from "vue";
import { fallbackMatches } from "../../utils/matchFallback.js";

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
interface DisplayResult {
  id: string;
  matchId: string;
  name: string | undefined;
  description: string | undefined;
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
}

export function useSearchLogic(): UseSearchLogicReturn {
  const searchQuery: Ref<string> = ref("");
  const submittedQuery: Ref<string> = ref("");

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

    return fallbackMatches.filter((match: Match) => {
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
      name: match.display_name,
      description: match.background,
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
  };
}
