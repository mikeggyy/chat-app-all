<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from "vue";

interface Props {
  show?: boolean;
  previousLevel?: number;
  newLevel?: number;
  badgeName?: string | null;
  badgeColor?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  previousLevel: 1,
  newLevel: 2,
  badgeName: null,
  badgeColor: null,
});

const emit = defineEmits<{
  (e: "complete"): void;
}>();

const showAnimation = ref(false);

// ✅ 修復：追蹤定時器以便清理
let animationTimerId: ReturnType<typeof setTimeout> | null = null;

// 等級顏色
const levelColor = computed(() => {
  const level = props.newLevel;
  if (level >= 100) return "#FF6B6B";
  if (level >= 75) return "#B9F2FF";
  if (level >= 50) return "#FFD700";
  if (level >= 25) return "#C0C0C0";
  if (level >= 10) return "#CD7F32";
  return "#8B5CF6";
});

// 生成星星粒子
const stars = computed(() => {
  return Array.from({ length: 12 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 12;
    const velocity = 120 + Math.random() * 60;
    return {
      id: i,
      x: Math.cos(angle) * velocity,
      y: Math.sin(angle) * velocity - 80,
      delay: i * 0.05,
      rotation: Math.random() * 360,
    };
  });
});

// 監聯 show 屬性
watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      showAnimation.value = true;

      // ✅ 修復：清理之前的定時器
      if (animationTimerId !== null) {
        clearTimeout(animationTimerId);
      }

      // 動畫結束後隱藏
      animationTimerId = setTimeout(() => {
        showAnimation.value = false;
        emit("complete");
        animationTimerId = null;
      }, 2500);
    }
  }
);

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
    <Transition name="levelup-animation">
      <div v-if="showAnimation" class="levelup-animation-container">
        <!-- 背景光暈 -->
        <div class="levelup-glow" :style="{ background: `radial-gradient(circle, ${levelColor}40 0%, transparent 70%)` }"></div>

        <!-- 中央內容 -->
        <div class="levelup-center">
          <!-- 升級文字 -->
          <div class="levelup-title">LEVEL UP!</div>

          <!-- 等級數字 -->
          <div class="levelup-levels">
            <span class="old-level">Lv.{{ previousLevel }}</span>
            <span class="arrow">→</span>
            <span class="new-level" :style="{ color: levelColor }">
              Lv.{{ newLevel }}
            </span>
          </div>

          <!-- 徽章獎勵（如果有） -->
          <div
            v-if="badgeName"
            class="levelup-badge"
            :style="{ borderColor: badgeColor || levelColor, color: badgeColor || levelColor }"
          >
            <span class="badge-icon">🏆</span>
            <span class="badge-text">獲得稱號：{{ badgeName }}</span>
          </div>
        </div>

        <!-- 星星粒子 -->
        <div
          v-for="star in stars"
          :key="star.id"
          class="levelup-star"
          :style="{
            '--x': `${star.x}px`,
            '--y': `${star.y}px`,
            '--delay': `${star.delay}s`,
            '--rotation': `${star.rotation}deg`,
          }"
        >
          ⭐
        </div>

        <!-- 光圈 -->
        <div
          class="levelup-ring"
          :style="{ borderColor: levelColor }"
        ></div>
        <div
          class="levelup-ring ring-2"
          :style="{ borderColor: levelColor }"
        ></div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.levelup-animation-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.levelup-glow {
  position: absolute;
  width: 400px;
  height: 400px;
  animation: glow-pulse 1.5s ease-in-out infinite;
}

.levelup-center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  animation: center-pop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.levelup-title {
  font-size: 2.5rem;
  font-weight: 900;
  color: #FFD700;
  text-shadow:
    0 0 10px #FFD700,
    0 0 20px #FFD700,
    0 2px 4px rgba(0, 0, 0, 0.3);
  animation: title-shine 0.8s ease-out;
}

.levelup-levels {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.old-level {
  color: rgba(255, 255, 255, 0.6);
}

.arrow {
  color: white;
  animation: arrow-pulse 0.5s ease-out 0.3s both;
}

.new-level {
  font-size: 2rem;
  text-shadow: 0 2px 10px currentColor;
  animation: new-level-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.4s both;
}

.levelup-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 2px solid;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  animation: badge-slide 0.5s ease-out 0.8s both;
}

.badge-icon {
  font-size: 1.25rem;
}

.badge-text {
  font-size: 0.875rem;
  font-weight: 600;
}

.levelup-star {
  position: absolute;
  font-size: 1.5rem;
  animation: star-burst 1.2s ease-out var(--delay) both;
}

.levelup-ring {
  position: absolute;
  width: 100px;
  height: 100px;
  border: 3px solid;
  border-radius: 50%;
  opacity: 0.6;
  animation: ring-expand 1.5s ease-out;
}

.levelup-ring.ring-2 {
  animation-delay: 0.2s;
}

/* 動畫定義 */
@keyframes glow-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes center-pop {
  0% {
    transform: scale(0) rotate(-10deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.1) rotate(5deg);
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}

@keyframes title-shine {
  0% {
    opacity: 0;
    transform: translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes arrow-pulse {
  0% {
    opacity: 0;
    transform: translateX(-10px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes new-level-pop {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes badge-slide {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes star-burst {
  0% {
    transform: translate(0, 0) scale(1) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate(var(--x), var(--y)) scale(0) rotate(var(--rotation));
    opacity: 0;
  }
}

@keyframes ring-expand {
  0% {
    width: 100px;
    height: 100px;
    opacity: 0.8;
  }
  100% {
    width: 350px;
    height: 350px;
    opacity: 0;
  }
}

/* 過渡動畫 */
.levelup-animation-enter-active {
  animation: fade-in 0.3s ease-out;
}

.levelup-animation-leave-active {
  animation: fade-out 0.5s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* 響應式 */
@media (max-width: 640px) {
  .levelup-title {
    font-size: 2rem;
  }
  .levelup-levels {
    font-size: 1.25rem;
  }
  .new-level {
    font-size: 1.5rem;
  }
  .levelup-glow {
    width: 300px;
    height: 300px;
  }
}
</style>
