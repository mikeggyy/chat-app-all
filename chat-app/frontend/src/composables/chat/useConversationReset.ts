// @ts-nocheck
/**
 * useConversationReset.ts
 * 對話重置 Composable（TypeScript 版本）
 * 管理對話重置功能，包括清理緩存和恢復角色初始訊息
 */

import { writeCachedHistory, clearPendingMessages } from '../../utils/conversationCache.js';
import type { Message, Partner } from '../../types';

// ==================== 類型定義 ====================

/**
 * 消息 ID 前綴配置
 */
export interface MessageIdPrefixes {
  FIRST: string;
  [key: string]: string;
}

/**
 * 對話重置配置
 */
export interface ConversationResetConfig {
  MESSAGE_ID_PREFIXES: MessageIdPrefixes;
}

/**
 * useConversationReset 依賴項
 */
export interface UseConversationResetDeps {
  getCurrentUserId: () => string;
  getPartnerId: () => string;
  getPartner: () => Partner | null;
  getMessages: () => Message[];
  getDraft: () => string;
  setDraft: (value: string) => void;
  resetConversationApi: (userId: string, characterId: string) => Promise<void>;
  invalidateSuggestions: () => void;
  closeResetConfirm: () => void;
  setLoading: (key: string, loading: boolean) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  config: ConversationResetConfig;
}

/**
 * useConversationReset 返回類型
 */
export interface UseConversationResetReturn {
  confirmResetConversation: () => Promise<void>;
  cancelResetConversation: () => void;
}

// ==================== Composable 主函數 ====================

/**
 * 創建對話重置 composable
 * @param deps - 依賴項
 * @returns 對話重置相關的方法
 */
export function useConversationReset(deps: UseConversationResetDeps): UseConversationResetReturn {
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

  // getDraft 保留用於未來可能的功能，目前未使用
  void getDraft; // 標記參數已被認知

  const { MESSAGE_ID_PREFIXES } = config;

  // ====================
  // 核心方法
  // ====================

  /**
   * 確認重置對話
   */
  const confirmResetConversation = async (): Promise<void> => {
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

      if (needsFirstMessage && partner.first_message) {
        const firstMessage: Message = {
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
    } catch (error: any) {
      showError(error instanceof Error ? error.message : '重置對話失敗');
    } finally {
      setLoading('resetConfirm', false);
    }
  };

  /**
   * 取消重置對話
   */
  const cancelResetConversation = (): void => {
    closeResetConfirm();
  };

  // ====================
  // 返回 API
  // ====================
  return {
    // 方法
    confirmResetConversation,
    cancelResetConversation,
  };
}
