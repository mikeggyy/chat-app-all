/**
 * Chat 功能模塊
 * 管理禮物、自拍、視頻、藥水、解鎖等功能
 */

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
    characterTickets,
    showPotionConfirm,
    showPotionLimit,
    closePotionConfirm,
    closePotionLimit,
    showUnlockConfirm,
    showUnlockLimit,
    closeUnlockConfirm,
    closeUnlockLimit,
    showVoiceLimit,
    showPhotoLimit,
    showVideoLimit,
    closePhotoSelector,
    closeVideoLimit,
    showGiftSelector,
    closeGiftSelector,
    showPhotoSelector,
    loadTicketsBalance,
    setUserProfile,
    router,
    showError,
  } = options;

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
    showPotionConfirm,
    showPotionLimit,
    closePotionConfirm,
    closePotionLimit,
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
    getCharacterTickets: () => characterTickets.value,
    activeCharacterUnlock,
    loadActiveUnlocks,
    showUnlockConfirm,
    showUnlockLimit,
    closeUnlockConfirm,
    closeUnlockLimit,
    loadTicketsBalance,
    setUserProfile,
  });

  // Voice Management
  const {
    playingVoiceMessageId,
    handlePlayVoice,
  } = useVoiceManagement({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    showVoiceLimit,
  });

  // Selfie Generation
  const {
    isRequestingSelfie,
    photoRemaining,
    handleRequestSelfie,
  } = useSelfieGeneration({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    showPhotoLimit,
    showPhotoSelector,
  });

  // Video Generation
  const {
    isRequestingVideo,
    handleRequestVideo,
    generateVideo,
  } = useVideoGeneration({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    showVideoLimit,
  });

  // Gift Management
  const {
    isSendingGift,
    handleOpenGiftSelector,
    handleSelectGift,
  } = useGiftManagement({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    showGiftSelector,
    closeGiftSelector,
    showError,
  });

  // Favorite Management
  const {
    isFavoriteMutating,
    toggleFavorite,
  } = useFavoriteManagement({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    setUserProfile,
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

    // Selfie
    isRequestingSelfie,
    photoRemaining,
    handleRequestSelfie,

    // Video
    isRequestingVideo,
    handleRequestVideo,
    generateVideo,

    // Gift
    isSendingGift,
    handleOpenGiftSelector,
    handleSelectGift,

    // Favorite
    isFavoriteMutating,
    toggleFavorite,
  };
}
