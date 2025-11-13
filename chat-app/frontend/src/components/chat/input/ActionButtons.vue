<template>
  <div class="action-buttons">
    <!-- 發送按鈕 -->
    <button
      type="button"
      class="action-buttons__send"
      :class="{ 'is-disabled': !canSend || disabled }"
      :disabled="!canSend || disabled"
      aria-label="送出訊息"
      @click="$emit('send-click')"
    >
      <PaperAirplaneIcon class="icon" aria-hidden="true" />
    </button>

    <!-- 禮物按鈕 -->
    <button
      type="button"
      class="action-buttons__gift"
      :disabled="isSendingGift || isRequestingSelfie || isRequestingVideo || disabled"
      aria-label="傳送禮物"
      @click="$emit('gift-click')"
    >
      <GiftIcon class="icon" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup>
import { PaperAirplaneIcon, GiftIcon } from '@heroicons/vue/24/outline';

/**
 * ActionButtons - 操作按鈕組件
 * 職責：發送按鈕和禮物按鈕
 */

// Props
defineProps({
  canSend: {
    type: Boolean,
    default: false,
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
  disabled: {
    type: Boolean,
    default: false,
  },
});

// Emits
defineEmits(['send-click', 'gift-click']);
</script>

<style scoped>
.action-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-buttons__send,
.action-buttons__gift {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  color: var(--primary-color, #8b5cf6);
  background-color: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-buttons__send:hover:not(:disabled),
.action-buttons__gift:hover:not(:disabled) {
  background-color: var(--primary-light, rgba(139, 92, 246, 0.1));
  transform: scale(1.05);
}

.action-buttons__send:active:not(:disabled),
.action-buttons__gift:active:not(:disabled) {
  transform: scale(0.95);
}

.action-buttons__send.is-disabled,
.action-buttons__send:disabled,
.action-buttons__gift:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.icon {
  width: 1.5rem;
  height: 1.5rem;
}

/* 響應式設計 */
@media (max-width: 540px) {
  .action-buttons__send,
  .action-buttons__gift {
    width: 2.5rem;
    height: 2.5rem;
  }

  .icon {
    width: 1.375rem;
    height: 1.375rem;
  }
}
</style>
