<script setup>
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

const props = defineProps({
  // Modals state
  modals: {
    type: Object,
    required: true,
  },

  // Partner data
  partnerDisplayName: {
    type: String,
    default: '',
  },
  partnerBackground: {
    type: String,
    default: '',
  },
  partnerId: {
    type: String,
    default: '',
  },
  partner: {
    type: Object,
    default: null,
  },

  // Potion data
  userPotions: {
    type: Object,
    default: () => ({ memoryBoost: 0, brainBoost: 0 }),
  },
  activeMemoryBoost: {
    type: Object,
    default: null,
  },
  activeBrainBoost: {
    type: Object,
    default: null,
  },
  activeCharacterUnlock: {
    type: Object,
    default: null,
  },

  // Cards/Tickets
  characterTickets: {
    type: Number,
    default: 0,
  },
  voiceCards: {
    type: Number,
    default: 0,
  },
  photoCards: {
    type: Number,
    default: 0,
  },
  videoCards: {
    type: Number,
    default: 0,
  },

  // Gift
  showGiftSelector: {
    type: Boolean,
    default: false,
  },
  balance: {
    type: Number,
    default: 0,
  },
  membershipTier: {
    type: String,
    default: 'free',
  },
});

const emit = defineEmits([
  // Reset
  'cancel-reset',
  'confirm-reset',

  // Character Info
  'close-character-info',

  // Potion
  'close-potion-confirm',
  'confirm-use-potion',
  'close-potion-limit',

  // Character Unlock
  'close-unlock-confirm',
  'confirm-unlock-character',
  'close-unlock-limit',

  // Buff Details
  'close-buff-details',

  // Limit Modals
  'close-conversation-limit',
  'watch-ad',
  'use-unlock-card',
  'close-voice-limit',
  'watch-voice-ad',
  'use-voice-unlock-card',
  'close-photo-limit',
  'use-photo-unlock-card',
  'close-video-limit',
  'use-video-unlock-card',
  'upgrade-membership',

  // Photo Selector
  'close-photo-selector',
  'photo-select',

  // Image Viewer
  'close-image-viewer',

  // Gift
  'close-gift-selector',
  'select-gift',
]);

// Methods
const handleCloseGiftSelector = () => {
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
</template>
