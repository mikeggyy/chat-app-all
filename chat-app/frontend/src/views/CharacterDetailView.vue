<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  MusicalNoteIcon,
  SparklesIcon,
  UserIcon,
  IdentificationIcon,
} from "@heroicons/vue/24/outline";
import { HeartIcon } from "@heroicons/vue/24/solid";
import { apiJson } from "../utils/api.js";

interface VoiceConfig {
  label: string;
  description?: string;
}

interface Character {
  id: string;
  display_name: string;
  gender: 'male' | 'female' | 'other';
  voice: string | VoiceConfig;
  background?: string;
  secret_background?: string;
  first_message?: string;
  tags?: string[];
  plot_hooks?: string[];
  portraitUrl?: string;
  totalChatUsers?: number;
  totalFavorites?: number;
  styles?: string[];
  appearanceDescription?: string;
}

const route = useRoute();
const router = useRouter();

const characterId = computed(() => route.params.id as string);
const character = ref<Character | null>(null);
const isLoading = ref<boolean>(false);
const error = ref<string>("");

// 返回上一頁
const handleBack = (): void => {
  router.back();
};

// 開始對話
const handleStartChat = (): void => {
  if (!character.value?.id) {
    return;
  }
  router.push({
    name: "chat",
    params: { id: character.value.id },
  });
};

// 載入角色詳細資料
const loadCharacterDetail = async (): Promise<void> => {
  if (!characterId.value) {
    error.value = "無效的角色 ID";
    return;
  }

  isLoading.value = true;
  error.value = "";

  try {
    const response = await apiJson(`/api/characters/${characterId.value}`, {
      skipGlobalLoading: true,
    }) as { character?: Character };

    if (response.character) {
      character.value = response.character;
    } else {
      error.value = "找不到角色資料";
    }
  } catch (err) {
    error.value = (err as Error)?.message || "載入角色詳細資料失敗";
  } finally {
    isLoading.value = false;
  }
};

// 格式化數字
const formatMetric = (value: number | undefined): string => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-TW").format(number);
};

// 性別標籤
const genderLabel = computed<string>(() => {
  if (!character.value?.gender) return "";
  const genderMap: Record<string, string> = {
    male: "男性",
    female: "女性",
    other: "其他",
  };
  return genderMap[character.value.gender] || character.value.gender;
});

// 語音標籤和描述
const voiceLabel = computed<string>(() => {
  if (!character.value?.voice) return "未設定";

  // 如果 voice 是物件，直接使用 label
  if (
    typeof character.value.voice === "object" &&
    character.value.voice.label
  ) {
    return String(character.value.voice.label);
  }

  // 如果是字串，使用映射表
  const voiceMap: Record<string, string> = {
    alloy: "合金",
    ash: "灰燼",
    ballad: "民謠",
    coral: "珊瑚",
    echo: "回音",
    fable: "寓言",
    onyx: "瑪瑙",
    nova: "新星",
    sage: "賢者",
    verse: "詩篇",
  };
  const voiceStr = typeof character.value.voice === 'string' ? character.value.voice : '';
  return voiceMap[voiceStr] || voiceStr || "未設定";
});

const voiceDescription = computed<string>(() => {
  if (!character.value?.voice) return "";

  // 如果 voice 是物件，使用 description
  if (
    typeof character.value.voice === "object" &&
    character.value.voice.description
  ) {
    return character.value.voice.description;
  }

  return "";
});

// 風格標籤
const stylesText = computed<string>(() => {
  if (!character.value?.styles || !Array.isArray(character.value.styles)) {
    return "無";
  }
  return character.value.styles.join("、") || "無";
});

onMounted(() => {
  loadCharacterDetail();
});
</script>

<template>
  <div class="character-detail-view">
    <header class="detail-header">
      <button
        type="button"
        class="detail-header__button"
        aria-label="返回上一頁"
        @click="handleBack"
      >
        <ArrowLeftIcon class="icon" aria-hidden="true" />
      </button>
      <div class="detail-header__title">
        <h1>角色詳情</h1>
      </div>
      <div class="detail-header__spacer"></div>
    </header>

    <main class="detail-content" :aria-busy="isLoading">
      <p v-if="isLoading" class="detail-status" role="status">
        正在載入角色資料...
      </p>

      <p
        v-else-if="error"
        class="detail-status detail-status--error"
        role="alert"
      >
        {{ error }}
      </p>

      <div v-else-if="character" class="character-detail">
        <!-- 角色頭像 -->
        <div class="detail-portrait">
          <!-- 🔥 有圖片時顯示圖片 -->
          <img
            v-if="character.portraitUrl"
            :src="character.portraitUrl"
            :alt="`${character.display_name || '角色'} 的形象`"
            class="detail-portrait__image"
          />
          <!-- 🔥 沒有圖片時顯示占位符 -->
          <div v-else class="detail-portrait__placeholder">
            <span class="detail-portrait__text">{{ character.display_name?.charAt(0) || '?' }}</span>
            <span class="detail-portrait__hint">未設定圖片</span>
          </div>
        </div>

        <!-- 角色基本資訊 -->
        <div class="detail-basic">
          <div class="detail-basic__metrics">
            <div class="metric-item">
              <HeartIcon class="metric-item__icon" aria-hidden="true" />
              <span class="metric-item__value">
                {{ formatMetric(character.totalFavorites || 0) }}
              </span>
            </div>
            <div class="metric-item">
              <ChatBubbleLeftRightIcon
                class="metric-item__icon"
                aria-hidden="true"
              />
              <span class="metric-item__value">
                {{ formatMetric(character.totalChatUsers || 0) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 角色詳細設定 -->
        <div class="detail-sections">
          <!-- 姓名 -->
          <section class="detail-section">
            <div class="detail-section__header">
              <IdentificationIcon
                class="detail-section__icon"
                aria-hidden="true"
              />
              <h3 class="detail-section__title">姓名</h3>
            </div>
            <p class="detail-section__content">
              {{ character.display_name || "未命名角色" }}
            </p>
          </section>

          <!-- 性別 -->
          <section class="detail-section">
            <div class="detail-section__header">
              <UserIcon class="detail-section__icon" aria-hidden="true" />
              <h3 class="detail-section__title">性別</h3>
            </div>
            <p class="detail-section__content">{{ genderLabel || "未設定" }}</p>
          </section>

          <!-- 語音 -->
          <section class="detail-section">
            <div class="detail-section__header">
              <MusicalNoteIcon
                class="detail-section__icon"
                aria-hidden="true"
              />
              <h3 class="detail-section__title">語音</h3>
            </div>
            <div class="detail-section__content">
              <p class="voice-label">{{ voiceLabel }}</p>
              <p v-if="voiceDescription" class="voice-description">
                {{ voiceDescription }}
              </p>
            </div>
          </section>

          <!-- 風格 -->
          <section
            v-if="character.styles && character.styles.length"
            class="detail-section"
          >
            <div class="detail-section__header">
              <SparklesIcon class="detail-section__icon" aria-hidden="true" />
              <h3 class="detail-section__title">風格</h3>
            </div>
            <p class="detail-section__content">{{ stylesText }}</p>
          </section>

          <!-- 外觀描述 -->
          <section
            v-if="character.appearanceDescription"
            class="detail-section"
          >
            <div class="detail-section__header">
              <SparklesIcon class="detail-section__icon" aria-hidden="true" />
              <h3 class="detail-section__title">外觀描述</h3>
            </div>
            <p
              class="detail-section__content detail-section__content--multiline"
            >
              {{ character.appearanceDescription }}
            </p>
          </section>

          <!-- 角色背景 -->
          <section v-if="character.background" class="detail-section">
            <div class="detail-section__header">
              <h3 class="detail-section__title detail-section__title--solo">
                角色背景
              </h3>
            </div>
            <p
              class="detail-section__content detail-section__content--multiline"
            >
              {{ character.background }}
            </p>
          </section>

          <!-- 隱藏設定 -->
          <section v-if="character.secret_background" class="detail-section">
            <div class="detail-section__header">
              <h3 class="detail-section__title detail-section__title--solo">
                隱藏設定
              </h3>
            </div>
            <p
              class="detail-section__content detail-section__content--multiline detail-section__content--secret"
            >
              {{ character.secret_background }}
            </p>
          </section>

          <!-- 第一句話 -->
          <section v-if="character.first_message" class="detail-section">
            <div class="detail-section__header">
              <h3 class="detail-section__title detail-section__title--solo">
                開場白
              </h3>
            </div>
            <p
              class="detail-section__content detail-section__content--multiline detail-section__content--message"
            >
              {{ character.first_message }}
            </p>
          </section>
        </div>

        <!-- 開始對話按鈕 -->
        <div class="detail-actions">
          <button
            type="button"
            class="action-button action-button--primary"
            @click="handleStartChat"
          >
            <ChatBubbleLeftRightIcon
              class="action-button__icon"
              aria-hidden="true"
            />
            <span>開始對話</span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.character-detail-view {
  min-height: 100vh;
  min-height: 100dvh;
  background: #0f1016;
  color: #f8f9ff;
  display: flex;
  flex-direction: column;
}

.detail-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: rgba(15, 16, 22, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.detail-header__button {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;

  &:hover {
    background: rgba(148, 163, 184, 0.2);
  }

  .icon {
    width: 20px;
    height: 20px;
  }
}

.detail-header__title {
  text-align: center;

  h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #f8f9ff;
  }
}

.detail-header__spacer {
  width: 36px;
}

.detail-content {
  flex: 1;
  padding: 0;
  overflow-y: auto;
  background: #0f1016;
}

.detail-status {
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

.character-detail {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  gap: 1.5rem;
  overflow-y: auto;
  flex: 1;
  max-height: calc(100dvh - 80px);
}

.detail-portrait {
  display: flex;
  justify-content: center;

  &__image {
    width: 100%;
    max-width: 300px;
    border-radius: 16px;
    object-fit: cover;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  // 🔥 占位符樣式
  &__placeholder {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 3 / 4;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(96, 42, 72, 0.3) 0%, rgba(17, 6, 15, 0.6) 100%);
    border: 3px dashed rgba(255, 236, 213, 0.25);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2),
                inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  &__text {
    font-size: 4rem;
    font-weight: 700;
    color: rgba(255, 236, 213, 0.7);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }

  &__hint {
    font-size: 0.875rem;
    color: rgba(255, 236, 213, 0.4);
    letter-spacing: 0.1em;
  }
}

.detail-basic {
  text-align: center;

  &__metrics {
    display: inline-flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 999px;
    background: rgba(30, 32, 42, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.15);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
}

.metric-item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: rgba(226, 232, 240, 0.7);

  &__icon {
    width: 16px;
    height: 16px;
    color: #ff6b9d;
  }

  &__value {
    font-weight: 600;
    color: #f8f9ff;
  }
}

.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-section {
  padding: 1rem;
  border-radius: 12px;
  background: rgba(30, 32, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.625rem;
  }

  &__icon {
    width: 18px;
    height: 18px;
    color: rgba(148, 163, 184, 0.6);
  }

  &__title {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(148, 163, 184, 0.6);

    &--solo {
      font-size: 0.8125rem;
      color: rgba(203, 213, 225, 0.7);
    }
  }

  &__content {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: rgba(248, 249, 255, 0.9);

    &--multiline {
      line-height: 1.7;
      white-space: pre-wrap;
    }

    &--secret {
      padding: 0.875rem;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px dashed rgba(148, 163, 184, 0.2);
      color: rgba(203, 213, 225, 0.7);
      font-style: italic;
      font-size: 0.875rem;
    }

    &--message {
      padding: 0.875rem;
      border-radius: 8px;
      background: rgba(255, 193, 7, 0.08);
      border-left: 3px solid #ffc107;
      color: rgba(248, 249, 255, 0.9);
      font-size: 0.9375rem;
    }
  }
}

.voice-label {
  margin: 0 0 0.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: rgba(248, 249, 255, 0.95);
}

.voice-description {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgba(203, 213, 225, 0.7);
}

.detail-actions {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0 1rem;
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 2rem;
  border-radius: 12px;
  border: none;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;

  &--primary {
    background: #ff6b9d;
    color: #fff;
    box-shadow: 0 2px 8px rgba(255, 107, 157, 0.25);

    &:hover {
      background: #ff4d8f;
      box-shadow: 0 4px 12px rgba(255, 107, 157, 0.35);
    }

    &:active {
      transform: scale(0.98);
    }
  }

  &__icon {
    width: 20px;
    height: 20px;
  }
}

@media (max-width: 540px) {
  .character-detail {
    padding: 1rem 0.875rem;
  }

  .detail-section {
    padding: 0.875rem;
  }
}
</style>
