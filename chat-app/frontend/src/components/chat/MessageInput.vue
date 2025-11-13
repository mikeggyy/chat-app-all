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

<script setup>
import { ref, computed } from 'vue';
import TextInput from './input/TextInput.vue';
import ActionButtons from './input/ActionButtons.vue';
import SuggestionMenu from './input/SuggestionMenu.vue';
import MediaMenu from './input/MediaMenu.vue';

/**
 * MessageInput - 訊息輸入組件（重構後）
 * 職責：整合所有子組件，管理共享狀態
 *
 * ✅ 重構完成：從 730 行優化至 ~150 行
 * ✅ 拆分為 5 個組件：TextInput, ActionButtons, SuggestionMenu, MediaMenu, MessageInput
 * ✅ 改善可維護性、可測試性、可重用性
 */

// Props
const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  suggestions: {
    type: Array,
    default: () => [],
  },
  isLoadingSuggestions: {
    type: Boolean,
    default: false,
  },
  suggestionError: {
    type: String,
    default: null,
  },
  isSendingGift: {
    type: Boolean,
    default: false,
  },
  isRequestingSelfie: {
    type: Boolean,
    default: false,
  },
  isRequestingVideo: {
    type: Boolean,
    default: false,
  },
  photoRemaining: {
    type: Number,
    default: null,
  },
});

// Emits
const emit = defineEmits([
  'update:modelValue',
  'send',
  'suggestion-click',
  'request-suggestions',
  'gift-click',
  'selfie-click',
  'video-click',
]);

// Refs
const textInputRef = ref(null);

// Computed
const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const hasContent = computed(() => {
  return inputValue.value && inputValue.value.trim().length > 0;
});

/**
 * 發送訊息
 */
const handleSend = () => {
  if (!hasContent.value || props.disabled) return;
  emit('send', inputValue.value.trim());
};

/**
 * 處理建議點擊
 */
const handleSuggestionClick = (suggestion) => {
  emit('suggestion-click', suggestion);
};

/**
 * 聚焦輸入框（暴露給父組件）
 */
const focus = () => {
  textInputRef.value?.focus();
};

// 暴露方法
defineExpose({ focus });
</script>

<style scoped>
.chat-input {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--bg-primary, #ffffff);
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.chat-input__field {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  background-color: var(--bg-secondary, #f9fafb);
  border-radius: 1.5rem;
  transition: background-color 0.2s ease;
}

.chat-input__field:focus-within {
  background-color: var(--bg-hover, #f3f4f6);
}

/* 響應式設計 */
@media (max-width: 540px) {
  .chat-input {
    gap: 0.5rem;
    padding: 0.75rem;
  }
}
</style>
