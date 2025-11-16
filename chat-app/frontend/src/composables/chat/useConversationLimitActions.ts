/**
 * 對話限制操作 Composable
 *
 * 管理對話限制的解鎖操作，包括：
 * - 觀看廣告解鎖對話
 * - 使用解鎖卡解鎖對話
 */

import { apiJson } from '../../utils/api.js';
import { generateUnlockCharacterRequestId } from '../../utils/requestId.js';

/**
 * 創建對話限制操作 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.getPartnerId - 獲取角色 ID
 * @param {Function} deps.getPartnerDisplayName - 獲取角色顯示名稱
 * @param {Function} deps.getFirebaseAuth - 獲取 Firebase Auth 實例
 * @param {Function} deps.unlockByAd - 通過廣告解鎖對話
 * @param {Function} deps.getLimitState - 獲取限制狀態
 * @param {Function} deps.loadTicketsBalance - 重新加載解鎖卡餘額
 * @param {Function} deps.closeConversationLimit - 關閉對話限制彈窗
 * @param {Function} deps.updateModal - 更新模態框數據
 * @param {Function} deps.showError - 顯示錯誤提示
 * @param {Function} deps.showSuccess - 顯示成功提示
 * @returns {Object} 對話限制操作相關的方法
 */
export function useConversationLimitActions(deps: any): any {
  const {
    getCurrentUserId,
    getPartnerId,
    getPartnerDisplayName,
    getFirebaseAuth,
    unlockByAd,
    getLimitState,
    loadTicketsBalance,
    closeConversationLimit,
    updateModal,
    showError,
    showSuccess,
  } = deps;

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 處理觀看廣告解鎖對話
   * @param {string} adType - 廣告類型（目前僅支援 'conversation'）
   * @returns {Promise<void>}
   */
  const handleWatchAd = async (adType: string): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    try {
      if (adType === 'conversation') {
        await unlockByAd(userId, matchId);
        const state = await getLimitState(userId, matchId);
        updateModal('conversationLimit', {
          remainingMessages: state.remaining || 0,
          adsWatchedToday: state.adsWatchedToday || 0,
        });
        closeConversationLimit();
        showSuccess('已解鎖 5 則訊息！');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '觀看廣告失敗');
    }
  };

  /**
   * 處理使用解鎖卡解鎖對話
   * @returns {Promise<void>}
   */
  const handleUseUnlockCard = async (): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    try {
      // 獲取認證權杖
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();

      // 生成唯一請求ID（用於冪等性保護）
      const requestId = generateUnlockCharacterRequestId(userId, matchId);

      // 調用後端 API 使用解鎖卡
      const result = await apiJson('/api/unlock-tickets/use/character', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          characterId: matchId,
          requestId,
        },
        skipGlobalLoading: true,
      });

      if (result.success) {
        // 關閉模態框
        closeConversationLimit();

        // 重新加載解鎖卡數量
        await loadTicketsBalance(userId);

        // 顯示解鎖成功訊息（包含到期時間）
        const unlockDays = result.unlockDays || 7;
        const characterName = getPartnerDisplayName() || '角色';
        showSuccess(`解鎖成功！與「${characterName}」可暢聊 ${unlockDays} 天 🎉`);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '使用解鎖卡失敗');
    }
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 方法
    handleWatchAd,
    handleUseUnlockCard,
  };
}
