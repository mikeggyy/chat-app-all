<template>
  <Teleport to="body">
    <div
      v-if="isOpen && video"
      class="video-viewer-backdrop"
      @click.self="$emit('close')"
    >
      <div class="video-viewer-container">
        <button
          type="button"
          class="video-viewer-close"
          aria-label="關閉"
          @click="$emit('close')"
        >
          <XMarkIcon class="icon" />
        </button>
        <video
          ref="videoRef"
          :src="video.videoUrl || video.video?.url"
          class="video-viewer-player"
          controls
          autoplay
          playsinline
        >
          您的瀏覽器不支持影片播放。
        </video>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

// ✅ 修復：追蹤 video 元素以便清理
const videoRef = ref<HTMLVideoElement | null>(null);

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  video: {
    type: Object,
    default: null,
  },
});

defineEmits(['close']);

// ✅ 修復：暫停視頻的輔助函數
const pauseVideo = (): void => {
  if (videoRef.value) {
    videoRef.value.pause();
    videoRef.value.currentTime = 0;
  }
};

// ✅ 修復：當模態關閉時暫停視頻
watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      pauseVideo();
    }
  }
);

// ✅ 修復：組件卸載時暫停視頻
onBeforeUnmount(() => {
  pauseVideo();
});
</script>

<style scoped>
.video-viewer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.95);
  padding: 1rem;
}

.video-viewer-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.video-viewer-close {
  position: absolute;
  top: -3rem;
  right: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.video-viewer-close .icon {
  width: 1.5rem;
  height: 1.5rem;
}

.video-viewer-close:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.video-viewer-player {
  width: 100%;
  max-height: 80vh;
  border-radius: 16px;
  background: #000;
  object-fit: contain;
}

.video-viewer-info {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  align-items: center;
}

.info-badge {
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
  letter-spacing: 0.02em;
}
</style>
