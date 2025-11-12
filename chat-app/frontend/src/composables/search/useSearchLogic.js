import { ref, computed } from "vue";
import { fallbackMatches } from "../../utils/matchFallback";

export function useSearchLogic() {
  const searchQuery = ref("");
  const submittedQuery = ref("");

  // 是否已提交搜尋
  const hasSubmittedQuery = computed(
    () => submittedQuery.value.trim().length > 0
  );

  // 篩選後的結果
  const filteredMatches = computed(() => {
    if (!hasSubmittedQuery.value) {
      return [];
    }

    const keyword = submittedQuery.value.trim().toLowerCase();

    return fallbackMatches.filter((match) => {
      const name = match.display_name?.toLowerCase() ?? "";
      const background = match.background?.toLowerCase() ?? "";

      return name.includes(keyword) || background.includes(keyword);
    });
  });

  // 格式化創建者名稱
  const formatCreatorHandle = (match) => {
    if (!match || typeof match !== "object") {
      return "@system";
    }

    const displayName =
      typeof match.creatorDisplayName === "string"
        ? match.creatorDisplayName.trim()
        : "";
    if (displayName.length) {
      return `@${displayName}`;
    }

    const fallbackCreator =
      typeof match.creator === "string" ? match.creator.trim() : "";
    if (fallbackCreator.length) {
      return `@${fallbackCreator}`;
    }

    const uid =
      typeof match.creatorUid === "string" ? match.creatorUid.trim() : "";
    if (uid.length) {
      return `@${uid}`;
    }

    return "@system";
  };

  // 顯示的搜尋結果
  const displayedResults = computed(() => {
    if (!hasSubmittedQuery.value) {
      return [];
    }

    const source = filteredMatches.value.length
      ? filteredMatches.value
      : fallbackMatches;

    return source.map((match, index) => ({
      id: `search-result-${match.id}-${index}`,
      matchId: match.id,
      name: match.display_name,
      description: match.background,
      image: match.portraitUrl,
      author: formatCreatorHandle(match),
    }));
  });

  // 是否為 fallback 結果（無完全符合）
  const isFallbackResult = computed(
    () => hasSubmittedQuery.value && filteredMatches.value.length === 0
  );

  // 提交搜尋
  const handleSearch = () => {
    const keyword = searchQuery.value.trim();

    if (!keyword) {
      submittedQuery.value = "";
      return;
    }

    submittedQuery.value = keyword;
  };

  // 重置搜尋
  const resetSearch = () => {
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
