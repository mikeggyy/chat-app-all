<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { WalletIcon, ArrowRightIcon } from "@heroicons/vue/24/outline";

interface Props {
  balance: number;
  isGuest?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isGuest: false,
});

const emit = defineEmits<{
  "open-stats": [];
}>();

const COIN_ICON_PATH = "/images/icons/coin.webp";
const isCoinIconAvailable = ref(true);

const formattedBalance = computed(() => {
  if (props.balance >= 1000000) {
    return `${(props.balance / 1000000).toFixed(1)}M`;
  }
  if (props.balance >= 1000) {
    return `${(props.balance / 1000).toFixed(1)}K`;
  }
  return props.balance.toString();
});

const handleCoinIconError = () => {
  isCoinIconAvailable.value = false;
};

const openStatsModal = () => {
  emit("open-stats");
};

onMounted(() => {
  // 	e�c
  const img = new Image();
  img.src = COIN_ICON_PATH;
  img.onerror = () => {
    isCoinIconAvailable.value = false;
  };
});
</script>

<template>
  <button
    v-if="!isGuest"
    type="button"
    class="stats-button"
    @click="openStatsModal"
  >
    <img
      v-if="isCoinIconAvailable"
      :src="COIN_ICON_PATH"
      alt=""
      class="stats-button__icon stats-button__icon-image"
      decoding="async"
      @error="handleCoinIconError"
    />
    <WalletIcon
      v-else
      class="stats-button__icon stats-button__icon-fallback"
      aria-hidden="true"
    />
    <div class="stats-button__content">
      <span class="stats-button__value">{{ formattedBalance }}</span>
    </div>
    <ArrowRightIcon class="stats-button__arrow" aria-hidden="true" />
  </button>
</template>

<style scoped lang="scss">
.stats-button {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(30, 33, 48, 0.85);
  backdrop-filter: blur(8px);
  min-width: 160px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

  &:hover {
    background: rgba(51, 65, 85, 0.9);
    border-color: rgba(148, 163, 184, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  &__icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;

    &-image {
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }

    &-fallback {
      color: #fbbf24;
    }
  }

  &__content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    flex: 1;
  }

  &__value {
    font-size: 1.125rem;
    font-weight: 700;
    color: #fbbf24;
    line-height: 1.2;
  }

  &__label {
    font-size: 0.75rem;
    color: rgba(226, 232, 240, 0.7);
    letter-spacing: 0.02em;
  }

  &__arrow {
    width: 18px;
    height: 18px;
    color: rgba(148, 163, 184, 0.6);
    flex-shrink: 0;
    transition: transform 0.2s ease, color 0.2s ease;
  }

  &:hover &__arrow {
    transform: translateX(2px);
    color: rgba(226, 232, 240, 0.9);
  }
}

@media (max-width: 640px) {
  .stats-button {
    min-width: 140px;
    padding: 0.65rem 0.85rem;

    &__icon {
      width: 28px;
      height: 28px;
    }

    &__value {
      font-size: 1rem;
    }
  }
}
</style>
