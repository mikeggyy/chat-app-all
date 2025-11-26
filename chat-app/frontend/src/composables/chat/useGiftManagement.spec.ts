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
import type { Mock } from 'vitest';

// Types
interface GiftData {
  giftId: string;
  quantity: number;
}

interface MockDependencies {
  getCurrentUserId: () => string | null;
  openGiftSelector: (callback?: () => Promise<void>) => Promise<void>;
  sendGift: (giftData: GiftData, onSuccess?: () => Promise<void>, selectedPhotoUrl?: string) => Promise<void>;
  loadBalance: (userId: string) => Promise<void>;
  showGiftAnimation: (emoji: string, name: string) => void;
  closeGiftAnimation: () => void;
  showPhotoSelector: (forGift: boolean, pendingGift: GiftData) => void; // ✅ 新增
  closeGiftSelector: () => void; // ✅ 新增
}

// Mock dependencies
vi.mock('../../config/gifts', () => ({
  getGiftById: vi.fn((giftId: string) => {
    const gifts: Record<string, any> = {
      'gift-1': { id: 'gift-1', name: '玫瑰', emoji: '🌹', price: 10 },
      'gift-2': { id: 'gift-2', name: '鑽石', emoji: '💎', price: 100 },
      'gift-3': { id: 'gift-3', name: '巧克力', emoji: '🍫', price: 5 },
    };
    return gifts[giftId] || null;
  }),
}));

describe('useGiftManagement - 禮物管理測試', () => {
  let useGiftManagement: any;
  let mockDeps: MockDependencies;
  let giftsConfig: any;

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
      openGiftSelector: vi.fn(async (callback?: () => Promise<void>) => {
        // 模擬打開選擇器並執行回調
        if (callback) await callback();
      }),
      sendGift: vi.fn(async (giftData: GiftData, onSuccess?: () => Promise<void>, selectedPhotoUrl?: string) => {
        // 模擬發送成功並執行回調
        if (onSuccess) await onSuccess();
      }),
      loadBalance: vi.fn(async () => {}),
      showGiftAnimation: vi.fn(),
      closeGiftAnimation: vi.fn(),
      showPhotoSelector: vi.fn(), // ✅ 新增: 模擬打開照片選擇器
      closeGiftSelector: vi.fn(), // ✅ 新增: 模擬關閉禮物選擇器
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

  describe('handleSelectGift - 新流程 (2025-11-25)', () => {
    // ✅ 新的送禮流程：選擇禮物 → 選擇照片 → 發送（照片選擇後處理）
    // handleSelectGift 只負責關閉禮物選擇器並打開照片選擇器
    // 實際的發送、動畫、餘額重載在照片選擇後處理

    it('應該關閉禮物選擇器並打開照片選擇器', async () => {
      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      // 驗證調用
      expect(mockDeps.getCurrentUserId).toHaveBeenCalled();
      expect(mockDeps.closeGiftSelector).toHaveBeenCalled();
      expect(mockDeps.showPhotoSelector).toHaveBeenCalledWith(true, giftData);
    });

    it('應該在沒有用戶 ID 時不執行任何操作', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null);

      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.closeGiftSelector).not.toHaveBeenCalled();
      expect(mockDeps.showPhotoSelector).not.toHaveBeenCalled();
    });

    it('應該在用戶 ID 為空字符串時不執行任何操作', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => '');

      const giftData = { giftId: 'gift-1', quantity: 1 };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.closeGiftSelector).not.toHaveBeenCalled();
      expect(mockDeps.showPhotoSelector).not.toHaveBeenCalled();
    });

    it('應該傳遞完整的 giftData 給照片選擇器', async () => {
      const giftData = {
        giftId: 'gift-2',
        quantity: 5,
        customProperty: 'test',
      };

      const giftMgmt = useGiftManagement(mockDeps);
      await giftMgmt.handleSelectGift(giftData);

      expect(mockDeps.showPhotoSelector).toHaveBeenCalledWith(true, giftData);
    });

    it('應該為不同禮物正確打開照片選擇器', async () => {
      const giftMgmt = useGiftManagement(mockDeps);

      await giftMgmt.handleSelectGift({ giftId: 'gift-1', quantity: 1 });
      await giftMgmt.handleSelectGift({ giftId: 'gift-2', quantity: 2 });
      await giftMgmt.handleSelectGift({ giftId: 'gift-3', quantity: 3 });

      expect(mockDeps.closeGiftSelector).toHaveBeenCalledTimes(3);
      expect(mockDeps.showPhotoSelector).toHaveBeenCalledTimes(3);
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
