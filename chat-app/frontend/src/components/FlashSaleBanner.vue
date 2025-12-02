<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { BoltIcon, ClockIcon } from "@heroicons/vue/24/solid";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import type { FlashSale } from "@/composables/useFlashSales";

// Props
interface Props {
  sale: FlashSale;
  isPurchasing?: boolean;
}

interface Emits {
  (e: "purchase", saleId: string): void;
  (e: "close"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isPurchasing: false,
});

const emit = defineEmits<Emits>();

// 倒數計時狀態
const remainingSeconds = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// 計算屬性
const formattedTime = computed(() => {
  const hours = Math.floor(remainingSeconds.value / 3600);
  const minutes = Math.floor((remainingSeconds.value % 3600) / 60);
  const seconds = remainingSeconds.value % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
});

const isUrgent = computed(() => remainingSeconds.value <= 3600); // 1小時內

const discountPercent = computed(() => {
  if (!props.sale.originalPrice || props.sale.originalPrice <= props.sale.price) {
    return 0;
  }
  return Math.round((1 - props.sale.price / props.sale.originalPrice) * 100);
});

const contentsText = computed(() => {
  const parts: string[] = [];
  const contents = props.sale.contents;

  if (contents.coins) parts.push(`${contents.coins} 金幣`);
  if (contents.photoUnlockCards) parts.push(`${contents.photoUnlockCards} 照片卡`);
  if (contents.characterUnlockCards) parts.push(`${contents.characterUnlockCards} 角色卡`);
  if (contents.videoUnlockCards) parts.push(`${contents.videoUnlockCards} 影片卡`);

  return parts.join(" + ");
});

// 方法
const handlePurchase = () => {
  if (!props.isPurchasing) {
    emit("purchase", props.sale.id);
  }
};

const handleClose = () => {
  emit("close");
};

const startCountdown = () => {
  const endTime = new Date(props.sale.endTime).getTime();
  const now = Date.now();
  remainingSeconds.value = Math.max(0, Math.floor((endTime - now) / 1000));

  countdownTimer = setInterval(() => {
    remainingSeconds.value = Math.max(0, remainingSeconds.value - 1);
    if (remainingSeconds.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer);
    }
  }, 1000);
};

const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
};

onMounted(() => {
  startCountdown();
});

onUnmounted(() => {
  stopCountdown();
});
</script>

<template>
  <div class="flash-sale-banner" :class="{ 'flash-sale-banner--urgent': isUrgent }">
    <!-- 關閉按鈕 -->
    <button class="close-btn" @click="handleClose">
      <XMarkIcon class="close-icon" />
    </button>

    <!-- 左側：閃電圖標和標籤 -->
    <div class="banner-left">
      <div class="flash-icon" :class="{ 'flash-icon--urgent': isUrgent }">
        <BoltIcon class="icon" />
      </div>
      <div class="badge-container">
        <span class="sale-badge">{{ sale.badge }}</span>
        <span v-if="discountPercent > 0" class="discount-badge">-{{ discountPercent }}%</span>
      </div>
    </div>

    <!-- 中間：內容和價格 -->
    <div class="banner-center">
      <div class="sale-name">{{ sale.name }}</div>
      <div class="sale-contents">{{ contentsText }}</div>
      <div class="price-row">
        <span class="current-price">NT$ {{ sale.price }}</span>
        <span v-if="sale.originalPrice > sale.price" class="original-price">
          NT$ {{ sale.originalPrice }}
        </span>
      </div>
    </div>

    <!-- 右側：倒數計時和購買按鈕 -->
    <div class="banner-right">
      <div class="countdown" :class="{ 'countdown--urgent': isUrgent }">
        <ClockIcon class="clock-icon" />
        <span class="countdown-time">{{ formattedTime }}</span>
      </div>
      <button
        class="purchase-btn"
        :class="{ 'purchase-btn--urgent': isUrgent }"
        :disabled="isPurchasing || remainingSeconds <= 0"
        @click="handlePurchase"
      >
        <span v-if="isPurchasing">處理中...</span>
        <span v-else-if="remainingSeconds <= 0">已結束</span>
        <span v-else>立即搶購</span>
      </button>
      <div v-if="sale.stockLimit" class="stock-info">
        剩餘 {{ sale.remainingStock }} 份
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.flash-sale-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 12px;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(251, 191, 36, 0.1),
      transparent
    );
    animation: shimmer 2s infinite;
  }

  &--urgent {
    border-color: rgba(239, 68, 68, 0.5);
    animation: pulse-border 1s infinite;

    &::before {
      background: linear-gradient(
        90deg,
        transparent,
        rgba(239, 68, 68, 0.15),
        transparent
      );
    }
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes pulse-border {
  0%,
  100% {
    border-color: rgba(239, 68, 68, 0.3);
  }
  50% {
    border-color: rgba(239, 68, 68, 0.7);
  }
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: transparent;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  z-index: 10;

  &:hover {
    opacity: 1;
  }

  .close-icon {
    width: 16px;
    height: 16px;
    color: #94a3b8;
  }
}

.banner-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
}

.flash-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: flash-pulse 1.5s infinite;

  &--urgent {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    animation: flash-pulse-urgent 0.8s infinite;
  }

  .icon {
    width: 24px;
    height: 24px;
    color: white;
  }
}

@keyframes flash-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes flash-pulse-urgent {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

.badge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.sale-badge {
  font-size: 0.65rem;
  color: #fbbf24;
  white-space: nowrap;
}

.discount-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.banner-center {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.sale-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 0.25rem;
}

.sale-contents {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.current-price {
  font-size: 1.1rem;
  font-weight: 800;
  color: #fbbf24;
}

.original-price {
  font-size: 0.8rem;
  color: #64748b;
  text-decoration: line-through;
}

.banner-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(251, 191, 36, 0.15);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;

  &--urgent {
    background: rgba(239, 68, 68, 0.2);
    animation: countdown-flash 0.5s infinite;
  }

  .clock-icon {
    width: 14px;
    height: 14px;
    color: #fbbf24;
  }

  .countdown-time {
    font-size: 0.85rem;
    font-weight: 700;
    color: #fbbf24;
    font-variant-numeric: tabular-nums;
  }

  &--urgent .clock-icon,
  &--urgent .countdown-time {
    color: #ef4444;
  }
}

@keyframes countdown-flash {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.purchase-btn {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--urgent {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;

    &:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }
  }
}

.stock-info {
  font-size: 0.65rem;
  color: #94a3b8;
}

// 響應式
@media (max-width: 480px) {
  .flash-sale-banner {
    flex-wrap: wrap;
    padding: 0.75rem;
  }

  .banner-left {
    flex-direction: row;
  }

  .banner-center {
    order: 3;
    flex-basis: 100%;
    margin-top: 0.5rem;
  }

  .banner-right {
    flex-direction: row;
    gap: 0.75rem;
  }

  .stock-info {
    display: none;
  }
}
</style>
</template>
