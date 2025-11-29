/**
 * useChatMessages Composable 測試
 *
 * 測試範圍：
 * - 消息載入（快取、伺服器、待同步消息）
 * - 消息發送與狀態管理
 * - AI 回覆請求
 * - 自動重試機制（最多 3 次）
 * - 手動重試失敗消息
 * - 對話重置
 * - 錯誤處理
 * - 清理函數
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { nextTick } from 'vue';

// Mock dependencies
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: { partnerId: 'char-001' },
  })),
}));

vi.mock('../useUserProfile', () => ({
  useUserProfile: vi.fn(() => ({
    user: { value: { id: 'user-123', email: 'user@example.com' } },
  })),
}));

vi.mock('../useFirebaseAuth', () => ({
  useFirebaseAuth: vi.fn(() => ({
    getCurrentUserIdToken: vi.fn(async () => 'mock-token-123'),
  })),
}));

vi.mock('../../utils/conversation', () => ({
  fetchConversationHistory: vi.fn(),
  appendConversationMessages: vi.fn(),
  requestAiReply: vi.fn(),
}));

vi.mock('../../utils/conversationCache', () => ({
  readCachedHistory: vi.fn(),
  writeCachedHistory: vi.fn(),
  appendCachedHistory: vi.fn(),
  readPendingMessages: vi.fn(),
  enqueuePendingMessages: vi.fn(),
  removePendingMessagesById: vi.fn(),
  clearPendingMessages: vi.fn(),
}));

// Mock ApiCache service to prevent timer conflicts with vi.useFakeTimers()
vi.mock('../../services/apiCache.service', () => ({
  apiCache: {
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(() => false),
    delete: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn(() => ({ size: 0, hits: 0, misses: 0 })),
  },
  cacheKeys: {},
  cacheTTL: {},
}));

describe('useChatMessages - 聊天消息管理測試', () => {
  let useChatMessages: any;
  let conversationUtils: any;
  let cacheUtils: any;
  let useUserProfile: Mock;
  let useFirebaseAuth: Mock;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // 重置定時器
    vi.useFakeTimers();

    // 獲取 mock modules
    const convUtils = await import('../../utils/conversation');
    const cachUtils = await import('../../utils/conversationCache');
    const userProfile = await import('../useUserProfile');
    const firebaseAuth = await import('../useFirebaseAuth');

    conversationUtils = convUtils;
    cacheUtils = cachUtils;
    useUserProfile = userProfile.useUserProfile as Mock;
    useFirebaseAuth = firebaseAuth.useFirebaseAuth as Mock;

    // 設置默認 mock 返回值
    conversationUtils.fetchConversationHistory.mockResolvedValue([]);
    conversationUtils.appendConversationMessages.mockResolvedValue({
      history: [],
    });
    conversationUtils.requestAiReply.mockResolvedValue({
      message: {
        id: 'ai-msg-1',
        text: 'AI reply',
        createdAt: new Date().toISOString(),
      },
      history: [],
    });

    cacheUtils.readCachedHistory.mockReturnValue(null);
    cacheUtils.readPendingMessages.mockReturnValue(null);

    // 導入 composable
    const { useChatMessages: composable } = await import('./useChatMessages.js');
    useChatMessages = composable;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('初始狀態', () => {
    it('應該初始化為空狀態', () => {
      const chat = useChatMessages('char-001');

      expect(chat.messages.value).toEqual([]);
      expect(chat.isReplying.value).toBe(false);
      expect(chat.isLoadingHistory.value).toBe(false);
      expect(chat.loadHistoryError.value).toBeNull();
    });

    it('應該暴露所有必要的方法', () => {
      const chat = useChatMessages('char-001');

      expect(chat.loadHistory).toBeDefined();
      expect(chat.sendMessage).toBeDefined();
      expect(chat.requestReply).toBeDefined();
      expect(chat.retryFailedMessage).toBeDefined();
      expect(chat.resetConversation).toBeDefined();
      expect(chat.cleanup).toBeDefined();
    });
  });

  describe('loadHistory', () => {
    it('應該成功載入對話歷史（無快取）', async () => {
      const mockHistory = [
        { id: 'msg-1', role: 'user', text: 'Hello', createdAt: '2025-01-13' },
        { id: 'msg-2', role: 'partner', text: 'Hi!', createdAt: '2025-01-13' },
      ];

      conversationUtils.fetchConversationHistory.mockResolvedValueOnce(mockHistory);

      const chat = useChatMessages('char-001');
      await chat.loadHistory();

      expect(chat.messages.value).toEqual(mockHistory);
      expect(conversationUtils.fetchConversationHistory).toHaveBeenCalledWith('user-123', 'char-001');
      expect(cacheUtils.writeCachedHistory).toHaveBeenCalledWith('user-123', 'char-001', mockHistory);
    });

    it('應該優先從快取載入歷史', async () => {
      const cachedHistory = [
        { id: 'msg-1', role: 'user', text: 'Cached message', createdAt: '2025-01-13' },
      ];
      const serverHistory = [
        { id: 'msg-1', role: 'user', text: 'Cached message', createdAt: '2025-01-13' },
        { id: 'msg-2', role: 'partner', text: 'Server message', createdAt: '2025-01-13' },
      ];

      cacheUtils.readCachedHistory.mockReturnValueOnce(cachedHistory);
      conversationUtils.fetchConversationHistory.mockResolvedValueOnce(serverHistory);

      const chat = useChatMessages('char-001');
      await chat.loadHistory();

      // 應該先顯示快取，然後更新為伺服器數據
      expect(chat.messages.value).toEqual(serverHistory);
    });

    it('應該載入待同步的消息', async () => {
      const serverHistory = [
        { id: 'msg-1', role: 'user', text: 'Synced message', createdAt: '2025-01-13' },
      ];
      const pendingMessages = [
        { id: 'msg-2', role: 'user', text: 'Pending message', state: 'pending', createdAt: '2025-01-13' },
      ];

      conversationUtils.fetchConversationHistory.mockResolvedValueOnce(serverHistory);
      cacheUtils.readPendingMessages.mockReturnValueOnce(pendingMessages);

      const chat = useChatMessages('char-001');
      await chat.loadHistory();

      expect(chat.messages.value).toEqual([...serverHistory, ...pendingMessages]);
    });

    it('應該處理載入錯誤', async () => {
      const error = new Error('Network error');
      conversationUtils.fetchConversationHistory.mockRejectedValueOnce(error);

      const chat = useChatMessages('char-001');
      await chat.loadHistory();

      expect(chat.loadHistoryError.value).toBe(error);
    });

    it('應該在缺少 userId 或 partnerId 時不載入', async () => {
      useUserProfile.mockReturnValueOnce({
        user: { value: null },
      });

      const chat = useChatMessages('char-001');
      await chat.loadHistory();

      expect(conversationUtils.fetchConversationHistory).not.toHaveBeenCalled();
    });

    it('應該防止並發載入', async () => {
      const chat = useChatMessages('char-001');

      const promise1 = chat.loadHistory();
      const promise2 = chat.loadHistory();

      await Promise.all([promise1, promise2]);

      // 只應該調用一次
      expect(conversationUtils.fetchConversationHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendMessage', () => {
    it('應該成功發送消息（完整流程）', async () => {
      conversationUtils.appendConversationMessages.mockResolvedValueOnce({
        history: [{ id: 'msg-1', role: 'user', text: 'Hello', createdAt: '2025-01-13' }],
      });
      conversationUtils.requestAiReply.mockResolvedValueOnce({
        message: { id: 'ai-1', text: 'AI reply', createdAt: '2025-01-13' },
        history: [],
      });

      const chat = useChatMessages('char-001');
      await chat.sendMessage('Hello');

      await vi.runAllTimersAsync();
      await nextTick();

      expect(chat.messages.value.length).toBeGreaterThan(0);
      expect(chat.messages.value[0].text).toBe('Hello');
      expect(chat.messages.value[0].role).toBe('user');
    });

    it('應該拒絕空消息', async () => {
      const chat = useChatMessages('char-001');
      await chat.sendMessage('');

      expect(conversationUtils.appendConversationMessages).not.toHaveBeenCalled();
    });

    it('應該拒絕純空白消息', async () => {
      const chat = useChatMessages('char-001');
      await chat.sendMessage('   ');

      expect(conversationUtils.appendConversationMessages).not.toHaveBeenCalled();
    });

    it('應該修剪消息文本', async () => {
      conversationUtils.appendConversationMessages.mockResolvedValueOnce({
        history: [],
      });

      const chat = useChatMessages('char-001');
      await chat.sendMessage('  Hello  ');

      await vi.runAllTimersAsync();

      expect(conversationUtils.appendConversationMessages).toHaveBeenCalledWith(
        'user-123',
        'char-001',
        [{ role: 'user', text: 'Hello' }],
        { token: 'mock-token-123' }
      );
    });

    it('應該將消息加入待同步隊列', async () => {
      const chat = useChatMessages('char-001');
      await chat.sendMessage('Test message');

      await vi.runAllTimersAsync();

      expect(cacheUtils.enqueuePendingMessages).toHaveBeenCalled();
    });

    it('應該在發送成功後移除待同步標記', async () => {
      conversationUtils.appendConversationMessages.mockResolvedValueOnce({
        history: [{ id: 'msg-1', role: 'user', text: 'Test', createdAt: '2025-01-13' }],
      });
      conversationUtils.requestAiReply.mockResolvedValueOnce({
        message: { id: 'ai-1', text: 'Reply', createdAt: '2025-01-13' },
      });

      const chat = useChatMessages('char-001');
      await chat.sendMessage('Test');

      await vi.runAllTimersAsync();
      await nextTick();

      expect(cacheUtils.removePendingMessagesById).toHaveBeenCalled();
    });
  });

  describe('requestReply', () => {
    it('應該成功獲取 AI 回覆', async () => {
      const mockReply = {
        message: {
          id: 'ai-msg-1',
          text: 'AI response',
          createdAt: '2025-01-13T10:00:00Z',
        },
        messages: [{ id: 'ai-msg-1', role: 'partner', text: 'AI response' }], // ✅ 修復：應該是 messages 而不是 history
      };

      conversationUtils.requestAiReply.mockResolvedValueOnce(mockReply);

      const chat = useChatMessages('char-001');
      await chat.requestReply('user-123', 'char-001');

      expect(chat.messages.value.length).toBe(1);
      expect(chat.messages.value[0].role).toBe('partner');
      expect(chat.messages.value[0].text).toBe('AI response');
      expect(cacheUtils.writeCachedHistory).toHaveBeenCalled();
    });

    it('應該在 AI 回覆完成後重置 isReplying 狀態', async () => {
      conversationUtils.requestAiReply.mockResolvedValueOnce({
        message: {
          id: 'ai-1',
          text: 'Reply',
          createdAt: '2025-01-13',
        },
      });

      const chat = useChatMessages('char-001');

      // 初始狀態應該為 false
      expect(chat.isReplying.value).toBe(false);

      // 發起請求
      await chat.requestReply('user-123', 'char-001');

      // 完成後應該重置為 false
      expect(chat.isReplying.value).toBe(false);
      expect(chat.messages.value[0].text).toBe('Reply');
    });

    it('應該處理 AI 回覆錯誤', async () => {
      conversationUtils.requestAiReply.mockRejectedValueOnce(new Error('AI error'));

      const chat = useChatMessages('char-001');

      await expect(
        chat.requestReply('user-123', 'char-001')
      ).rejects.toThrow('AI error');
    });
  });

  describe('重試機制', () => {
    it.skip('應該在發送失敗時自動重試', async () => {
      // ✅ 2025-11-24 修復：已移除自動重試機制
      // 新行為：發送失敗時直接刪除消息
      // 此測試基於舊的自動重試行為，已過時
      conversationUtils.appendConversationMessages
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ history: [] });

      const chat = useChatMessages('char-001');
      await chat.sendMessage('Test');

      await vi.runAllTimersAsync();
      await nextTick();

      // 第一次失敗後應該自動重試
      expect(chat.messages.value[0].state).toBe('sent');
    });

    it.skip('應該在達到最大重試次數後標記為失敗', async () => {
      // ✅ 2025-11-24 修復：已移除自動重試機制
      // 新行為：發送失敗時直接刪除消息
      // 此測試基於舊的自動重試行為，已過時
      conversationUtils.appendConversationMessages.mockRejectedValue(new Error('Network error'));

      const chat = useChatMessages('char-001');
      await chat.sendMessage('Test');

      // 執行所有重試
      await vi.runAllTimersAsync();
      await nextTick();

      // 應該標記為失敗
      const failedMsg = chat.messages.value.find((m: any) => m.text === 'Test');
      expect(failedMsg.state).toBe('failed');
      expect(failedMsg.retryCount).toBe(4); // 初始 + 3 次重試
    });

    it.skip('應該使用遞增的重試延遲', async () => {
      // ✅ 2025-11-24 修復：已移除自動重試機制
      // 新行為：發送失敗時直接刪除消息
      // 此測試基於舊的自動重試行為，已過時
      conversationUtils.appendConversationMessages.mockRejectedValue(new Error('Network error'));

      const chat = useChatMessages('char-001');
      await chat.sendMessage('Test');

      // 第一次重試：2000ms
      await vi.advanceTimersByTimeAsync(2000);
      expect(conversationUtils.appendConversationMessages).toHaveBeenCalledTimes(2);

      // 第二次重試：5000ms
      await vi.advanceTimersByTimeAsync(5000);
      expect(conversationUtils.appendConversationMessages).toHaveBeenCalledTimes(3);

      // 第三次重試：10000ms
      await vi.advanceTimersByTimeAsync(10000);
      expect(conversationUtils.appendConversationMessages).toHaveBeenCalledTimes(4);
    });

    it('應該在發送失敗時刪除消息（新行為）', async () => {
      // ✅ 2025-11-24 修復：發送失敗時直接刪除消息
      conversationUtils.appendConversationMessages.mockRejectedValue(new Error('Network error'));

      const chat = useChatMessages('char-001');
      await chat.sendMessage('Test');

      await nextTick();

      // 新行為：消息應該被刪除
      expect(chat.messages.value.length).toBe(0);
      expect(conversationUtils.appendConversationMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryFailedMessage', () => {
    it('應該成功重試失敗的消息', async () => {
      conversationUtils.appendConversationMessages.mockResolvedValueOnce({ history: [] });

      const chat = useChatMessages('char-001');

      // 手動添加一個失敗的消息
      chat.messages.value.push({
        id: 'failed-msg-1',
        role: 'user',
        text: 'Failed message',
        state: 'failed',
        retryCount: 4,
        error: 'Network error',
      });

      await chat.retryFailedMessage('failed-msg-1');
      await vi.runAllTimersAsync();

      const retriedMsg = chat.messages.value.find((m: any) => m.id === 'failed-msg-1');
      expect(retriedMsg.state).toBe('sent');
      expect(retriedMsg.retryCount).toBeUndefined();
    });

    it('應該在消息不存在時不重試', async () => {
      const chat = useChatMessages('char-001');
      await chat.retryFailedMessage('non-existent-id');

      expect(conversationUtils.appendConversationMessages).not.toHaveBeenCalled();
    });

    it('應該只重試失敗狀態的消息', async () => {
      const chat = useChatMessages('char-001');

      // 添加已發送的消息
      chat.messages.value.push({
        id: 'sent-msg-1',
        role: 'user',
        text: 'Sent message',
        state: 'sent',
      });

      await chat.retryFailedMessage('sent-msg-1');

      expect(conversationUtils.appendConversationMessages).not.toHaveBeenCalled();
    });
  });

  describe('resetConversation', () => {
    it('應該成功重置對話', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as any)
      ) as any;

      conversationUtils.fetchConversationHistory.mockResolvedValueOnce([]);

      const chat = useChatMessages('char-001');

      // 添加一些消息
      chat.messages.value = [
        { id: 'msg-1', text: 'Test 1' },
        { id: 'msg-2', text: 'Test 2' },
      ];

      await chat.resetConversation();

      expect(chat.messages.value).toEqual([]);
      expect(cacheUtils.writeCachedHistory).toHaveBeenCalledWith('user-123', 'char-001', []);
      expect(cacheUtils.clearPendingMessages).toHaveBeenCalledWith('user-123', 'char-001');
    });

    it('應該在重置後重新載入歷史', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as any)
      ) as any;

      const chat = useChatMessages('char-001');
      await chat.resetConversation();

      expect(conversationUtils.fetchConversationHistory).toHaveBeenCalled();
    });

    it('應該處理重置錯誤', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Reset failed'))) as any;

      const chat = useChatMessages('char-001');

      await expect(chat.resetConversation()).rejects.toThrow('Reset failed');
    });
  });

  describe('認證權杖處理', () => {
    it('應該使用 Firebase token', async () => {
      useFirebaseAuth.mockReturnValueOnce({
        getCurrentUserIdToken: vi.fn(async () => 'firebase-token-abc'),
      });

      const { useChatMessages: composable } = await import('./useChatMessages.js');
      const chat = composable('char-001');

      await chat.sendMessage('Test');
      await vi.runAllTimersAsync();

      expect(conversationUtils.appendConversationMessages).toHaveBeenCalledWith(
        'user-123',
        'char-001',
        [{ role: 'user', text: 'Test' }],
        { token: 'firebase-token-abc' }
      );
    });

    it.skip('應該在無法獲取 token 時標記消息為失敗', async () => {
      // ✅ 2025-11-24 修復：發送失敗時直接刪除消息
      // 新行為：無法獲取 token 會導致消息被刪除
      // 此測試基於舊的失敗標記行為，已過時
      useFirebaseAuth.mockReturnValueOnce({
        getCurrentUserIdToken: vi.fn(async () => null),
      });

      const { useChatMessages: composable } = await import('./useChatMessages.js');
      const chat = composable('char-001');

      await chat.sendMessage('Test');
      await vi.runAllTimersAsync();

      // 所有重試耗盡後，消息應該標記為失敗
      const msg = chat.messages.value.find((m: any) => m.text === 'Test');
      expect(msg.state).toBe('failed');
      expect(msg.error).toBeDefined();
    });

    it('應該在無法獲取 token 時刪除消息（新行為）', async () => {
      // ✅ 2025-11-24 修復：發送失敗時直接刪除消息
      useFirebaseAuth.mockReturnValueOnce({
        getCurrentUserIdToken: vi.fn(async () => null),
      });

      const { useChatMessages: composable } = await import('./useChatMessages.js');
      const chat = composable('char-001');

      await chat.sendMessage('Test');
      await nextTick();

      // 新行為：消息應該被刪除
      expect(chat.messages.value.length).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('應該清理所有定時器', () => {
      const chat = useChatMessages('char-001');
      chat.cleanup();

      // 不應該拋出錯誤
      expect(true).toBe(true);
    });
  });

  describe('邊界情況', () => {
    it('應該處理 partnerId 為 ref 的情況', () => {
      const partnerIdRef = { value: 'char-002' };
      const chat = useChatMessages(partnerIdRef);

      expect(chat).toBeDefined();
    });

    it('應該處理空的伺服器響應', async () => {
      conversationUtils.fetchConversationHistory.mockResolvedValueOnce([]);

      const chat = useChatMessages('char-001');
      await chat.loadHistory();

      expect(chat.messages.value).toEqual([]);
    });

    it('應該處理沒有 history 的 AI 回覆', async () => {
      conversationUtils.requestAiReply.mockResolvedValueOnce({
        message: {
          id: 'ai-1',
          text: 'Reply without history',
          createdAt: '2025-01-13',
        },
        // 沒有 history 欄位
      });

      const chat = useChatMessages('char-001');
      await chat.requestReply('user-123', 'char-001');

      expect(chat.messages.value[0].text).toBe('Reply without history');
      expect(cacheUtils.appendCachedHistory).toHaveBeenCalled();
    });
  });
});
