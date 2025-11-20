<template>
  <Teleport to="body">
    <Transition name="notification-slide">
      <div v-if="isVisible" class="video-notification">
        <div class="video-notification-content">
          <div class="notification-icon">
            <VideoCameraIcon class="icon" />
          </div>
          <div class="notification-text">
            <p class="notification-title">影片錄好了！</p>
            <p class="notification-subtitle">{{ characterName }} 的影片已生成完成</p>
          </div>
          <button
            type="button"
            class="notification-button"
            @click="$emit('view-video')"
          >
            查看
          </button>
          <button
            type="button"
            class="notification-close"
            @click="$emit('close')"
          >
            <XMarkIcon class="icon" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { VideoCameraIcon, XMarkIcon } from '@heroicons/vue/24/outline';

interface Props {
  isVisible: boolean;
  characterName: string;
}

interface Emits {
  (e: 'view-video'): void;
  (e: 'close'): void;
}

withDefaults(defineProps<Props>(), {
  isVisible: false,
  characterName: '',
});

defineEmits<Emits>();
</script>

<style scoped>
.video-notification {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: calc(100% - 2rem);
  max-width: 500px;
}

.video-notification-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(255, 107, 157, 0.3);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(255, 107, 157, 0.2);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.notification-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff6b9d 0%, #c261fe 100%);
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

.notification-button {
  padding: 0.5rem 1.25rem;
  background: linear-gradient(135deg, #ff6b9d 0%, #c261fe 100%);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(255, 107, 157, 0.3);
}

.notification-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 107, 157, 0.4);
}

.notification-button:active {
  transform: translateY(0);
}

.notification-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.notification-close .icon {
  width: 1.25rem;
  height: 1.25rem;
}

.notification-close:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
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
  .video-notification {
    top: 0.75rem;
    width: calc(100% - 1.5rem);
  }

  .video-notification-content {
    padding: 0.875rem 1rem;
    gap: 0.625rem;
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

  .notification-button {
    padding: 0.4rem 1rem;
    font-size: 0.8rem;
  }
}
</style>
