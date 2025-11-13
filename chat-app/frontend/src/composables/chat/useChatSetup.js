/**
 * Chat 頁面統一設置 Composable
 * 整合所有 Chat 相關的 composables，簡化 ChatView.vue
 */

import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

// Core Composables
import { useUserProfile } from '../useUserProfile';
import { useFirebaseAuth } from '../useFirebaseAuth';
import { useConversationLimit } from '../useConversationLimit';
import { useVoiceLimit } from '../useVoiceLimit';
import { usePhotoLimit } from '../usePhotoLimit';
import { useToast } from '../useToast';
import { useGuestGuard } from '../useGuestGuard';
import { useCoins } from '../useCoins';
import { useUnlockTickets } from '../useUnlockTickets';

// Chat Composables
import { useChatMessages } from './useChatMessages';
import { useSuggestions } from './useSuggestions';
import { useChatActions } from './useChatActions';
import { useModalManager } from './useModalManager';
import { useVideoGeneration } from './useVideoGeneration';
import { usePotionManagement } from './usePotionManagement';
import { useSelfieGeneration } from './useSelfieGeneration';
import { useCharacterUnlock } from './useCharacterUnlock';
import { useVoiceManagement } from './useVoiceManagement';
import { useConversationLimitActions } from './useConversationLimitActions';
import { useGiftManagement } from './useGiftManagement';
import { useFavoriteManagement } from './useFavoriteManagement';
import { useShareFunctionality } from './useShareFunctionality';
import { useConversationReset } from './useConversationReset';
import { usePhotoVideoHandler } from './usePhotoVideoHandler';
import { usePartner } from './usePartner';
import { useMenuActions } from './useMenuActions';
import { useSendMessage } from './useSendMessage';
import { useEventHandlers } from './useEventHandlers';

// Utils
import { appendCachedHistory } from '../../utils/conversationCache';
import {
  rollbackUserMessage,
  createLimitModalData,
} from '../../utils/chat/chatHelpers';

// Config
import {
  MESSAGE_ID_PREFIXES,
  VIDEO_REQUEST_MESSAGES,
  VIDEO_CONFIG,
  AI_VIDEO_RESPONSE_TEXT,
} from '../../config/chat/constants';

/**
 * 設置所有 Chat 相關的 composables
 * @param {Object} options - 設置選項
 * @param {Object} options.router - Vue Router 實例
 * @param {Ref} options.chatContentRef - ChatContent 組件引用
 * @param {Ref} options.chatPageRef - Chat 頁面引用
 * @param {Ref} options.draft - 消息草稿
 * @returns {Object} 所有 Chat 相關的狀態和方法
 */
export function useChatSetup({ router, chatContentRef, chatPageRef, draft }) {
  const route = useRoute();

  // ====================
  // Core Services
  // ====================
  const { user, setUserProfile, addConversationHistory } = useUserProfile();
  const firebaseAuth = useFirebaseAuth();
  const { success, error: showError } = useToast();

  // Partner Data
  const partnerId = computed(() => route.params.id);
  const {
    partner,
    partnerDisplayName,
    partnerBackground,
    backgroundStyle,
    loadPartner,
  } = usePartner({ partnerId });

  const currentUserId = computed(() => user.value?.id || '');

  // Favorite State
  const isFavorited = computed(() => {
    const favoritesList = Array.isArray(user.value?.favorites)
      ? user.value.favorites
      : [];
    return favoritesList.includes(partnerId.value);
  });

  // ====================
  // Limits
  // ====================
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

  // ====================
  // Guest & Balance
  // ====================
  const {
    isGuest,
    requireLogin,
    canGuestSendMessage,
    incrementGuestMessageCount,
    guestRemainingMessages,
  } = useGuestGuard();

  const { balance, loadBalance } = useCoins();

  const {
    loadBalance: loadTicketsBalance,
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,
    createCards,
  } = useUnlockTickets();

  // ====================
  // Chat Messages
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
  // Suggestions
  // ====================
  const {
    suggestionOptions,
    isLoadingSuggestions,
    suggestionError,
    loadSuggestions,
    invalidateSuggestions,
  } = useSuggestions(messages, partner, firebaseAuth, currentUserId);

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
  // Chat Actions
  // ====================
  const {
    isRequestingSelfie,
    requestSelfie,
    showGiftSelector,
    isSendingGift,
    openGiftSelector,
    closeGiftSelector,
    sendGift,
    playingVoiceMessageId,
    playVoice,
  } = useChatActions({
    messages,
    partner,
    currentUserId,
    firebaseAuth,
    toast: { success, error: showError },
    requireLogin,
    scrollToBottom: () => chatContentRef.value?.messageListRef?.scrollToBottom(),
    appendCachedHistory: (entries) => {
      const matchId = partner.value?.id ?? '';
      const userId = currentUserId.value ?? '';
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
    messageListRef: computed(() => chatContentRef.value?.messageListRef),
    rollbackUserMessage: (userId, matchId, messageId) =>
      rollbackUserMessage({
        userId,
        matchId,
        messageId,
        firebaseAuth,
        messages,
        showError,
      }),
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
    messageListRef: computed(() => chatContentRef.value?.messageListRef),
    rollbackUserMessage: (userId, matchId, messageId) =>
      rollbackUserMessage({
        userId,
        matchId,
        messageId,
        firebaseAuth,
        messages,
        showError,
      }),
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
  // Character Unlock
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
  // Send Message Handler
  // ====================
  const { handleSendMessage } = useSendMessage({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partner.value?.id,
    getPartnerDisplayName: () => partnerDisplayName.value,
    getDraft: () => draft.value,
    setDraft: (value) => { draft.value = value; },
    getMessageInputRef: () => chatContentRef.value?.messageInputRef,
    getCharacterTickets: () => characterTickets.value,
    isGuest,
    canGuestSendMessage,
    requireLogin,
    incrementGuestMessageCount,
    checkLimit,
    showConversationLimit,
    sendMessageToApi,
    invalidateSuggestions,
    showError,
  });

  // ====================
  // Event Handlers
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
  // Menu Actions
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
  // 返回所有需要的狀態和方法
  // ====================
  return {
    // Core
    user,
    partnerId,
    partner,
    partnerDisplayName,
    partnerBackground,
    backgroundStyle,
    currentUserId,
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
  };
}
