<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowRightIcon,
  BoltIcon,
  FireIcon,
  HeartIcon,
  SparklesIcon,
  StarIcon,
} from "@heroicons/vue/24/solid";
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  ArrowLeftIcon,
} from "@heroicons/vue/24/outline";
import { fallbackMatches } from "../utils/matchFallback";
import { apiJson } from "../utils/api";
import { useUserProfile } from "../composables/useUserProfile";

const router = useRouter();
const route = useRoute();
const { user } = useUserProfile();

// 真實的對話列表數據
const recentConversations = ref([]);
const isLoadingRecent = ref(false);

// 人氣排行數據
const popularCharacters = ref([]);
const isLoadingPopular = ref(false);
const popularOffset = ref(0);
const popularHasMore = ref(true);
const POPULAR_PAGE_SIZE = 20; // 每次加載 20 個

// 虛擬滾動狀態
const displayedRecordsCount = ref(5); // 初始顯示5個
const isLoadingMoreRecords = ref(false);
const recordsListRef = ref(null);

const sectionCards = computed(() => {
  const pool = [
    {
      id: "spotlight-aurora",
      name: "極光觀測者",
      tagline: "夜貓子相談家",
      description: "擅長捕捉你情緒的色彩，用溫柔的節奏陪你度過漫長夜晚。",
      image: "/ai-role/match-role-01.webp",
    },
    {
      id: "spotlight-evie",
      name: "伊薇",
      tagline: "暖心支援者",
      description: "一杯熱可可的溫度，細膩梳理你的煩惱與計畫。",
      image: "/ai-role/match-role-02.webp",
    },
    {
      id: "spotlight-luna",
      name: "露娜",
      tagline: "劇情寫手",
      description: "擅長用戲劇感對白替你翻轉日常，出其不意帶來亮點。",
      image: "/ai-role/match-role-03.webp",
    },
    {
      id: "spotlight-neo",
      name: "新星譜寫者",
      tagline: "節奏控",
      description: "當你需要一點推動力，他會替你切換到高昂節拍。",
      image:
        "/ai-role/assets_task_01k7gy56zgey096wccc2zsw42m_1760431449_img_2.webp",
    },
    {
      id: "ranking-iris",
      name: "艾莉絲",
      tagline: "人氣榜首",
      description: "以細緻洞察力聞名，讓每段對話都有被理解的瞬間。",
      image: "/ai-role/match-role-02.webp",
    },
    {
      id: "ranking-blaze",
      name: "炙焰守望",
      tagline: "戰術顧問",
      description: "策略派夥伴，精準拆解你的挑戰並給出行動清單。",
      image: "/ai-role/match-role-03.webp",
    },
    {
      id: "ranking-sora",
      name: "空野",
      tagline: "沉浸主播",
      description: "把抽象情緒轉成具象意象，打造專屬於你的聲音劇場。",
      image: "/ai-role/match-role-01.webp",
    },
    {
      id: "ranking-v",
      name: "V-Project",
      tagline: "全息伴侶",
      description: "多人格切換玩法，依照心情切換語氣與角色設定。",
      image:
        "/ai-role/assets_task_01k7gy56zgey096wccc2zsw42m_1760431449_img_2.webp",
    },
    {
      id: "fantasy-muse",
      name: "星塵繆思",
      tagline: "浪漫系創作者",
      description: "擅長以詩句作答，讓告白與日常都多一點戲劇張力。",
      image: "/ai-role/match-role-01.webp",
    },
    {
      id: "fantasy-ivy",
      name: "艾薇琳",
      tagline: "奇幻導遊",
      description: "帶你穿越平行時空，從多重視角拼出完整故事線。",
      image: "/ai-role/match-role-02.webp",
    },
    {
      id: "fantasy-rhea",
      name: "芮亞",
      tagline: "異能伙伴",
      description: "專精危機即刻支援，提供高壓情境下的理性判斷。",
      image: "/ai-role/match-role-03.webp",
    },
    {
      id: "fantasy-blitz",
      name: "疾風列車長",
      tagline: "速度型隊友",
      description: "節奏鮮明的鼓勵高手，幫你把拖延症扭轉成行動力。",
      image:
        "/ai-role/assets_task_01k7gy56zgey096wccc2zsw42m_1760431449_img_2.webp",
    },
    {
      id: "newvoice-sene",
      name: "森涅",
      tagline: "低音療癒",
      description: "沉穩磁性嗓音與節奏呼吸練習，替你調整放鬆頻率。",
      image:
        "/ai-role/assets_task_01k7gy56zgey096wccc2zsw42m_1760431449_img_2.webp",
    },
    {
      id: "newvoice-haze",
      name: "赫茲",
      tagline: "潮流說書人",
      description: "流行文化行家，總能用梗圖語彙把對話點綴得更有趣。",
      image: "/ai-role/match-role-03.webp",
    },
    {
      id: "newvoice-ryker",
      name: "萊克",
      tagline: "菁英教練",
      description: "高效率節奏結合心理調節，讓你專注在下一個里程碑。",
      image: "/ai-role/match-role-02.webp",
    },
    {
      id: "newvoice-shion",
      name: "蒔音",
      tagline: "城市旅伴",
      description: "熟悉巷弄與咖啡店的情報王者，補給你的生活靈感。",
      image: "/ai-role/match-role-01.webp",
    },
  ];

  return {
    spotlight: pool.slice(0, 4),
    ranking: pool.slice(4, 8),
    fantasy: pool.slice(8, 12),
  };
});

// featureSections 已移除人氣排行（現在使用獨立的 section）
const featureSections = computed(() => []);

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
    console.error("獲取最近對話失敗:", error);
    recentConversations.value = [];
  } finally {
    isLoadingRecent.value = false;
  }
};

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
    console.error("獲取人氣排行失敗:", error);
    if (reset) {
      popularCharacters.value = [];
    }
  } finally {
    isLoadingPopular.value = false;
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

// 人氣排行列表（格式化為與 recentlyViewed 相同的結構）
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

const searchQuery = ref("");
const submittedQuery = ref("");
const searchInputRef = ref(null);
const isRecentRecordsOpen = ref(false);

const RECENT_RECORDS_PANEL_QUERY_KEY = "panel";

// 面板類型配置（簡化 URL，只需傳遞類型）
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
    icon: FireIcon,
    iconKey: "fire",
    heroImage: "/banner/ranking-hero.png",
  },
};

const RECENT_RECORDS_ICON_MAP = {
  heart: HeartIcon,
  sparkles: SparklesIcon,
  fire: FireIcon,
  star: StarIcon,
  bolt: BoltIcon,
};

const DEFAULT_RECENT_RECORDS_ICON_KEY = "heart";

const resolveBadgeIconKey = (input) => {
  if (typeof input !== "string") return "";
  const normalized = input.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(
    RECENT_RECORDS_ICON_MAP,
    normalized
  )
    ? normalized
    : "";
};

const resolveBadgeIconKeyFromComponent = (component) => {
  if (!component) return "";
  for (const [key, entry] of Object.entries(RECENT_RECORDS_ICON_MAP)) {
    if (entry === component) {
      return key;
    }
  }
  return "";
};

const recentRecordsBadgeIconKey = ref(DEFAULT_RECENT_RECORDS_ICON_KEY);

const updateBottomNavVisibility = (shouldHide) => {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("hide-bottom-nav", shouldHide);
};

updateBottomNavVisibility(isRecentRecordsOpen.value);

watch(isRecentRecordsOpen, (isOpen) => {
  updateBottomNavVisibility(isOpen);
});

// 頁面掛載時獲取人氣排行
onMounted(() => {
  fetchPopularCharacters({ reset: true });
});

onBeforeUnmount(() => {
  updateBottomNavVisibility(false);
});
const recentRecordsDescription = ref("");
const recentRecordsBadgeLabel = ref("");
const recentRecordsHeroFallback =
  "/banner/recent-records-banner-placeholder.webp";
const recentRecordsHeroImage = ref(recentRecordsHeroFallback);
const recentRecordsBadgeIcon = computed(
  () => RECENT_RECORDS_ICON_MAP[recentRecordsBadgeIconKey.value] ?? HeartIcon
);

const normalizeQueryValue = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : "";
  }
  if (value == null) {
    return "";
  }
  const stringified = String(value).trim();
  return stringified.length ? stringified : "";
};

// 簡化後的 URL 更新：只處理面板類型
const updateRecentRecordsQuery = (metadata = {}) => {
  const nextQuery = { ...route.query };
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(metadata, "panel")) {
    const panelValue = metadata.panel;

    if (!panelValue) {
      // 移除 panel 參數
      if (
        Object.prototype.hasOwnProperty.call(
          route.query,
          RECENT_RECORDS_PANEL_QUERY_KEY
        )
      ) {
        delete nextQuery[RECENT_RECORDS_PANEL_QUERY_KEY];
        changed = true;
      }
    } else if (route.query[RECENT_RECORDS_PANEL_QUERY_KEY] !== panelValue) {
      // 設置 panel 參數
      nextQuery[RECENT_RECORDS_PANEL_QUERY_KEY] = panelValue;
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  router.replace({ query: nextQuery }).catch((error) => {
    if (error?.name === "NavigationDuplicated") {
      return;
    }
  });
};

const resolvePanelQueryValue = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
};

const syncRecentRecordsPanelStateFromRoute = () => {
  const normalizedPanel = resolvePanelQueryValue(
    route.query[RECENT_RECORDS_PANEL_QUERY_KEY]
  );
  // 檢查 panel 值是否為有效的配置類型
  const shouldOpen =
    normalizedPanel.length > 0 && PANEL_CONFIGS[normalizedPanel] !== undefined;

  if (isRecentRecordsOpen.value !== shouldOpen) {
    isRecentRecordsOpen.value = shouldOpen;
  }
};

syncRecentRecordsPanelStateFromRoute();

watch(
  () => route.query[RECENT_RECORDS_PANEL_QUERY_KEY],
  () => {
    syncRecentRecordsPanelStateFromRoute();
  }
);
const recentRecordsMetrics = [
  { favorites: "43.4K", messages: "1.2M" },
  { favorites: "21.8K", messages: "389.4K" },
  { favorites: "23.8K", messages: "446.0K" },
  { favorites: "19.2K", messages: "312.5K" },
];
const heroImageByKey = {
  reconnect: "/banner/reconnect-hero.webp",
  spotlight: "/banner/spotlight-hero.webp",
  ranking: "/banner/ranking-hero.webp",
  fantasy: "/banner/fantasy-hero.webp",
};

// 獲取當前面板類型
const currentPanelType = computed(() => {
  const panelValue = route.query[RECENT_RECORDS_PANEL_QUERY_KEY];
  return typeof panelValue === "string" ? panelValue.trim().toLowerCase() : "";
});

// 所有記錄（根據面板類型返回不同的數據源）
const allRecentRecordEntries = computed(() => {
  // 如果是排行面板，使用 popularCharacters
  if (currentPanelType.value === "ranking") {
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
    const metrics = recentRecordsMetrics[index] ?? {};

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
          value: metrics.favorites ?? "—",
          icon: HeartIcon,
        },
        {
          key: "messages",
          label: "對話數",
          value: metrics.messages ?? "—",
          icon: ChatBubbleLeftRightIcon,
        },
      ],
    };
  });
});

// 顯示的記錄（虛擬滾動）
const recentRecordEntries = computed(() => {
  // 如果是排行面板，顯示所有已加載的數據（不需要虛擬滾動切片）
  if (currentPanelType.value === "ranking") {
    return allRecentRecordEntries.value;
  }
  // 其他面板使用虛擬滾動
  return allRecentRecordEntries.value.slice(0, displayedRecordsCount.value);
});

// 是否還有更多記錄可以加載
const hasMoreRecords = computed(() => {
  // 如果是排行面板，使用 API 的 hasMore 狀態
  if (currentPanelType.value === "ranking") {
    return popularHasMore.value;
  }
  // 其他面板使用虛擬滾動
  return displayedRecordsCount.value < allRecentRecordEntries.value.length;
});

// 加載更多記錄
const loadMoreRecords = async () => {
  if (isLoadingMoreRecords.value) {
    return;
  }

  // 如果是排行面板，從 API 加載更多數據
  if (currentPanelType.value === "ranking") {
    if (!popularHasMore.value || isLoadingPopular.value) {
      return;
    }
    await fetchPopularCharacters({ reset: false });
    return;
  }

  // 其他面板使用虛擬滾動
  if (!hasMoreRecords.value) {
    return;
  }

  isLoadingMoreRecords.value = true;

  // 模擬加載延遲（可選）
  setTimeout(() => {
    displayedRecordsCount.value += 5;
    isLoadingMoreRecords.value = false;
  }, 300);
};

// 滾動事件處理
const handleRecordsScroll = (event) => {
  const container = event.target;
  const scrollTop = container.scrollTop;
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;

  // 當滾動到距離底部 200px 時開始加載
  if (scrollHeight - scrollTop - clientHeight < 200) {
    loadMoreRecords();
  }
};

// 重置顯示數量
const resetDisplayedRecords = () => {
  displayedRecordsCount.value = 5;
};

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

const normalizeText = (input) => {
  if (typeof input === "string") {
    return input.trim();
  }

  if (Array.isArray(input)) {
    const candidate = input.find(
      (value) => typeof value === "string" && value.trim().length
    );
    return typeof candidate === "string" ? candidate.trim() : "";
  }

  return "";
};

const normalizeHeroKey = (input) => {
  if (typeof input !== "string") {
    return "";
  }
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
};

const resolveHeroImageFromKey = (key) => {
  const normalizedKey = normalizeHeroKey(key);
  return heroImageByKey[normalizedKey] ?? "";
};

const resolveDescriptionFromRoute = () => {
  const candidates = [
    route.query.sectionDescription,
    route.query.description,
    route.query.section,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized.length) {
      return normalized;
    }
  }

  if (typeof window !== "undefined") {
    const stateValue = window.history?.state?.recentRecordsDescription;
    const normalized = normalizeText(stateValue);
    if (normalized.length) {
      return normalized;
    }
  }

  return "";
};

const resolveBadgeLabelFromRoute = () => {
  const candidates = [route.query.sectionTitle, route.query.title];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized.length) {
      return normalized;
    }
  }

  if (typeof window !== "undefined") {
    const stateValue = window.history?.state?.recentRecordsBadgeLabel;
    const normalized = normalizeText(stateValue);
    if (normalized.length) {
      return normalized;
    }
  }

  return "";
};

const resolveHeroImageFromRoute = () => {
  const routeHeroKey = resolveHeroImageFromKey(route.query.heroKey);
  if (routeHeroKey.length) {
    return routeHeroKey;
  }

  const heroImageCandidate = normalizeText(route.query.heroImage);
  if (heroImageCandidate.length) {
    return heroImageCandidate;
  }

  if (typeof window !== "undefined") {
    const state = window.history?.state ?? {};
    const stateHeroKey = resolveHeroImageFromKey(state.recentRecordsHeroKey);
    if (stateHeroKey.length) {
      return stateHeroKey;
    }

    const stateHeroImage = normalizeText(state.recentRecordsHeroImage);
    if (stateHeroImage.length) {
      return stateHeroImage;
    }
  }

  return "";
};

// 簡化後的同步函數：從 URL 讀取類型並從配置加載
const syncRecentRecordsMetadata = () => {
  const panelType = route.query[RECENT_RECORDS_PANEL_QUERY_KEY];

  if (panelType && PANEL_CONFIGS[panelType]) {
    const config = PANEL_CONFIGS[panelType];
    recentRecordsDescription.value = config.description;
    recentRecordsBadgeLabel.value = config.badgeLabel;
    recentRecordsBadgeIconKey.value = config.iconKey;
    recentRecordsHeroImage.value =
      config.heroImage || recentRecordsHeroFallback;
  } else {
    // 重置為默認值
    recentRecordsDescription.value = "";
    recentRecordsBadgeLabel.value = "";
    recentRecordsBadgeIconKey.value = DEFAULT_RECENT_RECORDS_ICON_KEY;
    recentRecordsHeroImage.value = recentRecordsHeroFallback;
  }
};

syncRecentRecordsMetadata();

watch(
  () => route.fullPath,
  () => {
    syncRecentRecordsMetadata();
  }
);

// 簡化後的 openRecentRecords：只接受面板類型
const openRecentRecords = async (type = "reconnect") => {
  // 從配置中獲取面板信息
  const config = PANEL_CONFIGS[type] || PANEL_CONFIGS.reconnect;

  // 設置面板顯示內容
  recentRecordsDescription.value = config.description;
  recentRecordsBadgeLabel.value = config.badgeLabel;
  recentRecordsBadgeIconKey.value = config.iconKey;
  recentRecordsHeroImage.value = config.heroImage || recentRecordsHeroFallback;

  // 如果是排行面板，重置並加載排行數據
  if (type === "ranking") {
    await fetchPopularCharacters({ reset: true });
  } else {
    // 重置虛擬滾動狀態
    resetDisplayedRecords();
  }

  isRecentRecordsOpen.value = true;

  // 只在 URL 中設置類型參數
  updateRecentRecordsQuery({ panel: type });
};

const closeRecentRecords = () => {
  isRecentRecordsOpen.value = false;
  updateRecentRecordsQuery({ panel: null });
};

const handleSectionAction = (section) => {
  if (!section) return;
  if (section.id === "ranking") {
    router.push({ name: "ranking" });
    return;
  }

  openRecentRecords({
    description: section.description,
    badgeLabel: section.title,
    iconKey: section.iconKey,
    icon: section.icon,
    heroKey: section.heroKey,
  });
};

const hasSubmittedQuery = computed(
  () => submittedQuery.value.trim().length > 0
);

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

const isFallbackResult = computed(
  () => hasSubmittedQuery.value && filteredMatches.value.length === 0
);

const handleSearch = () => {
  const keyword = searchQuery.value.trim();

  if (!keyword) {
    submittedQuery.value = "";
    return;
  }

  submittedQuery.value = keyword;
};

const resetSearch = () => {
  searchQuery.value = "";
  submittedQuery.value = "";
  searchInputRef.value?.focus();
};

const openChat = (profile) => {
  if (!profile?.matchId) return;
  router.push({ name: "chat", params: { id: profile.matchId } });
};
</script>

<template>
  <main class="search-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">探索推薦</p>
        <h1>搜尋你心中的理想夥伴</h1>
      </div>
      <p class="page-subtitle">
        根據你的收藏、對話紀錄與當前趨勢，這裡整理出最適合開啟聊聊的角色組合。
      </p>
      <form class="search-bar" role="search" @submit.prevent="handleSearch">
        <label class="sr-only" for="discover-search">搜尋探索角色</label>
        <input
          id="discover-search"
          v-model="searchQuery"
          type="search"
          name="search"
          autocomplete="off"
          placeholder="可搜尋名稱/特質/ID"
          class="search-input"
          ref="searchInputRef"
        />
        <button type="submit" class="search-submit" aria-label="開始搜尋">
          <MagnifyingGlassIcon aria-hidden="true" />
        </button>
      </form>
    </header>

    <div class="scroll-container">
      <template v-if="!hasSubmittedQuery">
        <section class="recent-section">
          <header class="section-header compact">
            <div class="section-title">
              <div class="section-icon accent-rose">
                <HeartIcon aria-hidden="true" />
              </div>
              <div>
                <p class="section-kicker">最近互動</p>
                <h2>重新連線</h2>
              </div>
            </div>
            <button
              type="button"
              class="section-action"
              @click="openRecentRecords('reconnect')"
              aria-haspopup="dialog"
            >
              <span>查看記錄</span>
              <ArrowRightIcon class="icon" aria-hidden="true" />
            </button>
          </header>
          <!-- 加載中狀態 -->
          <div v-if="isLoadingRecent" class="recent-empty">
            <p>載入中...</p>
          </div>
          <!-- 空狀態提示 -->
          <div
            v-else-if="user?.id && recentConversations.length === 0"
            class="recent-empty"
          >
            <p>目前無對話紀錄</p>
            <p class="recent-empty-hint">
              開始與角色聊天，這裡會顯示你的對話記錄
            </p>
          </div>
          <!-- 對話列表 -->
          <div v-else class="recent-scroll">
            <article
              v-for="profile in recentlyViewed"
              :key="profile.id"
              class="recent-card"
              role="button"
              tabindex="0"
              :aria-label="`與 ${profile.name} 開啟對話`"
              @click="openChat(profile)"
              @keyup.enter="openChat(profile)"
            >
              <img :src="profile.image" :alt="profile.name" />
              <div class="recent-body">
                <h3>{{ profile.name }}</h3>
                <div class="recent-stats">
                  <span class="stat-item">
                    <HeartIcon class="stat-icon" aria-hidden="true" />
                    {{ profile.favoritesCountFormatted }}
                  </span>
                  <span class="stat-item">
                    <ChatBubbleLeftRightIcon
                      class="stat-icon"
                      aria-hidden="true"
                    />
                    {{ profile.messageCountFormatted }}
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <!-- 人氣排行區塊 -->
        <section class="recent-section">
          <header class="section-header compact">
            <div class="section-title">
              <div class="section-icon accent-ember">
                <FireIcon aria-hidden="true" />
              </div>
              <div>
                <p class="section-kicker">玩家票選</p>
                <h2>人氣排行</h2>
              </div>
            </div>
            <button
              type="button"
              class="section-action"
              @click="openRecentRecords('ranking')"
              aria-haspopup="dialog"
            >
              <span>前往榜單</span>
              <ArrowRightIcon class="icon" aria-hidden="true" />
            </button>
          </header>
          <!-- 加載中狀態 -->
          <div v-if="isLoadingPopular" class="recent-empty">
            <p>載入中...</p>
          </div>
          <!-- 人氣排行列表 -->
          <div v-else class="recent-scroll">
            <article
              v-for="profile in popularRanking"
              :key="profile.id"
              class="recent-card"
              role="button"
              tabindex="0"
              :aria-label="`與 ${profile.name} 開啟對話`"
              @click="openChat(profile)"
              @keyup.enter="openChat(profile)"
            >
              <img :src="profile.image" :alt="profile.name" />
              <div class="recent-body">
                <h3>{{ profile.name }}</h3>
                <div class="recent-stats">
                  <span class="stat-item">
                    <HeartIcon class="stat-icon" aria-hidden="true" />
                    {{ profile.favoritesCountFormatted }}
                  </span>
                  <span class="stat-item">
                    <ChatBubbleLeftRightIcon
                      class="stat-icon"
                      aria-hidden="true"
                    />
                    {{ profile.messageCountFormatted }}
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section
          v-for="section in featureSections"
          :key="section.id"
          class="content-section"
        >
          <header class="section-header">
            <div class="section-title">
              <div class="section-icon" :class="`accent-${section.accent}`">
                <component :is="section.icon" aria-hidden="true" />
              </div>
              <div>
                <p class="section-kicker">{{ section.kicker }}</p>
                <h2>{{ section.title }}</h2>
              </div>
            </div>
            <button
              type="button"
              class="section-action"
              @click="handleSectionAction(section)"
            >
              <span>{{ section.actionLabel }}</span>
              <ArrowRightIcon class="icon" aria-hidden="true" />
            </button>
          </header>
          <p class="section-description">
            {{ section.description }}
          </p>
          <div class="card-grid">
            <article
              v-for="card in section.cards"
              :key="card.id"
              class="profile-card"
            >
              <div class="card-media">
                <img :src="card.image" :alt="card.name" loading="lazy" />
              </div>
              <div class="card-body">
                <h3>{{ card.name }}</h3>
                <p class="card-tagline">{{ card.tagline }}</p>
                <p class="card-summary">
                  {{ card.description }}
                </p>
              </div>
            </article>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="results-header">
          <div class="results-meta">
            <p class="results-kicker">搜尋結果</p>
            <h2>
              {{
                isFallbackResult
                  ? "未找到完全符合的角色"
                  : `找到 ${displayedResults.length} 位角色`
              }}
            </h2>
            <p class="results-query">關鍵字：{{ submittedQuery }}</p>
            <p v-if="isFallbackResult" class="results-note">
              以下為相近的角色推薦，或嘗試使用不同關鍵字。
            </p>
          </div>
          <button type="button" class="search-reset" @click="resetSearch">
            重新搜尋
          </button>
        </section>

        <section v-if="displayedResults.length" class="results-list">
          <article
            v-for="profile in displayedResults"
            :key="profile.id"
            class="result-card"
            role="button"
            tabindex="0"
            @click="openChat(profile)"
            @keyup.enter="openChat(profile)"
          >
            <div class="result-media">
              <img :src="profile.image" :alt="profile.name" />
            </div>
            <div class="result-body">
              <header class="result-header">
                <h3>{{ profile.name }}</h3>
                <span class="result-handle">{{ profile.author }}</span>
              </header>
              <p class="result-description">
                {{ profile.description }}
              </p>
            </div>
          </article>
        </section>

        <section v-else class="results-empty">
          <h3>沒有找到符合的角色</h3>
          <p>試著調整搜尋字詞，或點選上方按鈕重新搜尋。</p>
        </section>
      </template>
    </div>

    <div
      v-if="isRecentRecordsOpen"
      class="recent-records-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recent-records-badge"
      aria-describedby="recent-records-description"
    >
      <div
        class="recent-records-overlay__backdrop"
        @click="closeRecentRecords"
        aria-hidden="true"
      ></div>
      <section class="recent-records-panel">
        <header class="recent-records-hero">
          <button
            type="button"
            class="recent-records-close"
            @click="closeRecentRecords"
            aria-label="返回上一頁"
          >
            <ArrowLeftIcon aria-hidden="true" />
          </button>
          <div class="recent-records-hero__media" aria-hidden="true">
            <img
              :src="recentRecordsHeroImage || recentRecordsHeroFallback"
              alt=""
              loading="lazy"
            />
          </div>
          <div class="recent-records-hero__content">
            <div class="recent-records-hero__badge">
              <div class="recent-records-hero__badge-icon">
                <component :is="recentRecordsBadgeIcon" aria-hidden="true" />
              </div>
              <span
                id="recent-records-badge"
                class="recent-records-hero__badge-label"
              >
                {{ recentRecordsBadgeLabel || "重連精選" }}
              </span>
            </div>
            <div class="recent-records-hero__text">
              <p id="recent-records-description">
                {{ recentRecordsDescription }}
              </p>
            </div>
          </div>
        </header>
        <div
          ref="recordsListRef"
          class="recent-records-list"
          @scroll="handleRecordsScroll"
        >
          <article
            v-for="entry in recentRecordEntries"
            :key="entry.id"
            class="recent-record-card"
          >
            <div class="recent-record-card__media">
              <div class="recent-record-card__media-frame">
                <img :src="entry.image" :alt="entry.name" />
              </div>
            </div>
            <div class="recent-record-card__body">
              <header class="recent-record-card__header">
                <div class="recent-record-card__heading">
                  <h3 class="recent-record-card__name">{{ entry.name }}</h3>
                  <p v-if="entry.tagline" class="recent-record-card__tagline">
                    {{ entry.tagline }}
                  </p>
                </div>
                <div class="recent-record-card__meta">
                  <ul
                    v-if="entry.metrics && entry.metrics.length"
                    class="recent-record-card__metrics"
                  >
                    <li
                      v-for="stat in entry.metrics"
                      :key="stat.key"
                      class="recent-record-card__metric"
                    >
                      <component
                        :is="stat.icon"
                        class="recent-record-card__metric-icon"
                        aria-hidden="true"
                      />
                      <span class="recent-record-card__metric-value">
                        {{ stat.value }}
                      </span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    class="recent-record-card__arrow"
                    :aria-label="`與 ${entry.name} 開啟對話`"
                    @click="openChatForEntry(entry)"
                  >
                    <ArrowRightIcon />
                  </button>
                </div>
              </header>
              <p class="recent-record-card__description">
                {{ entry.description }}
              </p>
            </div>
          </article>

          <!-- 加載指示器 -->
          <div
            v-if="isLoadingPopular || isLoadingMoreRecords"
            class="records-loading"
          >
            <div class="records-loading-spinner"></div>
            <p>載入更多...</p>
          </div>

          <!-- 已全部載入提示 -->
          <div
            v-else-if="!hasMoreRecords && recentRecordEntries.length > 0"
            class="records-end"
          >
            <p v-if="currentPanelType === 'ranking'">
              已顯示全部 {{ recentRecordEntries.length }} 個角色
            </p>
            <p v-else>已顯示全部 {{ recentRecordEntries.length }} 則對話記錄</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped lang="scss">
.search-page {
  position: relative;
  height: calc(100vh - var(--bottom-nav-offset, 0px));
  height: calc(100dvh - var(--bottom-nav-offset, 0px));
  background: radial-gradient(
      circle at top,
      rgba(30, 64, 175, 0.35),
      transparent
    ),
    radial-gradient(circle at bottom, rgba(236, 72, 153, 0.18), transparent),
    #020617;
  color: #e2e8f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(520px, 100%);
  margin: 0 auto;
  padding: clamp(1.75rem, 6vw, 2.5rem) clamp(1.25rem, 5vw, 2rem)
    clamp(0.9rem, 3vw, 1.4rem);

  h1 {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    letter-spacing: 0.02em;
    color: #f8fafc;
  }

  .page-kicker {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .page-subtitle {
    margin: 0;
    color: rgba(226, 232, 240, 0.6);
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .search-bar {
    position: relative;
    margin-top: clamp(1rem, 3vw, 1.4rem);
    display: flex;
    align-items: center;
    background: rgba(15, 23, 42, 0.8);
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    padding: 0.1rem 0.1rem 0.1rem 1rem;
    box-shadow: 0 14px 28px rgba(2, 6, 23, 0.45);
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .search-bar:focus-within {
    border-color: rgba(236, 72, 153, 0.55);
    box-shadow: 0 18px 32px rgba(236, 72, 153, 0.22);
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    color: #f8fafc;
    font-size: 0.95rem;
    padding: 0.75rem 0.5rem 0.75rem 0;
    font-family: inherit;
  }

  .search-input::placeholder {
    color: rgba(148, 163, 184, 0.65);
  }

  .search-input:focus {
    outline: none;
  }

  .search-submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 999px;
    border: none;
    background: rgba(30, 64, 175, 0.65);
    color: rgba(248, 250, 252, 0.9);
    transition: background 160ms ease, transform 160ms ease;
  }

  .search-submit:hover {
    background: rgba(59, 130, 246, 0.7);
    transform: translateY(-1px);
  }

  .search-submit svg {
    width: 20px;
    height: 20px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    border: 0;
    white-space: nowrap;
  }
}

.scroll-container {
  position: relative;
  z-index: 1;
  width: min(520px, 100%);
  flex: 1 1 auto;
  margin: 0 auto;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 4vw, 2.25rem);
  overflow-y: auto;
  scrollbar-width: thin;
}

.scroll-container::-webkit-scrollbar {
  width: 6px;
}

.scroll-container::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 999px;
}

.scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  h2 {
    margin: 0;
    font-size: 1.3rem;
    color: #f8fafc;
    letter-spacing: 0.03em;
  }

  .section-kicker {
    margin: 0;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(226, 232, 240, 0.6);
  }
}

.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(226, 232, 240, 0.08);

  svg {
    width: 20px;
    height: 20px;
  }

  &.accent-luminous {
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.24),
      rgba(79, 70, 229, 0.2)
    );
    border-color: rgba(236, 72, 153, 0.4);
    color: #fce7f3;
  }

  &.accent-ember {
    background: linear-gradient(
      135deg,
      rgba(249, 115, 22, 0.28),
      rgba(251, 191, 36, 0.22)
    );
    border-color: rgba(251, 146, 60, 0.5);
    color: #fffbeb;
  }

  &.accent-twilight {
    background: linear-gradient(
      135deg,
      rgba(96, 165, 250, 0.25),
      rgba(196, 181, 253, 0.2)
    );
    border-color: rgba(129, 140, 248, 0.45);
    color: #e0e7ff;
  }

  &.accent-pulse {
    background: linear-gradient(
      135deg,
      rgba(45, 212, 191, 0.3),
      rgba(20, 184, 166, 0.2)
    );
    border-color: rgba(34, 197, 94, 0.38);
    color: #ecfdf5;
  }

  &.accent-rose {
    background: linear-gradient(
      135deg,
      rgba(244, 114, 182, 0.3),
      rgba(236, 72, 153, 0.22)
    );
    border-color: rgba(244, 114, 182, 0.5);
    color: #fff1f2;
  }
}

.section-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.4);
  color: rgba(226, 232, 240, 0.85);
  font-size: 0.82rem;
  font-weight: 600;
  transition: border-color 160ms ease, transform 160ms ease;

  .icon {
    width: 18px;
    height: 18px;
  }

  &:hover {
    border-color: rgba(148, 163, 184, 0.45);
    transform: translateX(2px);
  }
}

.section-description {
  margin: 0.55rem 0 1.2rem;
  color: rgba(226, 232, 240, 0.6);
  font-size: 0.9rem;
  line-height: 1.6;
}

.content-section {
  background: rgba(15, 23, 42, 0.68);
  border-radius: 18px;
  padding: clamp(1.35rem, 4vw, 1.75rem);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 28px 54px rgba(2, 6, 23, 0.48);
  backdrop-filter: blur(18px);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
}

.profile-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: inset 0 1px 0 rgba(248, 250, 252, 0.05);
  transition: transform 180ms ease, border-color 180ms ease,
    box-shadow 180ms ease;

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(236, 72, 153, 0.35);
    box-shadow: 0 14px 30px rgba(236, 72, 153, 0.18);
  }

  .card-media {
    position: relative;
    width: 100%;
    padding-top: 120%;
    overflow: hidden;

    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.85rem;

    h3 {
      margin: 0;
      font-size: 1rem;
      color: #f8fafc;
    }

    .card-tagline {
      margin: 0;
      font-size: 0.82rem;
      color: rgba(248, 250, 252, 0.65);
      letter-spacing: 0.03em;
    }

    .card-summary {
      margin: 0;
      font-size: 0.78rem;
      color: rgba(226, 232, 240, 0.65);
      line-height: 1.5;
    }
  }
}

.recent-section {
  background: rgba(15, 23, 42, 0.7);
  border-radius: 18px;
  padding: clamp(1.3rem, 4vw, 1.65rem);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.45);
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .recent-empty {
    padding: 2rem 1rem;
    text-align: center;
    color: rgba(226, 232, 240, 0.6);

    p {
      margin: 0 0 0.5rem;
      font-size: 0.95rem;
      color: rgba(226, 232, 240, 0.75);
    }

    .recent-empty-hint {
      font-size: 0.85rem;
      color: rgba(148, 163, 184, 0.6);
    }
  }

  .recent-scroll {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    padding-bottom: 0.4rem;
    margin: 0 -0.5rem 0 -0.5rem;
    padding-inline: 0.5rem;
    scroll-snap-type: x mandatory;
  }

  .recent-card {
    flex: 0 0 140px;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    scroll-snap-align: start;
    background: rgba(2, 6, 23, 0.16);
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 14px;
    padding: 0.75rem;
    transition: transform 160ms ease, border-color 160ms ease,
      box-shadow 160ms ease;
    cursor: pointer;
    outline: none;

    &:hover {
      transform: translateY(-3px);
      border-color: rgba(59, 130, 246, 0.4);
    }

    &:focus-visible {
      border-color: rgba(236, 72, 153, 0.5);
      box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.25);
      transform: translateY(-2px);
    }

    img {
      width: 100%;
      aspect-ratio: 3 / 4;
      object-fit: cover;
      border-radius: 10px;
    }

    .recent-body {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      h3 {
        margin: 0;
        font-size: 0.95rem;
        color: #f8fafc;
      }

      .recent-stats {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.8rem;
          color: rgba(226, 232, 240, 0.7);

          .stat-icon {
            width: 13px;
            height: 13px;
            opacity: 0.65;
            flex-shrink: 0;
          }
        }
      }
    }
  }
}

.results-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: clamp(1.35rem, 4vw, 1.75rem);
  box-shadow: 0 28px 54px rgba(2, 6, 23, 0.48);
  backdrop-filter: blur(18px);

  .results-meta {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .results-kicker {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.78rem;
    color: rgba(226, 232, 240, 0.55);
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #f8fafc;
  }

  .results-query {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(148, 163, 184, 0.75);
  }

  .results-note {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(244, 114, 182, 0.78);
  }
}

.search-reset {
  align-self: center;
  padding: 0.55rem 1.2rem;
  border-radius: 999px;
  border: 1px solid rgba(236, 72, 153, 0.45);
  background: rgba(30, 41, 59, 0.8);
  color: #fdf2f8;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  transition: border-color 160ms ease, background 160ms ease,
    transform 160ms ease;

  &:hover {
    border-color: rgba(244, 114, 182, 0.65);
    background: rgba(236, 72, 153, 0.4);
    transform: translateY(-1px);
  }
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: clamp(1.1rem, 3vw, 1.4rem);
}

.result-card {
  display: flex;
  gap: clamp(1rem, 3vw, 1.2rem);
  background: rgba(15, 23, 42, 0.68);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: clamp(1rem, 3.2vw, 1.35rem);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.45);
  transition: transform 160ms ease, border-color 160ms ease,
    box-shadow 160ms ease;
  cursor: pointer;
  outline: none;

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(236, 72, 153, 0.32);
    box-shadow: 0 18px 36px rgba(236, 72, 153, 0.25);
  }

  &:focus-visible {
    border-color: rgba(96, 165, 250, 0.75);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35);
    transform: translateY(-2px);
  }

  .result-media {
    flex: 0 0 92px;
    height: 92px;
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 1px 0 rgba(248, 250, 252, 0.08);

    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .result-body {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    color: #f8fafc;
  }

  .result-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;

    h3 {
      margin: 0;
      font-size: 1.05rem;
      color: #f8fafc;
    }

    .result-handle {
      font-size: 0.82rem;
      color: rgba(148, 163, 184, 0.75);
    }
  }

  .result-description {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.6;
    color: rgba(226, 232, 240, 0.75);
    text-align: left;
  }

  .result-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
    justify-content: flex-start;
    width: 100%;
    li {
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.35);
      font-size: 0.75rem;
      color: rgba(226, 232, 240, 0.8);
      letter-spacing: 0.02em;
    }
  }
}

.results-empty {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: clamp(1.7rem, 4vw, 2.1rem);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.42);
  text-align: center;
  color: #e2e8f0;

  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #f8fafc;
  }

  p {
    margin: 0.75rem 0 0;
    font-size: 0.86rem;
    color: rgba(226, 232, 240, 0.65);
  }
}

.recent-records-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  pointer-events: none;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 5, 8, 0.78);
    backdrop-filter: blur(18px);
    pointer-events: auto;
  }
}

.recent-records-panel {
  position: relative;
  pointer-events: auto;
  width: min(420px, 100%);
  max-height: min(88vh, 92dvh);
  display: flex;
  flex-direction: column;
  background: linear-gradient(
      180deg,
      rgba(26, 9, 17, 0.97),
      rgba(12, 3, 9, 0.96)
    )
    #0a0308;
  box-shadow: 0 32px 72px rgba(8, 2, 6, 0.75);
  overflow: hidden;
}

.recent-records-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(1.1rem, 4vw, 1.6rem);
  padding: clamp(1.9rem, 5vw, 2.4rem) clamp(1.8rem, 5vw, 2.4rem);
  color: #f8fafc;
  background: #0f0a11;
  overflow: hidden;
  border-bottom: 1px solid rgba(244, 114, 182, 0.18);
  isolation: isolate;
  height: 18rem;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
        circle at 0% -10%,
        rgba(244, 114, 182, 0.35),
        transparent 55%
      ),
      radial-gradient(
        circle at 80% 10%,
        rgba(14, 165, 233, 0.28),
        transparent 58%
      ),
      linear-gradient(200deg, rgba(39, 18, 32, 0.1), rgba(13, 4, 10, 0.1));
    z-index: 1;
    pointer-events: none;
    height: 7rem;
    top: 11rem;
  }
}

.recent-records-close {
  position: absolute;
  top: 1.1rem;
  left: 1.1rem;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(15, 11, 14, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(248, 250, 252, 0.92);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: transform 160ms ease, background 160ms ease;
  box-shadow: 0 10px 24px rgba(5, 2, 3, 0.45);

  &:hover {
    transform: translateY(-1px);
    background: rgba(35, 25, 31, 0.86);
  }

  svg {
    width: 22px;
    height: 22px;
  }
}

.recent-records-list {
  padding: 1rem;
  overflow-y: auto;
  scrollbar-width: thin;
  height: 38rem;
  &::-webkit-scrollbar {
    width: 1px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.35);
    border-radius: 999px;
  }
}

.records-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 1rem;

  p {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 0.9rem;
  }
}

.records-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(148, 163, 184, 0.2);
  border-top-color: rgba(236, 72, 153, 0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.records-end {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;

  p {
    margin: 0;
    color: rgba(148, 163, 184, 0.6);
    font-size: 0.85rem;
    text-align: center;
  }
}

.recent-records-hero__media {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transform: scale(1.05);
    filter: brightness(0.82) saturate(1.05);
  }
}

.recent-records-hero__content {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  position: relative;
  z-index: 2;
  margin-top: 32vw;
}

.recent-records-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
  z-index: 2;
}

.recent-records-hero__badge-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(236, 72, 153, 0.78),
    rgba(244, 63, 94, 0.65)
  );
  border: 1px solid rgba(254, 205, 211, 0.7);
  box-shadow: 0 16px 32px rgba(236, 72, 153, 0.45);
  font-size: 1.6rem;
  line-height: 1;
  color: rgba(255, 241, 242, 0.95);

  svg {
    width: 26px;
    height: 26px;
  }
}

.recent-records-hero__badge-label {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 241, 242, 0.9);
  position: relative;
  z-index: 2;
}

.recent-records-hero__text {
  position: relative;
  z-index: 2;
}

.recent-records-hero__text p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(248, 250, 252, 0.78);
}

.recent-record-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 30px;
  border: 1px solid rgba(96, 42, 72, 0.55);
  background: linear-gradient(150deg, #2a1224 0%, #11060f 100%);
  box-shadow: 0 26px 58px rgba(8, 0, 18, 0.58),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
  margin-bottom: 1rem;
}

.recent-record-card__media {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 7.5rem;
}

.recent-record-card__media-frame {
  position: relative;
  display: grid;
  place-items: center;
  border-radius: 26px;
  box-shadow: 0 20px 44px rgba(220, 172, 46, 0.38);
}

.recent-record-card__media img {
  position: relative;
  z-index: 1;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 20px;
  object-fit: cover;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.recent-record-card__body {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: rgba(248, 246, 255, 0.94);
}

.recent-record-card__header {
  display: flex;
  flex-direction: column;
}

.recent-record-card__heading {
  display: flex;
  flex-direction: column;
}

.recent-record-card__name {
  margin: 0;
  font-size: 1.14rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255, 243, 248, 0.96);
}

.recent-record-card__tagline {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 236, 213, 0.62);
}

.recent-record-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.3rem;
}

.recent-record-card__metrics {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: rgba(255, 241, 242, 0.9);
}

.recent-record-card__metric {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.86rem;
  font-variant-numeric: tabular-nums;
}

.recent-record-card__metric-icon {
  width: 16px;
  height: 16px;
  color: rgba(253, 224, 71, 0.96);
  filter: drop-shadow(0 3px 8px rgba(250, 204, 21, 0.26));
}

.recent-record-card__metric-value {
  letter-spacing: 0.02em;
}

.recent-record-card__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: linear-gradient(
    145deg,
    rgba(255, 237, 213, 0.2),
    rgba(255, 208, 120, 0.16)
  );
  border: 1px solid rgba(255, 210, 130, 0.3);
  color: rgba(255, 249, 196, 0.9);
  box-shadow: 0 12px 22px rgba(250, 204, 21, 0.18);
  padding: 0;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease,
    color 0.18s ease;
  appearance: none;

  svg {
    width: 15px;
    height: 15px;
  }

  &:hover,
  &:focus-visible {
    transform: translateY(-1px);
    box-shadow: 0 16px 28px rgba(250, 204, 21, 0.28);
    color: rgba(255, 255, 255, 0.95);
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.35),
      0 16px 28px rgba(250, 204, 21, 0.28);
  }
}

.recent-record-card__description {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.62;
  color: rgba(233, 230, 240, 0.82);
  text-shadow: 0 10px 22px rgba(0, 0, 0, 0.32);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 520px) {
  .results-header {
    flex-direction: column;
    align-items: stretch;

    .search-reset {
      width: 100%;
      text-align: center;
    }
  }

  .result-card {
    flex-direction: column;
    align-items: center;
    text-align: center;

    .result-media {
      width: 100%;
      flex: 0 0 auto;
      height: auto;
      padding-top: 100%;
      border-radius: 16px;

      img {
        position: absolute;
        inset: 0;
      }
    }

    .result-body {
      align-items: center;
    }

    .result-header {
      justify-content: center;
    }
  }
}

@media (max-width: 640px) {
  .section-action {
    align-self: flex-start;
  }

  .recent-records-panel {
    width: 100%;
    max-height: calc(100vh - 0.5rem);
    max-height: calc(100dvh - 0.5rem);
  }

  .recent-records-hero {
    padding: clamp(1.3rem, 6vw, 1.8rem);
  }

  .recent-records-close {
    top: 0.9rem;
    left: 0.9rem;
  }
}

@media (max-width: 520px) {
  .hero-section .hero-card {
    flex-direction: column;
    align-items: flex-start;

    .hero-visual {
      width: 100%;
      justify-content: flex-start;

      img {
        width: min(220px, 70%);
      }
    }
  }

  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}
</style>
