/**
 * useSendMessage.ts
 * Send Message Composable（TypeScript 版本）
 * 處理消息發送的完整邏輯
 * 從 ChatView.vue 提取為獨立 composable
 */

import { nextTick, type Ref, type ComputedRef } from 'vue';
import type { LimitCheckResult } from '../../types';

// ==================== 類型定義 ====================

/**
 * 顯示對話限制的選項
 */
export interface ShowConversationLimitOptions {
  characterName: string;
  remainingMessages: number;
  dailyAdLimit: number;
  adsWatchedToday: number;
  isUnlocked: boolean;
  characterUnlockCards: number;
}

/**
 * 登入要求選項
 */
export interface RequireLoginOptions {
  feature: string;
}

/**
 * useSendMessage 參數
 */
export interface UseSendMessageParams {
  // Getters
  getCurrentUserId: () => string;
  getPartnerId: () => string;
  getPartnerDisplayName: () => string;
  getDraft: () => string;
  setDraft: (value: string) => void;
  getMessageInputRef: () => { focus: () => void } | null;
  getCharacterTickets: () => number;

  // Guest checks
  isGuest: Ref<boolean> | ComputedRef<boolean>;
  canGuestSendMessage: Ref<boolean> | ComputedRef<boolean>;
  requireLogin: (options: RequireLoginOptions) => boolean;
  incrementGuestMessageCount: () => void;

  // Limit checks
  checkLimit: (userId: string, characterId: string) => Promise<LimitCheckResult>;
  showConversationLimit: (options: ShowConversationLimitOptions) => void;

  // Message actions
  sendMessageToApi: (text: string) => Promise<void>;
  invalidateSuggestions: () => void;

  // Toast
  showError: (message: string) => void;
}

/**
 * useSendMessage 返回類型
 */
export interface UseSendMessageReturn {
  handleSendMessage: (text: string) => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 消息發送邏輯
 * @param params - 參數對象
 * @returns 消息發送方法
 */
export const useSendMessage = (params: UseSendMessageParams): UseSendMessageReturn => {
  const {
    // Getters
    getCurrentUserId,
    getPartnerId,
    getPartnerDisplayName,
    // getDraft, // 未使用，保留用於未來擴展
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
  } = params;

  /**
   * 處理消息發送
   * @param text - 要發送的消息文本
   */
  const handleSendMessage = async (text: string): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId || !text) return;

    // Guest message limit check
    const isGuestValue = (isGuest as any).value ?? isGuest;
    const canGuestSendValue = (canGuestSendMessage as any).value ?? canGuestSendMessage;

    if (isGuestValue && !canGuestSendValue) {
      requireLogin({ feature: "發送訊息" });
      return;
    }

    // Check conversation limit
    const limitCheck = await checkLimit(userId, matchId);
    if (!limitCheck.allowed) {
      showConversationLimit({
        characterName: getPartnerDisplayName(),
        remainingMessages: limitCheck.remaining || 0,
        dailyAdLimit: (limitCheck as any).dailyAdLimit || 10,
        adsWatchedToday: (limitCheck as any).adsWatchedToday || 0,
        isUnlocked: (limitCheck as any).isUnlocked || false,
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
      if (isGuestValue) {
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
