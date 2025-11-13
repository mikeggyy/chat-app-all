<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';

// Chat 組件
import ChatHeader from '../components/chat/ChatHeader.vue';
import ChatContent from '../components/chat/ChatContent.vue';
import ChatModals from '../components/chat/ChatModals.vue';

// 統一 Setup Composable
import { useChatSetup } from '../composables/chat/useChatSetup';

// Watchers & Initialization
import { useChatWatchers } from '../composables/chat/useChatWatchers';
import { useChatInitialization } from '../composables/chat/useChatInitialization';

const router = useRouter();

// Local Refs
const draft = ref('');
const chatContentRef = ref(null);
const chatPageRef = ref(null);

// ====================
// Setup All Chat Logic
// ====================
const {
  // Core
  user,
  partnerId,
  partner,
  partnerDisplayName,
  partnerBackground,
  backgroundStyle,
  isFavorited,

  // Messages
  messages,
  isReplying,
  isLoadingHistory,

  // Suggestions
  suggestionOptions,
  isLoadingSuggestions,
  suggestionError,

  // Modals
  modals,

  // Actions
  isRequestingSelfie,
  isSendingGift,
  isRequestingVideo,
  showGiftSelector,
  playingVoiceMessageId,
  isFavoriteMutating,

  // Limits
  photoRemaining,

  // Balance & Tickets
  balance,
  characterTickets,
  hasCharacterTickets,
  voiceCards,
  photoCards,
  videoCards,

  // Potions
  userPotions,
  activeMemoryBoost,
  activeBrainBoost,
  activeCharacterUnlock,

  // Character Status
  isCharacterUnlocked,

  // Event Handlers
  handleBack,
  handleMenuAction,
  toggleFavorite,
  handleViewBuffDetails,
  handlePlayVoice,
  handleImageClick,
  handleSendMessage,
  handleSuggestionClick,
  handleRequestSuggestions,
  handleOpenGiftSelector,
  handleRequestSelfie,
  handleRequestVideo,

  // Modal Handlers
  cancelResetConversation,
  confirmResetConversation,
  closeCharacterInfo,
  closePotionConfirm,
  handleConfirmUsePotion,
  closePotionLimit,
  closeUnlockConfirm,
  handleConfirmUnlockCharacter,
  closeUnlockLimit,
  closeBuffDetails,
  closeConversationLimit,
  handleWatchAd,
  handleUseUnlockCard,
  closeVoiceLimit,
  handleWatchVoiceAd,
  handleUseVoiceUnlockCard,
  closePhotoLimit,
  handleUsePhotoUnlockCard,
  closeVideoLimit,
  handleUseVideoUnlockCard,
  handleUpgradeFromVideoModal,
  closePhotoSelector,
  handlePhotoSelect,
  closeImageViewer,
  closeGiftSelector,
  handleSelectGift,

  // Loaders & Cleanup
  loadPartner,
  loadTicketsBalance,
  loadPotions,
  loadActivePotions,
  loadActiveUnlocks,
  loadHistory,
  loadVoiceStats,
  fetchPhotoStats,
  loadBalance,
  addConversationHistory,
  cleanupMessages,
  invalidateSuggestions,
  resetUnlockDataLoadedState,

  // Dependencies for watchers
  activePotionEffects,
  activeUnlockEffects,
} = useChatSetup({
  router,
  chatContentRef,
  chatPageRef,
  draft,
});

// ====================
// Watchers
// ====================
useChatWatchers({
  partnerId,
  messages,
  resetUnlockDataLoadedState,
  loadPartner,
  invalidateSuggestions,
  activePotionEffects,
  activeUnlockEffects,
});

// ====================
// Initialization
// ====================
const { initializeChat } = useChatInitialization({
  getCurrentUserId: () => user.value?.id || '',
  getPartnerId: () => partnerId.value,
  getPartner: () => partner.value,
  getMessages: () => messages.value,
  getMessageListRef: () => chatContentRef.value?.messageListRef,
  loadPartner,
  loadTicketsBalance,
  loadPotions,
  loadActivePotions,
  loadActiveUnlocks,
  loadHistory,
  addConversationHistory,
  loadVoiceStats,
  fetchPhotoStats,
  loadBalance,
});

onMounted(async () => {
  await initializeChat();
});

// ====================
// Cleanup
// ====================
onBeforeUnmount(() => {
  cleanupMessages();
});
</script>

<template>
  <div ref="chatPageRef" class="chat-page" :style="backgroundStyle">
    <!-- Chat Header -->
    <ChatHeader
      :partner-name="partnerDisplayName"
      :is-resetting-conversation="modals.resetConfirm.loading"
      :is-favorited="isFavorited"
      :is-favorite-mutating="isFavoriteMutating"
      :memory-boost-count="userPotions.memoryBoost"
      :brain-boost-count="userPotions.brainBoost"
      :active-memory-boost="activeMemoryBoost"
      :active-brain-boost="activeBrainBoost"
      :active-character-unlock="activeCharacterUnlock"
      :character-unlock-cards="characterTickets"
      :is-character-unlocked="isCharacterUnlocked"
      @back="handleBack"
      @menu-action="handleMenuAction"
      @toggle-favorite="toggleFavorite"
      @view-buff-details="handleViewBuffDetails"
    />

    <!-- Chat Content (MessageList + MessageInput + UnlockFab) -->
    <ChatContent
      ref="chatContentRef"
      :messages="messages"
      :partner-name="partnerDisplayName"
      :partner-background="partnerBackground"
      :is-replying="isReplying"
      :playing-voice-message-id="playingVoiceMessageId"
      :draft="draft"
      :disabled="isLoadingHistory || isReplying"
      :suggestions="suggestionOptions"
      :is-loading-suggestions="isLoadingSuggestions"
      :suggestion-error="suggestionError"
      :is-sending-gift="isSendingGift"
      :is-requesting-selfie="isRequestingSelfie"
      :is-requesting-video="isRequestingVideo"
      :photo-remaining="photoRemaining"
      :is-character-unlocked="isCharacterUnlocked"
      :has-character-tickets="hasCharacterTickets"
      :character-tickets="characterTickets"
      @play-voice="handlePlayVoice"
      @image-click="handleImageClick"
      @update:draft="draft = $event"
      @send="handleSendMessage"
      @suggestion-click="handleSuggestionClick"
      @request-suggestions="handleRequestSuggestions"
      @gift-click="handleOpenGiftSelector"
      @selfie-click="handleRequestSelfie"
      @video-click="handleRequestVideo"
      @unlock-action="handleMenuAction('unlock-character')"
    />

    <!-- All Modals -->
    <ChatModals
      :modals="modals"
      :partner-display-name="partnerDisplayName"
      :partner-background="partnerBackground"
      :partner-id="partnerId"
      :partner="partner"
      :user-potions="userPotions"
      :active-memory-boost="activeMemoryBoost"
      :active-brain-boost="activeBrainBoost"
      :active-character-unlock="activeCharacterUnlock"
      :character-tickets="characterTickets"
      :voice-cards="voiceCards"
      :photo-cards="photoCards"
      :video-cards="videoCards"
      :show-gift-selector="showGiftSelector"
      :balance="balance"
      :membership-tier="user?.membershipTier || 'free'"
      @cancel-reset="cancelResetConversation"
      @confirm-reset="confirmResetConversation"
      @close-character-info="closeCharacterInfo"
      @close-potion-confirm="closePotionConfirm"
      @confirm-use-potion="handleConfirmUsePotion"
      @close-potion-limit="closePotionLimit"
      @close-unlock-confirm="closeUnlockConfirm"
      @confirm-unlock-character="handleConfirmUnlockCharacter"
      @close-unlock-limit="closeUnlockLimit"
      @close-buff-details="closeBuffDetails"
      @close-conversation-limit="closeConversationLimit"
      @watch-ad="handleWatchAd"
      @use-unlock-card="handleUseUnlockCard"
      @close-voice-limit="closeVoiceLimit"
      @watch-voice-ad="handleWatchVoiceAd"
      @use-voice-unlock-card="handleUseVoiceUnlockCard"
      @close-photo-limit="closePhotoLimit"
      @use-photo-unlock-card="handleUsePhotoUnlockCard"
      @close-video-limit="closeVideoLimit"
      @use-video-unlock-card="handleUseVideoUnlockCard"
      @upgrade-membership="handleUpgradeFromVideoModal"
      @close-photo-selector="closePhotoSelector"
      @photo-select="handlePhotoSelect"
      @close-image-viewer="closeImageViewer"
      @close-gift-selector="closeGiftSelector"
      @select-gift="handleSelectGift"
    />
  </div>
</template>

<style scoped lang="scss">
/* ===================
   Main Container
   =================== */
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  position: relative;
}
</style>
