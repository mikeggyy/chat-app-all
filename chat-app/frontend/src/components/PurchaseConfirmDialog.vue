<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        class="purchase-dialog-overlay"
        @click.self="handleCancel"
        @keydown.esc="handleCancel"
      >
        <Transition name="scale" appear>
          <div class="purchase-dialog-modal">
            <!-- 關閉按鈕 -->
            <button
              type="button"
              class="purchase-dialog-close"
              @click="handleCancel"
              aria-label="關閉"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <!-- 圖標裝飾 -->
            <div class="purchase-dialog-icon-wrapper">
              <div class="purchase-dialog-icon-bg"></div>
              <svg class="purchase-dialog-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>

            <!-- 標題 -->
            <h3 class="purchase-dialog-title">{{ title }}</h3>

            <!-- 內容 -->
            <div class="purchase-dialog-content">
              <div class="purchase-dialog-info">
                <div
                  v-for="(line, index) in messageLines"
                  :key="index"
                  class="purchase-dialog-info-row"
                >
                  <span class="purchase-dialog-info-text">{{ line }}</span>
                </div>
              </div>
            </div>

            <!-- 按鈕組 -->
            <div class="purchase-dialog-actions">
              <button
                type="button"
                class="btn-unified btn-cancel"
                @click="handleCancel"
              >
                <span>{{ cancelText }}</span>
              </button>
              <button
                type="button"
                class="btn-unified btn-confirm"
                @click="handleConfirm"
              >
                <span>{{ confirmText }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  title: {
    type: String,
    default: '確認購買',
  },
  message: {
    type: String,
    required: true,
  },
  confirmText: {
    type: String,
    default: '確認購買',
  },
  cancelText: {
    type: String,
    default: '取消',
  },
});

const emit = defineEmits(['confirm', 'cancel']);

const messageLines = computed(() => {
  return props.message.split('\n').filter(line => line.trim());
});

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('cancel');
};

// 防止背景滾動
onMounted(() => {
  document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* 遮罩層 */
.purchase-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

/* 彈窗主體 */
.purchase-dialog-modal {
  position: relative;
  background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
  border-radius: 24px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 440px;
  padding: 2.5rem 2rem 2rem;
  animation: modalEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 關閉按鈕 */
.purchase-dialog-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

.purchase-dialog-close svg {
  width: 18px;
  height: 18px;
  color: #6b7280;
  transition: color 0.2s;
}

.purchase-dialog-close:hover {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(1.05);
}

.purchase-dialog-close:hover svg {
  color: #374151;
}

/* 圖標 */
.purchase-dialog-icon-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
}

.purchase-dialog-icon-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.purchase-dialog-icon {
  position: relative;
  width: 80px;
  height: 80px;
  padding: 20px;
  color: white;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

/* 標題 */
.purchase-dialog-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  text-align: center;
  margin: 0 0 1.5rem;
  letter-spacing: -0.01em;
}

/* 內容區 */
.purchase-dialog-content {
  margin-bottom: 2rem;
}

.purchase-dialog-info {
  background: linear-gradient(135deg, #f8f9ff 0%, #f3f4f8 100%);
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.purchase-dialog-info-row {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0;
}

.purchase-dialog-info-row:not(:last-child) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.purchase-dialog-info-text {
  font-size: 1rem;
  color: #374151;
  font-weight: 500;
  text-align: center;
  line-height: 1.6;
}

/* 按鈕組 */
.purchase-dialog-actions {
  display: flex;
  gap: 0.75rem;
}

/* 動畫 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.scale-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.scale-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
}

.scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

@keyframes modalEnter {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 響應式設計 */
@media (max-width: 640px) {
  .purchase-dialog-modal {
    padding: 2rem 1.5rem 1.5rem;
    max-width: calc(100% - 2rem);
  }

  .purchase-dialog-title {
    font-size: 1.25rem;
  }

  .purchase-dialog-info-text {
    font-size: 0.95rem;
  }

  .purchase-dialog-btn {
    height: 48px;
    font-size: 0.95rem;
  }

  .purchase-dialog-icon-wrapper {
    width: 70px;
    height: 70px;
  }

  .purchase-dialog-icon {
    width: 70px;
    height: 70px;
    padding: 18px;
  }
}

/* 深色主題支持（可選） */
@media (prefers-color-scheme: dark) {
  .purchase-dialog-modal {
    background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .purchase-dialog-title {
    color: #f9fafb;
  }

  .purchase-dialog-info {
    background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
    border-color: rgba(102, 126, 234, 0.2);
  }

  .purchase-dialog-info-text {
    color: #e5e7eb;
  }

  .purchase-dialog-close {
    background: rgba(255, 255, 255, 0.1);
  }

  .purchase-dialog-close svg {
    color: #9ca3af;
  }

  .purchase-dialog-close:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .purchase-dialog-close:hover svg {
    color: #e5e7eb;
  }
}
</style>
