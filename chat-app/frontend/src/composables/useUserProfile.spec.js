/**
 * useUserProfile Composable 簡化測試
 * 專注於核心功能和可靠性
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { nextTick } from 'vue';

// Mock apiJson 模塊
vi.mock('../utils/api', () => ({
  apiJson: vi.fn(),
}));

// Mock useFirebaseAuth
vi.mock('./useFirebaseAuth.js', () => ({
  useFirebaseAuth: () => ({
    getCurrentUserIdToken: vi.fn(() => Promise.resolve('mock-token-123')),
  }),
}));

// Mock testAccounts
vi.mock('../../../../shared/config/testAccounts.js', () => ({
  isGuestUser: vi.fn((userId) => userId?.includes('guest')),
}));

describe('useUserProfile - 核心功能測試', () => {
  let useUserProfile;
  let apiJson;

  beforeEach(async () => {
    // 清除所有模塊緩存
    vi.resetModules();

    // 重新導入模塊以獲取新的實例
    const { apiJson: mockApiJson } = await import('../utils/api');
    apiJson = mockApiJson;

    const { useUserProfile: composable } = await import('./useUserProfile.js');
    useUserProfile = composable;

    // 清除 mock 調用記錄
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('基本功能', () => {
    it('應該初始化時沒有用戶資料', () => {
      const profile = useUserProfile();

      expect(profile.user.value).toBeNull();
      expect(profile.isAuthenticated.value).toBe(false);
    });

    it('應該能設置用戶資料', async () => {
      const profile = useUserProfile();
      const userData = {
        id: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      const result = profile.setUserProfile(userData);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-user-123');
      expect(result.email).toBe('test@example.com');
      expect(profile.user.value.id).toBe('test-user-123');
      expect(profile.isAuthenticated.value).toBe(true);
    });

    it('應該能清除用戶資料', () => {
      const profile = useUserProfile();
      profile.setUserProfile({ id: 'test-123', email: 'test@test.com' });

      expect(profile.user.value).not.toBeNull();

      profile.clearUserProfile();

      expect(profile.user.value).toBeNull();
      expect(profile.isAuthenticated.value).toBe(false);
    });
  });

  describe('用戶資料正規化', () => {
    it('應該為空資料提供預設值', () => {
      const profile = useUserProfile();
      const result = profile.setUserProfile({});

      expect(result.displayName).toBeDefined();
      expect(result.locale).toBe('zh-TW');
      expect(result.wallet).toBeDefined();
      expect(result.wallet.balance).toBe(0);
      expect(result.membershipTier).toBe('free');
      expect(result.photoURL).toBeDefined();
      expect(result.conversations).toEqual([]);
      expect(result.favorites).toEqual([]);
    });

    it('應該正確處理錢包餘額', () => {
      const profile = useUserProfile();

      // 測試 wallet.balance
      const result1 = profile.setUserProfile({ wallet: { balance: 1000 } });
      expect(result1.wallet.balance).toBe(1000);

      profile.clearUserProfile();

      // 測試 coins
      const result2 = profile.setUserProfile({ coins: 2000 });
      expect(result2.wallet.balance).toBe(2000);
    });

    it('應該正確處理資產欄位', () => {
      const profile = useUserProfile();
      const result = profile.setUserProfile({
        assets: {
          characterUnlockCards: 5,
          photoUnlockCards: 3,
        },
      });

      expect(result.assets.characterUnlockCards).toBe(5);
      expect(result.assets.photoUnlockCards).toBe(3);
      expect(result.assets.videoUnlockCards).toBe(0); // 預設值
    });

    it('應該正確處理會員欄位', () => {
      const profile = useUserProfile();
      const result = profile.setUserProfile({
        membershipTier: 'vip',
        membershipStatus: 'active',
      });

      expect(result.membershipTier).toBe('vip');
      expect(result.membershipStatus).toBe('active');
    });
  });

  describe('loadUserProfile', () => {
    it('應該能從 API 加載用戶資料', async () => {
      const profile = useUserProfile();
      const mockData = {
        id: 'user-456',
        email: 'user@example.com',
        displayName: 'API User',
      };

      apiJson.mockResolvedValueOnce(mockData);

      const result = await profile.loadUserProfile('user-456');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-456',
        expect.objectContaining({})
      );
      expect(result.id).toBe('user-456');
      expect(result.email).toBe('user@example.com');
      expect(profile.user.value.id).toBe('user-456');
    });

    it('應該在未提供 ID 時拋出錯誤', async () => {
      const profile = useUserProfile();

      await expect(profile.loadUserProfile()).rejects.toThrow(
        '載入使用者資料時需要提供 id'
      );
    });

    it('應該在加載失敗時使用 fallback', async () => {
      const profile = useUserProfile();
      apiJson.mockRejectedValueOnce(new Error('Network error'));

      const fallback = { email: 'fallback@test.com' };
      const result = await profile.loadUserProfile('user-123', { fallback });

      expect(result.id).toBe('user-123');
      expect(result.email).toBe('fallback@test.com');
    });
  });

  describe('錯誤處理', () => {
    it('updateUserAvatar 應該在沒有用戶時拋出錯誤', async () => {
      const profile = useUserProfile();

      await expect(
        profile.updateUserAvatar('https://example.com/photo.jpg')
      ).rejects.toThrow('目前沒有可更新的使用者資料');
    });

    it('updateUserProfileDetails 應該在沒有用戶時拋出錯誤', async () => {
      const profile = useUserProfile();

      await expect(
        profile.updateUserProfileDetails({ displayName: 'New Name' })
      ).rejects.toThrow('目前沒有可更新的使用者資料');
    });

    it('addConversationHistory 應該在沒有用戶時拋出錯誤', async () => {
      const profile = useUserProfile();

      await expect(
        profile.addConversationHistory('conv-123')
      ).rejects.toThrow('目前沒有可更新的使用者資料');
    });

    it('resetConversationHistory 應該在沒有用戶時拋出錯誤', async () => {
      const profile = useUserProfile();

      await expect(
        profile.resetConversationHistory('conv-123')
      ).rejects.toThrow('目前沒有可更新的使用者資料');
    });
  });

  describe('對話歷史管理 - 訪客模式', () => {
    it('訪客用戶應該本地添加對話記錄', async () => {
      const profile = useUserProfile();
      profile.setUserProfile({
        id: 'guest-123',
        conversations: [],
      });

      const result = await profile.addConversationHistory('conv-456');

      expect(result.conversations).toContain('conv-456');
      expect(apiJson).not.toHaveBeenCalled(); // 不應該調用 API
    });

    it('訪客用戶不應添加重複對話', async () => {
      const profile = useUserProfile();
      profile.setUserProfile({
        id: 'guest-456',
        conversations: ['conv-existing'],
      });

      const result = await profile.addConversationHistory('conv-existing');

      expect(result.conversations).toEqual(['conv-existing']);
      expect(result.conversations.length).toBe(1);
    });
  });
});
