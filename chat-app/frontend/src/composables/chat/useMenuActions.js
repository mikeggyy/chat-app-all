/**
 * Menu Actions Composable
 * 處理 ChatView 中的所有菜單操作
 * 從 ChatView.vue 提取為獨立 composable
 */

/**
 * Menu Actions 處理邏輯
 * @param {Object} params - 參數對象
 * @param {Object} params.modals - Modal 管理器（來自 useModalManager）
 * @param {Object} params.userPotions - 用戶藥水數據（來自 usePotionManagement）
 * @param {Object} params.unlockTickets - 解鎖卡數據（來自 useUnlockTickets）
 * @param {Function} params.handleShare - 分享處理函數（來自 useShareFunctionality）
 * @returns {Object} Menu action 處理函數
 */
export const useMenuActions = ({
  modals,
  userPotions,
  unlockTickets,
  handleShare,
}) => {
  /**
   * 處理菜單操作
   * @param {string} action - 操作類型
   */
  const handleMenuAction = (action) => {
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
