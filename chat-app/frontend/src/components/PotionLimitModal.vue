<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ShoppingCartIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  potionType: {
    type: String, // 'memoryBoost' or 'brainBoost'
    required: true,
  },
  characterName: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['close']);
const router = useRouter();

const potionInfo = computed(() => {
  if (props.potionType === 'memoryBoost') {
    return {
      name: '記憶增強藥水',
      description: '增加 AI 角色的對話記憶上限，讓對話更連貫',
      icon: '🧠',
      benefit: '✓ 增加對話記憶上限\n✓ 對話更連貫自然\n✓ 效果持續 30 天',
    };
  } else if (props.potionType === 'brainBoost') {
    return {
      name: '腦力激盪藥水',
      description: '升級至最高階 AI 模型，提供更聰明的對話',
      icon: '⚡',
      benefit: '✓ 使用最高階 AI 模型\n✓ 回應更智能準確\n✓ 效果持續 30 天',
    };
  }
  return null;
});

const handleClose = () => {
  emit('close');
};

const handleGoToShop = () => {
  emit('close');
  router.push({ path: '/shop', query: { category: 'potions' } });
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
        class="potion-limit-modal"
        role="dialog"
        aria-modal="true"
        @click="handleOverlayClick"
      >
        <div class="potion-limit-content">
          <!-- Header -->
          <div class="potion-limit-header">
            <div class="potion-icon">{{ potionInfo?.icon }}</div>
            <h2 class="potion-title">{{ potionInfo?.name }}</h2>
            <button
              type="button"
              class="close-btn"
              aria-label="關閉"
              @click="handleClose"
            >
              <XMarkIcon class="icon" />
            </button>
          </div>

          <!-- Body -->
          <div class="potion-limit-body">
            <div class="alert-box">
              <div class="alert-icon">⚠️</div>
              <p class="alert-text">您目前沒有{{ potionInfo?.name }}</p>
            </div>

            <p class="potion-description">{{ potionInfo?.description }}</p>

            <div class="benefits-box">
              <div class="benefits-title">道具效果：</div>
              <div class="benefits-content">{{ potionInfo?.benefit }}</div>
            </div>

            <p class="hint-text">
              前往商城購買{{ potionInfo?.name }}，提升與「{{ characterName || '角色' }}」的對話體驗！
            </p>
          </div>

          <!-- Actions -->
          <div class="potion-limit-actions">
            <button
              type="button"
              class="btn-unified btn-confirm"
              @click="handleGoToShop"
            >
              <ShoppingCartIcon class="btn-icon" />
              前往商城
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.potion-limit-modal {
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

.potion-limit-content {
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

.potion-limit-header {
  padding: 1.75rem 1.5rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, transparent 100%);
}

.potion-icon {
  font-size: 3rem;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 8px rgba(139, 92, 246, 0.4));
}

.potion-title {
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

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f8f9ff;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}

.potion-limit-body {
  padding: 1.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.alert-box {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%);
  border-radius: 12px;
  border: 1px solid rgba(251, 191, 36, 0.25);
}

.alert-icon {
  font-size: 1.75rem;
  flex-shrink: 0;
}

.alert-text {
  color: #fcd34d;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.01em;
}

.potion-description {
  color: #c8ccd8;
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
  text-align: center;
}

.benefits-box {
  padding: 1.25rem;
  background: rgba(139, 92, 246, 0.08);
  border-radius: 12px;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.benefits-title {
  color: #a78bfa;
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

.hint-text {
  color: #a8afc4;
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
  text-align: center;
  padding: 0.5rem;
}

.potion-limit-actions {
  padding: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

.btn-icon {
  width: 18px;
  height: 18px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .potion-limit-content,
.modal-leave-active .potion-limit-content {
  transition: transform 0.25s ease;
}

.modal-enter-from .potion-limit-content,
.modal-leave-to .potion-limit-content {
  transform: scale(0.9) translateY(20px);
}

@media (max-width: 480px) {
  .potion-limit-content {
    max-width: 100%;
    margin: 0 0.5rem;
  }

  .potion-limit-header {
    padding: 1.5rem 1.25rem 1rem;
  }

  .potion-icon {
    font-size: 2.5rem;
  }

  .potion-title {
    font-size: 1.2rem;
  }

  .potion-limit-body {
    padding: 1.5rem 1.25rem;
  }

  .potion-limit-actions {
    padding: 1.25rem;
  }
}
</style>
