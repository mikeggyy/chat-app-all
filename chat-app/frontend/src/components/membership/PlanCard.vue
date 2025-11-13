<template>
  <div class="plan-card" :class="`plan-card--${tier.id}`">
    <div
      class="plan-card__badge"
      :class="`bg-gradient-to-r ${tier.highlightColor}`"
    >
      {{ tier.highlight }}
    </div>
    <h2 class="plan-card__headline">{{ tier.headline }}</h2>
    <p class="plan-card__description">
      {{ tier.description }}
    </p>

    <div class="plan-card__pricing">
      <div class="plan-card__price-wrapper">
        <span class="plan-card__price">{{ tier.priceTag }}</span>
        <span class="plan-card__price-period">{{ tier.pricePeriod }}</span>
      </div>
      <button
        type="button"
        class="plan-card__cta"
        :class="{ 'plan-card__cta--loading': isUpgrading }"
        :disabled="isUpgrading"
        :aria-label="`升級為 ${tier.label}`"
        @click="$emit('upgrade', tier)"
      >
        <LoadingSpinner v-if="isUpgrading" size="sm" />
        <template v-else>
          立即升級
          <ArrowRightIcon class="plan-card__cta-icon" aria-hidden="true" />
        </template>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ArrowRightIcon } from '@heroicons/vue/24/solid';
import LoadingSpinner from '../LoadingSpinner.vue';

/**
 * PlanCard - 會員方案卡片組件
 * 職責：顯示單一會員方案的詳細信息和升級按鈕
 */

// Props
defineProps({
  tier: {
    type: Object,
    required: true,
  },
  isUpgrading: {
    type: Boolean,
    default: false,
  },
});

// Emits
defineEmits(['upgrade']);
</script>

<style scoped>
.plan-card {
  padding: 1.5rem;
  border-radius: 24px;
  background: linear-gradient(
    135deg,
    rgba(30, 40, 80, 0.9),
    rgba(20, 25, 50, 0.95)
  );
  border: 1px solid rgba(99, 179, 237, 0.3);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  position: relative;
  height: 22rem;
}

.plan-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    circle at 20% 20%,
    rgba(59, 130, 246, 0.1),
    transparent 50%
  );
  pointer-events: none;
}

.plan-card--vvip::before {
  background: radial-gradient(
    circle at 20% 20%,
    rgba(251, 191, 36, 0.15),
    transparent 50%
  );
}

.plan-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: white;
  margin-bottom: 1rem;
  text-transform: uppercase;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.plan-card__headline {
  margin: 0 0 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.plan-card__description {
  margin: 0 0 1.5rem;
  color: rgba(207, 217, 255, 0.85);
  line-height: 1.6;
  font-size: 0.95rem;
}

.plan-card__pricing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.plan-card__price-wrapper {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.plan-card__price {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.plan-card__price-period {
  font-size: 0.9rem;
  color: rgba(207, 217, 255, 0.7);
}

.plan-card__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
  transition: all 0.2s ease;
  letter-spacing: 0.05em;
}

.plan-card__cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 35px rgba(99, 102, 241, 0.5);
}

.plan-card__cta:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.plan-card__cta-icon {
  width: 18px;
  height: 18px;
}

/* 響應式設計 */
@media (max-width: 640px) {
  .plan-card__pricing {
    flex-direction: column;
    align-items: stretch;
  }

  .plan-card__cta {
    width: 100%;
    justify-content: center;
  }
}
</style>
