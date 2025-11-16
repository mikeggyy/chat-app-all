/**
 * useMembership Composable 測試
 *
 * 測試範圍：
 * - 會員資訊加載
 * - 會員升級流程
 * - 會員取消訂閱
 * - 會員等級判斷
 * - 到期日期計算
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { nextTick } from 'vue';

// Mock dependencies
vi.mock('../utils/api', () => ({
  apiJson: vi.fn(),
}));

vi.mock('../utils/idempotency.js', () => ({
  generateIdempotencyKey: vi.fn(() => 'mock-idempotency-key-123'),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

interface MembershipData {
  tier?: string;
  features?: Record<string, any>;
  pricing?: Record<string, any>;
  isActive?: boolean;
  expiresAt?: string | null;
  subscriptionStatus?: string;
}

interface UpgradeOptions {
  durationMonths?: number;
  autoRenew?: boolean;
  paymentMethod?: string;
  paymentId?: string;
}

describe('useMembership - 會員系統測試', () => {
  let useMembership: any;
  let apiJson: Mock;

  beforeEach(async () => {
    // 重置模塊
    vi.resetModules();
    vi.clearAllMocks();

    // 重新導入
    const { apiJson: mockApiJson } = await import('../utils/api');
    apiJson = mockApiJson as Mock;

    const { useMembership: composable } = await import('./useMembership.js');
    useMembership = composable;

    // 清除所有定時器
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ====================================
  // 基本狀態測試
  // ====================================

  describe('初始狀態', () => {
    it('應該初始化為空狀態', () => {
      const membership = useMembership();

      expect(membership.membership.value).toBeNull();
      expect(membership.isLoading.value).toBe(false);
      expect(membership.error.value).toBeNull();
      expect(membership.isUpgrading.value).toBe(false);
    });

    it('免費會員的預設值應該正確', () => {
      const membership = useMembership();

      expect(membership.tier.value).toBe('free');
      expect(membership.tierName.value).toBe('免費會員');
      expect(membership.isPaidMember.value).toBe(false);
      expect(membership.isVIP.value).toBe(false);
      expect(membership.isVVIP.value).toBe(false);
      expect(membership.isActive.value).toBe(false);
    });
  });

  // ====================================
  // loadMembership 測試
  // ====================================

  describe('loadMembership', () => {
    it('應該成功加載會員資訊', async () => {
      const membership = useMembership();
      const mockData: MembershipData = {
        tier: 'vip',
        features: { conversationLimit: 100 },
        pricing: { monthly: 299 },
        isActive: true,
        expiresAt: '2025-02-13T00:00:00.000Z',
      };

      apiJson.mockResolvedValueOnce(mockData);

      const result = await membership.loadMembership('user-123');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/membership/user-123',
        expect.objectContaining({ skipGlobalLoading: false })
      );
      expect(result).toEqual(mockData);
      expect(membership.membership.value).toEqual(mockData);
      expect(membership.tier.value).toBe('vip');
      expect(membership.isLoading.value).toBe(false);
    });

    it('應該在未提供 userId 時返回 null', async () => {
      const membership = useMembership();

      const result = await membership.loadMembership();

      expect(result).toBeNull();
      expect(membership.error.value).toBe('需要提供用戶 ID');
      expect(apiJson).not.toHaveBeenCalled();
    });

    it('應該處理加載失敗', async () => {
      const membership = useMembership();
      apiJson.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        membership.loadMembership('user-123')
      ).rejects.toThrow('Network error');

      expect(membership.error.value).toBe('Network error');
      expect(membership.isLoading.value).toBe(false);
    });

    it('應該支持 skipGlobalLoading 選項', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({ tier: 'free' });

      await membership.loadMembership('user-123', { skipGlobalLoading: true });

      expect(apiJson).toHaveBeenCalledWith(
        '/api/membership/user-123',
        expect.objectContaining({ skipGlobalLoading: true })
      );
    });
  });

  // ====================================
  // upgradeMembership 測試
  // ====================================

  describe('upgradeMembership', () => {
    it('應該成功升級到 VIP', async () => {
      const membership = useMembership();
      const mockResponse = {
        membership: {
          tier: 'vip',
          isActive: true,
          expiresAt: '2025-02-13T00:00:00.000Z',
        },
      };

      apiJson.mockResolvedValueOnce(mockResponse);
      vi.useFakeTimers();

      const result = await membership.upgradeMembership('user-123', 'vip');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/membership/user-123/upgrade',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            tier: 'vip',
            idempotencyKey: 'mock-idempotency-key-123',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
      expect(membership.membership.value).toEqual(mockResponse.membership);
      expect(membership.tier.value).toBe('vip');
      expect(membership.isUpgrading.value).toBe(false);

      vi.useRealTimers();
    });

    it('應該顯示升級進度', async () => {
      const membership = useMembership();
      apiJson.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ membership: { tier: 'vip' } }), 100))
      );

      const upgradePromise = membership.upgradeMembership('user-123', 'vip');

      // 檢查升級中狀態（可能已經進入 processing）
      await nextTick();
      expect(membership.isUpgrading.value).toBe(true);
      expect(['validating', 'processing']).toContain(membership.upgradeProgress.value.step);

      await upgradePromise;

      // 檢查完成進度
      expect(membership.upgradeProgress.value.step).toBe('completed');
      expect(membership.isUpgrading.value).toBe(false);
    });

    it('應該支持自定義升級選項', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({ membership: { tier: 'vvip' } });

      await membership.upgradeMembership('user-123', 'vvip', {
        durationMonths: 12,
        autoRenew: true,
        paymentMethod: 'paypal',
        paymentId: 'payment-456',
      });

      expect(apiJson).toHaveBeenCalledWith(
        '/api/membership/user-123/upgrade',
        expect.objectContaining({
          body: expect.objectContaining({
            tier: 'vvip',
            durationMonths: 12,
            autoRenew: true,
            paymentMethod: 'paypal',
            paymentId: 'payment-456',
          }),
        })
      );
    });

    it('應該處理冪等性響應（緩存結果）', async () => {
      const membership = useMembership();
      const mockResponse = {
        membership: { tier: 'vip' },
        _idempotent: true,
        _cached: true,
      };

      apiJson.mockResolvedValueOnce(mockResponse);

      const result = await membership.upgradeMembership('user-123', 'vip');

      expect(result).toEqual(mockResponse);
      expect(membership.membership.value).toEqual(mockResponse.membership);
    });

    it('應該處理部分成功警告', async () => {
      const membership = useMembership();
      const mockResponse = {
        membership: { tier: 'vip' },
        warning: 'PARTIAL_SUCCESS_DETECTED',
      };

      apiJson.mockResolvedValueOnce(mockResponse);

      const result = await membership.upgradeMembership('user-123', 'vip');

      expect(result).toEqual(mockResponse);
      expect(membership.membership.value).toEqual(mockResponse.membership);
    });

    it('應該在未提供 userId 時拋出錯誤', async () => {
      const membership = useMembership();

      await expect(
        membership.upgradeMembership(null, 'vip')
      ).rejects.toThrow('需要提供用戶 ID 和目標等級');

      expect(membership.error.value).toBe('需要提供用戶 ID 和目標等級');
    });

    it('應該在未提供 targetTier 時拋出錯誤', async () => {
      const membership = useMembership();

      await expect(
        membership.upgradeMembership('user-123', null)
      ).rejects.toThrow('需要提供用戶 ID 和目標等級');
    });

    it('應該在無效的會員等級時拋出錯誤', async () => {
      const membership = useMembership();

      await expect(
        membership.upgradeMembership('user-123', 'invalid')
      ).rejects.toThrow('無效的會員等級');

      await expect(
        membership.upgradeMembership('user-123', 'premium')
      ).rejects.toThrow('無效的會員等級');
    });

    it('應該在升級失敗後重新加載會員資訊', async () => {
      const membership = useMembership();
      apiJson
        .mockRejectedValueOnce(new Error('Payment failed'))
        .mockResolvedValueOnce({ tier: 'free' }); // 重新加載

      await expect(
        membership.upgradeMembership('user-123', 'vip')
      ).rejects.toThrow('Payment failed');

      expect(membership.error.value).toBe('Payment failed');
      expect(membership.isUpgrading.value).toBe(false);

      // 應該有兩次 API 調用：1. 升級失敗 2. 重新加載
      expect(apiJson).toHaveBeenCalledTimes(2);
    });

    it('應該正確處理升級失敗時重新加載也失敗的情況', async () => {
      const membership = useMembership();
      apiJson
        .mockRejectedValueOnce(new Error('Upgrade failed'))
        .mockRejectedValueOnce(new Error('Reload failed'));

      await expect(
        membership.upgradeMembership('user-123', 'vip')
      ).rejects.toThrow('Upgrade failed'); // 保留原始錯誤

      expect(membership.error.value).toBe('Upgrade failed');
    });
  });

  // ====================================
  // cancelMembership 測試
  // ====================================

  describe('cancelMembership', () => {
    it('應該成功取消會員訂閱', async () => {
      const membership = useMembership();
      const mockResponse: MembershipData = {
        tier: 'free',
        isActive: false,
        subscriptionStatus: 'cancelled',
      };

      apiJson.mockResolvedValueOnce(mockResponse);

      const result = await membership.cancelMembership('user-123');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/membership/user-123/cancel',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual(mockResponse);
      expect(membership.membership.value).toEqual(mockResponse);
      expect(membership.tier.value).toBe('free');
    });

    it('應該在未提供 userId 時拋出錯誤', async () => {
      const membership = useMembership();

      await expect(
        membership.cancelMembership()
      ).rejects.toThrow('需要提供用戶 ID');

      expect(membership.error.value).toBe('需要提供用戶 ID');
    });

    it('應該處理取消失敗', async () => {
      const membership = useMembership();
      apiJson.mockRejectedValueOnce(new Error('Cancellation failed'));

      await expect(
        membership.cancelMembership('user-123')
      ).rejects.toThrow('Cancellation failed');

      expect(membership.error.value).toBe('Cancellation failed');
      expect(membership.isLoading.value).toBe(false);
    });
  });

  // ====================================
  // Computed Properties 測試
  // ====================================

  describe('會員等級判斷', () => {
    it('VIP 會員應該有正確的屬性', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'vip',
        isActive: true,
      });

      await membership.loadMembership('user-123');

      expect(membership.tier.value).toBe('vip');
      expect(membership.tierName.value).toBe('VIP');
      expect(membership.isPaidMember.value).toBe(true);
      expect(membership.isVIP.value).toBe(true);
      expect(membership.isVVIP.value).toBe(false);
      expect(membership.isActive.value).toBe(true);
    });

    it('VVIP 會員應該有正確的屬性', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'vvip',
        isActive: true,
      });

      await membership.loadMembership('user-123');

      expect(membership.tier.value).toBe('vvip');
      expect(membership.tierName.value).toBe('VVIP');
      expect(membership.isPaidMember.value).toBe(true);
      expect(membership.isVIP.value).toBe(false);
      expect(membership.isVVIP.value).toBe(true);
    });

    it('免費會員應該有正確的屬性', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'free',
        isActive: true,
      });

      await membership.loadMembership('user-123');

      expect(membership.tier.value).toBe('free');
      expect(membership.tierName.value).toBe('免費會員');
      expect(membership.isPaidMember.value).toBe(false);
      expect(membership.isVIP.value).toBe(false);
      expect(membership.isVVIP.value).toBe(false);
    });
  });

  describe('到期日期計算', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-13T00:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('應該正確計算到期天數', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'vip',
        expiresAt: '2025-01-20T00:00:00.000Z', // 7 天後
      });

      await membership.loadMembership('user-123');

      expect(membership.daysUntilExpiry.value).toBe(7);
    });

    it('應該正確判斷即將到期（7 天內）', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'vip',
        expiresAt: '2025-01-15T00:00:00.000Z', // 2 天後
      });

      await membership.loadMembership('user-123');

      expect(membership.daysUntilExpiry.value).toBe(2);
      expect(membership.isExpiringSoon.value).toBe(true);
      expect(membership.isExpired.value).toBe(false);
    });

    it('應該正確判斷已過期', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'vip',
        expiresAt: '2025-01-10T00:00:00.000Z', // 3 天前
      });

      await membership.loadMembership('user-123');

      expect(membership.daysUntilExpiry.value).toBe(0);
      expect(membership.isExpired.value).toBe(true);
      expect(membership.isExpiringSoon.value).toBe(false);
    });

    it('應該格式化到期日期', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'vip',
        expiresAt: '2025-02-15T00:00:00.000Z',
      });

      await membership.loadMembership('user-123');

      expect(membership.formattedExpiryDate.value).toContain('2025');
      expect(membership.formattedExpiryDate.value).toContain('2');
      expect(membership.formattedExpiryDate.value).toContain('15');
    });

    it('應該處理沒有到期日期的情況', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'free',
        expiresAt: null,
      });

      await membership.loadMembership('user-123');

      expect(membership.daysUntilExpiry.value).toBeNull();
      expect(membership.formattedExpiryDate.value).toBeNull();
      expect(membership.isExpiringSoon.value).toBe(false);
      expect(membership.isExpired.value).toBe(false);
    });
  });

  // ====================================
  // 邊界情況測試
  // ====================================

  describe('邊界情況', () => {
    it('應該處理空的會員資訊響應', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({});

      await membership.loadMembership('user-123');

      expect(membership.tier.value).toBe('free');
      expect(membership.features.value).toEqual({});
      expect(membership.pricing.value).toEqual({});
    });

    it('應該處理無效的到期日期格式', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'vip',
        expiresAt: 'invalid-date',
      });

      await membership.loadMembership('user-123');

      // 無效日期可能返回 'Invalid Date' 或 null
      expect(['Invalid Date', null]).toContain(membership.formattedExpiryDate.value);
      // daysUntilExpiry 可能返回 null 或 0（取決於 Invalid Date 的處理）
      expect([null, 0]).toContain(membership.daysUntilExpiry.value);
    });

    it('應該處理未知的會員等級', async () => {
      const membership = useMembership();
      apiJson.mockResolvedValueOnce({
        tier: 'unknown',
      });

      await membership.loadMembership('user-123');

      expect(membership.tier.value).toBe('unknown');
      expect(membership.tierName.value).toBe('免費會員'); // fallback
      expect(membership.isPaidMember.value).toBe(false);
    });
  });
});
