<script setup lang="ts">
/**
 * UpgradeConfirmModal - 升級確認彈窗
 * ✅ 2025-11-30 新增：顯示補差價計算明細
 * ✅ 2025-12-03 更新：支援訂閱週期顯示和年訂閱優惠
 *
 * 功能：
 * - 顯示升級前後的會員等級
 * - 計算並顯示補差價明細
 * - 顯示訂閱週期（月/季/年）
 * - 顯示年訂閱專屬優惠
 * - 讓用戶確認後才執行升級
 */

import { ref, computed, watch } from 'vue';
import { XMarkIcon, SparklesIcon, CheckCircleIcon, GiftIcon } from '@heroicons/vue/24/outline';
import LoadingSpinner from '../LoadingSpinner.vue';
import { useMembership, type UpgradePriceInfo } from '../../composables/useMembership';
import type { MembershipTier as TierConfig } from '../../config/membership';
import type { MembershipTier } from '../../types';

interface Props {
  isOpen: boolean;
  tier: TierConfig | null;
  userId: string;
  billingCycle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  billingCycle: 'monthly',
});

const emit = defineEmits<{
  'close': [];
  'confirm': [tier: TierConfig];
}>();

const { getUpgradePricePreview, currentTier } = useMembership();

// 訂閱週期文字映射
const cycleLabels: Record<string, string> = {
  monthly: '月訂閱',
  quarterly: '季訂閱',
  yearly: '年訂閱',
};

// 年訂閱獎勵配置（根據會員等級）
const yearlyBonusConfig: Record<string, { signup: number; monthly: number; renewal: number }> = {
  lite: { signup: 50, monthly: 10, renewal: 5 },
  vip: { signup: 150, monthly: 30, renewal: 10 },
  vvip: { signup: 300, monthly: 50, renewal: 15 },
};

// 當前選中的週期標籤
const cycleLabel = computed(() => cycleLabels[props.billingCycle] || '月訂閱');

// 是否為年訂閱
const isYearly = computed(() => props.billingCycle === 'yearly');

// 年訂閱獎勵
const yearlyBonus = computed(() => {
  if (!props.tier) return null;
  return yearlyBonusConfig[props.tier.id] || null;
});

const isLoading = ref(false);
const priceInfo = ref<UpgradePriceInfo | null>(null);
const error = ref<string | null>(null);

// 載入價格預覽
const loadPricePreview = async () => {
  if (!props.tier || !props.userId) return;

  isLoading.value = true;
  error.value = null;

  try {
    priceInfo.value = await getUpgradePricePreview(
      props.userId,
      props.tier.id as MembershipTier
    );
  } catch (err: any) {
    error.value = err?.message || '無法取得價格資訊';
    priceInfo.value = null;
  } finally {
    isLoading.value = false;
  }
};

// 當彈窗開啟時載入價格
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.tier) {
    loadPricePreview();
  } else {
    priceInfo.value = null;
    error.value = null;
  }
}, { immediate: true });

// 是否為新訂閱（免費用戶）
const isNewSubscription = computed(() => {
  return currentTier.value === 'free';
});

// 是否有節省金額
const hasSavings = computed(() => {
  return priceInfo.value && priceInfo.value.savings > 0;
});

const handleConfirm = () => {
  if (props.tier) {
    emit('confirm', props.tier);
  }
};

const handleClose = () => {
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen && tier"
        class="modal-overlay"
        @click.self="handleClose"
      >
        <div class="modal-container" role="dialog" aria-modal="true">
          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header__icon">
              <SparklesIcon class="w-6 h-6" />
            </div>
            <h2 class="modal-header__title">確認升級</h2>
            <span class="modal-header__cycle">{{ cycleLabel }}</span>
            <button
              type="button"
              class="modal-close"
              @click="handleClose"
              aria-label="關閉"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="modal-content">
            <!-- Loading State -->
            <div v-if="isLoading" class="modal-loading">
              <LoadingSpinner size="lg" />
              <p>計算升級費用中...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="modal-error">
              <p>{{ error }}</p>
              <button type="button" class="retry-btn" @click="loadPricePreview">
                重試
              </button>
            </div>

            <!-- Price Info -->
            <template v-else-if="priceInfo">
              <!-- 升級路徑 -->
              <div class="upgrade-path">
                <div class="upgrade-path__from">
                  <span class="tier-label">{{ priceInfo.currentTierName }}</span>
                </div>
                <div class="upgrade-path__arrow">→</div>
                <div class="upgrade-path__to">
                  <span class="tier-label tier-label--target">{{ priceInfo.targetTierName }}</span>
                </div>
              </div>

              <!-- 價格明細 -->
              <div class="price-breakdown">
                <!-- 新訂閱 -->
                <template v-if="isNewSubscription">
                  <div class="price-row">
                    <span>{{ tier.label }} 月費</span>
                    <span class="price-value">NT$ {{ priceInfo.targetMonthlyPrice }}</span>
                  </div>
                </template>

                <!-- 升級（有剩餘價值） -->
                <template v-else>
                  <div class="price-row">
                    <span>{{ tier.label }} 月費</span>
                    <span class="price-value">NT$ {{ priceInfo.targetMonthlyPrice }}</span>
                  </div>

                  <div v-if="priceInfo.remainingValue > 0" class="price-row price-row--discount">
                    <span>
                      原方案剩餘價值
                      <span class="text-xs opacity-70">({{ priceInfo.daysRemaining }} 天)</span>
                    </span>
                    <span class="price-value text-emerald-400">- NT$ {{ priceInfo.remainingValue }}</span>
                  </div>

                  <div class="price-divider"></div>
                </template>

                <!-- 最終價格 -->
                <div class="price-row price-row--total">
                  <span>本次支付</span>
                  <span class="price-value price-value--total">NT$ {{ priceInfo.upgradePrice }}</span>
                </div>

                <!-- 節省金額提示 -->
                <div v-if="hasSavings" class="savings-badge">
                  <CheckCircleIcon class="w-4 h-4" />
                  <span>補差價升級，已為您節省 NT$ {{ priceInfo.savings }}</span>
                </div>
              </div>

              <!-- 年訂閱專屬優惠 -->
              <div v-if="isYearly && yearlyBonus" class="yearly-bonus-section">
                <div class="yearly-bonus-header">
                  <GiftIcon class="w-5 h-5" />
                  <span>年訂閱專屬優惠</span>
                </div>
                <div class="yearly-bonus-list">
                  <div class="yearly-bonus-item">
                    <span class="yearly-bonus-icon">🎁</span>
                    <span>立即獲得 <strong>{{ yearlyBonus.signup }} 金幣</strong></span>
                  </div>
                  <div class="yearly-bonus-item">
                    <span class="yearly-bonus-icon">📅</span>
                    <span>每月額外獲得 <strong>{{ yearlyBonus.monthly }} 金幣</strong></span>
                  </div>
                  <div class="yearly-bonus-item">
                    <span class="yearly-bonus-icon">🔄</span>
                    <span>續約享 <strong>{{ yearlyBonus.renewal }}% 折扣</strong></span>
                  </div>
                </div>
              </div>

              <!-- 說明 -->
              <div class="info-box">
                <p>{{ priceInfo.description }}</p>
                <p class="info-box__note">升級後會員期限從今天起算 {{ priceInfo.newExpiryDays }} 天</p>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn--secondary"
              @click="handleClose"
            >
              取消
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="isLoading || !!error"
              @click="handleConfirm"
            >
              確認升級
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: linear-gradient(135deg, #1e2642, #0f1629);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 20px;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.modal-header__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a78bfa;
}

.modal-header__title {
  flex: 1;
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #f1f5f9;
}

.modal-header__cycle {
  padding: 0.25rem 0.625rem;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.15));
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fbbf24;
  margin-right: 0.5rem;
}

.modal-close {
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: rgba(148, 163, 184, 0.7);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #f1f5f9;
}

/* Content */
.modal-content {
  padding: 1.5rem;
}

.modal-loading,
.modal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  color: rgba(148, 163, 184, 0.8);
}

.modal-error {
  color: #f87171;
}

.retry-btn {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: transparent;
  color: #f87171;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}

/* Upgrade Path */
.upgrade-path {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.upgrade-path__arrow {
  color: rgba(148, 163, 184, 0.5);
  font-size: 1.25rem;
}

.tier-label {
  display: inline-block;
  padding: 0.375rem 0.875rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  background: rgba(148, 163, 184, 0.15);
  color: rgba(148, 163, 184, 0.9);
}

.tier-label--target {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
  color: #a78bfa;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

/* Price Breakdown */
.price-breakdown {
  background: rgba(15, 23, 42, 0.3);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0;
  color: rgba(226, 232, 240, 0.8);
  font-size: 0.9375rem;
}

.price-row--discount {
  color: #34d399;
}

.price-value {
  font-weight: 600;
  color: #f1f5f9;
}

.price-divider {
  height: 1px;
  background: rgba(148, 163, 184, 0.15);
  margin: 0.5rem 0;
}

.price-row--total {
  padding-top: 0.75rem;
}

.price-value--total {
  font-size: 1.25rem;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.savings-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  margin-top: 0.75rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
  color: #34d399;
  font-size: 0.8125rem;
}

/* Yearly Bonus Section */
.yearly-bonus-section {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.08));
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.yearly-bonus-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #fbbf24;
  font-weight: 600;
  font-size: 0.9375rem;
  margin-bottom: 0.75rem;
}

.yearly-bonus-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.yearly-bonus-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: rgba(251, 191, 36, 0.9);
}

.yearly-bonus-item strong {
  color: #fbbf24;
}

.yearly-bonus-icon {
  font-size: 1rem;
}

/* Info Box */
.info-box {
  padding: 1rem;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 10px;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.8);
  line-height: 1.5;
}

.info-box p {
  margin: 0;
}

.info-box__note {
  margin-top: 0.5rem !important;
  font-size: 0.8125rem;
  color: rgba(148, 163, 184, 0.7);
}

/* Footer */
.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.5rem;
}

.btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--secondary {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: rgba(148, 163, 184, 0.9);
}

.btn--secondary:hover {
  background: rgba(148, 163, 184, 0.1);
  border-color: rgba(148, 163, 184, 0.5);
}

.btn--primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: white;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
}

.btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(10px);
}
</style>
