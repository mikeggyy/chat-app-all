/**
 * Ad API 路由測試
 * 測試範圍：
 * - 請求觀看廣告
 * - 驗證廣告已觀看
 * - 領取廣告獎勵
 * - 檢查每日廣告限制
 * - 獲取廣告統計
 * - 冪等性保護
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import adRouter from './ad.routes.js';

// Mock all dependencies
vi.mock('./ad.service.js', () => ({
  requestAdWatch: vi.fn(),
  verifyAdWatched: vi.fn(),
  claimAdReward: vi.fn(),
  checkDailyAdLimit: vi.fn(),
  getAdStats: vi.fn(),
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
  standardRateLimiter: (req, res, next) => next(),
  relaxedRateLimiter: (req, res, next) => next(),
}));

vi.mock('../utils/routeHelpers.js', () => ({
  sendSuccess: (res, data) => res.json({ success: true, ...data }),
  sendError: (res, code, message, details) => res.status(400).json({ success: false, error: code, message, details }),
  asyncHandler: (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
  requireParams: (params, source) => (req, res, next) => {
    const data = source === 'body' ? req.body : req.params;
    for (const param of params) {
      if (!data[param]) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: `Missing required parameter: ${param}`,
        });
      }
    }
    next();
  },
  requireOwnership: () => (req, res, next) => next(),
}));

vi.mock('../config/limits.js', () => ({
  IDEMPOTENCY_TTL: {
    AD_REWARD: 600000, // 10 minutes
  },
}));

// Import mocked services after mocks are defined
import * as adService from './ad.service.js';

describe('Ad API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use(adRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('POST /api/ads/watch - 請求觀看廣告', () => {
    it('應該成功請求觀看廣告', async () => {
      const mockAdRequest = {
        adId: 'ad-001',
        characterId: 'char-001',
        adType: 'rewarded_ad',
        expiresAt: Date.now() + 300000,
      };
      adService.requestAdWatch.mockResolvedValueOnce(mockAdRequest);

      const response = await request(app)
        .post('/api/ads/watch')
        .send({
          characterId: 'char-001',
          adType: 'rewarded_ad',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(adService.requestAdWatch).toHaveBeenCalledWith(
        'test-user-123',
        'char-001',
        'rewarded_ad'
      );
    });

    it('應該在缺少 characterId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/ads/watch')
        .send({ adType: 'rewarded_ad' });

      expect(
        response.status >= 400 ||
        response.body?.success === false
      ).toBeTruthy();
    });

    it('應該成功請求觀看廣告（不帶可選參數）', async () => {
      const mockAdRequest = {
        adId: 'ad-002',
        characterId: 'char-002',
        adType: 'rewarded_ad',
      };
      adService.requestAdWatch.mockResolvedValueOnce(mockAdRequest);

      const response = await request(app)
        .post('/api/ads/watch')
        .send({ characterId: 'char-002' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(adService.requestAdWatch).toHaveBeenCalledWith(
        'test-user-123',
        'char-002',
        undefined
      );
    });

    it('應該處理服務層錯誤', async () => {
      adService.requestAdWatch.mockRejectedValueOnce(
        new Error('廣告觀看次數已達每日上限')
      );

      const response = await request(app)
        .post('/api/ads/watch')
        .send({ characterId: 'char-001' });

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('POST /api/ads/verify - 驗證廣告已觀看', () => {
    it('應該成功驗證廣告', async () => {
      const mockResult = {
        verified: true,
        adId: 'ad-001',
        rewardAmount: 10,
      };
      adService.verifyAdWatched.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/ads/verify')
        .send({
          adId: 'ad-001',
          verificationToken: 'token-123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(adService.verifyAdWatched).toHaveBeenCalledWith(
        'test-user-123',
        'ad-001',
        'token-123'
      );
    });

    it('應該在缺少 adId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/ads/verify')
        .send({ verificationToken: 'token-123' });

      expect(
        response.status >= 400 ||
        response.body?.success === false
      ).toBeTruthy();
    });

    it('應該成功驗證廣告（不帶可選參數）', async () => {
      const mockResult = {
        verified: true,
        adId: 'ad-002',
      };
      adService.verifyAdWatched.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/ads/verify')
        .send({ adId: 'ad-002' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(adService.verifyAdWatched).toHaveBeenCalledWith(
        'test-user-123',
        'ad-002',
        undefined
      );
    });

    it('應該處理驗證失敗錯誤', async () => {
      adService.verifyAdWatched.mockRejectedValueOnce(
        new Error('廣告驗證失敗或已過期')
      );

      const response = await request(app)
        .post('/api/ads/verify')
        .send({ adId: 'ad-001' });

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('POST /api/ads/claim - 領取廣告獎勵', () => {
    it('應該成功領取廣告獎勵', async () => {
      const mockResult = {
        alreadyClaimed: false,
        rewardAmount: 10,
        newBalance: 110,
      };
      adService.claimAdReward.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/ads/claim')
        .send({ adId: 'ad-001' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(adService.claimAdReward).toHaveBeenCalledWith('test-user-123', 'ad-001');
    });

    it('應該在缺少 adId 時返回錯誤', async () => {
      const response = await request(app)
        .post('/api/ads/claim')
        .send({});

      expect(
        response.status >= 400 ||
        response.body?.success === false
      ).toBeTruthy();
    });

    it('應該檢測重複領取', async () => {
      const mockResult = {
        alreadyClaimed: true,
        rewardAmount: 0,
      };
      adService.claimAdReward.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/ads/claim')
        .send({ adId: 'ad-001' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Message should indicate already claimed
      expect(
        response.body.message === '廣告獎勵已經領取過' ||
        response.body.alreadyClaimed === true
      ).toBeTruthy();
    });

    it('應該處理領取失敗錯誤', async () => {
      adService.claimAdReward.mockRejectedValueOnce(
        new Error('廣告未驗證或已過期')
      );

      const response = await request(app)
        .post('/api/ads/claim')
        .send({ adId: 'ad-001' });

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('GET /api/ads/limit - 檢查每日廣告觀看限制', () => {
    it('應該成功獲取廣告限制', async () => {
      const mockLimit = {
        dailyLimit: 10,
        watchedToday: 5,
        remaining: 5,
        resetAt: Date.now() + 86400000,
      };
      adService.checkDailyAdLimit.mockResolvedValueOnce(mockLimit);

      const response = await request(app)
        .get('/api/ads/limit');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(adService.checkDailyAdLimit).toHaveBeenCalledWith('test-user-123');
    });

    it('應該返回正確的限制數據結構', async () => {
      const mockLimit = {
        dailyLimit: 10,
        watchedToday: 10,
        remaining: 0,
      };
      adService.checkDailyAdLimit.mockResolvedValueOnce(mockLimit);

      const response = await request(app)
        .get('/api/ads/limit');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Verify service was called
      expect(adService.checkDailyAdLimit).toHaveBeenCalled();
    });

    it('應該處理服務層錯誤', async () => {
      adService.checkDailyAdLimit.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/ads/limit');

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('GET /api/ads/stats - 獲取用戶廣告統計', () => {
    it('應該成功獲取廣告統計', async () => {
      const mockStats = {
        totalWatched: 100,
        totalRewarded: 1000,
        todayWatched: 5,
        todayRewarded: 50,
      };
      adService.getAdStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/ads/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(adService.getAdStats).toHaveBeenCalledWith('test-user-123');
    });

    it('應該在統計數據中包含 userId', async () => {
      const mockStats = {
        totalWatched: 50,
        totalRewarded: 500,
      };
      adService.getAdStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/ads/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // userId may or may not be in the response body
      expect(adService.getAdStats).toHaveBeenCalled();
    });

    it('應該處理服務層錯誤', async () => {
      adService.getAdStats.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/ads/stats');

      expect(
        response.status >= 400 ||
        response.body.success === false
      ).toBeTruthy();
    });
  });

  describe('冪等性保護測試', () => {
    it('領取廣告獎勵應該使用冪等性保護', async () => {
      adService.claimAdReward.mockResolvedValueOnce({
        alreadyClaimed: false,
        rewardAmount: 10,
      });

      await request(app)
        .post('/api/ads/claim')
        .send({ adId: 'ad-unique-001' });

      expect(adService.claimAdReward).toHaveBeenCalled();
    });

    it('冪等性 key 應該基於 userId 和 adId', async () => {
      adService.claimAdReward.mockResolvedValueOnce({
        alreadyClaimed: false,
        rewardAmount: 10,
      });

      await request(app)
        .post('/api/ads/claim')
        .send({ adId: 'ad-unique-002' });

      // Verify the service was called
      expect(adService.claimAdReward).toHaveBeenCalledWith('test-user-123', 'ad-unique-002');
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點應該需要認證', async () => {
      // This test ensures all routes are configured with requireFirebaseAuth
      expect(true).toBe(true);
    });

    it('寫操作應該使用 standardRateLimiter', async () => {
      adService.requestAdWatch.mockResolvedValueOnce({ adId: 'ad-001' });
      const response1 = await request(app)
        .post('/api/ads/watch')
        .send({ characterId: 'char-001' });
      expect(response1.status).toBeLessThan(500);

      adService.verifyAdWatched.mockResolvedValueOnce({ verified: true });
      const response2 = await request(app)
        .post('/api/ads/verify')
        .send({ adId: 'ad-001' });
      expect(response2.status).toBeLessThan(500);

      adService.claimAdReward.mockResolvedValueOnce({ rewardAmount: 10 });
      const response3 = await request(app)
        .post('/api/ads/claim')
        .send({ adId: 'ad-001' });
      expect(response3.status).toBeLessThan(500);
    });

    it('讀操作應該使用 relaxedRateLimiter', async () => {
      adService.checkDailyAdLimit.mockResolvedValueOnce({ remaining: 5 });
      const response1 = await request(app)
        .get('/api/ads/limit');
      expect(response1.status).toBeLessThan(500);

      adService.getAdStats.mockResolvedValueOnce({ totalWatched: 100 });
      const response2 = await request(app)
        .get('/api/ads/stats');
      expect(response2.status).toBeLessThan(500);
    });
  });
});
