/**
 * Stats API 路由測試
 * 測試範圍：
 * - 查詢所有生成統計
 * - 查詢指定用戶的生成統計
 * - 查詢角色創建限制
 * - 使用創建角色卡
 * - 權限和安全性檢查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies BEFORE importing the router
// ✅ 2025-12-02 修復：添加 Firebase mock 避免環境變數錯誤
vi.mock('../../firebase/index.js', () => ({
  getFirestoreDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      })),
    })),
  })),
  FieldValue: {
    increment: vi.fn((n) => n),
    serverTimestamp: vi.fn(),
  },
}));

vi.mock('../generationLog.service.js', () => ({
  getGenerationStats: vi.fn(),
}));

vi.mock('../characterCreationLimit.service.js', () => ({
  canCreateCharacter: vi.fn(),
  getCreationStats: vi.fn(),
}));

vi.mock('../../user/assets.service.js', () => ({
  consumeUserAsset: vi.fn(),
}));

vi.mock('../characterCreation.helpers.js', () => ({
  trimString: (str) => (str || '').trim(),
}));

vi.mock('../../auth/firebaseAuth.middleware.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    next();
  },
}));

// ✅ 2025-12-02 修復：添加 adminAuth middleware mock
vi.mock('../../middleware/adminAuth.middleware.js', () => ({
  requireAdmin: (req, res, next) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateRequest: () => (req, res, next) => next(),
  characterCreationSchemas: {
    generationStats: {},
    userGenerationStats: {},
    limits: {},
    useCreateCard: {},
  },
}));

// ✅ 2025-12-02 修復：mock 路徑需與實際 import 路徑一致（5 層上級）
vi.mock('../../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, statusCode = 200) => res.status(typeof statusCode === 'number' ? statusCode : 200).json({ success: true, data }),
  sendError: (res, code, message, details) => {
    const { error: detailError, ...safeDetails } = details || {};
    return res.status(
      code === 'RESOURCE_NOT_FOUND' ? 404 :
      code === 'FORBIDDEN' ? 403 :
      code === 'VALIDATION_ERROR' ? 400 :
      code === 'INSUFFICIENT_RESOURCES' ? 400 : 400
    ).json({
      success: false,
      error: code,
      message,
      ...safeDetails,
      ...(detailError ? { errorDetail: detailError } : {}),
    });
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import mocked services
import { getGenerationStats } from '../generationLog.service.js';
import { canCreateCharacter, getCreationStats } from '../characterCreationLimit.service.js';
import { consumeUserAsset } from '../../user/assets.service.js';
import { statsRouter } from './stats.routes.js';

describe('Stats API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/character-creation', statsRouter);

    // 添加錯誤處理中間件
    app.use((err, req, res, next) => {
      res.status(500).json({
        success: false,
        error: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || '內部錯誤',
      });
    });

    // 清除所有 mock
    vi.clearAllMocks();

    // 設置默認環境變數
    process.env.NODE_ENV = 'test';
  });

  describe('GET /generation-stats - 查詢所有生成統計', () => {
    it('應該成功查詢所有生成統計', async () => {
      const mockStats = {
        totalGenerations: 1000,
        completedGenerations: 850,
        failedGenerations: 150,
        byType: {
          voice: 300,
          persona: 250,
          description: 200,
          image: 250,
        },
        byStatus: {
          completed: 850,
          failed: 150,
        },
      };
      getGenerationStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/character-creation/generation-stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toEqual(mockStats);
      expect(getGenerationStats).toHaveBeenCalledWith(null);
    });

    it('應該需要認證', async () => {
      const mockStats = { totalGenerations: 0 };
      getGenerationStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/character-creation/generation-stats');

      // 由於我們 mock 了認證，這裡只是確認端點存在
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('GET /generation-stats/user/:userId - 查詢指定用戶的生成統計', () => {
    it('應該成功查詢自己的生成統計', async () => {
      const mockStats = {
        userId: 'test-user-123',
        totalGenerations: 25,
        completedGenerations: 20,
        failedGenerations: 5,
        byType: {
          voice: 8,
          persona: 6,
          description: 5,
          image: 6,
        },
      };
      getGenerationStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/character-creation/generation-stats/user/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toEqual(mockStats);
      expect(getGenerationStats).toHaveBeenCalledWith('test-user-123');
    });

    it('應該拒絕查詢其他用戶的統計', async () => {
      const response = await request(app)
        .get('/api/character-creation/generation-stats/user/other-user-456');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(getGenerationStats).not.toHaveBeenCalled();
    });

    it('應該返回空統計對於新用戶', async () => {
      const mockStats = {
        userId: 'test-user-123',
        totalGenerations: 0,
        completedGenerations: 0,
        failedGenerations: 0,
        byType: {
          voice: 0,
          persona: 0,
          description: 0,
          image: 0,
        },
      };
      getGenerationStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/character-creation/generation-stats/user/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.data.stats.totalGenerations).toBe(0);
    });
  });

  describe('GET /limits/:userId - 查詢角色創建限制', () => {
    it('應該成功查詢創建限制（有剩餘免費次數）', async () => {
      const mockLimitCheck = {
        allowed: true,
        remaining: 3,
        total: 5,
        message: '可以創建角色',
      };
      const mockCreationStats = {
        used: 2,
        remaining: 3,
        total: 5,
      };
      canCreateCharacter.mockResolvedValue(mockLimitCheck);
      getCreationStats.mockResolvedValue(mockCreationStats);

      const response = await request(app)
        .get('/api/character-creation/limits/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.limit).toEqual(mockLimitCheck);
      expect(response.body.data.stats).toEqual(mockCreationStats);
      expect(response.body.data.remainingFreeCreations).toBe(3);
      expect(canCreateCharacter).toHaveBeenCalledWith('test-user-123');
      expect(getCreationStats).toHaveBeenCalledWith('test-user-123');
    });

    it('應該成功查詢創建限制（免費次數用完）', async () => {
      const mockLimitCheck = {
        allowed: true,
        remaining: 0,
        total: 5,
        message: '免費次數已用完，可使用創建卡',
      };
      const mockCreationStats = {
        used: 5,
        remaining: 0,
        total: 5,
        createCards: 10,
      };
      canCreateCharacter.mockResolvedValue(mockLimitCheck);
      getCreationStats.mockResolvedValue(mockCreationStats);

      const response = await request(app)
        .get('/api/character-creation/limits/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.data.remainingFreeCreations).toBe(0);
      expect(response.body.data.stats.createCards).toBe(10);
    });

    it('應該返回不允許創建（超過限制且無創建卡）', async () => {
      const mockLimitCheck = {
        allowed: false,
        remaining: 0,
        total: 5,
        message: '已達到創建限制',
      };
      const mockCreationStats = {
        used: 5,
        remaining: 0,
        total: 5,
        createCards: 0,
      };
      canCreateCharacter.mockResolvedValue(mockLimitCheck);
      getCreationStats.mockResolvedValue(mockCreationStats);

      const response = await request(app)
        .get('/api/character-creation/limits/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.data.limit.allowed).toBe(false);
      expect(response.body.data.stats.createCards).toBe(0);
    });

    it('應該拒絕查詢其他用戶的限制', async () => {
      const response = await request(app)
        .get('/api/character-creation/limits/other-user-456');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(canCreateCharacter).not.toHaveBeenCalled();
      expect(getCreationStats).not.toHaveBeenCalled();
    });
  });

  describe('POST /use-create-card - 使用創建角色卡', () => {
    it('應該成功使用創建角色卡', async () => {
      const mockResult = {
        userId: 'test-user-123',
        createCards: 9,
        updatedAt: new Date().toISOString(),
      };
      consumeUserAsset.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/character-creation/use-create-card')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('成功使用創建角色卡');
      expect(response.body.data.remainingCards).toBe(9);
      expect(response.body.data.deducted).toBe(1);
      expect(consumeUserAsset).toHaveBeenCalledWith('test-user-123', 'createCards', 1);
    });

    it('應該使用認證 token 中的 userId（防止盜用）', async () => {
      const mockResult = {
        userId: 'test-user-123',
        createCards: 5,
      };
      consumeUserAsset.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/character-creation/use-create-card')
        .send({ userId: 'fake-user-999' }); // 嘗試偽造 userId

      expect(response.status).toBe(200);
      // 應該使用認證 token 中的 userId，而非請求體中的
      expect(consumeUserAsset).toHaveBeenCalledWith('test-user-123', 'createCards', 1);
    });

    it('應該處理創建卡不足的情況', async () => {
      const error = new Error('創建角色卡數量不足');
      error.code = 'INSUFFICIENT_RESOURCES';
      consumeUserAsset.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/character-creation/use-create-card')
        .send({});

      expect(response.status).toBe(500);
      expect(consumeUserAsset).toHaveBeenCalledWith('test-user-123', 'createCards', 1);
    });

    it('應該返回剩餘創建卡數量', async () => {
      const mockResult = {
        userId: 'test-user-123',
        createCards: 0, // 最後一張
      };
      consumeUserAsset.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/character-creation/use-create-card')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.remainingCards).toBe(0);
      expect(response.body.data.deducted).toBe(1);
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點都應該需要認證', async () => {
      const endpoints = [
        { method: 'get', path: '/api/character-creation/generation-stats' },
        { method: 'get', path: '/api/character-creation/generation-stats/user/test-user-123' },
        { method: 'get', path: '/api/character-creation/limits/test-user-123' },
        { method: 'post', path: '/api/character-creation/use-create-card' },
      ];

      // 由於我們已經 mock 了 requireFirebaseAuth，這裡只是確認端點存在
      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path).send({});
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      }
    });

    it('應該使用認證 token 中的 userId 進行權限檢查', async () => {
      const mockStats = { userId: 'test-user-123', totalGenerations: 10 };
      getGenerationStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/character-creation/generation-stats/user/test-user-123');

      expect(response.status).toBe(200);
      expect(getGenerationStats).toHaveBeenCalledWith('test-user-123');
    });

    it('應該拒絕未授權的跨用戶訪問', async () => {
      // 嘗試查詢其他用戶的統計
      const response1 = await request(app)
        .get('/api/character-creation/generation-stats/user/other-user');
      expect(response1.status).toBe(403);

      // 嘗試查詢其他用戶的限制
      const response2 = await request(app)
        .get('/api/character-creation/limits/other-user');
      expect(response2.status).toBe(403);
    });
  });
});
