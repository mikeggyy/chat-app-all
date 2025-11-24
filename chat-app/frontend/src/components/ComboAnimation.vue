<script setup lang="ts">
import { ref, watch, computed } from "vue";

interface Props {
  show?: boolean;
  comboCount?: number;
  multiplier?: number;
  effect?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  comboCount: 0,
  multiplier: 1,
  effect: null,
});

const emit = defineEmits<{
  (e: "complete"): void;
}>();

const showAnimation = ref(false);

// 效果配置
const effectConfig = computed(() => {
  switch (props.effect) {
    case "legendary":
      return {
        emoji: "🌟",
        color: "#FF6B6B",
        glow: "0 0 30px #FF6B6B",
        text: "傳說連擊！",
        particles: 20,
      };
    case "ultimate":
      return {
        emoji: "💎",
        color: "#B9F2FF",
        glow: "0 0 25px #B9F2FF",
        text: "極限連擊！",
        particles: 16,
      };
    case "super":
      return {
        emoji: "🔥",
        color: "#FFD700",
        glow: "0 0 20px #FFD700",
        text: "超級連擊！",
        particles: 12,
      };
    case "large":
      return {
        emoji: "⚡",
        color: "#FFC107",
        glow: "0 0 15px #FFC107",
        text: "大連擊！",
        particles: 8,
      };
    case "medium":
      return {
        emoji: "✨",
        color: "#8B5CF6",
        glow: "0 0 12px #8B5CF6",
        text: "連擊！",
        particles: 6,
      };
    case "small":
      return {
        emoji: "💫",
        color: "#6366F1",
        glow: "0 0 10px #6366F1",
        text: "連擊",
        particles: 4,
      };
    default:
      return null;
  }
});

// 生成粒子
const particles = computed(() => {
  if (!effectConfig.value) return [];
  const count = effectConfig.value.particles;
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count;
    const velocity = 100 + Math.random() * 80;
    return {
      id: i,
      x: Math.cos(angle) * velocity,
      y: Math.sin(angle) * velocity - 50,
      delay: Math.random() * 0.1,
      scale: 0.6 + Math.random() * 0.4,
    };
  });
});

// 監聽 show 屬性
watch(
  () => props.show,
  (newValue) => {
    if (newValue && effectConfig.value) {
      showAnimation.value = true;

      // 動畫結束後隱藏
      setTimeout(() => {
        showAnimation.value = false;
        emit("complete");
      }, 1500);
    }
  }
);
</script>

<template>
  <Teleport to="body">
    <Transition name="combo-animation">
      <div
        v-if="showAnimation && effectConfig"
        class="combo-animation-container"
      >
        <!-- 中央連擊數字 -->
        <div class="combo-center" :style="{ '--glow': effectConfig.glow }">
          <div class="combo-emoji">{{ effectConfig.emoji }}</div>
          <div class="combo-count" :style="{ color: effectConfig.color }">
            {{ comboCount }}x
          </div>
          <div class="combo-text" :style="{ color: effectConfig.color }">
            {{ effectConfig.text }}
          </div>
          <div class="combo-multiplier">+{{ Math.round((multiplier - 1) * 100) }}%</div>
        </div>

        <!-- 粒子效果 -->
        <div
          v-for="particle in particles"
          :key="particle.id"
          class="combo-particle"
          :style="{
            '--x': `${particle.x}px`,
            '--y': `${particle.y}px`,
            '--delay': `${particle.delay}s`,
            '--scale': particle.scale,
          }"
        >
          {{ effectConfig.emoji }}
        </div>

        <!-- 光環效果 -->
        <div
          class="combo-ring"
          :style="{ borderColor: effectConfig.color }"
        ></div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.combo-animation-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.combo-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  animation: combo-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  filter: drop-shadow(var(--glow));
}

.combo-emoji {
  font-size: 3rem;
  animation: combo-bounce 0.6s ease-out;
}

.combo-count {
  font-size: 3rem;
  font-weight: 900;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.combo-text {
  font-size: 1.25rem;
  font-weight: 700;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.combo-multiplier {
  font-size: 1rem;
  font-weight: 600;
  color: #22C55E;
  background: rgba(34, 197, 94, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  margin-top: 0.25rem;
}

.combo-particle {
  position: absolute;
  font-size: 1.5rem;
  animation: particle-fly 1s ease-out var(--delay) both;
}

.combo-ring {
  position: absolute;
  width: 80px;
  height: 80px;
  border: 3px solid;
  border-radius: 50%;
  animation: ring-expand 1s ease-out;
  opacity: 0.6;
}

/* 動畫定義 */
@keyframes combo-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes combo-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-15px);
  }
  60% {
    transform: translateY(-5px);
  }
}

@keyframes particle-fly {
  0% {
    transform: translate(0, 0) scale(var(--scale));
    opacity: 1;
  }
  100% {
    transform: translate(var(--x), var(--y)) scale(0);
    opacity: 0;
  }
}

@keyframes ring-expand {
  0% {
    width: 80px;
    height: 80px;
    opacity: 0.8;
  }
  100% {
    width: 300px;
    height: 300px;
    opacity: 0;
  }
}

/* 過渡動畫 */
.combo-animation-enter-active {
  animation: fade-in 0.2s ease-out;
}

.combo-animation-leave-active {
  animation: fade-out 0.3s ease-out;
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
  .combo-emoji {
    font-size: 2.5rem;
  }
  .combo-count {
    font-size: 2.5rem;
  }
  .combo-text {
    font-size: 1rem;
  }
  .combo-particle {
    font-size: 1.25rem;
  }
}
</style>
