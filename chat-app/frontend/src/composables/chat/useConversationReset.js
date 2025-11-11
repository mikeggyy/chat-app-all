/**
 * 對話重置 Composable
 *
 * 管理對話重置功能，包括：
 * - 重置對話歷史
 * - 清理緩存和草稿
 * - 恢復角色初始訊息
 */

import { writeCachedHistory, clearPendingMessages } from '../../utils/conversationCache';

/**
 * 創建對話重置 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.getPartnerId - 獲取角色 ID
 * @param {Function} deps.getPartner - 獲取角色對象
 * @param {Function} deps.getMessages - 獲取消息列表
 * @param {Function} deps.getDraft - 獲取草稿
 * @param {Function} deps.setDraft - 設置草稿
 * @param {Function} deps.resetConversationApi - 調用重置 API
 * @param {Function} deps.invalidateSuggestions - 使建議失效
 * @param {Function} deps.closeResetConfirm - 關閉重置確認彈窗
 * @param {Function} deps.setLoading - 設置 loading 狀態
 * @param {Function} deps.showError - 顯示錯誤提示
 * @param {Function} deps.showSuccess - 顯示成功提示
 * @param {Object} deps.config - 配置
 * @param {Object} deps.config.MESSAGE_ID_PREFIXES - 消息 ID 前綴
 * @returns {Object} 對話重置相關的方法
 */
export function useConversationReset(deps) {
  const {
    getCurrentUserId,
    getPartnerId,
    getPartner,
    getMessages,
    getDraft,
    setDraft,
    resetConversationApi,
    invalidateSuggestions,
    closeResetConfirm,
    setLoading,
    showError,
    showSuccess,
    config,
  } = deps;

  const { MESSAGE_ID_PREFIXES } = config;

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 確認重置對話
   * @returns {Promise<void>}
   */
  const confirmResetConversation = async () => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    try {
      setLoading('resetConfirm', true);
      await resetConversationApi(userId, matchId);

      // Clear pending messages
      clearPendingMessages(userId, matchId);

      // Clear draft
      setDraft('');

      // Invalidate suggestions
      invalidateSuggestions();

      // 檢查是否需要添加角色的第一句話
      const partner = getPartner();
      const messages = getMessages();

      // 條件：沒有消息，或者第一條消息不是角色的 first_message
      const needsFirstMessage =
        partner?.first_message &&
        (messages.length === 0 ||
          messages[0]?.text !== partner.first_message.trim());

      if (needsFirstMessage) {
        const firstMessage = {
          id: `${MESSAGE_ID_PREFIXES.FIRST}${Date.now()}`,
          role: 'partner',
          text: partner.first_message.trim(),
          createdAt: new Date().toISOString(),
        };

        // 添加到消息列表開頭
        messages.unshift(firstMessage);

        // 保存到緩存（完整歷史）
        writeCachedHistory(userId, matchId, messages);
      }

      closeResetConfirm();
      showSuccess('對話已重置');
    } catch (error) {
      showError(error instanceof Error ? error.message : '重置對話失敗');
    } finally {
      setLoading('resetConfirm', false);
    }
  };

  /**
   * 取消重置對話
   * @returns {void}
   */
  const cancelResetConversation = () => {
    closeResetConfirm();
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 方法
    confirmResetConversation,
    cancelResetConversation,
  };
}
