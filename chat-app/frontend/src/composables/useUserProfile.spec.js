/**
 * useUserProfile Composable 測試
 *
 * 測試範圍：
 * - 用戶資料載入和緩存
 * - 用戶資料更新（頭像、個人資料）
 * - 對話歷史管理
 * - 訪客用戶處理
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { useUserProfile } from './useUserProfile.ts';

// Mock API
vi.mock('../utils/api', () => ({
  apiJson: vi.fn(),
}));

// Mock Firebase Auth
vi.mock('./useFirebaseAuth.js', () => ({
  useFirebaseAuth: vi.fn(() => ({
    getCurrentUserIdToken: vi.fn(() => Promise.resolve('mock-token-123')),
  })),
}));

// Mock test accounts
vi.mock('../../../../shared/config/testAccounts.js', () => ({
  isGuestUser: vi.fn((userId) => userId === 'test-user'),
}));

describe('useUserProfile - 用戶資料管理測試', () => {
  let apiJson;

  beforeEach(async () => {
    vi.clearAllMocks();
    apiJson = (await import('../utils/api')).apiJson;
  });

  afterEach(() => {
    // 清除所有用戶資料和緩存
    const { clearUserProfile } = useUserProfile();
    clearUserProfile();
  });

  describe('基本功能', () => {
    it('應該初始化為 null 用戶', () => {
      const { user, isAuthenticated } = useUserProfile();

      expect(user.value).toBeNull();
      expect(isAuthenticated.value).toBe(false);
    });

    it('應該設置用戶資料', () => {
      const { setUserProfile, user, isAuthenticated } = useUserProfile();

      const mockUser = {
        id: 'user-123',
        displayName: '測試用戶',
        email: 'test@example.com',
      };

      const result = setUserProfile(mockUser);

      expect(user.value).toBeTruthy();
      expect(user.value.id).toBe('user-123');
      expect(user.value.displayName).toBe('測試用戶');
      expect(user.value.email).toBe('test@example.com');
      expect(isAuthenticated.value).toBe(true);
      expect(result.id).toBe('user-123');
    });

    it('應該正規化用戶資料（填充默認值）', () => {
      const { setUserProfile, user } = useUserProfile();

      const minimalUser = {
        id: 'user-456',
      };

      setUserProfile(minimalUser);

      expect(user.value.id).toBe('user-456');
      expect(user.value.displayName).toBeTruthy(); // 應該生成隨機名稱
      expect(user.value.locale).toBe('zh-TW');
      expect(user.value.gender).toBe('other');
      expect(user.value.membershipTier).toBe('free');
      expect(user.value.wallet.balance).toBe(0);
      expect(user.value.assets.characterUnlockCards).toBe(0);
      expect(user.value.conversations).toEqual([]);
      expect(user.value.favorites).toEqual([]);
    });

    it('應該正確處理錢包餘額（向後兼容）', () => {
      const { setUserProfile, user } = useUserProfile();

      // 測試新格式
      setUserProfile({
        id: 'user-1',
        wallet: { balance: 100 },
      });
      expect(user.value.wallet.balance).toBe(100);

      // 測試舊格式（walletBalance）
      setUserProfile({
        id: 'user-2',
        walletBalance: 200,
      });
      expect(user.value.wallet.balance).toBe(200);

      // 測試更舊格式（coins）
      setUserProfile({
        id: 'user-3',
        coins: 300,
      });
      expect(user.value.wallet.balance).toBe(300);
    });

    it('應該清除用戶資料', () => {
      const { setUserProfile, clearUserProfile, user, isAuthenticated } = useUserProfile();

      setUserProfile({
        id: 'user-123',
        displayName: '測試用戶',
      });

      expect(user.value).toBeTruthy();
      expect(isAuthenticated.value).toBe(true);

      clearUserProfile();

      expect(user.value).toBeNull();
      expect(isAuthenticated.value).toBe(false);
    });
  });

  describe('載入用戶資料', () => {
    it('應該從 API 載入用戶資料', async () => {
      const mockApiResponse = {
        id: 'user-123',
        displayName: 'API 用戶',
        email: 'api@example.com',
        wallet: { balance: 500 },
      };

      apiJson.mockResolvedValue(mockApiResponse);

      const { loadUserProfile, user } = useUserProfile();

      const result = await loadUserProfile('user-123');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-123',
        expect.objectContaining({
          skipGlobalLoading: false,
        })
      );

      expect(result.id).toBe('user-123');
      expect(result.displayName).toBe('API 用戶');
      expect(user.value.id).toBe('user-123');
    });

    it('應該處理嵌套的 API 響應格式', async () => {
      const mockApiResponse = {
        success: true,
        data: {
          id: 'user-456',
          displayName: '嵌套用戶',
          email: 'nested@example.com',
        },
      };

      apiJson.mockResolvedValue(mockApiResponse);

      const { loadUserProfile, user } = useUserProfile();

      await loadUserProfile('user-456');

      expect(user.value.id).toBe('user-456');
      expect(user.value.displayName).toBe('嵌套用戶');
    });

    it('應該使用緩存（未過期）', async () => {
      const mockApiResponse = {
        id: 'user-789',
        displayName: '緩存用戶',
      };

      apiJson.mockResolvedValue(mockApiResponse);

      const { loadUserProfile } = useUserProfile();

      // 第一次調用 - 應該調用 API
      await loadUserProfile('user-789');
      expect(apiJson).toHaveBeenCalledTimes(1);

      // 第二次調用 - 應該使用緩存
      await loadUserProfile('user-789');
      expect(apiJson).toHaveBeenCalledTimes(1); // 沒有增加
    });

    it('應該在 force=true 時跳過緩存', async () => {
      const mockApiResponse = {
        id: 'user-999',
        displayName: '強制用戶',
      };

      apiJson.mockResolvedValue(mockApiResponse);

      const { loadUserProfile } = useUserProfile();

      // 第一次調用
      await loadUserProfile('user-999');
      expect(apiJson).toHaveBeenCalledTimes(1);

      // 第二次調用，force=true - 應該重新調用 API
      await loadUserProfile('user-999', { force: true });
      expect(apiJson).toHaveBeenCalledTimes(2);
    });

    it('應該處理 API 錯誤並使用 fallback', async () => {
      apiJson.mockRejectedValue(new Error('API 錯誤'));

      const fallbackData = {
        displayName: 'Fallback 用戶',
        email: 'fallback@example.com',
      };

      const { loadUserProfile, user } = useUserProfile();

      const result = await loadUserProfile('user-error', { fallback: fallbackData });

      expect(result.id).toBe('user-error');
      expect(result.displayName).toBe('Fallback 用戶');
      expect(user.value.id).toBe('user-error');
    });

    it('應該在沒有 fallback 時拋出錯誤', async () => {
      apiJson.mockRejectedValue(new Error('API 錯誤'));

      const { loadUserProfile } = useUserProfile();

      await expect(loadUserProfile('user-error')).rejects.toThrow('API 錯誤');
    });

    it('應該在缺少 id 時拋出錯誤', async () => {
      const { loadUserProfile } = useUserProfile();

      await expect(loadUserProfile('')).rejects.toThrow('載入使用者資料時需要提供 id');
    });

    it('應該支援 skipGlobalLoading 選項', async () => {
      const mockApiResponse = {
        id: 'user-111',
        displayName: '測試用戶',
      };

      apiJson.mockResolvedValue(mockApiResponse);

      const { loadUserProfile } = useUserProfile();

      await loadUserProfile('user-111', { skipGlobalLoading: true });

      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-111',
        expect.objectContaining({
          skipGlobalLoading: true,
        })
      );
    });
  });

  describe('更新用戶頭像', () => {
    it('應該成功更新頭像', async () => {
      const { setUserProfile, updateUserAvatar, user } = useUserProfile();

      setUserProfile({
        id: 'user-123',
        displayName: '測試用戶',
      });

      const mockApiResponse = {
        id: 'user-123',
        displayName: '測試用戶',
        photoURL: 'https://example.com/new-avatar.jpg',
      };

      apiJson.mockResolvedValue(mockApiResponse);

      const result = await updateUserAvatar('https://example.com/new-avatar.jpg');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-123/photo',
        expect.objectContaining({
          method: 'PATCH',
          body: { photoURL: 'https://example.com/new-avatar.jpg' },
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
        })
      );

      expect(result.photoURL).toBe('https://example.com/new-avatar.jpg');
      expect(user.value.photoURL).toBe('https://example.com/new-avatar.jpg');
    });

    it('應該在沒有用戶時拋出錯誤', async () => {
      const { updateUserAvatar } = useUserProfile();

      await expect(updateUserAvatar('https://example.com/avatar.jpg'))
        .rejects.toThrow('目前沒有可更新的使用者資料');
    });

    it('應該在缺少 photoURL 時拋出錯誤', async () => {
      const { setUserProfile, updateUserAvatar } = useUserProfile();

      setUserProfile({ id: 'user-123' });

      await expect(updateUserAvatar(''))
        .rejects.toThrow('更新頭像時需要提供有效的 photoURL');
    });
  });

  describe('更新用戶個人資料', () => {
    it('應該成功更新個人資料', async () => {
      const { setUserProfile, updateUserProfileDetails, user } = useUserProfile();

      setUserProfile({
        id: 'user-123',
        displayName: '舊名稱',
      });

      const mockApiResponse = {
        id: 'user-123',
        displayName: '新名稱',
        gender: 'male',
        age: 25,
      };

      apiJson.mockResolvedValue(mockApiResponse);

      const result = await updateUserProfileDetails({
        displayName: '新名稱',
        gender: 'male',
        age: 25,
      });

      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-123/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: {
            displayName: '新名稱',
            gender: 'male',
            age: 25,
          },
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
        })
      );

      expect(result.displayName).toBe('新名稱');
      expect(user.value.displayName).toBe('新名稱');
    });

    it('應該只發送有提供的欄位', async () => {
      const { setUserProfile, updateUserProfileDetails } = useUserProfile();

      setUserProfile({ id: 'user-123' });

      apiJson.mockResolvedValue({ id: 'user-123', displayName: '新名稱' });

      await updateUserProfileDetails({ displayName: '新名稱' });

      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-123/profile',
        expect.objectContaining({
          body: {
            displayName: '新名稱',
          },
        })
      );
    });

    it('應該在沒有提供欄位時拋出錯誤', async () => {
      const { setUserProfile, updateUserProfileDetails } = useUserProfile();

      setUserProfile({ id: 'user-123' });

      await expect(updateUserProfileDetails({}))
        .rejects.toThrow('未提供可更新的欄位');
    });

    it('應該在沒有用戶時拋出錯誤', async () => {
      const { updateUserProfileDetails } = useUserProfile();

      await expect(updateUserProfileDetails({ displayName: '新名稱' }))
        .rejects.toThrow('目前沒有可更新的使用者資料');
    });
  });

  describe('對話歷史管理', () => {
    it('應該添加對話歷史（一般用戶）', async () => {
      const { setUserProfile, addConversationHistory, user } = useUserProfile();

      setUserProfile({
        id: 'user-123',
        conversations: ['char-001'],
      });

      const mockApiResponse = {
        conversations: ['char-001', 'char-002'],
      };

      apiJson.mockResolvedValue(mockApiResponse);

      await addConversationHistory('char-002');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-123/conversations',
        expect.objectContaining({
          method: 'POST',
          body: { conversationId: 'char-002' },
        })
      );

      expect(user.value.conversations).toEqual(['char-001', 'char-002']);
    });

    it('應該為訪客用戶本地添加對話歷史', async () => {
      const { setUserProfile, addConversationHistory, user } = useUserProfile();

      setUserProfile({
        id: 'test-user', // 訪客用戶
        conversations: ['char-001'],
      });

      await addConversationHistory('char-002');

      // 不應該調用 API
      expect(apiJson).not.toHaveBeenCalled();

      // 應該本地更新
      expect(user.value.conversations).toEqual(['char-001', 'char-002']);
    });

    it('應該在缺少 conversationId 時拋出錯誤', async () => {
      const { setUserProfile, addConversationHistory } = useUserProfile();

      setUserProfile({ id: 'user-123' });

      await expect(addConversationHistory(''))
        .rejects.toThrow('紀錄聊天對象時需要提供有效的 conversationId');
    });

    it('應該重置對話歷史', async () => {
      const { setUserProfile, resetConversationHistory, user } = useUserProfile();

      setUserProfile({
        id: 'user-123',
        conversations: ['char-001', 'char-002', 'char-003'],
      });

      const mockApiResponse = {
        conversations: ['char-001', 'char-003'],
      };

      apiJson.mockResolvedValue(mockApiResponse);

      await resetConversationHistory('char-002');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-123/conversations/char-002',
        expect.objectContaining({
          method: 'DELETE',
        })
      );

      expect(user.value.conversations).toEqual(['char-001', 'char-003']);
    });

    it('應該在 404 錯誤時本地移除對話', async () => {
      const { setUserProfile, resetConversationHistory, user } = useUserProfile();

      setUserProfile({
        id: 'user-123',
        conversations: ['char-001', 'char-002'],
      });

      const error = new Error('404');
      error.status = 404;
      apiJson.mockRejectedValue(error);

      await resetConversationHistory('char-002');

      expect(user.value.conversations).toEqual(['char-001']);
    });
  });

  describe('競態條件防護', () => {
    it('應該防止重複載入相同用戶', async () => {
      const mockApiResponse = {
        id: 'user-race',
        displayName: '競態測試',
      };

      // 模擬慢速 API 調用
      apiJson.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockApiResponse), 100))
      );

      const { loadUserProfile } = useUserProfile();

      // 同時發起兩個載入請求
      const [result1, result2] = await Promise.all([
        loadUserProfile('user-race'),
        loadUserProfile('user-race'),
      ]);

      // 應該只調用一次 API
      expect(apiJson).toHaveBeenCalledTimes(1);

      // 兩個結果應該相同
      expect(result1.id).toBe('user-race');
      expect(result2.id).toBe('user-race');
    });
  });

  describe('uid 處理', () => {
    it('應該使用 id 作為 uid（如果 uid 未提供）', () => {
      const { setUserProfile, user } = useUserProfile();

      setUserProfile({
        id: 'firebase-uid-123',
      });

      // uid 應該等於 id
      expect(user.value.uid).toBe('firebase-uid-123');
    });

    it('應該保留提供的 uid', () => {
      const { setUserProfile, user } = useUserProfile();

      setUserProfile({
        id: 'user-123',
        uid: 'custom-uid-456',
      });

      expect(user.value.uid).toBe('custom-uid-456');
    });
  });
});
