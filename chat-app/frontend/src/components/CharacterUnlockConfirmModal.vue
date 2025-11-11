<script setup>
import { computed } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  characterName: {
    type: String,
    default: '角色',
  },
  remainingCards: {
    type: Number,
    default: 0,
  },
  isUsing: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'confirm']);

const handleClose = () => {
  if (props.isUsing) return;
  emit('close');
};

const handleConfirm = () => {
  if (props.isUsing) return;
  emit('confirm');
};

const handleOverlayClick = (event) => {
  if (event.target === event.currentTarget) {
    handleClose();
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="unlock-confirm-modal"
        role="dialog"
        aria-modal="true"
        @click="handleOverlayClick"
      >
        <div class="unlock-confirm-content">
          <!-- Header -->
          <div class="unlock-confirm-header">
            <div class="unlock-icon">🎫</div>
            <h2 class="unlock-title">使用角色解鎖卡</h2>
            <button
              type="button"
              class="close-btn"
              aria-label="關閉"
              :disabled="isUsing"
              @click="handleClose"
            >
              <XMarkIcon class="icon" />
            </button>
          </div>

          <!-- Body -->
          <div class="unlock-confirm-body">
            <p class="confirm-message">
              確定要使用<strong>角色解鎖卡</strong>來解鎖「<strong>{{ characterName }}</strong>」嗎？
            </p>

            <div class="benefits-box">
              <div class="benefits-title">解鎖效果：</div>
              <div class="benefits-content">
✓ 與「{{ characterName }}」暢聊 7 天
✓ 無限次數對話
✓ 不消耗其他次數限制
              </div>
            </div>

            <div class="info-box">
              <div class="info-icon">ℹ️</div>
              <p class="info-text">
                使用後，您將剩餘 <strong>{{ remainingCards - 1 }}</strong> 張角色解鎖卡
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="unlock-confirm-actions">
            <button
              type="button"
              class="btn-unified btn-success btn-full"
              :disabled="isUsing"
              @click="handleConfirm"
            >
              {{ isUsing ? '使用中...' : '確定使用' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.unlock-confirm-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  padding: 1rem;
}

.unlock-confirm-content {
  background: linear-gradient(135deg, #1a1d2e 0%, #16192b 100%);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  max-width: 440px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.unlock-confirm-header {
  padding: 1.75rem 1.5rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.08) 0%, transparent 100%);
}

.unlock-icon {
  font-size: 3rem;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 8px rgba(34, 197, 94, 0.4));
}

.unlock-title {
  flex: 1;
  font-size: 1.35rem;
  font-weight: 600;
  color: #f8f9ff;
  margin: 0;
  letter-spacing: 0.02em;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #8b92b0;
  cursor: pointer;
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  .icon {
    width: 20px;
    height: 20px;
  }

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #f8f9ff;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.unlock-confirm-body {
  padding: 1.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.confirm-message {
  color: #c8ccd8;
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
  text-align: center;

  strong {
    color: #22c55e;
    font-weight: 600;
  }
}

.benefits-box {
  padding: 1.25rem;
  background: rgba(34, 197, 94, 0.08);
  border-radius: 12px;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.benefits-title {
  color: #4ade80;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.benefits-content {
  color: #e0e4ef;
  font-size: 0.938rem;
  line-height: 1.8;
  white-space: pre-line;
}

.info-box {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.08) 100%);
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.info-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.info-text {
  color: #93c5fd;
  font-size: 0.9rem;
  margin: 0;

  strong {
    color: #60a5fa;
    font-weight: 600;
  }
}

.unlock-confirm-actions {
  padding: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  gap: 0.875rem;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .unlock-confirm-content,
.modal-leave-active .unlock-confirm-content {
  transition: transform 0.25s ease;
}

.modal-enter-from .unlock-confirm-content,
.modal-leave-to .unlock-confirm-content {
  transform: scale(0.9) translateY(20px);
}

@media (max-width: 480px) {
  .unlock-confirm-content {
    max-width: 100%;
    margin: 0 0.5rem;
  }

  .unlock-confirm-header {
    padding: 1.5rem 1.25rem 1rem;
  }

  .unlock-icon {
    font-size: 2.5rem;
  }

  .unlock-title {
    font-size: 1.2rem;
  }

  .unlock-confirm-body {
    padding: 1.5rem 1.25rem;
  }

  .unlock-confirm-actions {
    padding: 1.25rem;
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
