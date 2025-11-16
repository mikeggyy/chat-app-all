<template>
  <footer class="chat-input">
    <!-- 輸入欄位容器 -->
    <div class="chat-input__field">
      <!-- 文字輸入 -->
      <TextInput
        ref="textInputRef"
        v-model="inputValue"
        :disabled="disabled"
        @submit="handleSend"
      />

      <!-- 建議選單（在輸入框內） -->
      <SuggestionMenu
        :suggestions="suggestions"
        :is-loading="isLoadingSuggestions"
        :error="suggestionError"
        :disabled="disabled"
        @suggestion-click="handleSuggestionClick"
        @request-suggestions="$emit('request-suggestions')"
      />
    </div>

    <!-- 操作按鈕 -->
    <ActionButtons
      :can-send="hasContent"
      :is-sending-gift="isSendingGift"
      :is-requesting-selfie="isRequestingSelfie"
      :is-requesting-video="isRequestingVideo"
      :disabled="disabled"
      @send-click="handleSend"
      @gift-click="$emit('gift-click')"
    />

    <!-- 媒體選單 -->
    <MediaMenu
      :photo-remaining="photoRemaining"
      :is-requesting-selfie="isRequestingSelfie"
      :is-requesting-video="isRequestingVideo"
      :is-sending-gift="isSendingGift"
      @selfie-click="$emit('selfie-click')"
      @video-click="$emit('video-click')"
    />
  </footer>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import TextInput from "./input/TextInput.vue";
import ActionButtons from "./input/ActionButtons.vue";
import SuggestionMenu from "./input/SuggestionMenu.vue";
import MediaMenu from "./input/MediaMenu.vue";

/**
 * MessageInput - 訊息輸入組件（重構後）
 * 職責：整合所有子組件，管理共享狀態
 *
 * ✅ 重構完成：從 730 行優化至 ~150 行
 * ✅ 拆分為 5 個組件：TextInput, ActionButtons, SuggestionMenu, MediaMenu, MessageInput
 * ✅ 改善可維護性、可測試性、可重用性
 */

// Types
interface Props {
  modelValue?: string;
  disabled?: boolean;
  suggestions?: any[];
  isLoadingSuggestions?: boolean;
  suggestionError?: string;
  isSendingGift?: boolean;
  isRequestingSelfie?: boolean;
  isRequestingVideo?: boolean;
  photoRemaining?: number;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'send', value: string): void;
  (e: 'suggestion-click', suggestion: string): void;
  (e: 'request-suggestions'): void;
  (e: 'gift-click'): void;
  (e: 'selfie-click'): void;
  (e: 'video-click'): void;
}

// Props
const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  disabled: false,
  suggestions: () => [],
  isLoadingSuggestions: false,
  suggestionError: undefined,
  isSendingGift: false,
  isRequestingSelfie: false,
  isRequestingVideo: false,
  photoRemaining: undefined,
});

// Emits
const emit = defineEmits<Emits>();

// Refs
const textInputRef = ref<{ focus: () => void } | null>(null);

// Computed
const inputValue = computed({
  get: (): string => props.modelValue ?? "",
  set: (value: string) => emit("update:modelValue", value),
});

const hasContent = computed((): boolean => {
  return Boolean(inputValue.value && inputValue.value.trim().length > 0);
});

/**
 * 發送訊息
 */
const handleSend = (): void => {
  if (!hasContent.value || props.disabled) return;
  emit("send", inputValue.value.trim());
};

/**
 * 處理建議點擊
 */
const handleSuggestionClick = (suggestion: string): void => {
  emit("suggestion-click", suggestion);
};

/**
 * 聚焦輸入框（暴露給父組件）
 */
const focus = (): void => {
  textInputRef.value?.focus();
};

// 暴露方法
defineExpose({ focus });
</script>

<style scoped>
.chat-input {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 0.75rem);
  padding: var(--spacing-lg, 1rem);
  background: linear-gradient(180deg, #1a1d3a 0%, #0f1628 100%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  z-index: 10; /* 確保在其他內容之上 */
}

.chat-input__field {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-2xl, 1.5rem);
  transition: all var(--transition-base, 0.2s ease);
}

.chat-input__field:focus-within {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(139, 92, 246, 0.4);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

/* 響應式設計 */
@media (max-width: 540px) {
  .chat-input {
    gap: var(--spacing-sm, 0.5rem);
    padding: var(--spacing-md, 0.75rem);
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04), 0 -1px 4px rgba(0, 0, 0, 0.02);
  }
}
</style>
