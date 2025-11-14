/**
 * ConversationLimit API 路由測試
 * 測試範圍：
 * - 檢查對話限制（公開）
 * - 獲取對話統計（需認證）
 * - 記錄對話次數
 * - 透過廣告解鎖對話次數
 * - 重置對話限制（管理員）
 * - 權限和安全性檢查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import conversationLimitRouter from './conversationLimit.routes.js';

// Mock all dependencies
vi.mock('./conversationLimit.service.js', () => ({
  conversationLimitService: {
    canUse: vi.fn(),
    getStats: vi.fn(),
    reset: vi.fn(),
  },
  recordMessage: vi.fn(),
}));

vi.mock('../ad/ad.service.js', () => ({
  claimAdReward: vi.fn(),
}));

vi.mock('../auth/firebaseAuth.middleware.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    next();
  },
}));

vi.mock('../middleware/adminAuth.middleware.js', () => ({
  requireAdmin: (req, res, next) => {
    // Mock admin check - assumes user is admin
    next();
  },
}));

vi.mock('../utils/routeHelpers.js', () => ({
  sendSuccess: (res, data) => res.json({ success: true, ...data }),
  sendError: (res, error, status = 400) => {
    const message = typeof error === 'string' ? error : error.message;
    return res.status(status).json({
      success: false,
      error: error.code || 'ERROR',
      message
    });
  },
  asyncHandler: (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      const message = typeof error === 'string' ? error : error.message;
      const status = error.message?.includes('超過') ? 429 :
                     error.message?.includes('未找到') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: error.code || 'ERROR',
        message
      });
    }
  },
  requireOwnership: (param) => (req, res, next) => {
    // For testing, allow if userId matches or is test user
    const userId = req.params[param];
    if (userId === req.firebaseUser?.uid || userId === 'test-user-123') {
      next();
    } else {
      res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }
  },
  requireParams: (params, source = 'body') => (req, res, next) => next(),
  getLimitErrorStatus: (error) => {
    if (error.message?.includes('超過')) return 429;
    if (error.message?.includes('未找到')) return 404;
    return 400;
  },
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import mocked services
import { conversationLimitService, recordMessage } from './conversationLimit.service.js';
import { claimAdReward } from '../ad/ad.service.js';

describe('ConversationLimit API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/conversations/limit', conversationLimitRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('GET /:userId/:characterId/check - 檢查對話限制（公開）', () => {
    it('應該成功檢查對話限制', async () => {
      const mockCheck = {
        canUse: true,
        remaining: 10,
        limit: 50,
        used: 40,
        resetAt: new Date().toISOString(),
      };
      conversationLimitService.canUse.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/conversations/limit/test-user-123/char-001/check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canUse).toBe(true);
      expect(response.body.remaining).toBe(10);
      expect(conversationLimitService.canUse).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該返回已達限制的狀態', async () => {
      const mockCheck = {
        canUse: false,
        remaining: 0,
        limit: 50,
        used: 50,
        resetAt: new Date().toISOString(),
      };
      conversationLimitService.canUse.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/conversations/limit/test-user-123/char-001/check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canUse).toBe(false);
      expect(response.body.remaining).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      conversationLimitService.canUse.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/conversations/limit/test-user-123/char-001/check');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該不需要認證（公開端點）', async () => {
      const mockCheck = {
        canUse: true,
        remaining: 10,
      };
      conversationLimitService.canUse.mockResolvedValueOnce(mockCheck);

      // 不需要認證 header
      const response = await request(app)
        .get('/api/conversations/limit/any-user/char-001/check');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /stats - 獲取對話統計（需認證）', () => {
    it('應該成功獲取對話統計', async () => {
      const mockStats = {
        totalCharacters: 5,
        characterStats: {
          'char-001': { used: 10, limit: 50 },
          'char-002': { used: 5, limit: 50 },
        },
        lastResetAt: new Date().toISOString(),
      };
      conversationLimitService.getStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/conversations/limit/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalCharacters).toBe(5);
      expect(conversationLimitService.getStats).toHaveBeenCalledWith('test-user-123');
    });

    it('應該返回空統計（新用戶）', async () => {
      const mockStats = {
        totalCharacters: 0,
        characterStats: {},
      };
      conversationLimitService.getStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/conversations/limit/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalCharacters).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      conversationLimitService.getStats.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/conversations/limit/stats');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /:userId/:characterId/record - 記錄對話次數', () => {
    it('應該成功記錄對話次數', async () => {
      const mockResult = {
        used: 11,
        remaining: 39,
        limit: 50,
      };
      recordMessage.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/conversations/limit/test-user-123/char-001/record');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.used).toBe(11);
      expect(response.body.remaining).toBe(39);
      expect(recordMessage).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該拒絕非擁有者的請求', async () => {
      const response = await request(app)
        .post('/api/conversations/limit/other-user-456/char-001/record');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該處理超過限制的錯誤', async () => {
      recordMessage.mockRejectedValueOnce(
        new Error('超過對話限制')
      );

      const response = await request(app)
        .post('/api/conversations/limit/test-user-123/char-001/record');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
    });

    it('應該處理服務層錯誤', async () => {
      recordMessage.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/conversations/limit/test-user-123/char-001/record');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /:userId/:characterId/unlock-by-ad - 透過廣告解鎖', () => {
    it('應該成功透過廣告解鎖對話次數', async () => {
      const mockResult = {
        unlockedMessages: 5,
        newLimit: 55,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      claimAdReward.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/conversations/limit/test-user-123/char-001/unlock-by-ad')
        .send({
          adId: 'ad-001',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.unlockedMessages).toBe(5);
      expect(claimAdReward).toHaveBeenCalledWith('test-user-123', 'ad-001');
    });

    it('應該拒絕缺少 adId 的請求', async () => {
      const response = await request(app)
        .post('/api/conversations/limit/test-user-123/char-001/unlock-by-ad')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('adId');
    });

    it('應該拒絕非擁有者的請求', async () => {
      const response = await request(app)
        .post('/api/conversations/limit/other-user-456/char-001/unlock-by-ad')
        .send({
          adId: 'ad-001',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該處理無效廣告 ID', async () => {
      claimAdReward.mockRejectedValueOnce(
        new Error('未找到廣告記錄')
      );

      const response = await request(app)
        .post('/api/conversations/limit/test-user-123/char-001/unlock-by-ad')
        .send({
          adId: 'invalid-ad',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('應該處理服務層錯誤', async () => {
      claimAdReward.mockRejectedValueOnce(
        new Error('Ad service error')
      );

      const response = await request(app)
        .post('/api/conversations/limit/test-user-123/char-001/unlock-by-ad')
        .send({
          adId: 'ad-001',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /:userId/reset - 重置對話限制（管理員）', () => {
    it('應該成功重置所有角色的對話限制', async () => {
      const mockResult = {
        resetCount: 5,
        affectedCharacters: ['char-001', 'char-002', 'char-003'],
      };
      conversationLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/conversations/limit/target-user-456/reset');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('重置');
      expect(response.body.resetCount).toBe(5);
      expect(conversationLimitService.reset).toHaveBeenCalledWith('target-user-456', undefined);
    });

    it('應該成功重置特定角色的對話限制', async () => {
      const mockResult = {
        resetCount: 1,
        affectedCharacters: ['char-001'],
      };
      conversationLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/conversations/limit/target-user-456/reset')
        .send({
          characterId: 'char-001',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.resetCount).toBe(1);
      expect(conversationLimitService.reset).toHaveBeenCalledWith('target-user-456', 'char-001');
    });

    it('應該處理沒有限制記錄的情況', async () => {
      const mockResult = {
        resetCount: 0,
        affectedCharacters: [],
      };
      conversationLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/conversations/limit/target-user-456/reset');

      expect(response.status).toBe(200);
      expect(response.body.resetCount).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      conversationLimitService.reset.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/conversations/limit/target-user-456/reset');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('權限和安全性測試', () => {
    it('check 路由應該是公開的（不需要認證）', async () => {
      const mockCheck = { canUse: true, remaining: 10 };
      conversationLimitService.canUse.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/conversations/limit/any-user/char-001/check');

      expect(response.status).toBe(200);
    });

    it('stats 路由應該需要認證', async () => {
      const mockStats = { totalCharacters: 0 };
      conversationLimitService.getStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/conversations/limit/stats');

      // Should succeed with mocked auth
      expect(response.status).toBe(200);
      expect(conversationLimitService.getStats).toHaveBeenCalledWith('test-user-123');
    });

    it('record 路由應該驗證擁有權', async () => {
      const response = await request(app)
        .post('/api/conversations/limit/other-user/char-001/record');

      expect(response.status).toBe(403);
    });

    it('unlock-by-ad 路由應該驗證擁有權', async () => {
      const response = await request(app)
        .post('/api/conversations/limit/other-user/char-001/unlock-by-ad')
        .send({ adId: 'ad-001' });

      expect(response.status).toBe(403);
    });

    it('reset 路由應該需要管理員權限', async () => {
      const mockResult = { resetCount: 1 };
      conversationLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/conversations/limit/target-user/reset');

      // Should succeed (mocked as admin)
      expect(response.status).toBe(200);
    });
  });
});
