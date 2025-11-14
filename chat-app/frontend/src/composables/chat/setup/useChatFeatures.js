/**
 * Chat 功能模塊
 * 管理禮物、自拍、視頻、藥水、解鎖等功能
 */

import { useChatActions } from '../useChatActions';
import { usePotionManagement } from '../usePotionManagement';
import { useSelfieGeneration } from '../useSelfieGeneration';
import { useVideoGeneration } from '../useVideoGeneration';
import { useGiftManagement } from '../useGiftManagement';
import { useCharacterUnlock } from '../useCharacterUnlock';
import { useFavoriteManagement } from '../useFavoriteManagement';
import { useVoiceManagement } from '../useVoiceManagement';

/**
 * 設置所有 Chat 功能
 * @param {Object} options - 選項
 * @returns {Object} 功能相關的狀態和方法
 */
export function useChatFeatures(options) {
  const {
    partnerId,
    currentUserId,
    partner,
    firebaseAuth,
    messages,
    chatContentRef,
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
    rollbackUserMessage,
    createLimitModalData,
    setUserProfile,
    config,
  } = options;

  // ==========================================
  // 創建 Chat Actions（核心動作函數）
  // ==========================================
  const chatActions = useChatActions({
    messages,
    partner,
    currentUserId,
    firebaseAuth,
    toast: {
      success,
      error: showError,
    },
    requireLogin,
    scrollToBottom: () => chatContentRef.value?.scrollToBottom?.(),
    appendCachedHistory: () => {}, // TODO: 如果需要可以從 options 傳入
  });

  const {
    isRequestingSelfie,
    requestSelfie,
    playVoice,
    showGiftSelector: showGiftSelectorState,
    isSendingGift,
    openGiftSelector,
    closeGiftSelector: closeGiftSelectorFromActions,
    sendGift,
    playingVoiceMessageId,
  } = chatActions;

  // Potion Management
  const {
    userPotions,
    activeMemoryBoost,
    activeBrainBoost,
    activeCharacterUnlock,
    loadPotions,
    loadActivePotions,
    activePotionEffects,
    handleConfirmUsePotion,
  } = usePotionManagement({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getPotionType: () => null, // TODO: 從 modals 或其他地方獲取
    closePotionConfirm,
    setLoading,
    showError,
    showSuccess: success,
  });

  // Character Unlock
  const {
    isCharacterUnlocked,
    loadActiveUnlocks,
    activeUnlockEffects,
    resetUnlockDataLoadedState,
    handleConfirmUnlockCharacter,
  } = useCharacterUnlock({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getFirebaseAuth: () => firebaseAuth,
    getPartnerDisplayName: () => partner.value?.name || partner.value?.displayName,
    closeUnlockConfirm,
    loadTicketsBalance,
    setLoading,
    showError,
    showSuccess: success,
  });

  // Voice Management
  const {
    handlePlayVoice,
    handleWatchVoiceAd,
    handleUseVoiceUnlockCard,
  } = useVoiceManagement({
    getCurrentUserId: () => currentUserId.value,
    playVoice,
    loadVoiceStats,
    checkVoiceLimit,
    unlockVoiceByAd: () => {}, // TODO: 從 useChatLimits 獲取
    loadTicketsBalance,
    showVoiceLimit,
    closeVoiceLimit,
    getVoiceLimitPendingMessage: () => null, // TODO: 實現
    showError,
    showSuccess: success,
  });

  // Selfie Generation
  const {
    handleRequestSelfie,
    handleUsePhotoUnlockCard,
  } = useSelfieGeneration({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getFirebaseAuth: () => firebaseAuth,
    messages,
    messageListRef: chatContentRef,
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
    config,
  });

  // Video Generation
  const {
    isRequestingVideo,
    handleRequestVideo,
    generateVideo,
  } = useVideoGeneration({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getFirebaseAuth: () => firebaseAuth,
    messages,
    messageListRef: chatContentRef,
    rollbackUserMessage,
    requireLogin,
    showVideoLimit,
    showPhotoSelector,
    createLimitModalData,
    showError,
    showSuccess: success,
    config,
  });

  // Gift Management
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

  // Favorite Management
  const {
    isFavoriteMutating,
    toggleFavorite,
  } = useFavoriteManagement({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getUser: () => null, // TODO: 從 useChatCore 獲取
    getFirebaseAuth: () => firebaseAuth,
    setUserProfile,
    requireLogin,
    showError,
    showSuccess: success,
  });

  return {
    // Potion
    userPotions,
    activeMemoryBoost,
    activeBrainBoost,
    activeCharacterUnlock,
    loadPotions,
    loadActivePotions,
    activePotionEffects,
    handleConfirmUsePotion,

    // Character Unlock
    isCharacterUnlocked,
    loadActiveUnlocks,
    activeUnlockEffects,
    resetUnlockDataLoadedState,
    handleConfirmUnlockCharacter,

    // Voice
    playingVoiceMessageId,
    handlePlayVoice,
    handleWatchVoiceAd,
    handleUseVoiceUnlockCard,
    playVoice, // 底層函數

    // Selfie
    isRequestingSelfie, // 從 chatActions
    photoRemaining, // 從 options
    handleRequestSelfie, // 從 useSelfieGeneration
    handleUsePhotoUnlockCard, // 從 useSelfieGeneration
    requestSelfie, // 底層函數從 chatActions

    // Video
    isRequestingVideo,
    handleRequestVideo,
    generateVideo,

    // Gift
    isSendingGift, // 從 chatActions
    showGiftSelector: showGiftSelectorState, // 從 chatActions (ref 狀態)
    handleOpenGiftSelector, // 從 useGiftManagement
    handleSelectGift, // 從 useGiftManagement
    openGiftSelector, // 底層函數從 chatActions
    closeGiftSelector: closeGiftSelectorFromActions, // 底層函數從 chatActions
    sendGift, // 底層函數從 chatActions

    // Favorite
    isFavoriteMutating,
    toggleFavorite,
  };
}
