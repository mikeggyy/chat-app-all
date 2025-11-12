<template>
  <div class="tier-badge" :class="`tier-badge--${tier}`">
    <SparklesIcon class="tier-icon" aria-hidden="true" />
    <div class="tier-info">
      <span class="tier-name">{{ tierName }}</span>
      <span v-if="isPaidMember && formattedExpiryDate" class="tier-expiry">
        {{ isExpiringSoon ? "即將到期：" : "到期日：" }}{{ formattedExpiryDate }}
        <span v-if="daysUntilExpiry !== null" class="expiry-days"
          >(剩 {{ daysUntilExpiry }} 天)</span
        >
      </span>
    </div>
  </div>
</template>

<script setup>
import { SparklesIcon } from '@heroicons/vue/24/solid';

defineProps({
  tier: {
    type: String,
    default: 'free',
  },
  tierName: {
    type: String,
    default: '免費會員',
  },
  isPaidMember: {
    type: Boolean,
    default: false,
  },
  formattedExpiryDate: {
    type: String,
    default: null,
  },
  daysUntilExpiry: {
    type: Number,
    default: null,
  },
  isExpiringSoon: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
.tier-badge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-radius: 16px;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.05);
}

.tier-badge--vip {
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.2),
    rgba(245, 158, 11, 0.1)
  );
  border-color: rgba(251, 191, 36, 0.4);
}

.tier-badge--vvip {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.2),
    rgba(124, 58, 237, 0.1)
  );
  border-color: rgba(139, 92, 246, 0.4);
}

.tier-icon {
  width: 24px;
  height: 24px;
  color: #94a3b8;
  flex-shrink: 0;
}

.tier-badge--vip .tier-icon {
  color: #fbbf24;
}

.tier-badge--vvip .tier-icon {
  color: #a78bfa;
}

.tier-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.tier-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e2e8f0;
}

.tier-expiry {
  font-size: 0.8rem;
  color: rgba(226, 232, 240, 0.7);
}

.expiry-days {
  color: rgba(251, 191, 36, 0.9);
}
</style>
