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
  usedVoices: {
    type: Number,
    default: 0,
  },
  totalVoices: {
    type: Number,
    default: 10,
  },
  dailyAdLimit: {
    type: Number,
    default: 10,
  },
  adsWatchedToday: {
    type: Number,
    default: 0,
  },
  voiceUnlockCards: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['close', 'watchAd', 'upgrade', 'buyUnlockCard', 'useUnlockCard']);
</script>

<template>
  <BaseLimitModal
    type="voice"
    :is-open="isOpen"
    :character-name="characterName"
    :used-voices="usedVoices"
    :total-voices="totalVoices"
    :daily-ad-limit="dailyAdLimit"
    :ads-watched-today="adsWatchedToday"
    :voice-unlock-cards="voiceUnlockCards"
    @close="emit('close')"
    @watch-ad="emit('watchAd')"
    @upgrade="emit('upgrade')"
    @buy-unlock-card="emit('buyUnlockCard')"
    @use-unlock-card="emit('useUnlockCard')"
  />
</template>
