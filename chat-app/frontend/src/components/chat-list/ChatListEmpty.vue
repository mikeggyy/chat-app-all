<template>
  <section
    class="chat-thread-scroll chat-thread-empty"
    aria-live="polite"
  >
    <div v-if="isLoading" class="chat-list-loading">
      <div class="chat-list-loading__spinner"></div>
      <p>載入對話列表...</p>
    </div>
    <div v-else class="empty-state">
      <div class="empty-state__icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="empty-state__message">
        目前沒有聊天紀錄，試著從配對開始新的對話吧。
      </p>
    </div>
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  min-height: 400px;
  overflow: hidden;
}

/* 背景裝飾 - 移除，使用頁面本身的背景光暈 */

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

.empty-state {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  max-width: 340px;
  margin: 0 auto;
  padding: 3rem 2.5rem;
  border-radius: 24px;
  border: 2px dashed rgba(148, 163, 184, 0.25);
  background: linear-gradient(
    135deg,
    rgba(15, 23, 42, 0.8) 0%,
    rgba(15, 23, 42, 0.6) 100%
  );
  backdrop-filter: blur(20px);
  box-shadow:
    0 12px 48px rgba(0, 0, 0, 0.4),
    0 6px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  text-align: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.empty-state:hover {
  border-color: rgba(236, 72, 153, 0.5);
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.9) 0%,
    rgba(15, 23, 42, 0.7) 100%
  );
  transform: translateY(-4px) scale(1.02);
  box-shadow:
    0 16px 56px rgba(0, 0, 0, 0.5),
    0 8px 32px rgba(236, 72, 153, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.empty-state__icon {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%);
  color: #ffffff;
  box-shadow:
    0 8px 24px rgba(236, 72, 153, 0.4),
    0 4px 12px rgba(236, 72, 153, 0.25);
  position: relative;
  animation: pulse 3s ease-in-out infinite;
}

.empty-state__icon::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #f472b6);
  opacity: 0.4;
  filter: blur(12px);
  z-index: -1;
  animation: rotate 6s linear infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.empty-state__icon svg {
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.empty-state__message {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: #e2e8f0;
  letter-spacing: 0.02em;
  font-weight: 500;
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
  color: #e2e8f0;
}

.chat-list-loading__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid rgba(226, 232, 240, 0.2);
  border-top-color: #ec4899;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 響應式設計 */
@media (max-width: 480px) {
  .empty-state {
    padding: 2.5rem 2rem;
    gap: 1.25rem;
    max-width: 300px;
  }

  .empty-state__icon {
    width: 64px;
    height: 64px;
  }

  .empty-state__icon svg {
    width: 32px;
    height: 32px;
  }

  .empty-state__message {
    font-size: 0.875rem;
    line-height: 1.6;
  }
}

/* 提升性能 - 減少低端設備的動畫 */
@media (prefers-reduced-motion: reduce) {
  .empty-state__icon,
  .empty-state__icon::before {
    animation: none;
  }

  .empty-state {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
}
</style>
