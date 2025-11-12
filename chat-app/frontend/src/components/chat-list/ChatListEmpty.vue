<template>
  <section
    class="chat-thread-scroll chat-thread-empty"
    aria-live="polite"
  >
    <div v-if="isLoading" class="chat-list-loading">
      <div class="chat-list-loading__spinner"></div>
      <p>載入對話列表...</p>
    </div>
    <p v-else>
      目前沒有聊天紀錄，試著從配對開始新的對話吧。
    </p>
  </section>
</template>

<script setup>
defineProps({
  isLoading: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
.chat-thread-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.chat-thread-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: var(--text-secondary, #6b7280);
  text-align: center;
}

.chat-thread-empty p {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.chat-list-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.chat-list-loading p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.chat-list-loading__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
