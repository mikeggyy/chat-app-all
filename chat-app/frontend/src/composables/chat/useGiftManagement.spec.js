/**
 * useGiftManagement Composable 測試
 *
 * 測試範圍：
 * - 打開禮物選擇器
 * - 發送禮物流程
 * - 禮物動畫顯示
 * - 餘額重新載入
 * - 無用戶處理
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../config/gifts', () => ({
  getGiftById: vi.fn((giftId) => {
    const gifts = {
      'gift-1': { id: 'gift-1', name: '玫瑰', emoji: '🌹', price: 10 },
      'gift-2': { id: 'gift-2', name: '鑽石', emoji: '💎', price: 100 },
      'gift-3': { id: 'gift-3', name: '巧克力', emoji: '🍫', price: 5 },
    };
    return gifts[giftId] || null;
  }),
}));

describe('useGiftManagement - 禮物管理測試', () => {
  let useGiftManagement;
  let mockDeps;
  let giftsConfig;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    // 獲取 mock config
    const config = await import('../../config/gifts');
    giftsConfig = config;

    // 創建標準的 mock 依賴項
    mockDeps = {
      getCurrentUserId: vi.fn(() => 'user-123'),
      openGiftSelector: vi.fn(async (callback) => {
        // 模擬打開選擇器並執行回調
        if (callback) await callback();
      }),
      sendGift: vi.fn(async (giftData, onSuccess) => {
        // 模擬發送成功並執行回調
        if (onSuccess) await onSuccess();
      }),
      loadBalance: vi.fn(async () => {}),
      showGiftAnimation: vi.fn(),
      closeGiftAnimation: vi.fn(),
    };

    // 導入 composable
    const { useGiftManagement: composable } = await import('./useGiftManagement.js');
    useGiftManagement = composable;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('handleOpenGiftSelector', () => {
    it('應該成功打開禮物選擇器', async () => {
      const giftMgmt = useGiftManagement(mockDeps);

      await giftMgmt.handleOpenGiftSelector();

      expect(mockDeps.getCurrentUserId).toHaveBeenCalled();
      expect(mockDeps.openGiftSelector).toHaveBeenCalled();
    });

    it('應該在打開選擇器時載入用戶餘額', async () => {
      const giftMgmt = useGiftManagement(mockDeps);

      await giftMgmt.handleOpenGiftSelector();

      expect(mockDeps.loadBalance).toHaveBeenCalledWith('user-123');
    });

    it('應該在沒有用戶 ID 時不打開選擇器', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null);

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleOpenGiftSelector();

      expect(mockDeps.openGiftSelector).not.toHaveBeenCalled();
    });

    it('應該在用戶 ID 為空字符串時不打開選擇器', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => '');

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleOpenGiftSelector();

      expect(mockDeps.openGiftSelector).not.toHaveBeenCalled();
    });

    it('應該處理載入餘額錯誤', async () => {
      mockDeps.loadBalance = vi.fn(async () => {
        throw new Error('Balance load failed');
      });

      const giftMgmt = useGiftManagement(mockDeps);

      await expect(giftMgmt.handleOpenGiftSelector()).rejects.toThrow('Balance load failed');
    });
  });

  describe('handleSelectGift', () => {
    it('應該成功發送禮物（完整流程）', async () => {
      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      // 驗證調用順序
      expect(mockDeps.getCurrentUserId).toHaveBeenCalled();
      expect(giftsConfig.getGiftById).toHaveBeenCalledWith('gift-1');
      expect(mockDeps.showGiftAnimation).toHaveBeenCalledWith('🌹', '玫瑰');
      expect(mockDeps.sendGift).toHaveBeenCalledWith(giftData, expect.any(Function));
      expect(mockDeps.loadBalance).toHaveBeenCalledWith('user-123');
    });

    it('應該顯示禮物動畫', async () => {
      const giftData = { giftId: 'gift-2', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.showGiftAnimation).toHaveBeenCalledWith('💎', '鑽石');
    });

    it('應該在 2 秒後自動關閉動畫', async () => {
      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      // 動畫應該立即顯示
      expect(mockDeps.showGiftAnimation).toHaveBeenCalled();
      expect(mockDeps.closeGiftAnimation).not.toHaveBeenCalled();

      // 前進 2 秒
      vi.advanceTimersByTime(2000);

      // 動畫應該關閉
      expect(mockDeps.closeGiftAnimation).toHaveBeenCalled();
    });

    it('應該在沒有用戶 ID 時不發送禮物', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null);

      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.sendGift).not.toHaveBeenCalled();
      expect(mockDeps.showGiftAnimation).not.toHaveBeenCalled();
    });

    it('應該處理不存在的禮物', async () => {
      const giftData = { giftId: 'invalid-gift', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      // 不應該顯示動畫（因為找不到禮物）
      expect(mockDeps.showGiftAnimation).not.toHaveBeenCalled();

      // 但仍然會嘗試發送（由 sendGift 處理錯誤）
      expect(mockDeps.sendGift).toHaveBeenCalledWith(giftData, expect.any(Function));
    });

    it('應該在發送成功後重新載入餘額', async () => {
      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.loadBalance).toHaveBeenCalledWith('user-123');
      expect(mockDeps.loadBalance).toHaveBeenCalledTimes(1);
    });

    it('應該處理發送禮物錯誤', async () => {
      mockDeps.sendGift = vi.fn(async () => {
        throw new Error('Gift send failed');
      });

      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);

      await expect(giftMgmt.handleSelectGift(giftData)).rejects.toThrow('Gift send failed');
    });

    it('應該處理重新載入餘額錯誤', async () => {
      mockDeps.loadBalance = vi.fn(async () => {
        throw new Error('Balance load failed');
      });

      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);

      await expect(giftMgmt.handleSelectGift(giftData)).rejects.toThrow('Balance load failed');
    });
  });

  describe('禮物動畫時序', () => {
    it('應該在發送禮物前顯示動畫', async () => {
      const callOrder = [];

      mockDeps.showGiftAnimation = vi.fn(() => {
        callOrder.push('showAnimation');
      });
      mockDeps.sendGift = vi.fn(async () => {
        callOrder.push('sendGift');
      });
      mockDeps.loadBalance = vi.fn(async () => {
        callOrder.push('loadBalance');
      });

      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      // 動畫應該在發送禮物之前顯示
      expect(callOrder).toEqual(['showAnimation', 'sendGift', 'loadBalance']);
    });

    it('應該在動畫播放期間完成禮物發送', async () => {
      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      // 此時動畫應該還在播放
      expect(mockDeps.showGiftAnimation).toHaveBeenCalled();
      expect(mockDeps.closeGiftAnimation).not.toHaveBeenCalled();

      // 禮物應該已經發送完成
      expect(mockDeps.sendGift).toHaveBeenCalled();
      expect(mockDeps.loadBalance).toHaveBeenCalled();

      // 等待動畫結束
      vi.advanceTimersByTime(2000);
      expect(mockDeps.closeGiftAnimation).toHaveBeenCalled();
    });
  });

  describe('不同禮物類型', () => {
    it('應該正確處理玫瑰禮物', async () => {
      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.showGiftAnimation).toHaveBeenCalledWith('🌹', '玫瑰');
    });

    it('應該正確處理鑽石禮物', async () => {
      const giftData = { giftId: 'gift-2', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.showGiftAnimation).toHaveBeenCalledWith('💎', '鑽石');
    });

    it('應該正確處理巧克力禮物', async () => {
      const giftData = { giftId: 'gift-3', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.showGiftAnimation).toHaveBeenCalledWith('🍫', '巧克力');
    });
  });

  describe('邊界情況', () => {
    it('應該處理 giftData 缺少 giftId', async () => {
      const giftData = { quantity: 1 }; // 沒有 giftId

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.showGiftAnimation).not.toHaveBeenCalled();
      expect(mockDeps.sendGift).toHaveBeenCalledWith(giftData, expect.any(Function));
    });

    it('應該處理多個禮物連續發送', async () => {
      const giftMgmt = useGiftManagement(mockDeps);

      await giftMgmt.handleSelectGift({ giftId: 'gift-1', quantity: 1 });
      await giftMgmt.handleSelectGift({ giftId: 'gift-2', quantity: 1 });
      await giftMgmt.handleSelectGift({ giftId: 'gift-3', quantity: 1 });

      expect(mockDeps.sendGift).toHaveBeenCalledTimes(3);
      expect(mockDeps.showGiftAnimation).toHaveBeenCalledTimes(3);
      expect(mockDeps.loadBalance).toHaveBeenCalledTimes(3);
    });

    it('應該處理快速連續發送（動畫重疊）', async () => {
      const giftMgmt = useGiftManagement(mockDeps);

      // 快速發送兩個禮物
      await giftMgmt.handleSelectGift({ giftId: 'gift-1', quantity: 1 });
      await giftMgmt.handleSelectGift({ giftId: 'gift-2', quantity: 1 });

      // 兩個動畫都應該被觸發
      expect(mockDeps.showGiftAnimation).toHaveBeenCalledTimes(2);

      // 等待 2 秒，兩個定時器都會觸發（因為設置的時間相同）
      vi.advanceTimersByTime(2000);
      expect(mockDeps.closeGiftAnimation).toHaveBeenCalledTimes(2);
    });
  });

  describe('返回的 API', () => {
    it('應該暴露所有必要的方法', () => {
      const giftMgmt = useGiftManagement(mockDeps);

      expect(giftMgmt.handleOpenGiftSelector).toBeDefined();
      expect(giftMgmt.handleSelectGift).toBeDefined();
      expect(typeof giftMgmt.handleOpenGiftSelector).toBe('function');
      expect(typeof giftMgmt.handleSelectGift).toBe('function');
    });
  });
});
