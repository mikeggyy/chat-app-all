<script setup>
import BaseLimitModal from './BaseLimitModal.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  used: {
    type: Number,
    default: 0,
  },
  remaining: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
  },
  standardTotal: {
    type: Number,
    default: null,
  },
  isTestAccount: {
    type: Boolean,
    default: false,
  },
  cards: {
    type: Number,
    default: 0,
  },
  tier: {
    type: String,
    default: 'free',
  },
  resetPeriod: {
    type: String,
    default: 'lifetime',
  },
  photoUnlockCards: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['close', 'purchase-cards', 'upgrade-membership', 'buyUnlockCard', 'useUnlockCard']);
</script>

<template>
  <BaseLimitModal
    type="photo"
    :is-open="isOpen"
    :used="used"
    :remaining="remaining"
    :total="total"
    :standard-total="standardTotal"
    :is-test-account="isTestAccount"
    :cards="cards"
    :tier="tier"
    :reset-period="resetPeriod"
    :photo-unlock-cards="photoUnlockCards"
    @close="emit('close')"
    @purchase-cards="emit('purchase-cards')"
    @upgrade-membership="emit('upgrade-membership')"
    @buy-unlock-card="emit('buyUnlockCard')"
    @use-unlock-card="emit('useUnlockCard')"
  />
</template>
