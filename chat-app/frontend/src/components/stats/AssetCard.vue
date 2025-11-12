<template>
  <div
    class="stat-card"
    :class="{
      'stat-card--limited': hasLimit,
    }"
  >
    <div class="stat-card__header">
      <div
        class="stat-card__icon-wrapper"
        :class="`stat-card__icon-wrapper--${iconColor}`"
      >
        <component :is="icon" class="stat-card__icon" aria-hidden="true" />
      </div>
      <span class="stat-card__label">{{ name }}</span>
    </div>
    <div class="stat-card__value">{{ count }} {{ unit }}</div>

    <!-- 達到上限時顯示按鈕 -->
    <div v-if="hasLimit" class="stat-card__action">
      <span class="stat-card__limit-text">{{ limitText }}</span>
      <button
        v-if="count > 0"
        type="button"
        class="stat-card__button stat-card__button--use"
        @click="$emit('use', cardType)"
      >
        使用{{ buttonLabel }}
      </button>
      <button
        v-else
        type="button"
        class="stat-card__button stat-card__button--buy"
        @click="$emit('buy', cardType)"
      >
        <ShoppingCartIcon class="button-icon" aria-hidden="true" />
        購買{{ buttonLabel }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ShoppingCartIcon } from '@heroicons/vue/24/outline';

defineProps({
  cardType: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  icon: {
    type: Object,
    required: true,
  },
  iconColor: {
    type: String,
    default: 'gray',
  },
  count: {
    type: Number,
    default: 0,
  },
  unit: {
    type: String,
    default: '張',
  },
  hasLimit: {
    type: Boolean,
    default: false,
  },
  limitText: {
    type: String,
    default: '',
  },
  buttonLabel: {
    type: String,
    default: '解鎖卡',
  },
});

defineEmits(['use', 'buy']);
</script>

<style scoped>
.stat-card {
  padding: 1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.15);
  transition: background 200ms ease, border-color 200ms ease;
}

.stat-card--limited {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.3);
}

.stat-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.stat-card__icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__icon-wrapper--gray {
  background: rgba(148, 163, 184, 0.2);
}

.stat-card__icon-wrapper--blue {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.stat-card__icon-wrapper--purple {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
}

.stat-card__icon-wrapper--pink {
  background: linear-gradient(135deg, #ec4899, #db2777);
}

.stat-card__icon-wrapper--green {
  background: linear-gradient(135deg, #10b981, #059669);
}

.stat-card__icon-wrapper--red {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.stat-card__icon-wrapper--orange {
  background: linear-gradient(135deg, #f97316, #ea580c);
}

.stat-card__icon {
  width: 18px;
  height: 18px;
  color: #ffffff;
}

.stat-card__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(226, 232, 240, 0.85);
}

.stat-card__value {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #e2e8f0;
}

.stat-card__action {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
}

.stat-card__limit-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: #ef4444;
  text-align: center;
}

.stat-card__button {
  padding: 0.5rem 0.85rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.stat-card__button:active {
  transform: scale(0.96);
}

.stat-card__button--use {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
}

.stat-card__button--buy {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
}

.button-icon {
  width: 16px;
  height: 16px;
}
</style>
