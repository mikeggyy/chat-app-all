/**
 * Event Handlers Composable
 * 處理 ChatView 中的簡單事件處理函數
 * 從 ChatView.vue 提取為獨立 composable
 */

/**
 * 簡單事件處理器
 * @param {Object} params - 參數對象
 * @returns {Object} 事件處理函數集合
 */
export const useEventHandlers = ({
  // Modal functions
  showImageViewer,
  showBuffDetails,

  // Navigation
  router,

  // Voice
  watchVoiceAd,
  getCurrentUserId,
  getPartnerId,

  // Suggestions
  loadSuggestions,
  handleSendMessage,
}) => {
  /**
   * 處理圖片點擊
   */
  const handleImageClick = ({ url, alt }) => {
    showImageViewer(url, alt);
  };

  /**
   * 處理查看 Buff 詳情
   */
  const handleViewBuffDetails = (buffType) => {
    showBuffDetails(buffType);
  };

  /**
   * 處理返回
   */
  const handleBack = () => {
    router.back();
  };

  /**
   * 處理觀看語音廣告
   */
  const handleWatchVoiceAd = async () => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();
    await watchVoiceAd(userId, matchId);
  };

  /**
   * 處理建議點擊
   */
  const handleSuggestionClick = async (suggestion) => {
    // 直接送出建議訊息
    if (suggestion && suggestion.trim()) {
      await handleSendMessage(suggestion.trim());
    }
  };

  /**
   * 處理請求建議
   */
  const handleRequestSuggestions = async () => {
    await loadSuggestions();
  };

  return {
    handleImageClick,
    handleViewBuffDetails,
    handleBack,
    handleWatchVoiceAd,
    handleSuggestionClick,
    handleRequestSuggestions,
  };
};
