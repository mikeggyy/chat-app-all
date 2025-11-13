/**
 * Chat 模態框管理
 * 統一管理所有彈窗的顯示/隱藏狀態
 */

import { useModalManager } from '../useModalManager';
import { useConversationLimitActions } from '../useConversationLimitActions';

/**
 * 設置所有模態框管理
 * @param {Object} options - 選項
 * @param {Function} options.unlockByAd - 觀看廣告解鎖
 * @param {Function} options.unlockVoiceByAd - 觀看廣告解鎖語音
 * @param {Function} options.loadTicketsBalance - 加載解鎖券餘額
 * @returns {Object} 模態框相關的狀態和方法
 */
export function useChatModals({ unlockByAd, unlockVoiceByAd, loadTicketsBalance }) {
  // Modal Manager
  const {
    modals,
    showResetConfirm,
    closeResetConfirm,
    showCharacterInfo,
    closeCharacterInfo,
    showPotionConfirm,
    closePotionConfirm,
    showPotionLimit,
    closePotionLimit,
    showUnlockConfirm,
    closeUnlockConfirm,
    showUnlockLimit,
    closeUnlockLimit,
    showBuffDetails,
    closeBuffDetails,
    showConversationLimit,
    closeConversationLimit,
    showVoiceLimit,
    closeVoiceLimit,
    showPhotoLimit,
    closePhotoLimit,
    showVideoLimit,
    closeVideoLimit,
    showGiftSelector,
    closeGiftSelector,
    showPhotoSelector,
    closePhotoSelector,
    showImageViewer,
    closeImageViewer,
    setLoading,
  } = useModalManager();

  // Conversation Limit Actions
  const {
    handleWatchAd,
    handleUseUnlockCard,
    handleWatchVoiceAd: watchVoiceAd,
    handleUseVoiceUnlockCard,
    handleUsePhotoUnlockCard,
  } = useConversationLimitActions({
    unlockByAd,
    unlockVoiceByAd,
    loadTicketsBalance,
    closeConversationLimit,
    closeVoiceLimit,
    closePhotoLimit,
  });

  return {
    // Modal States
    modals,

    // Modal Show Methods
    showResetConfirm,
    showCharacterInfo,
    showPotionConfirm,
    showPotionLimit,
    showUnlockConfirm,
    showUnlockLimit,
    showBuffDetails,
    showConversationLimit,
    showVoiceLimit,
    showPhotoLimit,
    showVideoLimit,
    showGiftSelector,
    showPhotoSelector,
    showImageViewer,

    // Modal Close Methods
    closeResetConfirm,
    closeCharacterInfo,
    closePotionConfirm,
    closePotionLimit,
    closeUnlockConfirm,
    closeUnlockLimit,
    closeBuffDetails,
    closeConversationLimit,
    closeVoiceLimit,
    closePhotoLimit,
    closeVideoLimit,
    closeGiftSelector,
    closePhotoSelector,
    closeImageViewer,

    // Modal Actions
    handleWatchAd,
    handleUseUnlockCard,
    watchVoiceAd,
    handleUseVoiceUnlockCard,
    handleUsePhotoUnlockCard,

    // Loading State
    setLoading,
  };
}
