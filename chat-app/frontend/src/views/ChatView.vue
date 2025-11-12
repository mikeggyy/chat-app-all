<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";
import { useRoute, useRouter } from "vue-router";

// Chat 組件
import ChatHeader from "../components/chat/ChatHeader.vue";
import MessageList from "../components/chat/MessageList.vue";
import MessageInput from "../components/chat/MessageInput.vue";
import ChatModals from "../components/chat/ChatModals.vue";
import UnlockFab from "../components/chat/UnlockFab.vue";

// Composables
import { useUserProfile } from "../composables/useUserProfile";
import { useFirebaseAuth } from "../composables/useFirebaseAuth";
import { useConversationLimit } from "../composables/useConversationLimit";
import { useVoiceLimit } from "../composables/useVoiceLimit";
import { usePhotoLimit } from "../composables/usePhotoLimit";
import { useToast } from "../composables/useToast";
import { useGuestGuard } from "../composables/useGuestGuard";
import { useCoins } from "../composables/useCoins";
import { useUnlockTickets } from "../composables/useUnlockTickets";

// 新的 Chat Composables
import { useChatMessages } from "../composables/chat/useChatMessages";
import { useSuggestions } from "../composables/chat/useSuggestions";
import { useChatActions } from "../composables/chat/useChatActions";
import { useModalManager } from "../composables/chat/useModalManager";
import { useVideoGeneration } from "../composables/chat/useVideoGeneration";
import { usePotionManagement } from "../composables/chat/usePotionManagement";
import { useSelfieGeneration } from "../composables/chat/useSelfieGeneration";
import { useCharacterUnlock } from "../composables/chat/useCharacterUnlock";
import { useVoiceManagement } from "../composables/chat/useVoiceManagement";
import { useConversationLimitActions } from "../composables/chat/useConversationLimitActions";
import { useGiftManagement } from "../composables/chat/useGiftManagement";
import { useFavoriteManagement } from "../composables/chat/useFavoriteManagement";
import { useShareFunctionality } from "../composables/chat/useShareFunctionality";
import { useConversationReset } from "../composables/chat/useConversationReset";
import { usePhotoVideoHandler } from "../composables/chat/usePhotoVideoHandler";
import { usePartner } from "../composables/chat/usePartner";
import { useMenuActions } from "../composables/chat/useMenuActions";
import { useChatInitialization } from "../composables/chat/useChatInitialization";
import { useEventHandlers } from "../composables/chat/useEventHandlers";
import { useChatWatchers } from "../composables/chat/useChatWatchers";

// Utils
import { appendCachedHistory } from "../utils/conversationCache";
import {
  rollbackUserMessage as rollbackUserMessageHelper,
  createLimitModalData as createLimitModalDataHelper,
  getConversationContext as getConversationContextHelper,
} from "../utils/chat/chatHelpers";

// Config
import { MESSAGE_ID_PREFIXES, VIDEO_REQUEST_MESSAGES, VIDEO_CONFIG, AI_VIDEO_RESPONSE_TEXT } from "../config/chat/constants";

const router = useRouter();
const route = useRoute();

// ====================
// User & Auth
// ====================
const { user, setUserProfile, addConversationHistory } = useUserProfile();
const firebaseAuth = useFirebaseAuth();
const { success, error: showError } = useToast();

// Favorite State
const isFavorited = computed(() => {
  const favoritesList = Array.isArray(user.value?.favorites)
    ? user.value.favorites
    : [];
  return favoritesList.includes(partnerId.value);
});

// Limits
const { checkLimit, unlockByAd, getLimitState } = useConversationLimit();
const {
  checkVoiceLimit,
  unlockByAd: unlockVoiceByAd,
  loadVoiceStats,
} = useVoiceLimit();
const {
  fetchPhotoStats,
  canGeneratePhoto,
  remaining: photoRemaining,
} = usePhotoLimit();

// Guest Guard
const {
  isGuest,
  requireLogin,
  canGuestSendMessage,
  incrementGuestMessageCount,
  guestRemainingMessages,
} = useGuestGuard();

// Coins
const { balance, loadBalance } = useCoins();

// Unlock Tickets
const {
  loadBalance: loadTicketsBalance,
  characterTickets,
  hasCharacterTickets,
  voiceCards,
  photoCards,
  videoCards,
  createCards,
} = useUnlockTickets();

// Partner Data (使用 usePartner composable)
const partnerId = computed(() => route.params.id);
const {
  partner,
  partnerDisplayName,
  partnerBackground,
  backgroundStyle,
  loadPartner,
} = usePartner({ partnerId });

// Chat Page Ref (用於截圖)
const chatPageRef = ref(null);

// Current User ID
const currentUserId = computed(() => user.value?.id || "");

// ====================
// Chat Messages (useChatMessages)
// ====================
const {
  messages,
  isReplying,
  isLoadingHistory,
  loadHistory,
  sendMessage: sendMessageToApi,
  requestReply,
  resetConversation: resetConversationApi,
  cleanup: cleanupMessages,
} = useChatMessages(partnerId);

// ====================
// Suggestions (useSuggestions)
// ====================
const {
  suggestionOptions,
  isLoadingSuggestions,
  suggestionError,
  loadSuggestions,
  invalidateSuggestions,
} = useSuggestions(messages, partner, firebaseAuth, currentUserId);

// ====================
// Chat Actions (useChatActions)
// ====================
const {
  // Selfie
  isRequestingSelfie,
  requestSelfie,

  // Gift
  showGiftSelector,
  isSendingGift,
  openGiftSelector,
  closeGiftSelector,
  sendGift,

  // Voice
  playingVoiceMessageId,
  playVoice,
} = useChatActions({
  messages,
  partner,
  currentUserId,
  firebaseAuth,
  toast: { success, error: showError },
  requireLogin,
  scrollToBottom: () => messageListRef.value?.scrollToBottom(),
  appendCachedHistory: (entries) => {
    const matchId = partner.value?.id ?? "";
    const userId = currentUserId.value ?? "";
    if (!matchId || !userId) return;
    appendCachedHistory(userId, matchId, entries);
  },
});

// ====================
// Video Generation
// ====================
const {
  isRequestingVideo,
  generateVideo,
  handleRequestVideo,
} = useVideoGeneration({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partner.value?.id,
  getFirebaseAuth: () => firebaseAuth,
  messages,
  messageListRef,
  rollbackUserMessage,
  requireLogin,
  showVideoLimit,
  showPhotoSelector,
  createLimitModalData,
  showError,
  showSuccess: success,
  config: {
    MESSAGE_ID_PREFIXES,
    VIDEO_CONFIG,
    AI_VIDEO_RESPONSE_TEXT,
    VIDEO_REQUEST_MESSAGES,
  },
});

// ====================
// Local State
// ====================
const draft = ref("");
const messageListRef = ref(null);
const messageInputRef = ref(null);

// ====================
// Modal Manager
// ====================
const {
  modals,
  showConversationLimit,
  closeConversationLimit,
  showVoiceLimit,
  closeVoiceLimit,
  showPhotoLimit,
  closePhotoLimit,
  showVideoLimit,
  closeVideoLimit,
  showPotionLimit,
  closePotionLimit,
  showUnlockLimit,
  closeUnlockLimit,
  showResetConfirm,
  closeResetConfirm,
  showPotionConfirm,
  closePotionConfirm,
  showUnlockConfirm,
  closeUnlockConfirm,
  showPhotoSelector,
  closePhotoSelector,
  showImageViewer,
  closeImageViewer,
  showCharacterInfo,
  closeCharacterInfo,
  showBuffDetails,
  closeBuffDetails,
  showGiftAnimation,
  closeGiftAnimation,
  setLoading,
  update: updateModal,
} = useModalManager();

// ====================
// Potion Management
// ====================
const {
  userPotions,
  activePotionEffects,
  activeMemoryBoost,
  activeBrainBoost,
  loadPotions,
  loadActivePotions,
  handleConfirmUsePotion,
} = usePotionManagement({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getPotionType: () => modals.potionConfirm.type,
  closePotionConfirm,
  setLoading,
  showError,
  showSuccess: success,
});

// ====================
// Selfie Generation
// ====================
const {
  handleRequestSelfie,
  handleUsePhotoUnlockCard,
} = useSelfieGeneration({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getFirebaseAuth: () => firebaseAuth,
  messages,
  messageListRef,
  rollbackUserMessage,
  requireLogin,
  canGeneratePhoto,
  fetchPhotoStats,
  showPhotoLimit,
  createLimitModalData,
  requestSelfie,
  closePhotoLimit,
  loadTicketsBalance,
  showError,
  showSuccess: success,
  config: {
    MESSAGE_ID_PREFIXES,
  },
});

// ====================
// Character Unlock Management
// ====================
const {
  activeUnlockEffects,
  activeCharacterUnlock,
  isCharacterUnlocked,
  loadActiveUnlocks,
  handleConfirmUnlockCharacter,
  resetUnlockDataLoadedState,
} = useCharacterUnlock({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getFirebaseAuth: () => firebaseAuth,
  getPartnerDisplayName: () => partnerDisplayName.value,
  closeUnlockConfirm,
  loadTicketsBalance,
  setLoading,
  showError,
  showSuccess: success,
});

// ====================
// Voice Management
// ====================
const {
  handlePlayVoice,
  handleWatchVoiceAd: watchVoiceAd,
  handleUseVoiceUnlockCard,
} = useVoiceManagement({
  getCurrentUserId: () => currentUserId.value,
  playVoice,
  loadVoiceStats,
  checkVoiceLimit,
  unlockVoiceByAd,
  loadTicketsBalance,
  showVoiceLimit,
  closeVoiceLimit,
  getVoiceLimitPendingMessage: () => modals.voiceLimit.pending,
  showError,
  showSuccess: success,
});

// ====================
// Conversation Limit Actions
// ====================
const {
  handleWatchAd,
  handleUseUnlockCard,
} = useConversationLimitActions({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partner.value?.id,
  getPartnerDisplayName: () => partnerDisplayName.value,
  getFirebaseAuth: () => firebaseAuth,
  unlockByAd,
  getLimitState,
  loadTicketsBalance,
  closeConversationLimit,
  updateModal,
  showError,
  showSuccess: success,
});

// ====================
// Gift Management
// ====================
const {
  handleOpenGiftSelector,
  handleSelectGift,
} = useGiftManagement({
  getCurrentUserId: () => currentUserId.value,
  openGiftSelector,
  sendGift,
  loadBalance,
  showGiftAnimation,
  closeGiftAnimation,
});

// ====================
// Favorite Management
// ====================
const {
  isFavoriteMutating,
  toggleFavorite,
} = useFavoriteManagement({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getUser: () => user.value,
  getFirebaseAuth: () => firebaseAuth,
  setUserProfile,
  requireLogin,
  showError,
  showSuccess: success,
});

// ====================
// Share Functionality
// ====================
const {
  handleShare,
} = useShareFunctionality({
  getChatPageRef: () => chatPageRef.value,
  getPartnerDisplayName: () => partnerDisplayName.value,
  showError,
  showSuccess: success,
});

// ====================
// Conversation Reset
// ====================
const {
  confirmResetConversation,
  cancelResetConversation,
} = useConversationReset({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partner.value?.id,
  getPartner: () => partner.value,
  getMessages: () => messages.value,
  getDraft: () => draft.value,
  setDraft: (value) => { draft.value = value; },
  resetConversationApi,
  invalidateSuggestions,
  closeResetConfirm,
  setLoading,
  showError,
  showSuccess: success,
  config: { MESSAGE_ID_PREFIXES },
});

// ====================
// Photo Video Handler
// ====================
const {
  handlePhotoSelect,
  handleUseVideoUnlockCard,
  handleUpgradeFromVideoModal,
} = usePhotoVideoHandler({
  getCurrentUserId: () => currentUserId.value,
  getPhotoSelectorModal: () => modals.photoSelector,
  generateVideo,
  loadTicketsBalance,
  closePhotoSelector,
  closeVideoLimit,
  showPhotoSelector,
  navigateToMembership: () => router.push('/membership'),
  showError,
});

// ====================
// Conversation Context
// ====================
const getConversationContext = () => {
  return getConversationContextHelper({
    matchId: partner.value?.id,
    currentUserId: currentUserId.value,
  });
};

// ====================
// Helper Functions
// ====================

/**
 * 撤回用戶消息（從後端和前端同時刪除）
 * 使用抽取的 helper 函數
 */
const rollbackUserMessage = async (userId, matchId, messageId) => {
  return rollbackUserMessageHelper({
    userId,
    matchId,
    messageId,
    firebaseAuth,
    messages,
    showError,
  });
};

/**
 * 創建限制 Modal 的數據結構
 * 使用抽取的 helper 函數
 */
const createLimitModalData = (limitCheck, type = "photo") => {
  return createLimitModalDataHelper(limitCheck, type);
};

// ====================
// Send Message Handler
// ====================
const handleSendMessage = async (text) => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId || !text) return;

  // Guest message limit check
  if (isGuest.value && !canGuestSendMessage.value) {
    requireLogin({ feature: "發送訊息" });
    return;
  }

  // Check conversation limit
  const limitCheck = await checkLimit(userId, matchId);
  if (!limitCheck.allowed) {
    showConversationLimit({
      characterName: partnerDisplayName.value,
      remainingMessages: limitCheck.remaining || 0,
      dailyAdLimit: limitCheck.dailyAdLimit || 10,
      adsWatchedToday: limitCheck.adsWatchedToday || 0,
      isUnlocked: limitCheck.isUnlocked || false,
      characterUnlockCards: characterTickets.value || 0,
    });
    return;
  }

  // Clear draft immediately
  draft.value = "";

  try {
    // Send message (sendMessage only takes text parameter)
    await sendMessageToApi(text);

    // Invalidate suggestions
    invalidateSuggestions();

    // Increment guest message count
    if (isGuest.value) {
      incrementGuestMessageCount();
    }

    // Focus input
    await nextTick();
    messageInputRef.value?.focus();
  } catch (error) {
    showError(error instanceof Error ? error.message : "發送消息失敗");
  }
};

// ====================
// Event Handlers (使用 useEventHandlers composable)
// ====================
const {
  handleImageClick,
  handleViewBuffDetails,
  handleBack,
  handleWatchVoiceAd,
  handleSuggestionClick,
  handleRequestSuggestions,
} = useEventHandlers({
  showImageViewer,
  showBuffDetails,
  router,
  watchVoiceAd,
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partner.value?.id,
  loadSuggestions,
  handleSendMessage,
});

// ====================
// Menu Action Handler (使用 useMenuActions composable)
// ====================
const { handleMenuAction } = useMenuActions({
  modals: {
    showResetConfirm,
    showCharacterInfo,
    showUnlockLimit,
    showUnlockConfirm,
    showPotionLimit,
    showPotionConfirm,
  },
  userPotions,
  unlockTickets: {
    hasCharacterTickets: computed(() => hasCharacterTickets.value),
    characterTickets: computed(() => characterTickets.value),
  },
  handleShare,
});

// ====================
// Watchers (使用 useChatWatchers composable)
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
// Initialization (使用 useChatInitialization composable)
// ====================
const { initializeChat } = useChatInitialization({
  // Getters
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getPartner: () => partner.value,
  getMessages: () => messages.value,
  getMessageListRef: () => messageListRef.value,

  // Loaders
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

    <!-- Message List -->
    <MessageList
      ref="messageListRef"
      :messages="messages"
      :partner-name="partnerDisplayName"
      :partner-background="partnerBackground"
      :is-replying="isReplying"
      :playing-voice-message-id="playingVoiceMessageId"
      @play-voice="handlePlayVoice"
      @image-click="handleImageClick"
    />

    <!-- Message Input -->
    <MessageInput
      ref="messageInputRef"
      v-model="draft"
      :disabled="isLoadingHistory || isReplying"
      :suggestions="suggestionOptions"
      :is-loading-suggestions="isLoadingSuggestions"
      :suggestion-error="suggestionError"
      :is-sending-gift="isSendingGift"
      :is-requesting-selfie="isRequestingSelfie"
      :is-requesting-video="isRequestingVideo"
      :photo-remaining="photoRemaining"
      @send="handleSendMessage"
      @suggestion-click="handleSuggestionClick"
      @request-suggestions="handleRequestSuggestions"
      @gift-click="handleOpenGiftSelector"
      @selfie-click="handleRequestSelfie"
      @video-click="handleRequestVideo"
    />

    <!-- 快速解鎖角色懸浮按鈕 -->
    <UnlockFab
      :is-character-unlocked="isCharacterUnlocked"
      :has-character-tickets="hasCharacterTickets"
      :character-tickets="characterTickets"
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
