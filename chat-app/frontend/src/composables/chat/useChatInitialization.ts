// @ts-nocheck
/**
 * Chat 初始化邏輯 Composable（TypeScript 版本）
 * 處理 ChatView 掛載時的所有初始化流程
 * 從 ChatView.vue 提取為獨立 composable
 */

import { nextTick } from 'vue';
import { isGuestUser } from '../../../../../shared/config/testAccounts';
import { writeCachedHistory } from '../../utils/conversationCache';
import { logger } from '../../utils/logger';
import { MESSAGE_ID_PREFIXES } from '../../config/chat/constants';
import type { Message, Partner } from '../../types';

// ==================== 類型定義 ====================

/**
 * MessageList 組件引用類型
 */
export interface MessageListRef {
  scrollToBottom: (smooth?: boolean) => void;
}

/**
 * 依賴項配置接口
 */
export interface UseChatInitializationDeps {
  // Getters - 獲取當前狀態
  getCurrentUserId: () => string | undefined;
  getPartnerId: () => string;
  getPartner: () => Partner | null;
  getMessages: () => Message[];
  getMessageListRef: () => MessageListRef | null;

  // Loaders - 數據加載函數
  loadPartner: (matchId: string) => Promise<void>;
  loadTicketsBalance: (userId: string, options?: { skipGlobalLoading?: boolean }) => Promise<void>;
  loadPotions: () => Promise<void>;
  loadActivePotions: () => Promise<void>;
  loadActiveUnlocks: () => Promise<void>;
  loadHistory: (userId: string, matchId: string) => Promise<void>;
  addConversationHistory: (matchId: string) => Promise<void>;
  loadVoiceStats: (userId: string, options?: { skipGlobalLoading?: boolean }) => Promise<void>;
  fetchPhotoStats: () => Promise<void>;
  loadBalance: (userId: string, options?: { skipGlobalLoading?: boolean }) => Promise<void>;
}

/**
 * Composable 返回類型
 */
export interface UseChatInitializationReturn {
  /**
   * 執行所有初始化流程
   */
  initializeChat: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * Chat 初始化邏輯
 * @param deps - 依賴項對象
 * @returns 初始化方法
 */
export const useChatInitialization = (
  deps: UseChatInitializationDeps
): UseChatInitializationReturn => {
  const {
    // Getters
    getCurrentUserId,
    getPartnerId,
    getPartner,
    getMessages,
    getMessageListRef,

    // Loaders
    loadPartner,
    loadTicketsBalance,
    loadPotions,
    loadActivePotions,
    loadActiveUnlocks,
    loadHistory,
    addConversationHistory,
    loadVoiceStats,
    fetchPhotoStats,
    loadBalance,
  } = deps;

  /**
   * 執行所有初始化流程
   */
  const initializeChat = async (): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    try {
      // 1. Load partner data first
      await loadPartner(matchId);

      // 2. Load unlock tickets (統一管道獲取所有卡片，跳過訪客用戶)
      if (!isGuestUser(userId)) {
        try {
          await loadTicketsBalance(userId, { skipGlobalLoading: true });
        } catch (error) {
          // 靜默失敗，不影響用戶體驗
          if (import.meta.env.DEV) {
            logger.warn("加載解鎖卡餘額失敗:", error);
          }
        }
      }

      // 3. Load potions (跳過訪客用戶)
      if (!isGuestUser(userId)) {
        try {
          await loadPotions();
        } catch (error) {
          // 靜默失敗，不影響用戶體驗
          if (import.meta.env.DEV) {
            logger.warn("加載藥水失敗:", error);
          }
        }
      }

      // 4. Load active potion effects (跳過訪客用戶)
      if (!isGuestUser(userId)) {
        try {
          await loadActivePotions();
        } catch (error) {
          // 靜默失敗，不影響用戶體驗
          if (import.meta.env.DEV) {
            logger.warn("加載活躍藥水效果失敗:", error);
          }
        }
      }

      // 5. Load active unlock effects (跳過訪客用戶)
      if (!isGuestUser(userId)) {
        try {
          await loadActiveUnlocks();
        } catch (error) {
          // 靜默失敗，不影響用戶體驗
          if (import.meta.env.DEV) {
            logger.warn("加載活躍解鎖效果失敗:", error);
          }
        }
      }

      // 6. Load conversation history
      await loadHistory(userId, matchId);

      // 7. 記錄對話歷史（靜默失敗，不影響聊天功能）
      try {
        await addConversationHistory(matchId);
      } catch (error) {
        // 靜默失敗，不影響用戶體驗
        if (import.meta.env.DEV) {
          logger.warn("記錄對話歷史失敗:", error);
        }
      }

      // 8. 檢查是否需要添加角色的第一句話
      await addFirstMessageIfNeeded(userId, matchId);

      // 9. Load voice stats (跳過訪客用戶)
      if (!isGuestUser(userId)) {
        try {
          await loadVoiceStats(userId, { skipGlobalLoading: true });
        } catch (error) {
          // 靜默失敗，不影響用戶體驗
          if (import.meta.env.DEV) {
            logger.warn("加載語音統計失敗:", error);
          }
        }
      }

      // 10. Load photo stats (跳過訪客用戶)
      if (!isGuestUser(userId)) {
        try {
          await fetchPhotoStats();
        } catch (error) {
          // 靜默失敗，不影響用戶體驗
          if (import.meta.env.DEV) {
            logger.warn("加載照片統計失敗:", error);
          }
        }
      }

      // 11. Load balance (跳過訪客用戶)
      if (!isGuestUser(userId)) {
        try {
          await loadBalance(userId, { skipGlobalLoading: true });
        } catch (error) {
          // 靜默失敗，不影響用戶體驗
          if (import.meta.env.DEV) {
            logger.warn("加載金幣餘額失敗:", error);
          }
        }
      }

      // 12. Scroll to bottom
      await nextTick();
      const messageListRef = getMessageListRef();
      messageListRef?.scrollToBottom(false);
    } catch (error) {
      // Silent fail - 初始化失敗不阻止頁面渲染
      if (import.meta.env.DEV) {
        logger.error("Chat 初始化失敗:", error);
      }
    }
  };

  /**
   * 檢查並添加角色的第一句話
   * 條件：沒有消息，或者第一條消息不是角色的 first_message
   */
  const addFirstMessageIfNeeded = async (
    userId: string,
    matchId: string
  ): Promise<void> => {
    const partner = getPartner();
    const messages = getMessages();

    const needsFirstMessage =
      partner?.first_message &&
      (messages.length === 0 ||
        messages[0]?.text !== partner.first_message.trim());

    if (needsFirstMessage) {
      const firstMessage: Message = {
        id: `${MESSAGE_ID_PREFIXES.FIRST}${Date.now()}`,
        role: "partner",
        text: partner.first_message!.trim(),
        createdAt: new Date().toISOString(),
      };

      // 添加到消息列表開頭
      messages.unshift(firstMessage);

      // 保存到緩存（完整歷史）
      writeCachedHistory(userId, matchId, messages);
    }
  };

  return {
    initializeChat,
  };
};
