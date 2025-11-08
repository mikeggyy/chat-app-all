/**
 * useChatMessages Composable
 *
 * 負責管理聊天消息的核心邏輯
 * 包括：消息列表、發送消息、載入歷史、AI 回覆等
 *
 * 這是一個示範實作，展示如何從 ChatView.vue 中提取消息管理邏輯
 */

import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUserProfile } from '../useUserProfile';
import { useFirebaseAuth } from '../useFirebaseAuth';
import {
  fetchConversationHistory,
  appendConversationMessages,
  requestAiReply,
} from '../../utils/conversation';
import {
  readCachedHistory,
  writeCachedHistory,
  appendCachedHistory,
  readPendingMessages,
  enqueuePendingMessages,
  removePendingMessagesById,
  clearPendingMessages,
} from '../../utils/conversationCache';

export function useChatMessages(partnerId) {
  const route = useRoute();
  const { user } = useUserProfile();
  const firebaseAuth = useFirebaseAuth();

  /**
   * 獲取認證權杖
   */
  const getAuthToken = async () => {
    // 優先使用 Firebase/Test token (useFirebaseAuth 會自動處理兩者)
    if (firebaseAuth?.getCurrentUserIdToken) {
      try {
        const token = await firebaseAuth.getCurrentUserIdToken();
        if (token) return token;
      } catch (error) {
      }
    }

    throw new Error('無法獲取認證權杖');
  };

  // 狀態
  const messages = ref([]);
  const isReplying = ref(false);
  const isLoadingHistory = ref(false);
  const loadHistoryError = ref(null);

  // 內部變數
  let messageSequence = 0;
  let replyTimerId = null;
  let historyLoadToken = 0;
  let pendingRetryTimerId = null;
  let pendingSyncInFlight = false;

  // Computed
  const currentPartnerId = computed(() => {
    // 如果 partnerId 是 ref 或 computed（有 .value 屬性），取其值
    return partnerId?.value ?? partnerId;
  });

  const currentUserId = computed(() => user.value?.id);

  /**
   * 載入對話歷史
   */
  const loadHistory = async () => {
    if (isLoadingHistory.value) return;

    const userId = currentUserId.value;
    const charId = currentPartnerId.value;

    if (!userId || !charId) {
      return;
    }

    isLoadingHistory.value = true;
    loadHistoryError.value = null;

    const currentToken = ++historyLoadToken;

    try {
      // 1. 嘗試從快取讀取
      const cachedHistory = readCachedHistory(userId, charId);
      if (cachedHistory && cachedHistory.length > 0) {
        messages.value = cachedHistory;
      }

      // 2. 從 API 獲取最新歷史
      const serverHistory = await fetchConversationHistory(userId, charId);

      // 檢查是否已被取消
      if (currentToken !== historyLoadToken) {
        return;
      }

      if (serverHistory && serverHistory.length > 0) {
        messages.value = serverHistory;
        writeCachedHistory(userId, charId, serverHistory);
      }

      // 3. 載入待同步的訊息
      const pending = readPendingMessages(userId, charId);
      if (pending && pending.length > 0) {
        messages.value = [...messages.value, ...pending];
        // 啟動同步
        schedulePendingSync();
      }

    } catch (error) {
      loadHistoryError.value = error;
    } finally {
      if (currentToken === historyLoadToken) {
        isLoadingHistory.value = false;
      }
    }
  };

  /**
   * 發送消息
   */
  const sendMessage = async (text) => {
    if (!text || !text.trim()) {
      return;
    }

    const userId = currentUserId.value;
    const charId = currentPartnerId.value;

    if (!userId || !charId) {
      return;
    }

    const trimmedText = text.trim();
    const messageId = `msg-${Date.now()}-${++messageSequence}`;

    // 創建用戶消息
    const userMessage = {
      id: messageId,
      role: 'user',
      text: trimmedText,
      createdAt: new Date().toISOString(),
      state: 'pending', // 標記為待同步
    };

    // 立即添加到消息列表
    messages.value.push(userMessage);

    // 添加到待同步隊列
    enqueuePendingMessages(userId, charId, [userMessage]);

    // 發送到後端並等待 AI 回覆
    try {
      await syncMessageAndGetReply(userId, charId, trimmedText, messageId);
    } catch (error) {
      // 錯誤處理：可以在這裡顯示錯誤提示
    }
  };

  /**
   * 同步消息並獲取 AI 回覆
   */
  const syncMessageAndGetReply = async (userId, charId, text, userMessageId) => {
    try {
      isReplying.value = true;

      // 獲取認證權杖
      const token = await getAuthToken();

      // 1. 發送用戶消息到後端
      const result = await appendConversationMessages(userId, charId, [
        { role: 'user', text },
      ], { token });

      // 2. 移除待同步標記
      const userMsgIndex = messages.value.findIndex(m => m.id === userMessageId);
      if (userMsgIndex >= 0) {
        messages.value[userMsgIndex] = {
          ...messages.value[userMsgIndex],
          state: 'sent',
        };
      }

      // 移除待同步隊列
      removePendingMessagesById(userId, charId, [userMessageId]);

      // 3. 更新快取
      if (result && result.history) {
        writeCachedHistory(userId, charId, result.history);
      }

      // 4. 請求 AI 回覆
      await requestReply(userId, charId);

    } catch (error) {
      throw error;
    } finally {
      isReplying.value = false;
    }
  };

  /**
   * 請求 AI 回覆
   */
  const requestReply = async (userId, charId) => {
    try {
      isReplying.value = true;

      // 獲取認證權杖
      const token = await getAuthToken();

      const reply = await requestAiReply(userId, charId, { token });

      if (reply && reply.message) {
        // 添加 AI 回覆到消息列表
        const aiMessage = {
          id: reply.message.id || `ai-${Date.now()}`,
          role: 'partner',
          text: reply.message.text,
          createdAt: reply.message.createdAt || new Date().toISOString(),
        };

        messages.value.push(aiMessage);

        // 更新快取
        if (reply.history) {
          writeCachedHistory(userId, charId, reply.history);
        } else {
          appendCachedHistory(userId, charId, [aiMessage]);
        }
      }

    } catch (error) {
      throw error;
    } finally {
      isReplying.value = false;
    }
  };

  /**
   * 排程待同步消息的同步
   */
  const schedulePendingSync = () => {
    if (pendingRetryTimerId) {
      clearTimeout(pendingRetryTimerId);
    }

    pendingRetryTimerId = setTimeout(() => {
      syncPendingMessages();
    }, 2000); // 2 秒後嘗試同步
  };

  /**
   * 同步所有待同步的消息
   */
  const syncPendingMessages = async () => {
    if (pendingSyncInFlight) return;

    const userId = currentUserId.value;
    const charId = currentPartnerId.value;

    if (!userId || !charId) return;

    const pending = readPendingMessages(userId, charId);
    if (!pending || pending.length === 0) return;

    pendingSyncInFlight = true;

    try {
      // 獲取認證權杖
      const token = await getAuthToken();

      // 提取文字內容
      const messagesToSync = pending.map(m => ({
        role: m.role,
        text: m.text,
      }));

      // 批量發送
      const result = await appendConversationMessages(userId, charId, messagesToSync, { token });

      // 更新消息狀態
      const pendingIds = pending.map(m => m.id);
      messages.value = messages.value.map(m => {
        if (pendingIds.includes(m.id)) {
          return { ...m, state: 'sent' };
        }
        return m;
      });

      // 清除待同步隊列
      clearPendingMessages(userId, charId);

      // 更新快取
      if (result && result.history) {
        writeCachedHistory(userId, charId, result.history);
      }
    } catch (error) {
      // 重試
      schedulePendingSync();
    } finally {
      pendingSyncInFlight = false;
    }
  };

  /**
   * 重置對話
   */
  const resetConversation = async () => {
    const userId = currentUserId.value;
    const charId = currentPartnerId.value;

    if (!userId || !charId) return;

    try {
      // 獲取認證權杖
      const token = await getAuthToken();

      // 調用後端 API 清除對話歷史
      await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/conversations/${encodeURIComponent(userId)}/${encodeURIComponent(charId)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // 清空消息列表
      messages.value = [];

      // 清空快取
      writeCachedHistory(userId, charId, []);
      clearPendingMessages(userId, charId);

      // 重新載入
      await loadHistory();

    } catch (error) {
      throw error;
    }
  };

  /**
   * 清理函數
   */
  const cleanup = () => {
    if (replyTimerId) {
      clearTimeout(replyTimerId);
      replyTimerId = null;
    }
    if (pendingRetryTimerId) {
      clearTimeout(pendingRetryTimerId);
      pendingRetryTimerId = null;
    }
  };

  return {
    // 狀態
    messages,
    isReplying,
    isLoadingHistory,
    loadHistoryError,

    // 方法
    loadHistory,
    sendMessage,
    requestReply,
    resetConversation,
    cleanup,
  };
}
