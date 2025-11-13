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
        <p
          v-if="!suggestions.length && !error"
          class="suggestion-menu__empty"
        >
          目前沒有建議內容
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { SparklesIcon } from '@heroicons/vue/24/outline';

/**
 * SuggestionMenu - 建議回覆選單組件
 * 職責：顯示 AI 生成的建議回覆
 */

// Props
const props = defineProps({
  suggestions: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

// Emits
const emit = defineEmits(['suggestion-click', 'request-suggestions']);

// Refs
const buttonRef = ref(null);
const menuRef = ref(null);
const isMenuOpen = ref(false);

/**
 * 切換選單
 */
const toggleMenu = () => {
  if (props.disabled) return;

  isMenuOpen.value = !isMenuOpen.value;

  // 打開選單時請求建議
  if (isMenuOpen.value && props.suggestions.length === 0 && !props.isLoading) {
    emit('request-suggestions');
  }
};

/**
 * 選擇建議
 */
const handleSelect = (item) => {
  emit('suggestion-click', item);
  isMenuOpen.value = false;
};

/**
 * 點擊外部關閉選單
 */
const handleClickOutside = (event) => {
  if (
    isMenuOpen.value &&
    buttonRef.value &&
    menuRef.value &&
    !buttonRef.value.contains(event.target) &&
    !menuRef.value.contains(event.target)
  ) {
    isMenuOpen.value = false;
  }
};

// 生命週期
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.suggestion-wrapper {
  position: relative;
}

.suggestion-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  color: var(--text-secondary, #6b7280);
  background-color: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.suggestion-button:hover:not(:disabled) {
  color: var(--primary-color, #8b5cf6);
  background-color: var(--primary-light, rgba(139, 92, 246, 0.1));
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
  background-color: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.75rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
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
  color: var(--text-secondary, #6b7280);
  text-align: center;
}

.suggestion-menu__state--error {
  color: var(--error-color, #ef4444);
}

.suggestion-menu__item {
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: var(--text-primary, #1a1a1a);
  text-align: left;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.suggestion-menu__item:last-child {
  border-bottom: none;
}

.suggestion-menu__item:hover {
  background-color: var(--bg-hover, #f9fafb);
}

.suggestion-menu__empty {
  padding: 1.5rem;
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-tertiary, #9ca3af);
  text-align: center;
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
