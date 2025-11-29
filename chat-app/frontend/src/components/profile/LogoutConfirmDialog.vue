<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";

// Compatible function type for ref binding
type RefBindFn = (el: HTMLElement | null) => void;

interface Props {
  isVisible?: boolean;
  isLoggingOut?: boolean;
  error?: string;
  cancelButtonRef?: RefBindFn;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false,
  isLoggingOut: false,
  error: "",
});

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();

// Wrapper for ref binding
const handleCancelButtonRef = (el: Element | ComponentPublicInstance | null) => {
  if (el instanceof HTMLElement || el === null) {
    props.cancelButtonRef?.(el);
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="logout-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
    >
      <div
        class="logout-confirm__backdrop"
        role="presentation"
        @click="emit('cancel')"
      ></div>
      <div class="logout-confirm__panel">
        <header class="logout-confirm__header">
          <h2 id="logout-confirm-title">確認登出</h2>
          <p class="logout-confirm__subtitle">
            登出後需要重新登入才能繼續使用本服務。
          </p>
        </header>
        <p class="logout-confirm__message">確定要登出目前帳號嗎？</p>
        <p v-if="error" class="logout-confirm__error" role="alert">
          {{ error }}
        </p>
        <footer class="logout-confirm__actions">
          <button
            type="button"
            class="btn-unified btn-cancel"
            :ref="handleCancelButtonRef"
            @click="emit('cancel')"
            :disabled="isLoggingOut"
          >
            取消
          </button>
          <button
            type="button"
            class="btn-unified btn-danger"
            @click="emit('confirm')"
            :disabled="isLoggingOut"
          >
            {{ isLoggingOut ? "登出中…" : "確認登出" }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.logout-confirm {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  animation: logout-fade-in 0.2s ease-out;
}

@keyframes logout-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes logout-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.logout-confirm__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  cursor: pointer;
}

.logout-confirm__panel {
  position: relative;
  width: min(400px, 85vw);
  padding: 2rem 1.75rem;
  border-radius: 24px;
  background: linear-gradient(
    165deg,
    rgba(30, 33, 48, 0.98),
    rgba(22, 25, 36, 0.98)
  );
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  color: #e2e8f0;
  animation: logout-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.logout-confirm__header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.logout-confirm__header h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f8fafc;
  line-height: 1.3;
}

.logout-confirm__subtitle {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  letter-spacing: 0.01em;
  color: rgba(203, 213, 225, 0.85);
}

.logout-confirm__message {
  margin: 0;
  padding: 1rem;
  font-size: 1rem;
  line-height: 1.6;
  letter-spacing: 0.01em;
  color: rgba(226, 232, 240, 0.95);
  background: rgba(148, 163, 184, 0.08);
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.logout-confirm__error {
  margin: 0;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-size: 0.875rem;
  line-height: 1.5;
  letter-spacing: 0.01em;
  color: #fca5a5;
}

.logout-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.875rem;
  margin-top: 0.5rem;
}
</style>
