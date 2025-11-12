import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { HeartIcon, ChatBubbleLeftRightIcon } from "@heroicons/vue/24/solid";
import { usePanelManager } from "../usePanelManager";
import { useVirtualScroll } from "../useVirtualScroll";
import { fallbackMatches } from "../../utils/matchFallback";

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

// 面板類型配置
const PANEL_CONFIGS = {
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
};

export function useRecordDetail(
  recentConversations,
  popularCharacters,
  popularHasMore,
  fetchPopularCharacters
) {
  const router = useRouter();
  const route = useRoute();

  // 使用 Panel Manager
  const panel = usePanelManager(router, route, PANEL_CONFIGS);

  // 虛擬滾動（優化版）
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

  // 所有記錄（根據面板類型返回不同的數據源）
  const allRecentRecordEntries = computed(() => {
    // 如果是排行面板，使用 popularCharacters
    if (panel.currentType.value === "ranking") {
      return popularCharacters.value.map((item, index) => {
        return {
          id: `popular-record-${item.id}-${index}`,
          matchId: item.id,
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

    // 否則使用最近對話數據
    const sourceData =
      recentConversations.value.length > 0
        ? recentConversations.value
        : fallbackMatches;

    return sourceData.map((item, index) => {
      // 處理對話數據格式
      const isConversation = item.conversationId || item.characterId;
      const matchId = isConversation
        ? item.conversationId || item.characterId || item.id
        : item.id;
      const character = isConversation ? item.character : item;

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

  // 顯示的記錄（虛擬滾動）
  const recentRecordEntries = computed(() => {
    // 如果是排行面板，顯示所有已加載的數據（不需要虛擬滾動切片）
    if (panel.currentType.value === "ranking") {
      return allRecentRecordEntries.value;
    }
    // 其他面板使用虛擬滾動
    return allRecentRecordEntries.value.slice(0, displayedRecordsCount.value);
  });

  // 是否還有更多記錄可以加載
  const hasMoreRecords = computed(() => {
    // 如果是排行面板，使用 API 的 hasMore 狀態
    if (panel.currentType.value === "ranking") {
      return popularHasMore.value;
    }
    // 其他面板使用虛擬滾動
    return displayedRecordsCount.value < allRecentRecordEntries.value.length;
  });

  // 加載更多記錄（用於排行面板的 API 調用）
  const loadMoreRecordsForRanking = async () => {
    if (!popularHasMore.value) {
      return;
    }
    await fetchPopularCharacters({ reset: false });
  };

  // 滾動事件處理
  const handleRecordsScroll = (event) => {
    // 如果是排行面板，使用 API 加載
    if (panel.currentType.value === "ranking") {
      handleVirtualScroll(event, hasMoreRecords.value, loadMoreRecordsForRanking);
    } else {
      // 其他面板使用本地虛擬滾動
      handleVirtualScroll(event, hasMoreRecords.value);
    }
  };

  // 開啟面板 - 包裝 panel.open 並添加業務邏輯
  const openRecentRecords = async (type = "reconnect") => {
    await panel.open(type, async (panelType) => {
      // 如果是排行面板，重置並加載排行數據
      if (panelType === "ranking") {
        await fetchPopularCharacters({ reset: true });
      } else {
        // 其他面板重置虛擬滾動狀態
        resetDisplayedRecords();
      }
    });
  };

  // 關閉面板
  const closeRecentRecords = () => {
    panel.close();
  };

  // 打開聊天
  const openChatForEntry = (entry) => {
    const matchId =
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
    // Panel 狀態
    panel,

    // 記錄數據
    allRecentRecordEntries,
    recentRecordEntries,
    hasMoreRecords,
    isLoadingMoreRecords,
    recordsListRef,

    // 方法
    openRecentRecords,
    closeRecentRecords,
    handleRecordsScroll,
    openChatForEntry,
  };
}
