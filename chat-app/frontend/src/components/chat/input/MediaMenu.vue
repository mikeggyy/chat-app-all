<template>
  <div class="media-wrapper">
    <!-- 媒體按鈕 -->
    <button
      ref="buttonRef"
      type="button"
      class="media-button"
      :class="{ 'is-loading': isRequestingSelfie || isRequestingVideo }"
      :disabled="isSendingGift"
      :aria-expanded="isMenuOpen ? 'true' : 'false'"
      aria-haspopup="menu"
      aria-label="媒體功能"
      @click="toggleMenu"
    >
      <EllipsisHorizontalIcon class="icon" aria-hidden="true" />
    </button>

    <!-- 媒體選單 -->
    <div
      v-if="isMenuOpen"
      ref="menuRef"
      class="media-menu"
      role="menu"
      aria-label="媒體選項"
    >
      <button
        type="button"
        class="media-menu__item"
        role="menuitem"
        :disabled="isRequestingSelfie || isRequestingVideo"
        @click="handleSelect('selfie')"
      >
        <CameraIcon class="media-menu__icon" aria-hidden="true" />
        <span>請求自拍照片</span>
      </button>

      <button
        type="button"
        class="media-menu__item"
        role="menuitem"
        :disabled="isRequestingSelfie || isRequestingVideo"
        @click="handleSelect('video')"
      >
        <VideoCameraIcon class="media-menu__icon" aria-hidden="true" />
        <span>生成影片</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';
import {
  EllipsisHorizontalIcon,
  CameraIcon,
  VideoCameraIcon,
} from '@heroicons/vue/24/outline';

/**
 * MediaMenu - 媒體選單組件
 * 職責：自拍照片和影片生成功能
 */

// Types
interface Props {
  isRequestingSelfie?: boolean;
  isRequestingVideo?: boolean;
  isSendingGift?: boolean;
}

interface Emits {
  (e: 'selfie-click'): void;
  (e: 'video-click'): void;
}

// Props
withDefaults(defineProps<Props>(), {
  isRequestingSelfie: false,
  isRequestingVideo: false,
  isSendingGift: false,
});

// Emits
const emit = defineEmits<Emits>();

// Refs
const buttonRef: Ref<HTMLElement | null> = ref(null);
const menuRef: Ref<HTMLElement | null> = ref(null);
const isMenuOpen: Ref<boolean> = ref(false);

/**
 * 切換選單
 */
const toggleMenu = (): void => {
  isMenuOpen.value = !isMenuOpen.value;
};

/**
 * 選擇媒體動作
 */
const handleSelect = (action: 'selfie' | 'video'): void => {
  if (action === 'selfie') {
    emit('selfie-click');
  } else if (action === 'video') {
    emit('video-click');
  }
  isMenuOpen.value = false;
};

/**
 * 點擊外部關閉選單
 */
const handleClickOutside = (event: MouseEvent): void => {
  if (
    isMenuOpen.value &&
    buttonRef.value &&
    menuRef.value &&
    !buttonRef.value.contains(event.target as Node) &&
    !menuRef.value.contains(event.target as Node)
  ) {
    isMenuOpen.value = false;
  }
};

// 生命週期
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.media-wrapper {
  position: relative;
}

.media-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  color: #ffffff;
  background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  border: none;
  border-radius: var(--radius-full, 50%);
  box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.media-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #f472b6 0%, #a78bfa 100%);
  box-shadow: 0 6px 20px rgba(236, 72, 153, 0.4);
  transform: scale(1.08);
}

.media-button:active:not(:disabled) {
  background: linear-gradient(135deg, #db2777 0%, #7c3aed 100%);
  box-shadow: 0 2px 10px rgba(236, 72, 153, 0.2);
  transform: scale(0.95);
}

.media-button.is-loading {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.media-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  transform: none !important;
  box-shadow: none;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.icon {
  width: 1.5rem;
  height: 1.5rem;
  transition: transform var(--transition-fast, 0.15s ease);
}

.media-button:hover:not(:disabled) .icon {
  transform: scale(1.1);
}

/* 選單樣式 */
.media-menu {
  position: absolute;
  bottom: calc(100% + var(--spacing-sm, 0.5rem));
  right: 0;
  z-index: 50;
  min-width: 12rem;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: var(--radius-lg, 0.75rem);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(139, 92, 246, 0.15);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: menu-appear 0.2s ease;
  overflow: hidden;
}

@keyframes menu-appear {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.media-menu__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 0.75rem);
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: #f8fafc;
  text-align: left;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.media-menu__item:last-child {
  border-bottom: none;
  border-bottom-left-radius: var(--radius-lg, 0.75rem);
  border-bottom-right-radius: var(--radius-lg, 0.75rem);
}

.media-menu__item:first-child {
  border-top-left-radius: var(--radius-lg, 0.75rem);
  border-top-right-radius: var(--radius-lg, 0.75rem);
}

.media-menu__item:hover:not(:disabled) {
  background-color: rgba(139, 92, 246, 0.15);
  color: #ffffff;
}

.media-menu__item:active:not(:disabled) {
  background-color: rgba(139, 92, 246, 0.25);
}

.media-menu__item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.media-menu__icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  transition: transform var(--transition-fast, 0.15s ease);
}

.media-menu__item:hover:not(:disabled) .media-menu__icon {
  transform: scale(1.1);
}

/* 響應式設計 */
@media (max-width: 540px) {
  .media-button {
    width: 2.5rem;
    height: 2.5rem;
  }

  .icon {
    width: 1.375rem;
    height: 1.375rem;
  }

  .media-menu {
    min-width: 11rem;
  }
}
</style>
