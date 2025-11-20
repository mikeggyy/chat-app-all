<script setup lang="ts">
import { computed } from "vue";
import { BoltIcon, SparklesIcon } from "@heroicons/vue/24/solid";
import { ClockIcon } from "@heroicons/vue/24/outline";

type MembershipTier = "free" | "vip" | "vvip";

interface Props {
  tier?: MembershipTier;
  tierName?: string;
  isVIP?: boolean;
  isVVIP?: boolean;
  isPaidMember?: boolean;
  formattedExpiryDate?: string;
  daysUntilExpiry?: number | null;
  isExpiringSoon?: boolean;
  isGuest?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  tier: "free",
  tierName: "免費會員",
  isVIP: false,
  isVVIP: false,
  isPaidMember: false,
  formattedExpiryDate: "",
  daysUntilExpiry: null,
  isExpiringSoon: false,
  isGuest: false,
});

const emit = defineEmits<{
  "upgrade-click": [];
}>();

const cardClass = computed(() => {
  if (props.isVVIP) return "vip-card--vvip";
  if (props.isVIP) return "vip-card--vip";
  return "vip-card--free";
});

const showExpiryInfo = computed(() => {
  return props.isPaidMember && props.formattedExpiryDate;
});

const expiryWarningClass = computed(() => {
  if (props.isExpiringSoon && props.daysUntilExpiry !== null) {
    if (props.daysUntilExpiry <= 3) return "vip-card__expiry--urgent";
    if (props.daysUntilExpiry <= 7) return "vip-card__expiry--warning";
  }
  return "";
});

const buttonText = computed(() => {
  if (props.isVVIP) return "續訂會員";
  if (props.isVIP) return "升級至 VVIP";
  return "開通 VIP";
});

const handleUpgradeClick = () => {
  emit("upgrade-click");
};
</script>

<template>
  <button
    v-if="!isGuest"
    type="button"
    class="vip-card"
    :class="cardClass"
    @click="handleUpgradeClick"
  >
    <div class="vip-card__header">
      <div class="vip-card__icon-wrapper">
        <SparklesIcon v-if="isVVIP" class="vip-card__icon" aria-hidden="true" />
        <BoltIcon v-else class="vip-card__icon" aria-hidden="true" />
      </div>
      <div class="vip-card__info">
        <div class="vip-card__tier">{{ tierName }}</div>
        <div v-if="showExpiryInfo" class="vip-card__expiry" :class="expiryWarningClass">
          <ClockIcon class="vip-card__expiry-icon" aria-hidden="true" />
          <span>{{ formattedExpiryDate }}</span>
        </div>
      </div>
    </div>
    <div class="vip-card__action">
      <span class="vip-card__button-text">{{ buttonText }}</span>
      <svg
        class="vip-card__arrow"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
  </button>
</template>

<style scoped lang="scss">
.vip-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(30, 33, 48, 0.85);
  backdrop-filter: blur(8px);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  width: 100%;
  text-align: left;

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

  &--free {
    background: linear-gradient(135deg, rgba(30, 33, 48, 0.9), rgba(20, 23, 38, 0.95));
  }

  &--vip {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
    border-color: rgba(251, 191, 36, 0.3);

    &:hover {
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.15));
      border-color: rgba(251, 191, 36, 0.5);
    }
  }

  &--vvip {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(124, 58, 237, 0.1));
    border-color: rgba(168, 85, 247, 0.3);

    &:hover {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(124, 58, 237, 0.15));
      border-color: rgba(168, 85, 247, 0.5);
    }
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  &__icon-wrapper {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);

    .vip-card--vip & {
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.15));
      border-color: rgba(251, 191, 36, 0.3);
    }

    .vip-card--vvip & {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(124, 58, 237, 0.15));
      border-color: rgba(168, 85, 247, 0.3);
    }
  }

  &__icon {
    width: 22px;
    height: 22px;
    color: rgba(226, 232, 240, 0.7);

    .vip-card--vip & {
      color: #fbbf24;
    }

    .vip-card--vvip & {
      color: #a855f7;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  &__tier {
    font-size: 1rem;
    font-weight: 700;
    color: #f1f5f9;
    line-height: 1.2;
    white-space: nowrap;

    .vip-card--vip & {
      color: #fbbf24;
    }

    .vip-card--vvip & {
      color: #a855f7;
    }
  }

  &__expiry {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: rgba(226, 232, 240, 0.6);
    line-height: 1.2;

    &--warning {
      color: #fbbf24;
    }

    &--urgent {
      color: #ef4444;
      animation: pulse-urgent 2s ease-in-out infinite;
    }
  }

  &__expiry-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  @keyframes pulse-urgent {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  &__action {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  &__button-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(148, 163, 184, 0.8);
    transition: color 0.2s ease;

    .vip-card:hover & {
      color: rgba(226, 232, 240, 0.9);
    }

    .vip-card--vip:hover & {
      color: #fbbf24;
    }

    .vip-card--vvip:hover & {
      color: #a855f7;
    }
  }

  &__arrow {
    width: 20px;
    height: 20px;
    color: rgba(148, 163, 184, 0.6);
    flex-shrink: 0;
    transition: transform 0.2s ease, color 0.2s ease;

    .vip-card:hover & {
      transform: translateX(2px);
      color: rgba(226, 232, 240, 0.9);
    }
  }
}

@media (max-width: 640px) {
  .vip-card {
    padding: 0.85rem 1rem;

    &__icon-wrapper {
      width: 36px;
      height: 36px;
    }

    &__icon {
      width: 20px;
      height: 20px;
    }

    &__tier {
      font-size: 0.9375rem;
    }

    &__expiry {
      font-size: 0.6875rem;
    }

    &__button-text {
      font-size: 0.8125rem;
    }
  }
}
</style>
