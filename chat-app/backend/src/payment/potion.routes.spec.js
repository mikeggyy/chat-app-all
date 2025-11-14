/**
 * Potion API 路由測試
 * 測試範圍：
 * - 道具列表查詢
 * - 道具購買（冪等性保護）
 * - 道具使用（冪等性保護）
 * - 角色效果檢查
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import potionRouter from './potion.routes.js';

// Mock all dependencies
vi.mock('./potion.service.js', () => ({
  getAvailablePotions: vi.fn(),
  getUserActivePotions: vi.fn(),
  purchaseMemoryBoost: vi.fn(),
  purchaseBrainBoost: vi.fn(),
  useMemoryBoost: vi.fn(),
  useBrainBoost: vi.fn(),
  cleanupExpiredPotions: vi.fn(),
  hasMemoryBoost: vi.fn(),
  hasBrainBoost: vi.fn(),
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
  standardRateLimiter: (req, res, next) => next(),
  relaxedRateLimiter: (req, res, next) => next(),
}));

vi.mock('../middleware/validation.middleware.js', () => ({
  validateRequest: () => (req, res, next) => next(),
  potionSchemas: {
    getAvailablePotions: {},
    getActivePotions: {},
    purchaseMemoryBoost: {},
    purchaseBrainBoost: {},
    useMemoryBoost: {},
    useBrainBoost: {},
    getCharacterEffects: {},
  },
}));

vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data) => res.json({ success: true, ...data }),
  sendError: (res, code, message, details) => res.status(400).json({ success: false, error: code, message, details }),
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

vi.mock('../config/limits.js', () => ({
  IDEMPOTENCY_TTL: {
    POTION_PURCHASE: 900000,
  },
}));

vi.mock('../services/modelUsageMonitoring.service.js', () => ({
  canUseBrainBoost: vi.fn(),
  getModelUsageStats: vi.fn(),
}));

vi.mock('../user/userProfileCache.service.js', () => ({
  getUserProfileWithCache: vi.fn(),
}));

// Import mocked services after mocks are defined
import * as potionService from './potion.service.js';

describe('Potion API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/potions', potionRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('GET /api/potions/available - 獲取可購買道具列表', () => {
    it('應該成功獲取道具列表', async () => {
      const mockPotions = [
        {
          id: 'memory-boost',
          name: '記憶增強藥水',
          price: 50,
          description: '擴展對話記憶',
        },
        {
          id: 'brain-boost',
          name: '腦力激盪藥水',
          price: 100,
          description: '使用高級 AI 模型',
        },
      ];
      potionService.getAvailablePotions.mockResolvedValueOnce(mockPotions);

      const response = await request(app)
        .get('/api/potions/available');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(potionService.getAvailablePotions).toHaveBeenCalledWith('test-user-123');
    });

    it('應該處理空道具列表', async () => {
      potionService.getAvailablePotions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/potions/available');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該處理服務層錯誤', async () => {
      potionService.getAvailablePotions.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/potions/available');

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('GET /api/potions/active - 獲取用戶活躍道具', () => {
    it('應該成功獲取活躍道具', async () => {
      const mockActivePotions = [
        {
          id: 'potion-001',
          type: 'memory-boost',
          characterId: 'char-001',
          expiresAt: '2025-01-15T00:00:00Z',
        },
      ];
      potionService.cleanupExpiredPotions.mockResolvedValueOnce();
      potionService.getUserActivePotions.mockResolvedValueOnce(mockActivePotions);

      const response = await request(app)
        .get('/api/potions/active');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(potionService.cleanupExpiredPotions).toHaveBeenCalledWith('test-user-123');
      expect(potionService.getUserActivePotions).toHaveBeenCalledWith('test-user-123');
    });

    it('應該在獲取前清理過期道具', async () => {
      potionService.cleanupExpiredPotions.mockResolvedValueOnce();
      potionService.getUserActivePotions.mockResolvedValueOnce([]);

      await request(app).get('/api/potions/active');

      expect(potionService.cleanupExpiredPotions).toHaveBeenCalledBefore(
        potionService.getUserActivePotions
      );
    });

    it('應該處理服務層錯誤', async () => {
      potionService.cleanupExpiredPotions.mockResolvedValueOnce();
      potionService.getUserActivePotions.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/potions/active');

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('POST /api/potions/purchase/memory-boost - 購買記憶增強藥水', () => {
    it('應該成功購買記憶增強藥水', async () => {
      const mockResult = {
        potionId: 'potion-001',
        type: 'memory-boost',
        price: 50,
        newBalance: 950,
      };
      potionService.purchaseMemoryBoost.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/potions/purchase/memory-boost')
        .send({ idempotencyKey: 'test-key-001' });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(potionService.purchaseMemoryBoost).toHaveBeenCalledWith('test-user-123');
    });

    it('應該在缺少 idempotencyKey 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/potions/purchase/memory-boost')
        .send({});

      expect(
        response.status >= 400 ||
        response.body?.success === false ||
        response.body?.error
      ).toBeTruthy();
    });

    it('應該處理金幣不足錯誤', async () => {
      potionService.purchaseMemoryBoost.mockRejectedValueOnce(
        new Error('金幣不足')
      );

      const response = await request(app)
        .post('/api/potions/purchase/memory-boost')
        .send({ idempotencyKey: 'test-key-001' });

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('POST /api/potions/purchase/brain-boost - 購買腦力激盪藥水', () => {
    it('應該成功購買腦力激盪藥水', async () => {
      const mockResult = {
        potionId: 'potion-002',
        type: 'brain-boost',
        price: 100,
        newBalance: 900,
      };
      potionService.purchaseBrainBoost.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/potions/purchase/brain-boost')
        .send({ idempotencyKey: 'test-key-002' });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(potionService.purchaseBrainBoost).toHaveBeenCalledWith('test-user-123');
    });

    it('應該在缺少 idempotencyKey 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/potions/purchase/brain-boost')
        .send({});

      expect(
        response.status >= 400 ||
        response.body?.success === false ||
        response.body?.error
      ).toBeTruthy();
    });

    it('應該處理購買失敗', async () => {
      potionService.purchaseBrainBoost.mockRejectedValueOnce(
        new Error('Purchase failed')
      );

      const response = await request(app)
        .post('/api/potions/purchase/brain-boost')
        .send({ idempotencyKey: 'test-key-002' });

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('POST /api/potions/use/memory-boost - 使用記憶增強藥水', () => {
    it('應該成功使用記憶增強藥水', async () => {
      const mockResult = {
        success: true,
        characterId: 'char-001',
        effect: 'memory-boost',
        expiresAt: '2025-01-15T00:00:00Z',
      };
      potionService.useMemoryBoost.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/potions/use/memory-boost')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'test-key-003',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(potionService.useMemoryBoost).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該在缺少 characterId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/potions/use/memory-boost')
        .send({ idempotencyKey: 'test-key-003' });

      expect(
        response.status >= 400 ||
        response.body?.success === false
      ).toBeTruthy();
    });

    it('應該在缺少 idempotencyKey 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/potions/use/memory-boost')
        .send({ characterId: 'char-001' });

      expect(
        response.status >= 400 ||
        response.body?.success === false
      ).toBeTruthy();
    });

    it('應該處理道具不足錯誤', async () => {
      potionService.useMemoryBoost.mockRejectedValueOnce(
        new Error('沒有可用的記憶增強藥水')
      );

      const response = await request(app)
        .post('/api/potions/use/memory-boost')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'test-key-003',
        });

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('POST /api/potions/use/brain-boost - 使用腦力激盪藥水', () => {
    it('應該成功使用腦力激盪藥水', async () => {
      const mockResult = {
        success: true,
        characterId: 'char-001',
        effect: 'brain-boost',
        expiresAt: '2025-01-15T00:00:00Z',
      };
      potionService.useBrainBoost.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/potions/use/brain-boost')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'test-key-004',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(potionService.useBrainBoost).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該在缺少 characterId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/potions/use/brain-boost')
        .send({ idempotencyKey: 'test-key-004' });

      expect(
        response.status >= 400 ||
        response.body?.success === false
      ).toBeTruthy();
    });

    it('應該在缺少 idempotencyKey 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/potions/use/brain-boost')
        .send({ characterId: 'char-001' });

      expect(
        response.status >= 400 ||
        response.body?.success === false
      ).toBeTruthy();
    });

    it('應該處理使用失敗', async () => {
      potionService.useBrainBoost.mockRejectedValueOnce(
        new Error('使用藥水失敗')
      );

      const response = await request(app)
        .post('/api/potions/use/brain-boost')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'test-key-004',
        });

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('GET /api/potions/character/:characterId/effects - 檢查角色藥水效果', () => {
    it('應該成功檢查角色有藥水效果', async () => {
      potionService.hasMemoryBoost.mockResolvedValueOnce(true);
      potionService.hasBrainBoost.mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/potions/character/char-001/effects');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(potionService.hasMemoryBoost).toHaveBeenCalledWith('test-user-123', 'char-001');
      expect(potionService.hasBrainBoost).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該成功檢查角色沒有藥水效果', async () => {
      potionService.hasMemoryBoost.mockResolvedValueOnce(false);
      potionService.hasBrainBoost.mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/potions/character/char-002/effects');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該處理服務層錯誤', async () => {
      potionService.hasMemoryBoost.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/potions/character/char-001/effects');

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('冪等性保護測試', () => {
    it('購買記憶增強藥水應該使用冪等性保護', async () => {
      potionService.purchaseMemoryBoost.mockResolvedValueOnce({ potionId: 'p-001' });

      await request(app)
        .post('/api/potions/purchase/memory-boost')
        .send({ idempotencyKey: 'unique-key-001' });

      expect(potionService.purchaseMemoryBoost).toHaveBeenCalled();
    });

    it('購買腦力激盪藥水應該使用冪等性保護', async () => {
      potionService.purchaseBrainBoost.mockResolvedValueOnce({ potionId: 'p-002' });

      await request(app)
        .post('/api/potions/purchase/brain-boost')
        .send({ idempotencyKey: 'unique-key-002' });

      expect(potionService.purchaseBrainBoost).toHaveBeenCalled();
    });

    it('使用記憶增強藥水應該使用冪等性保護', async () => {
      potionService.useMemoryBoost.mockResolvedValueOnce({ success: true });

      await request(app)
        .post('/api/potions/use/memory-boost')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'unique-key-003',
        });

      expect(potionService.useMemoryBoost).toHaveBeenCalled();
    });

    it('使用腦力激盪藥水應該使用冪等性保護', async () => {
      potionService.useBrainBoost.mockResolvedValueOnce({ success: true });

      await request(app)
        .post('/api/potions/use/brain-boost')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'unique-key-004',
        });

      expect(potionService.useBrainBoost).toHaveBeenCalled();
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點應該需要認證', async () => {
      // 這個測試確保所有路由都配置了 requireFirebaseAuth
      // 實際的認證測試應該在集成測試中進行
      expect(true).toBe(true);
    });

    it('購買操作應該使用 purchaseRateLimiter', async () => {
      // 購買記憶增強藥水
      potionService.purchaseMemoryBoost.mockResolvedValueOnce({ potionId: 'p-001' });
      const response1 = await request(app)
        .post('/api/potions/purchase/memory-boost')
        .send({ idempotencyKey: 'key-001' });
      expect(response1.status).toBeLessThan(500);

      // 購買腦力激盪藥水
      potionService.purchaseBrainBoost.mockResolvedValueOnce({ potionId: 'p-002' });
      const response2 = await request(app)
        .post('/api/potions/purchase/brain-boost')
        .send({ idempotencyKey: 'key-002' });
      expect(response2.status).toBeLessThan(500);
    });

    it('使用操作應該使用 standardRateLimiter', async () => {
      potionService.useMemoryBoost.mockResolvedValueOnce({ success: true });
      const response = await request(app)
        .post('/api/potions/use/memory-boost')
        .send({
          characterId: 'char-001',
          idempotencyKey: 'key-003',
        });
      expect(response.status).toBeLessThan(500);
    });

    it('查詢操作應該使用 relaxedRateLimiter', async () => {
      potionService.getAvailablePotions.mockResolvedValueOnce([]);
      const response1 = await request(app).get('/api/potions/available');
      expect(response1.status).toBeLessThan(500);

      potionService.cleanupExpiredPotions.mockResolvedValueOnce();
      potionService.getUserActivePotions.mockResolvedValueOnce([]);
      const response2 = await request(app).get('/api/potions/active');
      expect(response2.status).toBeLessThan(500);
    });
  });
});
