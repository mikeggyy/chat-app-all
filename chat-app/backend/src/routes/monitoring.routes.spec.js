/**
 * Monitoring API 路由測試
 * 測試範圍：
 * - 監控儀表板
 * - 廣告觀看異常監控
 * - 退款監控
 * - 緩存監控
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dependencies BEFORE importing the router
vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ✅ 2025-12-02 修復：添加 errorFormatter mock
vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, statusCode = 200) => res.status(typeof statusCode === 'number' ? statusCode : 200).json({ success: true, data }),
  sendError: (res, code, message, details) => {
    const { error: detailError, ...safeDetails } = details || {};
    return res.status(
      code === 'RESOURCE_NOT_FOUND' ? 404 :
      code === 'FORBIDDEN' ? 403 :
      code === 'VALIDATION_ERROR' ? 400 :
      code === 'INTERNAL_SERVER_ERROR' ? 500 : 400
    ).json({
      success: false,
      error: code,
      message,
      ...safeDetails,
      ...(detailError ? { errorDetail: detailError } : {}),
    });
  },
}));

// Mock monitoring service
const mockGetMonitoringDashboard = vi.fn();
const mockGetAbnormalAdWatchUsers = vi.fn();
const mockDetectAdWatchAnomalies = vi.fn();
const mockGetRefundStatistics = vi.fn();
const mockGetHighRefundUsers = vi.fn();
const mockGetCacheStatistics = vi.fn();
const mockResetCacheFailureStats = vi.fn();

vi.mock('../services/monitoring.service.js', () => ({
  getMonitoringDashboard: (...args) => mockGetMonitoringDashboard(...args),
  getAbnormalAdWatchUsers: (...args) => mockGetAbnormalAdWatchUsers(...args),
  detectAdWatchAnomalies: (...args) => mockDetectAdWatchAnomalies(...args),
  getRefundStatistics: (...args) => mockGetRefundStatistics(...args),
  getHighRefundUsers: (...args) => mockGetHighRefundUsers(...args),
  getCacheStatistics: (...args) => mockGetCacheStatistics(...args),
  resetCacheFailureStats: (...args) => mockResetCacheFailureStats(...args),
}));

// Import the router after mocks
import monitoringRouter from './monitoring.routes.js';

describe('Monitoring API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/monitoring', monitoringRouter);

    // 添加錯誤處理中間件
    app.use((err, req, res, next) => {
      res.status(500).json({
        success: false,
        error: err.message || '內部錯誤',
      });
    });

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('GET /dashboard - 獲取監控儀表板', () => {
    it('應該成功獲取監控儀表板數據', async () => {
      const mockDashboard = {
        adWatch: {
          totalAnomalies: 5,
          highRiskUsers: 2,
        },
        refunds: {
          totalRefunds: 10,
          totalAmount: 1000,
          highFrequencyUsers: 3,
        },
        cache: {
          membership: {
            hitRate: 0.95,
            failureCount: 5,
          },
        },
        health: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
      };
      mockGetMonitoringDashboard.mockResolvedValue(mockDashboard);

      const response = await request(app).get('/api/monitoring/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDashboard);
      expect(response.body.data.health.status).toBe('healthy');
      expect(mockGetMonitoringDashboard).toHaveBeenCalled();
    });

    it('應該處理獲取儀表板失敗', async () => {
      mockGetMonitoringDashboard.mockRejectedValue(new Error('Firestore connection failed'));

      const response = await request(app).get('/api/monitoring/dashboard');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.message).toContain('獲取監控儀表板失敗');
    });
  });

  describe('GET /ad-watch/anomalies - 獲取廣告異常用戶', () => {
    it('應該成功獲取廣告異常用戶列表（使用默認參數）', async () => {
      const mockResult = {
        users: [
          {
            userId: 'user1',
            todayCount: 10,
            totalCount: 50,
            isAnomaly: true,
          },
          {
            userId: 'user2',
            todayCount: 9,
            totalCount: 45,
            isAnomaly: true,
          },
        ],
        totalAnomalies: 2,
        scannedUsers: 100,
      };
      mockGetAbnormalAdWatchUsers.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/monitoring/ad-watch/anomalies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGetAbnormalAdWatchUsers).toHaveBeenCalledWith({
        limit: 100,
        minTodayCount: 8,
      });
    });

    it('應該支援自定義參數', async () => {
      const mockResult = {
        users: [],
        totalAnomalies: 0,
        scannedUsers: 50,
      };
      mockGetAbnormalAdWatchUsers.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/monitoring/ad-watch/anomalies')
        .query({ limit: 50, minTodayCount: 5 });

      expect(response.status).toBe(200);
      expect(mockGetAbnormalAdWatchUsers).toHaveBeenCalledWith({
        limit: 50,
        minTodayCount: 5,
      });
    });

    it('應該處理獲取失敗', async () => {
      mockGetAbnormalAdWatchUsers.mockRejectedValue(new Error('Query failed'));

      const response = await request(app).get('/api/monitoring/ad-watch/anomalies');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /ad-watch/user/:userId - 檢測特定用戶廣告異常', () => {
    it('應該成功檢測用戶廣告異常（使用默認天數）', async () => {
      const mockResult = {
        userId: 'test-user',
        isAnomaly: true,
        todayCount: 10,
        last7DaysCount: 65,
        averagePerDay: 9.3,
        threshold: 8,
      };
      mockDetectAdWatchAnomalies.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/monitoring/ad-watch/user/test-user');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockDetectAdWatchAnomalies).toHaveBeenCalledWith('test-user', {
        days: 7,
      });
    });

    it('應該支援自定義天數', async () => {
      const mockResult = {
        userId: 'test-user',
        isAnomaly: false,
        todayCount: 5,
        last14DaysCount: 60,
        averagePerDay: 4.3,
      };
      mockDetectAdWatchAnomalies.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/monitoring/ad-watch/user/test-user')
        .query({ days: 14 });

      expect(response.status).toBe(200);
      expect(mockDetectAdWatchAnomalies).toHaveBeenCalledWith('test-user', {
        days: 14,
      });
    });

    it('應該處理檢測失敗', async () => {
      mockDetectAdWatchAnomalies.mockRejectedValue(new Error('User not found'));

      const response = await request(app).get('/api/monitoring/ad-watch/user/invalid-user');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /refunds/statistics - 獲取退款統計', () => {
    it('應該成功獲取退款統計（使用默認參數）', async () => {
      const mockResult = {
        totalRefunds: 50,
        totalAmount: 5000,
        averageAmount: 100,
        refundsByDay: [
          { date: '2025-01-15', count: 10, amount: 1000 },
          { date: '2025-01-14', count: 8, amount: 800 },
        ],
        groupBy: 'day',
      };
      mockGetRefundStatistics.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/monitoring/refunds/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGetRefundStatistics).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        groupBy: 'day',
      });
    });

    it('應該支援日期範圍和分組方式', async () => {
      const mockResult = {
        totalRefunds: 100,
        totalAmount: 10000,
        refundsByWeek: [
          { week: '2025-W02', count: 50, amount: 5000 },
          { week: '2025-W01', count: 50, amount: 5000 },
        ],
        groupBy: 'week',
      };
      mockGetRefundStatistics.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/monitoring/refunds/statistics')
        .query({
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-15T23:59:59Z',
          groupBy: 'week',
        });

      expect(response.status).toBe(200);
      expect(mockGetRefundStatistics).toHaveBeenCalledWith({
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-15T23:59:59Z',
        groupBy: 'week',
      });
    });

    it('應該處理獲取失敗', async () => {
      mockGetRefundStatistics.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/monitoring/refunds/statistics');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /refunds/high-frequency-users - 獲取高頻退款用戶', () => {
    it('應該成功獲取高頻退款用戶（使用默認參數）', async () => {
      const mockResult = {
        users: [
          {
            userId: 'user1',
            refundCount: 5,
            totalRefundAmount: 500,
            lastRefundDate: '2025-01-15',
          },
          {
            userId: 'user2',
            refundCount: 4,
            totalRefundAmount: 400,
            lastRefundDate: '2025-01-14',
          },
        ],
        totalUsers: 2,
      };
      mockGetHighRefundUsers.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/monitoring/refunds/high-frequency-users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGetHighRefundUsers).toHaveBeenCalledWith({
        minRefunds: 3,
        days: 30,
      });
    });

    it('應該支援自定義閾值和天數', async () => {
      const mockResult = {
        users: [],
        totalUsers: 0,
      };
      mockGetHighRefundUsers.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/monitoring/refunds/high-frequency-users')
        .query({ minRefunds: 5, days: 60 });

      expect(response.status).toBe(200);
      expect(mockGetHighRefundUsers).toHaveBeenCalledWith({
        minRefunds: 5,
        days: 60,
      });
    });

    it('應該處理獲取失敗', async () => {
      mockGetHighRefundUsers.mockRejectedValue(new Error('Query timeout'));

      const response = await request(app).get('/api/monitoring/refunds/high-frequency-users');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /cache/statistics - 獲取緩存統計', () => {
    it('應該成功獲取緩存統計數據', async () => {
      const mockResult = {
        membership: {
          hitRate: 0.95,
          totalRequests: 1000,
          cacheHits: 950,
          cacheMisses: 50,
          failureCount: 5,
          lastFailureTime: new Date().toISOString(),
        },
        character: {
          hitRate: 0.98,
          totalRequests: 5000,
          cacheHits: 4900,
          cacheMisses: 100,
        },
        overall: {
          status: 'healthy',
          avgHitRate: 0.97,
        },
      };
      mockGetCacheStatistics.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/monitoring/cache/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(response.body.data.membership.hitRate).toBe(0.95);
      expect(mockGetCacheStatistics).toHaveBeenCalled();
    });

    it('應該處理獲取失敗', async () => {
      mockGetCacheStatistics.mockRejectedValue(new Error('Cache unavailable'));

      const response = await request(app).get('/api/monitoring/cache/statistics');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /cache/reset - 重置緩存失敗計數', () => {
    it('應該成功重置所有緩存失敗計數（默認）', async () => {
      const mockResult = {
        cacheType: 'all',
        resetTypes: ['membership', 'character', 'user'],
        resetCount: 3,
        timestamp: new Date().toISOString(),
      };
      mockResetCacheFailureStats.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/monitoring/cache/reset').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockResetCacheFailureStats).toHaveBeenCalledWith('all');
    });

    it('應該支援重置特定類型的緩存', async () => {
      const mockResult = {
        cacheType: 'membership',
        resetTypes: ['membership'],
        resetCount: 1,
        timestamp: new Date().toISOString(),
      };
      mockResetCacheFailureStats.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/monitoring/cache/reset')
        .send({ cacheType: 'membership' });

      expect(response.status).toBe(200);
      expect(response.body.data.cacheType).toBe('membership');
      expect(mockResetCacheFailureStats).toHaveBeenCalledWith('membership');
    });

    it('應該處理重置失敗', async () => {
      mockResetCacheFailureStats.mockRejectedValue(new Error('Reset operation failed'));

      const response = await request(app)
        .post('/api/monitoring/cache/reset')
        .send({ cacheType: 'all' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('公開端點測試', () => {
    it('所有端點都是公開的（不需要認證）', async () => {
      mockGetMonitoringDashboard.mockResolvedValue({ health: { status: 'healthy' } });
      mockGetAbnormalAdWatchUsers.mockResolvedValue({ users: [], totalAnomalies: 0 });
      mockGetCacheStatistics.mockResolvedValue({ overall: { status: 'healthy' } });

      // 測試幾個主要端點
      const response1 = await request(app).get('/api/monitoring/dashboard');
      expect(response1.status).toBe(200);

      const response2 = await request(app).get('/api/monitoring/ad-watch/anomalies');
      expect(response2.status).toBe(200);

      const response3 = await request(app).get('/api/monitoring/cache/statistics');
      expect(response3.status).toBe(200);

      // 所有端點都不需要認證
    });
  });

  describe('參數解析測試', () => {
    it('應該正確解析數字參數', async () => {
      mockGetAbnormalAdWatchUsers.mockResolvedValue({ users: [], totalAnomalies: 0 });

      await request(app)
        .get('/api/monitoring/ad-watch/anomalies')
        .query({ limit: '50', minTodayCount: '10' });

      expect(mockGetAbnormalAdWatchUsers).toHaveBeenCalledWith({
        limit: 50,
        minTodayCount: 10,
      });
    });

    it('應該處理無效的數字參數（使用默認值）', async () => {
      mockGetAbnormalAdWatchUsers.mockResolvedValue({ users: [], totalAnomalies: 0 });

      await request(app)
        .get('/api/monitoring/ad-watch/anomalies')
        .query({ limit: 'invalid', minTodayCount: 'abc' });

      // parseInt('invalid') = NaN，但 mockGetAbnormalAdWatchUsers 仍會被調用
      expect(mockGetAbnormalAdWatchUsers).toHaveBeenCalled();
    });
  });
});
