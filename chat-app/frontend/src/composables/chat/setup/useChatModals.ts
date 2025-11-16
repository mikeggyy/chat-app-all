// @ts-nocheck
/**
 * Chat 模態框管理（TypeScript 版本）
 * 統一管理所有彈窗的顯示/隱藏狀態
 */

import type { UseModalManagerReturn } from '../useModalManager.js';
import { useModalManager } from '../useModalManager.js';
import { useConversationLimitActions } from '../useConversationLimitActions.js';

// ==================== 類型定義 ====================

/**
 * useChatModals 選項參數
 */
export interface UseChatModalsOptions {
  /** 觀看廣告解鎖對話 */
  unlockByAd: (userId: string, characterId: string) => Promise<void>;
  /** 觀看廣告解鎖語音 */
  unlockVoiceByAd: (userId: string, characterId: string) => Promise<void>;
  /** 加載解鎖券餘額 */
  loadTicketsBalance: (userId: string) => Promise<void>;
}

/**
 * useChatModals 返回類型
 */
export interface UseChatModalsReturn extends UseModalManagerReturn {
  // 從 useConversationLimitActions 返回的方法
  handleWatchAd: (adType: string) => Promise<void>;
  handleUseUnlockCard: () => Promise<void>;
  watchVoiceAd: (adType: string) => Promise<void>;
  handleUseVoiceUnlockCard: () => Promise<void>;
  handleUsePhotoUnlockCard: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 設置所有模態框管理
 * @param options - 選項
 * @param options.unlockByAd - 觀看廣告解鎖
 * @param options.unlockVoiceByAd - 觀看廣告解鎖語音
 * @param options.loadTicketsBalance - 加載解鎖券餘額
 * @returns 模態框相關的狀態和方法
 */
export function useChatModals({
  unlockByAd,
  unlockVoiceByAd,
  loadTicketsBalance,
}: UseChatModalsOptions): UseChatModalsReturn {
  // Modal Manager
  const modalManager = useModalManager();
  const {
    modals,
    open,
    close,
    update,
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
    showGiftAnimation,
    closeGiftAnimation,
    setLoading,
    hasOpenModal,
    hasLoadingAction,
  } = modalManager;

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

    // Other methods from UseModalManagerReturn
    open,
    close,
    update,
    showGiftAnimation,
    closeGiftAnimation,
    hasOpenModal,
    hasLoadingAction,
  };
}
