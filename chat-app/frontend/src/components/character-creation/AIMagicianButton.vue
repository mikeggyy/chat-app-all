<script setup lang="ts">
import { computed, watch, type ComputedRef } from "vue";
import { SparklesIcon } from "@heroicons/vue/24/solid";
import { logger } from '../../utils/logger.js';

// Types
interface Props {
  isGenerating?: boolean;
  remainingUsage: number;
  totalUsage: number;
}

interface Emits {
  (e: "click"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isGenerating: false,
});

const emit = defineEmits<Emits>();

const isDisabled: ComputedRef<boolean> = computed(() => {
  return props.isGenerating || props.remainingUsage <= 0;
});

const isWarning: ComputedRef<boolean> = computed(() => {
  return props.remainingUsage <= 1;
});

const buttonText: ComputedRef<string> = computed(() => {
  return props.isGenerating ? "生成中..." : "AI魔法師";
});

const handleClick = (): void => {
  logger.log('[AIMagicianButton] 按鈕被點擊', {
    isDisabled: isDisabled.value,
    isGenerating: props.isGenerating,
    remainingUsage: props.remainingUsage
  });
  if (!isDisabled.value) {
    emit("click");
  }
};

// 🔥 調試：監聽 isGenerating 變化
watch(() => props.isGenerating, (newVal, oldVal) => {
  logger.log('[AIMagicianButton] isGenerating 變化:', {
    old: oldVal,
    new: newVal,
    buttonText: buttonText.value,
    isDisabled: isDisabled.value
  });
}, { immediate: true });
</script>

<template>
  <div class="appearance__ai-magician-wrapper">
    <button
      type="button"
      class="appearance__ai-button"
      :class="{
        'appearance__ai-button--loading': isGenerating,
      }"
      :disabled="isDisabled"
      @click="handleClick"
    >
      <SparklesIcon aria-hidden="true" />
      <span>{{ buttonText }}</span>
    </button>
    <div class="appearance__ai-usage" v-if="!isGenerating">
      <span
        :class="{
          'appearance__ai-usage--warning': isWarning,
        }"
      >
        剩餘 {{ remainingUsage }}/{{ totalUsage }} 次
      </span>
    </div>
  </div>
</template>

<style scoped>
.appearance__ai-magician-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.appearance__ai-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--gradient-primary);
  color: var(--color-white);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.appearance__ai-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.appearance__ai-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.appearance__ai-button svg {
  width: 16px;
  height: 16px;
  transition: transform 0.3s ease;
}

.appearance__ai-button--loading svg {
  animation: thinking 1.5s ease-in-out infinite;
}

@keyframes thinking {
  0% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-3px) rotate(90deg);
  }
  50% {
    transform: translateY(0) rotate(180deg);
  }
  75% {
    transform: translateY(3px) rotate(270deg);
  }
  100% {
    transform: translateY(0) rotate(360deg);
  }
}

.appearance__ai-usage {
  font-size: 12px;
  color: var(--text-tertiary);
  letter-spacing: 0.04em;
}

.appearance__ai-usage--warning {
  color: var(--color-warning);
  font-weight: 600;
}

/* 確保按鈕文字為白色 */
button {
  color: var(--color-white) !important;
}

button span {
  color: var(--color-white) !important;
}
</style>
