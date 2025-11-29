<script setup lang="ts">
import BaseLimitModal from './BaseLimitModal.vue';

interface Props {
  isOpen: boolean;
  characterName?: string;
  used?: number;
  remaining?: number;
  total?: number;
  standardTotal?: number | null;
  isTestAccount?: boolean;
  cards?: number;
  tier?: string;
  resetPeriod?: string;
  videoUnlockCards?: number;
}

withDefaults(defineProps<Props>(), {
  characterName: '角色',
  used: 0,
  remaining: 0,
  total: 0,
  standardTotal: null,
  isTestAccount: false,
  cards: 0,
  tier: 'free',
  resetPeriod: 'lifetime',
  videoUnlockCards: 0,
});

const emit = defineEmits<{
  close: [];
  upgrade: [];
  buyUnlockCard: [];
  useUnlockCard: [];
  'purchase-cards': [];
  'upgrade-membership': [];
}>();
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
