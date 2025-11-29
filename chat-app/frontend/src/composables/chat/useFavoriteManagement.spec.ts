/**
 * useFavoriteManagement Composable 測試
 *
 * 測試範圍：
 * - 收藏和取消收藏功能
 * - 樂觀更新機制
 * - 錯誤回滾
 * - 訪客限制檢查
 * - 防重複操作
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFavoriteManagement } from './useFavoriteManagement.js';
import type { UseFavoriteManagementDeps } from './useFavoriteManagement.js';
import type { User, FirebaseAuthService } from '../../types';

// Mock dependencies
vi.mock('../../utils/api', () => ({
  apiJson: vi.fn(),
}));

import { apiJson } from '../../utils/api.js';

describe('useFavoriteManagement - 收藏管理測試', () => {
  let mockDeps: UseFavoriteManagementDeps;
  let mockUser: User;
  let mockFirebaseAuth: FirebaseAuthService;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // Mock user
    mockUser = {
      id: 'user-123',
      displayName: '測試用戶',
      favorites: ['char-001', 'char-002'],
    } as User;

    // Mock Firebase Auth
    mockFirebaseAuth = {
      getCurrentUserIdToken: vi.fn(async () => 'mock-token-123'),
    } as any;

    // 創建標準的 mock 依賴項
    mockDeps = {
      getCurrentUserId: vi.fn(() => 'user-123'),
      getPartnerId: vi.fn(() => 'char-003'),
      getPartnerName: vi.fn(() => '測試角色'),
      getUser: vi.fn(() => mockUser),
      getFirebaseAuth: vi.fn(() => mockFirebaseAuth),
      setUserProfile: vi.fn(),
      requireLogin: vi.fn(() => false),
      showError: vi.fn(),
      showSuccess: vi.fn(),
    };
  });

  describe('toggleFavorite - 添加收藏', () => {
    it('應該成功添加收藏（完整流程）', async () => {
      const mockResponse = { favorites: ['char-001', 'char-002', 'char-003'] };
      (apiJson as any).mockResolvedValueOnce(mockResponse);

      const { toggleFavorite, isFavoriteMutating } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 驗證樂觀更新
      expect(mockDeps.setUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: ['char-001', 'char-002', 'char-003'],
        })
      );

      // 驗證 API 調用
      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-123/favorites',
        expect.objectContaining({
          method: 'POST',
          body: { matchId: 'char-003' },
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
          skipGlobalLoading: true,
        })
      );

      // 驗證成功消息
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('已收藏 測試角色');

      // 驗證 mutating 狀態被清除
      expect(isFavoriteMutating.value).toBe(false);
    });

    it('應該在沒有角色名稱時顯示基本成功消息', async () => {
      mockDeps.getPartnerName = undefined;
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-001', 'char-002', 'char-003'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showSuccess).toHaveBeenCalledWith('已收藏');
    });

    it('應該在沒有角色名稱函數但返回空字符串時顯示基本消息', async () => {
      mockDeps.getPartnerName = vi.fn(() => '');
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-001', 'char-002', 'char-003'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showSuccess).toHaveBeenCalledWith('已收藏');
    });

    it('應該使用後端返回的收藏列表更新', async () => {
      const backendFavorites = ['char-001', 'char-002', 'char-003', 'char-004'];
      (apiJson as any).mockResolvedValueOnce({ favorites: backendFavorites });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 驗證使用後端返回的列表（第二次調用）
      expect(mockDeps.setUserProfile).toHaveBeenCalledTimes(2);
      expect(mockDeps.setUserProfile).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          favorites: backendFavorites,
        })
      );
    });

    it('應該在後端未返回 favorites 時使用樂觀更新的列表', async () => {
      (apiJson as any).mockResolvedValueOnce({ success: true });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 驗證使用樂觀更新的列表（第二次調用）
      expect(mockDeps.setUserProfile).toHaveBeenCalledTimes(2);
      expect(mockDeps.setUserProfile).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          favorites: ['char-001', 'char-002', 'char-003'],
        })
      );
    });
  });

  describe('toggleFavorite - 取消收藏', () => {
    it('應該成功取消收藏（完整流程）', async () => {
      mockDeps.getPartnerId = vi.fn(() => 'char-001'); // 已在收藏列表中
      const mockResponse = { favorites: ['char-002'] };
      (apiJson as any).mockResolvedValueOnce(mockResponse);

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 驗證樂觀更新
      expect(mockDeps.setUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: ['char-002'],
        })
      );

      // 驗證 API 調用（DELETE）
      expect(apiJson).toHaveBeenCalledWith(
        '/api/users/user-123/favorites/char-001',
        expect.objectContaining({
          method: 'DELETE',
          body: undefined,
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
          skipGlobalLoading: true,
        })
      );

      // 驗證成功消息
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('已取消收藏 測試角色');
    });

    it('應該在沒有角色名稱時顯示基本取消消息', async () => {
      mockDeps.getPartnerId = vi.fn(() => 'char-001');
      mockDeps.getPartnerName = undefined;
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-002'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showSuccess).toHaveBeenCalledWith('已取消收藏');
    });

    it('應該正確處理空的收藏列表', async () => {
      mockUser.favorites = [];
      mockDeps.getPartnerId = vi.fn(() => 'char-003');
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-003'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 驗證添加到空列表
      expect(mockDeps.setUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: ['char-003'],
        })
      );
    });

    it('應該正確處理 favorites 為 undefined', async () => {
      mockUser.favorites = undefined as any;
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-003'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 應該將 undefined 視為空數組
      expect(mockDeps.setUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: ['char-003'],
        })
      );
    });
  });

  describe('參數驗證', () => {
    it('應該在 userId 為空時不執行', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => '');

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(apiJson).not.toHaveBeenCalled();
      expect(mockDeps.setUserProfile).not.toHaveBeenCalled();
    });

    it('應該在 matchId 為空時不執行', async () => {
      mockDeps.getPartnerId = vi.fn(() => '');

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(apiJson).not.toHaveBeenCalled();
      expect(mockDeps.setUserProfile).not.toHaveBeenCalled();
    });

    it('應該在 userId 和 matchId 都為空時不執行', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => '');
      mockDeps.getPartnerId = vi.fn(() => '');

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(apiJson).not.toHaveBeenCalled();
      expect(mockDeps.setUserProfile).not.toHaveBeenCalled();
    });

    it('應該在用戶資料為空時顯示錯誤', async () => {
      mockDeps.getUser = vi.fn(() => null);

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showError).toHaveBeenCalledWith('請登入後才能收藏角色。');
      expect(apiJson).not.toHaveBeenCalled();
    });

    it('應該在用戶資料沒有 id 時顯示錯誤', async () => {
      mockUser.id = '' as any;
      mockDeps.getUser = vi.fn(() => mockUser);

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showError).toHaveBeenCalledWith('請登入後才能收藏角色。');
      expect(apiJson).not.toHaveBeenCalled();
    });
  });

  describe('訪客限制檢查', () => {
    it('應該在訪客嘗試收藏時要求登入', async () => {
      mockDeps.requireLogin = vi.fn(() => true); // 返回 true 表示需要登入

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.requireLogin).toHaveBeenCalledWith({ feature: '收藏角色' });
      expect(apiJson).not.toHaveBeenCalled();
      expect(mockDeps.setUserProfile).not.toHaveBeenCalled();
    });

    it('應該在已登入用戶可以正常收藏', async () => {
      mockDeps.requireLogin = vi.fn(() => false); // 返回 false 表示不需要登入
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-001', 'char-002', 'char-003'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.requireLogin).toHaveBeenCalledWith({ feature: '收藏角色' });
      expect(apiJson).toHaveBeenCalled();
      expect(mockDeps.setUserProfile).toHaveBeenCalled();
    });
  });

  describe('防重複操作', () => {
    it('應該在 isFavoriteMutating 為 true 時不執行', async () => {
      const { toggleFavorite, isFavoriteMutating } = useFavoriteManagement(mockDeps);

      // 手動設置為 true
      isFavoriteMutating.value = true;

      await toggleFavorite();

      expect(apiJson).not.toHaveBeenCalled();
      expect(mockDeps.setUserProfile).not.toHaveBeenCalled();
    });

    it('應該在操作進行中時阻止第二次調用', async () => {
      (apiJson as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ favorites: [] }), 100))
      );

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      // 同時發起兩個請求
      const promise1 = toggleFavorite();
      const promise2 = toggleFavorite();

      await Promise.all([promise1, promise2]);

      // 應該只調用一次 API
      expect(apiJson).toHaveBeenCalledTimes(1);
    });
  });

  describe('樂觀更新機制', () => {
    it('應該立即更新本地狀態（添加收藏）', async () => {
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-001', 'char-002', 'char-003'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      const togglePromise = toggleFavorite();

      // 等待一小段時間讓樂觀更新執行
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 驗證樂觀更新已執行（第一次調用）
      expect(mockDeps.setUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: ['char-001', 'char-002', 'char-003'],
        })
      );

      await togglePromise;
    });

    it('應該立即更新本地狀態（取消收藏）', async () => {
      mockDeps.getPartnerId = vi.fn(() => 'char-001');
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-002'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      const togglePromise = toggleFavorite();

      // 等待一小段時間讓樂觀更新執行
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 驗證樂觀更新已執行（第一次調用）
      expect(mockDeps.setUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: ['char-002'],
        })
      );

      await togglePromise;
    });
  });

  describe('錯誤處理', () => {
    it('應該在 API 錯誤時回滾到之前的狀態', async () => {
      const errorMessage = '網絡錯誤';
      (apiJson as any).mockRejectedValueOnce(new Error(errorMessage));

      const { toggleFavorite, isFavoriteMutating } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 驗證樂觀更新執行了（第一次調用）
      expect(mockDeps.setUserProfile).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          favorites: ['char-001', 'char-002', 'char-003'],
        })
      );

      // 驗證錯誤回滾（第二次調用）
      expect(mockDeps.setUserProfile).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          favorites: ['char-001', 'char-002'],
        })
      );

      // 驗證顯示錯誤消息
      expect(mockDeps.showError).toHaveBeenCalledWith(errorMessage);

      // 驗證 mutating 狀態被清除
      expect(isFavoriteMutating.value).toBe(false);
    });

    it('應該處理 Error 對象錯誤', async () => {
      const errorMessage = 'API 請求失敗';
      (apiJson as any).mockRejectedValueOnce(new Error(errorMessage));

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showError).toHaveBeenCalledWith(errorMessage);
    });

    it('應該處理非 Error 對象錯誤', async () => {
      (apiJson as any).mockRejectedValueOnce('字符串錯誤');

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showError).toHaveBeenCalledWith('更新收藏時發生錯誤，請稍後再試。');
    });

    it('應該在錯誤後不顯示成功消息', async () => {
      (apiJson as any).mockRejectedValueOnce(new Error('失敗'));

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });

    it('應該確保 finally 清除 mutating 狀態', async () => {
      (apiJson as any).mockRejectedValueOnce(new Error('失敗'));

      const { toggleFavorite, isFavoriteMutating } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 即使錯誤，mutating 狀態也應該被清除
      expect(isFavoriteMutating.value).toBe(false);
    });
  });

  describe('邊界情況', () => {
    it('應該處理 getPartnerName 為 undefined', async () => {
      mockDeps.getPartnerName = undefined;
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-001', 'char-002', 'char-003'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 不應該拋出錯誤
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('已收藏');
    });

    it('應該處理 favorites 不是數組的情況', async () => {
      mockUser.favorites = 'not-an-array' as any;
      (apiJson as any).mockResolvedValueOnce({ favorites: ['char-003'] });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 應該將非數組視為空數組
      expect(mockDeps.setUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: ['char-003'],
        })
      );
    });

    it('應該處理後端返回的 favorites 不是數組', async () => {
      (apiJson as any).mockResolvedValueOnce({ favorites: 'not-an-array' });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 應該使用樂觀更新的列表
      expect(mockDeps.setUserProfile).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          favorites: ['char-001', 'char-002', 'char-003'],
        })
      );
    });

    it('應該處理空的用戶資料對象', async () => {
      mockDeps.getUser = vi.fn(() => ({} as User));

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      expect(mockDeps.showError).toHaveBeenCalledWith('請登入後才能收藏角色。');
    });

    it('應該處理 getCurrentUserIdToken 失敗', async () => {
      mockFirebaseAuth.getCurrentUserIdToken = vi.fn(async () => {
        throw new Error('無法獲取 token');
      });

      const { toggleFavorite } = useFavoriteManagement(mockDeps);

      await toggleFavorite();

      // 應該回滾並顯示錯誤
      expect(mockDeps.showError).toHaveBeenCalledWith('無法獲取 token');
      expect(mockDeps.setUserProfile).toHaveBeenCalledTimes(2); // 樂觀更新 + 回滾
    });
  });

  describe('API 暴露', () => {
    it('應該暴露所有必要的 API', () => {
      const result = useFavoriteManagement(mockDeps);

      expect(result).toHaveProperty('isFavoriteMutating');
      expect(result).toHaveProperty('toggleFavorite');
      expect(typeof result.toggleFavorite).toBe('function');
    });

    it('應該返回響應式的 isFavoriteMutating', async () => {
      (apiJson as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ favorites: [] }), 50))
      );

      const { toggleFavorite, isFavoriteMutating } = useFavoriteManagement(mockDeps);

      expect(isFavoriteMutating.value).toBe(false);

      const promise = toggleFavorite();

      // 操作進行中
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(isFavoriteMutating.value).toBe(true);

      await promise;

      // 操作完成
      expect(isFavoriteMutating.value).toBe(false);
    });
  });
});
