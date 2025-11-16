<template>
  <div class="suggestion-wrapper">
    <!-- 建議按鈕 -->
    <button
      ref="buttonRef"
      type="button"
      class="suggestion-button"
      :aria-expanded="isMenuOpen ? 'true' : 'false'"
      aria-haspopup="menu"
      aria-label="取得建議回覆"
      :disabled="disabled"
      @click="toggleMenu"
    >
      <SparklesIcon class="icon" aria-hidden="true" />
    </button>

    <!-- 下拉選單 -->
    <div
      v-if="isMenuOpen"
      ref="menuRef"
      class="suggestion-menu"
      role="menu"
      aria-label="建議回覆"
    >
      <!-- 載入中 -->
      <div v-if="isLoading" class="suggestion-menu__loading">
        <span class="suggestion-loader" aria-hidden="true">
          <span class="suggestion-loader__dot"></span>
          <span class="suggestion-loader__dot"></span>
          <span class="suggestion-loader__dot"></span>
        </span>
        <p class="suggestion-menu__state">生成建議中…</p>
      </div>

      <!-- 建議列表或錯誤 -->
      <template v-else>
        <!-- 錯誤狀態 -->
        <p
          v-if="error"
          class="suggestion-menu__state suggestion-menu__state--error"
        >
          {{ error }}
        </p>

        <!-- 建議項目 -->
        <button
          v-for="item in suggestions"
          :key="item"
          type="button"
          class="suggestion-menu__item"
          role="menuitem"
          @click="handleSelect(item)"
        >
          {{ item }}
        </button>

        <!-- 空狀態 -->
        <p v-if="!suggestions.length && !error" class="suggestion-menu__empty">
          目前沒有建議內容
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";
import { SparklesIcon } from "@heroicons/vue/24/outline";

/**
 * SuggestionMenu - 建議回覆選單組件
 * 職責：顯示 AI 生成的建議回覆
 */

// Types
interface Props {
  suggestions?: string[];
  isLoading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

interface Emits {
  (e: 'suggestion-click', item: string): void;
  (e: 'request-suggestions'): void;
}

// Props
const props = withDefaults(defineProps<Props>(), {
  suggestions: () => [],
  isLoading: false,
  error: null,
  disabled: false,
});

// Emits
const emit = defineEmits<Emits>();

// Refs
const buttonRef: Ref<HTMLElement | null> = ref(null);
const menuRef: Ref<HTMLElement | null> = ref(null);
const isMenuOpen: Ref<boolean> = ref(false);

/**
 * 切換選單
 */
const toggleMenu = (): void => {
  if (props.disabled) return;

  isMenuOpen.value = !isMenuOpen.value;

  // 打開選單時請求建議
  if (isMenuOpen.value && props.suggestions.length === 0 && !props.isLoading) {
    emit("request-suggestions");
  }
};

/**
 * 選擇建議
 */
const handleSelect = (item: string): void => {
  emit("suggestion-click", item);
  isMenuOpen.value = false;
};

/**
 * 點擊外部關閉選單
 */
const handleClickOutside = (event: MouseEvent): void => {
  if (
    isMenuOpen.value &&
    buttonRef.value &&
    menuRef.value &&
    !buttonRef.value.contains(event.target as Node) &&
    !menuRef.value.contains(event.target as Node)
  ) {
    isMenuOpen.value = false;
  }
};

// 生命週期
onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped>
.suggestion-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  color: rgba(255, 255, 255, 0.6);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.suggestion-button:hover:not(:disabled) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
}

.suggestion-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.icon {
  width: 1.5rem;
  height: 1.5rem;
}

/* 選單樣式 */
.suggestion-menu {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 0;
  z-index: 50;
  min-width: 16rem;
  max-width: 20rem;
  max-height: 20rem;
  overflow-y: auto;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 0.75rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(139, 92, 246, 0.15);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.suggestion-menu__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
}

.suggestion-loader {
  display: flex;
  gap: 0.5rem;
}

.suggestion-loader__dot {
  width: 0.5rem;
  height: 0.5rem;
  background-color: var(--primary-color, #8b5cf6);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.suggestion-loader__dot:nth-child(1) {
  animation-delay: -0.32s;
}

.suggestion-loader__dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.suggestion-menu__state {
  margin: 0;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.7);
  text-align: center;
}

.suggestion-menu__state--error {
  color: #f87171;
}

.suggestion-menu__item {
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: #f8fafc;
  text-align: left;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
}

.suggestion-menu__item:last-child {
  border-bottom: none;
}

.suggestion-menu__item:hover {
  background-color: rgba(139, 92, 246, 0.15);
  color: #ffffff;
}

.suggestion-menu__empty {
  padding: 1.5rem;
  margin: 0;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.5);
  text-align: center;
}

/* 自定義滾動條 */
.suggestion-menu::-webkit-scrollbar {
  width: 6px;
}

.suggestion-menu::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.3);
  border-radius: 3px;
}

.suggestion-menu::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.4);
  border-radius: 3px;
}

.suggestion-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.6);
}

/* 響應式設計 */
@media (max-width: 540px) {
  .suggestion-button {
    width: 2.5rem;
    height: 2.5rem;
  }

  .icon {
    width: 1.375rem;
    height: 1.375rem;
  }

  .suggestion-menu {
    min-width: 14rem;
    max-width: 18rem;
  }
}
</style>
