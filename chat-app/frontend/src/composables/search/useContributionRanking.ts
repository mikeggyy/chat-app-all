import { ref, computed, onMounted, type Ref, type ComputedRef } from "vue";
import { apiJson } from "../../utils/api.js";
import { logger } from "../../utils/logger.js";

// 貢獻者資訊
interface TopContributor {
  rank: number;
  userId: string;
  points: number;
  displayName: string;
}

// Character contribution data structure from API
interface CharacterContribution {
  rank: number;
  characterId: string;
  totalPoints: number;
  totalSpent: number;
  contributorCount: number;
  topContributors: TopContributor[];  // 前3名貢獻者
}

// API response structure
interface TopCharactersResponse {
  success: boolean;
  data: {
    characters: CharacterContribution[];
    totalCharacters: number;
  };
}

// Character details from match API
interface CharacterDetails {
  id: string;
  display_name?: string;
  name?: string;
  portraitUrl?: string;
  avatar?: string;
  background?: string;
}

// Formatted ranking item structure
interface ContributionRankingItem {
  id: string;
  matchId: string;
  rank: number;
  name: string;
  description: string;
  image: string;
  totalPoints: number;
  totalSpent: number;
  contributorCount: number;
  totalPointsFormatted: string;
  totalSpentFormatted: string;
  topContributors: TopContributor[];  // 前3名貢獻者
}

// Return type interface
interface UseContributionRankingReturn {
  contributionCharacters: Ref<ContributionRankingItem[]>;
  isLoadingContribution: Ref<boolean>;
  contributionRanking: ComputedRef<ContributionRankingItem[]>;
  fetchContributionRanking: () => Promise<void>;
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

export function useContributionRanking(): UseContributionRankingReturn {
  const contributionCharacters = ref<ContributionRankingItem[]>([]);
  const isLoadingContribution = ref<boolean>(false);
  const characterDetailsCache = ref<Map<string, CharacterDetails>>(new Map());

  // 獲取角色詳情
  const fetchCharacterDetails = async (characterId: string): Promise<CharacterDetails | null> => {
    // 檢查緩存
    if (characterDetailsCache.value.has(characterId)) {
      return characterDetailsCache.value.get(characterId) || null;
    }

    try {
      const response = await apiJson<any>(
        `/api/match/${characterId}`,
        { skipGlobalLoading: true }
      );
      // API 返回格式: { character: {...} } 或 { data: { character: {...} } }
      const details = response?.data?.character || response?.character || response?.data || response;
      if (details) {
        characterDetailsCache.value.set(characterId, details);
        return details;
      }
    } catch (error) {
      logger.warn(`獲取角色 ${characterId} 詳情失敗:`, error);
    }
    return null;
  };

  // 獲取貢獻排行
  const fetchContributionRanking = async (): Promise<void> => {
    if (isLoadingContribution.value) return;

    isLoadingContribution.value = true;
    try {
      const response = await apiJson<TopCharactersResponse>(
        `/api/levels/top-characters?limit=10`,
        { skipGlobalLoading: true }
      );

      if (response?.data?.characters && Array.isArray(response.data.characters)) {
        // 獲取角色詳情
        const enrichedCharacters: ContributionRankingItem[] = [];

        for (const char of response.data.characters) {
          const details = await fetchCharacterDetails(char.characterId);

          enrichedCharacters.push({
            id: `contribution-${char.characterId}`,
            matchId: char.characterId,
            rank: char.rank,
            name: details?.display_name || details?.name || char.characterId,
            description: details?.background || "",
            image: details?.portraitUrl || details?.avatar || "/ai-role/match-role-01.webp",
            totalPoints: char.totalPoints,
            totalSpent: char.totalSpent,
            contributorCount: char.contributorCount,
            totalPointsFormatted: formatNumber(char.totalPoints),
            totalSpentFormatted: formatNumber(char.totalSpent),
            topContributors: char.topContributors || [],
          });
        }

        contributionCharacters.value = enrichedCharacters;
      }
    } catch (error) {
      logger.error("獲取貢獻排行失敗:", error);
      contributionCharacters.value = [];
    } finally {
      isLoadingContribution.value = false;
    }
  };

  // 頁面掛載時獲取貢獻排行
  onMounted(() => {
    fetchContributionRanking();
  });

  // 格式化後的貢獻排行列表（前 10 個）
  const contributionRanking = computed<ContributionRankingItem[]>(() => {
    return contributionCharacters.value.slice(0, 10);
  });

  return {
    contributionCharacters,
    isLoadingContribution,
    contributionRanking,
    fetchContributionRanking,
  };
}
