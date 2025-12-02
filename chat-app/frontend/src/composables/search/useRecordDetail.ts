import { ref, computed, type Ref, type ComputedRef } from "vue";
import { useRoute, useRouter, type Router, type RouteLocationNormalizedLoaded } from "vue-router";
import { HeartIcon, ChatBubbleLeftRightIcon, TrophyIcon } from "@heroicons/vue/24/solid";
import { usePanelManager } from "../usePanelManager.js";
import { useVirtualScroll } from "../useVirtualScroll.js";
import { fallbackMatches } from "../../utils/matchFallback.js";
import type { FunctionalComponent, SVGAttributes } from "vue";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Heroicons icon component type
 */
type HeroIcon = FunctionalComponent<SVGAttributes>;

/**
 * Panel type identifier
 */
export type PanelType = "reconnect" | "ranking" | "contribution";

/**
 * Icon key for badge display
 */
type IconKey = "heart" | "fire" | "trophy";

/**
 * Panel configuration structure
 */
interface PanelConfig {
  description: string;
  badgeLabel: string;
  icon: HeroIcon;
  iconKey: IconKey;
  heroImage: string;
}

/**
 * Panel configurations map
 */
type PanelConfigsMap = {
  [K in PanelType]: PanelConfig;
};

/**
 * Metric display configuration
 */
interface RecordMetric {
  key: string;
  label: string;
  value: string;
  icon: HeroIcon;
}

/**
 * Record entry for display
 */
interface RecordEntry {
  id: string;
  matchId: string;
  name: string;
  description: string;
  image: string;
  tagline: string;
  metrics: RecordMetric[];
}

/**
 * Character data structure
 * id 為可選以兼容 ConversationItem 的 character 屬性
 */
interface Character {
  id?: string;
  display_name?: string;
  name?: string;
  background?: string;
  portraitUrl?: string;
  avatar?: string;
  totalFavorites?: number;
  messageCount?: number;
  totalChatUsers?: number;
}

/**
 * Popular character data (from API)
 */
interface PopularCharacter extends Character {
  // Inherits all Character fields
}

/**
 * Contribution character data (from API)
 */
interface ContributionCharacter {
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
  topContributors: Array<{
    rank: number;
    userId: string;
    points: number;
    displayName: string;
  }>;
}

/**
 * Conversation data structure
 */
export interface Conversation {
  conversationId?: string;
  characterId?: string;
  id?: string;
  character?: Character;
}

/**
 * Match fallback data structure
 */
interface MatchFallback {
  id: string;
  display_name?: string;
  name?: string;
  background?: string;
  portraitUrl?: string;
  avatar?: string;
  totalFavorites?: number;
  messageCount?: number;
}

/**
 * Return type of useRecordDetail composable
 */
interface UseRecordDetailReturn {
  panel: ReturnType<typeof usePanelManager>;
  allRecentRecordEntries: ComputedRef<RecordEntry[]>;
  recentRecordEntries: ComputedRef<RecordEntry[]>;
  hasMoreRecords: ComputedRef<boolean>;
  isLoadingMoreRecords: Ref<boolean>;
  recordsListRef: Ref<HTMLElement | null>;
  openRecentRecords: (type?: PanelType) => Promise<void>;
  closeRecentRecords: () => void;
  handleRecordsScroll: (event: Event) => void;
  openChatForEntry: (entry: RecordEntry) => void;
}

/**
 * Fetch popular characters function type
 */
interface FetchPopularCharactersOptions {
  reset: boolean;
}

type FetchPopularCharactersFn = (options: FetchPopularCharactersOptions) => Promise<void>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format number to short form (K, M)
 * @param num - Number to format
 * @returns Formatted string (e.g., "1.5K", "2.3M")
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

// ============================================================================
// Panel Configurations
// ============================================================================

const PANEL_CONFIGS: PanelConfigsMap = {
  reconnect: {
    description: "",
    badgeLabel: "重新連線",
    icon: HeartIcon,
    iconKey: "heart",
    heroImage: "/banner/reconnect-hero.webp",
  },
  ranking: {
    description: "排行榜每日更新，鎖定最受歡迎的互動角色與連載。",
    badgeLabel: "人氣排行",
    icon: HeartIcon,
    iconKey: "fire",
    heroImage: "/banner/ranking-hero.webp",
  },
  contribution: {
    description: "粉絲送禮排行榜，看看誰最受寵愛！",
    badgeLabel: "貢獻排行",
    icon: TrophyIcon,
    iconKey: "trophy",
    heroImage: "/banner/ranking-hero.webp",
  },
};

// ============================================================================
// Main Composable
// ============================================================================

/**
 * Record detail panel composable
 *
 * Manages record detail panel display with support for:
 * - Recent conversations (reconnect panel)
 * - Popular characters ranking (ranking panel)
 * - Virtual scrolling for performance
 * - Lazy loading for API-based data
 *
 * @param recentConversations - Reactive array of recent conversation data
 * @param popularCharacters - Reactive array of popular character data
 * @param popularHasMore - Whether more popular characters can be loaded
 * @param fetchPopularCharacters - Function to fetch more popular characters
 * @returns Record detail composable state and methods
 */
export function useRecordDetail(
  recentConversations: Ref<Conversation[]>,
  popularCharacters: Ref<PopularCharacter[]>,
  popularHasMore: Ref<boolean>,
  fetchPopularCharacters: FetchPopularCharactersFn,
  contributionCharacters: Ref<ContributionCharacter[]> = ref([])
): UseRecordDetailReturn {
  const router: Router = useRouter();
  const route: RouteLocationNormalizedLoaded = useRoute();

  // Use Panel Manager
  const panel = usePanelManager(router, route, PANEL_CONFIGS);

  // Virtual scroll (optimized)
  const {
    displayedCount: displayedRecordsCount,
    isLoadingMore: isLoadingMoreRecords,
    containerRef: recordsListRef,
    reset: resetDisplayedRecords,
    handleScroll: handleVirtualScroll,
  } = useVirtualScroll({
    initialCount: 5,
    incrementCount: 5,
    loadDelay: 300,
    scrollThreshold: 500,
  });

  // All records (returns different data source based on panel type)
  const allRecentRecordEntries: ComputedRef<RecordEntry[]> = computed(() => {
    // If ranking panel, use popularCharacters
    if (panel.currentType.value === "ranking") {
      return popularCharacters.value.map((item: PopularCharacter, index: number): RecordEntry => {
        const itemId = item.id || '';
        return {
          id: `popular-record-${itemId}-${index}`,
          matchId: itemId,
          name: item.display_name || item.name || "未知角色",
          description: item.background || "",
          image: item.portraitUrl || item.avatar || "/ai-role/match-role-01.webp",
          tagline: "",
          metrics: [
            {
              key: "favorites",
              label: "收藏",
              value: formatNumber(item.totalFavorites || 0),
              icon: HeartIcon,
            },
            {
              key: "messages",
              label: "對話數",
              value: formatNumber(item.messageCount || item.totalChatUsers || 0),
              icon: ChatBubbleLeftRightIcon,
            },
          ],
        };
      });
    }

    // If contribution panel, use contributionCharacters
    if (panel.currentType.value === "contribution") {
      return contributionCharacters.value.map((item: ContributionCharacter, index: number): RecordEntry => {
        return {
          id: `contribution-record-${item.id}-${index}`,
          matchId: item.matchId,
          name: item.name || "未知角色",
          description: item.description || "",
          image: item.image || "/ai-role/match-role-01.webp",
          tagline: "",
          metrics: [
            {
              key: "contributors",
              label: "粉絲數",
              value: formatNumber(item.contributorCount || 0),
              icon: HeartIcon,
            },
            {
              key: "points",
              label: "總貢獻",
              value: item.totalPointsFormatted || formatNumber(item.totalPoints || 0),
              icon: TrophyIcon,
            },
          ],
        };
      });
    }

    // Otherwise use recent conversation data
    const sourceData: (Conversation | MatchFallback)[] =
      recentConversations.value.length > 0
        ? recentConversations.value
        : fallbackMatches;

    return sourceData.map((item: Conversation | MatchFallback, index: number): RecordEntry => {
      // Handle conversation data format
      const isConversation = 'conversationId' in item || 'characterId' in item;
      const matchId: string = isConversation
        ? (item as Conversation).conversationId || (item as Conversation).characterId || item.id || ""
        : item.id || "";
      const character: Character | undefined = isConversation
        ? (item as Conversation).character
        : (item as MatchFallback);

      return {
        id: `recent-record-${matchId}-${index}`,
        matchId,
        name: character?.display_name || character?.name || "未知角色",
        description: character?.background || "",
        image:
          character?.portraitUrl ||
          character?.avatar ||
          "/ai-role/match-role-01.webp",
        tagline: "",
        metrics: [
          {
            key: "favorites",
            label: "收藏",
            value: formatNumber(character?.totalFavorites || 0),
            icon: HeartIcon,
          },
          {
            key: "messages",
            label: "對話數",
            value: formatNumber(character?.messageCount || 0),
            icon: ChatBubbleLeftRightIcon,
          },
        ],
      };
    });
  });

  // Displayed records (virtual scrolling)
  const recentRecordEntries: ComputedRef<RecordEntry[]> = computed(() => {
    // If ranking or contribution panel, show all loaded data (no virtual scroll slicing)
    if (panel.currentType.value === "ranking" || panel.currentType.value === "contribution") {
      return allRecentRecordEntries.value;
    }
    // Other panels use virtual scrolling
    return allRecentRecordEntries.value.slice(0, displayedRecordsCount.value);
  });

  // Whether more records can be loaded
  const hasMoreRecords: ComputedRef<boolean> = computed(() => {
    // If ranking panel, use API hasMore state
    if (panel.currentType.value === "ranking") {
      return popularHasMore.value;
    }
    // Contribution panel - no pagination for now
    if (panel.currentType.value === "contribution") {
      return false;
    }
    // Other panels use virtual scrolling
    return displayedRecordsCount.value < allRecentRecordEntries.value.length;
  });

  // Load more records (for ranking panel API calls)
  const loadMoreRecordsForRanking = async (): Promise<void> => {
    if (!popularHasMore.value) {
      return;
    }
    await fetchPopularCharacters({ reset: false });
  };

  // Scroll event handler
  const handleRecordsScroll = (event: Event): void => {
    // If ranking panel, use API loading
    if (panel.currentType.value === "ranking") {
      handleVirtualScroll(event, hasMoreRecords.value, loadMoreRecordsForRanking);
    } else if (panel.currentType.value === "contribution") {
      // Contribution panel - no additional loading needed
      return;
    } else {
      // Other panels use local virtual scrolling
      handleVirtualScroll(event, hasMoreRecords.value);
    }
  };

  // Open panel - wraps panel.open and adds business logic
  const openRecentRecords = async (type: PanelType = "reconnect"): Promise<void> => {
    await panel.open(type, async (panelType: string) => {
      // If ranking panel, reset and load ranking data
      if (panelType === "ranking") {
        await fetchPopularCharacters({ reset: true });
      } else {
        // Other panels reset virtual scroll state
        resetDisplayedRecords();
      }
    });
  };

  // Close panel
  const closeRecentRecords = (): void => {
    panel.close();
  };

  // Open chat
  const openChatForEntry = (entry: RecordEntry): void => {
    const matchId: string =
      typeof entry?.matchId === "string" && entry.matchId.trim().length
        ? entry.matchId
        : "";

    if (matchId) {
      void router.push({
        name: "chat",
        params: { id: matchId },
      });
      return;
    }

    void router.push({ name: "chat-list" });
  };

  return {
    // Panel state
    panel,

    // Record data
    allRecentRecordEntries,
    recentRecordEntries,
    hasMoreRecords,
    isLoadingMoreRecords,
    recordsListRef,

    // Methods
    openRecentRecords,
    closeRecentRecords,
    handleRecordsScroll,
    openChatForEntry,
  };
}
