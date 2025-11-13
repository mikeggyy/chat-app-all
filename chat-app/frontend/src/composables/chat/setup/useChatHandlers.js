/**
 * Chat 事件處理器
 * 管理各種用戶交互事件的處理
 */

import { useSendMessage } from '../useSendMessage';
import { useEventHandlers } from '../useEventHandlers';
import { useMenuActions } from '../useMenuActions';
import { useConversationReset } from '../useConversationReset';
import { usePhotoVideoHandler } from '../usePhotoVideoHandler';
import { useShareFunctionality } from '../useShareFunctionality';

/**
 * 設置所有事件處理器
 * @param {Object} options - 選項
 * @returns {Object} 事件處理器方法
 */
export function useChatHandlers(options) {
  const {
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
  } = options;

  // Send Message Handler
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

  // Event Handlers
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

  // Menu Actions
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
      hasCharacterTickets,
      characterTickets,
    },
    handleShare: () => {}, // 暫時空實現，後面設置
  });

  // Conversation Reset
  const {
    cancelResetConversation,
    confirmResetConversation,
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

  // Photo Video Handler
  const {
    handlePhotoSelect,
    handleUseVideoUnlockCard,
    handleUpgradeFromVideoModal,
  } = usePhotoVideoHandler({
    getCurrentUserId: () => currentUserId.value,
    getPhotoSelectorModal: () => ({ isVisible: false }), // 從 modals 獲取
    generateVideo,
    loadTicketsBalance,
    closePhotoSelector,
    closeVideoLimit,
    showPhotoSelector,
    navigateToMembership: () => router.push('/membership'),
    showError,
  });

  // Share Functionality
  const { handleShare } = useShareFunctionality({
    partner,
    messages,
    currentUserId,
    router,
  });

  // 更新 handleMenuAction 的 handleShare
  handleMenuAction.handleShare = handleShare;

  return {
    // Send Message
    handleSendMessage,

    // Event Handlers
    handleImageClick,
    handleViewBuffDetails,
    handleBack,
    handleWatchVoiceAd,
    handleSuggestionClick,
    handleRequestSuggestions,

    // Menu Actions
    handleMenuAction,

    // Conversation Reset
    cancelResetConversation,
    confirmResetConversation,

    // Photo Video
    handlePhotoSelect,
    handleUseVideoUnlockCard,
    handleUpgradeFromVideoModal,

    // Share
    handleShare,
  };
}
