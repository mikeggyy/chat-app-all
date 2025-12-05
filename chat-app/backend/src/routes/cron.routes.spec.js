/**
 * Cron API 路由測試
 * 測試範圍：
 * - 鎖定清理任務
 * - 過期會員檢查
 * - 冪等性清理
 * - Cloud Scheduler 驗證
 * - 測試端點
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  sendSuccess: (res, data, statusCode = 200) => {
    return res.status(typeof statusCode === 'number' ? statusCode : 200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  },
  sendError: (res, code, message, details) => {
    const status = code === 'FORBIDDEN' ? 403 :
                   code === 'INTERNAL_SERVER_ERROR' ? 500 : 400;
    return res.status(status).json({
      success: false,
      error: code,
      message,
      timestamp: new Date().toISOString(),
      ...(details || {}),
    });
  },
}));

// Mock membership lock cleanup service
const mockCleanupStaleUpgradeLocks = vi.fn();
const mockGetLockedUsers = vi.fn();

vi.mock('../services/membershipLockCleanup.service.js', () => ({
  cleanupStaleUpgradeLocks: (...args) => mockCleanupStaleUpgradeLocks(...args),
  getLockedUsers: (...args) => mockGetLockedUsers(...args),
}));

// Mock scheduler functions
const mockRunExpiredMembershipCheck = vi.fn();
const mockRunIdempotencyCleanup = vi.fn();

vi.mock('../utils/scheduler.js', () => ({
  runExpiredMembershipCheck: (...args) => mockRunExpiredMembershipCheck(...args),
  runIdempotencyCleanup: (...args) => mockRunIdempotencyCleanup(...args),
}));

// Mock membership reminder service
const mockProcessMembershipReminders = vi.fn();
const mockCleanupOldReminders = vi.fn();

vi.mock('../membership/membershipReminder.service.js', () => ({
  processMembershipReminders: (...args) => mockProcessMembershipReminders(...args),
  cleanupOldReminders: (...args) => mockCleanupOldReminders(...args),
}));

// Mock yearly bonus service
const mockProcessMonthlyBonuses = vi.fn();

vi.mock('../services/yearlyBonus.service.js', () => ({
  processMonthlyBonuses: (...args) => mockProcessMonthlyBonuses(...args),
}));

// Import the router after mocks
import cronRouter from './cron.routes.js';

describe('Cron API Routes', () => {
  let app;
  let originalNodeEnv;

  beforeEach(async () => {
    // 保存原始環境變數
    originalNodeEnv = process.env.NODE_ENV;

    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/cron', cronRouter);

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

  afterEach(() => {
    // 恢復原始環境變數
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('POST /cleanup-locks - 清理過期的會員升級鎖定', () => {
    beforeEach(() => {
      // 設置為開發環境，跳過 Cloud Scheduler 驗證
      process.env.NODE_ENV = 'development';
    });

    it('應該成功清理過期鎖定（使用默認參數）', async () => {
      const mockResult = {
        scanned: 100,
        cleaned: 5,
        errors: 0,
        cleanedUsers: ['user1', 'user2', 'user3', 'user4', 'user5'],
      };
      mockCleanupStaleUpgradeLocks.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/cron/cleanup-locks').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ 2025-12-02 修復：使用 response.body.data.xxx
      expect(response.body.data.task).toBe('cleanup-locks');
      expect(response.body.data.result.scanned).toBe(100);
      expect(response.body.data.result.cleaned).toBe(5);
      expect(response.body.data.result.cleanedUsers).toHaveLength(5);
      expect(response.body.timestamp).toBeDefined();
      expect(mockCleanupStaleUpgradeLocks).toHaveBeenCalledWith(5);
    });

    it('應該支援自定義鎖定清理時間（maxAgeMinutes）', async () => {
      const mockResult = {
        scanned: 50,
        cleaned: 2,
        errors: 0,
        cleanedUsers: ['user1', 'user2'],
      };
      mockCleanupStaleUpgradeLocks.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/cron/cleanup-locks')
        .send({ maxAgeMinutes: 10 });

      expect(response.status).toBe(200);
      // ✅ 2025-12-02 修復
      expect(response.body.data.result.cleaned).toBe(2);
      expect(mockCleanupStaleUpgradeLocks).toHaveBeenCalledWith(10);
    });

    it('應該處理清理失敗', async () => {
      mockCleanupStaleUpgradeLocks.mockRejectedValue(new Error('Firestore timeout'));

      const response = await request(app).post('/api/cron/cleanup-locks').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復：sendError 不包含 task，改為檢查 message
      expect(response.body.message).toContain('Firestore timeout');
      expect(response.body.timestamp).toBeDefined();
    });

    it('應該返回清理統計信息', async () => {
      const mockResult = {
        scanned: 200,
        cleaned: 10,
        errors: 2,
        cleanedUsers: Array(10).fill('user'),
      };
      mockCleanupStaleUpgradeLocks.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/cron/cleanup-locks').send({});

      expect(response.status).toBe(200);
      // ✅ 2025-12-02 修復
      expect(response.body.data.result).toHaveProperty('scanned');
      expect(response.body.data.result).toHaveProperty('cleaned');
      expect(response.body.data.result).toHaveProperty('errors');
      expect(response.body.data.result).toHaveProperty('cleanedUsers');
    });
  });

  describe('GET /status - 檢查鎖定狀態', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('應該成功獲取鎖定狀態', async () => {
      const mockLockedUsers = [
        {
          userId: 'user1',
          lockedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 分鐘前
          isStale: true,
        },
        {
          userId: 'user2',
          lockedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 分鐘前
          isStale: false,
        },
        {
          userId: 'user3',
          lockedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 分鐘前
          isStale: true,
        },
      ];
      mockGetLockedUsers.mockResolvedValue(mockLockedUsers);

      const response = await request(app).get('/api/cron/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ 2025-12-02 修復
      expect(response.body.data.totalLocked).toBe(3);
      expect(response.body.data.staleLocks).toBe(2);
      expect(response.body.data.users).toHaveLength(3);
      expect(response.body.timestamp).toBeDefined();
      expect(mockGetLockedUsers).toHaveBeenCalled();
    });

    it('應該處理沒有鎖定的情況', async () => {
      mockGetLockedUsers.mockResolvedValue([]);

      const response = await request(app).get('/api/cron/status');

      expect(response.status).toBe(200);
      // ✅ 2025-12-02 修復
      expect(response.body.data.totalLocked).toBe(0);
      expect(response.body.data.staleLocks).toBe(0);
      expect(response.body.data.users).toEqual([]);
    });

    it('應該處理查詢失敗', async () => {
      mockGetLockedUsers.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/cron/status');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('Database error');
    });
  });

  describe('POST /test - 測試端點（僅開發環境）', () => {
    it('應該在開發環境成功響應', async () => {
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/api/cron/test')
        .send({ testData: 'hello' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ 2025-12-02 修復
      expect(response.body.data.message).toContain('測試成功');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.data.receivedData).toEqual({ testData: 'hello' });
    });

    it('應該在生產環境拒絕請求', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app).post('/api/cron/test').send({});

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('僅在開發環境可用');
    });
  });

  describe('POST /expired-memberships - 檢查並降級過期會員', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('應該成功執行過期會員檢查', async () => {
      const mockResult = {
        success: true,
        totalChecked: 100,
        expired: 10,
        downgraded: 8,
        errors: 2,
        duration: '1.5s',
      };
      mockRunExpiredMembershipCheck.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/cron/expired-memberships').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ 2025-12-02 修復
      expect(response.body.data.task).toBe('expired-memberships');
      expect(response.body.data.result.totalChecked).toBe(100);
      expect(response.body.data.result.expired).toBe(10);
      expect(response.body.data.result.downgraded).toBe(8);
      expect(response.body.data.result.errors).toBe(2);
      expect(response.body.timestamp).toBeDefined();
      expect(mockRunExpiredMembershipCheck).toHaveBeenCalled();
    });

    it('應該處理檢查失敗', async () => {
      mockRunExpiredMembershipCheck.mockRejectedValue(new Error('Query timeout'));

      const response = await request(app).post('/api/cron/expired-memberships').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復：sendError 不包含 task
      expect(response.body.message).toContain('Query timeout');
    });

    it('應該處理返回失敗結果的情況', async () => {
      mockRunExpiredMembershipCheck.mockResolvedValue({
        success: false,
        error: 'Service unavailable',
      });

      const response = await request(app).post('/api/cron/expired-memberships').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('Service unavailable');
    });
  });

  describe('POST /idempotency-cleanup - 清理過期的冪等性記錄', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('應該成功執行冪等性清理', async () => {
      const mockResult = {
        success: true,
        stats: {
          totalScanned: 5000,
          totalDeleted: 500,
          deletedByType: {
            'gift-send': 200,
            'purchase': 150,
            'membership-upgrade': 100,
            'other': 50,
          },
          duration: '2.3s',
        },
      };
      mockRunIdempotencyCleanup.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/cron/idempotency-cleanup').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ 2025-12-02 修復
      expect(response.body.data.task).toBe('idempotency-cleanup');
      expect(response.body.data.result.totalScanned).toBe(5000);
      expect(response.body.data.result.totalDeleted).toBe(500);
      expect(response.body.data.result.deletedByType).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(mockRunIdempotencyCleanup).toHaveBeenCalled();
    });

    it('應該處理清理失敗', async () => {
      mockRunIdempotencyCleanup.mockRejectedValue(new Error('Cleanup failed'));

      const response = await request(app).post('/api/cron/idempotency-cleanup').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('Cleanup failed');
    });

    it('應該處理返回失敗結果的情況', async () => {
      mockRunIdempotencyCleanup.mockResolvedValue({
        success: false,
        error: 'Insufficient permissions',
      });

      const response = await request(app).post('/api/cron/idempotency-cleanup').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('Insufficient permissions');
    });
  });

  describe('Cloud Scheduler 驗證測試', () => {
    it('開發環境應該跳過驗證', async () => {
      process.env.NODE_ENV = 'development';
      mockCleanupStaleUpgradeLocks.mockResolvedValue({
        scanned: 0,
        cleaned: 0,
        errors: 0,
        cleanedUsers: [],
      });

      const response = await request(app).post('/api/cron/cleanup-locks').send({});

      expect(response.status).toBe(200);
      // 開發環境不需要特定的 User-Agent
    });

    it('生產環境應該拒絕非 Cloud Scheduler 請求', async () => {
      process.env.NODE_ENV = 'production';
      mockCleanupStaleUpgradeLocks.mockResolvedValue({
        scanned: 0,
        cleaned: 0,
        errors: 0,
        cleanedUsers: [],
      });

      const response = await request(app)
        .post('/api/cron/cleanup-locks')
        .set('User-Agent', 'Mozilla/5.0')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('只允許 Cloud Scheduler');
      expect(mockCleanupStaleUpgradeLocks).not.toHaveBeenCalled();
    });

    it('生產環境應該接受 Cloud Scheduler 請求', async () => {
      process.env.NODE_ENV = 'production';
      mockCleanupStaleUpgradeLocks.mockResolvedValue({
        scanned: 50,
        cleaned: 5,
        errors: 0,
        cleanedUsers: ['user1'],
      });

      const response = await request(app)
        .post('/api/cron/cleanup-locks')
        .set('User-Agent', 'Google-Cloud-Scheduler')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockCleanupStaleUpgradeLocks).toHaveBeenCalled();
    });
  });

  describe('POST /membership-reminders - 發送會員到期提醒', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('應該成功執行會員提醒任務', async () => {
      const mockResult = {
        success: true,
        processed: 50,
        sent: 45,
        skipped: 5,
        errors: 0,
        byThreshold: { 7: 20, 3: 15, 1: 10 },
        duration: '1.2s',
      };
      mockProcessMembershipReminders.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/cron/membership-reminders').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.task).toBe('membership-reminders');
      expect(response.body.data.result.processed).toBe(50);
      expect(response.body.data.result.sent).toBe(45);
      expect(mockProcessMembershipReminders).toHaveBeenCalled();
    });

    it('應該處理提醒任務失敗', async () => {
      mockProcessMembershipReminders.mockRejectedValue(new Error('Notification service error'));

      const response = await request(app).post('/api/cron/membership-reminders').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Notification service error');
    });
  });

  describe('POST /cleanup-reminders - 清理過期提醒記錄', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('應該成功執行提醒清理任務', async () => {
      mockCleanupOldReminders.mockResolvedValue({ deleted: 100 });

      const response = await request(app).post('/api/cron/cleanup-reminders').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.task).toBe('cleanup-reminders');
      expect(response.body.data.result.deleted).toBe(100);
      expect(mockCleanupOldReminders).toHaveBeenCalled();
    });

    it('應該處理清理失敗', async () => {
      mockCleanupOldReminders.mockRejectedValue(new Error('Cleanup error'));

      const response = await request(app).post('/api/cron/cleanup-reminders').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cleanup error');
    });
  });

  describe('POST /yearly-bonuses - 發放年訂閱每月獎勵', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('應該成功執行年訂閱獎勵發放', async () => {
      const mockResult = {
        month: '2025-12',
        processed: 100,
        granted: 95,
        skipped: 5,
        errors: [],
      };
      mockProcessMonthlyBonuses.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/cron/yearly-bonuses').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.task).toBe('yearly-bonuses');
      expect(response.body.data.result.month).toBe('2025-12');
      expect(response.body.data.result.processed).toBe(100);
      expect(response.body.data.result.granted).toBe(95);
      expect(mockProcessMonthlyBonuses).toHaveBeenCalled();
    });

    it('應該處理獎勵發放失敗', async () => {
      mockProcessMonthlyBonuses.mockRejectedValue(new Error('Bonus service error'));

      const response = await request(app).post('/api/cron/yearly-bonuses').send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Bonus service error');
    });
  });

  describe('時間戳和任務名稱測試', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('所有任務應該返回時間戳', async () => {
      mockCleanupStaleUpgradeLocks.mockResolvedValue({
        scanned: 0,
        cleaned: 0,
        errors: 0,
        cleanedUsers: [],
      });
      mockRunExpiredMembershipCheck.mockResolvedValue({
        success: true,
        totalChecked: 0,
        expired: 0,
        downgraded: 0,
        errors: 0,
        duration: '0s',
      });
      mockRunIdempotencyCleanup.mockResolvedValue({
        success: true,
        stats: { totalScanned: 0, totalDeleted: 0, duration: '0s' },
      });

      const beforeTime = new Date().toISOString();

      const response1 = await request(app).post('/api/cron/cleanup-locks').send({});
      const response2 = await request(app).post('/api/cron/expired-memberships').send({});
      const response3 = await request(app).post('/api/cron/idempotency-cleanup').send({});

      const afterTime = new Date().toISOString();

      expect(response1.body.timestamp).toBeDefined();
      expect(response1.body.timestamp >= beforeTime).toBe(true);
      expect(response1.body.timestamp <= afterTime).toBe(true);

      expect(response2.body.timestamp).toBeDefined();
      expect(response3.body.timestamp).toBeDefined();
    });

    it('所有任務應該返回正確的任務名稱', async () => {
      mockCleanupStaleUpgradeLocks.mockResolvedValue({
        scanned: 0,
        cleaned: 0,
        errors: 0,
        cleanedUsers: [],
      });
      mockRunExpiredMembershipCheck.mockResolvedValue({
        success: true,
        totalChecked: 0,
        expired: 0,
        downgraded: 0,
        errors: 0,
        duration: '0s',
      });
      mockRunIdempotencyCleanup.mockResolvedValue({
        success: true,
        stats: { totalScanned: 0, totalDeleted: 0, duration: '0s' },
      });

      const response1 = await request(app).post('/api/cron/cleanup-locks').send({});
      const response2 = await request(app).post('/api/cron/expired-memberships').send({});
      const response3 = await request(app).post('/api/cron/idempotency-cleanup').send({});

      // ✅ 2025-12-02 修復
      expect(response1.body.data.task).toBe('cleanup-locks');
      expect(response2.body.data.task).toBe('expired-memberships');
      expect(response3.body.data.task).toBe('idempotency-cleanup');
    });
  });
});
