/**
 * useChatMessages Composable
 *
 * 負責管理聊天消息的核心邏輯
 * 包括：消息列表、發送消息、載入歷史、AI 回覆等
 *
 * 這是一個示範實作，展示如何從 ChatView.vue 中提取消息管理邏輯
 */

import { ref, computed, Ref, unref } from 'vue';
import { useUserProfile } from '../useUserProfile.js';
import { useFirebaseAuth } from '../useFirebaseAuth.js';
import { apiJson } from '../../utils/api.js';
import {
  fetchConversationHistory,
  appendConversationMessages,
  requestAiReply,
} from '../../utils/conversation.js';
import {
  readCachedHistory,
  writeCachedHistory,
  appendCachedHistory,
  readPendingMessages,
  enqueuePendingMessages,
  removePendingMessagesById,
  clearPendingMessages,
} from '../../utils/conversationCache.js';

export function useChatMessages(partnerId: string | Ref<string>) {
  const { user } = useUserProfile();
  const firebaseAuth = useFirebaseAuth();

  /**
   * 獲取認證權杖
   */
  const getAuthToken = async (): Promise<string> => {
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

  /**
   * 合併消息列表，保留臨時的影片 loading 卡片和照片 loading 卡片
   */
  const mergeMessagesPreservingLoadingCards = (
    currentMessages: any[],
    newMessages: any[]
  ): any[] => {
    // 找出所有 loading 狀態的臨時消息
    const loadingMessages = currentMessages.filter(
      m => m.video === 'loading' || m.imageUrl === 'loading'
    );

    // 如果沒有 loading 消息，直接返回新消息
    if (loadingMessages.length === 0) {
      return newMessages;
    }

    // 合併：新消息 + loading 消息
    return [...newMessages, ...loadingMessages];
  };

  // 狀態
  const messages: Ref<any[]> = ref([]);
  const isReplying: Ref<boolean> = ref(false);
  const isLoadingHistory: Ref<boolean> = ref(false);
  const loadHistoryError: Ref<any> = ref(null);

  // 內部變數
  let messageSequence = 0;
  let replyTimerId: number | null = null;
  let historyLoadToken = 0;
  let pendingRetryTimerId: number | null = null;
  let pendingSyncInFlight = false;
  // ✅ 效能優化：追蹤消息重試的 timer，避免組件卸載後繼續執行
  const messageRetryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Computed
  const currentPartnerId = computed(() => {
    // 使用 unref 自動處理 ref 或普通值
    return unref(partnerId);
  });

  const currentUserId = computed(() => user.value?.id);

  /**
   * 載入對話歷史
   */
  const loadHistory = async (): Promise<void> => {
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
  const sendMessage = async (text: string): Promise<void> => {
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
   * 同步消息並獲取 AI 回覆（帶重試機制）
   * @param retryCount - 當前重試次數（內部使用）
   */
  const syncMessageAndGetReply = async (
    userId: string,
    charId: string,
    text: string,
    userMessageId: string,
    retryCount: number = 0
  ): Promise<void> => {
    const MAX_RETRIES = 3; // 最多重試 3 次
    const RETRY_DELAYS = [2000, 5000, 10000]; // 重試延遲：2秒、5秒、10秒

    try {
      isReplying.value = true;

      // 獲取認證權杖
      const token = await getAuthToken();

      // 1. 發送用戶消息到後端
      const result = await appendConversationMessages(userId, charId, [
        { role: 'user', text },
      ], { token });

      // 2. 移除待同步標記，設置為已發送
      const userMsgIndex = messages.value.findIndex(m => m.id === userMessageId);
      if (userMsgIndex >= 0) {
        messages.value[userMsgIndex] = {
          ...messages.value[userMsgIndex],
          state: 'sent',
          retryCount: undefined, // 清除重試計數
        };
      }

      // 移除待同步隊列
      removePendingMessagesById(userId, charId, [userMessageId]);

      // 3. 更新消息列表和快取（✅ 修復：同時更新界面顯示）
      if (result && result.messages && Array.isArray(result.messages)) {
        // ⭐ 關鍵修復：更新界面上的消息列表，同時保留 loading 卡片
        const mergedMessages = mergeMessagesPreservingLoadingCards(messages.value, result.messages);
        messages.value = mergedMessages;
        writeCachedHistory(userId, charId, result.messages);
      }

      // 4. 請求 AI 回覆
      await requestReply(userId, charId);

    } catch (error) {
      console.error(`[useChatMessages] 消息發送失敗 (嘗試 ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);

      // ✅ 更新消息狀態為重試中或失敗
      const userMsgIndex = messages.value.findIndex(m => m.id === userMessageId);
      if (userMsgIndex >= 0) {
        const shouldRetry = retryCount < MAX_RETRIES;

        messages.value[userMsgIndex] = {
          ...messages.value[userMsgIndex],
          state: shouldRetry ? 'retrying' : 'failed',
          retryCount: retryCount + 1,
          error: error instanceof Error ? error.message : '發送失敗',
        };

        // ✅ 如果還有重試機會，延遲後自動重試
        if (shouldRetry) {
          const delay = RETRY_DELAYS[retryCount] || 10000;
          console.log(`[useChatMessages] ${delay / 1000}秒後將自動重試...`);

          // ✅ 效能優化：追蹤 timer 以便在 cleanup 時清理
          const timerId = setTimeout(() => {
            messageRetryTimers.delete(userMessageId); // 執行後移除
            console.log(`[useChatMessages] 開始第 ${retryCount + 2} 次嘗試...`);
            syncMessageAndGetReply(userId, charId, text, userMessageId, retryCount + 1);
          }, delay);
          messageRetryTimers.set(userMessageId, timerId);
        } else {
          // ✅ 修復：達到最大重試次數後，從列表中刪除失敗的消息
          console.error('[useChatMessages] 已達最大重試次數，從列表中刪除失敗消息');
          messages.value = messages.value.filter(m => m.id !== userMessageId);
          // 同時從待同步隊列中刪除
          removePendingMessagesById(userId, charId, [userMessageId]);
        }
      }

      // 不再往外拋出錯誤，避免阻塞後續操作
    } finally {
      isReplying.value = false;
    }
  };

  /**
   * 請求 AI 回覆
   */
  const requestReply = async (userId: string, charId: string): Promise<void> => {
    try {
      isReplying.value = true;

      // 獲取認證權杖
      const token = await getAuthToken();

      const reply = await requestAiReply(userId, charId, { token });

      // ⭐ 修復：優先檢查完整的消息歷史（更安全的邏輯）
      if (reply && reply.messages && Array.isArray(reply.messages)) {
        // 服務器返回了完整的對話歷史，保留 loading 卡片後合併
        const mergedMessages = mergeMessagesPreservingLoadingCards(messages.value, reply.messages);
        messages.value = mergedMessages;
        writeCachedHistory(userId, charId, reply.messages);
      } else if (reply && reply.message) {
        // Fallback: 只返回了單條 AI 回覆，手動添加到列表
        const aiMessage = {
          id: reply.message.id || `ai-${Date.now()}`,
          role: 'partner',
          text: reply.message.text,
          createdAt: reply.message.createdAt || new Date().toISOString(),
        };
        messages.value.push(aiMessage);
        appendCachedHistory(userId, charId, [aiMessage]);
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

      // 清除待同步隊列
      clearPendingMessages(userId, charId);

      // 更新消息列表和快取（✅ 修復：使用服務器返回的完整歷史）
      if (result && result.messages && Array.isArray(result.messages)) {
        // ⭐ 關鍵修復：使用服務器返回的完整消息列表替換本地列表
        messages.value = result.messages;
        writeCachedHistory(userId, charId, result.messages);
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
      // 調用後端 API 清除對話歷史（使用 apiJson 自動處理 CSRF Token）
      await apiJson(
        `/api/conversations/${encodeURIComponent(userId)}/${encodeURIComponent(charId)}`,
        {
          method: 'DELETE',
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
    // ✅ 效能優化：清理所有消息重試的 timer
    messageRetryTimers.forEach((timerId) => {
      clearTimeout(timerId);
    });
    messageRetryTimers.clear();
  };

  /**
   * 手動重試失敗的消息
   * @param messageId - 失敗消息的 ID
   */
  const retryFailedMessage = async (messageId: string): Promise<void> => {
    const userId = currentUserId.value;
    const charId = currentPartnerId.value;

    if (!userId || !charId) {
      console.error('[useChatMessages] 無法重試：缺少 userId 或 charId');
      return;
    }

    // 查找失敗的消息
    const failedMsgIndex = messages.value.findIndex(m => m.id === messageId);
    if (failedMsgIndex < 0) {
      console.error('[useChatMessages] 找不到要重試的消息');
      return;
    }

    const failedMsg = messages.value[failedMsgIndex];
    if (failedMsg.state !== 'failed' && failedMsg.state !== 'retrying') {
      console.warn('[useChatMessages] 消息狀態不是 failed 或 retrying，無需重試');
      return;
    }

    console.log(`[useChatMessages] 手動重試消息: ${messageId}`);

    // 重置消息狀態為 pending，清除錯誤信息
    messages.value[failedMsgIndex] = {
      ...failedMsg,
      state: 'pending',
      retryCount: 0,
      error: undefined,
    };

    // 重新添加到待同步隊列
    enqueuePendingMessages(userId, charId, [messages.value[failedMsgIndex]]);

    // 重新發送（從頭開始，retryCount = 0）
    try {
      await syncMessageAndGetReply(userId, charId, failedMsg.text, messageId, 0);
    } catch (error) {
      console.error('[useChatMessages] 手動重試失敗:', error);
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
    sendMessageToApi: sendMessage, // ✅ 修復：添加別名以兼容 useChatCore
    requestReply,
    retryFailedMessage, // ✅ 新增：手動重試方法
    resetConversation,
    resetConversationApi: resetConversation, // ✅ 修復：添加別名以兼容 useChatCore
    cleanup,
    cleanupMessages: cleanup, // ✅ 修復：添加別名以兼容 useChatCore 的解構
  };
}
