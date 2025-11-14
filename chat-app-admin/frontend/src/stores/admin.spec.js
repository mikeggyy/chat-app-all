/**
 * Admin Store 測試
 * 測試範圍：
 * - 認證狀態管理
 * - 權限檢查
 * - 登出功能
 * - Token 刷新
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAdminStore } from './admin';

// Mock Firebase Auth
const mockUser = {
  uid: 'test-user-id',
  email: 'admin@test.com',
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
  getIdTokenResult: vi.fn(),
};

// Create variable to store callback
let mockAuthStateChangedCallback = null;

vi.mock('../utils/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    mockAuthStateChangedCallback = callback;
    return vi.fn();
  }),
  signOut: vi.fn(),
}));

describe('Admin Store', () => {
  let mockAuth;
  let mockSignOut;

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Get mocked auth object and functions
    const firebase = await import('../utils/firebase');
    const firebaseAuth = await import('firebase/auth');

    mockAuth = firebase.auth;
    mockSignOut = firebaseAuth.signOut;

    // 重置 mock auth 狀態
    mockAuth.currentUser = null;
    mockAuthStateChangedCallback = null;
    mockUser.getIdToken.mockResolvedValue('mock-token');
  });

  describe('初始狀態', () => {
    it('應該有正確的初始狀態', () => {
      const store = useAdminStore();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAdmin).toBe(false);
      expect(store.userRole).toBeNull();
      expect(store.loading).toBe(true);
    });

    it('isAuthenticated 應該是 computed 屬性', () => {
      const store = useAdminStore();

      expect(store.isAuthenticated).toBe(false);

      store.user = mockUser;
      store.isAdmin = true;

      expect(store.isAuthenticated).toBe(true);
    });

    it('isSuperAdmin 應該正確判斷超級管理員', () => {
      const store = useAdminStore();

      expect(store.isSuperAdmin).toBe(false);

      store.userRole = 'admin';
      expect(store.isSuperAdmin).toBe(false);

      store.userRole = 'super_admin';
      expect(store.isSuperAdmin).toBe(true);
    });
  });

  describe('initializeAuth', () => {
    it('應該設置認證監聽器', async () => {
      const store = useAdminStore();
      const firebaseAuth = await import('firebase/auth');

      store.initializeAuth();

      expect(firebaseAuth.onAuthStateChanged).toHaveBeenCalled();
    });

    it('應該處理 super_admin 登入', async () => {
      const store = useAdminStore();

      mockUser.getIdTokenResult.mockResolvedValue({
        claims: { super_admin: true },
      });

      store.initializeAuth();

      // 模擬 Firebase auth state change
      await mockAuthStateChangedCallback(mockUser);

      expect(store.user).toStrictEqual(mockUser);
      expect(store.token).toBe('mock-token');
      expect(store.isAdmin).toBe(true);
      expect(store.userRole).toBe('super_admin');
      expect(store.loading).toBe(false);
    });

    it('應該處理 admin 登入', async () => {
      const store = useAdminStore();

      mockUser.getIdTokenResult.mockResolvedValue({
        claims: { admin: true },
      });

      store.initializeAuth();
      await mockAuthStateChangedCallback(mockUser);

      expect(store.isAdmin).toBe(true);
      expect(store.userRole).toBe('admin');
    });

    it('應該處理 moderator 登入', async () => {
      const store = useAdminStore();

      mockUser.getIdTokenResult.mockResolvedValue({
        claims: { moderator: true },
      });

      store.initializeAuth();
      await mockAuthStateChangedCallback(mockUser);

      expect(store.isAdmin).toBe(true);
      expect(store.userRole).toBe('moderator');
    });

    it('應該拒絕無權限的用戶', async () => {
      const store = useAdminStore();

      mockUser.getIdTokenResult.mockResolvedValue({
        claims: {},
      });

      store.initializeAuth();
      await mockAuthStateChangedCallback(mockUser);

      expect(store.user).toStrictEqual(mockUser);
      expect(store.isAdmin).toBe(false);
      expect(store.userRole).toBeNull();
    });

    it('應該處理未登入狀態', async () => {
      const store = useAdminStore();

      store.initializeAuth();
      await mockAuthStateChangedCallback(null);

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAdmin).toBe(false);
      expect(store.userRole).toBeNull();
      expect(store.loading).toBe(false);
    });

    it('應該按優先級設置權限等級', async () => {
      const store = useAdminStore();

      // 同時擁有多個權限時，應該選擇優先級最高的
      mockUser.getIdTokenResult.mockResolvedValue({
        claims: {
          super_admin: true,
          admin: true,
          moderator: true,
        },
      });

      store.initializeAuth();
      await mockAuthStateChangedCallback(mockUser);

      expect(store.userRole).toBe('super_admin');
    });
  });

  describe('logout', () => {
    it('應該成功登出', async () => {
      const store = useAdminStore();

      // 設置初始狀態
      store.user = mockUser;
      store.token = 'mock-token';
      store.isAdmin = true;
      store.userRole = 'admin';

      mockSignOut.mockResolvedValue();

      await store.logout();

      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAdmin).toBe(false);
      expect(store.userRole).toBeNull();
    });

    it('應該處理登出失敗', async () => {
      const store = useAdminStore();
      const error = new Error('Logout failed');

      mockSignOut.mockRejectedValue(error);

      await expect(store.logout()).rejects.toThrow('Logout failed');
    });

    it('登出後狀態應該完全重置', async () => {
      const store = useAdminStore();

      store.user = mockUser;
      store.token = 'token';
      store.isAdmin = true;
      store.userRole = 'super_admin';

      mockSignOut.mockResolvedValue();

      await store.logout();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAdmin).toBe(false);
      expect(store.userRole).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(store.isSuperAdmin).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('應該刷新 token 和權限', async () => {
      const store = useAdminStore();
      const newToken = 'new-token';

      store.user = mockUser;
      store.userRole = 'admin';

      mockUser.getIdToken.mockResolvedValue(newToken);
      mockUser.getIdTokenResult.mockResolvedValue({
        claims: { super_admin: true },
      });

      await store.refreshToken();

      expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
      expect(mockUser.getIdTokenResult).toHaveBeenCalledWith(true);
      expect(store.token).toBe(newToken);
      expect(store.userRole).toBe('super_admin');
    });

    it('應該處理沒有用戶的情況', async () => {
      const store = useAdminStore();
      store.user = null;

      await store.refreshToken();

      expect(mockUser.getIdToken).not.toHaveBeenCalled();
    });

    it('應該更新所有權限狀態', async () => {
      const store = useAdminStore();

      store.user = mockUser;
      store.isAdmin = true;
      store.userRole = 'admin';

      mockUser.getIdToken.mockResolvedValue('refreshed-token');
      mockUser.getIdTokenResult.mockResolvedValue({
        claims: { moderator: true },
      });

      await store.refreshToken();

      expect(store.userRole).toBe('moderator');
      expect(store.isAdmin).toBe(true);
    });

    it('應該處理權限被撤銷的情況', async () => {
      const store = useAdminStore();

      store.user = mockUser;
      store.isAdmin = true;
      store.userRole = 'admin';

      mockUser.getIdToken.mockResolvedValue('refreshed-token');
      mockUser.getIdTokenResult.mockResolvedValue({
        claims: {},
      });

      await store.refreshToken();

      expect(store.isAdmin).toBe(false);
      expect(store.userRole).toBeNull();
    });

    it('應該按優先級設置刷新後的權限', async () => {
      const store = useAdminStore();

      store.user = mockUser;

      mockUser.getIdToken.mockResolvedValue('new-token');
      mockUser.getIdTokenResult.mockResolvedValue({
        claims: {
          admin: true,
          moderator: true,
        },
      });

      await store.refreshToken();

      // admin 優先級高於 moderator
      expect(store.userRole).toBe('admin');
    });
  });

  describe('權限級別判斷', () => {
    it('不同權限等級應該正確設置', async () => {
      const testCases = [
        { claims: { super_admin: true }, expected: 'super_admin' },
        { claims: { admin: true }, expected: 'admin' },
        { claims: { moderator: true }, expected: 'moderator' },
        { claims: {}, expected: null },
      ];

      for (const { claims, expected } of testCases) {
        const store = useAdminStore();

        mockUser.getIdTokenResult.mockResolvedValue({ claims });

        store.initializeAuth();
        await mockAuthStateChangedCallback(mockUser);

        expect(store.userRole).toBe(expected);
        expect(store.isAdmin).toBe(expected !== null);
      }
    });
  });

  describe('響應式狀態', () => {
    it('user 變化應該觸發 isAuthenticated 更新', () => {
      const store = useAdminStore();

      expect(store.isAuthenticated).toBe(false);

      store.user = mockUser;
      store.isAdmin = true;

      expect(store.isAuthenticated).toBe(true);

      store.user = null;

      expect(store.isAuthenticated).toBe(false);
    });

    it('userRole 變化應該觸發 isSuperAdmin 更新', () => {
      const store = useAdminStore();

      expect(store.isSuperAdmin).toBe(false);

      store.userRole = 'admin';
      expect(store.isSuperAdmin).toBe(false);

      store.userRole = 'super_admin';
      expect(store.isSuperAdmin).toBe(true);

      store.userRole = null;
      expect(store.isSuperAdmin).toBe(false);
    });
  });
});
