<script setup lang="ts">
/**
 * 首充禮包橫幅組件
 *
 * P1 優化：讓首充禮包入口更顯眼
 * - 醒目的視覺設計
 * - 倒計時效果（如果有時間限制）
 * - 顯示禮包內容和優惠幅度
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  GiftIcon,
  SparklesIcon,
  FireIcon,
  ChevronRightIcon,
} from "@heroicons/vue/24/solid";
import { apiJson } from "../../utils/api";
import { logger } from "@/utils/logger";

// Props
interface Props {
  userId?: string;
}

// Emits
interface Emits {
  (e: "purchase"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// State
const isLoading = ref(true);
const isAvailable = ref(false);
const offer = ref<{
  id: string;
  name: string;
  price: number;
  originalValue: number;
  discount: number;
  contents: {
    coins?: number;
    photoCards?: number;
    videoCards?: number;
    unlockCards?: number;
  };
  expiresAt?: string;
} | null>(null);

// 倒計時相關
const timeRemaining = ref<string | null>(null);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// 計算折扣百分比
const discountPercent = computed(() => {
  if (!offer.value) return 0;
  const { price, originalValue } = offer.value;
  if (originalValue <= 0) return 0;
  return Math.round(((originalValue - price) / originalValue) * 100);
});

// 載入首購優惠信息
const loadFirstPurchaseOffer = async () => {
  if (!props.userId) {
    isLoading.value = false;
    return;
  }

  try {
    const response = await apiJson("/api/offers/first-purchase");

    if (response.success && response.data?.available) {
      isAvailable.value = true;
      offer.value = response.data.offer;

      // 啟動倒計時
      if (offer.value?.expiresAt) {
        startCountdown();
      }
    } else {
      isAvailable.value = false;
    }
  } catch (error) {
    logger.warn("載入首購優惠失敗:", error);
    isAvailable.value = false;
  } finally {
    isLoading.value = false;
  }
};

// 倒計時邏輯
const startCountdown = () => {
  if (!offer.value?.expiresAt) return;

  const updateCountdown = () => {
    const now = new Date().getTime();
    const expires = new Date(offer.value!.expiresAt!).getTime();
    const diff = expires - now;

    if (diff <= 0) {
      timeRemaining.value = null;
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      timeRemaining.value = `${days} 天 ${hours % 24} 小時`;
    } else if (hours > 0) {
      timeRemaining.value = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    } else {
      timeRemaining.value = `${minutes}:${String(seconds).padStart(2, "0")}`;
    }
  };

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
};

// 處理購買點擊
const handlePurchaseClick = () => {
  emit("purchase");
};

onMounted(() => {
  loadFirstPurchaseOffer();
});

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});
</script>

<template>
  <div v-if="!isLoading && isAvailable && offer" class="first-purchase-banner">
    <!-- 背景裝飾 -->
    <div class="banner-bg">
      <div class="bg-glow bg-glow--1"></div>
      <div class="bg-glow bg-glow--2"></div>
      <div class="bg-sparkles">
        <SparklesIcon class="sparkle sparkle--1" />
        <SparklesIcon class="sparkle sparkle--2" />
        <SparklesIcon class="sparkle sparkle--3" />
      </div>
    </div>

    <!-- 主要內容 -->
    <div class="banner-content">
      <!-- 左側圖標和標籤 -->
      <div class="banner-left">
        <div class="icon-wrapper">
          <GiftIcon class="main-icon" />
          <div class="icon-badge">
            <FireIcon class="badge-icon" />
          </div>
        </div>

        <div class="label-stack">
          <span class="label-new">首充特惠</span>
          <span class="label-discount">省 {{ discountPercent }}%</span>
        </div>
      </div>

      <!-- 中間內容 -->
      <div class="banner-center">
        <h3 class="banner-title">{{ offer.name || "新手禮包" }}</h3>
        <div class="banner-contents">
          <span v-if="offer.contents?.coins" class="content-item">
            💰 {{ offer.contents.coins }} 金幣
          </span>
          <span v-if="offer.contents?.photoCards" class="content-item">
            📸 {{ offer.contents.photoCards }} 拍照卡
          </span>
          <span v-if="offer.contents?.unlockCards" class="content-item">
            🔓 {{ offer.contents.unlockCards }} 解鎖券
          </span>
        </div>

        <!-- 倒計時 -->
        <div v-if="timeRemaining" class="countdown">
          <span class="countdown-label">限時優惠</span>
          <span class="countdown-time">{{ timeRemaining }}</span>
        </div>
      </div>

      <!-- 右側價格和按鈕 -->
      <div class="banner-right">
        <div class="price-stack">
          <span class="price-original">NT$ {{ offer.originalValue }}</span>
          <span class="price-current">NT$ {{ offer.price }}</span>
        </div>

        <button
          type="button"
          class="purchase-btn"
          @click="handlePurchaseClick"
        >
          <span>立即購買</span>
          <ChevronRightIcon class="btn-icon" />
        </button>
      </div>
    </div>

    <!-- 閃光效果 -->
    <div class="shine-effect"></div>
  </div>
</template>

<style scoped lang="scss">
.first-purchase-banner {
  position: relative;
  margin: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(236, 72, 153, 0.15) 0%,
    rgba(168, 85, 247, 0.15) 50%,
    rgba(59, 130, 246, 0.15) 100%
  );
  border: 1px solid rgba(236, 72, 153, 0.3);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(236, 72, 153, 0.5);
    box-shadow: 0 8px 32px rgba(236, 72, 153, 0.25);
  }

  &:active {
    transform: translateY(0);
  }
}

// 背景裝飾
.banner-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.6;

  &--1 {
    width: 120px;
    height: 120px;
    background: rgba(236, 72, 153, 0.4);
    top: -40px;
    left: -20px;
    animation: pulse-glow 3s ease-in-out infinite;
  }

  &--2 {
    width: 100px;
    height: 100px;
    background: rgba(168, 85, 247, 0.4);
    bottom: -30px;
    right: -20px;
    animation: pulse-glow 3s ease-in-out infinite 1.5s;
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

.bg-sparkles {
  position: absolute;
  inset: 0;
}

.sparkle {
  position: absolute;
  color: rgba(251, 191, 36, 0.6);
  animation: sparkle-float 4s ease-in-out infinite;

  &--1 {
    width: 16px;
    height: 16px;
    top: 10%;
    right: 20%;
    animation-delay: 0s;
  }

  &--2 {
    width: 12px;
    height: 12px;
    top: 60%;
    right: 10%;
    animation-delay: 1.3s;
  }

  &--3 {
    width: 14px;
    height: 14px;
    top: 30%;
    left: 30%;
    animation-delay: 2.6s;
  }
}

@keyframes sparkle-float {
  0%,
  100% {
    opacity: 0.4;
    transform: translateY(0) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: translateY(-5px) rotate(180deg);
  }
}

// 主要內容
.banner-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

// 左側
.banner-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.icon-wrapper {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ec4899, #a855f7);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);

  .main-icon {
    width: 28px;
    height: 28px;
    color: white;
  }

  .icon-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #f97316, #ef4444);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: badge-bounce 2s ease-in-out infinite;

    .badge-icon {
      width: 12px;
      height: 12px;
      color: white;
    }
  }
}

@keyframes badge-bounce {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

.label-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.label-new {
  font-size: 0.65rem;
  font-weight: 700;
  color: #fbbf24;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.label-discount {
  font-size: 0.6rem;
  font-weight: 600;
  color: #34d399;
  background: rgba(52, 211, 153, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

// 中間
.banner-center {
  flex: 1;
  min-width: 0;
}

.banner-title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  font-weight: 700;
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner-contents {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.content-item {
  font-size: 0.7rem;
  color: rgba(226, 232, 240, 0.85);
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.countdown-label {
  font-size: 0.65rem;
  color: rgba(226, 232, 240, 0.6);
}

.countdown-time {
  font-size: 0.75rem;
  font-weight: 700;
  color: #f97316;
  font-variant-numeric: tabular-nums;
  animation: countdown-pulse 1s ease-in-out infinite;
}

@keyframes countdown-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

// 右側
.banner-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.price-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.price-original {
  font-size: 0.7rem;
  color: rgba(226, 232, 240, 0.5);
  text-decoration: line-through;
}

.price-current {
  font-size: 1.1rem;
  font-weight: 800;
  color: #fbbf24;
  text-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
}

.purchase-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #ec4899, #a855f7);
  border: none;
  border-radius: 20px;
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(236, 72, 153, 0.5);
  }

  &:active {
    transform: scale(0.98);
  }

  .btn-icon {
    width: 14px;
    height: 14px;
  }
}

// 閃光效果
.shine-effect {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  animation: shine 4s ease-in-out infinite;
}

@keyframes shine {
  0% {
    left: -100%;
  }
  20%,
  100% {
    left: 200%;
  }
}

// 響應式設計
@media (max-width: 480px) {
  .first-purchase-banner {
    padding: 0.875rem 1rem;
  }

  .banner-content {
    gap: 0.75rem;
  }

  .icon-wrapper {
    width: 42px;
    height: 42px;

    .main-icon {
      width: 24px;
      height: 24px;
    }
  }

  .banner-title {
    font-size: 0.9rem;
  }

  .content-item {
    font-size: 0.65rem;
  }

  .price-current {
    font-size: 1rem;
  }

  .purchase-btn {
    padding: 0.4rem 0.8rem;
    font-size: 0.75rem;
  }
}

// 桌面版優化
@media (min-width: 1024px) {
  .first-purchase-banner {
    margin: 0;
    padding: 1.25rem 1.5rem;
    border-radius: 20px;
  }

  .banner-content {
    gap: 1.5rem;
  }

  .icon-wrapper {
    width: 56px;
    height: 56px;

    .main-icon {
      width: 32px;
      height: 32px;
    }

    .icon-badge {
      width: 24px;
      height: 24px;

      .badge-icon {
        width: 14px;
        height: 14px;
      }
    }
  }

  .banner-title {
    font-size: 1.15rem;
  }

  .content-item {
    font-size: 0.8rem;
    padding: 3px 8px;
  }

  .price-current {
    font-size: 1.25rem;
  }

  .purchase-btn {
    padding: 0.6rem 1.25rem;
    font-size: 0.875rem;
    border-radius: 24px;

    .btn-icon {
      width: 16px;
      height: 16px;
    }
  }
}
</style>
