/**
 * Menu Actions Composable
 * 處理 ChatView 中的所有菜單操作
 * 從 ChatView.vue 提取為獨立 composable
 */

import type { Ref, ComputedRef } from 'vue';
import type { UseModalManagerReturn } from './useModalManager.js';

// ==================== 類型定義 ====================

/**
 * 解鎖卡券狀態
 */
export interface UnlockTicketsState {
  characterUnlockCards: number;
  photoUnlockCards: number;
  videoUnlockCards: number;
  voiceUnlockCards: number;
  createCards: number;
}

/**
 * useMenuActions 依賴項
 */
export interface UseMenuActionsDeps {
  /** Modal 管理器（來自 useModalManager） */
  modals: UseModalManagerReturn;
  /** 用戶藥水數據（來自 usePotionManagement） */
  userPotions: Ref<{ memoryBoost: number; brainBoost: number }>;
  /** 解鎖卡數據（來自 useUnlockTickets） */
  unlockTickets: {
    hasCharacterTickets: ComputedRef<boolean>;
    characterTickets: ComputedRef<number>;
  };
  /** 分享處理函數（來自 useShareFunctionality） */
  handleShare: () => void | Promise<void>;
}

/**
 * 菜單操作類型
 */
export type MenuAction =
  | 'reset'
  | 'info'
  | 'unlock-character'
  | 'memory'
  | 'memory-boost'
  | 'brain'
  | 'brain-boost'
  | 'share';

/**
 * useMenuActions 返回類型
 */
export interface UseMenuActionsReturn {
  /** 處理菜單操作 */
  handleMenuAction: (action: MenuAction) => void;
}

// ==================== Composable 主函數 ====================

/**
 * Menu Actions 處理邏輯
 * @param deps - 依賴項對象
 * @returns Menu action 處理函數
 */
export const useMenuActions = (deps: UseMenuActionsDeps): UseMenuActionsReturn => {
  const { modals, userPotions, unlockTickets, handleShare } = deps;

  /**
   * 處理菜單操作
   * @param action - 操作類型
   */
  const handleMenuAction = (action: MenuAction): void => {
    switch (action) {
      case "reset":
        // 重置對話
        modals.showResetConfirm();
        break;

      case "info":
        // 顯示角色資訊
        modals.showCharacterInfo();
        break;

      case "unlock-character":
        // 解鎖角色
        if (!unlockTickets.hasCharacterTickets.value || unlockTickets.characterTickets.value <= 0) {
          // 顯示商城引導彈窗（無解鎖卡）
          modals.showUnlockLimit();
          return;
        }
        // 顯示確認彈窗（有解鎖卡）
        modals.showUnlockConfirm();
        break;

      case "memory":
      case "memory-boost":
        // 記憶藥水
        if (userPotions.value.memoryBoost <= 0) {
          // 顯示商城引導彈窗（無藥水）
          modals.showPotionLimit("memoryBoost");
          return;
        }
        // 顯示確認彈窗（有藥水）
        modals.showPotionConfirm("memoryBoost");
        break;

      case "brain":
      case "brain-boost":
        // 腦力藥水
        if (userPotions.value.brainBoost <= 0) {
          // 顯示商城引導彈窗（無藥水）
          modals.showPotionLimit("brainBoost");
          return;
        }
        // 顯示確認彈窗（有藥水）
        modals.showPotionConfirm("brainBoost");
        break;

      case "share":
        // 分享對話
        handleShare();
        break;

      default:
        // 未知操作
        console.warn(`[useMenuActions] Unknown action: ${action}`);
    }
  };

  return {
    handleMenuAction,
  };
};
