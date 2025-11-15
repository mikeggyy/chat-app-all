/**
 * useEventHandlers.ts
 * Event Handlers Composable（TypeScript 版本）
 * 處理 ChatView 中的簡單事件處理函數
 * 從 ChatView.vue 提取為獨立 composable
 */

import type { Router } from 'vue-router';

// ==================== 類型定義 ====================

/**
 * 圖片點擊參數
 */
export interface ImageClickParams {
  url: string;
  alt?: string;
}

/**
 * useEventHandlers 參數
 */
export interface UseEventHandlersParams {
  // Modal functions
  showImageViewer: (url: string, alt?: string) => void;
  showBuffDetails: (buffType: string) => void;

  // Navigation
  router: Router;

  // Voice
  watchVoiceAd: (userId: string, characterId: string) => Promise<void>;
  getCurrentUserId: () => string;
  getPartnerId: () => string;

  // Suggestions
  loadSuggestions: () => Promise<void>;
  handleSendMessage: (text: string) => Promise<void>;
}

/**
 * useEventHandlers 返回類型
 */
export interface UseEventHandlersReturn {
  handleImageClick: (params: ImageClickParams) => void;
  handleViewBuffDetails: (buffType: string) => void;
  handleBack: () => void;
  handleWatchVoiceAd: () => Promise<void>;
  handleSuggestionClick: (suggestion: string) => Promise<void>;
  handleRequestSuggestions: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 簡單事件處理器
 * @param params - 參數對象
 * @returns 事件處理函數集合
 */
export const useEventHandlers = (params: UseEventHandlersParams): UseEventHandlersReturn => {
  const {
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
  } = params;

  /**
   * 處理圖片點擊
   */
  const handleImageClick = ({ url, alt }: ImageClickParams): void => {
    showImageViewer(url, alt);
  };

  /**
   * 處理查看 Buff 詳情
   */
  const handleViewBuffDetails = (buffType: string): void => {
    showBuffDetails(buffType);
  };

  /**
   * 處理返回
   */
  const handleBack = (): void => {
    router.back();
  };

  /**
   * 處理觀看語音廣告
   */
  const handleWatchVoiceAd = async (): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();
    await watchVoiceAd(userId, matchId);
  };

  /**
   * 處理建議點擊
   */
  const handleSuggestionClick = async (suggestion: string): Promise<void> => {
    // 直接送出建議訊息
    if (suggestion && suggestion.trim()) {
      await handleSendMessage(suggestion.trim());
    }
  };

  /**
   * 處理請求建議
   */
  const handleRequestSuggestions = async (): Promise<void> => {
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
