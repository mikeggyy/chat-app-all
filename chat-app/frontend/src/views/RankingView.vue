<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeftIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/vue/24/outline";
import {
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
} from "@heroicons/vue/24/solid";
import {
  fetchRanking,
  RANKING_PAGE_SIZE,
} from "../services/ranking.service.js";
import { apiJson } from "../utils/api.js";
import { fallbackMatches } from "../utils/matchFallback.js";

const router = useRouter();

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
    const data = await apiJson("/match/all", { skipGlobalLoading: true });
    if (Array.isArray(data) && data.length) {
      assignMatchMetadata(data);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
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

const PERIOD_OPTIONS = [
  { id: "daily", label: "每日" },
  { id: "weekly", label: "每週" },
];

const activePeriod = ref(PERIOD_OPTIONS[0].id);
const podium = ref([]);
const entries = ref([]);
const updatedAt = ref("");
const errorMessage = ref("");
const loading = ref(false);
const hasMore = ref(true);
const offset = ref(0);
const sentinelRef = ref(null);

let observer = null;
let requestToken = 0;

const decoratedPodiumEntries = computed(() =>
  podium.value
    .map((entry) => decorateEntry(entry))
    .filter((entry) => entry && [1, 2, 3].includes(entry.rank))
);

const decoratedEntries = computed(() =>
  entries.value.map((entry) => decorateEntry(entry)).filter(Boolean)
);

const activePeriodOption = computed(() => {
  return (
    PERIOD_OPTIONS.find((option) => option.id === activePeriod.value) ??
    PERIOD_OPTIONS[0]
  );
});

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

const resetState = () => {
  podium.value = [];
  entries.value = [];
  updatedAt.value = "";
  errorMessage.value = "";
  offset.value = 0;
  hasMore.value = true;
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
  if (!sentinelRef.value) {
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
      rootMargin: "160px 0px 0px 0px",
      threshold: 0,
    }
  );

  observer.observe(sentinelRef.value);
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
  () => sentinelRef.value,
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
    <header class="top-bar">
      <button class="back-button" type="button" @click="handleBack">
        <ArrowLeftIcon aria-hidden="true" />
      </button>
      <div class="top-title">
        <p class="headline">熱門列表</p>
        <p v-if="updateLine" class="update-line">- {{ updateLine }} -</p>
      </div>
      <button class="help-button" type="button" aria-label="排行榜說明">
        <QuestionMarkCircleIcon aria-hidden="true" />
      </button>
    </header>

    <div class="tab-switch">
      <button
        v-for="period in PERIOD_OPTIONS"
        :key="period.id"
        type="button"
        class="tab-button"
        :class="{ active: period.id === activePeriod }"
        @click="handlePeriodChange(period.id)"
      >
        {{ period.label }}
      </button>
    </div>

    <div class="ranking-scroll-container">
      <section v-if="podiumReady" class="podium-section">
        <article
          v-if="podiumByRank.second"
          class="podium-card podium-second"
          role="button"
          tabindex="0"
          :aria-label="`查看 ${podiumByRank.second?.name || '角色'} 的聊天室`"
          @click="handleEntryNavigate(podiumByRank.second)"
          @keydown.enter.prevent="handleEntryNavigate(podiumByRank.second)"
          @keydown.space.prevent="handleEntryNavigate(podiumByRank.second)"
        >
          <div class="podium-rank">2</div>
          <div class="avatar-wrap">
            <img
              :src="podiumByRank.second.avatar"
              :alt="`${podiumByRank.second.name} 頭像`"
            />
          </div>
          <p class="podium-name">{{ podiumByRank.second.name }}</p>
          <p class="podium-handle">
            {{
              podiumByRank.second.subtitle ||
              podiumByRank.second.handle ||
              podiumByRank.second.title
            }}
          </p>
          <p class="podium-score">
            {{ formatScore(podiumByRank.second.score) }}
          </p>
        </article>

        <article
          v-if="podiumByRank.first"
          class="podium-card podium-first"
          role="button"
          tabindex="0"
          :aria-label="`查看 ${podiumByRank.first?.name || '角色'} 的聊天室`"
          @click="handleEntryNavigate(podiumByRank.first)"
          @keydown.enter.prevent="handleEntryNavigate(podiumByRank.first)"
          @keydown.space.prevent="handleEntryNavigate(podiumByRank.first)"
        >
          <div class="podium-rank">1</div>
          <div class="avatar-wrap">
            <img
              :src="podiumByRank.first.avatar"
              :alt="`${podiumByRank.first.name} 頭像`"
            />
          </div>
          <p class="podium-name">{{ podiumByRank.first.name }}</p>
          <p class="podium-handle">
            {{
              podiumByRank.first.subtitle ||
              podiumByRank.first.handle ||
              podiumByRank.first.title
            }}
          </p>
          <p class="podium-score">
            {{ formatScore(podiumByRank.first.score) }}
          </p>
        </article>

        <article
          v-if="podiumByRank.third"
          class="podium-card podium-third"
          role="button"
          tabindex="0"
          :aria-label="`查看 ${podiumByRank.third?.name || '角色'} 的聊天室`"
          @click="handleEntryNavigate(podiumByRank.third)"
          @keydown.enter.prevent="handleEntryNavigate(podiumByRank.third)"
          @keydown.space.prevent="handleEntryNavigate(podiumByRank.third)"
        >
          <div class="podium-rank">3</div>
          <div class="avatar-wrap">
            <img
              :src="podiumByRank.third.avatar"
              :alt="`${podiumByRank.third.name} 頭像`"
            />
          </div>
          <p class="podium-name">{{ podiumByRank.third.name }}</p>
          <p class="podium-handle">
            {{
              podiumByRank.third.subtitle ||
              podiumByRank.third.handle ||
              podiumByRank.third.title
            }}
          </p>
          <p class="podium-score">
            {{ formatScore(podiumByRank.third.score) }}
          </p>
        </article>
      </section>

      <section v-else class="podium-placeholder" aria-hidden="true">
        <div class="placeholder-card"></div>
        <div class="placeholder-card primary"></div>
        <div class="placeholder-card"></div>
      </section>

      <section v-if="isInitialLoading" class="loading-state" aria-live="polite">
        <ArrowPathIcon class="spinner" aria-hidden="true" />
        <span>正在整理排行榜...</span>
      </section>

      <section
        v-else-if="showErrorState"
        class="error-state"
        aria-live="polite"
      >
        <p>{{ errorMessage }}</p>
        <button type="button" @click="handleRetry">重新整理</button>
      </section>

      <section v-else-if="isEmptyState" class="empty-state">
        <p>目前沒有榜單資料，稍後再試一次。</p>
        <button type="button" @click="handleRetry">重新整理</button>
      </section>

      <ol v-else class="ranking-list">
        <li
          v-for="entry in decoratedEntries"
          :key="entry.id"
          class="ranking-item"
          role="button"
          tabindex="0"
          :aria-label="`查看 ${entry?.name || '角色'} 的聊天室`"
          @click="handleEntryNavigate(entry)"
          @keydown.enter.prevent="handleEntryNavigate(entry)"
          @keydown.space.prevent="handleEntryNavigate(entry)"
        >
          <div class="rank-badge">
            <span>{{ entry.rank }}</span>
          </div>
          <div class="item-avatar">
            <img :src="entry.avatar" :alt="`${entry.name} 頭像`" />
          </div>
          <div class="item-body">
            <p class="item-name">{{ entry.name }}</p>
            <p class="item-handle">
              {{ entry.subtitle || entry.handle || entry.title }}
            </p>
          </div>
          <div class="item-score">{{ formatScore(entry.score) }}</div>
          <button
            class="item-action"
            type="button"
            :aria-label="`前往與 ${entry?.name || '角色'} 的對話`"
            @click.stop="handleEntryNavigate(entry)"
          >
            <ChatBubbleLeftRightIcon aria-hidden="true" />
          </button>
        </li>
      </ol>
      <div ref="sentinelRef" class="scroll-sentinel" aria-hidden="true"></div>

      <div v-if="isLoadingMore" class="loading-more" aria-live="polite">
        <ArrowPathIcon class="spinner" aria-hidden="true" />
        <span>載入更多角色...</span>
      </div>

      <div
        v-else-if="!hasMore && decoratedEntries.length"
        class="list-footer"
        aria-live="polite"
      >
        <span>已到底部</span>
      </div>
    </div>
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
  --bg-start: #540100;
  --bg-end: #140000;
  --bg-highlight: rgba(255, 180, 90, 0.24);
  --accent-strong: #ffb64d;
  --accent-strong-dark: #b64e00;
  --accent-soft: rgba(255, 213, 135, 0.65);
  --card-bg: rgba(108, 14, 12, 0.82);
  --card-bg-hover: rgba(138, 24, 18, 0.88);
  --card-border: rgba(255, 182, 102, 0.35);
  --card-border-strong: rgba(255, 212, 138, 0.6);
  --badge-gold: linear-gradient(170deg, #ffe58f 0%, #f2931a 100%);
  --badge-silver: linear-gradient(170deg, #f1f5ff 0%, #8297f1 100%);
  --badge-bronze: linear-gradient(170deg, #ffd8a6 0%, #d07236 100%);
  --text-primary: #fff7eb;
  --text-secondary: rgba(255, 225, 214, 0.78);
  --shadow-soft: 0 8px 24px rgba(0, 0, 0, 0.45);
  --shadow-strong: 0 22px 40px rgba(0, 0, 0, 0.6);
  --glow-strong: 0 0 34px rgba(255, 191, 92, 0.42);
  background: radial-gradient(
      circle at 12% 20%,
      rgba(255, 216, 120, 0.42),
      transparent 60%
    ),
    radial-gradient(circle at 85% 10%, rgba(220, 80, 48, 0.35), transparent 55%),
    linear-gradient(165deg, var(--bg-start) 0%, var(--bg-end) 70%);
}

.ranking-screen[data-theme="weekly"] {
  --bg-start: #160642;
  --bg-end: #050019;
  --bg-highlight: rgba(148, 118, 255, 0.3);
  --accent-strong: #b397ff;
  --accent-strong-dark: #5737c6;
  --accent-soft: rgba(188, 165, 255, 0.6);
  --card-bg: rgba(38, 20, 84, 0.82);
  --card-bg-hover: rgba(52, 28, 112, 0.88);
  --card-border: rgba(176, 149, 255, 0.35);
  --card-border-strong: rgba(210, 196, 255, 0.6);
  --badge-gold: linear-gradient(170deg, #ffe58f 0%, #d4a8ff 100%);
  --badge-silver: linear-gradient(170deg, #f1f5ff 0%, #a0b3ff 100%);
  --badge-bronze: linear-gradient(170deg, #ffd8a6 0%, #af7cff 100%);
}

.ranking-screen::before,
.ranking-screen::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.ranking-screen::before {
  background: repeating-linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12) 0,
    rgba(255, 255, 255, 0.12) 1px,
    transparent 1px,
    transparent 11px
  );
  opacity: 0.12;
  mix-blend-mode: screen;
}

.ranking-screen::after {
  background: radial-gradient(
      circle at 18% 28%,
      var(--bg-highlight),
      transparent 56%
    ),
    radial-gradient(circle at 82% 46%, var(--bg-highlight), transparent 54%),
    radial-gradient(
      circle at 12% 80%,
      rgba(255, 180, 120, 0.22),
      transparent 50%
    );
  opacity: 0.75;
  mix-blend-mode: lighten;
  animation: backdropPulse 8s ease-in-out infinite alternate;
}

.ranking-screen > * {
  position: relative;
  z-index: 1;
}

.ranking-screen::-webkit-scrollbar {
  width: 0;
  height: 0;
}

@keyframes backdropPulse {
  from {
    opacity: 0.6;
    transform: scale(1);
  }
  to {
    opacity: 0.9;
    transform: scale(1.02);
  }
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-button,
.help-button {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.65));
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), var(--shadow-soft);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.back-button svg,
.help-button svg {
  width: 22px;
  height: 22px;
}

.back-button:hover,
.help-button:hover,
.back-button:focus-visible,
.help-button:focus-visible {
  border-color: var(--accent-strong);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), var(--glow-strong);
  transform: translateY(-1px);
  outline: none;
}

.top-title {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.headline {
  margin: 0;
  font-size: clamp(1.35rem, 4vw, 1.8rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
}

.update-line {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  letter-spacing: 0.18em;
}

.tab-switch {
  align-self: center;
  display: inline-flex;
  gap: 0.45rem;
  padding: 0.4rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(0, 0, 0, 0.34);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.tab-button {
  min-width: 116px;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease,
    box-shadow 0.2s ease;
}

.tab-button:not(.active):hover,
.tab-button:not(.active):focus-visible {
  color: #fff;
  outline: none;
}

.ranking-scroll-container {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 4vw, 1.6rem);
  overflow-y: auto;
  min-height: 0;
  padding-bottom: 2rem;
  height: 8rem;
}

.ranking-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.ranking-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.28);
  border-radius: 999px;
}

.ranking-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.tab-button.active {
  background: linear-gradient(
    160deg,
    var(--accent-strong) 0%,
    var(--accent-strong-dark) 100%
  );
  color: #310802;
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45), 0 0 22px var(--accent-soft);
}

.podium-section {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(0.8rem, 4vw, 1.5rem);
  align-items: end;
  margin-top: 2.5rem;
  margin-bottom: 0;
}

.podium-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  padding: 1rem 0.5rem 0.5rem 0.5rem;
  border-radius: 32px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.08),
    rgba(0, 0, 0, 0.6)
  );
  overflow: visible;
}

.podium-card::after {
  content: "";
  position: absolute;
  inset: 12% 14% auto;
  height: 50%;
  border-radius: 40%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.22),
    transparent 65%
  );
  opacity: 0.35;
  filter: blur(10px);
}

.podium-first {
  transform: translateY(0);
  box-shadow: var(--shadow-strong);
}

.podium-rank {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  width: clamp(54px, 10vw, 64px);
  height: clamp(54px, 10vw, 64px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: clamp(1.4rem, 4vw, 1.8rem);
  color: #240700;
  text-shadow: 0 2px 8px rgba(255, 255, 255, 0.45);
  border: 2px solid rgba(255, 255, 255, 0.65);
  background: var(--badge-gold);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
}

.podium-first .podium-rank::after {
  content: "👑";
  position: absolute;
  top: -28px;
  font-size: clamp(1.4rem, 4vw, 2rem);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45));
}

.podium-second .podium-rank {
  background: var(--badge-silver);
  color: #11183a;
}

.podium-third .podium-rank {
  background: var(--badge-bronze);
  color: #3b1404;
}

.avatar-wrap {
  position: relative;
  width: clamp(86px, 22vw, 110px);
  aspect-ratio: 1;
  border-radius: 50%;
  padding: 0.22rem;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 255, 255, 0.55),
    rgba(255, 255, 255, 0)
  );
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.28),
    0 8px 20px rgba(0, 0, 0, 0.35);
}

.podium-first .avatar-wrap {
  width: clamp(100px, 26vw, 128px);
  padding: 0.3rem;
}

.avatar-wrap::before {
  content: "";
  position: absolute;
  inset: -8%;
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.25),
    rgba(255, 255, 255, 0)
  );
  opacity: 0.45;
  z-index: -1;
}

.avatar-wrap img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.8);
}

.podium-first .avatar-wrap img {
  border-width: 3px;
}

.podium-name {
  margin: clamp(0.65rem, 2vw, 0.9rem) 0 0.2rem;
  font-weight: 700;
  font-size: clamp(1.05rem, 3.6vw, 1.3rem);
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.55);
}

.podium-handle {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.podium-score {
  margin: 0.45rem 0 0;
  font-size: clamp(1.05rem, 3vw, 1.3rem);
  font-weight: 700;
  color: var(--accent-strong);
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
}

.podium-placeholder {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(0.8rem, 4vw, 1.5rem);
  align-items: end;
  margin-bottom: clamp(3.2rem, 8vw, 4.6rem);
  opacity: 0.4;
}

.placeholder-card {
  height: clamp(160px, 34vw, 220px);
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.08);
}

.placeholder-card.primary {
  height: clamp(190px, 40vw, 260px);
}

.loading-state,
.error-state,
.empty-state,
.loading-more,
.list-footer {
  border-radius: 22px;
  padding: 1rem 1.3rem;
  background: linear-gradient(160deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.35));
  border: 1.5px solid var(--card-border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  text-align: center;
  box-shadow: var(--shadow-soft);
  color: var(--text-primary);
}

.loading-more,
.list-footer {
  padding-block: 0.85rem;
  font-size: 0.92rem;
}

.error-state button,
.empty-state button {
  padding: 0.55rem 1.4rem;
  border-radius: 999px;
  border: none;
  font-weight: 700;
  letter-spacing: 0.12em;
  background: linear-gradient(
    160deg,
    var(--accent-strong) 0%,
    var(--accent-strong-dark) 90%
  );
  color: #2a0600;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.45), 0 0 18px var(--accent-soft);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.error-state button:hover,
.error-state button:focus-visible,
.empty-state button:hover,
.empty-state button:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.5), 0 0 22px var(--accent-soft);
  outline: none;
}

.loading-state span,
.loading-more span {
  font-weight: 600;
  letter-spacing: 0.08em;
}

.spinner {
  width: 26px;
  height: 26px;
  color: var(--accent-strong);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.scroll-sentinel {
  width: 100%;
  height: 1px;
}

.ranking-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(0.8rem, 2.6vw, 1.1rem);
}

.ranking-item {
  position: relative;
  display: grid;
  gap: 10px;
  grid-template-columns: 5vw clamp(58px, 12vw, 68px) 1fr auto auto;
  align-items: center;
  padding: clamp(0.85rem, 2.4vw, 1.05rem) clamp(0.9rem, 3vw, 1.4rem);
  border-radius: 22px;
  background: linear-gradient(165deg, var(--card-bg), rgba(0, 0, 0, 0.58));
  border: 1.5px solid var(--card-border);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease,
    background 0.2s ease;
  cursor: pointer;
}

.ranking-item::after {
  content: "";
  position: absolute;
  inset: 1.5px;
  border-radius: inherit;
  border: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

.ranking-item:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-strong);
  border-color: var(--card-border-strong);
  background: linear-gradient(
    165deg,
    var(--card-bg-hover),
    rgba(0, 0, 0, 0.65)
  );
}

.ranking-item:focus-visible,
.podium-card:focus-visible {
  outline: 2px solid var(--accent-strong);
  outline-offset: 4px;
}

.rank-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  font-weight: 700;
  font-size: clamp(1.35rem, 4.2vw, 1.7rem);
  color: var(--accent-strong);
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}

.item-avatar {
  width: clamp(56px, 12vw, 68px);
  aspect-ratio: 1;
  border-radius: 50%;
  padding: 2px;
  background: radial-gradient(
    circle at 35% 25%,
    rgba(255, 255, 255, 0.6),
    rgba(255, 255, 255, 0)
  );
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.2),
    0 6px 16px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.item-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.item-body {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.item-name {
  margin: 0;
  font-weight: 700;
  font-size: clamp(1rem, 3.2vw, 1.15rem);
  color: var(--text-primary);
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.55);
}

.item-handle {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.item-score {
  grid-column: 4;
  justify-self: end;
  font-weight: 700;
  font-size: clamp(1rem, 3vw, 1.2rem);
  color: var(--accent-strong);
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
}

.item-action {
  grid-column: -1;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #310802;
  background: linear-gradient(
    160deg,
    var(--accent-strong) 0%,
    var(--accent-strong-dark) 100%
  );
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4), 0 0 16px var(--accent-soft);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.item-action:hover,
.item-action:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.5), 0 0 20px var(--accent-soft);
  outline: none;
}

.item-action svg {
  width: 22px;
  height: 22px;
}

@media (max-width: 900px) {
  .tab-button {
    min-width: 110px;
  }

  .podium-section,
  .podium-placeholder {
    gap: 0.9rem;
  }
}

@media (max-width: 720px) {
  .ranking-screen {
    padding: 1.6rem 1.1rem 3rem;
  }

  .headline {
    font-size: clamp(1.28rem, 6vw, 1.55rem);
  }

  .tab-button {
    min-width: 104px;
  }
}

@media (max-width: 520px) {
  .top-bar {
    gap: 0.6rem;
  }

  .rank-badge {
    font-size: 1.3rem;
  }

  .item-avatar {
    width: clamp(50px, 22vw, 56px);
  }
}
</style>
