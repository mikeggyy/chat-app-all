/**
 * Send Message Composable
 * 處理消息發送的完整邏輯
 * 從 ChatView.vue 提取為獨立 composable
 */

import { nextTick } from 'vue';

/**
 * 消息發送邏輯
 * @param {Object} params - 參數對象
 * @returns {Object} 消息發送方法
 */
export const useSendMessage = ({
  // Getters
  getCurrentUserId,
  getPartnerId,
  getPartnerDisplayName,
  getDraft,
  setDraft,
  getMessageInputRef,
  getCharacterTickets,

  // Guest checks
  isGuest,
  canGuestSendMessage,
  requireLogin,
  incrementGuestMessageCount,

  // Limit checks
  checkLimit,
  showConversationLimit,

  // Message actions
  sendMessageToApi,
  invalidateSuggestions,

  // Toast
  showError,
}) => {
  /**
   * 處理消息發送
   * @param {string} text - 要發送的消息文本
   */
  const handleSendMessage = async (text) => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId || !text) return;

    // Guest message limit check
    if (isGuest.value && !canGuestSendMessage.value) {
      requireLogin({ feature: "發送訊息" });
      return;
    }

    // Check conversation limit
    const limitCheck = await checkLimit(userId, matchId);
    if (!limitCheck.allowed) {
      showConversationLimit({
        characterName: getPartnerDisplayName(),
        remainingMessages: limitCheck.remaining || 0,
        dailyAdLimit: limitCheck.dailyAdLimit || 10,
        adsWatchedToday: limitCheck.adsWatchedToday || 0,
        isUnlocked: limitCheck.isUnlocked || false,
        characterUnlockCards: getCharacterTickets() || 0,
      });
      return;
    }

    // Clear draft immediately
    setDraft("");

    try {
      // Send message (sendMessage only takes text parameter)
      await sendMessageToApi(text);

      // Invalidate suggestions
      invalidateSuggestions();

      // Increment guest message count
      if (isGuest.value) {
        incrementGuestMessageCount();
      }

      // Focus input
      await nextTick();
      const messageInputRef = getMessageInputRef();
      messageInputRef?.focus();
    } catch (error) {
      showError(error instanceof Error ? error.message : "發送消息失敗");
    }
  };

  return {
    handleSendMessage,
  };
};
