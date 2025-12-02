<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, type ComputedRef, type Ref } from "vue";
import { SparklesIcon } from "@heroicons/vue/24/solid";
import { ClockIcon } from "@heroicons/vue/24/outline";
import LoadingSpinner from "../LoadingSpinner.vue";
import { COIN_ICON_PATH } from "../../config/assets";

// Types
interface PurchaseStatus {
  canPurchase: boolean;
  reason?: string | null;
  nextAvailableAt?: Date | string | null;
  purchaseCount?: number;
  lastPurchaseAt?: Date | string | null;
}

interface ShopItemData {
  id: string;
  name: string;
  price: number;
  isCoinPackage?: boolean;
  isBundlePackage?: boolean;  // ✅ 新增：組合禮包標記
  currency?: string;          // ✅ 新增：貨幣類型
  badge?: string;
  popular?: boolean;
  emoji?: string;
  useCoinImage?: boolean;
  icon?: any; // Component type
  iconColor?: string;
  bonusText?: string;
  description?: string;
  effect?: string;
  purchaseStatus?: PurchaseStatus | null;  // ✅ 新增：購買狀態
  [key: string]: any;
}

interface Props {
  item: ShopItemData;
  isPurchasing?: boolean;
  balance?: number;
  membershipTier?: string;
  isCoinIconAvailable?: boolean;
}

interface Emits {
  (e: "purchase", item: ShopItemData): void;
  (e: "coinIconError"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isPurchasing: false,
  balance: 0,
  membershipTier: "free",
  isCoinIconAvailable: true,
});

const emit = defineEmits<Emits>();

// 格式化器
const coinsFormatter = new Intl.NumberFormat("zh-TW");
const priceFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  minimumFractionDigits: 0,
});

const formatCoins = (value: number): string => coinsFormatter.format(value);
const formatPrice = (value: number): string => priceFormatter.format(value);

// 是否為真金購買（金幣套餐或組合禮包）
const isRealMoneyPurchase: ComputedRef<boolean> = computed(() => {
  return props.item.isCoinPackage || props.item.isBundlePackage || false;
});

// 是否因為限購而無法購買
const isPurchaseLimited: ComputedRef<boolean> = computed(() => {
  const status = props.item.purchaseStatus;
  return status ? !status.canPurchase : false;
});

// 限購原因文字
const purchaseLimitReason: ComputedRef<string> = computed(() => {
  const status = props.item.purchaseStatus;
  if (status && !status.canPurchase) {
    return status.reason || "已購買";
  }
  return "";
});

// 是否禁用購買按鈕
const isDisabled: ComputedRef<boolean> = computed(() => {
  if (props.isPurchasing) return true;
  // 檢查限購狀態
  if (isPurchaseLimited.value) return true;
  // 金幣套餐和組合禮包使用真金購買，不檢查金幣餘額
  if (!isRealMoneyPurchase.value && props.balance < props.item.price) return true;
  if (
    props.item.id === "potion-brain-boost" &&
    props.membershipTier === "vvip"
  ) {
    return true;
  }
  return false;
});

// 禁用提示
const disabledTitle: ComputedRef<string> = computed(() => {
  if (isPurchaseLimited.value) {
    return purchaseLimitReason.value;
  }
  if (
    props.item.id === "potion-brain-boost" &&
    props.membershipTier === "vvip"
  ) {
    return "您的模型已經是最高級了";
  }
  return "";
});

// 倒數計時相關
const countdownText: Ref<string> = ref("");
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// 計算倒數時間
const calculateCountdown = (): void => {
  const status = props.item.purchaseStatus;
  if (!status || status.canPurchase || !status.nextAvailableAt) {
    countdownText.value = "";
    return;
  }

  const nextAvailable = new Date(status.nextAvailableAt);
  const now = new Date();
  const diff = nextAvailable.getTime() - now.getTime();

  if (diff <= 0) {
    countdownText.value = "即將可購買";
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) {
    countdownText.value = `${days}天 ${hours}小時後`;
  } else if (hours > 0) {
    countdownText.value = `${hours}小時 ${minutes}分後`;
  } else if (minutes > 0) {
    countdownText.value = `${minutes}分 ${seconds}秒後`;
  } else {
    countdownText.value = `${seconds}秒後`;
  }
};

// 是否顯示倒數計時
const showCountdown: ComputedRef<boolean> = computed(() => {
  const status = props.item.purchaseStatus;
  return !!(status && !status.canPurchase && status.nextAvailableAt);
});

// 啟動/停止倒數計時
const startCountdown = (): void => {
  if (showCountdown.value) {
    calculateCountdown();
    // 根據剩餘時間調整更新頻率
    const status = props.item.purchaseStatus;
    if (status?.nextAvailableAt) {
      const diff = new Date(status.nextAvailableAt).getTime() - Date.now();
      // 小於 1 小時用秒更新，否則用分鐘更新
      const interval = diff < 3600000 ? 1000 : 60000;
      countdownInterval = setInterval(calculateCountdown, interval);
    }
  }
};

const stopCountdown = (): void => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
};

onMounted(() => {
  startCountdown();
});

onUnmounted(() => {
  stopCountdown();
});

const handlePurchase = (): void => {
  emit("purchase", props.item);
};

const handleCoinIconError = (): void => {
  emit("coinIconError");
};
</script>

<template>
  <div
    class="shop-item"
    :class="{ 'shop-item--popular': item.popular }"
  >
    <div v-if="item.badge" class="shop-item__badge">
      <SparklesIcon class="badge-icon" aria-hidden="true" />
      {{ item.badge }}
    </div>

    <div
      class="shop-item__icon-wrapper"
      :class="{
        'has-emoji': item.emoji,
        [`shop-item__icon-wrapper--${item.iconColor}`]: item.iconColor,
      }"
    >
      <span v-if="item.emoji" class="shop-item__emoji">{{
        item.emoji
      }}</span>
      <img
        v-else-if="item.useCoinImage && isCoinIconAvailable"
        :src="COIN_ICON_PATH"
        alt=""
        class="shop-item__icon shop-item__icon-image"
        decoding="async"
        @error="handleCoinIconError"
      />
      <component
        v-else-if="item.icon"
        :is="item.icon"
        class="shop-item__icon"
        aria-hidden="true"
      />
    </div>

    <div class="shop-item__content">
      <h3 class="shop-item__name">{{ item.name }}</h3>
      <p v-if="item.bonusText" class="shop-item__bonus">
        {{ item.bonusText }}
      </p>
      <!-- 禮包內容列表 -->
      <ul v-if="item.contents" class="shop-item__contents">
        <li v-if="item.contents.coins">
          <img :src="COIN_ICON_PATH" class="contents-icon contents-icon--coin" alt="" />
          <span>{{ item.contents.coins.toLocaleString() }} 金幣</span>
        </li>
        <li v-if="item.contents.characterUnlockCards">
          <span class="contents-icon">🎫</span>
          <span>{{ item.contents.characterUnlockCards }} 張角色解鎖券</span>
        </li>
        <li v-if="item.contents.photoUnlockCards">
          <span class="contents-icon">📷</span>
          <span>{{ item.contents.photoUnlockCards }} 張照片卡</span>
        </li>
        <li v-if="item.contents.videoUnlockCards">
          <span class="contents-icon">🎬</span>
          <span>{{ item.contents.videoUnlockCards }} 張影片卡</span>
        </li>
        <li v-if="item.contents.voiceUnlockCards">
          <span class="contents-icon">🎵</span>
          <span>{{ item.contents.voiceUnlockCards }} 張語音卡</span>
        </li>
        <li v-if="item.contents.characterCreationCards">
          <span class="contents-icon">✨</span>
          <span>{{ item.contents.characterCreationCards }} 張創建角色卡</span>
        </li>
      </ul>
      <!-- 非禮包的描述 -->
      <p v-else-if="item.description" class="shop-item__description">
        {{ item.description }}
      </p>
      <p v-if="item.effect" class="shop-item__effect">
        {{ item.effect }}
      </p>

      <!-- 限購倒數計時 -->
      <div v-if="showCountdown && countdownText" class="shop-item__countdown">
        <ClockIcon class="countdown-icon" aria-hidden="true" />
        <span class="countdown-text">{{ countdownText }}可購買</span>
      </div>

      <button
        type="button"
        class="shop-item__buy-button"
        :class="{ 'shop-item__buy-button--limited': isPurchaseLimited }"
        :disabled="isDisabled"
        :title="disabledTitle"
        @click="handlePurchase"
      >
        <LoadingSpinner v-if="isPurchasing" size="sm" />
        <div v-else-if="isPurchaseLimited" class="button-content button-content--limited">
          <span class="button-limited-text">{{ purchaseLimitReason }}</span>
        </div>
        <div v-else class="button-content">
          <span class="button-price">
            {{
              isRealMoneyPurchase
                ? formatPrice(item.price)
                : formatCoins(item.price)
            }}
          </span>
          <span v-if="!isRealMoneyPurchase" class="button-label"
            >金幣</span
          >
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.shop-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.68);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 32px rgba(2, 6, 23, 0.4);
  transition: all 0.18s ease;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(236, 72, 153, 0.35);
    box-shadow: 0 12px 28px rgba(236, 72, 153, 0.25);

    .shop-item__icon-wrapper {
      transform: scale(1.05);
      box-shadow: 0 4px 16px rgba(236, 72, 153, 0.35);
    }
  }

  &--popular {
    border-color: rgba(236, 72, 153, 0.25);
    background: rgba(236, 72, 153, 0.05);
  }

  &__badge {
    position: absolute;
    top: 0.65rem;
    right: 0.65rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.9),
      rgba(30, 64, 175, 0.8)
    );
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
    z-index: 2;
  }

  .badge-icon {
    width: 10px;
    height: 10px;
    animation: sparkle 2s ease-in-out infinite;
  }

  @keyframes sparkle {
    0%,
    100% {
      transform: scale(1) rotate(0deg);
    }
    50% {
      transform: scale(1.2) rotate(180deg);
    }
  }

  &__icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.2) 0%,
      rgba(30, 64, 175, 0.15) 100%
    );
    border: 1px solid rgba(236, 72, 153, 0.3);
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.2);
    transition: all 0.3s ease;

    &--coins {
      background: linear-gradient(
        135deg,
        rgba(251, 191, 36, 0.25),
        rgba(245, 158, 11, 0.15)
      );
      border: 1px solid rgba(251, 191, 36, 0.3);
      box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2);

      .shop-item__icon {
        color: #fbbf24;
        filter: drop-shadow(0 2px 6px rgba(251, 191, 36, 0.3));
      }
    }

    &--character {
      background: linear-gradient(
        135deg,
        rgba(167, 139, 250, 0.25),
        rgba(139, 92, 246, 0.15)
      );
      border: 1px solid rgba(167, 139, 250, 0.3);
      box-shadow: 0 4px 12px rgba(167, 139, 250, 0.2);

      .shop-item__icon {
        color: #a78bfa;
        filter: drop-shadow(0 2px 6px rgba(167, 139, 250, 0.3));
      }
    }

    &--photo {
      background: linear-gradient(
        135deg,
        rgba(96, 165, 250, 0.25),
        rgba(59, 130, 246, 0.15)
      );
      border: 1px solid rgba(96, 165, 250, 0.3);
      box-shadow: 0 4px 12px rgba(96, 165, 250, 0.2);

      .shop-item__icon {
        color: #60a5fa;
        filter: drop-shadow(0 2px 6px rgba(96, 165, 250, 0.3));
      }
    }

    &--voice {
      background: linear-gradient(
        135deg,
        rgba(244, 114, 182, 0.25),
        rgba(236, 72, 153, 0.15)
      );
      border: 1px solid rgba(244, 114, 182, 0.3);
      box-shadow: 0 4px 12px rgba(244, 114, 182, 0.2);

      .shop-item__icon {
        color: #f472b6;
        filter: drop-shadow(0 2px 6px rgba(244, 114, 182, 0.3));
      }
    }

    &--video {
      background: linear-gradient(
        135deg,
        rgba(245, 158, 11, 0.25),
        rgba(217, 119, 6, 0.15)
      );
      border: 1px solid rgba(245, 158, 11, 0.3);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);

      .shop-item__icon {
        color: #f59e0b;
        filter: drop-shadow(0 2px 6px rgba(245, 158, 11, 0.3));
      }
    }

    &--create {
      background: linear-gradient(
        135deg,
        rgba(34, 197, 94, 0.25),
        rgba(22, 163, 74, 0.15)
      );
      border: 1px solid rgba(34, 197, 94, 0.3);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);

      .shop-item__icon {
        color: #22c55e;
        filter: drop-shadow(0 2px 6px rgba(34, 197, 94, 0.3));
      }
    }

    &--memory {
      background: linear-gradient(
        135deg,
        rgba(139, 92, 246, 0.25),
        rgba(124, 58, 237, 0.15)
      );
      border: 1px solid rgba(139, 92, 246, 0.3);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);

      .shop-item__icon {
        color: #a78bfa;
        filter: drop-shadow(0 2px 6px rgba(139, 92, 246, 0.3));
      }
    }

    &--brain {
      background: linear-gradient(
        135deg,
        rgba(251, 191, 36, 0.25),
        rgba(245, 158, 11, 0.15)
      );
      border: 1px solid rgba(251, 191, 36, 0.3);
      box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2);

      .shop-item__icon {
        color: #fbbf24;
        filter: drop-shadow(0 2px 6px rgba(251, 191, 36, 0.3));
      }
    }

    &--bundle {
      background: linear-gradient(
        135deg,
        rgba(236, 72, 153, 0.25),
        rgba(251, 191, 36, 0.15)
      );
      border: 1px solid rgba(236, 72, 153, 0.3);
      box-shadow: 0 4px 12px rgba(236, 72, 153, 0.2);

      .shop-item__icon {
        color: #ec4899;
        filter: drop-shadow(0 2px 6px rgba(236, 72, 153, 0.3));
      }
    }
  }

  &__icon {
    width: 26px;
    height: 26px;
    color: #ec4899;
    filter: drop-shadow(0 2px 6px rgba(236, 72, 153, 0.3));
  }

  &__icon-image {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  &__emoji {
    font-size: 2rem;
    line-height: 1;
  }

  &__icon-wrapper.has-emoji {
    background: transparent;
    border: none;
    box-shadow: none;
  }

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    flex: 1;
    width: 100%;
    position: relative;
    z-index: 1;
  }

  &__name {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: #f8fafc;
    line-height: 1.2;
    text-align: center;
  }

  &__bonus {
    margin: 0;
    font-size: 0.72rem;
    color: rgba(236, 72, 153, 0.9);
    text-align: center;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  &__description {
    margin: 0.25rem 0 0;
    font-size: 0.7rem;
    color: rgba(226, 232, 240, 0.65);
    text-align: center;
    line-height: 1.4;
  }

  &__contents {
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;

    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: rgba(226, 232, 240, 0.85);
      padding: 0.35rem 0.5rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .contents-icon {
      font-size: 0.85rem;
      flex-shrink: 0;

      &--coin {
        width: 16px;
        height: 16px;
        object-fit: contain;
      }
    }
  }

  &__effect {
    margin: 0.25rem 0 0;
    font-size: 0.68rem;
    color: rgba(147, 197, 253, 0.85);
    text-align: center;
    line-height: 1.3;
    font-weight: 500;
  }

  &__countdown {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.5rem;
    padding: 0.45rem 0.75rem;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
    border: 1px solid rgba(251, 191, 36, 0.25);
    border-radius: 8px;
    width: 100%;

    .countdown-icon {
      width: 14px;
      height: 14px;
      color: #fbbf24;
      flex-shrink: 0;
    }

    .countdown-text {
      font-size: 0.7rem;
      font-weight: 600;
      color: #fbbf24;
      letter-spacing: 0.01em;
    }
  }

  &__buy-button {
    padding: 0.85rem 1.25rem;
    border-radius: 12px;
    border: none;
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.85),
      rgba(30, 64, 175, 0.75)
    );
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    box-shadow: 0 6px 16px rgba(236, 72, 153, 0.35);
    transition: all 0.2s ease;
    width: 100%;
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(236, 72, 153, 0.45);
      background: linear-gradient(
        135deg,
        rgba(236, 72, 153, 0.95),
        rgba(30, 64, 175, 0.85)
      );
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .button-content {
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
    }

    .button-price {
      font-size: 1.15rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.01em;
      line-height: 1;
    }

    .button-label {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 600;
      letter-spacing: 0.03em;
    }

    .button-content--limited {
      gap: 0;
    }

    .button-limited-text {
      font-size: 0.85rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      letter-spacing: 0.02em;
    }

    &--limited {
      background: linear-gradient(
        135deg,
        rgba(100, 116, 139, 0.7),
        rgba(71, 85, 105, 0.6)
      );
      box-shadow: none;
      cursor: not-allowed;

      &:hover {
        transform: none;
        box-shadow: none;
      }
    }
  }
}

@media (min-width: 769px) {
  .shop-item {
    padding: 1.15rem;
  }

  .shop-item__name {
    font-size: 1.1rem;
  }

  .shop-item__icon-wrapper {
    width: 56px;
    height: 56px;
  }

  .shop-item__icon {
    width: 30px;
    height: 30px;
  }

  .shop-item__buy-button {
    padding: 0.95rem 1.35rem;

    .button-price {
      font-size: 1.3rem;
    }

    .button-label {
      font-size: 0.85rem;
    }
  }
}

@media (max-width: 420px) {
  .shop-item {
    padding: 0.85rem;
    gap: 0.6rem;
  }

  .shop-item__icon-wrapper {
    width: 44px;
    height: 44px;
  }

  .shop-item__icon {
    width: 24px;
    height: 24px;
  }

  .shop-item__name {
    font-size: 0.95rem;
  }

  .shop-item__buy-button {
    padding: 0.75rem 1.1rem;

    .button-price {
      font-size: 1.05rem;
    }

    .button-label {
      font-size: 0.75rem;
    }
  }
}

// ========================================
// 桌面版樣式 (≥ 1024px)
// ========================================

@media (min-width: 1024px) {
  .shop-item {
    padding: 1.25rem;
    gap: 0.75rem;
    border-radius: 18px;
    background: linear-gradient(165deg, rgba(30, 33, 48, 0.95) 0%, rgba(22, 25, 43, 0.9) 100%);
    border: 1px solid rgba(148, 163, 184, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);

    &:hover {
      transform: translateY(-3px);
      border-color: rgba(102, 126, 234, 0.3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    }

    &__badge {
      top: 0.75rem;
      right: 0.75rem;
      padding: 0.35rem 0.75rem;
      font-size: 0.7rem;
    }

    &__icon-wrapper {
      width: 60px;
      height: 60px;
      border-radius: 16px;
    }

    &__icon {
      width: 32px;
      height: 32px;
    }

    &__emoji {
      font-size: 2.25rem;
    }

    &__name {
      font-size: 1.125rem;
    }

    &__bonus {
      font-size: 0.8rem;
    }

    &__description {
      font-size: 0.8rem;
    }

    &__contents {
      gap: 0.4rem;
      margin-top: 0.75rem;

      li {
        font-size: 0.8rem;
        padding: 0.4rem 0.6rem;
      }

      .contents-icon {
        font-size: 0.95rem;

        &--coin {
          width: 18px;
          height: 18px;
        }
      }
    }

    &__countdown {
      padding: 0.5rem 0.85rem;
      border-radius: 10px;
      margin-top: 0.625rem;

      .countdown-icon {
        width: 16px;
        height: 16px;
      }

      .countdown-text {
        font-size: 0.75rem;
      }
    }

    &__buy-button {
      padding: 1rem 1.5rem;
      border-radius: 14px;
      margin-top: 0.75rem;

      .button-price {
        font-size: 1.25rem;
      }

      .button-label {
        font-size: 0.875rem;
      }
    }
  }
}

// 寬螢幕優化
@media (min-width: 1440px) {
  .shop-item {
    padding: 1.5rem;
    gap: 0.875rem;
    border-radius: 20px;

    &__icon-wrapper {
      width: 68px;
      height: 68px;
    }

    &__icon {
      width: 36px;
      height: 36px;
    }

    &__emoji {
      font-size: 2.5rem;
    }

    &__name {
      font-size: 1.1875rem;
    }

    &__contents {
      li {
        font-size: 0.85rem;
        padding: 0.45rem 0.7rem;
      }

      .contents-icon--coin {
        width: 20px;
        height: 20px;
      }
    }

    &__countdown {
      padding: 0.55rem 1rem;
      border-radius: 12px;

      .countdown-icon {
        width: 17px;
        height: 17px;
      }

      .countdown-text {
        font-size: 0.8rem;
      }
    }

    &__buy-button {
      padding: 1.125rem 1.75rem;

      .button-price {
        font-size: 1.375rem;
      }
    }
  }
}
</style>
