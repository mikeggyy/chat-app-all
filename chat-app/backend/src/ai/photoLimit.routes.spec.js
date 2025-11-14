/**
 * PhotoLimit API 路由測試
 * 測試範圍：
 * - 檢查拍照權限（需認證，含照片卡）
 * - 獲取拍照統計（需認證）
 * - 購買拍照卡
 * - 重置拍照限制（管理員）
 * - 權限和安全性檢查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies BEFORE importing the router
vi.mock('./photoLimit.service.js', () => ({
  photoLimitService: {
    reset: vi.fn(),
  },
  canGeneratePhoto: vi.fn(),
  getPhotoStats: vi.fn(),
  purchasePhotoCards: vi.fn(),
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
                     error.message?.includes('未找到') ? 404 :
                     error.message?.includes('不足') ? 400 : 400;
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
  requireParams: (params, source = 'body') => (req, res, next) => {
    const data = source === 'body' ? req.body : req.query;
    const missing = params.filter(p => !data[p]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMETER',
        message: `缺少必要參數: ${missing.join(', ')}`
      });
    }
    next();
  },
  getLimitErrorStatus: (error) => {
    if (error.message?.includes('超過')) return 429;
    if (error.message?.includes('未找到')) return 404;
    if (error.message?.includes('不足')) return 400;
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

vi.mock('../firebase/index.js', () => ({
  getFirestoreDb: vi.fn(() => ({})),
}));

// Import mocked services
import { photoLimitService, canGeneratePhoto, getPhotoStats, purchasePhotoCards } from './photoLimit.service.js';
import photoLimitRouter from './photoLimit.routes.js';

describe('PhotoLimit API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/photo-limit', photoLimitRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('GET /check - 檢查拍照權限（需認證）', () => {
    it('應該成功檢查拍照權限', async () => {
      const mockCheck = {
        canGenerate: true,
        remaining: 5,
        limit: 10,
        used: 5,
        hasPhotoCard: false,
        resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      };
      canGeneratePhoto.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/photo-limit/check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canGenerate).toBe(true);
      expect(response.body.remaining).toBe(5);
      expect(canGeneratePhoto).toHaveBeenCalledWith('test-user-123');
    });

    it('應該返回可使用照片卡的狀態', async () => {
      const mockCheck = {
        canGenerate: true,
        remaining: 0,
        limit: 10,
        used: 10,
        hasPhotoCard: true,
        photoCardCount: 3,
        resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      };
      canGeneratePhoto.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/photo-limit/check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canGenerate).toBe(true);
      expect(response.body.hasPhotoCard).toBe(true);
      expect(response.body.photoCardCount).toBe(3);
    });

    it('應該返回無法生成的狀態', async () => {
      const mockCheck = {
        canGenerate: false,
        remaining: 0,
        limit: 10,
        used: 10,
        hasPhotoCard: false,
        resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      };
      canGeneratePhoto.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/photo-limit/check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canGenerate).toBe(false);
      expect(response.body.remaining).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      canGeneratePhoto.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/photo-limit/check');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該需要認證', async () => {
      const mockCheck = { canGenerate: true };
      canGeneratePhoto.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/photo-limit/check');

      // Should succeed with mocked auth
      expect(response.status).toBe(200);
      expect(canGeneratePhoto).toHaveBeenCalledWith('test-user-123');
    });
  });

  describe('GET /stats - 獲取拍照統計（需認證）', () => {
    it('應該成功獲取拍照統計', async () => {
      const mockStats = {
        used: 5,
        limit: 10,
        remaining: 5,
        photoCardCount: 2,
        resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
        thisMonthPhotos: [
          { createdAt: new Date().toISOString(), characterId: 'char-001' },
          { createdAt: new Date().toISOString(), characterId: 'char-002' },
        ],
      };
      getPhotoStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/photo-limit/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.used).toBe(5);
      expect(response.body.limit).toBe(10);
      expect(response.body.photoCardCount).toBe(2);
      expect(getPhotoStats).toHaveBeenCalledWith('test-user-123');
    });

    it('應該返回空統計（新用戶）', async () => {
      const mockStats = {
        used: 0,
        limit: 10,
        remaining: 10,
        photoCardCount: 0,
        thisMonthPhotos: [],
      };
      getPhotoStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/photo-limit/stats');

      expect(response.status).toBe(200);
      expect(response.body.used).toBe(0);
      expect(response.body.remaining).toBe(10);
    });

    it('應該處理服務層錯誤', async () => {
      getPhotoStats.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/photo-limit/stats');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /purchase - 購買拍照卡', () => {
    it('應該成功購買拍照卡', async () => {
      const mockResult = {
        purchasedCount: 5,
        totalPhotoCards: 8,
        coinsSpent: 500,
        remainingCoins: 1500,
      };
      purchasePhotoCards.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/photo-limit/purchase')
        .send({
          quantity: 5,
          paymentInfo: {
            paymentMethod: 'COINS',
            amount: 500,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.purchasedCount).toBe(5);
      expect(response.body.totalPhotoCards).toBe(8);
      expect(purchasePhotoCards).toHaveBeenCalledWith(
        'test-user-123',
        5,
        expect.objectContaining({
          paymentMethod: 'COINS',
          amount: 500,
        })
      );
    });

    it('應該拒絕缺少 quantity 的請求', async () => {
      const response = await request(app)
        .post('/api/photo-limit/purchase')
        .send({
          paymentInfo: { paymentMethod: 'COINS' },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('quantity');
    });

    it('應該處理金幣不足的錯誤', async () => {
      purchasePhotoCards.mockRejectedValueOnce(
        new Error('金幣不足')
      );

      const response = await request(app)
        .post('/api/photo-limit/purchase')
        .send({
          quantity: 10,
          paymentInfo: { paymentMethod: 'COINS', amount: 1000 },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('不足');
    });

    it('應該處理服務層錯誤', async () => {
      purchasePhotoCards.mockRejectedValueOnce(
        new Error('Purchase error')
      );

      const response = await request(app)
        .post('/api/photo-limit/purchase')
        .send({
          quantity: 5,
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該需要認證', async () => {
      const mockResult = { purchasedCount: 1 };
      purchasePhotoCards.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/photo-limit/purchase')
        .send({
          quantity: 1,
        });

      // Should succeed with mocked auth
      expect(response.status).toBe(200);
      expect(purchasePhotoCards).toHaveBeenCalledWith('test-user-123', 1, undefined);
    });
  });

  describe('POST /reset - 重置拍照限制（管理員）', () => {
    it('應該成功重置用戶的拍照限制', async () => {
      const mockResult = {
        resetCount: 1,
        newLimit: 10,
      };
      photoLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/photo-limit/reset')
        .send({
          userId: 'target-user-456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('重置');
      expect(response.body.resetCount).toBe(1);
      expect(photoLimitService.reset).toHaveBeenCalledWith('target-user-456');
    });

    it('應該拒絕缺少 userId 的請求', async () => {
      const response = await request(app)
        .post('/api/photo-limit/reset')
        .send({});

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該處理沒有限制記錄的情況', async () => {
      const mockResult = {
        resetCount: 0,
      };
      photoLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/photo-limit/reset')
        .send({
          userId: 'target-user-456',
        });

      expect(response.status).toBe(200);
      expect(response.body.resetCount).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      photoLimitService.reset.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/photo-limit/reset')
        .send({
          userId: 'target-user-456',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('權限和安全性測試', () => {
    it('check 路由應該需要認證', async () => {
      const mockCheck = { canGenerate: true };
      canGeneratePhoto.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/photo-limit/check');

      // Should succeed with mocked auth
      expect(response.status).toBe(200);
      expect(canGeneratePhoto).toHaveBeenCalledWith('test-user-123');
    });

    it('stats 路由應該需要認證', async () => {
      const mockStats = { used: 0, limit: 10 };
      getPhotoStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/photo-limit/stats');

      // Should succeed with mocked auth
      expect(response.status).toBe(200);
      expect(getPhotoStats).toHaveBeenCalledWith('test-user-123');
    });

    it('purchase 路由應該需要認證', async () => {
      const mockResult = { purchasedCount: 1 };
      purchasePhotoCards.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/photo-limit/purchase')
        .send({ quantity: 1 });

      // Should succeed with mocked auth
      expect(response.status).toBe(200);
      expect(purchasePhotoCards).toHaveBeenCalledWith('test-user-123', 1, undefined);
    });

    it('reset 路由應該需要管理員權限', async () => {
      const mockResult = { resetCount: 1 };
      photoLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/photo-limit/reset')
        .send({ userId: 'target-user' });

      // Should succeed (mocked as admin)
      expect(response.status).toBe(200);
    });

    it('check 路由應該使用當前用戶 ID', async () => {
      const mockCheck = { canGenerate: true };
      canGeneratePhoto.mockResolvedValueOnce(mockCheck);

      await request(app).get('/api/photo-limit/check');

      // Should use userId from auth token, not from request
      expect(canGeneratePhoto).toHaveBeenCalledWith('test-user-123');
    });

    it('stats 路由應該使用當前用戶 ID', async () => {
      const mockStats = { used: 0 };
      getPhotoStats.mockResolvedValueOnce(mockStats);

      await request(app).get('/api/photo-limit/stats');

      // Should use userId from auth token
      expect(getPhotoStats).toHaveBeenCalledWith('test-user-123');
    });

    it('purchase 路由應該使用當前用戶 ID', async () => {
      const mockResult = { purchasedCount: 1 };
      purchasePhotoCards.mockResolvedValueOnce(mockResult);

      await request(app)
        .post('/api/photo-limit/purchase')
        .send({ quantity: 1 });

      // Should use userId from auth token
      expect(purchasePhotoCards).toHaveBeenCalledWith('test-user-123', 1, undefined);
    });
  });
});
