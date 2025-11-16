<script setup lang="ts">
import { useToast } from '../composables/useToast';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import type { Component } from 'vue';

type ToastType = 'success' | 'error' | 'warning' | 'info';

const { toasts, dismissToast } = useToast();

const getIcon = (type: ToastType): Component => {
  switch (type) {
    case 'success':
      return CheckCircleIcon;
    case 'error':
      return ExclamationCircleIcon;
    case 'warning':
      return ExclamationTriangleIcon;
    case 'info':
    default:
      return InformationCircleIcon;
  }
};

const getColorClass = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return 'toast--success';
    case 'error':
      return 'toast--error';
    case 'warning':
      return 'toast--warning';
    case 'info':
    default:
      return 'toast--info';
  }
};
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="[getColorClass(toast.type), { 'toast--visible': toast.isVisible }]"
          role="alert"
          aria-live="polite"
        >
          <div class="toast-content">
            <component :is="getIcon(toast.type)" class="toast-icon" aria-hidden="true" />
            <div class="toast-text">
              <p v-if="toast.title" class="toast-title">{{ toast.title }}</p>
              <p class="toast-message">{{ toast.message }}</p>
            </div>
          </div>
          <button
            type="button"
            class="toast-close"
            aria-label="關閉"
            @click="dismissToast(toast.id)"
          >
            <XMarkIcon class="icon" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 400px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: rgba(15, 17, 28, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  pointer-events: auto;
  min-width: 320px;
}

.toast-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
}

.toast-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.toast-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toast-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #f8f9ff;
}

.toast-message {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  letter-spacing: 0.01em;
  color: rgba(226, 232, 240, 0.9);
}

.toast-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(148, 163, 184, 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
  flex-shrink: 0;
}

.toast-close:hover {
  background: rgba(148, 163, 184, 0.15);
  color: rgba(226, 232, 240, 0.95);
}

.toast-close .icon {
  width: 18px;
  height: 18px;
}

/* Toast 類型樣式 */
.toast--success {
  border-color: rgba(34, 197, 94, 0.4);
}

.toast--success .toast-icon {
  color: #22c55e;
}

.toast--error {
  border-color: rgba(239, 68, 68, 0.4);
}

.toast--error .toast-icon {
  color: #ef4444;
}

.toast--warning {
  border-color: rgba(251, 191, 36, 0.4);
}

.toast--warning .toast-icon {
  color: #fbbf24;
}

.toast--info {
  border-color: rgba(59, 130, 246, 0.4);
}

.toast--info .toast-icon {
  color: #3b82f6;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 300ms ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(50%) scale(0.95);
}

/* Responsive */
@media (max-width: 640px) {
  .toast-container {
    top: 0.75rem;
    right: 0.75rem;
    left: 0.75rem;
    max-width: none;
  }

  .toast {
    min-width: auto;
    padding: 0.875rem 1rem;
  }

  .toast-title {
    font-size: 0.9rem;
  }

  .toast-message {
    font-size: 0.85rem;
  }
}
</style>
