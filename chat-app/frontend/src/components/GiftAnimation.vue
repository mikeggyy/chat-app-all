<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";

interface Props {
  show?: boolean;
  giftEmoji?: string;
  giftName?: string;
}

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  delay: number;
  duration: number;
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  giftEmoji: "🎁",
  giftName: "禮物",
});

const particles = ref<Particle[]>([]);
const showAnimation = ref<boolean>(false);

// ✅ 修復：追蹤定時器以便清理
let animationTimerId: ReturnType<typeof setTimeout> | null = null;

// 生成隨機粒子
const generateParticles = (): void => {
  const particleCount = 15;
  const newParticles: Particle[] = [];

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
    const velocity = 200 + Math.random() * 150;
    const scale = 0.8 + Math.random() * 0.6;
    const rotation = Math.random() * 360;
    const delay = Math.random() * 0.1;

    newParticles.push({
      id: i,
      emoji: props.giftEmoji,
      x: Math.cos(angle) * velocity,
      y: Math.sin(angle) * velocity - 100, // 向上偏移
      scale,
      rotation,
      delay,
      duration: 1.2 + Math.random() * 0.4,
    });
  }

  // 添加心形和星星裝飾
  const decorations = ["❤️", "✨", "💖", "⭐", "💫"];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const velocity = 150 + Math.random() * 100;

    newParticles.push({
      id: particleCount + i,
      emoji: decorations[Math.floor(Math.random() * decorations.length)],
      x: Math.cos(angle) * velocity,
      y: Math.sin(angle) * velocity - 80,
      scale: 0.6 + Math.random() * 0.4,
      rotation: Math.random() * 360,
      delay: 0.05 + Math.random() * 0.15,
      duration: 1.4 + Math.random() * 0.3,
    });
  }

  particles.value = newParticles;
};

// 監聽 show 屬性
watch(() => props.show, (newValue: boolean) => {
  if (newValue) {
    showAnimation.value = true;
    generateParticles();

    // ✅ 修復：清理之前的定時器（如果有）
    if (animationTimerId !== null) {
      clearTimeout(animationTimerId);
    }

    // 動畫結束後自動隱藏
    animationTimerId = setTimeout(() => {
      showAnimation.value = false;
      particles.value = [];
      animationTimerId = null;
    }, 2000);
  }
});

// ✅ 修復：組件卸載時清理定時器
onBeforeUnmount(() => {
  if (animationTimerId !== null) {
    clearTimeout(animationTimerId);
    animationTimerId = null;
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="gift-animation">
      <div v-if="showAnimation" class="gift-animation-container">
        <!-- 中央大禮物 -->
        <div class="gift-center">
          <div class="gift-emoji-large">{{ giftEmoji }}</div>
        </div>

        <!-- 粒子效果 -->
        <div
          v-for="particle in particles"
          :key="particle.id"
          class="gift-particle"
          :style="{
            '--x': `${particle.x}px`,
            '--y': `${particle.y}px`,
            '--scale': particle.scale,
            '--rotation': `${particle.rotation}deg`,
            '--delay': `${particle.delay}s`,
            '--duration': `${particle.duration}s`,
          }"
        >
          {{ particle.emoji }}
        </div>

        <!-- 閃光效果 -->
        <div class="gift-flash"></div>

        <!-- 圓形波紋效果 -->
        <div class="gift-ripple"></div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gift-animation-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 中央大禮物 */
.gift-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  animation: gift-pop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.gift-emoji-large {
  font-size: 6rem;
  animation: gift-bounce 0.8s ease-out;
}

/* 粒子動畫 */
.gift-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  font-size: 2.5rem;
  animation: particle-burst var(--duration) ease-out var(--delay) both;
  transform-origin: center;
}

/* 閃光效果 */
.gift-flash {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 70%);
  border-radius: 50%;
  animation: flash-fade 0.6s ease-out;
}

/* 波紋效果 */
.gift-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100px;
  height: 100px;
  transform: translate(-50%, -50%);
  border: 3px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  animation: ripple-expand 1.2s ease-out;
}

/* 動畫定義 */
@keyframes gift-pop {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

@keyframes gift-bounce {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-20px) rotate(-10deg);
  }
  50% {
    transform: translateY(0) rotate(0deg);
  }
  75% {
    transform: translateY(-10px) rotate(10deg);
  }
}

@keyframes particle-burst {
  0% {
    transform: translate(0, 0) scale(var(--scale)) rotate(0deg);
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--x), var(--y)) scale(0) rotate(var(--rotation));
    opacity: 0;
  }
}

@keyframes flash-fade {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2);
  }
}

@keyframes ripple-expand {
  0% {
    width: 100px;
    height: 100px;
    opacity: 0.8;
  }
  100% {
    width: 400px;
    height: 400px;
    opacity: 0;
  }
}

/* 整體動畫過渡 */
.gift-animation-enter-active {
  animation: fade-in 0.3s ease-out;
}

.gift-animation-leave-active {
  animation: fade-out 0.5s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* 響應式調整 */
@media (max-width: 640px) {
  .gift-emoji-large {
    font-size: 4rem;
  }

  .gift-particle {
    font-size: 2rem;
  }
}
</style>
