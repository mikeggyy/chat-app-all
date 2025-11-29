<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, type Ref } from 'vue';
import { useRouter } from 'vue-router';

// Chat 組件
import ChatHeader from '../components/chat/ChatHeader.vue';

// Level System
import { useLevel } from '../composables/useLevel';
import ChatContent from '../components/chat/ChatContent.vue';
import ChatModals from '../components/chat/ChatModals.vue';
import VideoCompletionNotification from '../components/chat/VideoCompletionNotification.vue';
import GenerationFailureNotification from '../components/chat/GenerationFailureNotification.vue';

// 統一 Setup Composable
import { useChatSetup } from '../composables/chat/useChatSetup';

// Watchers & Initialization
import { useChatWatchers } from '../composables/chat/useChatWatchers';
import { useChatInitialization } from '../composables/chat/useChatInitialization';

const router = useRouter();

// Local Refs
const draft: Ref<string> = ref('');
const chatContentRef: Ref<{ messageListRef?: any } | null> = ref(null);
const chatPageRef: Ref<HTMLElement | null> = ref(null);

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
  closeCharacterRanking,

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

  // Video Completion Notification
  videoNotification,
  showVideoNotification: _showVideoNotification,
  hideVideoNotification,
  scrollToVideo,

  // Generation Failure Notification
  generationFailures,
  clearGenerationFailure,
  clearAllGenerationFailures: _clearAllGenerationFailures,
  checkForGenerationFailures,
} = useChatSetup({
  router,
  chatContentRef,
  chatPageRef,
  draft,
});

// ====================
// Level System
// ====================
const { fetchCharacterLevel, getCharacterLevel: _getCharacterLevel, updateLocalLevel: _updateLocalLevel } = useLevel();

// 當前角色的等級數據
const currentLevel = ref(1);
const currentLevelProgress = ref(0);

// 加載角色等級
const loadCharacterLevel = async () => {
  if (!partnerId.value) return;
  const levelData = await fetchCharacterLevel(partnerId.value);
  if (levelData) {
    currentLevel.value = levelData.level;
    currentLevelProgress.value = levelData.progress;
  }
};

// 監聽 partnerId 變化來加載等級
watch(partnerId, (newId) => {
  if (newId) {
    loadCharacterLevel();
  }
}, { immediate: true });

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
  // @ts-ignore - useChatSetup 還有 @ts-nocheck，導致類型推斷不正確
  addConversationHistory,
  loadVoiceStats,
  fetchPhotoStats,
  loadBalance,
});

// ====================
// Generation Failure Notification State
// ====================
const currentFailureNotification: Ref<{
  type: 'photo' | 'video';
  characterName: string;
  reason?: string;
} | null> = ref(null);

onMounted(async () => {
  await initializeChat();

  // ✅ 檢查是否有該角色的生成失敗記錄
  if (partnerId.value) {
    const failures = checkForGenerationFailures(partnerId.value);
    if (failures && failures.length > 0) {
      // 顯示第一個失敗通知
      const failure = failures[0];
      currentFailureNotification.value = {
        type: failure.type,
        characterName: failure.characterName,
        reason: failure.reason,
      };
    }
  }
});

// ====================
// Event Handlers (Additional)
// ====================
// 處理關閉失敗通知
const handleCloseFailureNotification = () => {
  if (currentFailureNotification.value && partnerId.value) {
    // 找到並清除對應的失敗記錄
    const failures = checkForGenerationFailures(partnerId.value);
    if (failures && failures.length > 0) {
      // 找到第一個匹配的失敗記錄索引
      const index = generationFailures.value.findIndex(
        f => f.characterId === partnerId.value &&
            f.type === currentFailureNotification.value!.type
      );
      if (index !== -1) {
        clearGenerationFailure(index);
      }
    }
  }
  currentFailureNotification.value = null;
};
const handleCloseGiftSelector = () => {
  closeGiftSelector();
};

// 處理查看影片通知
const handleViewVideo = () => {
  if (videoNotification.value && chatContentRef.value?.messageListRef) {
    scrollToVideo(chatContentRef.value.messageListRef, videoNotification.value.videoMessageId);
    hideVideoNotification();
  }
};

// ====================
// Type conversions for template (null -> undefined)
// ====================
const playingVoiceMessageIdComputed = computed(() => playingVoiceMessageId.value ?? undefined);
const suggestionErrorComputed = computed(() => suggestionError.value ?? undefined);
const partnerComputed = computed(() => partner.value ?? undefined);

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
      :level="currentLevel"
      :level-progress="currentLevelProgress"
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
      :playing-voice-message-id="playingVoiceMessageIdComputed"
      :draft="draft"
      :disabled="isLoadingHistory || isReplying"
      :suggestions="suggestionOptions"
      :is-loading-suggestions="isLoadingSuggestions"
      :suggestion-error="suggestionErrorComputed"
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
      :partner="partnerComputed"
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
      :membership-tier="(user?.membershipTier as 'free' | 'vip' | 'vvip') || 'free'"
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
      @close-gift-selector="handleCloseGiftSelector"
      @select-gift="handleSelectGift"
      @close-character-ranking="closeCharacterRanking"
    />

    <!-- Video Completion Notification -->
    <VideoCompletionNotification
      v-if="videoNotification"
      :is-visible="videoNotification.show"
      :character-name="videoNotification.characterName"
      @view-video="handleViewVideo"
      @close="hideVideoNotification"
    />

    <!-- Generation Failure Notification -->
    <GenerationFailureNotification
      v-if="currentFailureNotification"
      :is-visible="!!currentFailureNotification"
      :type="currentFailureNotification.type"
      :character-name="currentFailureNotification.characterName"
      :reason="currentFailureNotification.reason"
      @close="handleCloseFailureNotification"
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
