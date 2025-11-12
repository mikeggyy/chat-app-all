<script setup>
import { computed } from "vue";
import { SparklesIcon } from "@heroicons/vue/24/solid";
import LoadingSpinner from "../LoadingSpinner.vue";
import { COIN_ICON_PATH } from "../../config/assets";

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  isPurchasing: {
    type: Boolean,
    default: false,
  },
  balance: {
    type: Number,
    default: 0,
  },
  membershipTier: {
    type: String,
    default: "free",
  },
  isCoinIconAvailable: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["purchase", "coinIconError"]);

// 格式化器
const coinsFormatter = new Intl.NumberFormat("zh-TW");
const priceFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  minimumFractionDigits: 0,
});

const formatCoins = (value) => coinsFormatter.format(value);
const formatPrice = (value) => priceFormatter.format(value);

// 是否禁用購買按鈕
const isDisabled = computed(() => {
  if (props.isPurchasing) return true;
  if (!props.item.isCoinPackage && props.balance < props.item.price) return true;
  if (
    props.item.id === "potion-brain-boost" &&
    props.membershipTier === "vvip"
  ) {
    return true;
  }
  return false;
});

// 禁用提示
const disabledTitle = computed(() => {
  if (
    props.item.id === "potion-brain-boost" &&
    props.membershipTier === "vvip"
  ) {
    return "您的模型已經是最高級了";
  }
  return "";
});

const handlePurchase = () => {
  emit("purchase", props.item);
};

const handleCoinIconError = () => {
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
      <p v-if="item.description" class="shop-item__description">
        {{ item.description }}
      </p>
      <p v-if="item.effect" class="shop-item__effect">
        {{ item.effect }}
      </p>

      <button
        type="button"
        class="shop-item__buy-button"
        :disabled="isDisabled"
        :title="disabledTitle"
        @click="handlePurchase"
      >
        <LoadingSpinner v-if="isPurchasing" size="sm" />
        <div v-else class="button-content">
          <span class="button-price">
            {{
              item.isCoinPackage
                ? formatPrice(item.price)
                : formatCoins(item.price)
            }}
          </span>
          <span v-if="!item.isCoinPackage" class="button-label"
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

  &__effect {
    margin: 0.25rem 0 0;
    font-size: 0.68rem;
    color: rgba(147, 197, 253, 0.85);
    text-align: center;
    line-height: 1.3;
    font-weight: 500;
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
</style>
