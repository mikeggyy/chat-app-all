<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import {
  fetchRanking,
  RANKING_PAGE_SIZE,
} from "../services/ranking.service.js";
import { apiJson } from "../utils/api.js";
import { fallbackMatches } from "../utils/matchFallback.js";
import { apiCache, cacheKeys, cacheTTL } from "../services/apiCache.service.js";
import RankingHeader from "../components/ranking/RankingHeader.vue";
import RankingPeriodSelector from "../components/ranking/RankingPeriodSelector.vue";
import RankingPodium from "../components/ranking/RankingPodium.vue";
import RankingList from "../components/ranking/RankingList.vue";

const router = useRouter();

// ==================== 常量和工具函數 ====================

const MATCH_ID_BY_AVATAR = fallbackMatches.reduce((map, match) => {
  if (!match || typeof match !== "object") {
    return map;
  }
  const portrait =
    typeof match.portraitUrl === "string" ? match.portraitUrl.trim() : "";
  const identifier = typeof match.id === "string" ? match.id.trim() : "";
  if (portrait && identifier) {
    map[portrait] = identifier;
  }
  return map;
}, {});

const FALLBACK_CHAT_ID =
  fallbackMatches
    .find((match) => typeof match?.id === "string" && match.id.trim().length)
    ?.id.trim() ?? null;

const normalizeIdentifier = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

const matchMetadata = ref({});
const EMPTY_METADATA = Object.freeze({
  totalChatUsers: 0,
  totalFavorites: 0,
  displayName: "",
  portraitUrl: "",
});

const toPositiveInteger = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.round(number);
};

const assignMatchMetadata = (matches) => {
  const map = {};

  if (Array.isArray(matches)) {
    matches.forEach((match) => {
      if (!match || typeof match !== "object") {
        return;
      }
      const identifier = normalizeIdentifier(match.id);
      if (!identifier) {
        return;
      }

      const displayName =
        normalizeIdentifier(match.display_name) ||
        normalizeIdentifier(match.displayName);
      const portrait =
        typeof match.portraitUrl === "string" ? match.portraitUrl.trim() : "";

      map[identifier] = {
        totalChatUsers: toPositiveInteger(match.totalChatUsers),
        totalFavorites: toPositiveInteger(match.totalFavorites),
        displayName,
        portraitUrl: portrait,
      };
    });
  }

  matchMetadata.value = map;
};

assignMatchMetadata(Array.isArray(fallbackMatches) ? fallbackMatches : []);

const DEFAULT_MATCH_AVATAR =
  (Array.isArray(fallbackMatches) &&
    fallbackMatches
      .find((match) => {
        if (!match || typeof match !== "object") {
          return false;
        }
        return Boolean(normalizeIdentifier(match.portraitUrl));
      })
      ?.portraitUrl?.trim()) ||
  "/ai-role/match-role-01.webp";

const loadMatchMetadata = async () => {
  try {
    const data = await apiCache.fetch(
      cacheKeys.matches({ all: true }),
      () => apiJson("/match/all", { skipGlobalLoading: true }),
      cacheTTL.MATCHES
    );

    if (Array.isArray(data) && data.length) {
      assignMatchMetadata(data);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('載入匹配元數據失敗:', error);
    }
  }
};

const resolveEntryChatId = (entry) => {
  if (!entry || typeof entry !== "object") {
    return FALLBACK_CHAT_ID;
  }

  const prioritizedKeys = [
    "chatId",
    "conversationId",
    "characterId",
    "matchId",
  ];
  for (const key of prioritizedKeys) {
    const candidate = normalizeIdentifier(entry[key]);
    if (candidate) {
      return candidate;
    }
  }

  const entryId = normalizeIdentifier(entry.id);
  if (entryId) {
    if (entryId.startsWith("match-") || entryId.startsWith("chat-")) {
      return entryId;
    }
  }

  const avatarKey = normalizeIdentifier(entry.avatar ?? entry.portraitUrl);
  if (avatarKey && MATCH_ID_BY_AVATAR[avatarKey]) {
    return MATCH_ID_BY_AVATAR[avatarKey];
  }

  return FALLBACK_CHAT_ID;
};

const getEntryMetadata = (entry) => {
  if (!entry) {
    return EMPTY_METADATA;
  }
  const matchId = resolveEntryChatId(entry);
  if (!matchId) {
    return EMPTY_METADATA;
  }
  return matchMetadata.value[matchId] ?? EMPTY_METADATA;
};

const decorateEntry = (entry) => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const metadata = getEntryMetadata(entry);
  const chatId = resolveEntryChatId(entry);

  const subtitleParts = [];

  const normalizedHandle = normalizeIdentifier(entry.handle);
  if (!subtitleParts.length && normalizedHandle) {
    subtitleParts.push(normalizedHandle);
  }

  const normalizedTitle = normalizeIdentifier(entry.title);
  if (!subtitleParts.length && normalizedTitle) {
    subtitleParts.push(normalizedTitle);
  }

  const avatarCandidates = [
    metadata.portraitUrl,
    typeof entry.avatar === "string" ? entry.avatar : "",
    typeof entry.portraitUrl === "string" ? entry.portraitUrl : "",
  ];

  const avatar =
    avatarCandidates.find((value) => normalizeIdentifier(value)) ||
    DEFAULT_MATCH_AVATAR;

  const displayName =
    metadata.displayName ||
    (typeof entry.name === "string" ? entry.name.trim() : "") ||
    (typeof entry.displayName === "string" ? entry.displayName.trim() : "");

  const chatCount = toPositiveInteger(metadata.totalChatUsers);
  const favoritesCount = toPositiveInteger(metadata.totalFavorites);

  return {
    ...entry,
    chatId,
    avatar,
    name: displayName || "熱門角色",
    subtitle: subtitleParts.join(" · "),
    score: chatCount || toPositiveInteger(entry.score),
    stats: {
      ...metadata,
      totalChatUsers: chatCount,
      totalFavorites: favoritesCount,
    },
  };
};

const handleEntryNavigate = (entry) => {
  const chatId = resolveEntryChatId(entry);
  if (chatId) {
    router.push({ name: "chat", params: { id: chatId } });
    return;
  }
  router.push({ name: "chat-list" });
};

// ==================== 狀態管理 ====================

const PERIOD_OPTIONS = [
  { id: "daily", label: "每日" },
  { id: "weekly", label: "每週" },
];

const activePeriod = ref(PERIOD_OPTIONS[0].id);
const podium = shallowRef([]);
const entries = shallowRef([]);
const updatedAt = ref("");
const errorMessage = ref("");
const loading = ref(false);
const hasMore = ref(true);
const offset = ref(0);
const rankingListRef = ref(null);

let observer = null;
let requestToken = 0;

const decorationCache = new Map();

// ==================== Computed 屬性 ====================

const decoratedPodiumEntries = computed(() =>
  podium.value
    .map((entry) => {
      const cacheKey = `podium-${entry?.id || entry?.chatId}`;
      if (decorationCache.has(cacheKey)) {
        return decorationCache.get(cacheKey);
      }
      const decorated = decorateEntry(entry);
      if (decorated) {
        decorationCache.set(cacheKey, decorated);
      }
      return decorated;
    })
    .filter((entry) => entry && [1, 2, 3].includes(entry.rank))
);

const decoratedEntries = computed(() =>
  entries.value.map((entry) => {
    const cacheKey = `entry-${entry?.id || entry?.chatId || entry?.rank}`;
    if (decorationCache.has(cacheKey)) {
      return decorationCache.get(cacheKey);
    }
    const decorated = decorateEntry(entry);
    if (decorated) {
      decorationCache.set(cacheKey, decorated);
    }
    return decorated;
  }).filter(Boolean)
);

const themeName = computed(() =>
  activePeriod.value === "weekly" ? "weekly" : "daily"
);

const formatDateLine = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formattedUpdatedAt = computed(() => formatDateLine(updatedAt.value));

const updateLine = computed(() =>
  formattedUpdatedAt.value ? `更新於 ${formattedUpdatedAt.value}` : ""
);

const podiumByRank = computed(() => {
  const map = {
    first: null,
    second: null,
    third: null,
  };

  for (const entry of decoratedPodiumEntries.value) {
    if (entry.rank === 1) {
      map.first = entry;
    } else if (entry.rank === 2) {
      map.second = entry;
    } else if (entry.rank === 3) {
      map.third = entry;
    }
  }

  return map;
});

const podiumReady = computed(() =>
  Boolean(
    podiumByRank.value.first ||
      podiumByRank.value.second ||
      podiumByRank.value.third
  )
);

const isInitialLoading = computed(
  () =>
    loading.value &&
    !entries.value.length &&
    !podium.value.length &&
    !errorMessage.value
);

const isLoadingMore = computed(
  () =>
    loading.value &&
    (entries.value.length > 0 || podium.value.length > 0) &&
    !errorMessage.value
);

const isEmptyState = computed(
  () =>
    !loading.value &&
    !errorMessage.value &&
    !entries.value.length &&
    !podium.value.length
);

const showErrorState = computed(() => Boolean(errorMessage.value));

const formatScore = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  if (number >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(1)}M`;
  }
  if (number >= 10_000) {
    return `${(number / 1_000).toFixed(1)}K`;
  }
  if (number >= 1_000) {
    const rounded = Math.round((number / 1_000) * 10) / 10;
    return `${rounded.toFixed(1)}K`;
  }
  return String(number);
};

// ==================== 方法 ====================

const resetState = () => {
  podium.value = [];
  entries.value = [];
  updatedAt.value = "";
  errorMessage.value = "";
  offset.value = 0;
  hasMore.value = true;
  decorationCache.clear();
};

const loadRankings = async ({ reset = false } = {}) => {
  const currentToken = ++requestToken;

  if (!reset && (!hasMore.value || loading.value)) {
    return;
  }

  if (reset) {
    resetState();
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const data = await fetchRanking({
      period: activePeriod.value,
      offset: reset ? 0 : offset.value,
      limit: RANKING_PAGE_SIZE,
      skipGlobalLoading: true,
    });

    if (requestToken !== currentToken) {
      return;
    }

    const incomingPodium = Array.isArray(data?.podium) ? data.podium : [];
    if (reset || !podium.value.length) {
      podium.value = incomingPodium;
    }

    const incomingEntries = Array.isArray(data?.entries) ? data.entries : [];

    entries.value = reset
      ? incomingEntries
      : [...entries.value, ...incomingEntries];

    updatedAt.value = data?.updatedAt ?? updatedAt.value;

    if (typeof data?.nextOffset === "number") {
      offset.value = data.nextOffset;
    } else if (reset) {
      offset.value = incomingEntries.length;
    } else {
      offset.value += incomingEntries.length;
    }

    if (typeof data?.hasMore === "boolean") {
      hasMore.value = data.hasMore;
    } else {
      hasMore.value = incomingEntries.length === RANKING_PAGE_SIZE;
    }
  } catch (error) {
    if (requestToken !== currentToken) {
      return;
    }
    errorMessage.value = error?.message ?? "排行榜資料載入失敗，請稍後再試。";
  } finally {
    if (requestToken === currentToken) {
      loading.value = false;
    }
  }
};

const detachObserver = () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
};

const attachObserver = () => {
  // 訪問 RankingList 組件暴露的 sentinel ref
  const sentinel = rankingListRef.value?.sentinel;
  if (!sentinel) {
    return;
  }

  detachObserver();

  observer = new IntersectionObserver(
    (entriesList) => {
      for (const entry of entriesList) {
        if (
          entry.isIntersecting &&
          !loading.value &&
          hasMore.value &&
          !errorMessage.value
        ) {
          void loadRankings();
        }
      }
    },
    {
      root: null,
      rootMargin: "50px 0px 0px 0px",
      threshold: 0,
    }
  );

  observer.observe(sentinel);
};

const handleRetry = () => {
  void loadRankings({ reset: true }).then(() => {
    nextTick(() => {
      attachObserver();
    });
  });
};

const handlePeriodChange = (periodId) => {
  if (periodId === activePeriod.value) {
    return;
  }

  activePeriod.value = periodId;
};

const handleBack = () => {
  if (
    typeof window !== "undefined" &&
    window.history &&
    window.history.length > 1
  ) {
    router.back();
    return;
  }

  router.push({ name: "search" });
};

// ==================== 生命週期 ====================

onMounted(() => {
  void loadMatchMetadata();
  void loadRankings({ reset: true }).then(() => {
    nextTick(() => {
      attachObserver();
    });
  });
});

onBeforeUnmount(() => {
  detachObserver();
});

watch(
  () => rankingListRef.value?.sentinel,
  () => {
    nextTick(() => {
      attachObserver();
    });
  }
);

watch(
  () => activePeriod.value,
  () => {
    void loadRankings({ reset: true }).then(() => {
      nextTick(() => {
        attachObserver();
      });
    });
  }
);
</script>

<template>
  <main class="ranking-screen" :data-theme="themeName">
    <RankingHeader
      title="熱門列表"
      :update-line="updateLine"
      @back="handleBack"
      @help="() => {}"
    />

    <RankingPeriodSelector
      :periods="PERIOD_OPTIONS"
      :active-period="activePeriod"
      @change="handlePeriodChange"
    />

    <RankingPodium
      :podium-by-rank="podiumByRank"
      :format-score="formatScore"
      :is-ready="podiumReady"
      @navigate="handleEntryNavigate"
    />

    <RankingList
      ref="rankingListRef"
      :entries="decoratedEntries"
      :format-score="formatScore"
      :is-loading="isInitialLoading"
      :is-loading-more="isLoadingMore"
      :is-error="showErrorState"
      :is-empty="isEmptyState"
      :error-message="errorMessage"
      :has-more="hasMore"
      @navigate="handleEntryNavigate"
      @retry="handleRetry"
    />
  </main>
</template>

<style scoped>
.ranking-screen {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(1.5rem, 4vw, 2.4rem) clamp(1rem, 6vw, 2.8rem)
    clamp(3.1rem, 8vw, 4.2rem);
  display: flex;
  flex-direction: column;
  gap: clamp(1.2rem, 4vw, 1.8rem);
  color: var(--text-primary);
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.ranking-screen::-webkit-scrollbar {
  display: none;
}

@media (max-width: 720px) {
  .ranking-screen {
    padding: 1.6rem 1.1rem 3rem;
  }
}
</style>
