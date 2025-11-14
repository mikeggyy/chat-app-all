/**
 * Chat 頁面統一設置 Composable
 * 整合所有 Chat 相關的 composables，簡化 ChatView.vue
 *
 * 架構：使用模組化設計，將不同關注點分離到獨立模組
 */

// Modular Setup Composables
import { useChatCore } from './setup/useChatCore';
import { useChatLimits } from './setup/useChatLimits';
import { useChatModals } from './setup/useChatModals';
import { useChatFeatures } from './setup/useChatFeatures';
import { useChatHandlers } from './setup/useChatHandlers';

// Utils
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
  // ====================
  // 1. Core Services (核心服務)
  // ====================
  const core = useChatCore();
  const {
    user,
    partnerId,
    partner,
    partnerDisplayName,
    partnerBackground,
    backgroundStyle,
    currentUserId,
    isFavorited,
    firebaseAuth,
    messages,
    isReplying,
    isLoadingHistory,
    suggestionOptions,
    isLoadingSuggestions,
    suggestionError,
    success,
    showError,
    setUserProfile,
    addConversationHistory,
    loadPartner,
    loadHistory,
    sendMessageToApi,
    requestReply,
    resetConversationApi,
    cleanupMessages,
    loadSuggestions,
    invalidateSuggestions,
  } = core;

  // ====================
  // 2. Limits (限制服務)
  // ====================
  const limits = useChatLimits();
  const {
    checkLimit,
    unlockByAd,
    getLimitState,
    checkVoiceLimit,
    unlockVoiceByAd: unlockVoiceByAdFromLimit,
    loadVoiceStats,
    fetchPhotoStats,
    canGeneratePhoto,
    photoRemaining,
    isGuest,
    requireLogin,
    canGuestSendMessage,
    incrementGuestMessageCount,
    guestRemainingMessages,
    balance,
    loadBalance,
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,
    createCards,
    loadTicketsBalance,
  } = limits;

  // ====================
  // 3. Modals (模態框管理)
  // ====================
  const modalsSetup = useChatModals({
    unlockByAd,
    unlockVoiceByAd: unlockVoiceByAdFromLimit,
    loadTicketsBalance,
  });

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
    showGiftSelector,
    closeGiftSelector,
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
    updateModal,
    handleWatchAd,
    handleUseUnlockCard,
  } = modalsSetup;

  // ====================
  // 4. Features (功能管理)
  // ====================
  const features = useChatFeatures({
    partnerId,
    currentUserId,
    partner,
    firebaseAuth,
    messages,
    chatContentRef,
    modals,
    requireLogin,
    canGeneratePhoto,
    fetchPhotoStats,
    photoRemaining,
    checkVoiceLimit,
    loadVoiceStats,
    loadTicketsBalance,
    closeConversationLimit,
    closeVoiceLimit,
    closePhotoLimit,
    closePotionLimit,
    closeUnlockConfirm,
    closePotionConfirm,
    showPotionConfirm,
    showPotionLimit,
    showUnlockConfirm,
    showUnlockLimit,
    showPhotoLimit,
    showVoiceLimit,
    showVideoLimit,
    showPhotoSelector,
    showGiftSelector,
    closeGiftSelector,
    closePhotoSelector,
    closeVideoLimit,
    showGiftAnimation,
    closeGiftAnimation,
    setLoading,
    loadBalance,
    showError,
    success,
    setUserProfile,
    rollbackUserMessage: (userId, matchId, messageId) =>
      rollbackUserMessage({
        userId,
        matchId,
        messageId,
        firebaseAuth,
        messages,
        showError,
      }),
    createLimitModalData,
    config: {
      MESSAGE_ID_PREFIXES,
      VIDEO_CONFIG,
      AI_VIDEO_RESPONSE_TEXT,
      VIDEO_REQUEST_MESSAGES,
    },
  });

  const {
    userPotions,
    activePotionEffects,
    activeMemoryBoost,
    activeBrainBoost,
    activeUnlockEffects,
    activeCharacterUnlock,
    isCharacterUnlocked,
    playingVoiceMessageId,
    isRequestingSelfie,
    isRequestingVideo,
    isSendingGift,
    showGiftSelector: showGiftSelectorFromFeatures,
    isFavoriteMutating,
    loadPotions,
    loadActivePotions,
    loadActiveUnlocks,
    handleConfirmUsePotion,
    handleConfirmUnlockCharacter,
    resetUnlockDataLoadedState,
    handlePlayVoice,
    handleWatchVoiceAd: watchVoiceAd,
    handleUseVoiceUnlockCard,
    handleRequestSelfie,
    handleUsePhotoUnlockCard,
    generateVideo,
    handleRequestVideo,
    handleOpenGiftSelector,
    handleSelectGift,
    toggleFavorite,
    openGiftSelector,
    closeGiftSelector: closeGiftSelectorFromFeatures,
    requestSelfie,
    playVoice,
    sendGift,
  } = features;

  // ====================
  // 5. Handlers (事件處理器)
  // ====================
  const handlers = useChatHandlers({
    currentUserId,
    partner,
    partnerDisplayName,
    partnerId,
    messages,
    draft,
    chatContentRef,
    characterTickets,
    userPotions,
    hasCharacterTickets,
    isGuest,
    canGuestSendMessage,
    requireLogin,
    incrementGuestMessageCount,
    checkLimit,
    showConversationLimit,
    sendMessageToApi,
    invalidateSuggestions,
    loadSuggestions,
    resetConversationApi,
    showImageViewer,
    showBuffDetails,
    showResetConfirm,
    showCharacterInfo,
    showUnlockLimit,
    showUnlockConfirm,
    showPotionLimit,
    showPotionConfirm,
    closeResetConfirm,
    closePhotoSelector,
    closeVideoLimit,
    setLoading,
    generateVideo,
    loadTicketsBalance,
    showPhotoSelector,
    watchVoiceAd,
    router,
    showError,
    success,
    MESSAGE_ID_PREFIXES,
  });

  const {
    handleSendMessage,
    handleImageClick,
    handleViewBuffDetails,
    handleBack,
    handleSuggestionClick,
    handleRequestSuggestions,
    handleMenuAction,
    cancelResetConversation,
    confirmResetConversation,
    handlePhotoSelect,
    handleUseVideoUnlockCard,
    handleUpgradeFromVideoModal,
    handleShare,
  } = handlers;

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
    showGiftSelector: showGiftSelectorFromFeatures,
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
    handleWatchVoiceAd: watchVoiceAd,
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
