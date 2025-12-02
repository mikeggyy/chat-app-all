<script setup lang="ts">
import { computed } from "vue";
import { SparklesIcon, ClockIcon, GiftIcon } from "@heroicons/vue/24/solid";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import type { SpecialOffer, PurchaseResult } from "@/composables/useSpecialOffers";

// Props
interface Props {
  isOpen: boolean;
  offer: SpecialOffer | null;
  isPurchasing: boolean;
  purchaseResult: PurchaseResult | null;
}

interface Emits {
  (e: "close"): void;
  (e: "purchase"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  offer: null,
  isPurchasing: false,
  purchaseResult: null,
});

const emit = defineEmits<Emits>();

// 計算屬性
const showPurchaseResult = computed(() => props.purchaseResult !== null);

const offerTypeLabel = computed(() => {
  if (!props.offer) return "";
  return props.offer.type === "first_purchase" ? "首購限定" : "回歸禮包";
});

const offerTypeIcon = computed(() => {
  if (!props.offer) return "🎁";
  return props.offer.type === "first_purchase" ? "🎁" : "🎊";
});

const remainingTimeText = computed(() => {
  if (!props.offer) return "";
  const { remainingHours, remainingDays } = props.offer;
  if (remainingDays && remainingDays > 0) {
    return `剩餘 ${remainingDays} 天`;
  }
  if (remainingHours >= 24) {
    const days = Math.floor(remainingHours / 24);
    const hours = remainingHours % 24;
    return hours > 0 ? `剩餘 ${days} 天 ${hours} 小時` : `剩餘 ${days} 天`;
  }
  if (remainingHours > 0) {
    return `剩餘 ${remainingHours} 小時`;
  }
  return "即將到期";
});

const contentItems = computed(() => {
  if (!props.offer) return [];
  const items: Array<{ icon: string; text: string; highlight: boolean }> = [];
  const contents = props.offer.contents;

  if (contents.coins) {
    items.push({
      icon: "💰",
      text: `${contents.coins} 金幣`,
      highlight: true,
    });
  }
  if (contents.photoUnlockCards) {
    items.push({
      icon: "📸",
      text: `${contents.photoUnlockCards} 張照片解鎖卡`,
      highlight: false,
    });
  }
  if (contents.characterUnlockCards) {
    items.push({
      icon: "👤",
      text: `${contents.characterUnlockCards} 張角色解鎖卡`,
      highlight: false,
    });
  }
  if (contents.videoUnlockCards) {
    items.push({
      icon: "🎬",
      text: `${contents.videoUnlockCards} 張影片解鎖卡`,
      highlight: false,
    });
  }

  return items;
});

// 方法
const handleClose = () => {
  emit("close");
};

const handlePurchase = () => {
  if (!props.isPurchasing) {
    emit("purchase");
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && offer" class="modal-overlay" @click.self="handleClose">
        <div class="modal-container">
          <!-- 限時標籤 -->
          <div class="time-badge">
            <ClockIcon class="time-icon" />
            <span>{{ remainingTimeText }}</span>
          </div>

          <!-- 頭部 -->
          <div class="modal-header">
            <div class="header-badge">{{ offerTypeIcon }}</div>
            <div class="header-info">
              <span class="offer-type">{{ offerTypeLabel }}</span>
              <h2 class="offer-name">{{ offer.name }}</h2>
            </div>
            <button class="close-btn" @click="handleClose">
              <XMarkIcon class="close-icon" />
            </button>
          </div>

          <!-- 購買成功結果 -->
          <div v-if="showPurchaseResult && purchaseResult" class="purchase-result">
            <div class="result-icon">🎉</div>
            <div class="result-title">購買成功！</div>
            <div class="result-items">
              <div v-if="purchaseResult.contents.coins" class="result-item">
                <span class="item-icon">💰</span>
                <span class="item-value">+{{ purchaseResult.contents.coins }}</span>
                <span class="item-label">金幣</span>
              </div>
              <div v-if="purchaseResult.contents.photoUnlockCards" class="result-item">
                <span class="item-icon">📸</span>
                <span class="item-value">+{{ purchaseResult.contents.photoUnlockCards }}</span>
                <span class="item-label">照片卡</span>
              </div>
              <div v-if="purchaseResult.contents.characterUnlockCards" class="result-item">
                <span class="item-icon">👤</span>
                <span class="item-value">+{{ purchaseResult.contents.characterUnlockCards }}</span>
                <span class="item-label">角色卡</span>
              </div>
              <div v-if="purchaseResult.contents.videoUnlockCards" class="result-item">
                <span class="item-icon">🎬</span>
                <span class="item-value">+{{ purchaseResult.contents.videoUnlockCards }}</span>
                <span class="item-label">影片卡</span>
              </div>
            </div>
            <div class="new-balance">
              新餘額：<span class="balance-value">{{ purchaseResult.newBalance }}</span> 金幣
            </div>
          </div>

          <!-- 優惠內容（未購買時顯示） -->
          <template v-else>
            <!-- 優惠說明 -->
            <div class="offer-description">
              {{ offer.description }}
            </div>

            <!-- 優惠內容列表 -->
            <div class="offer-contents">
              <div class="contents-title">
                <SparklesIcon class="sparkle-icon" />
                <span>禮包內容</span>
              </div>
              <div class="contents-list">
                <div
                  v-for="(item, index) in contentItems"
                  :key="index"
                  class="content-item"
                  :class="{ 'content-item--highlight': item.highlight }"
                >
                  <span class="content-icon">{{ item.icon }}</span>
                  <span class="content-text">{{ item.text }}</span>
                </div>
              </div>
            </div>

            <!-- 價格區塊 -->
            <div class="price-section">
              <div class="price-info">
                <div class="original-price">
                  <span class="price-label">原價</span>
                  <span class="price-value strikethrough">
                    NT$ {{ offer.originalPrice }}
                  </span>
                </div>
                <div class="discount-badge">
                  {{ offer.discount }} OFF
                </div>
              </div>
              <div class="final-price">
                <span class="currency">NT$</span>
                <span class="price-amount">{{ offer.price }}</span>
              </div>
            </div>
          </template>

          <!-- 按鈕 -->
          <div class="modal-actions">
            <button
              v-if="!showPurchaseResult"
              class="purchase-btn"
              :disabled="isPurchasing"
              @click="handlePurchase"
            >
              <GiftIcon class="btn-icon" />
              <span v-if="isPurchasing">處理中...</span>
              <span v-else>立即購買 NT$ {{ offer.price }}</span>
            </button>
            <button
              v-else
              class="confirm-btn"
              @click="handleClose"
            >
              太棒了！
            </button>
          </div>

          <!-- 底部提示 -->
          <div v-if="!showPurchaseResult" class="modal-footer">
            <span class="footer-note">{{ offer.badge }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-container {
  background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
  border-radius: 24px;
  border: 2px solid rgba(251, 191, 36, 0.4);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(251, 191, 36, 0.15);
  max-width: 380px;
  width: 100%;
  overflow: hidden;
  position: relative;
}

// 限時標籤
.time-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  z-index: 10;
  animation: pulse 2s infinite;
}

.time-icon {
  width: 14px;
  height: 14px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

// 頭部
.modal-header {
  display: flex;
  align-items: center;
  padding: 2rem 1.5rem 1rem;
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.15),
    rgba(245, 158, 11, 0.1)
  );
}

.header-badge {
  font-size: 3rem;
  margin-right: 1rem;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.header-info {
  flex: 1;
}

.offer-type {
  display: inline-block;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #1e293b;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  margin-bottom: 4px;
}

.offer-name {
  font-size: 1.35rem;
  font-weight: 800;
  color: #fef3c7;
  margin: 0;
  text-shadow: 0 2px 10px rgba(251, 191, 36, 0.3);
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 10px;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }

  .close-icon {
    width: 20px;
    height: 20px;
    color: #94a3b8;
  }
}

// 優惠說明
.offer-description {
  padding: 0 1.5rem;
  font-size: 0.9rem;
  color: #cbd5e1;
  line-height: 1.5;
  text-align: center;
}

// 優惠內容
.offer-contents {
  padding: 1rem 1.5rem;
}

.contents-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 0.75rem;
}

.sparkle-icon {
  width: 18px;
  height: 18px;
  color: #fbbf24;
}

.contents-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.content-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 12px;
  transition: all 0.2s;

  &--highlight {
    background: linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.15),
      rgba(245, 158, 11, 0.1)
    );
    border-color: rgba(251, 191, 36, 0.3);
  }
}

.content-icon {
  font-size: 1.25rem;
}

.content-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f1f5f9;
}

// 價格區塊
.price-section {
  padding: 1rem 1.5rem;
  background: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.1),
    rgba(5, 150, 105, 0.05)
  );
  margin: 0 1rem;
  border-radius: 16px;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.price-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.original-price {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.price-label {
  font-size: 0.75rem;
  color: #64748b;
}

.price-value {
  font-size: 0.9rem;
  color: #94a3b8;

  &.strikethrough {
    text-decoration: line-through;
  }
}

.discount-badge {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
}

.final-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem;
}

.currency {
  font-size: 1rem;
  font-weight: 600;
  color: #10b981;
}

.price-amount {
  font-size: 2.5rem;
  font-weight: 800;
  color: #10b981;
  text-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
}

// 購買結果
.purchase-result {
  padding: 1.5rem;
  text-align: center;
}

.result-icon {
  font-size: 4rem;
  animation: bounce 0.6s ease;
}

.result-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #10b981;
  margin: 0.5rem 0 1rem;
}

.result-items {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.result-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 12px;
  min-width: 80px;
}

.item-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.item-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #10b981;
}

.item-label {
  font-size: 0.75rem;
  color: #94a3b8;
}

.new-balance {
  font-size: 0.9rem;
  color: #94a3b8;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.balance-value {
  font-weight: 700;
  color: #fbbf24;
}

// 按鈕
.modal-actions {
  padding: 1rem 1.5rem;
}

.purchase-btn,
.confirm-btn {
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 14px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.purchase-btn {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #1e293b;
  box-shadow:
    0 4px 15px rgba(251, 191, 36, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);

  .btn-icon {
    width: 22px;
    height: 22px;
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 8px 25px rgba(251, 191, 36, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.confirm-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
  }
}

// 底部
.modal-footer {
  padding: 0 1.5rem 1rem;
  text-align: center;
}

.footer-note {
  font-size: 0.8rem;
  color: #64748b;
}

// 動畫
.modal-enter-active,
.modal-leave-active {
  transition: all 0.35s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal-container {
    transform: scale(0.85) translateY(30px);
  }
}
</style>
