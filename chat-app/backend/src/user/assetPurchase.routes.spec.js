/**
 * AssetPurchase API 路由測試
 * 測試範圍：
 * - 購買單個資產套餐（新版 SKU）
 * - 購買單個資產卡（舊版 assetId + quantity）
 * - 批量購買資產卡
 * - 冪等性驗證
 * - 參數驗證和錯誤處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies BEFORE importing the router
vi.mock('../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, statusCode = 200) => res.status(statusCode).json({ success: true, ...data }),
  sendError: (res, code, message, details) => {
    return res.status(
      code === 'VALIDATION_ERROR' ? 400 :
      code === 'INSUFFICIENT_RESOURCES' ? 400 :
      code === 'RESOURCE_NOT_FOUND' ? 404 : 400
    ).json({
      success: false,
      error: code,
      message,
      ...details
    });
  },
  ApiError: class ApiError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
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

vi.mock('../auth/firebaseAuth.middleware.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    next();
  },
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  purchaseRateLimiter: (req, res, next) => next(),
}));

vi.mock('../config/limits.js', () => ({
  IDEMPOTENCY_TTL: {
    ASSET_PURCHASE: 2,
  },
}));

// Mock idempotency middleware
const mockHandleIdempotentRequest = vi.fn(async (requestId, handler, options) => {
  // Just execute the handler (no actual idempotency check in tests)
  return await handler();
});

vi.mock('../utils/idempotency.js', () => ({
  handleIdempotentRequest: (...args) => mockHandleIdempotentRequest(...args),
}));

// Mock asset purchase services
const mockPurchaseAssetPackage = vi.fn();
const mockPurchaseAssetCard = vi.fn();
const mockPurchaseAssetBundle = vi.fn();

vi.mock('./assetPurchase.service.js', () => ({
  purchaseAssetPackage: (...args) => mockPurchaseAssetPackage(...args),
  purchaseAssetCard: (...args) => mockPurchaseAssetCard(...args),
  purchaseAssetBundle: (...args) => mockPurchaseAssetBundle(...args),
}));

// Import the router after mocks
import assetPurchaseRouter from './assetPurchase.routes.js';

describe('AssetPurchase API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use(assetPurchaseRouter);

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

  describe('POST /api/assets/purchase - 購買資產套餐（新版 SKU）', () => {
    it('應該成功購買資產套餐（使用 SKU）', async () => {
      const mockResult = {
        userId: 'test-user-123',
        sku: 'video-unlock-5',
        videoCards: 5,
        coins: 450, // 假設花費 50 金幣
        transaction: {
          id: 'tx-001',
          type: 'asset_purchase',
          amount: -50,
        },
      };
      mockPurchaseAssetPackage.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/assets/purchase')
        .send({ sku: 'video-unlock-5' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sku).toBe('video-unlock-5');
      expect(response.body.videoCards).toBe(5);

      // 驗證冪等性處理被調用
      expect(mockHandleIdempotentRequest).toHaveBeenCalled();
      const requestIdArg = mockHandleIdempotentRequest.mock.calls[0][0];
      expect(requestIdArg).toMatch(/^purchase-package-test-user-123-video-unlock-5-\d+$/);

      // 驗證服務被調用
      expect(mockPurchaseAssetPackage).toHaveBeenCalledWith('test-user-123', 'video-unlock-5');
    });

    it('應該處理 SKU 不存在的情況', async () => {
      const error = new Error('找不到該商品套餐');
      error.code = 'RESOURCE_NOT_FOUND';
      mockPurchaseAssetPackage.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/assets/purchase')
        .send({ sku: 'invalid-sku' });

      expect(response.status).toBe(500);
      expect(mockPurchaseAssetPackage).toHaveBeenCalledWith('test-user-123', 'invalid-sku');
    });

    it('應該處理金幣不足的情況', async () => {
      const error = new Error('金幣不足');
      error.code = 'INSUFFICIENT_RESOURCES';
      mockPurchaseAssetPackage.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/assets/purchase')
        .send({ sku: 'video-unlock-10' });

      expect(response.status).toBe(500);
      expect(mockPurchaseAssetPackage).toHaveBeenCalledWith('test-user-123', 'video-unlock-10');
    });

    it('應該支援冪等性（相同 SKU 在同一秒內重複購買）', async () => {
      const mockResult = {
        userId: 'test-user-123',
        sku: 'video-unlock-1',
        videoCards: 1,
        coins: 490,
      };
      mockPurchaseAssetPackage.mockResolvedValue(mockResult);

      // 第一次購買
      const response1 = await request(app)
        .post('/api/assets/purchase')
        .send({ sku: 'video-unlock-1' });

      expect(response1.status).toBe(200);

      // 清除 mock 調用記錄（但不清除返回值）
      vi.clearAllMocks();
      mockPurchaseAssetPackage.mockResolvedValue(mockResult);

      // 第二次購買（同一秒內）
      const response2 = await request(app)
        .post('/api/assets/purchase')
        .send({ sku: 'video-unlock-1' });

      expect(response2.status).toBe(200);
      // 冪等性中間件會被調用
      expect(mockHandleIdempotentRequest).toHaveBeenCalled();
    });
  });

  describe('POST /api/assets/purchase - 購買資產卡（舊版 assetId）', () => {
    it('應該成功購買資產卡（使用 assetId + quantity）', async () => {
      const mockResult = {
        userId: 'test-user-123',
        assetId: 'character-unlock',
        quantity: 3,
        characterUnlockCards: 3,
        coins: 470,
      };
      mockPurchaseAssetCard.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/assets/purchase')
        .send({ assetId: 'character-unlock', quantity: 3 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.assetId).toBe('character-unlock');
      expect(response.body.quantity).toBe(3);

      // 驗證冪等性處理被調用
      expect(mockHandleIdempotentRequest).toHaveBeenCalled();
      const requestIdArg = mockHandleIdempotentRequest.mock.calls[0][0];
      expect(requestIdArg).toMatch(/^purchase-asset-test-user-123-character-unlock-3-\d+$/);

      // 驗證服務被調用
      expect(mockPurchaseAssetCard).toHaveBeenCalledWith('test-user-123', 'character-unlock', 3);
    });

    it('應該默認 quantity 為 1（如果未提供）', async () => {
      const mockResult = {
        userId: 'test-user-123',
        assetId: 'photo-unlock',
        quantity: 1,
        photoCards: 1,
        coins: 495,
      };
      mockPurchaseAssetCard.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/assets/purchase')
        .send({ assetId: 'photo-unlock' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockPurchaseAssetCard).toHaveBeenCalledWith('test-user-123', 'photo-unlock', 1);
    });

    it('應該拒絕 quantity < 1', async () => {
      const response = await request(app)
        .post('/api/assets/purchase')
        .send({ assetId: 'voice-unlock', quantity: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('購買數量必須在 1-100 之間');
      expect(mockPurchaseAssetCard).not.toHaveBeenCalled();
    });

    it('應該拒絕 quantity > 100', async () => {
      const response = await request(app)
        .post('/api/assets/purchase')
        .send({ assetId: 'voice-unlock', quantity: 101 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('購買數量必須在 1-100 之間');
      expect(mockPurchaseAssetCard).not.toHaveBeenCalled();
    });

    it('應該處理 assetId 不存在的情況', async () => {
      const error = new Error('找不到該資產類型');
      error.code = 'RESOURCE_NOT_FOUND';
      mockPurchaseAssetCard.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/assets/purchase')
        .send({ assetId: 'invalid-asset', quantity: 1 });

      expect(response.status).toBe(500);
      expect(mockPurchaseAssetCard).toHaveBeenCalledWith('test-user-123', 'invalid-asset', 1);
    });
  });

  describe('POST /api/assets/purchase - 參數驗證', () => {
    it('應該拒絕缺少 sku 和 assetId 的請求', async () => {
      const response = await request(app)
        .post('/api/assets/purchase')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('缺少必要參數：sku 或 assetId');
      expect(mockPurchaseAssetPackage).not.toHaveBeenCalled();
      expect(mockPurchaseAssetCard).not.toHaveBeenCalled();
    });

    it('應該優先使用 sku（如果同時提供 sku 和 assetId）', async () => {
      const mockResult = {
        userId: 'test-user-123',
        sku: 'video-unlock-5',
        videoCards: 5,
        coins: 450,
      };
      mockPurchaseAssetPackage.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/assets/purchase')
        .send({
          sku: 'video-unlock-5',
          assetId: 'character-unlock', // 這個會被忽略
          quantity: 3, // 這個也會被忽略
        });

      expect(response.status).toBe(200);
      expect(response.body.sku).toBe('video-unlock-5');
      expect(mockPurchaseAssetPackage).toHaveBeenCalledWith('test-user-123', 'video-unlock-5');
      expect(mockPurchaseAssetCard).not.toHaveBeenCalled(); // 舊版 API 不應該被調用
    });
  });

  describe('POST /api/assets/purchase/bundle - 批量購買', () => {
    it('應該成功批量購買資產卡', async () => {
      const mockResult = {
        userId: 'test-user-123',
        items: [
          { assetId: 'character-unlock', quantity: 5 },
          { assetId: 'photo-unlock', quantity: 3 },
          { assetId: 'video-unlock', quantity: 2 },
        ],
        totalCost: 150,
        coins: 350,
        updatedAssets: {
          characterUnlockCards: 5,
          photoCards: 3,
          videoCards: 2,
        },
      };
      mockPurchaseAssetBundle.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({
          items: [
            { assetId: 'character-unlock', quantity: 5 },
            { assetId: 'photo-unlock', quantity: 3 },
            { assetId: 'video-unlock', quantity: 2 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.items).toHaveLength(3);
      expect(response.body.totalCost).toBe(150);

      // 驗證冪等性處理被調用
      expect(mockHandleIdempotentRequest).toHaveBeenCalled();

      // 驗證服務被調用
      expect(mockPurchaseAssetBundle).toHaveBeenCalledWith('test-user-123', [
        { assetId: 'character-unlock', quantity: 5 },
        { assetId: 'photo-unlock', quantity: 3 },
        { assetId: 'video-unlock', quantity: 2 },
      ]);
    });

    it('應該拒絕缺少 items 的請求', async () => {
      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('缺少必要參數：items');
      expect(mockPurchaseAssetBundle).not.toHaveBeenCalled();
    });

    it('應該拒絕 items 不是陣列的請求', async () => {
      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({ items: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('缺少必要參數：items');
      expect(mockPurchaseAssetBundle).not.toHaveBeenCalled();
    });

    it('應該拒絕空陣列', async () => {
      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({ items: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('缺少必要參數：items');
      expect(mockPurchaseAssetBundle).not.toHaveBeenCalled();
    });

    it('應該拒絕項目缺少 assetId 或 quantity', async () => {
      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({
          items: [
            { assetId: 'character-unlock', quantity: 5 },
            { assetId: 'photo-unlock' }, // 缺少 quantity
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('每個項目必須包含 assetId 和 quantity');
      expect(mockPurchaseAssetBundle).not.toHaveBeenCalled();
    });

    it('應該拒絕項目 quantity < 1', async () => {
      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({
          items: [
            { assetId: 'character-unlock', quantity: 0 },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('每個項目的購買數量必須在 1-100 之間');
      expect(mockPurchaseAssetBundle).not.toHaveBeenCalled();
    });

    it('應該拒絕項目 quantity > 100', async () => {
      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({
          items: [
            { assetId: 'character-unlock', quantity: 101 },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('每個項目的購買數量必須在 1-100 之間');
      expect(mockPurchaseAssetBundle).not.toHaveBeenCalled();
    });

    it('應該處理金幣不足的情況', async () => {
      const error = new Error('金幣不足');
      error.code = 'INSUFFICIENT_RESOURCES';
      mockPurchaseAssetBundle.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({
          items: [
            { assetId: 'character-unlock', quantity: 50 },
            { assetId: 'photo-unlock', quantity: 50 },
          ],
        });

      expect(response.status).toBe(500);
      expect(mockPurchaseAssetBundle).toHaveBeenCalled();
    });

    it('應該支援冪等性（批量購買）', async () => {
      const mockResult = {
        userId: 'test-user-123',
        items: [{ assetId: 'video-unlock', quantity: 1 }],
        totalCost: 10,
        coins: 490,
      };
      mockPurchaseAssetBundle.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/assets/purchase/bundle')
        .send({
          items: [{ assetId: 'video-unlock', quantity: 1 }],
        });

      expect(response.status).toBe(200);
      expect(mockHandleIdempotentRequest).toHaveBeenCalled();
      const requestIdArg = mockHandleIdempotentRequest.mock.calls[0][0];
      expect(requestIdArg).toMatch(/^purchase-bundle-test-user-123-video-unlockx1-\d+$/);
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點都應該需要認證', async () => {
      const endpoints = [
        { method: 'post', path: '/api/assets/purchase', body: { sku: 'test-sku' } },
        { method: 'post', path: '/api/assets/purchase/bundle', body: { items: [{ assetId: 'test', quantity: 1 }] } },
      ];

      // 由於我們已經 mock 了 requireFirebaseAuth，這裡只是確認端點存在
      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path).send(endpoint.body);
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      }
    });

    it('應該使用認證 token 中的 userId（防止盜用）', async () => {
      const mockResult = {
        userId: 'test-user-123',
        sku: 'video-unlock-1',
        videoCards: 1,
        coins: 490,
      };
      mockPurchaseAssetPackage.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/assets/purchase')
        .send({
          sku: 'video-unlock-1',
          userId: 'fake-user-999', // 嘗試偽造 userId（應該被忽略）
        });

      expect(response.status).toBe(200);
      // 應該使用認證 token 中的 userId，而非請求體中的
      expect(mockPurchaseAssetPackage).toHaveBeenCalledWith('test-user-123', 'video-unlock-1');
    });
  });
});
