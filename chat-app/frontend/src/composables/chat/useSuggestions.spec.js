/**
 * useSuggestions Composable 測試
 *
 * 測試範圍：
 * - 建議載入（API 成功、快取、回退）
 * - 建議簽名生成
 * - 建議項目正規化
 * - 錯誤處理
 * - 無效化和請求取消
 * - 邊界情況（無用戶、無角色、空消息）
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';

// Mock dependencies
vi.mock('../../utils/conversation', () => ({
  requestAiSuggestions: vi.fn(),
}));

vi.mock('../../config/chat.js', () => ({
  SUGGESTION_CONFIG: {
    MAX_ITEMS: 3,
    SIGNATURE_WINDOW: 6,
    FALLBACK_SUGGESTIONS: ['你好！', '還好嗎？', '最近如何？'],
  },
}));

describe('useSuggestions - AI 建議回覆測試', () => {
  let useSuggestions;
  let conversationUtils;
  let mockMessages;
  let mockPartner;
  let mockFirebaseAuth;
  let mockCurrentUserId;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // 獲取 mock modules
    const convUtils = await import('../../utils/conversation');
    conversationUtils = convUtils;

    // 設置默認 mock 返回值
    conversationUtils.requestAiSuggestions.mockResolvedValue({
      suggestions: ['建議 1', '建議 2', '建議 3'],
      fallback: false,
    });

    // 創建測試用的 refs
    mockMessages = ref([
      { id: 'msg-1', role: 'user', text: 'Hello' },
      { id: 'msg-2', role: 'partner', text: 'Hi there!' },
    ]);

    mockPartner = ref({
      id: 'char-001',
      display_name: '測試角色',
    });

    mockFirebaseAuth = {
      getCurrentUserIdToken: vi.fn(async () => 'mock-token-123'),
    };

    mockCurrentUserId = ref('user-123');

    // 導入 composable
    const { useSuggestions: composable } = await import('./useSuggestions.js');
    useSuggestions = composable;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始狀態', () => {
    it('應該初始化為空狀態', () => {
      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);

      expect(suggestions.suggestionOptions.value).toEqual([]);
      expect(suggestions.isLoadingSuggestions.value).toBe(false);
      expect(suggestions.suggestionError.value).toBeNull();
      expect(suggestions.hasCachedSuggestions.value).toBe(false);
    });

    it('應該暴露所有必要的方法', () => {
      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);

      expect(suggestions.loadSuggestions).toBeDefined();
      expect(suggestions.selectSuggestion).toBeDefined();
      expect(suggestions.invalidateSuggestions).toBeDefined();
    });
  });

  describe('loadSuggestions', () => {
    it('應該成功載入 AI 建議', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: ['建議 A', '建議 B', '建議 C'],
        fallback: false,
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['建議 A', '建議 B', '建議 C']);
      expect(suggestions.isLoadingSuggestions.value).toBe(false);
      expect(suggestions.suggestionError.value).toBeNull();
      expect(conversationUtils.requestAiSuggestions).toHaveBeenCalledWith(
        'user-123',
        'char-001',
        expect.objectContaining({
          token: 'mock-token-123',
          count: 3,
        })
      );
    });

    it('應該使用快取（簽名相同時）', async () => {
      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);

      // 第一次載入
      await suggestions.loadSuggestions();
      expect(conversationUtils.requestAiSuggestions).toHaveBeenCalledTimes(1);

      // 第二次載入（消息未變化）
      await suggestions.loadSuggestions();
      expect(conversationUtils.requestAiSuggestions).toHaveBeenCalledTimes(1); // 不應該再次調用
    });

    it('應該在消息變化後重新載入', async () => {
      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);

      // 第一次載入
      await suggestions.loadSuggestions();
      expect(conversationUtils.requestAiSuggestions).toHaveBeenCalledTimes(1);

      // 添加新消息
      mockMessages.value.push({ id: 'msg-3', role: 'user', text: 'New message' });

      // 第二次載入（簽名變化）
      await suggestions.loadSuggestions();
      expect(conversationUtils.requestAiSuggestions).toHaveBeenCalledTimes(2);
    });

    it('應該在沒有 matchId 時返回預設選項', async () => {
      mockPartner.value = { id: '' }; // 空 matchId

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
      expect(suggestions.suggestionError.value).toContain('尚未選擇聊天對象');
      expect(conversationUtils.requestAiSuggestions).not.toHaveBeenCalled();
    });

    it('應該在沒有 userId 時返回預設選項', async () => {
      mockCurrentUserId.value = '';

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
      expect(suggestions.suggestionError.value).toContain('請登入');
      expect(conversationUtils.requestAiSuggestions).not.toHaveBeenCalled();
    });

    it('應該在 API 返回空結果時使用預設選項', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: [],
        fallback: true,
        message: '暫時無建議',
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
      expect(suggestions.suggestionError.value).toBe('暫時無建議');
    });

    it('應該處理 API 錯誤', async () => {
      conversationUtils.requestAiSuggestions.mockRejectedValueOnce(new Error('API 錯誤'));

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
      expect(suggestions.suggestionError.value).toBe('API 錯誤');
    });

    it('應該處理非 Error 對象的錯誤', async () => {
      conversationUtils.requestAiSuggestions.mockRejectedValueOnce('字符串錯誤');

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
      expect(suggestions.suggestionError.value).toContain('發生錯誤');
    });
  });

  describe('正規化功能', () => {
    it('應該正規化字符串陣列', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: ['建議 1', '建議 2', '建議 3'],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['建議 1', '建議 2', '建議 3']);
    });

    it('應該正規化對象陣列（text 欄位）', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: [
          { text: '建議 A' },
          { text: '建議 B' },
          { text: '建議 C' },
        ],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['建議 A', '建議 B', '建議 C']);
    });

    it('應該正規化對象陣列（message 欄位）', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: [
          { message: '建議 X' },
          { message: '建議 Y' },
        ],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['建議 X', '建議 Y']);
    });

    it('應該去除重複的建議', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: ['建議 1', '建議 2', '建議 1', '建議 3'],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['建議 1', '建議 2', '建議 3']);
    });

    it('應該限制建議長度為 200 字', async () => {
      const longText = 'A'.repeat(250);
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: [longText],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value[0].length).toBe(200);
    });

    it('應該限制最多 3 個建議項目', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: ['1', '2', '3', '4', '5'],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['1', '2', '3']);
    });

    it('應該過濾空字符串', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: ['建議 1', '', '建議 2', '   ', '建議 3'],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['建議 1', '建議 2', '建議 3']);
    });

    it('應該修剪建議文本', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: ['  建議 1  ', '\n建議 2\n', '\t建議 3\t'],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['建議 1', '建議 2', '建議 3']);
    });
  });

  describe('invalidateSuggestions', () => {
    it('應該清除所有建議狀態', async () => {
      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);

      // 先載入建議
      await suggestions.loadSuggestions();
      expect(suggestions.suggestionOptions.value.length).toBeGreaterThan(0);

      // 清除
      suggestions.invalidateSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual([]);
      expect(suggestions.isLoadingSuggestions.value).toBe(false);
      expect(suggestions.suggestionError.value).toBeNull();
    });

    it('應該取消進行中的請求', async () => {
      conversationUtils.requestAiSuggestions.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ suggestions: ['延遲建議'] }), 1000))
      );

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);

      // 啟動請求
      const loadPromise = suggestions.loadSuggestions();

      // 立即取消
      suggestions.invalidateSuggestions();

      await loadPromise;

      // 結果應該被取消，不應該更新狀態
      expect(suggestions.suggestionOptions.value).toEqual([]);
    });
  });

  describe('selectSuggestion', () => {
    it('應該返回選中的建議', () => {
      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      const selected = suggestions.selectSuggestion('測試建議');

      expect(selected).toBe('測試建議');
    });
  });

  describe('hasCachedSuggestions', () => {
    it('應該在有建議時返回 true', async () => {
      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);

      expect(suggestions.hasCachedSuggestions.value).toBe(false);

      await suggestions.loadSuggestions();

      expect(suggestions.hasCachedSuggestions.value).toBe(true);
    });

    it('應該在清除後返回 false', async () => {
      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);

      await suggestions.loadSuggestions();
      expect(suggestions.hasCachedSuggestions.value).toBe(true);

      suggestions.invalidateSuggestions();
      expect(suggestions.hasCachedSuggestions.value).toBe(false);
    });
  });

  describe('建議簽名', () => {
    it('應該基於消息內容生成簽名', async () => {
      const suggestions1 = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions1.loadSuggestions();

      // 添加新消息改變簽名
      mockMessages.value.push({ id: 'msg-3', role: 'user', text: 'New' });

      const suggestions2 = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions2.loadSuggestions();

      // 應該調用 2 次 API（簽名不同）
      expect(conversationUtils.requestAiSuggestions).toHaveBeenCalledTimes(2);
    });

    it('應該基於 partnerId 生成簽名', async () => {
      const suggestions1 = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions1.loadSuggestions();

      // 改變 partner
      mockPartner.value = { id: 'char-002', display_name: '另一個角色' };

      const suggestions2 = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions2.loadSuggestions();

      // 應該調用 2 次 API（簽名不同）
      expect(conversationUtils.requestAiSuggestions).toHaveBeenCalledTimes(2);
    });
  });

  describe('邊界情況', () => {
    it('應該處理空消息列表', async () => {
      mockMessages.value = [];

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value.length).toBeGreaterThan(0);
    });

    it('應該處理 partner 為 null', async () => {
      mockPartner.value = null;

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
      expect(suggestions.suggestionError.value).toContain('尚未選擇聊天對象');
    });

    it('應該處理 currentUserId 為 null', async () => {
      mockCurrentUserId.value = null;

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
      expect(suggestions.suggestionError.value).toContain('請登入');
    });

    it('應該處理 API 返回 null', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce(null);

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
    });

    it('應該處理 suggestions 欄位缺失', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        fallback: false,
        // 沒有 suggestions 欄位
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual(['你好！', '還好嗎？', '最近如何？']);
    });

    it('應該處理混合格式的建議陣列', async () => {
      conversationUtils.requestAiSuggestions.mockResolvedValueOnce({
        suggestions: [
          '字符串建議',
          { text: '對象建議 1' },
          { message: '對象建議 2' },
          { content: '對象建議 3' },
          null, // 無效
          undefined, // 無效
          {}, // 無效（無有效欄位）
        ],
      });

      const suggestions = useSuggestions(mockMessages, mockPartner, mockFirebaseAuth, mockCurrentUserId);
      await suggestions.loadSuggestions();

      expect(suggestions.suggestionOptions.value).toEqual([
        '字符串建議',
        '對象建議 1',
        '對象建議 2',
      ]);
    });
  });
});
