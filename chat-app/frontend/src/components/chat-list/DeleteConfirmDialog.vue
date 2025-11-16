<template>
  <Teleport to="body">
    <!-- 背景遮罩 -->
    <div
      v-if="open"
      class="chat-list-dialog-backdrop"
      aria-hidden="true"
      @click="$emit('cancel')"
    />

    <!-- 對話框 -->
    <section
      v-if="open"
      class="chat-list-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-delete-title"
    >
      <h2 id="chat-delete-title" class="chat-list-dialog__title">
        隱藏對話
      </h2>
      <p class="chat-list-dialog__message">
        確定要隱藏
        <strong>{{ displayName }}</strong>
        嗎？對話紀錄會保留，隨時都能重新開啟。
      </p>
      <div class="chat-list-dialog__actions">
        <button
          type="button"
          class="chat-list-dialog__btn chat-list-dialog__btn--secondary"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          type="button"
          class="chat-list-dialog__btn chat-list-dialog__btn--primary"
          :disabled="isDeleting"
          @click="$emit('confirm')"
        >
          {{ isDeleting ? '處理中...' : '確定隱藏' }}
        </button>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
// Types
interface Props {
  open?: boolean;
  displayName?: string;
  isDeleting?: boolean;
}

interface Emits {
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}

withDefaults(defineProps<Props>(), {
  open: false,
  displayName: '',
  isDeleting: false,
});

defineEmits<Emits>();
</script>

<style scoped>
.chat-list-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.chat-list-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1001;
  width: 90%;
  max-width: 400px;
  padding: 1.5rem;
  background: var(--bg-primary, #ffffff);
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  animation: slideUp 0.3s ease-out;
}

.chat-list-dialog__title {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.chat-list-dialog__message {
  margin: 0 0 1.5rem 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-secondary, #6b7280);
}

.chat-list-dialog__message strong {
  color: var(--text-primary, #111827);
  font-weight: 600;
}

.chat-list-dialog__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.chat-list-dialog__btn {
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-list-dialog__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-list-dialog__btn--secondary {
  color: var(--text-secondary, #6b7280);
  background: var(--bg-secondary, #f3f4f6);
}

.chat-list-dialog__btn--secondary:hover:not(:disabled) {
  background: var(--bg-hover, #e5e7eb);
}

.chat-list-dialog__btn--primary {
  color: #ffffff;
  background: var(--primary-color, #3b82f6);
}

.chat-list-dialog__btn--primary:hover:not(:disabled) {
  background: var(--primary-hover, #2563eb);
}

.chat-list-dialog__btn:focus-visible {
  outline: 2px solid var(--primary-color, #3b82f6);
  outline-offset: 2px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translate(-50%, -40%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}
</style>
