<script setup lang="ts">
import { computed } from "vue";

interface Props {
  level: number;
  progress?: number;
  showProgress?: boolean;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  level: 1,
  progress: 0,
  showProgress: true,
  size: "md",
  showBadge: true,
});

// 等級徽章配置
const LEVEL_BADGES: Record<number, { name: string; color: string }> = {
  10: { name: "初心者", color: "#CD7F32" },
  25: { name: "支持者", color: "#C0C0C0" },
  50: { name: "忠實粉絲", color: "#FFD700" },
  75: { name: "超級粉絲", color: "#B9F2FF" },
  100: { name: "傳說粉絲", color: "#FF6B6B" },
};

// 獲取當前等級對應的徽章
const currentBadge = computed(() => {
  const milestones = Object.keys(LEVEL_BADGES)
    .map(Number)
    .sort((a, b) => b - a);

  for (const milestone of milestones) {
    if (props.level >= milestone) {
      return { milestone, ...LEVEL_BADGES[milestone] };
    }
  }
  return null;
});

// 等級顏色
const levelColors = computed(() => {
  if (props.level >= 100)
    return { bg: "linear-gradient(135deg, #FF6B6B, #FF8E53)", accent: "#FF6B6B" };
  if (props.level >= 75)
    return { bg: "linear-gradient(135deg, #B9F2FF, #89CFF0)", accent: "#89CFF0" };
  if (props.level >= 50)
    return { bg: "linear-gradient(135deg, #FFD700, #FFC107)", accent: "#FFD700" };
  if (props.level >= 25)
    return { bg: "linear-gradient(135deg, #C0C0C0, #A8A8A8)", accent: "#C0C0C0" };
  if (props.level >= 10)
    return { bg: "linear-gradient(135deg, #CD7F32, #B8860B)", accent: "#CD7F32" };
  return { bg: "linear-gradient(135deg, #8B5CF6, #6366F1)", accent: "#8B5CF6" };
});
</script>

<template>
  <div class="level-badge-wrapper" :class="size">
    <!-- 藥丸形狀徽章 -->
    <div class="level-pill" :style="{ background: levelColors.bg }">
      <span class="level-lv">LV</span>
      <span class="level-number">{{ level }}</span>

      <!-- 底部進度條 -->
      <div v-if="showProgress" class="progress-track">
        <div
          class="progress-fill"
          :style="{
            width: `${progress}%`,
            background: 'rgba(255, 255, 255, 0.9)',
          }"
        ></div>
      </div>
    </div>

    <!-- 徽章名稱 -->
    <div
      v-if="showBadge && currentBadge"
      class="badge-name"
      :style="{ color: currentBadge.color }"
    >
      {{ currentBadge.name }}
    </div>
  </div>
</template>

<style scoped>
.level-badge-wrapper {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.level-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.15em;
  padding: 0.25em 0.5em;
  border-radius: 999px;
  color: white;
  font-weight: 700;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.level-lv {
  font-size: 0.7em;
  font-weight: 600;
  opacity: 0.85;
  letter-spacing: 0.02em;
}

.level-number {
  font-size: 1em;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  letter-spacing: -0.02em;
}

/* 底部進度條 */
.progress-track {
  position: absolute;
  bottom: 2px;
  left: 4px;
  right: 4px;
  height: 4px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 2px;
}

.progress-fill {
  height: 100%;
  transition: width 0.4s ease;
  border-radius: 2px;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
}

.badge-name {
  font-size: 0.6rem;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 尺寸變體 */
.level-badge-wrapper.sm .level-pill {
  font-size: 0.75rem;
  padding: 0.2em 0.4em;
}

.level-badge-wrapper.sm .progress-track {
  height: 2px;
}

.level-badge-wrapper.sm .badge-name {
  font-size: 0.5rem;
}

.level-badge-wrapper.md .level-pill {
  font-size: 0.9rem;
}

.level-badge-wrapper.lg .level-pill {
  font-size: 1.1rem;
  padding: 0.3em 0.6em;
}

.level-badge-wrapper.lg .progress-track {
  height: 4px;
}

.level-badge-wrapper.lg .badge-name {
  font-size: 0.7rem;
}

/* Hover 效果 */
.level-pill:hover {
  transform: scale(1.05);
  transition: transform 0.2s ease;
}
</style>
