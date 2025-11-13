<script setup>
import { computed } from 'vue';

const props = defineProps({
  variant: {
    type: String,
    required: true,
    validator: (value) => ['ad', 'unlock', 'vip', 'disabled'].includes(value),
  },
  icon: {
    type: Object,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  info: {
    type: String,
    default: '',
  },
  benefits: {
    type: Array,
    default: () => [],
  },
  buttonText: {
    type: String,
    default: '',
  },
  buttonIcon: {
    type: Object,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['click']);

const cardClass = computed(() => {
  return `option-card option-card--${props.variant}`;
});

const handleClick = () => {
  if (!props.disabled && props.buttonText) {
    emit('click');
  }
};
</script>

<template>
  <div :class="cardClass">
    <div class="option-header">
      <component :is="icon" class="option-icon" aria-hidden="true" />
      <h3 class="option-title">{{ title }}</h3>
    </div>

    <p class="option-description">
      {{ description }}
    </p>

    <p v-if="info" class="option-info" v-html="info"></p>

    <ul v-if="benefits.length > 0" class="vip-benefits">
      <li v-for="(benefit, index) in benefits" :key="index">
        {{ benefit }}
      </li>
    </ul>

    <button
      v-if="buttonText"
      type="button"
      :class="`option-button option-button--${variant}`"
      :disabled="disabled"
      @click="handleClick"
    >
      <component v-if="buttonIcon" :is="buttonIcon" class="button-icon" aria-hidden="true" />
      {{ buttonText }}
    </button>
  </div>
</template>

<style scoped>
.option-card {
  padding: 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(30, 41, 59, 0.4);
  backdrop-filter: blur(10px);
  transition: all 200ms ease;
}

.option-card:hover:not(.option-card--disabled) {
  border-color: rgba(148, 163, 184, 0.35);
  background: rgba(30, 41, 59, 0.6);
  transform: translateY(-2px);
}

.option-card--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.option-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.option-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: #60a5fa;
}

.option-card--ad .option-icon {
  color: #f59e0b;
}

.option-card--unlock .option-icon {
  color: #a78bfa;
}

.option-card--vip .option-icon {
  color: #fbbf24;
}

.option-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #f8f9ff;
}

.option-description {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: rgba(226, 232, 240, 0.85);
}

.option-info {
  margin: 0 0 1rem;
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 10px;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.75);
}

.option-info strong {
  color: #60a5fa;
  font-weight: 600;
}

.vip-benefits {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.vip-benefits li {
  padding: 0.5rem 0;
  font-size: 0.9375rem;
  line-height: 1.4;
  color: rgba(226, 232, 240, 0.85);
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.vip-benefits li:last-child {
  border-bottom: none;
}

.option-button {
  width: 100%;
  padding: 0.875rem 1.25rem;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.button-icon {
  width: 20px;
  height: 20px;
}

.option-button--ad {
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: white;
}

.option-button--ad:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4);
}

.option-button--unlock-use {
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
  color: white;
}

.option-button--unlock-use:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
}

.option-button--unlock-buy {
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.5);
  color: #a78bfa;
}

.option-button--unlock-buy:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.25);
  border-color: rgba(139, 92, 246, 0.7);
}

.option-button--vip {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #1e293b;
}

.option-button--vip:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(251, 191, 36, 0.4);
}

.option-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
