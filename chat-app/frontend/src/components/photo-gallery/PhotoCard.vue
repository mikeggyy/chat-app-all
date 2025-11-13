<template>
  <div
    class="photo-card"
    :class="{
      'photo-card--selected': isSelected,
      'photo-card--video': photo.mediaType === 'video',
    }"
    @click="$emit('click', photo)"
  >
    <!-- 圖片 -->
    <LazyImage
      v-if="photo.imageUrl"
      :src="photo.imageUrl"
      :alt="`${alt}的照片`"
      root-margin="200px"
      image-class="photo-image"
    />
    <!-- 影片縮略圖（使用 video 標籤的第一幀） -->
    <video
      v-else-if="photo.videoUrl || photo.video?.url"
      :src="photo.videoUrl || photo.video?.url"
      class="photo-video"
      preload="metadata"
      muted
    />
    <!-- 影片播放圖標 -->
    <div v-if="photo.mediaType === 'video'" class="video-play-overlay">
      <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
      <span v-if="photo.video?.duration" class="video-duration">{{
        photo.video.duration
      }}</span>
    </div>
    <!-- 編輯模式：選擇框（預設照片不顯示） -->
    <div v-if="isEditMode && !photo.isDefault" class="photo-checkbox">
      <div
        class="checkbox-container"
        :class="{
          'checkbox-container--checked': isSelected,
        }"
        @click.stop="$emit('toggle-selection', photo.id)"
      >
        <div class="checkbox-inner">
          <svg
            v-if="isSelected"
            class="checkbox-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import LazyImage from '@/components/common/LazyImage.vue';

defineProps({
  photo: {
    type: Object,
    required: true,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  isEditMode: {
    type: Boolean,
    default: false,
  },
  alt: {
    type: String,
    default: '角色',
  },
});

defineEmits(['click', 'toggle-selection']);
</script>

<style scoped>
.photo-card {
  position: relative;
  aspect-ratio: 2/3;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.photo-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}

.photo-card--selected {
  outline: 3px solid #ff4d8f;
  outline-offset: -3px;
}

/* ✅ P1 優化（2025-01）：LazyImage 支援 */
.photo-card :deep(.lazy-image) {
  width: 100%;
  height: 100%;
}

.photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none; /* 防止點擊視頻元素時觸發播放 */
}

.video-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

.play-icon {
  width: 3rem;
  height: 3rem;
  color: #fff;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
}

.video-duration {
  position: absolute;
  bottom: 0.75rem;
  right: 0.75rem;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.photo-checkbox {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
}

.checkbox-container {
  width: 2rem;
  height: 2rem;
  cursor: pointer;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  border: 2px solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.checkbox-container:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.65);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.checkbox-container--checked {
  background: linear-gradient(135deg, #ff4d8f 0%, #ff1744 100%);
  border-color: #ff4d8f;
  box-shadow: 0 4px 12px rgba(255, 77, 143, 0.5);
}

.checkbox-container--checked:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(255, 77, 143, 0.6);
  background: linear-gradient(135deg, #ff6ba8 0%, #ff3d5c 100%);
}

.checkbox-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-icon {
  width: 1.1rem;
  height: 1.1rem;
  color: #ffffff;
  animation: checkmark-appear 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes checkmark-appear {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
