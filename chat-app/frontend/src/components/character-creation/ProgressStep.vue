<script setup lang="ts">
// Types
interface Props {
  progress: number;
  progressText: string;
  statusText: string;
  isComplete?: boolean;
  isGeneratingImages?: boolean;
  imageGenerationError?: string | null;
  generatingEmblem: string;
}

withDefaults(defineProps<Props>(), {
  isComplete: false,
  isGeneratingImages: false,
  imageGenerationError: null,
});
</script>

<template>
  <main class="generating__body">
    <section class="generating__glow" aria-live="polite">
      <div class="generating__emblem">
        <span class="generating__emblem-ring" aria-hidden="true"></span>
        <span class="generating__emblem-heart" aria-hidden="true">
          <img
            :src="generatingEmblem"
            alt=""
            class="generating__emblem-image"
            aria-hidden="true"
          />
        </span>
      </div>
      <p class="generating__progress-value">{{ progressText }}</p>
      <p class="generating__progress-status">
        <span class="generating__progress-status-text">{{ statusText }}</span>
        <span
          v-if="!isComplete"
          class="generating__progress-dots"
          aria-hidden="true"
        >
          <span
            v-for="index in 3"
            :key="index"
            class="generating__progress-dot"
            :class="`generating__progress-dot--${index}`"
          ></span>
        </span>
      </p>
      <div v-if="imageGenerationError" class="generating__error" role="alert">
        {{ imageGenerationError }}
      </div>
      <div
        v-if="isGeneratingImages && !isComplete"
        class="generating__warning"
        role="status"
        aria-live="polite"
      >
        ⚠️ 生成進行中，請勿刷新或關閉頁面
      </div>
    </section>

    <section class="generating__card-preview" aria-hidden="true">
      <div class="generating__card">
        <div class="generating__card-emblem">
          <img
            :src="generatingEmblem"
            alt=""
            class="generating__card-emblem-image"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.generating__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  flex: 1;
  max-height: calc(100dvh - 200px);
}

.generating__glow {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.generating__emblem {
  width: 176px;
  height: 176px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.generating__emblem-ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    rgba(255, 123, 189, 0.82) 0%,
    rgba(255, 50, 135, 0.6) 35%,
    rgba(0, 0, 0, 0) 80%
  );
  filter: blur(10px);
}

.generating__emblem-heart {
  width: 140px;
  height: 140px;
  border-radius: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.generating__emblem-heart::before,
.generating__emblem-heart::after {
  content: "";
  position: absolute;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle at 50% 50%, #ff9fd0 0%, #ff3b99 90%);
  border-radius: 50%;
  opacity: 0.72;
  filter: blur(18px);
}

.generating__emblem-heart::before {
  transform: translateX(-46px) translateY(-42px);
}

.generating__emblem-heart::after {
  transform: translateX(46px) translateY(-42px);
}

.generating__emblem-image {
  width: 12rem;
  object-fit: contain;
}

.generating__progress-value {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 0;
}

.generating__progress-status {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.03em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.generating__progress-status-text {
  display: inline-flex;
  align-items: center;
}

.generating__error {
  margin-top: 16px;
  padding: 12px 18px;
  border-radius: 12px;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
  font-size: 14px;
  letter-spacing: 0.04em;
  text-align: center;
}

.generating__warning {
  margin-top: 16px;
  padding: 12px 18px;
  border-radius: 12px;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: center;
}

.generating__progress-dots {
  display: inline-flex;
  align-items: flex-end;
  gap: 4px;
  height: 1em;
}

.generating__progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.68);
  opacity: 0.2;
  transform: translateY(0);
  animation: generatingDot 1.2s ease-in-out infinite;
}

.generating__progress-dot--2 {
  animation-delay: 0.2s;
}

.generating__progress-dot--3 {
  animation-delay: 0.4s;
}

@keyframes generatingDot {
  0%,
  80%,
  100% {
    opacity: 0.2;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

.generating__card-preview {
  display: flex;
  align-items: center;
  justify-content: center;
}

.generating__card {
  width: 116px;
  height: 168px;
  border-radius: 18px;
  background: linear-gradient(180deg, #621232 0%, #bd195f 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 12px 40px rgba(255, 35, 149, 0.35);
  animation: cardFlip 3s ease-in-out infinite;
  transform-style: preserve-3d;
}

@keyframes cardFlip {
  0% {
    transform: rotateY(0deg) scale(1);
  }
  50% {
    transform: rotateY(180deg) scale(1.05);
  }
  100% {
    transform: rotateY(360deg) scale(1);
  }
}

.generating__card-emblem {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(19, 0, 8, 0.92);
  animation: emblemFloat 2s ease-in-out infinite;
}

@keyframes emblemFloat {
  0%,
  100% {
    transform: translateY(0px) scale(1);
  }
  50% {
    transform: translateY(-8px) scale(1.1);
  }
}

.generating__card-emblem-image {
  width: 4rem;
  object-fit: contain;
}
</style>
