<script setup>
import BaseLimitModal from './BaseLimitModal.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  characterName: {
    type: String,
    default: '角色',
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
  videoUnlockCards: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['close', 'upgrade', 'buyUnlockCard', 'useUnlockCard', 'purchase-cards', 'upgrade-membership']);
</script>

<template>
  <BaseLimitModal
    type="video"
    :is-open="isOpen"
    :character-name="characterName"
    :used="used"
    :remaining="remaining"
    :total="total"
    :standard-total="standardTotal"
    :is-test-account="isTestAccount"
    :cards="cards"
    :tier="tier"
    :reset-period="resetPeriod"
    :video-unlock-cards="videoUnlockCards"
    @close="emit('close')"
    @upgrade="emit('upgrade')"
    @buy-unlock-card="emit('buyUnlockCard')"
    @use-unlock-card="emit('useUnlockCard')"
    @purchase-cards="emit('purchase-cards')"
    @upgrade-membership="emit('upgrade-membership')"
  />
</template>
