<script setup lang="ts">
// Modal Components
import ConversationLimitModal from '../ConversationLimitModal.vue';
import VoiceLimitModal from '../VoiceLimitModal.vue';
import PhotoLimitModal from '../PhotoLimitModal.vue';
import VideoLimitModal from '../VideoLimitModal.vue';
import ImageViewerModal from '../ImageViewerModal.vue';
import GiftSelectorModal from '../GiftSelectorModal.vue';
import GiftAnimation from '../GiftAnimation.vue';
import PotionConfirmModal from '../PotionConfirmModal.vue';
import PotionLimitModal from '../PotionLimitModal.vue';
import CharacterUnlockConfirmModal from '../CharacterUnlockConfirmModal.vue';
import CharacterUnlockLimitModal from '../CharacterUnlockLimitModal.vue';
import PhotoSelectorModal from './PhotoSelectorModal.vue';

// New extracted modals
import ResetConfirmModal from './modals/ResetConfirmModal.vue';
import CharacterInfoModal from './modals/CharacterInfoModal.vue';
import BuffDetailsModal from './modals/BuffDetailsModal.vue';

// Level System Components
import ComboAnimation from '../ComboAnimation.vue';
import LevelUpAnimation from '../LevelUpAnimation.vue';
import CharacterRanking from '../CharacterRanking.vue';

// Types
interface UserPotions {
  memoryBoost: number;
  brainBoost: number;
}

interface ModalState {
  show: boolean;
  [key: string]: any;
}

interface Modals {
  resetConfirm: ModalState & { loading?: boolean };
  characterInfo: ModalState;
  potionConfirm: ModalState & { type?: string };
  potionLimit: ModalState & { type?: string };
  unlockConfirm: ModalState & { loading?: boolean };
  unlockLimit: ModalState;
  buffDetails: ModalState & { type?: string };
  conversationLimit: ModalState & { data: any };
  voiceLimit: ModalState & { data: any };
  photoLimit: ModalState & { data: any };
  videoLimit: ModalState & { data: any };
  photoSelector: ModalState;
  imageViewer: ModalState & { url?: string; alt?: string };
  giftAnimation: ModalState & { emoji?: string; name?: string };
  // Level System
  comboAnimation: ModalState & { comboCount?: number; multiplier?: number; effect?: string | null };
  levelUpAnimation: ModalState & { previousLevel?: number; newLevel?: number; badgeName?: string | null; badgeColor?: string | null };
  characterRanking: ModalState;
  [key: string]: any;
}

interface Props {
  modals: Modals;
  partnerDisplayName?: string;
  partnerBackground?: string;
  partnerId?: string;
  partner?: any;
  userPotions?: UserPotions;
  activeMemoryBoost?: any;
  activeBrainBoost?: any;
  activeCharacterUnlock?: any;
  characterTickets?: number;
  voiceCards?: number;
  photoCards?: number;
  videoCards?: number;
  showGiftSelector?: boolean;
  balance?: number;
  membershipTier?: string;
}

interface Emits {
  (e: 'cancel-reset'): void;
  (e: 'confirm-reset'): void;
  (e: 'close-character-info'): void;
  (e: 'close-potion-confirm'): void;
  (e: 'confirm-use-potion'): void;
  (e: 'close-potion-limit'): void;
  (e: 'close-unlock-confirm'): void;
  (e: 'confirm-unlock-character'): void;
  (e: 'close-unlock-limit'): void;
  (e: 'close-buff-details'): void;
  (e: 'close-conversation-limit'): void;
  (e: 'watch-ad'): void;
  (e: 'use-unlock-card'): void;
  (e: 'close-voice-limit'): void;
  (e: 'watch-voice-ad'): void;
  (e: 'use-voice-unlock-card'): void;
  (e: 'close-photo-limit'): void;
  (e: 'use-photo-unlock-card'): void;
  (e: 'close-video-limit'): void;
  (e: 'use-video-unlock-card'): void;
  (e: 'upgrade-membership'): void;
  (e: 'close-photo-selector'): void;
  (e: 'photo-select', value: any): void;
  (e: 'close-image-viewer'): void;
  (e: 'close-gift-selector'): void;
  (e: 'select-gift', value: any): void;
  // Level System
  (e: 'combo-animation-complete'): void;
  (e: 'levelup-animation-complete'): void;
  (e: 'close-character-ranking'): void;
}

withDefaults(defineProps<Props>(), {
  partnerDisplayName: '',
  partnerBackground: '',
  partnerId: '',
  partner: null,
  userPotions: () => ({ memoryBoost: 0, brainBoost: 0 }),
  activeMemoryBoost: null,
  activeBrainBoost: null,
  activeCharacterUnlock: null,
  characterTickets: 0,
  voiceCards: 0,
  photoCards: 0,
  videoCards: 0,
  showGiftSelector: false,
  balance: 0,
  membershipTier: 'free',
});

const emit = defineEmits<Emits>();

// Methods
const handleCloseGiftSelector = (): void => {
  emit('close-gift-selector');
};
</script>

<template>
  <!-- Reset Confirmation -->
  <ResetConfirmModal
    :is-open="modals.resetConfirm.show"
    :loading="modals.resetConfirm.loading"
    @cancel="emit('cancel-reset')"
    @confirm="emit('confirm-reset')"
  />

  <!-- Character Info -->
  <CharacterInfoModal
    :is-open="modals.characterInfo.show"
    :character-name="partnerDisplayName"
    :background="partnerBackground"
    @close="emit('close-character-info')"
  />

  <!-- Potion Confirmation Modal -->
  <PotionConfirmModal
    :is-open="modals.potionConfirm.show"
    :potion-type="modals.potionConfirm.type"
    :character-name="partnerDisplayName"
    :remaining-count="
      modals.potionConfirm.type === 'memoryBoost' ? userPotions.memoryBoost : userPotions.brainBoost
    "
    @close="emit('close-potion-confirm')"
    @confirm="emit('confirm-use-potion')"
  />

  <!-- Potion Limit Modal -->
  <PotionLimitModal
    :is-open="modals.potionLimit.show"
    :potion-type="modals.potionLimit.type"
    :character-name="partnerDisplayName"
    @close="emit('close-potion-limit')"
  />

  <!-- Character Unlock Confirm Modal -->
  <CharacterUnlockConfirmModal
    :is-open="modals.unlockConfirm.show"
    :character-name="partnerDisplayName"
    :remaining-cards="characterTickets"
    :is-using="modals.unlockConfirm.loading"
    @close="emit('close-unlock-confirm')"
    @confirm="emit('confirm-unlock-character')"
  />

  <!-- Character Unlock Limit Modal -->
  <CharacterUnlockLimitModal
    :is-open="modals.unlockLimit.show"
    :character-name="partnerDisplayName"
    @close="emit('close-unlock-limit')"
  />

  <!-- Buff Details Modal -->
  <BuffDetailsModal
    :is-open="modals.buffDetails.show"
    :buff-type="modals.buffDetails.type"
    :character-name="partnerDisplayName"
    :active-memory-boost="activeMemoryBoost"
    :active-brain-boost="activeBrainBoost"
    :active-character-unlock="activeCharacterUnlock"
    @close="emit('close-buff-details')"
  />

  <!-- Conversation Limit Modal -->
  <ConversationLimitModal
    :is-open="modals.conversationLimit.show"
    :character-name="modals.conversationLimit.data.characterName"
    :remaining-messages="modals.conversationLimit.data.remainingMessages"
    :daily-ad-limit="modals.conversationLimit.data.dailyAdLimit"
    :ads-watched-today="modals.conversationLimit.data.adsWatchedToday"
    :is-unlocked="modals.conversationLimit.data.isUnlocked"
    :character-unlock-cards="characterTickets"
    @close="emit('close-conversation-limit')"
    @watch-ad="emit('watch-ad')"
    @use-unlock-card="emit('use-unlock-card')"
  />

  <!-- Voice Limit Modal -->
  <VoiceLimitModal
    :is-open="modals.voiceLimit.show"
    :character-name="modals.voiceLimit.data.characterName"
    :used-voices="modals.voiceLimit.data.usedVoices"
    :total-voices="modals.voiceLimit.data.totalVoices"
    :daily-ad-limit="modals.voiceLimit.data.dailyAdLimit"
    :ads-watched-today="modals.voiceLimit.data.adsWatchedToday"
    :voice-unlock-cards="voiceCards"
    @close="emit('close-voice-limit')"
    @watch-ad="emit('watch-voice-ad')"
    @use-unlock-card="emit('use-voice-unlock-card')"
  />

  <!-- Photo Limit Modal -->
  <PhotoLimitModal
    :is-open="modals.photoLimit.show"
    :used="modals.photoLimit.data.used"
    :remaining="modals.photoLimit.data.remaining"
    :total="modals.photoLimit.data.total"
    :standard-total="modals.photoLimit.data.standardTotal"
    :is-test-account="modals.photoLimit.data.isTestAccount"
    :cards="modals.photoLimit.data.cards"
    :tier="modals.photoLimit.data.tier"
    :reset-period="modals.photoLimit.data.resetPeriod"
    :photo-unlock-cards="photoCards"
    @close="emit('close-photo-limit')"
    @use-unlock-card="emit('use-photo-unlock-card')"
    @upgrade-membership="emit('upgrade-membership')"
  />

  <!-- Video Limit Modal -->
  <VideoLimitModal
    :is-open="modals.videoLimit.show"
    :used="modals.videoLimit.data.used"
    :remaining="modals.videoLimit.data.remaining"
    :total="modals.videoLimit.data.total"
    :standard-total="modals.videoLimit.data.standardTotal"
    :is-test-account="modals.videoLimit.data.isTestAccount"
    :cards="modals.videoLimit.data.cards"
    :tier="modals.videoLimit.data.tier"
    :reset-period="modals.videoLimit.data.resetPeriod"
    :video-unlock-cards="videoCards"
    @close="emit('close-video-limit')"
    @use-unlock-card="emit('use-video-unlock-card')"
    @upgrade-membership="emit('upgrade-membership')"
  />

  <!-- Photo Selector Modal -->
  <PhotoSelectorModal
    :is-open="modals.photoSelector.show"
    :character-id="partnerId"
    :character-photo-url="
      partner?.photoUrl || partner?.avatarUrl || partner?.imageUrl || partner?.portraitUrl || ''
    "
    @close="emit('close-photo-selector')"
    @select="emit('photo-select', $event)"
  />

  <!-- Image Viewer Modal -->
  <ImageViewerModal
    :is-open="modals.imageViewer.show"
    :image-url="modals.imageViewer.url"
    :image-alt="modals.imageViewer.alt"
    @close="emit('close-image-viewer')"
  />

  <!-- Gift Selector Modal -->
  <GiftSelectorModal
    :is-open="showGiftSelector"
    :character-name="partnerDisplayName"
    :balance="balance"
    :membership-tier="membershipTier"
    @close="handleCloseGiftSelector"
    @select="emit('select-gift', $event)"
  />

  <!-- Gift Animation -->
  <GiftAnimation
    :show="modals.giftAnimation.show"
    :gift-emoji="modals.giftAnimation.emoji"
    :gift-name="modals.giftAnimation.name"
  />

  <!-- Level System: Combo Animation -->
  <ComboAnimation
    :show="modals.comboAnimation.show"
    :combo-count="modals.comboAnimation.comboCount"
    :multiplier="modals.comboAnimation.multiplier"
    :effect="modals.comboAnimation.effect"
    @complete="emit('combo-animation-complete')"
  />

  <!-- Level System: Level Up Animation -->
  <LevelUpAnimation
    :show="modals.levelUpAnimation.show"
    :previous-level="modals.levelUpAnimation.previousLevel"
    :new-level="modals.levelUpAnimation.newLevel"
    :badge-name="modals.levelUpAnimation.badgeName"
    :badge-color="modals.levelUpAnimation.badgeColor"
    @complete="emit('levelup-animation-complete')"
  />

  <!-- Level System: Character Ranking -->
  <CharacterRanking
    :character-id="partnerId"
    :character-name="partnerDisplayName"
    :show="modals.characterRanking.show"
    @close="emit('close-character-ranking')"
  />
</template>
