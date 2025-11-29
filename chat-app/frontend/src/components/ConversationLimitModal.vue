<script setup lang="ts">
import BaseLimitModal from './BaseLimitModal.vue';

interface Props {
  isOpen: boolean;
  characterName?: string;
  remainingMessages?: number;
  dailyAdLimit?: number;
  adsWatchedToday?: number;
  isUnlocked?: boolean;
  characterUnlockCards?: number;
}

withDefaults(defineProps<Props>(), {
  characterName: '角色',
  remainingMessages: 0,
  dailyAdLimit: 10,
  adsWatchedToday: 0,
  isUnlocked: false,
  characterUnlockCards: 0,
});

interface Emits {
  (e: 'close'): void;
  (e: 'watchAd'): void;
  (e: 'upgrade'): void;
  (e: 'buyUnlockCard'): void;
  (e: 'useUnlockCard'): void;
}

const emit = defineEmits<Emits>();
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
