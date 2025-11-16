<script setup lang="ts">
import BaseLimitModal from './BaseLimitModal.vue';

interface Props {
  isOpen?: boolean;
  used?: number;
  remaining?: number;
  total?: number;
  standardTotal?: number | null;
  isTestAccount?: boolean;
  cards?: number;
  tier?: string;
  resetPeriod?: string;
  photoUnlockCards?: number;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  used: 0,
  remaining: 0,
  total: 0,
  standardTotal: null,
  isTestAccount: false,
  cards: 0,
  tier: 'free',
  resetPeriod: 'lifetime',
  photoUnlockCards: 0,
});

const emit = defineEmits<{
  close: [];
  'purchase-cards': [];
  'upgrade-membership': [];
  buyUnlockCard: [];
  useUnlockCard: [];
}>();
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
