/**
 * Gift API 集成測試
 *
 * 測試範圍：
 * - POST /send - 送禮物給角色
 * - GET /history - 獲取送禮記錄
 * - GET /stats/:characterId - 獲取禮物統計
 * - GET /pricing - 獲取禮物價格
 * - POST /response - 生成禮物回應
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import giftRouter from './gift.routes.js';

// Mock dependencies
vi.mock('../auth/index.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    // Mock 認證中間件：假設所有請求都已認證
    req.firebaseUser = { uid: 'test-user-123' };
    req.user = { uid: 'test-user-123' };
    next();
  },
}));

vi.mock('../utils/routeHelpers.js', () => ({
  asyncHandler: (fn) => (req, res, next) => {
    // Async handler wrapper
    Promise.resolve(fn(req, res, next)).catch(next);
  },
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  giftRateLimiter: (req, res, next) => next(),
  standardRateLimiter: (req, res, next) => next(),
  relaxedRateLimiter: (req, res, next) => next(),
}));

vi.mock('../middleware/validation.middleware.js', () => ({
  validateRequest: (schema) => (req, res, next) => {
    // Mock 驗證中間件：假設所有請求都通過驗證
    next();
  },
  giftSchemas: {
    sendGift: {},
  },
}));

vi.mock('./gift.service.js', () => ({
  sendGift: vi.fn(),
  getUserGiftHistory: vi.fn(),
  getCharacterGiftStats: vi.fn(),
  getGiftPricing: vi.fn(),
}));

vi.mock('./giftResponse.service.js', () => ({
  processGiftResponse: vi.fn(),
}));

vi.mock('../utils/idempotency.js', () => ({
  handleIdempotentRequest: vi.fn(async (requestId, callback, options) => {
    // Mock 冪等性處理：直接執行回調
    return await callback();
  }),
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ✅ 2025-12-02 修復：添加缺失的 mock
vi.mock('../payment/coins.service.js', () => ({
  refundCoins: vi.fn(),
}));

vi.mock('../config/limits.js', () => ({
  IDEMPOTENCY_TTL: {
    GIFT: 86400000,
    DEFAULT: 86400000,
  },
}));

describe('Gift API Routes', () => {
  let app;
  let giftService;
  let giftResponseService;
  let idempotencyHandler;

  beforeEach(async () => {
    // 創建測試用 Express app
    app = express();
    app.use(express.json());
    app.use('/api/gifts', giftRouter);

    // 獲取 mock services
    const giftSvc = await import('./gift.service.js');
    const giftRespSvc = await import('./giftResponse.service.js');
    const idempotency = await import('../utils/idempotency.js');

    giftService = giftSvc;
    giftResponseService = giftRespSvc;
    idempotencyHandler = idempotency;

    // 清除所有 mock 調用記錄
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /send - 送禮物給角色', () => {
    it('應該成功送禮物', async () => {
      const mockResult = {
        success: true,
        giftId: 'gift-001',
        coinsSpent: 100,
        newBalance: 900,
      };

      giftService.sendGift.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/gifts/send')
        .send({
          characterId: 'char-001',
          giftId: 'gift-001',
          requestId: 'req-12345',
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual(mockResult);
      expect(giftService.sendGift).toHaveBeenCalledWith('test-user-123', 'char-001', 'gift-001');
      expect(idempotencyHandler.handleIdempotentRequest).toHaveBeenCalledWith(
        'req-12345',
        expect.any(Function),
        expect.objectContaining({ ttl: expect.any(Number) })
      );
    });

    it('應該在缺少 characterId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/gifts/send')
        .send({
          giftId: 'gift-001',
          requestId: 'req-12345',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('characterId');
      expect(giftService.sendGift).not.toHaveBeenCalled();
    });

    it('應該在缺少 giftId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/gifts/send')
        .send({
          characterId: 'char-001',
          requestId: 'req-12345',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('giftId');
      expect(giftService.sendGift).not.toHaveBeenCalled();
    });

    it('應該在缺少 requestId 時返回錯誤（冪等性保護）', async () => {
      const response = await request(app)
        .post('/api/gifts/send')
        .send({
          characterId: 'char-001',
          giftId: 'gift-001',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('requestId');
      expect(giftService.sendGift).not.toHaveBeenCalled();
    });

    it('應該使用冪等性處理防止重複扣款', async () => {
      const mockResult = { success: true };
      giftService.sendGift.mockResolvedValueOnce(mockResult);

      await request(app)
        .post('/api/gifts/send')
        .send({
          characterId: 'char-001',
          giftId: 'gift-001',
          requestId: 'req-same-id',
        })
        .expect(200);

      expect(idempotencyHandler.handleIdempotentRequest).toHaveBeenCalledWith(
        'req-same-id',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('應該處理送禮失敗的情況', async () => {
      giftService.sendGift.mockRejectedValueOnce(new Error('餘額不足'));

      await request(app)
        .post('/api/gifts/send')
        .send({
          characterId: 'char-001',
          giftId: 'gift-001',
          requestId: 'req-12345',
        })
        .expect(500);
    });
  });

  describe('GET /history - 獲取送禮記錄', () => {
    it('應該成功獲取送禮記錄（無過濾條件）', async () => {
      const mockHistory = [
        { id: 'history-1', giftId: 'gift-001', characterId: 'char-001', timestamp: '2025-01-13' },
        { id: 'history-2', giftId: 'gift-002', characterId: 'char-002', timestamp: '2025-01-12' },
      ];

      giftService.getUserGiftHistory.mockReturnValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/gifts/history')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual(mockHistory);
      expect(giftService.getUserGiftHistory).toHaveBeenCalledWith('test-user-123', {
        characterId: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('應該支持按角色 ID 過濾', async () => {
      const mockHistory = [
        { id: 'history-1', giftId: 'gift-001', characterId: 'char-001', timestamp: '2025-01-13' },
      ];

      giftService.getUserGiftHistory.mockReturnValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/gifts/history?characterId=char-001')
        .expect(200);

      expect(response.body.data).toEqual(mockHistory);
      expect(giftService.getUserGiftHistory).toHaveBeenCalledWith('test-user-123', {
        characterId: 'char-001',
        limit: undefined,
        offset: undefined,
      });
    });

    it('應該支持分頁參數', async () => {
      const mockHistory = [];
      giftService.getUserGiftHistory.mockReturnValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/gifts/history?limit=10&offset=20')
        .expect(200);

      expect(giftService.getUserGiftHistory).toHaveBeenCalledWith('test-user-123', {
        characterId: undefined,
        limit: 10,
        offset: 20,
      });
    });

    it('應該處理空歷史記錄', async () => {
      giftService.getUserGiftHistory.mockReturnValueOnce([]);

      const response = await request(app)
        .get('/api/gifts/history')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /stats/:characterId - 獲取禮物統計', () => {
    it('應該成功獲取禮物統計', async () => {
      const mockStats = {
        characterId: 'char-001',
        totalGifts: 15,
        totalCoinsSpent: 1500,
        favoriteGift: 'gift-003',
      };

      giftService.getCharacterGiftStats.mockReturnValueOnce(mockStats);

      const response = await request(app)
        .get('/api/gifts/stats/char-001')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual(mockStats);
      expect(giftService.getCharacterGiftStats).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該處理沒有統計數據的情況', async () => {
      giftService.getCharacterGiftStats.mockReturnValueOnce({
        totalGifts: 0,
        totalCoinsSpent: 0,
      });

      const response = await request(app)
        .get('/api/gifts/stats/char-999')
        .expect(200);

      expect(response.body.data.totalGifts).toBe(0);
    });
  });

  describe('GET /pricing - 獲取禮物價格', () => {
    it('應該成功獲取禮物價格列表', async () => {
      const mockPricing = [
        { giftId: 'gift-001', name: '玫瑰花', price: 100, vipDiscount: 0.9 },
        { giftId: 'gift-002', name: '巧克力', price: 200, vipDiscount: 0.9 },
      ];

      giftService.getGiftPricing.mockResolvedValueOnce(mockPricing);

      const response = await request(app)
        .get('/api/gifts/pricing')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual(mockPricing);
      expect(giftService.getGiftPricing).toHaveBeenCalledWith('test-user-123');
    });

    it('應該根據用戶會員等級返回不同價格', async () => {
      const mockVipPricing = [
        { giftId: 'gift-001', name: '玫瑰花', price: 90, vipDiscount: 0.9 },
      ];

      giftService.getGiftPricing.mockResolvedValueOnce(mockVipPricing);

      const response = await request(app)
        .get('/api/gifts/pricing')
        .expect(200);

      expect(response.body.data).toEqual(mockVipPricing);
    });

    it('應該處理獲取價格失敗的情況', async () => {
      giftService.getGiftPricing.mockRejectedValueOnce(new Error('數據庫錯誤'));

      await request(app)
        .get('/api/gifts/pricing')
        .expect(500);
    });
  });

  describe('POST /response - 生成禮物回應', () => {
    it('應該成功生成禮物回應（不含照片）', async () => {
      const mockResponse = {
        message: '謝謝你的禮物！',
        characterId: 'char-001',
        photo: null,
      };

      giftResponseService.processGiftResponse.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/gifts/response')
        .send({
          characterData: { id: 'char-001', display_name: '測試角色' },
          giftId: 'gift-001',
          generatePhoto: false,
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.message).toBe('謝謝你的禮物！');
      expect(giftResponseService.processGiftResponse).toHaveBeenCalledWith(
        { id: 'char-001', display_name: '測試角色' },
        'gift-001',
        'test-user-123',
        { generatePhoto: false }
      );
    });

    it('應該成功生成禮物回應（含照片）', async () => {
      const mockResponse = {
        message: '謝謝你的禮物！這是我的自拍照 💕',
        characterId: 'char-001',
        photo: {
          imageUrl: 'data:image/webp;base64,...',
          generatedAt: '2025-01-13T12:00:00Z',
        },
      };

      giftResponseService.processGiftResponse.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/gifts/response')
        .send({
          characterData: { id: 'char-001', display_name: '測試角色' },
          giftId: 'gift-001',
          generatePhoto: true,
        })
        .expect(200);

      expect(response.body.data.photo).toBeDefined();
      expect(response.body.data.photo.imageUrl).toContain('data:image/webp');
      expect(giftResponseService.processGiftResponse).toHaveBeenCalledWith(
        expect.any(Object),
        'gift-001',
        'test-user-123',
        { generatePhoto: true }
      );
    });

    it('應該在缺少 characterData 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/gifts/response')
        .send({
          giftId: 'gift-001',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('characterData');
      expect(giftResponseService.processGiftResponse).not.toHaveBeenCalled();
    });

    it('應該在缺少 giftId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/gifts/response')
        .send({
          characterData: { id: 'char-001' },
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('giftId');
      expect(giftResponseService.processGiftResponse).not.toHaveBeenCalled();
    });

    it('應該處理生成回應失敗的情況', async () => {
      giftResponseService.processGiftResponse.mockRejectedValueOnce(
        new Error('AI 生成失敗')
      );

      await request(app)
        .post('/api/gifts/response')
        .send({
          characterData: { id: 'char-001' },
          giftId: 'gift-001',
        })
        .expect(500);
    });
  });
});
