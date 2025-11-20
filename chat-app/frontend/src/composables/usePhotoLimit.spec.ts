/**
 * usePhotoLimit Composable 測試
 *
 * 測試範圍：
 * - 照片生成限制檢查
 * - 照片統計載入
 * - 照片解鎖卡購買
 * - 訪客處理
 * - Computed 屬性
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { nextTick } from 'vue';

// Mock dependencies
vi.mock('../utils/api', () => ({
  apiJson: vi.fn(),
}));

vi.mock('./useUserProfile', () => ({
  useUserProfile: vi.fn(() => ({
    user: { value: { id: 'user-123', email: 'user@example.com' } },
  })),
}));

vi.mock('../../../../shared/config/testAccounts', () => ({
  isGuestUser: vi.fn((userId: string) => userId === 'guest'),
  isDevUser: vi.fn((userId: string) => userId === 'dev-user'),
}));

vi.mock('./useBaseLimitService.js', () => ({
  createLimitService: vi.fn((config: any) => {
    const limitData = { value: null as any };
    const isLoading = { value: false };
    const error = { value: null };

    return {
      limitData,
      isLoading,
      error,
      checkLimit: vi.fn(async () => ({
        allowed: true,
        remaining: 3,
        photosLimit: 5,
      })),
      getStats: vi.fn(async () => {
        limitData.value = {
          tier: 'free',
          remaining: 3,
          used: 2,
          photosLimit: 5,
          photoCards: 0,
          resetPeriod: 'lifetime',
        };
      }),
      purchaseCards: vi.fn(async (userId: string, quantity: number) => ({
        success: true,
        cardsAdded: quantity,
        newTotal: quantity,
      })),
      clearState: vi.fn(() => {
        limitData.value = null;
      }),
    };
  }),
}));

describe('usePhotoLimit - 照片限制測試', () => {
  let usePhotoLimit: any;
  let useUserProfile: Mock;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const userProfileModule = await import('./useUserProfile');
    useUserProfile = userProfileModule.useUserProfile as Mock;

    const { usePhotoLimit: composable } = await import('./usePhotoLimit.js');
    usePhotoLimit = composable;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始狀態', () => {
    it('應該初始化為空狀態', () => {
      const photoLimit = usePhotoLimit();

      expect(photoLimit.photoLimitData.value).toBeNull();
      expect(photoLimit.isLoading.value).toBe(false);
      expect(photoLimit.error.value).toBeNull();
    });

    it('應該正確初始化 computed 屬性', () => {
      const photoLimit = usePhotoLimit();

      expect(photoLimit.tier.value).toBe('free');
      expect(photoLimit.remaining.value).toBe(0);
      expect(photoLimit.used.value).toBe(0);
      expect(photoLimit.total.value).toBe(0);
      expect(photoLimit.cards.value).toBe(0);
      expect(photoLimit.resetPeriod.value).toBe('lifetime');
    });
  });

  describe('fetchPhotoStats', () => {
    it('應該成功載入照片統計', async () => {
      const photoLimit = usePhotoLimit();

      await photoLimit.fetchPhotoStats();

      expect(photoLimit.photoLimitData.value).toBeDefined();
      expect(photoLimit.photoLimitData.value.tier).toBe('free');
      expect(photoLimit.photoLimitData.value.remaining).toBe(3);
      expect(photoLimit.photoLimitData.value.used).toBe(2);
    });

    it('應該在訪客狀態時不載入統計', async () => {
      useUserProfile.mockReturnValueOnce({
        user: { value: { id: 'guest' } },
      });

      const photoLimit = usePhotoLimit();
      const result = await photoLimit.fetchPhotoStats();

      expect(result).toBeUndefined();
      expect(photoLimit.photoLimitData.value).toBeNull();
    });

    it('應該在無用戶時不載入統計', async () => {
      useUserProfile.mockReturnValueOnce({
        user: { value: null },
      });

      const photoLimit = usePhotoLimit();
      const result = await photoLimit.fetchPhotoStats();

      expect(result).toBeUndefined();
    });
  });

  describe('canGeneratePhoto', () => {
    it('應該在有剩餘次數時允許生成', async () => {
      const photoLimit = usePhotoLimit();

      const result = await photoLimit.canGeneratePhoto();

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('應該在訪客狀態時拒絕生成', async () => {
      useUserProfile.mockReturnValueOnce({
        user: { value: { id: 'guest' } },
      });

      const photoLimit = usePhotoLimit();
      const result = await photoLimit.canGeneratePhoto();

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('guest_user');
      expect(result.requireLogin).toBe(true);
    });

    it('應該在無用戶時拒絕生成', async () => {
      useUserProfile.mockReturnValueOnce({
        user: { value: null },
      });

      const photoLimit = usePhotoLimit();
      const result = await photoLimit.canGeneratePhoto();

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('guest_user');
    });

    it('應該處理檢查限制時的錯誤', async () => {
      // 重新 mock 整個模塊以測試錯誤情況
      vi.resetModules();

      vi.doMock('./useBaseLimitService.js', () => ({
        createLimitService: vi.fn(() => ({
          limitData: { value: null },
          isLoading: { value: false },
          error: { value: null },
          checkLimit: vi.fn().mockRejectedValueOnce(new Error('Network error')),
          getStats: vi.fn(),
          purchaseCards: vi.fn(),
          clearState: vi.fn(),
        })),
      }));

      const { usePhotoLimit: photoLimitComposable } = await import('./usePhotoLimit.js');
      const photoLimit = photoLimitComposable();
      const result = await photoLimit.canGeneratePhoto();

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('error');
    });
  });

  describe('purchasePhotoCards', () => {
    it('應該在訪客狀態時拋出錯誤', async () => {
      useUserProfile.mockReturnValueOnce({
        user: { value: { id: 'guest' } },
      });

      const photoLimit = usePhotoLimit();

      await expect(
        photoLimit.purchasePhotoCards(5, { method: 'credit_card' })
      ).rejects.toThrow('遊客無法購買照片解鎖卡');
    });

    it('應該在無用戶時拋出錯誤', async () => {
      useUserProfile.mockReturnValueOnce({
        user: { value: null },
      });

      const photoLimit = usePhotoLimit();

      await expect(
        photoLimit.purchasePhotoCards(5, { method: 'credit_card' })
      ).rejects.toThrow('遊客無法購買照片解鎖卡');
    });
  });

  describe('Computed 屬性', () => {
    it('tier 應該返回正確的會員等級', async () => {
      const photoLimit = usePhotoLimit();

      // 手動設置數據以測試 computed
      photoLimit.photoLimitData.value = {
        tier: 'vip',
        remaining: 3,
        used: 2,
        photosLimit: 5,
        photoCards: 0,
        resetPeriod: 'lifetime',
      };

      await nextTick();

      expect(photoLimit.tier.value).toBe('vip');
    });

    it('remaining 應該返回剩餘次數', async () => {
      const photoLimit = usePhotoLimit();

      photoLimit.photoLimitData.value = {
        remaining: 10,
      };

      await nextTick();
      expect(photoLimit.remaining.value).toBe(10);
    });

    it('used 應該返回已使用次數', async () => {
      const photoLimit = usePhotoLimit();

      photoLimit.photoLimitData.value = {
        used: 7,
      };

      await nextTick();
      expect(photoLimit.used.value).toBe(7);
    });

    it('total 應該返回總限制次數', async () => {
      const photoLimit = usePhotoLimit();

      photoLimit.photoLimitData.value = {
        photosLimit: 20,
      };

      await nextTick();
      expect(photoLimit.total.value).toBe(20);
    });

    it('cards 應該返回照片解鎖卡數量', async () => {
      const photoLimit = usePhotoLimit();

      photoLimit.photoLimitData.value = {
        photoCards: 5,
      };

      await nextTick();
      expect(photoLimit.cards.value).toBe(5);
    });

    it('resetPeriod 應該返回重置週期', async () => {
      const photoLimit = usePhotoLimit();

      photoLimit.photoLimitData.value = {
        resetPeriod: 'monthly',
      };

      await nextTick();
      expect(photoLimit.resetPeriod.value).toBe('monthly');
    });
  });

  describe('getLimitDescription', () => {
    it('應該返回免費用戶的終生限制描述', async () => {
      const photoLimit = usePhotoLimit();

      photoLimit.photoLimitData.value = {
        tier: 'free',
        resetPeriod: 'lifetime',
        photosLimit: 5,
      };

      await nextTick();

      expect(photoLimit.getLimitDescription.value).toBe('免費用戶終生 5 次');
    });

    it('應該返回 VIP 會員的月度限制描述', async () => {
      const photoLimit = usePhotoLimit();

      photoLimit.photoLimitData.value = {
        tier: 'vip',
        resetPeriod: 'monthly',
        photosLimit: 30,
      };

      await nextTick();

      expect(photoLimit.getLimitDescription.value).toBe('VIP 會員每月 30 次');
    });

    it('應該返回 VVIP 會員的月度限制描述', async () => {
      const photoLimit = usePhotoLimit();

      photoLimit.photoLimitData.value = {
        tier: 'vvip',
        resetPeriod: 'monthly',
        photosLimit: 60,
      };

      await nextTick();

      expect(photoLimit.getLimitDescription.value).toBe('VVIP 會員每月 60 次');
    });

    it('應該在無數據時返回空字符串', () => {
      const photoLimit = usePhotoLimit();

      expect(photoLimit.getLimitDescription.value).toBe('');
    });
  });

  describe('複雜場景', () => {
    it('應該正確顯示所有 computed 屬性', async () => {
      const photoLimit = usePhotoLimit();

      // 設置完整數據
      photoLimit.photoLimitData.value = {
        tier: 'free',
        remaining: 3,
        used: 2,
        photosLimit: 5,
        photoCards: 0,
        resetPeriod: 'lifetime',
      };

      await nextTick();

      // 驗證所有 computed 屬性都正確顯示
      expect(photoLimit.tier.value).toBe('free');
      expect(photoLimit.remaining.value).toBe(3);
      expect(photoLimit.used.value).toBe(2);
      expect(photoLimit.total.value).toBe(5);
      expect(photoLimit.cards.value).toBe(0);
      expect(photoLimit.resetPeriod.value).toBe('lifetime');
      expect(photoLimit.getLimitDescription.value).toBe('免費用戶終生 5 次');
    });
  });

  describe('邊界情況', () => {
    it('應該處理空的用戶 ID', async () => {
      useUserProfile.mockReturnValueOnce({
        user: { value: { id: '' } },
      });

      const photoLimit = usePhotoLimit();
      const result = await photoLimit.fetchPhotoStats();

      // 空 ID 視同無用戶
      expect(result).toBeUndefined();
    });

    it('應該處理 null 值的統計數據', () => {
      const photoLimit = usePhotoLimit();

      // 未載入時，所有 computed 應返回默認值
      expect(photoLimit.tier.value).toBe('free');
      expect(photoLimit.remaining.value).toBe(0);
      expect(photoLimit.used.value).toBe(0);
      expect(photoLimit.total.value).toBe(0);
      expect(photoLimit.cards.value).toBe(0);
      expect(photoLimit.resetPeriod.value).toBe('lifetime');
    });
  });
});
