/**
 * useConversationLimit Composable 測試
 *
 * 測試範圍：
 * - 限制檢查
 * - 統計數據查詢
 * - 廣告解鎖（三步驟流程）
 * - 限制狀態管理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock dependencies
vi.mock('../utils/api', () => ({
  apiJson: vi.fn(),
}));

vi.mock('./useBaseLimitService.js', () => ({
  createLimitService: vi.fn((config: any) => {
    const limitData = { value: {} as Record<string, any> };
    const isLoading = { value: false };
    const error = { value: null };

    return {
      limitData,
      isLoading,
      error,
      checkLimit: vi.fn(async (userId: string, characterId: string) => {
        const key = `${userId}::${characterId}`;
        limitData.value[key] = {
          canSend: true,
          remaining: 10,
          limit: 20,
        };
        return limitData.value[key];
      }),
      getStats: vi.fn(async () => ({
        totalConversations: 5,
        totalMessages: 50,
      })),
      unlockByAd: vi.fn(async () => ({ success: true })),
      clearState: vi.fn((userId: string, characterId: string) => {
        const key = `${userId}::${characterId}`;
        delete limitData.value[key];
      }),
      getLimitData: vi.fn((userId: string, characterId: string) => {
        const key = `${userId}::${characterId}`;
        return limitData.value[key] || null;
      }),
    };
  }),
}));

describe('useConversationLimit - 對話限制測試', () => {
  let useConversationLimit: any;
  let apiJson: Mock;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const { apiJson: mockApiJson } = await import('../utils/api');
    apiJson = mockApiJson as Mock;

    const { useConversationLimit: composable } = await import('./useConversationLimit.js');
    useConversationLimit = composable;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始狀態', () => {
    it('應該初始化為空狀態', () => {
      const limit = useConversationLimit();

      expect(limit.limits.value).toEqual({});
      expect(limit.isLoading.value).toBe(false);
      expect(limit.error.value).toBeNull();
    });
  });

  describe('checkLimit', () => {
    it('應該成功檢查對話限制', async () => {
      const limit = useConversationLimit();

      const result = await limit.checkLimit('user-123', 'char-001');

      expect(result).toBeDefined();
      expect(result.canSend).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.limit).toBe(20);
    });

    it('應該按用戶和角色儲存限制狀態', async () => {
      const limit = useConversationLimit();

      await limit.checkLimit('user-123', 'char-001');
      await limit.checkLimit('user-123', 'char-002');

      expect(limit.limits.value['user-123::char-001']).toBeDefined();
      expect(limit.limits.value['user-123::char-002']).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('應該成功獲取統計數據', async () => {
      const limit = useConversationLimit();

      const result = await limit.getStats();

      expect(result).toBeDefined();
      expect(result.totalConversations).toBe(5);
      expect(result.totalMessages).toBe(50);
    });
  });

  describe('unlockByAd - 廣告解鎖', () => {
    it('應該成功完成完整的廣告解鎖流程', async () => {
      const limit = useConversationLimit();

      // Mock 三步驟 API 調用
      apiJson
        .mockResolvedValueOnce({ adId: 'ad-123' }) // 步驟 1: watch
        .mockResolvedValueOnce({ verified: true }) // 步驟 2: verify
        .mockResolvedValueOnce({ // 步驟 3: claim
          success: true,
          reward: { conversations: 5 },
          message: '已成功解鎖 5 次對話',
        });

      const result = await limit.unlockByAd('user-123', 'char-001');

      expect(apiJson).toHaveBeenCalledTimes(3);

      // 驗證步驟 1: watch
      expect(apiJson).toHaveBeenNthCalledWith(1, '/api/ads/watch', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          characterId: 'char-001',
          adType: 'rewarded_ad',
        }),
      }));

      // 驗證步驟 2: verify
      expect(apiJson).toHaveBeenNthCalledWith(2, '/api/ads/verify', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          adId: 'ad-123',
        }),
      }));

      // 驗證步驟 3: claim
      expect(apiJson).toHaveBeenNthCalledWith(3, '/api/ads/claim', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          adId: 'ad-123',
        }),
      }));

      expect(result.success).toBe(true);
      expect(result.adId).toBe('ad-123');
    });

    it('應該支持已有 adId 的快速流程', async () => {
      const limit = useConversationLimit();

      // 已有 adId，跳過步驟 1
      apiJson
        .mockResolvedValueOnce({ verified: true }) // 步驟 2: verify
        .mockResolvedValueOnce({ // 步驟 3: claim
          success: true,
          reward: { conversations: 5 },
        });

      const result = await limit.unlockByAd('user-123', 'char-001', 'existing-ad-id');

      expect(apiJson).toHaveBeenCalledTimes(2); // 只有 verify 和 claim
      expect(result.adId).toBe('existing-ad-id');
    });

    it('應該在未提供 userId 時拋出錯誤', async () => {
      const limit = useConversationLimit();

      await expect(
        limit.unlockByAd(null, 'char-001')
      ).rejects.toThrow('需要提供用戶 ID 和角色 ID');
    });

    it('應該在未提供 characterId 時拋出錯誤', async () => {
      const limit = useConversationLimit();

      await expect(
        limit.unlockByAd('user-123', null)
      ).rejects.toThrow('需要提供用戶 ID 和角色 ID');
    });

    it('應該在無法獲取廣告 ID 時拋出錯誤', async () => {
      const limit = useConversationLimit();

      // watch API 沒有返回 adId
      apiJson.mockResolvedValueOnce({});

      await expect(
        limit.unlockByAd('user-123', 'char-001')
      ).rejects.toThrow('無法獲取廣告 ID');
    });

    it('應該在廣告驗證失敗時拋出錯誤', async () => {
      const limit = useConversationLimit();

      apiJson
        .mockResolvedValueOnce({ adId: 'ad-123' }) // 步驟 1: watch
        .mockRejectedValueOnce(new Error('廣告驗證失敗')); // 步驟 2: verify 失敗

      await expect(
        limit.unlockByAd('user-123', 'char-001')
      ).rejects.toThrow('廣告驗證失敗');

      expect(limit.error.value).toBe('廣告驗證失敗');
    });

    it('應該在解鎖成功後刷新限制狀態', async () => {
      const limit = useConversationLimit();

      apiJson
        .mockResolvedValueOnce({ adId: 'ad-123' })
        .mockResolvedValueOnce({ verified: true })
        .mockResolvedValueOnce({
          success: true,
          reward: { conversations: 5 },
        });

      await limit.unlockByAd('user-123', 'char-001');

      // checkLimit 應該被調用以刷新狀態
      expect(limit.limits.value['user-123::char-001']).toBeDefined();
    });
  });

  describe('getLimitState', () => {
    it('應該返回指定角色的限制狀態', async () => {
      const limit = useConversationLimit();

      await limit.checkLimit('user-123', 'char-001');
      const state = limit.getLimitState('user-123', 'char-001');

      expect(state).toBeDefined();
      expect(state.canSend).toBe(true);
      expect(state.remaining).toBe(10);
    });

    it('應該在沒有狀態時返回 null', () => {
      const limit = useConversationLimit();

      const state = limit.getLimitState('user-123', 'char-999');

      expect(state).toBeNull();
    });
  });

  describe('clearLimitState', () => {
    it('應該清除指定角色的限制狀態', async () => {
      const limit = useConversationLimit();

      await limit.checkLimit('user-123', 'char-001');
      expect(limit.limits.value['user-123::char-001']).toBeDefined();

      limit.clearLimitState('user-123', 'char-001');
      expect(limit.limits.value['user-123::char-001']).toBeUndefined();
    });
  });

  describe('錯誤處理', () => {
    it('應該處理 checkLimit 錯誤', async () => {
      // 重置 mock 並設置錯誤場景
      vi.resetModules();
      vi.clearAllMocks();

      // 設置 base service mock 為錯誤場景
      vi.doMock('./useBaseLimitService.js', () => ({
        createLimitService: vi.fn(() => ({
          limitData: { value: {} },
          isLoading: { value: false },
          error: { value: null },
          checkLimit: vi.fn().mockRejectedValueOnce(new Error('Network error')),
          getStats: vi.fn(),
          unlockByAd: vi.fn(),
          clearState: vi.fn(),
          getLimitData: vi.fn(),
        })),
      }));

      // 重新導入 composable
      const { useConversationLimit: errorComposable } = await import('./useConversationLimit.js');
      const limit = errorComposable();

      await expect(
        limit.checkLimit('user-123', 'char-001')
      ).rejects.toThrow('Network error');
    });
  });
});
