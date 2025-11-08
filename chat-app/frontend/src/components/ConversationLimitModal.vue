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
  remainingMessages: {
    type: Number,
    default: 0,
  },
  dailyAdLimit: {
    type: Number,
    default: 10,
  },
  adsWatchedToday: {
    type: Number,
    default: 0,
  },
  isUnlocked: {
    type: Boolean,
    default: false,
  },
  characterUnlockCards: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['close', 'watchAd', 'upgrade', 'buyUnlockCard', 'useUnlockCard']);
</script>

<template>
  <BaseLimitModal
    type="conversation"
    :is-open="isOpen"
    :character-name="characterName"
    :remaining-messages="remainingMessages"
    :daily-ad-limit="dailyAdLimit"
    :ads-watched-today="adsWatchedToday"
    :is-unlocked="isUnlocked"
    :character-unlock-cards="characterUnlockCards"
    @close="emit('close')"
    @watch-ad="emit('watchAd')"
    @upgrade="emit('upgrade')"
    @buy-unlock-card="emit('buyUnlockCard')"
    @use-unlock-card="emit('useUnlockCard')"
  />
</template>
