<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div class="dialog-overlay" @click.self="handleCancel">
        <div class="dialog-container">
          <div class="dialog-content">
            <!-- 標題 -->
            <div class="dialog-header">
              <h3 class="dialog-title">{{ title }}</h3>
            </div>

            <!-- 內容 -->
            <div class="dialog-body">
              <p v-for="(line, index) in messageLines" :key="index" class="dialog-message">
                {{ line }}
              </p>
            </div>

            <!-- 按鈕 -->
            <div class="dialog-footer">
              <button
                class="btn-unified btn-cancel"
                @click="handleCancel"
              >
                {{ cancelText }}
              </button>
              <button
                class="btn-unified btn-confirm"
                @click="handleConfirm"
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '確認操作',
  confirmText: '確定',
  cancelText: '取消',
});

interface Emits {
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}

const emit = defineEmits<Emits>();

const messageLines = computed<string[]>(() => {
  return props.message.split('\n');
});

const handleConfirm = (): void => {
  emit('confirm');
};

const handleCancel = (): void => {
  emit('cancel');
};
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.dialog-container {
  max-width: 90%;
  width: 400px;
  max-height: 90vh;
  overflow: auto;
}

.dialog-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

.dialog-header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
  margin: 0;
  text-align: center;
}

.dialog-body {
  padding: 1.5rem;
  color: white;
}

.dialog-message {
  font-size: 1rem;
  line-height: 1.6;
  margin: 0.5rem 0;
  text-align: center;
}

.dialog-message:first-child {
  margin-top: 0;
}

.dialog-message:last-child {
  margin-bottom: 0;
}

.dialog-footer {
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  gap: 1rem;
  justify-content: center;
}

/* 動畫 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .dialog-content {
  animation: slideUp 0.3s ease-out;
}

.dialog-leave-active .dialog-content {
  animation: slideDown 0.3s ease-in;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes slideDown {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
}

/* 響應式 */
@media (max-width: 640px) {
  .dialog-container {
    width: 90%;
    max-width: none;
  }

  .dialog-title {
    font-size: 1.1rem;
  }

  .dialog-message {
    font-size: 0.95rem;
  }

  .dialog-button {
    padding: 0.65rem 1.25rem;
    font-size: 0.95rem;
  }
}

/* ========================================
   桌面版樣式 (≥ 1024px)
   ======================================== */
@media (min-width: 1024px) {
  .dialog-container {
    max-width: 440px;
  }

  .dialog-content {
    border-radius: 24px;
  }

  .dialog-header {
    padding: 1.75rem 1.75rem 1.25rem;
  }

  .dialog-title {
    font-size: 1.35rem;
  }

  .dialog-body {
    padding: 1.75rem;
  }

  .dialog-message {
    font-size: 1.05rem;
    line-height: 1.7;
  }

  .dialog-footer {
    padding: 1.25rem 1.75rem 1.75rem;
    gap: 1.25rem;
  }

  .btn-unified {
    transition: all 0.2s ease;
  }

  .btn-unified:hover {
    transform: translateY(-2px);
  }

  .btn-confirm:hover {
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  }
}
</style>
