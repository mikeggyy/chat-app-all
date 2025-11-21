<script setup lang="ts">
import { computed, type ComputedRef } from "vue";
import {
  ArrowLeftIcon,
  ChatBubbleBottomCenterIcon,
} from "@heroicons/vue/24/outline";
import { COIN_ICON_PATH } from "../../config/assets";

// Types
interface Props {
  formattedBalance: string;
  isCoinIconAvailable?: boolean;
}

interface Emits {
  (e: "back"): void;
  (e: "coinIconError"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isCoinIconAvailable: true,
});

const emit = defineEmits<Emits>();

const coinIconPath: ComputedRef<string> = computed(() =>
  props.isCoinIconAvailable ? COIN_ICON_PATH : ""
);

const handleBack = (): void => {
  emit("back");
};

const handleCoinIconError = (): void => {
  emit("coinIconError");
};
</script>

<template>
  <section class="shop-hero">
    <header class="shop-header">
      <button
        type="button"
        class="shop-header__button"
        aria-label="返回"
        @click="handleBack"
      >
        <ArrowLeftIcon class="icon" aria-hidden="true" />
      </button>
      <h1 class="shop-header__title">商城</h1>
    </header>

    <div class="shop-badge" aria-hidden="true">
      <span class="shop-badge__icon">
        <img
          v-if="coinIconPath"
          :src="coinIconPath"
          alt=""
          class="shop-badge__icon-image"
          decoding="async"
          @error="handleCoinIconError"
        />
        <ChatBubbleBottomCenterIcon
          v-else
          class="shop-badge__icon-fallback"
        />
      </span>
    </div>

    <p class="shop-balance">{{ formattedBalance }}</p>
    <p class="shop-balance__label">金幣餘額</p>
  </section>
</template>

<style scoped lang="scss">
.shop-hero {
  position: relative;
  padding: 5vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: rgba(15, 23, 42, 0.68);
  backdrop-filter: blur(18px);
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-top: none;
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.45);
}

.shop-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  position: relative;
  z-index: 1;

  &__title {
    margin: 0;
    font-size: clamp(1.3rem, 4vw, 1.6rem);
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #f8fafc;
    text-align: center;
  }

  &__button {
    position: absolute;
    left: 0;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.4);
    color: rgba(226, 232, 240, 0.85);
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;

    .icon {
      width: 19px;
      height: 19px;
    }

    &:hover,
    &:focus-visible {
      transform: translateY(-1px);
      background: rgba(30, 41, 59, 0.6);
      border-color: rgba(148, 163, 184, 0.45);
    }

    &:active {
      transform: translateY(0);
    }

    &:focus-visible {
      outline: 2px solid rgba(59, 130, 246, 0.6);
      outline-offset: 2px;
    }
  }
}

.shop-badge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.5rem 0 0.75rem;

  &__icon {
    position: relative;
    width: 7rem;
    height: 7rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(
      circle,
      rgba(236, 72, 153, 0.2) 0%,
      transparent 70%
    );
    border-radius: 50%;
    z-index: 1;

    &::before {
      content: "";
      position: absolute;
      inset: -12px;
      background: radial-gradient(
        circle,
        rgba(30, 64, 175, 0.15) 0%,
        transparent 60%
      );
      border-radius: 50%;
      animation: pulse 3s ease-in-out infinite;
    }
  }

  &__icon-image {
    width: 65%;
    height: 65%;
    object-fit: contain;
    filter: drop-shadow(0 6px 16px rgba(236, 72, 153, 0.4));
  }

  &__icon-fallback {
    width: 55%;
    height: 55%;
    color: #ec4899;
    filter: drop-shadow(0 4px 12px rgba(236, 72, 153, 0.5));
  }

  // 🔥 修復：emoji 樣式
  &__icon-emoji {
    font-size: 4rem;
    line-height: 1;
    filter: drop-shadow(0 6px 16px rgba(251, 191, 36, 0.4));
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.7;
  }
}

.shop-balance {
  margin: 0;
  font-size: clamp(1.85rem, 8vw, 2.4rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #f8fafc;
  position: relative;
  z-index: 1;

  &__label {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: rgba(226, 232, 240, 0.7);
    font-weight: 400;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
}

@media (max-width: 640px) {
  .shop-header {
    margin-bottom: 0.65rem;
  }

  .shop-badge {
    margin: 0.35rem 0 0.5rem;
  }

  .shop-badge__icon {
    width: 6rem;
    height: 6rem;
  }

  .shop-balance {
    font-size: clamp(1.65rem, 7vw, 2rem);
  }

  .shop-balance__label {
    font-size: 0.75rem;
    margin-top: 0.3rem;
  }
}

@media (max-width: 420px) {
  .shop-header__button {
    width: 36px;
    height: 36px;

    .icon {
      width: 18px;
      height: 18px;
    }
  }

  .shop-header__title {
    font-size: clamp(1.2rem, 4vw, 1.4rem);
  }
}
</style>
