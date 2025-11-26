/**
 * useMembership Composable 測試
 *
 * 測試範圍：
 * - 會員信息載入
 * - 會員等級判斷
 * - 會員功能檢查
 * - 會員升級
 * - 會員取消
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMembership } from './useMembership.ts';

// Mock API
vi.mock('../utils/api.js', () => ({
  apiJson: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useMembership - 會員系統測試', () => {
  let apiJson;

  beforeEach(async () => {
    vi.clearAllMocks();
    apiJson = (await import('../utils/api.js')).apiJson;
  });

  describe('基本功能', () => {
    it('應該初始化為 free 會員', () => {
      const { currentTier, isFree, isActive } = useMembership();

      expect(currentTier.value).toBe('free');
      expect(isFree.value).toBe(true);
      expect(isActive.value).toBe(false);
    });

    it('應該正確判斷會員等級', () => {
      const { currentTier, isFree, isVIP, isVVIP } = useMembership();

      // Free 會員
      expect(currentTier.value).toBe('free');
      expect(isFree.value).toBe(true);
      expect(isVIP.value).toBe(false);
      expect(isVVIP.value).toBe(false);
    });
  });

  describe('載入會員信息', () => {
    it('應該成功載入會員信息', async () => {
      const mockResponse = {
        tier: 'vip',
        features: {
          conversationLimit: 100,
          voiceLimit: 50,
          photoLimit: 10,
        },
        isActive: true,
        expiresAt: '2025-12-31T23:59:59Z',
      };

      apiJson.mockResolvedValue(mockResponse);

      const { loadMembershipInfo, membershipInfo, currentTier, isVIP } = useMembership();

      await loadMembershipInfo('user-123');

      expect(apiJson).toHaveBeenCalledWith('/api/membership/user-123', expect.any(Object));
      expect(membershipInfo.value.tier).toBe('vip');
      expect(currentTier.value).toBe('vip');
      expect(isVIP.value).toBe(true);
      expect(membershipInfo.value.isActive).toBe(true);
    });

    it('應該在缺少 userId 時拋出錯誤', async () => {
      const { loadMembershipInfo } = useMembership();

      await expect(loadMembershipInfo()).rejects.toThrow('缺少用戶 ID');
    });

    it('應該處理 API 錯誤', async () => {
      apiJson.mockRejectedValue(new Error('API 錯誤'));

      const { loadMembershipInfo, error } = useMembership();

      await expect(loadMembershipInfo('user-123')).rejects.toThrow();
      expect(error.value).toBeTruthy();
    });
  });

  describe('會員功能檢查', () => {
    it('應該檢查會員功能', async () => {
      const mockResponse = {
        tier: 'vip',
        features: {
          conversationLimit: 100,
          voiceLimit: 50,
          photoLimit: 10,
          unlimitedConversation: false,
        },
        isActive: true,
      };

      apiJson.mockResolvedValue(mockResponse);

      const { loadMembershipInfo, hasFeature, getFeatureValue } = useMembership();

      await loadMembershipInfo('user-123');

      expect(hasFeature('conversationLimit')).toBe(true);
      expect(getFeatureValue('conversationLimit')).toBe(100);
      expect(getFeatureValue('unlimitedConversation')).toBe(false);
    });
  });

  describe('會員升級', () => {
    it('應該成功升級會員', async () => {
      const mockUpgradeResponse = {
        tier: 'vvip',
        features: {
          conversationLimit: -1, // 無限制
          voiceLimit: -1,
          photoLimit: 20,
          unlimitedConversation: true,
          unlimitedVoice: true,
        },
        isActive: true,
      };

      apiJson.mockResolvedValue(mockUpgradeResponse);

      const { upgradeMembership, membershipInfo, isVVIP } = useMembership();

      await upgradeMembership('user-123', 'vvip');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/membership/upgrade',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            userId: 'user-123',
            targetTier: 'vvip',
          }),
        })
      );

      expect(membershipInfo.value.tier).toBe('vvip');
      expect(isVVIP.value).toBe(true);
    });

    it('應該在缺少 userId 時拋出錯誤', async () => {
      const { upgradeMembership } = useMembership();

      await expect(upgradeMembership(undefined, 'vip')).rejects.toThrow('缺少用戶 ID');
    });

    it('應該在缺少 targetTier 時拋出錯誤', async () => {
      const { upgradeMembership } = useMembership();

      await expect(upgradeMembership('user-123', undefined as any)).rejects.toThrow('缺少目標會員等級');
    });
  });

  describe('會員取消', () => {
    it('應該成功取消會員', async () => {
      const mockCancelResponse = {
        tier: 'free',
        features: {
          conversationLimit: 10,
          voiceLimit: 5,
          photoLimit: 2,
        },
        isActive: false,
      };

      apiJson.mockResolvedValue(mockCancelResponse);

      const { cancelMembership, membershipInfo, isFree } = useMembership();

      await cancelMembership('user-123');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/membership/cancel',
        expect.objectContaining({
          method: 'POST',
          body: { userId: 'user-123' },
        })
      );

      expect(membershipInfo.value.tier).toBe('free');
      expect(isFree.value).toBe(true);
      expect(membershipInfo.value.isActive).toBe(false);
    });

    it('應該在缺少 userId 時拋出錯誤', async () => {
      const { cancelMembership } = useMembership();

      await expect(cancelMembership()).rejects.toThrow('缺少用戶 ID');
    });
  });

  describe('Computed 屬性', () => {
    it('應該正確計算 canUpgrade', () => {
      const { canUpgrade, membershipInfo } = useMembership();

      // Free 會員可以升級
      membershipInfo.value = { tier: 'free', features: {}, isActive: false };
      expect(canUpgrade.value).toBe(true);

      // VIP 會員可以升級到 VVIP
      membershipInfo.value = { tier: 'vip', features: {}, isActive: true };
      expect(canUpgrade.value).toBe(true);

      // VVIP 會員無法升級
      membershipInfo.value = { tier: 'vvip', features: {}, isActive: true };
      expect(canUpgrade.value).toBe(false);
    });

    it('應該正確計算 canCancel', () => {
      const { canCancel, membershipInfo } = useMembership();

      // 活躍會員可以取消
      membershipInfo.value = { tier: 'vip', features: {}, isActive: true };
      expect(canCancel.value).toBe(true);

      // Free 會員無法取消
      membershipInfo.value = { tier: 'free', features: {}, isActive: false };
      expect(canCancel.value).toBe(false);
    });

    it('應該正確計算 features', () => {
      const { features, membershipInfo } = useMembership();

      const mockFeatures = {
        conversationLimit: 100,
        voiceLimit: 50,
        photoLimit: 10,
      };

      membershipInfo.value = {
        tier: 'vip',
        features: mockFeatures,
        isActive: true,
      };

      expect(features.value).toEqual(mockFeatures);
    });
  });
});
