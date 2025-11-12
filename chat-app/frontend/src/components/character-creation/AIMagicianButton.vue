<script setup>
import { computed } from "vue";
import { SparklesIcon } from "@heroicons/vue/24/solid";

const props = defineProps({
  isGenerating: {
    type: Boolean,
    default: false,
  },
  remainingUsage: {
    type: Number,
    required: true,
  },
  totalUsage: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(["click"]);

const isDisabled = computed(() => {
  return props.isGenerating || props.remainingUsage <= 0;
});

const isWarning = computed(() => {
  return props.remainingUsage <= 1;
});

const buttonText = computed(() => {
  return props.isGenerating ? "生成中..." : "AI魔法師";
});

const handleClick = () => {
  if (!isDisabled.value) {
    emit("click");
  }
};
</script>

<template>
  <div class="appearance__ai-magician-wrapper">
    <button
      type="button"
      class="appearance__ai-button"
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
</style>
