<template>
  <div class="media-wrapper">
    <!-- 媒體按鈕 -->
    <button
      ref="buttonRef"
      type="button"
      class="media-button"
      :class="{ 'is-loading': isRequestingSelfie || isRequestingVideo }"
      :disabled="isRequestingSelfie || isSendingGift || isRequestingVideo"
      :aria-expanded="isMenuOpen ? 'true' : 'false'"
      aria-haspopup="menu"
      :aria-label="
        photoRemaining !== null && photoRemaining > 0
          ? `媒體功能 (剩餘 ${photoRemaining} 次)`
          : '媒體功能'
      "
      @click="toggleMenu"
    >
      <EllipsisHorizontalIcon class="icon" aria-hidden="true" />

      <!-- 剩餘次數 Badge -->
      <span
        v-if="photoRemaining !== null && photoRemaining > 0"
        class="media-button__badge"
        aria-hidden="true"
      >
        {{ photoRemaining }}
      </span>
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

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import {
  EllipsisHorizontalIcon,
  CameraIcon,
  VideoCameraIcon,
} from '@heroicons/vue/24/outline';

/**
 * MediaMenu - 媒體選單組件
 * 職責：自拍照片和影片生成功能
 */

// Props
defineProps({
  photoRemaining: {
    type: Number,
    default: null,
  },
  isRequestingSelfie: {
    type: Boolean,
    default: false,
  },
  isRequestingVideo: {
    type: Boolean,
    default: false,
  },
  isSendingGift: {
    type: Boolean,
    default: false,
  },
});

// Emits
const emit = defineEmits(['selfie-click', 'video-click']);

// Refs
const buttonRef = ref(null);
const menuRef = ref(null);
const isMenuOpen = ref(false);

/**
 * 切換選單
 */
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

/**
 * 選擇媒體動作
 */
const handleSelect = (action) => {
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
const handleClickOutside = (event) => {
  if (
    isMenuOpen.value &&
    buttonRef.value &&
    menuRef.value &&
    !buttonRef.value.contains(event.target) &&
    !menuRef.value.contains(event.target)
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
  color: var(--text-secondary, #6b7280);
  background-color: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.media-button:hover:not(:disabled) {
  color: var(--primary-color, #8b5cf6);
  background-color: var(--primary-light, rgba(139, 92, 246, 0.1));
}

.media-button.is-loading {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.media-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
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
}

/* Badge */
.media-button__badge {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: #ffffff;
  background-color: var(--primary-color, #8b5cf6);
  border: 2px solid var(--bg-primary, #ffffff);
  border-radius: 9999px;
}

/* 選單樣式 */
.media-menu {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  right: 0;
  z-index: 50;
  min-width: 12rem;
  background-color: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.75rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.media-menu__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: var(--text-primary, #1a1a1a);
  text-align: left;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.media-menu__item:last-child {
  border-bottom: none;
}

.media-menu__item:hover:not(:disabled) {
  background-color: var(--bg-hover, #f9fafb);
}

.media-menu__item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.media-menu__icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
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

  .media-button__badge {
    min-width: 1.125rem;
    height: 1.125rem;
    font-size: 0.5625rem;
  }

  .media-menu {
    min-width: 11rem;
  }
}
</style>
