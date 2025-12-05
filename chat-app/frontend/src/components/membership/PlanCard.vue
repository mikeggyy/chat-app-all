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

    <!-- 訂閱週期選擇 -->
    <div class="plan-card__cycle-selector">
      <button
        v-for="cycle in cycles"
        :key="cycle.id"
        type="button"
        class="plan-card__cycle-btn"
        :class="{ 'plan-card__cycle-btn--active': selectedCycle === cycle.id }"
        @click="selectedCycle = cycle.id as 'monthly' | 'quarterly' | 'yearly'"
      >
        <span class="plan-card__cycle-name">{{ cycle.name }}</span>
        <span v-if="cycle.discount > 0" class="plan-card__cycle-discount">
          省 {{ cycle.discount }}%
        </span>
      </button>
    </div>

    <!-- 年訂閱優惠標籤 -->
    <div v-if="selectedCycle === 'yearly'" class="plan-card__yearly-bonus">
      <div class="plan-card__yearly-bonus-item">
        <span class="plan-card__yearly-bonus-icon">🎁</span>
        <span>註冊即送 {{ yearlyBonusCoins }} 金幣</span>
      </div>
      <div class="plan-card__yearly-bonus-item">
        <span class="plan-card__yearly-bonus-icon">📅</span>
        <span>每月額外送 {{ monthlyBonusCoins }} 金幣</span>
      </div>
      <div class="plan-card__yearly-bonus-item">
        <span class="plan-card__yearly-bonus-icon">🔄</span>
        <span>續約享 {{ renewalDiscount }}% 折扣</span>
      </div>
    </div>

    <div class="plan-card__pricing">
      <div class="plan-card__price-wrapper">
        <div class="plan-card__price-row">
          <span class="plan-card__price">NT$ {{ currentPrice }}</span>
          <span class="plan-card__price-period">/ {{ currentPeriod }}</span>
        </div>
        <div v-if="selectedCycle !== 'monthly'" class="plan-card__price-monthly">
          約 NT$ {{ monthlyEquivalent }}/月
        </div>
      </div>
      <button
        type="button"
        class="plan-card__cta"
        :class="{ 'plan-card__cta--loading': isUpgrading }"
        :disabled="isUpgrading"
        :aria-label="`升級為 ${tier.label}`"
        @click="handleUpgrade"
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

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ArrowRightIcon } from '@heroicons/vue/24/solid';
import LoadingSpinner from '../LoadingSpinner.vue';

/**
 * PlanCard - 會員方案卡片組件
 * 職責：顯示單一會員方案的詳細信息和升級按鈕
 *
 * ✅ 2025-12-03 更新：支援訂閱週期選擇和年訂閱優惠顯示
 * ✅ 2025-12-03 更新：支援 API 和靜態配置的混合類型
 */

// 支援 API 和靜態配置的混合類型
interface TierData {
  id: string;
  label: string;
  headline: string;
  description: string;
  highlight: string;
  highlightColor: string;
  prices: {
    monthly: { price: number; discountPercent: number };
    quarterly: { price: number; discountPercent: number; monthlyEquivalent: number };
    yearly: { price: number; discountPercent: number; monthlyEquivalent: number };
  };
  [key: string]: any; // 允許其他屬性
}

interface Props {
  tier: TierData;
  isUpgrading?: boolean;
}

interface Emits {
  (e: 'upgrade', tier: TierData, cycle: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  isUpgrading: false,
});

const emit = defineEmits<Emits>();

// 訂閱週期選項
const cycles = computed(() => [
  { id: 'monthly', name: '月繳', discount: 0 },
  { id: 'quarterly', name: '季繳', discount: props.tier.prices.quarterly.discountPercent },
  { id: 'yearly', name: '年繳', discount: props.tier.prices.yearly.discountPercent },
]);

const selectedCycle = ref<'monthly' | 'quarterly' | 'yearly'>('monthly');

// 當前價格
const currentPrice = computed(() => {
  return props.tier.prices[selectedCycle.value].price;
});

// 當前週期文字
const currentPeriod = computed(() => {
  const periodMap = { monthly: '月', quarterly: '季', yearly: '年' };
  return periodMap[selectedCycle.value];
});

// 月均價
const monthlyEquivalent = computed(() => {
  return props.tier.prices[selectedCycle.value].monthlyEquivalent;
});

// 年訂閱獎勵配置（根據會員等級）
const yearlyBonusCoins = computed(() => {
  const bonusMap: Record<string, number> = { lite: 50, vip: 150, vvip: 300 };
  return bonusMap[props.tier.id] || 0;
});

const monthlyBonusCoins = computed(() => {
  const bonusMap: Record<string, number> = { lite: 10, vip: 30, vvip: 50 };
  return bonusMap[props.tier.id] || 0;
});

const renewalDiscount = computed(() => {
  const discountMap: Record<string, number> = { lite: 5, vip: 10, vvip: 15 };
  return discountMap[props.tier.id] || 0;
});

function handleUpgrade() {
  emit('upgrade', props.tier, selectedCycle.value);
}
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
  /* ✅ 2025-12-03 修復：移除固定高度，改用 min-height */
  min-height: 20rem;
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

/* ✅ 2025-11-30 新增：Lite 方案樣式 */
.plan-card--lite::before {
  background: radial-gradient(
    circle at 20% 20%,
    rgba(16, 185, 129, 0.12),
    transparent 50%
  );
}

.plan-card--lite {
  border-color: rgba(16, 185, 129, 0.3);
}

.plan-card--lite .plan-card__price {
  background: linear-gradient(135deg, #10b981, #14b8a6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  flex-direction: column;
  gap: 0.25rem;
}

.plan-card__price-row {
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

.plan-card__price-monthly {
  font-size: 0.75rem;
  color: rgba(207, 217, 255, 0.6);
}

/* 訂閱週期選擇器 */
.plan-card__cycle-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.plan-card__cycle-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0.25rem;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(30, 40, 80, 0.5);
  color: rgba(207, 217, 255, 0.8);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.plan-card__cycle-btn:hover {
  border-color: rgba(99, 179, 237, 0.5);
  background: rgba(30, 40, 80, 0.7);
}

.plan-card__cycle-btn--active {
  border-color: rgba(99, 179, 237, 0.8);
  background: rgba(59, 130, 246, 0.2);
  color: white;
}

.plan-card__cycle-name {
  font-weight: 600;
}

.plan-card__cycle-discount {
  font-size: 0.65rem;
  color: #10b981;
  background: rgba(16, 185, 129, 0.2);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  margin-top: 0.2rem;
}

/* 年訂閱優惠標籤 */
.plan-card__yearly-bonus {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 12px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.plan-card__yearly-bonus-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgba(251, 191, 36, 0.95);
  margin-bottom: 0.35rem;
}

.plan-card__yearly-bonus-item:last-child {
  margin-bottom: 0;
}

.plan-card__yearly-bonus-icon {
  font-size: 0.85rem;
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

/* 響應式設計 - 手機版 */
@media (max-width: 640px) {
  .plan-card {
    min-height: auto;
    padding: 1.25rem;
  }

  .plan-card__headline {
    font-size: 1.25rem;
  }

  .plan-card__description {
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .plan-card__cycle-selector {
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .plan-card__cycle-btn {
    padding: 0.4rem 0.2rem;
    font-size: 0.75rem;
  }

  .plan-card__cycle-discount {
    font-size: 0.6rem;
    padding: 0.1rem 0.3rem;
  }

  .plan-card__yearly-bonus {
    padding: 0.625rem;
    margin-bottom: 0.75rem;
  }

  .plan-card__yearly-bonus-item {
    font-size: 0.7rem;
    gap: 0.375rem;
    margin-bottom: 0.25rem;
  }

  .plan-card__yearly-bonus-icon {
    font-size: 0.75rem;
  }

  .plan-card__pricing {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding-top: 0.75rem;
  }

  .plan-card__price {
    font-size: 1.5rem;
  }

  .plan-card__cta {
    width: 100%;
    justify-content: center;
    padding: 0.625rem 1rem;
  }
}

/* 響應式設計 - 桌機版（三欄並排時） */
@media (min-width: 1024px) {
  .plan-card {
    min-height: 24rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
  }

  .plan-card__description {
    margin-bottom: 1rem;
    flex: 1;
    font-size: 0.875rem;
  }

  .plan-card__headline {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .plan-card__badge {
    padding: 0.3rem 0.75rem;
    font-size: 0.7rem;
    margin-bottom: 0.75rem;
  }

  .plan-card__cycle-selector {
    margin-bottom: 0.75rem;
  }

  .plan-card__cycle-btn {
    padding: 0.4rem 0.2rem;
    font-size: 0.75rem;
  }

  .plan-card__yearly-bonus {
    padding: 0.625rem;
    margin-bottom: 0.75rem;
  }

  .plan-card__yearly-bonus-item {
    font-size: 0.7rem;
    margin-bottom: 0.25rem;
  }

  .plan-card__yearly-bonus-icon {
    font-size: 0.75rem;
  }

  .plan-card__pricing {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    margin-top: auto;
  }

  .plan-card__price {
    font-size: 1.5rem;
  }

  .plan-card__price-period {
    font-size: 0.8rem;
  }

  .plan-card__cta {
    width: 100%;
    justify-content: center;
    padding: 0.625rem 1rem;
    font-size: 0.85rem;
  }
}
</style>
