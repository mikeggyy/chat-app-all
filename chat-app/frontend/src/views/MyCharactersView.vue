<script setup>
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/vue/24/outline";
import { HeartIcon } from "@heroicons/vue/24/solid";
import { fetchUserCharacters } from "../services/userCharacters.service.js";
import { useUserProfile } from "../composables/useUserProfile";

const router = useRouter();
const { user } = useUserProfile();

// 返回上一頁（固定返回 Profile 頁面）
const handleBack = () => {
  router.push({ name: "profile" });
};

// 跳轉到創建角色頁面
const handleCreateCharacter = async () => {
  try {
    await router.push({ name: "character-create-gender" });
  } catch (error) {
    // 忽略：這是背景更新，失敗不影響主流程
    if (import.meta.env.DEV) {
      console.warn("[MyCharacters] 背景更新失敗:", error);
    }
  }
};

// Utility functions
const normalizeIdentifier = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

const toPositiveInteger = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.round(number);
};

const DEFAULT_CHARACTER_PORTRAIT = "/ai-role/match-role-01.webp";

const metricFormatter = new Intl.NumberFormat("zh-TW");
const formatMetric = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return metricFormatter.format(number);
};

const decorateCharacter = (character, index = 0) => {
  if (!character || typeof character !== "object") {
    return null;
  }

  const id =
    normalizeIdentifier(character.id) ||
    normalizeIdentifier(character.characterId) ||
    `character-${index + 1}`;

  const nameCandidates = [
    typeof character.name === "string" ? character.name : "",
    typeof character.display_name === "string" ? character.display_name : "",
    typeof character.displayName === "string" ? character.displayName : "",
  ];
  const name =
    nameCandidates.map((value) => value.trim()).find((value) => value.length) ||
    `自訂角色 ${index + 1}`;

  const likes = toPositiveInteger(
    character.likes ?? character.totalFavorites ?? character.favorites
  );
  const collections = toPositiveInteger(
    character.collections ?? character.totalChatUsers ?? character.chats
  );

  const portraitCandidates = [
    typeof character.portrait === "string" ? character.portrait.trim() : "",
    typeof character.portraitUrl === "string"
      ? character.portraitUrl.trim()
      : "",
    typeof character.avatar === "string" ? character.avatar.trim() : "",
  ];
  const portrait =
    portraitCandidates.find((value) => value.length) ||
    DEFAULT_CHARACTER_PORTRAIT;

  const tagline =
    typeof character.tagline === "string" && character.tagline.trim().length
      ? character.tagline.trim()
      : "";

  const descriptionCandidates = [
    typeof character.description === "string"
      ? character.description.trim()
      : "",
    typeof character.background === "string" ? character.background.trim() : "",
    typeof character.summary === "string" ? character.summary.trim() : "",
  ];
  const description = descriptionCandidates.find((value) => value.length) ?? "";

  return {
    id,
    name,
    likes,
    collections,
    portrait,
    tagline,
    description,
  };
};

// Character data
const userCharactersRaw = ref([]);
const isCharactersLoading = ref(false);
const charactersError = ref("");
let charactersRequestToken = 0;

const characters = computed(() => {
  return userCharactersRaw.value
    .map((character, index) => decorateCharacter(character, index))
    .filter(Boolean);
});

const loadUserCharacters = async (id, options = {}) => {
  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    userCharactersRaw.value = [];
    charactersError.value = "";
    return;
  }

  const currentToken = ++charactersRequestToken;
  isCharactersLoading.value = true;
  charactersError.value = "";

  try {
    const response = await fetchUserCharacters(normalizedId, {
      skipGlobalLoading: options.skipGlobalLoading ?? true,
    });
    if (currentToken !== charactersRequestToken) {
      return;
    }
    userCharactersRaw.value = Array.isArray(response?.characters)
      ? response.characters
      : [];
  } catch (error) {
    if (currentToken !== charactersRequestToken) {
      return;
    }
    userCharactersRaw.value = [];
    charactersError.value = error?.message ?? "載入角色列表失敗，請稍後再試。";
    if (import.meta.env.DEV) {
    }
  } finally {
    if (currentToken === charactersRequestToken) {
      isCharactersLoading.value = false;
    }
  }
};

const resolveCharacterChatId = (character) => {
  if (!character || typeof character !== "object") {
    return "";
  }

  const prioritizedKeys = [
    "chatId",
    "conversationId",
    "characterId",
    "matchId",
    "id",
  ];

  for (const key of prioritizedKeys) {
    const candidate = normalizeIdentifier(character[key]);
    if (candidate) {
      return candidate;
    }
  }

  return "";
};

const handleCharacterSelect = (character) => {
  const targetId = resolveCharacterChatId(character);
  if (!targetId) {
    if (import.meta.env.DEV) {
    }
    return;
  }

  router.push({
    name: "character-detail",
    params: { id: targetId },
  });
};

// Load characters on mount
onMounted(() => {
  // 調試：輸出用戶資訊
  if (import.meta.env.DEV) {
    console.log("[MyCharacters] 當前用戶:", user.value);
    console.log("[MyCharacters] 用戶 ID:", user.value?.id);
  }

  if (user.value?.id) {
    loadUserCharacters(user.value.id);
  } else {
    // 如果沒有用戶資訊，嘗試從 Firebase 獲取
    if (import.meta.env.DEV) {
      console.warn("[MyCharacters] 沒有用戶資訊，無法載入角色");
    }
  }
});
</script>

<template>
  <div class="my-characters-view">
    <header class="my-characters-header">
      <button
        type="button"
        class="my-characters-header__button"
        aria-label="返回上一頁"
        @click="handleBack"
      >
        <ArrowLeftIcon class="icon" aria-hidden="true" />
      </button>
      <div class="my-characters-header__title">
        <h1>我的角色</h1>
      </div>
      <button
        type="button"
        class="my-characters-header__create"
        @click="handleCreateCharacter"
      >
        <span class="create-button__symbol">+</span>
        <span>創建</span>
      </button>
    </header>

    <main class="my-characters-content" :aria-busy="isCharactersLoading">
      <p v-if="isCharactersLoading" class="my-characters-status" role="status">
        正在載入角色...
      </p>

      <p
        v-else-if="charactersError"
        class="my-characters-status my-characters-status--error"
        role="alert"
      >
        {{ charactersError }}
      </p>

      <div
        v-else-if="characters.length === 0"
        class="my-characters-empty"
        role="status"
      >
        <p class="my-characters-empty__title">尚未創建任何角色</p>
        <p class="my-characters-empty__hint">
          點擊右上角「+」按鈕開始創建你的第一個角色！
        </p>
      </div>

      <ul v-else class="character-list" role="list">
        <li
          v-for="character in characters"
          :key="character.id"
          class="character-card"
          role="button"
          tabindex="0"
          :aria-label="`查看 ${character.name || '角色'} 的詳細資料`"
          @click="handleCharacterSelect(character)"
          @keydown.enter.prevent="handleCharacterSelect(character)"
          @keydown.space.prevent="handleCharacterSelect(character)"
        >
          <div class="character-card__media">
            <div class="character-card__media-frame">
              <img
                :src="character.portrait"
                :alt="`${character.name} 角色形象`"
                class="character-card__portrait"
              />
            </div>
          </div>
          <div class="character-card__body">
            <header class="character-card__header">
              <div class="character-card__heading">
                <h3 class="character-card__name">{{ character.name }}</h3>
                <p v-if="character.tagline" class="character-card__tagline">
                  {{ character.tagline }}
                </p>
              </div>
              <div class="character-card__meta">
                <ul class="character-card__metrics">
                  <li class="character-card__metric">
                    <HeartIcon
                      class="character-card__metric-icon"
                      aria-hidden="true"
                    />
                    <span class="character-card__metric-value">
                      {{ formatMetric(character.likes) }}
                    </span>
                  </li>
                  <li class="character-card__metric">
                    <ChatBubbleLeftRightIcon
                      class="character-card__metric-icon"
                      aria-hidden="true"
                    />
                    <span class="character-card__metric-value">
                      {{ formatMetric(character.collections) }}
                    </span>
                  </li>
                </ul>
              </div>
            </header>
            <p v-if="character.description" class="character-card__description">
              {{ character.description }}
            </p>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped lang="scss">
.my-characters-view {
  min-height: 100vh;
  min-height: 100dvh;
  background: #0f1016;
  color: #f8f9ff;
  display: flex;
  flex-direction: column;
}

.my-characters-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 1.75rem;
  background: linear-gradient(
    180deg,
    rgba(15, 16, 22, 0.98) 0%,
    rgba(15, 16, 22, 0.95) 100%
  );
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.my-characters-header__button {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease;

  &:hover {
    background: rgba(148, 163, 184, 0.22);
    transform: translateY(-1px);
  }

  .icon {
    width: 20px;
    height: 20px;
  }
}

.my-characters-header__title {
  text-align: center;

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.08em;
  }
}

.my-characters-header__create {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  box-shadow: 0 12px 25px rgba(255, 77, 143, 0.35);
  transition: transform 150ms ease, box-shadow 150ms ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 32px rgba(255, 77, 143, 0.45);
  }

  .create-button__symbol {
    font-size: 1.1rem;
  }
}

.my-characters-content {
  padding: 1.5rem 1.75rem;
  overflow-y: auto;
  flex: 1;
  max-height: calc(100dvh - 84px);
}

.my-characters-status {
  text-align: center;
  padding: 2rem 1rem;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  color: rgba(226, 232, 240, 0.7);
  margin: 0;

  &--error {
    color: #fca5a5;
  }
}

.my-characters-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;

  &__title {
    margin: 0 0 0.75rem;
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: rgba(226, 232, 240, 0.9);
  }

  &__hint {
    margin: 0;
    font-size: 0.95rem;
    letter-spacing: 0.03em;
    color: rgba(203, 213, 225, 0.7);
    max-width: 320px;
  }
}

.character-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.character-card {
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
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 30px 64px rgba(8, 0, 18, 0.68),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgba(255, 236, 213, 0.55);
    outline-offset: 4px;
    transform: translateY(-2px);
    box-shadow: 0 30px 64px rgba(8, 0, 18, 0.68),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  &__media {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 7.5rem;
  }

  &__media-frame {
    position: relative;
    display: grid;
    place-items: center;
    border-radius: 26px;
    box-shadow: 0 20px 44px rgba(220, 172, 46, 0.38);
  }

  &__portrait {
    position: relative;
    z-index: 1;
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: 20px;
    object-fit: cover;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  }

  &__body {
    position: relative;
    z-index: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    color: rgba(248, 246, 255, 0.94);
  }

  &__header {
    display: flex;
    flex-direction: column;
  }

  &__heading {
    display: flex;
    flex-direction: column;
  }

  &__name {
    margin: 0;
    font-size: 1.14rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: rgba(255, 243, 248, 0.96);
  }

  &__tagline {
    margin: 0;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 236, 213, 0.62);
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.5rem;
    margin-bottom: 0.3rem;
  }

  &__metrics {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
    color: rgba(255, 241, 242, 0.9);
  }

  &__metric {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.86rem;
    font-variant-numeric: tabular-nums;
  }

  &__metric-icon {
    width: 16px;
    height: 16px;
    color: rgba(253, 224, 71, 0.96);
    filter: drop-shadow(0 3px 8px rgba(250, 204, 21, 0.26));
  }

  &__metric-value {
    letter-spacing: 0.02em;
  }

  &__description {
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
}

@media (max-width: 540px) {
  .my-characters-header {
    padding: 1.25rem 1.5rem;
  }

  .my-characters-content {
    padding: 1.25rem 1.5rem;
  }

  .character-card {
    &__media {
      flex: 0 0 6rem;
    }
  }
}
</style>
