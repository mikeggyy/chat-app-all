<script setup lang="ts">
import { computed, ref, watch, type Ref, type ComputedRef } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeftIcon } from "@heroicons/vue/24/outline";
import { HeartIcon } from "@heroicons/vue/24/solid";
import { apiJson } from "../utils/api";
import { fallbackMatches } from "../utils/matchFallback";
import { useUserProfile } from "../composables/useUserProfile";

// Types
interface Match {
  id?: string;
  display_name?: string;
  displayName?: string;
  name?: string;
  portraitUrl?: string;
  portrait?: string;
  image?: string;
  avatar?: string;
  totalFavorites?: number;
  favorites?: number;
  collections?: number;
  likes?: number;
  totalChatUsers?: number;
  totalConversations?: number;
  messages?: number;
  chatUsers?: number;
  [key: string]: any;
}

interface ConversationEntry {
  characterId?: string;
  conversationId?: string;
  matchId?: string;
  id?: string;
  character?: Match;
  [key: string]: any;
}

const router = useRouter();
const { user } = useUserProfile();

// Tabs
const activeTab: Ref<string> = ref("chat");
const isChatTab: ComputedRef<boolean> = computed(() => activeTab.value === "chat");

const isLoading: Ref<boolean> = ref(false);
const errorMessage: Ref<string> = ref("");
const fetchedMatches: Ref<Match[]> = ref([]);
const fetchedConversations: Ref<ConversationEntry[]> = ref([]);

const normalizeId = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

const favoriteIds = computed(() => {
  const values = Array.isArray(user.value?.favorites)
    ? user.value.favorites
    : [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value: any) => {
    const id = normalizeId(value);
    if (id && !seen.has(id)) {
      seen.add(id);
      normalized.push(id);
    }
  });

  return normalized;
});

const numberFormatter = new Intl.NumberFormat("zh-TW");
const formatCount = (value: unknown): string => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return "—";
  }
  return numberFormatter.format(Math.floor(number));
};

const defaultPortrait =
  fallbackMatches.find((match) => normalizeId(match?.portraitUrl))
    ?.portraitUrl ?? "/ai-role/match-role-01.webp";

const availableMatchMap = computed(() => {
  const map = new Map();

  fetchedMatches.value.forEach((match) => {
    const id = normalizeId(match?.id);
    if (id && !map.has(id)) {
      map.set(id, match);
    }
  });

  fallbackMatches.forEach((match) => {
    const id = normalizeId(match?.id);
    if (id && !map.has(id)) {
      map.set(id, match);
    }
  });

  return map;
});

const favoriteCards = computed(() => {
  const map = availableMatchMap.value;

  return favoriteIds.value
    .map((id) => {
      const match = map.get(id);
      // 找不到角色時返回 null，而不是創建「未知角色」卡片
      if (!match) {
        return null;
      }

      const portrait =
        match.portraitUrl ??
        match.portrait ??
        match.image ??
        match.avatar ??
        defaultPortrait;

      const totalFavorites =
        match.totalFavorites ??
        match.favorites ??
        match.collections ??
        match.likes ??
        null;
      const totalChatUsers =
        match.totalChatUsers ??
        match.totalConversations ??
        match.messages ??
        match.chatUsers ??
        null;

      const displayName =
        match.display_name ?? match.displayName ?? match.name ?? "未命名角色";

      return {
        id,
        displayName,
        portrait,
        totalFavoritesLabel: formatCount(totalFavorites),
        totalChatUsersLabel: formatCount(totalChatUsers),
        isMissing: false,
      };
    })
    .filter(Boolean);
});

const hasFavorites = computed(() => favoriteCards.value.length > 0);
const showEmptyState = computed(
  () => !isLoading.value && !errorMessage.value && !hasFavorites.value
);

const matchLookup = computed(() => {
  const map = new Map();
  fetchedMatches.value.forEach((match) => {
    const id = normalizeId(match?.id);
    if (id && !map.has(id)) {
      map.set(id, match);
    }
  });
  if (Array.isArray(fallbackMatches)) {
    fallbackMatches.forEach((match) => {
      const id = normalizeId(match?.id);
      if (id && !map.has(id)) {
        map.set(id, match);
      }
    });
  }
  return map;
});

const conversationCards = computed(() => {
  // ✅ 優先使用從 API 獲取的對話列表
  const conversations = fetchedConversations.value.length > 0
    ? fetchedConversations.value
    : (Array.isArray(user.value?.conversations) ? user.value.conversations : []);

  if (!conversations.length) {
    return [];
  }

  const normalized = conversations
    .map((entry: string | ConversationEntry) => {
      if (typeof entry === "string") {
        const match = matchLookup.value.get(entry);
        if (match) {
          return {
            id: entry,
            displayName: match.display_name || match.name || "未知角色",
            portrait: match.portraitUrl || match.portrait || defaultPortrait,
            totalFavoritesLabel: formatCount(
              match.totalFavorites || match.favorites || null
            ),
            totalChatUsersLabel: formatCount(
              match.totalChatUsers || match.totalConversations || null
            ),
            isMissing: false,
          };
        }
        // 找不到角色時返回 null，而不是創建「未知角色」卡片
        return null;
      }
      if (entry && typeof entry === "object") {
        const identifier =
          (typeof entry.characterId === "string" && entry.characterId.trim()) ||
          (typeof entry.conversationId === "string" &&
            entry.conversationId.trim()) ||
          (typeof entry.matchId === "string" && entry.matchId.trim()) ||
          (typeof entry.id === "string" && entry.id.trim()) ||
          "";

        if (!identifier) return null;

        const match =
          identifier && matchLookup.value.size
            ? matchLookup.value.get(identifier)
            : null;

        const character = entry.character || match;

        if (character) {
          return {
            id: identifier,
            displayName: character.display_name || character.name || "未知角色",
            portrait:
              character.portraitUrl ||
              character.portrait ||
              character.avatar ||
              defaultPortrait,
            totalFavoritesLabel: formatCount(
              character.totalFavorites || character.favorites || null
            ),
            totalChatUsersLabel: formatCount(
              character.totalChatUsers || character.totalConversations || null
            ),
            isMissing: false,
          };
        }

        // 找不到角色時返回 null，而不是創建「未知角色」卡片
        return null;
      }
      return null;
    })
    .filter(Boolean);

  return normalized;
});

const hasConversations = computed(() => conversationCards.value.length > 0);
const showChatEmptyState = computed(
  () => !isLoading.value && !errorMessage.value && !hasConversations.value
);

const selectTab = (tab: string): void => {
  activeTab.value = tab;
};

let requestToken: number = 0;

// ✅ 獲取對話列表
watch(
  () => user.value?.id,
  async (nextUserId) => {
    if (!nextUserId) {
      fetchedConversations.value = [];
      return;
    }

    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(nextUserId)}/conversations`,
        { skipGlobalLoading: true }
      );

      fetchedConversations.value = Array.isArray(response?.data?.conversations)
        ? response.data.conversations
        : (Array.isArray(response?.conversations)
          ? response.conversations
          : []);
    } catch (error) {
      console.error('獲取對話列表失敗:', error);
      fetchedConversations.value = [];
    }
  },
  { immediate: true }
);

// ✅ 獲取喜歡的角色
watch(
  [() => user.value?.id, () => favoriteIds.value.join("|")],
  async ([nextUserId]) => {
    const ids = favoriteIds.value;
    if (!nextUserId || ids.length === 0) {
      requestToken += 1;
      fetchedMatches.value = [];
      errorMessage.value = "";
      isLoading.value = false;
      return;
    }

    const token = ++requestToken;
    isLoading.value = true;
    errorMessage.value = "";

    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(
          nextUserId
        )}/favorites?include=matches`,
        { skipGlobalLoading: true }
      );

      if (token !== requestToken) {
        return;
      }

      fetchedMatches.value = Array.isArray(response?.matches)
        ? response.matches
        : (Array.isArray(response?.data?.matches)
          ? response.data.matches
          : []);
    } catch (error) {
      if (token !== requestToken) {
        return;
      }

      fetchedMatches.value = [];
      errorMessage.value = "喜歡資料載入失敗，請稍後再試。";
    } finally {
      if (token === requestToken) {
        isLoading.value = false;
      }
    }
  },
  { immediate: true }
);

const handleBack = (): void => {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: "profile" });
};

const handleCardClick = (characterId: string): void => {
  router.push({
    name: "character-photos",
    params: { characterId },
  });
};
</script>

<template>
  <div class="favorites-screen">
    <header class="favorites-header" aria-label="喜歡頁面導覽">
      <button
        type="button"
        class="favorites-header__button"
        aria-label="返回上一頁"
        @click="handleBack"
      >
        <ArrowLeftIcon class="icon" aria-hidden="true" />
      </button>
      <div class="favorites-header__title">
        <h1>我的相冊</h1>
      </div>
      <span class="favorites-header__spacer" aria-hidden="true"></span>
    </header>

    <nav class="favorites-tabs" role="tablist" aria-label="喜歡分類">
      <button
        type="button"
        class="favorites-tab"
        :class="{ 'is-active': isChatTab }"
        role="tab"
        :aria-selected="isChatTab"
        aria-controls="favorites-chat"
        @click="selectTab('chat')"
      >
        聊天
      </button>
      <button
        type="button"
        class="favorites-tab"
        :class="{ 'is-active': !isChatTab }"
        role="tab"
        :aria-selected="!isChatTab"
        aria-controls="favorites-favorite"
        @click="selectTab('favorite')"
      >
        喜歡
      </button>
    </nav>

    <main class="favorites-content" aria-live="polite">
      <!-- Chat Tab -->
      <div
        v-if="isChatTab"
        :id="'favorites-chat'"
        class="favorites-tab-content"
      >
        <p v-if="isLoading" class="favorites-status" role="status">
          正在載入對話...
        </p>

        <p
          v-else-if="errorMessage"
          class="favorites-status favorites-status--error"
          role="alert"
        >
          {{ errorMessage }}
        </p>

        <div
          v-else-if="showChatEmptyState"
          class="favorites-empty"
          role="status"
        >
          <span class="favorites-empty__icon" aria-hidden="true">
            <HeartIcon class="icon" />
          </span>
          <p class="favorites-empty__title">目前沒有對話紀錄</p>
          <p class="favorites-empty__hint">去配對頁開始新的對話吧！</p>
        </div>

        <ul v-else class="favorites-grid" role="list">
          <li
            v-for="card in conversationCards"
            :key="card.id"
            class="favorite-card"
            @click="handleCardClick(card.id)"
          >
            <article class="favorite-card__body">
              <div class="favorite-card__image">
                <img
                  :src="card.portrait"
                  :alt="`${card.displayName} 角色立繪`"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div class="favorite-card__info">
                <h2 class="favorite-card__name">{{ card.displayName }}</h2>
                <dl class="favorite-card__metrics">
                  <div class="favorite-card__metric">
                    <dt>喜歡</dt>
                    <dd>{{ card.totalFavoritesLabel }}</dd>
                  </div>
                  <div class="favorite-card__metric">
                    <dt>聊天</dt>
                    <dd>{{ card.totalChatUsersLabel }}</dd>
                  </div>
                </dl>
                <p
                  v-if="card.isMissing"
                  class="favorite-card__note"
                  role="note"
                >
                  尚未提供此角色的完整資料。
                </p>
              </div>
            </article>
          </li>
        </ul>
      </div>

      <!-- Favorite Tab -->
      <div v-else :id="'favorites-favorite'" class="favorites-tab-content">
        <p v-if="isLoading" class="favorites-status" role="status">
          正在載入喜歡...
        </p>

        <p
          v-else-if="errorMessage"
          class="favorites-status favorites-status--error"
          role="alert"
        >
          {{ errorMessage }}
        </p>

        <div v-else-if="showEmptyState" class="favorites-empty" role="status">
          <span class="favorites-empty__icon" aria-hidden="true">
            <HeartIcon class="icon" />
          </span>
          <p class="favorites-empty__title">目前沒有喜歡角色</p>
          <p class="favorites-empty__hint">去配對頁探索並加入喜歡吧！</p>
        </div>

        <ul v-else class="favorites-grid" role="list">
          <li
            v-for="card in favoriteCards"
            :key="card.id"
            class="favorite-card"
            @click="handleCardClick(card.id)"
          >
            <article class="favorite-card__body">
              <div class="favorite-card__image">
                <img
                  :src="card.portrait"
                  :alt="`${card.displayName} 角色立繪`"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div class="favorite-card__info">
                <h2 class="favorite-card__name">{{ card.displayName }}</h2>
                <dl class="favorite-card__metrics">
                  <div class="favorite-card__metric">
                    <dt>喜歡</dt>
                    <dd>{{ card.totalFavoritesLabel }}</dd>
                  </div>
                  <div class="favorite-card__metric">
                    <dt>聊天</dt>
                    <dd>{{ card.totalChatUsersLabel }}</dd>
                  </div>
                </dl>
                <p
                  v-if="card.isMissing"
                  class="favorite-card__note"
                  role="note"
                >
                  尚未提供此角色的完整資料。
                </p>
              </div>
            </article>
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>

<style scoped>
.favorites-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #110319 0%, #0a0211 45%, #160325 100%);
  color: #fbf5ff;
}

.favorites-header {
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem 0.5rem;
  gap: 1rem;
}

.favorites-header__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(6, 2, 15, 0.45);
  color: inherit;
  transition: background 0.2s ease, transform 0.2s ease;
}

.favorites-header__button .icon {
  width: 1.35rem;
  height: 1.35rem;
}

.favorites-header__button:active {
  transform: scale(0.94);
}

.favorites-header__title {
  flex: 1;
}

.favorites-header__title h1 {
  margin: 0;
  font-size: clamp(1.4rem, 5vw, 1.75rem);
  letter-spacing: 0.08em;
}

.favorites-header__spacer {
  width: 2.75rem;
}

.favorites-tabs {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(1.4rem, 6vw, 2.4rem);
  padding: 0 1.25rem;
  margin-bottom: 0.5rem;
}

.favorites-tab {
  position: relative;
  border: none;
  background: none;
  padding: 0;
  font-size: clamp(1rem, 4vw, 1.1rem);
  letter-spacing: 0.12em;
  color: rgba(250, 241, 255, 0.5);
  cursor: pointer;
  transition: color 160ms ease;
}

.favorites-tab::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -0.9rem;
  width: 0;
  height: 3px;
  border-radius: 999px;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #d946ef, #ec4899);
  opacity: 0;
  transition: width 200ms ease, opacity 200ms ease;
}

.favorites-tab.is-active {
  color: rgba(250, 241, 255, 0.95);
}

.favorites-tab.is-active::after {
  width: clamp(40px, 10vw, 60px);
  opacity: 1;
}

.favorites-tab:focus-visible {
  outline: none;
  color: rgba(250, 241, 255, 0.95);
}

.favorites-content {
  flex: 1;
  padding: 1.25rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  max-height: calc(109dvh - 200px);
  overflow-y: auto;
}

.favorites-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.favorites-status {
  margin: 2rem auto 0;
  font-size: 1rem;
  color: rgba(250, 241, 255, 0.75);
}

.favorites-status--error {
  color: #ff9db8;
}

.favorites-empty {
  margin-top: 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
  color: rgba(250, 241, 255, 0.8);
}

.favorites-empty__icon {
  width: 3.5rem;
  height: 3.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.35);
}

.favorites-empty__icon .icon {
  width: 1.75rem;
  height: 1.75rem;
}

.favorites-empty__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.favorites-empty__hint {
  margin: 0;
  font-size: 0.9rem;
}

.favorites-grid {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.favorite-card {
  position: relative;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(23, 5, 32, 0.92) 100%
  );
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  cursor: pointer;
}

.favorite-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 22px 44px rgba(0, 0, 0, 0.6);
}

.favorite-card:active {
  transform: translateY(-2px);
}

.favorite-card__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.favorite-card__image {
  position: relative;
  padding-top: 120%;
  overflow: hidden;
}

.favorite-card__image img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.favorite-card__info {
  padding: 0.9rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.favorite-card__name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.favorite-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
}

.favorite-card__metric {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.favorite-card__metric dt {
  font-size: 0.75rem;
  color: rgba(250, 241, 255, 0.75);
}

.favorite-card__metric dd {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.favorite-card__note {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 214, 214, 0.85);
}

@media (min-width: 1024px) {
  .favorites-header {
    padding-top: 1.5rem;
  }

  .favorites-tabs {
    padding: 0 2.5rem;
  }

  .favorites-content {
    padding-left: 2.5rem;
    padding-right: 2.5rem;
  }

  .favorites-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .favorite-card__info {
    padding: 1rem 1.2rem 1.3rem;
  }
}
</style>
