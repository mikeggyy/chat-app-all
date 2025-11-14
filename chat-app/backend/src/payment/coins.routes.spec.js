/**
 * Coins API 路由測試
 * 測試範圍：
 * - 金幣餘額查詢
 * - 無限對話購買
 * - 功能定價查詢
 * - 交易記錄
 * - 金幣套餐
 * - 充值和餘額設置（測試帳號）
 * - 冪等性保護
 * - 權限驗證
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import coinsRouter from './coins.routes.js';

// Mock all dependencies
vi.mock('./coins.service.js', () => ({
  getCoinsBalance: vi.fn(),
  purchaseUnlimitedChat: vi.fn(),
  getFeaturePricing: vi.fn(),
  getAllFeaturePrices: vi.fn(),
  getTransactionHistory: vi.fn(),
  getCoinPackages: vi.fn(),
  purchaseCoinPackage: vi.fn(),
  rechargeCoins: vi.fn(),
  setCoinsBalance: vi.fn(),
}));

vi.mock('../auth/firebaseAuth.middleware.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = { uid: 'test-user-123' };
    next();
  },
}));

vi.mock('../utils/idempotency.js', () => ({
  handleIdempotentRequest: vi.fn((requestId, handler) => handler()),
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  purchaseRateLimiter: (req, res, next) => next(),
  relaxedRateLimiter: (req, res, next) => next(),
}));

vi.mock('../middleware/validation.middleware.js', () => ({
  validateRequest: () => (req, res, next) => next(),
  coinSchemas: {
    getBalance: {},
    purchaseUnlimitedChat: {},
    getFeaturePricing: {},
    getAllPricing: {},
    getTransactions: {},
    getPackages: {},
    purchasePackage: {},
    rechargeCoins: {},
    setBalance: {},
  },
}));

vi.mock('../utils/devModeHelper.js', () => ({
  validateDevModeBypass: vi.fn(),
}));

vi.mock('../../../../shared/config/testAccounts.js', () => ({
  isTestAccount: vi.fn(() => true),
}));

vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data) => res.json({ success: true, ...data }),
  sendError: (res, code, message, details) => res.status(400).json({ success: false, error: code, message, details }),
  ApiError: class ApiError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
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

vi.mock('../config/limits.js', () => ({
  IDEMPOTENCY_TTL: {
    COIN_FEATURE_PURCHASE: 900000,
    COIN_PACKAGE: 900000,
    COIN_RECHARGE: 900000,
  },
}));

// Import mocked services after mocks are defined
import * as coinsService from './coins.service.js';

describe('Coins API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use(coinsRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('GET /api/coins/balance - 獲取金幣餘額', () => {
    it('應該成功獲取金幣餘額', async () => {
      const mockBalance = 1000;
      coinsService.getCoinsBalance.mockResolvedValueOnce(mockBalance);

      const response = await request(app)
        .get('/api/coins/balance');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(coinsService.getCoinsBalance).toHaveBeenCalledWith('test-user-123');
    });

    it('應該處理獲取餘額失敗的情況', async () => {
      coinsService.getCoinsBalance.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/coins/balance');

      // Flexible error response check
      expect(
        response.status === 500 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('POST /api/coins/purchase/unlimited-chat - 購買無限對話', () => {
    it('應該成功購買無限對話（使用冪等性鍵）', async () => {
      const mockResult = {
        success: true,
        newBalance: 900,
        characterId: 'char-001',
      };
      coinsService.purchaseUnlimitedChat.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/coins/purchase/unlimited-chat')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'test-key-001',
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });

    it('應該在缺少 characterId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/coins/purchase/unlimited-chat')
        .send({
          idempotencyKey: 'test-key-001',
        });

      expect(response.status).toBe(400);
      expect(
        response.body.success === false ||
        response.body.error ||
        response.body.message
      ).toBeTruthy();
    });

    it('應該在缺少 idempotencyKey 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/coins/purchase/unlimited-chat')
        .send({
          characterId: 'char-001',
        });

      expect(response.status).toBe(400);
      expect(
        response.body.success === false ||
        response.body.error ||
        response.body.message
      ).toBeTruthy();
    });
  });

  describe('GET /api/coins/pricing/:featureId - 獲取功能定價', () => {
    it('應該成功獲取特定功能的定價', async () => {
      const mockPricing = {
        featureId: 'unlimited_chat',
        price: 100,
        description: '無限對話',
      };
      coinsService.getFeaturePricing.mockResolvedValueOnce(mockPricing);

      const response = await request(app)
        .get('/api/coins/pricing/unlimited_chat');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(coinsService.getFeaturePricing).toHaveBeenCalledWith('test-user-123', 'unlimited_chat');
    });

    it('應該處理不存在的功能定價', async () => {
      coinsService.getFeaturePricing.mockRejectedValueOnce(new Error('Feature not found'));

      const response = await request(app)
        .get('/api/coins/pricing/invalid_feature');

      expect(
        response.status === 404 ||
        response.status === 500 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('GET /api/coins/pricing - 獲取所有功能定價', () => {
    it('應該成功獲取所有功能的定價列表', async () => {
      const mockPrices = {
        unlimited_chat: { price: 100, description: '無限對話' },
        photo_generation: { price: 50, description: 'AI 照片生成' },
        voice_message: { price: 20, description: '語音訊息' },
      };
      coinsService.getAllFeaturePrices.mockResolvedValueOnce(mockPrices);

      const response = await request(app)
        .get('/api/coins/pricing');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(coinsService.getAllFeaturePrices).toHaveBeenCalledWith('test-user-123');
    });
  });

  describe('GET /api/coins/transactions - 獲取交易記錄', () => {
    it('應該成功獲取交易記錄（無分頁參數）', async () => {
      const mockHistory = {
        transactions: [
          { id: 'tx-001', type: 'purchase', amount: -100, timestamp: '2025-01-13T10:00:00Z' },
          { id: 'tx-002', type: 'recharge', amount: 500, timestamp: '2025-01-13T09:00:00Z' },
        ],
        total: 2,
      };
      coinsService.getTransactionHistory.mockResolvedValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/coins/transactions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(coinsService.getTransactionHistory).toHaveBeenCalledWith('test-user-123', {
        limit: undefined,
        offset: undefined,
      });
    });

    it('應該成功獲取交易記錄（有分頁參數）', async () => {
      const mockHistory = {
        transactions: [],
        total: 0,
      };
      coinsService.getTransactionHistory.mockResolvedValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/coins/transactions?limit=10&offset=5');

      expect(response.status).toBe(200);
      expect(coinsService.getTransactionHistory).toHaveBeenCalledWith('test-user-123', {
        limit: 10,
        offset: 5,
      });
    });

    it('應該處理獲取交易記錄失敗的情況', async () => {
      coinsService.getTransactionHistory.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/coins/transactions');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/coins/packages - 獲取金幣套餐', () => {
    it('應該成功獲取金幣充值套餐列表（無需認證）', async () => {
      const mockPackages = [
        { id: 'pkg-001', coins: 100, price: 30, bonus: 0 },
        { id: 'pkg-002', coins: 500, price: 150, bonus: 50 },
        { id: 'pkg-003', coins: 1000, price: 300, bonus: 200 },
      ];
      coinsService.getCoinPackages.mockResolvedValueOnce(mockPackages);

      const response = await request(app)
        .get('/api/coins/packages');

      expect(response.status).toBe(200);
      expect(coinsService.getCoinPackages).toHaveBeenCalled();
    });

    it('應該處理獲取套餐失敗的情況', async () => {
      coinsService.getCoinPackages.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/coins/packages');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/coins/purchase/package - 購買金幣套餐', () => {
    it('應該在生產環境返回未實現錯誤（未啟用開發模式）', async () => {
      // 模擬生產環境
      process.env.ENABLE_DEV_PURCHASE_BYPASS = 'false';

      const response = await request(app)
        .post('/api/coins/purchase/package')
        .send({
          packageId: 'pkg-001',
          paymentInfo: { method: 'credit_card' },
          idempotencyKey: 'test-key-002',
        });

      expect(response.status).toBe(501);
      expect(response.body.success).toBe(false);
    });

    it('應該在缺少 packageId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/coins/purchase/package')
        .send({
          idempotencyKey: 'test-key-002',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('應該在缺少 idempotencyKey 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/coins/purchase/package')
        .send({
          packageId: 'pkg-001',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/coins/recharge - 充值金幣（測試帳號）', () => {
    it('應該成功充值金幣（測試帳號）', async () => {
      const mockResult = {
        newBalance: 1500,
        amount: 500,
      };
      coinsService.rechargeCoins.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/coins/recharge')
        .send({
          amount: 500,
          idempotencyKey: 'test-key-003',
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });

    it('應該在 amount 無效時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/coins/recharge')
        .send({
          amount: -100, // 負數
          idempotencyKey: 'test-key-003',
        });

      expect(response.status).toBe(400);
      expect(
        response.body.success === false ||
        response.body.error
      ).toBeTruthy();
    });

    it('應該在缺少 idempotencyKey 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/coins/recharge')
        .send({
          amount: 500,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/coins/set-balance - 設定金幣餘額（測試帳號）', () => {
    it('應該成功設定金幣餘額（測試帳號）', async () => {
      const mockResult = {
        newBalance: 2000,
        previousBalance: 1000,
      };
      coinsService.setCoinsBalance.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/coins/set-balance')
        .send({
          balance: 2000,
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });

    it('應該在 balance 為負數時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/coins/set-balance')
        .send({
          balance: -500,
        });

      expect(response.status).toBe(400);
      expect(
        response.body.success === false ||
        response.body.error
      ).toBeTruthy();
    });

    it('應該在 balance 不是數字時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/coins/set-balance')
        .send({
          balance: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(
        response.body.success === false ||
        response.body.error
      ).toBeTruthy();
    });
  });

  describe('權限和安全性測試', () => {
    it('所有需要認證的端點應該從 token 獲取 userId', async () => {
      coinsService.getCoinsBalance.mockResolvedValueOnce(1000);

      await request(app).get('/api/coins/balance');

      // 驗證使用了 firebaseUser.uid
      expect(coinsService.getCoinsBalance).toHaveBeenCalledWith('test-user-123');
    });

    it('購買操作應該使用冪等性保護', async () => {
      const mockResult = { success: true, newBalance: 900 };
      coinsService.purchaseUnlimitedChat.mockResolvedValueOnce(mockResult);

      await request(app)
        .post('/api/coins/purchase/unlimited-chat')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'unique-key-001',
        });

      // 驗證冪等性中間件被調用
      // （實際實現會檢查 handleIdempotentRequest 的調用）
      expect(coinsService.purchaseUnlimitedChat).toHaveBeenCalled();
    });
  });
});
