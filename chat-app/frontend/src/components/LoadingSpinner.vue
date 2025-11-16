<script setup lang="ts">
import { computed } from 'vue';

type SizeType = 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  size?: SizeType;
  color?: string;
  text?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'primary',
  text: '',
});

const sizeClasses = computed(() => {
  const sizes: Record<SizeType, string> = {
    sm: 'spinner--sm',
    md: 'spinner--md',
    lg: 'spinner--lg',
    xl: 'spinner--xl',
  };
  return sizes[props.size];
});
</script>

<template>
  <div class="loading-spinner">
    <div
      class="spinner"
      :class="sizeClasses"
      role="status"
      aria-label="載入中"
    >
      <svg class="spinner-svg" viewBox="0 0 50 50">
        <circle
          class="spinner-path"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke-width="4"
        />
      </svg>
    </div>
    <p v-if="text" class="spinner-text">{{ text }}</p>
  </div>
</template>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.spinner {
  display: inline-block;
  animation: spinner-rotate 1.4s linear infinite;
}

.spinner--sm {
  width: 24px;
  height: 24px;
}

.spinner--md {
  width: 40px;
  height: 40px;
}

.spinner--lg {
  width: 56px;
  height: 56px;
}

.spinner--xl {
  width: 72px;
  height: 72px;
}

.spinner-svg {
  width: 100%;
  height: 100%;
}

.spinner-path {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-dasharray: 1, 150;
  stroke-dashoffset: 0;
  animation: spinner-dash 1.4s ease-in-out infinite;
  color: #3b82f6;
}

.spinner-text {
  margin: 0;
  font-size: 0.9rem;
  letter-spacing: 0.02em;
  color: rgba(148, 163, 184, 0.9);
}

@keyframes spinner-rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes spinner-dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}
</style>
