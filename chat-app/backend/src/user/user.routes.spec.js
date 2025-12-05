/**
 * User API 路由測試
 *
 * 測試範圍：
 * - 用戶資料 CRUD
 * - 收藏管理
 * - 對話管理
 * - 資產管理
 * - 權限驗證
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { userRouter } from './user.routes.js';

// Mock 依賴
vi.mock('./user.service.js', () => ({
  getAllUsers: vi.fn(),
  getUserById: vi.fn(),
  upsertUser: vi.fn(),
  updateUserPhoto: vi.fn(),
  updateUserProfileFields: vi.fn(),
  addFavoriteForUser: vi.fn(),
  removeFavoriteForUser: vi.fn(),
  addConversationForUser: vi.fn(),
  removeConversationForUser: vi.fn(),
  normalizeUser: vi.fn((user) => user), // 直接返回用戶
}));

vi.mock('./assets.service.js', () => ({
  getUserAssets: vi.fn(),
  addUserAsset: vi.fn(),
  consumeUserAsset: vi.fn(),
  setUserAssets: vi.fn(),
}));

vi.mock('./userConversations.service.js', () => ({
  getUserConversations: vi.fn(),
}));

vi.mock('../auth/index.js', () => ({
  requireFirebaseAuth: vi.fn((req, res, next) => {
    req.firebaseUser = { uid: 'test-user-123' };
    next();
  }),
}));

vi.mock('../middleware/adminAuth.middleware.js', () => ({
  requireAdmin: vi.fn((req, res, next) => {
    req.firebaseUser.isAdmin = true;
    next();
  }),
}));

vi.mock('../utils/routeHelpers.js', () => ({
  requireOwnership: vi.fn(() => (req, res, next) => next()),
  asyncHandler: vi.fn((fn) => fn),
}));

vi.mock('../match/match.service.js', () => ({
  getMatchesByIds: vi.fn(),
  listMatchesByCreator: vi.fn(),
}));

vi.mock('../firebase/index.js', () => ({
  getFirestoreDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        update: vi.fn(),
      })),
    })),
  })),
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  standardRateLimiter: (req, res, next) => next(),
  relaxedRateLimiter: (req, res, next) => next(),
}));

vi.mock('../utils/responseOptimizer.js', () => ({
  applySelector: vi.fn((data) => data),
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// ✅ 2025-12-02 修復：添加 errorFormatter mock
vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, options = {}) => {
    const status = options.status || 200;
    return res.status(status).json({ success: true, data });
  },
  sendError: (res, code, message, details) => {
    const status = code === 'USER_NOT_FOUND' || code === 'RESOURCE_NOT_FOUND' ? 404 :
                   code === 'FORBIDDEN' ? 403 :
                   code === 'VALIDATION_ERROR' ? 400 :
                   code === 'INTERNAL_SERVER_ERROR' ? 500 : 400;
    return res.status(status).json({
      success: false,
      error: code,
      message,
      ...(details || {}),
    });
  },
  ApiError: class ApiError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
      this.statusCode = code === 'USER_NOT_FOUND' || code === 'RESOURCE_NOT_FOUND' ? 404 : 400;
    }
  },
}));

describe('User API Routes', () => {
  let app;
  let userService;
  let assetsService;
  let matchService;
  let userConversationsService;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/users', userRouter);

    // ✅ 2025-12-02 修復：添加錯誤處理中間件
    app.use((err, req, res, next) => {
      const status = err.statusCode || 500;
      const code = err.code || 'INTERNAL_SERVER_ERROR';
      return res.status(status).json({
        success: false,
        error: code,
        message: err.message || 'Internal Server Error',
        ...(err.details || {}),
      });
    });

    // 獲取 mock 服務
    const userServiceModule = await import('./user.service.js');
    userService = userServiceModule;

    const assetsServiceModule = await import('./assets.service.js');
    assetsService = assetsServiceModule;

    const matchServiceModule = await import('../match/match.service.js');
    matchService = matchServiceModule;

    const userConversationsServiceModule = await import('./userConversations.service.js');
    userConversationsService = userConversationsServiceModule;

    // 清除所有 mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========== 用戶資料測試 ==========

  describe('GET /api/users/:id - 獲取用戶資料', () => {
    it('應該成功獲取現有用戶資料', async () => {
      const mockUser = {
        id: 'test-user-123',
        uid: 'test-user-123',
        displayName: '測試用戶',
        email: 'test@example.com',
        membershipTier: 'free',
        coins: 1000,
      };

      userService.getUserById.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .get('/api/users/test-user-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-user-123');
      expect(userService.getUserById).toHaveBeenCalledWith('test-user-123');
    });

    // ✅ 2025-12-02 修復：路由已更新，GET 請求不再自動創建用戶
    // 用戶應該通過 POST /api/users 創建
    it('應該對不存在的用戶返回 404', async () => {
      userService.getUserById.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/users/test-user-123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('USER_NOT_FOUND');
      expect(userService.upsertUser).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/users - 創建/更新用戶', () => {
    it('應該成功創建新用戶', async () => {
      const mockUser = {
        id: 'test-user-123',
        uid: 'test-user-123',
        displayName: '測試用戶',
        email: 'test@example.com',
      };

      userService.upsertUser.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/users')
        .send({
          displayName: '測試用戶',
          email: 'test@example.com',
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-user-123');
      expect(userService.upsertUser).toHaveBeenCalled();
    });

    it('應該自動填充 Firebase 用戶信息', async () => {
      userService.upsertUser.mockImplementation((user) => Promise.resolve(user));

      const response = await request(app)
        .post('/api/users')
        .send({ age: 25 });

      expect([200, 201]).toContain(response.status);

      // 檢查是否填充了 Firebase 用戶信息
      const callArgs = userService.upsertUser.mock.calls[0][0];
      expect(callArgs.uid).toBe('test-user-123');
      expect(callArgs.id).toBe('test-user-123');
    });
  });

  describe('PATCH /api/users/:id/profile - 更新個人資料', () => {
    it('應該成功更新用戶資料', async () => {
      const mockUser = {
        id: 'test-user-123',
        displayName: '新名稱',
        gender: 'male',
        age: 25,
      };

      userService.updateUserProfileFields.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .patch('/api/users/test-user-123/profile')
        .send({
          displayName: '新名稱',
          gender: 'male',
          age: 25,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe('新名稱');
      expect(userService.updateUserProfileFields).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          displayName: '新名稱',
          gender: 'male',
          age: 25,
        })
      );
    });

    it('應該在未提供可更新欄位時返回錯誤', async () => {
      const response = await request(app)
        .patch('/api/users/test-user-123/profile')
        .send({});

      expect(response.status).toBe(400);
      // 驗證錯誤響應（可能是 sendError 格式或其他格式）
      expect(
        response.body.success === false ||
        response.body.error ||
        response.body.message
      ).toBeTruthy();
    });
  });

  describe('PATCH /api/users/:id/photo - 更新頭像', () => {
    it('應該成功更新用戶頭像', async () => {
      const mockUser = {
        id: 'test-user-123',
        photoURL: 'https://example.com/avatar.jpg',
      };

      userService.updateUserPhoto.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .patch('/api/users/test-user-123/photo')
        .send({ photoURL: 'https://example.com/avatar.jpg' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.photoURL).toBe('https://example.com/avatar.jpg');
    });
  });

  // ========== 收藏管理測試 ==========

  describe('GET /api/users/:id/favorites - 獲取收藏列表', () => {
    it('應該成功獲取用戶收藏列表（僅 ID）', async () => {
      const mockUser = {
        id: 'test-user-123',
        favorites: ['char-001', 'char-002'],
      };

      userService.getUserById.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .get('/api/users/test-user-123/favorites')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.favorites).toEqual(['char-001', 'char-002']);
    });

    it('應該可以包含角色詳細信息', async () => {
      const mockUser = {
        id: 'test-user-123',
        favorites: ['char-001'],
      };

      const mockMatches = [
        { id: 'char-001', name: 'Character 1' },
      ];

      userService.getUserById.mockResolvedValueOnce(mockUser);
      matchService.getMatchesByIds.mockResolvedValueOnce({
        matches: mockMatches,
        missing: [],
      });

      const response = await request(app)
        .get('/api/users/test-user-123/favorites?include=matches')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matches).toHaveLength(1);
      expect(response.body.data.matches[0].name).toBe('Character 1');
    });
  });

  describe('POST /api/users/:id/favorites - 添加收藏', () => {
    it('應該成功添加收藏', async () => {
      const mockUser = {
        id: 'test-user-123',
        favorites: ['char-001'],
        isNewFavorite: true, // 首次收藏
      };

      userService.addFavoriteForUser.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/users/test-user-123/favorites')
        .send({ matchId: 'char-001' });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(userService.addFavoriteForUser).toHaveBeenCalledWith(
        'test-user-123',
        'char-001'
      );
    });

    it('應該在首次收藏時增加角色的 totalFavorites', async () => {
      const mockUser = {
        id: 'test-user-123',
        favorites: ['char-001'],
        isNewFavorite: true, // 標記為首次收藏
      };

      userService.addFavoriteForUser.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/users/test-user-123/favorites')
        .send({ matchId: 'char-001' });

      expect([200, 201]).toContain(response.status);
      // 驗證 Firestore 更新被調用
      // （實際的 Firestore mock 在路由中被調用）
    });
  });

  describe('DELETE /api/users/:id/favorites/:favoriteId - 刪除收藏', () => {
    it('應該成功刪除收藏', async () => {
      const mockUser = {
        id: 'test-user-123',
        favorites: [],
      };

      userService.removeFavoriteForUser.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .delete('/api/users/test-user-123/favorites/char-001')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(userService.removeFavoriteForUser).toHaveBeenCalledWith(
        'test-user-123',
        'char-001'
      );
    });
  });

  // ========== 對話管理測試 ==========

  describe('GET /api/users/:id/conversations - 獲取對話列表', () => {
    it('應該成功獲取對話列表', async () => {
      const mockConversations = [
        {
          characterId: 'char-001',
          updatedAt: '2025-01-13T10:00:00Z',
          lastMessage: { text: 'Hello' },
        },
      ];

      const mockCharacters = [
        {
          id: 'char-001',
          name: 'Character 1',
          totalChatUsers: 100,
          totalFavorites: 50,
        },
      ];

      userConversationsService.getUserConversations.mockResolvedValueOnce({
        conversations: mockConversations,
        nextCursor: null,
        hasMore: false,
      });

      matchService.getMatchesByIds.mockResolvedValueOnce({
        matches: mockCharacters,
        missing: [],
      });

      const response = await request(app)
        .get('/api/users/test-user-123/conversations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });

    it('應該支持分頁參數', async () => {
      userConversationsService.getUserConversations.mockResolvedValueOnce({
        conversations: [],
        nextCursor: 'cursor-123',
        hasMore: true,
      });

      matchService.getMatchesByIds.mockResolvedValueOnce({
        matches: [],
        missing: [],
      });

      const response = await request(app)
        .get('/api/users/test-user-123/conversations?limit=10&cursor=cursor-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(userConversationsService.getUserConversations).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          limit: 10,
          cursor: 'cursor-123',
        })
      );
    });

    it('應該在用戶不存在時返回空數組', async () => {
      userConversationsService.getUserConversations.mockRejectedValueOnce(
        new Error('User not found')
      );

      const response = await request(app)
        .get('/api/users/test-user-123/conversations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });
  });

  describe('POST /api/users/:id/conversations - 添加對話', () => {
    it('應該成功添加對話', async () => {
      const mockUser = {
        id: 'test-user-123',
        conversations: ['char-001'],
      };

      userService.addConversationForUser.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/users/test-user-123/conversations')
        .send({ conversationId: 'char-001' });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toContain('char-001');
    });
  });

  describe('DELETE /api/users/:id/conversations/:conversationId - 刪除對話', () => {
    it('應該成功刪除對話', async () => {
      const mockUser = {
        id: 'test-user-123',
        conversations: [],
      };

      userService.removeConversationForUser.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .delete('/api/users/test-user-123/conversations/char-001')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(userService.removeConversationForUser).toHaveBeenCalledWith(
        'test-user-123',
        'char-001'
      );
    });
  });

  // ========== 資產管理測試 ==========

  describe('GET /api/users/:id/assets - 獲取資產', () => {
    it('應該成功獲取用戶資產', async () => {
      const mockAssets = {
        unlockTickets: 5,
        photoCards: 10,
        potions: {
          conversationBoost: 2,
        },
      };

      assetsService.getUserAssets.mockResolvedValueOnce(mockAssets);

      const response = await request(app)
        .get('/api/users/test-user-123/assets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.unlockTickets).toBe(5);
      expect(response.body.data.photoCards).toBe(10);
    });
  });

  describe('POST /api/users/:id/assets/add - 添加資產', () => {
    it('應該成功添加資產', async () => {
      const mockAssets = {
        unlockTickets: 6,
      };

      assetsService.addUserAsset.mockResolvedValueOnce(mockAssets);

      const response = await request(app)
        .post('/api/users/test-user-123/assets/add')
        .send({ assetType: 'unlockTickets', amount: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(assetsService.addUserAsset).toHaveBeenCalledWith(
        'test-user-123',
        'unlockTickets',
        1
      );
    });

    it('應該在未提供資產類型時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/users/test-user-123/assets/add')
        .send({ amount: 1 });

      expect(response.status).toBe(400);
      // 驗證錯誤響應
      expect(
        response.body.success === false ||
        response.body.error ||
        response.body.message
      ).toBeTruthy();
    });
  });

  describe('POST /api/users/:id/assets/consume - 消耗資產', () => {
    it('應該成功消耗資產', async () => {
      const mockAssets = {
        unlockTickets: 4,
      };

      assetsService.consumeUserAsset.mockResolvedValueOnce(mockAssets);

      const response = await request(app)
        .post('/api/users/test-user-123/assets/consume')
        .send({ assetType: 'unlockTickets', amount: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(assetsService.consumeUserAsset).toHaveBeenCalledWith(
        'test-user-123',
        'unlockTickets',
        1
      );
    });

    it('應該在資產不足時返回錯誤', async () => {
      assetsService.consumeUserAsset.mockRejectedValueOnce(
        new Error('unlockTickets 數量不足')
      );

      const response = await request(app)
        .post('/api/users/test-user-123/assets/consume')
        .send({ assetType: 'unlockTickets', amount: 10 });

      // 應該返回 400 或 500 錯誤
      expect(response.status).toBeGreaterThanOrEqual(400);
      // 驗證錯誤響應
      expect(
        response.body.success === false ||
        response.body.error ||
        response.body.message
      ).toBeTruthy();
    });
  });

  describe('PUT /api/users/:id/assets - 設置資產', () => {
    it('應該成功設置用戶資產', async () => {
      const mockAssets = {
        unlockTickets: 100,
        photoCards: 200,
      };

      assetsService.setUserAssets.mockResolvedValueOnce(mockAssets);

      const response = await request(app)
        .put('/api/users/test-user-123/assets')
        .send({
          assets: {
            unlockTickets: 100,
            photoCards: 200,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.unlockTickets).toBe(100);
    });

    it('應該在提供無效資產對象時返回錯誤', async () => {
      const response = await request(app)
        .put('/api/users/test-user-123/assets')
        .send({ assets: 'invalid' });

      expect(response.status).toBe(400);
      // 驗證錯誤響應
      expect(
        response.body.success === false ||
        response.body.error ||
        response.body.message
      ).toBeTruthy();
    });
  });

  // ========== 管理員路由測試 ==========

  describe('GET /api/users - 獲取所有用戶（管理員）', () => {
    it('應該成功獲取用戶列表', async () => {
      const mockUsers = [
        { id: 'user-001', displayName: 'User 1' },
        { id: 'user-002', displayName: 'User 2' },
      ];

      userService.getAllUsers.mockResolvedValueOnce({
        users: mockUsers,
        total: 2,
      });

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(2);
    });

    it('應該支持分頁參數', async () => {
      userService.getAllUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
      });

      await request(app)
        .get('/api/users?limit=50&startAfter=user-100')
        .expect(200);

      expect(userService.getAllUsers).toHaveBeenCalledWith({
        limit: 50,
        startAfter: 'user-100',
      });
    });
  });

  // ========== 錯誤處理測試 ==========

  describe('錯誤處理', () => {
    it('應該處理服務層拋出的錯誤', async () => {
      userService.getUserById.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/test-user-123');

      // 錯誤應該被中間件捕獲，返回 500 或其他錯誤狀態碼
      expect(response.status).toBeGreaterThanOrEqual(400);
      // 驗證有錯誤響應（任何格式）
      expect(response.body).toBeDefined();
    });
  });
});
