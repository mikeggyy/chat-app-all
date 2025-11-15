<template>
  <article
    class="chat-bubble"
    :class="[
      `chat-bubble--${message.role}`,
      { 'chat-bubble--pending': message.state === 'pending' },
      { 'chat-bubble--has-image': message.imageUrl },
    ]"
  >
    <!-- 語音播放按鈕（僅角色消息） -->
    <button
      v-if="message.role === 'partner'"
      type="button"
      class="chat-bubble__play"
      :class="{ 'is-playing': isPlaying }"
      aria-label="播放語音"
      @click="$emit('play-voice', message)"
    >
      <PlayIcon v-if="!isPlaying" class="icon" />
      <span v-else class="chat-bubble__audio-bars">
        <span class="audio-bar"></span>
        <span class="audio-bar"></span>
        <span class="audio-bar"></span>
      </span>
    </button>

    <!-- 圖片容器 -->
    <div v-if="message.imageUrl" class="chat-bubble__image-container">
      <!-- Loading 狀態 -->
      <div
        v-if="message.imageUrl === 'loading'"
        class="chat-bubble__image-loading"
      >
        <div class="loading-spinner"></div>
        <p class="loading-text">正在生成照片...</p>
      </div>

      <!-- 實際照片 -->
      <img
        v-else
        :src="message.imageUrl"
        :alt="message.text || '自拍照片'"
        class="chat-bubble__image"
        loading="lazy"
        @click="
          $emit('image-click', {
            url: message.imageUrl,
            alt: message.text || '自拍照片',
          })
        "
      />
    </div>

    <!-- 影片容器 -->
    <div v-if="message.video" class="chat-bubble__video-container">
      <!-- Loading 狀態 -->
      <div
        v-if="message.video === 'loading'"
        class="chat-bubble__video-loading"
      >
        <div class="loading-spinner"></div>
        <p class="loading-text">正在生成影片...</p>
      </div>

      <!-- 實際影片 -->
      <template v-else-if="message.video.url">
        <video
          :src="message.video.url"
          class="chat-bubble__video"
          controls
          preload="metadata"
          playsinline
        >
          您的瀏覽器不支持影片播放。
        </video>
        <div
          v-if="message.video.duration || message.video.resolution"
          class="chat-bubble__video-info"
        >
          <span v-if="message.video.duration" class="video-info-badge">{{
            message.video.duration
          }}</span>
          <span v-if="message.video.resolution" class="video-info-badge">{{
            message.video.resolution
          }}</span>
        </div>
      </template>
    </div>

    <!-- 文字內容 -->
    <!-- 打字動畫效果（當 pending 且角色回覆且內容為 '...' 時） -->
    <p
      v-if="
        message.text &&
        message.state === 'pending' &&
        message.role === 'partner' &&
        message.text === '...'
      "
      class="chat-bubble__typing-text"
      aria-hidden="true"
    >
      <span class="typing-dot-char">.</span>
      <span class="typing-dot-char">.</span>
      <span class="typing-dot-char">.</span>
    </p>
    <!-- 一般文字內容 -->
    <p v-else-if="message.text">{{ message.text }}</p>
  </article>
</template>

<script setup>
import { PlayIcon } from "@heroicons/vue/24/outline";

// Props
const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
  isPlaying: {
    type: Boolean,
    default: false,
  },
});

// Emits
const emit = defineEmits(["play-voice", "image-click"]);
</script>

<style scoped lang="scss">
.chat-bubble {
  max-width: 85%;
  padding: 0.85rem 1.1rem;
  border-radius: 22px;
  font-size: 0.98rem;
  line-height: 1.6;
  position: relative;
  color: #f8fafc;
  background: rgba(51, 65, 85, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.3);
  align-self: flex-start;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  &--partner {
    background: rgba(148, 163, 184, 0.2);
  }

  &--pending {
    border-style: dashed;
    opacity: 0.85;
  }

  &--user {
    background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
    color: #fff;
    border-color: rgba(255, 182, 193, 0.45);
    align-self: flex-end;
    box-shadow: 0 16px 32px rgba(255, 77, 143, 0.35);
  }

  &--has-image {
    max-width: 90%;

    p {
      margin-top: 0.5rem;
    }
  }

  p {
    margin: 0;
  }
}

/* 為包含影片的消息增加寬度 */
.chat-bubble:has(.chat-bubble__video-container) {
  max-width: 90%;
}

.chat-bubble__typing-text {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.typing-dot-char {
  display: inline-block;
  animation: typing-dot-fade 1.1s ease-in-out infinite;

  &:nth-child(2) {
    animation-delay: 0.18s;
  }

  &:nth-child(3) {
    animation-delay: 0.36s;
  }
}

@keyframes typing-dot-fade {
  0%,
  80%,
  100% {
    opacity: 0.2;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

.chat-bubble__play {
  position: absolute;
  top: -9px;
  left: -3px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(255, 77, 143, 0.9),
    rgba(255, 122, 184, 0.85)
  );
  border: none;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(255, 77, 143, 0.45);
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
  z-index: 10;

  &:hover {
    transform: scale(1.1);
    background: linear-gradient(
      135deg,
      rgba(255, 77, 143, 1),
      rgba(255, 122, 184, 0.95)
    );
    box-shadow: 0 6px 16px rgba(255, 77, 143, 0.6);
  }

  &:active {
    transform: scale(0.95);
  }

  .icon {
    width: 16px;
    height: 16px;
    position: relative;
    z-index: 2;
  }
}

.chat-bubble__audio-bars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 12px;
}

.audio-bar {
  width: 2px;
  height: 100%;
  background: #ffffff;
  border-radius: 2px;
  animation: audioBarJump 0.8s ease-in-out infinite;

  &:nth-child(1) {
    animation-delay: 0s;
  }

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes audioBarJump {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}

.chat-bubble__image-container {
  width: 100%;
  max-width: 280px;
  aspect-ratio: 2 / 3; /* 固定 2:3 比例 */
  border-radius: 16px;
  overflow: hidden;
  margin: 0.5rem 0;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
  position: relative;
}

.chat-bubble__image-loading {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(167, 139, 250, 0.2);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  margin: 0;
}

.chat-bubble__image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
  position: absolute;
  top: 0;
  left: 0;

  &:hover {
    transform: scale(1.02);
    opacity: 0.95;
  }

  &:active {
    transform: scale(0.98);
  }
}

/* 影片容器樣式 */
.chat-bubble__video-container {
  width: 100%;
  max-width: 320px;
  border-radius: 16px;
  overflow: hidden;
  margin: 0.5rem 0;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
  position: relative;
  aspect-ratio: 9 / 16; /* 垂直影片比例 */
}

.chat-bubble__video-loading {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.chat-bubble__video {
  width: 100%;
  display: block;
  background: #000;
  aspect-ratio: 9 / 16; /* 垂直影片比例 */
  object-fit: contain;
}

.chat-bubble__video-info {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  z-index: 10;
  pointer-events: none;
}

.video-info-badge {
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
  letter-spacing: 0.02em;
}
</style>
