/**
 * Chat 相關的輔助函數
 * 從 ChatView.vue 提取，便於測試和重用
 */

import { apiJson } from '../api';
import { writeCachedHistory } from '../conversationCache';

/**
 * 撤回用戶消息（從後端和前端同時刪除）
 * @param {Object} params - 參數對象
 * @param {string} params.userId - 用戶 ID
 * @param {string} params.matchId - 角色 ID
 * @param {string} params.messageId - 消息 ID
 * @param {Object} params.firebaseAuth - Firebase Auth 實例
 * @param {Array} params.messages - 消息列表 (ref)
 * @param {Function} params.showError - 錯誤提示函數
 * @returns {Promise<boolean>} - 是否成功撤回
 */
export const rollbackUserMessage = async ({
  userId,
  matchId,
  messageId,
  firebaseAuth,
  messages,
  showError,
}) => {
  if (!userId || !matchId || !messageId) {
    return false;
  }

  try {
    const token = await firebaseAuth.getCurrentUserIdToken();

    // ✅ 先從後端 Firestore 刪除
    await apiJson(`/api/conversations/${userId}/${matchId}/messages`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        messageIds: [messageId],
      },
      skipGlobalLoading: true,
    });

    // ✅ 成功後才從前端訊息列表中刪除
    const msgIndex = messages.value.findIndex((m) => m.id === messageId);
    if (msgIndex !== -1) {
      messages.value.splice(msgIndex, 1);
    }

    // ✅ 更新緩存
    writeCachedHistory(userId, matchId, messages.value);

    return true;
  } catch (error) {
    showError("撤回訊息失敗，請重新整理頁面");
    return false;
  }
};

/**
 * 創建限制 Modal 的數據結構
 * @param {Object} limitCheck - 限制檢查結果
 * @param {string} type - 限制類型 ('photo' 或 'video')
 * @returns {Object} Modal 數據對象
 */
export const createLimitModalData = (limitCheck, type = "photo") => {
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
  return {
    used: limitCheck.used || 0,
    remaining: limitCheck.remaining || 0,
    total: limitCheck.total || 0,
    standardTotal: limitCheck[`standard${capitalizedType}sLimit`] || null,
    isTestAccount: limitCheck.isTestAccount || false,
    cards: limitCheck[`${type}Cards`] || 0,
    tier: limitCheck.tier || "free",
    resetPeriod: limitCheck.resetPeriod || "lifetime",
  };
};

/**
 * 獲取對話上下文
 * @param {Object} params - 參數對象
 * @param {string} params.matchId - 角色 ID
 * @param {string} params.currentUserId - 當前用戶 ID
 * @returns {Object} 對話上下文對象
 */
export const getConversationContext = ({ matchId, currentUserId }) => {
  return {
    matchId: matchId ?? "",
    currentUserId: currentUserId ?? "",
  };
};
