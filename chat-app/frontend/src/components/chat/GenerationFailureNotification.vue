<template>
  <Teleport to="body">
    <Transition name="notification-slide">
      <div v-if="isVisible" class="failure-notification">
        <div class="failure-notification-content">
          <div class="notification-icon">
            <ExclamationTriangleIcon class="icon" />
          </div>
          <div class="notification-text">
            <p class="notification-title">{{ title }}</p>
            <p class="notification-subtitle">{{ subtitle }}</p>
            <p v-if="reason" class="notification-reason">{{ reason }}</p>
          </div>
          <button
            type="button"
            class="notification-close"
            @click="$emit('close')"
          >
            我知道了
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

interface Props {
  isVisible: boolean;
  type: 'photo' | 'video';
  characterName: string;
  reason?: string;
}

interface Emits {
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false,
  characterName: '',
  reason: '',
});

defineEmits<Emits>();

const title = computed(() => {
  return props.type === 'photo' ? '照片生成失敗' : '影片生成失敗';
});

const subtitle = computed(() => {
  return `${props.characterName} 的${props.type === 'photo' ? '照片' : '影片'}生成時發生錯誤`;
});
</script>

<style scoped>
.failure-notification {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: calc(100% - 2rem);
  max-width: 500px;
}

.failure-notification-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #2d1b1e 0%, #3d1e1e 100%);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(239, 68, 68, 0.2);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.notification-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border-radius: 50%;
  flex-shrink: 0;
}

.notification-icon .icon {
  width: 1.5rem;
  height: 1.5rem;
  color: white;
}

.notification-text {
  flex: 1;
  min-width: 0;
}

.notification-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
}

.notification-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

.notification-reason {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: rgba(239, 68, 68, 0.9);
  background: rgba(239, 68, 68, 0.1);
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.notification-close {
  padding: 0.5rem 1.25rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  white-space: nowrap;
}

.notification-close:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.notification-close:active {
  transform: translateY(0);
}

/* 動畫 */
.notification-slide-enter-active,
.notification-slide-leave-active {
  transition: all 0.3s ease;
}

.notification-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.notification-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

/* 響應式 */
@media (max-width: 540px) {
  .failure-notification {
    top: 0.75rem;
    width: calc(100% - 1.5rem);
  }

  .failure-notification-content {
    padding: 0.875rem 1rem;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  .notification-icon {
    width: 2.25rem;
    height: 2.25rem;
  }

  .notification-icon .icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .notification-title {
    font-size: 0.875rem;
  }

  .notification-subtitle {
    font-size: 0.75rem;
  }

  .notification-reason {
    font-size: 0.7rem;
    padding: 0.3rem 0.5rem;
  }

  .notification-close {
    padding: 0.4rem 1rem;
    font-size: 0.8rem;
    width: 100%;
    margin-top: 0.25rem;
  }
}
</style>
