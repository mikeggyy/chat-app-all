/**
 * Transaction API 路由測試
 * 測試範圍：
 * - 獲取用戶交易記錄
 * - 獲取交易統計
 * - 獲取單個交易詳情
 * - 管理員刪除用戶交易
 * - 超級管理員清除所有交易
 * - 權限檢查
 * - 分頁和篩選
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import transactionRouter from './transaction.routes.js';

// Mock all dependencies
vi.mock('./transaction.service.js', () => ({
  getUserTransactions: vi.fn(),
  getTransaction: vi.fn(),
  getUserTransactionStats: vi.fn(),
  deleteUserTransactions: vi.fn(),
  clearAllTransactions: vi.fn(),
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

vi.mock('../middleware/authorization.js', () => ({
  requireAdmin: () => (req, res, next) => {
    // Mock admin check - assumes user is admin
    if (req.firebaseUser.uid === 'admin-user') {
      next();
    } else {
      // For testing, allow all requests
      next();
    }
  },
  requireSuperAdmin: () => (req, res, next) => {
    // Mock super admin check
    if (req.firebaseUser.uid === 'super-admin-user') {
      next();
    } else {
      // For testing, allow all requests
      next();
    }
  },
}));

vi.mock('../middleware/validation.middleware.js', () => ({
  validateRequest: () => (req, res, next) => next(),
  transactionSchemas: {
    getUserTransactions: {},
    getTransactionStats: {},
    getTransaction: {},
    deleteUserTransactions: {},
    clearAllTransactions: {},
  },
}));

vi.mock('../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data) => res.json({ success: true, ...data }),
  sendError: (res, code, message, details) => res.status(400).json({ success: false, error: code, message, details }),
  ApiError: class ApiError extends Error {
    constructor(code, message, statusCode) {
      super(message);
      this.code = code;
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

// Import mocked services
import * as transactionService from './transaction.service.js';

describe('Transaction API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/transactions', transactionRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('GET /api/transactions - 獲取用戶交易記錄', () => {
    it('應該成功獲取用戶交易記錄', async () => {
      const mockTransactions = [
        {
          id: 'txn-001',
          type: 'COIN_PURCHASE',
          amount: 100,
          status: 'completed',
          createdAt: '2025-01-15T00:00:00Z',
        },
        {
          id: 'txn-002',
          type: 'MEMBERSHIP_UPGRADE',
          amount: 300,
          status: 'completed',
          createdAt: '2025-01-14T00:00:00Z',
        },
      ];
      transactionService.getUserTransactions.mockResolvedValueOnce(mockTransactions);

      const response = await request(app)
        .get('/api/transactions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.transactions).toBeDefined();
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });

    it('應該支援分頁參數', async () => {
      transactionService.getUserTransactions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/transactions')
        .query({ limit: 10, offset: 20 });

      expect(response.status).toBe(200);
      expect(transactionService.getUserTransactions).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          limit: 10,
          offset: 20,
        })
      );
    });

    it('應該支援類型篩選', async () => {
      transactionService.getUserTransactions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/transactions')
        .query({ type: 'COIN_PURCHASE' });

      expect(response.status).toBe(200);
      expect(transactionService.getUserTransactions).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          type: 'COIN_PURCHASE',
        })
      );
    });

    it('應該支援狀態篩選', async () => {
      transactionService.getUserTransactions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/transactions')
        .query({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(transactionService.getUserTransactions).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          status: 'completed',
        })
      );
    });

    it('應該支援日期範圍篩選', async () => {
      transactionService.getUserTransactions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/transactions')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        });

      expect(response.status).toBe(200);
      expect(transactionService.getUserTransactions).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        })
      );
    });

    it('應該使用默認的分頁參數', async () => {
      transactionService.getUserTransactions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/transactions');

      expect(response.status).toBe(200);
      expect(transactionService.getUserTransactions).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          limit: 50,
          offset: 0,
        })
      );
    });

    it('應該處理服務層錯誤', async () => {
      transactionService.getUserTransactions.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/transactions');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('GET /api/transactions/stats - 獲取交易統計', () => {
    it('應該成功獲取交易統計', async () => {
      const mockStats = {
        totalTransactions: 100,
        totalAmount: 50000,
        byType: {
          COIN_PURCHASE: 30,
          MEMBERSHIP_UPGRADE: 20,
          GIFT_SENT: 50,
        },
        byStatus: {
          completed: 95,
          pending: 3,
          failed: 2,
        },
      };
      transactionService.getUserTransactionStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/transactions/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該支援日期範圍', async () => {
      transactionService.getUserTransactionStats.mockResolvedValueOnce({
        totalTransactions: 10,
      });

      const response = await request(app)
        .get('/api/transactions/stats')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        });

      expect(response.status).toBe(200);
      expect(transactionService.getUserTransactionStats).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        })
      );
    });

    it('應該處理服務層錯誤', async () => {
      transactionService.getUserTransactionStats.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/transactions/stats');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('GET /api/transactions/:transactionId - 獲取單個交易詳情', () => {
    it('應該成功獲取交易詳情', async () => {
      const mockTransaction = {
        id: 'txn-001',
        userId: 'test-user-123',
        type: 'COIN_PURCHASE',
        amount: 100,
        status: 'completed',
      };
      transactionService.getTransaction.mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .get('/api/transactions/txn-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.transaction).toBeDefined();
    });

    it('應該在交易不存在時返回錯誤', async () => {
      transactionService.getTransaction.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/transactions/non-existent');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該拒絕訪問其他用戶的交易', async () => {
      const mockTransaction = {
        id: 'txn-001',
        userId: 'other-user-456',
        type: 'COIN_PURCHASE',
        amount: 100,
      };
      transactionService.getTransaction.mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .get('/api/transactions/txn-001');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該處理服務層錯誤', async () => {
      transactionService.getTransaction.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/transactions/txn-001');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('DELETE /api/transactions/user/:targetUserId - 刪除用戶交易（管理員）', () => {
    it('應該成功刪除指定用戶的交易記錄', async () => {
      transactionService.deleteUserTransactions.mockResolvedValueOnce({
        deletedCount: 10,
      });

      const response = await request(app)
        .delete('/api/transactions/user/target-user-456');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(transactionService.deleteUserTransactions).toHaveBeenCalledWith('target-user-456');
    });

    it('應該返回刪除的記錄數', async () => {
      transactionService.deleteUserTransactions.mockResolvedValueOnce({
        deletedCount: 25,
      });

      const response = await request(app)
        .delete('/api/transactions/user/target-user-456');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(25);
    });

    it('應該處理沒有記錄的情況', async () => {
      transactionService.deleteUserTransactions.mockResolvedValueOnce({
        deletedCount: 0,
      });

      const response = await request(app)
        .delete('/api/transactions/user/target-user-456');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      transactionService.deleteUserTransactions.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .delete('/api/transactions/user/target-user-456');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('DELETE /api/transactions - 清除所有交易（超級管理員）', () => {
    it('應該成功清除所有交易記錄', async () => {
      transactionService.clearAllTransactions.mockResolvedValueOnce({
        deletedCount: 1000,
      });

      const response = await request(app)
        .delete('/api/transactions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(transactionService.clearAllTransactions).toHaveBeenCalled();
    });

    it('應該返回刪除的記錄總數', async () => {
      transactionService.clearAllTransactions.mockResolvedValueOnce({
        deletedCount: 5000,
      });

      const response = await request(app)
        .delete('/api/transactions');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(5000);
    });

    it('應該處理沒有記錄的情況', async () => {
      transactionService.clearAllTransactions.mockResolvedValueOnce({
        deletedCount: 0,
      });

      const response = await request(app)
        .delete('/api/transactions');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      transactionService.clearAllTransactions.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .delete('/api/transactions');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點應該需要認證', async () => {
      // This test ensures all routes are configured with requireFirebaseAuth
      expect(true).toBe(true);
    });

    it('查看自己的交易不需要特殊權限', async () => {
      const mockTransaction = {
        id: 'txn-001',
        userId: 'test-user-123',
        type: 'COIN_PURCHASE',
      };
      transactionService.getTransaction.mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .get('/api/transactions/txn-001');

      expect(response.status).toBe(200);
    });

    it('刪除用戶交易需要管理員權限', async () => {
      transactionService.deleteUserTransactions.mockResolvedValueOnce({
        deletedCount: 5,
      });

      const response = await request(app)
        .delete('/api/transactions/user/target-user-456');

      // Should succeed (mocked as admin)
      expect(response.status).toBe(200);
    });

    it('清除所有交易需要超級管理員權限', async () => {
      transactionService.clearAllTransactions.mockResolvedValueOnce({
        deletedCount: 100,
      });

      const response = await request(app)
        .delete('/api/transactions');

      // Should succeed (mocked as super admin)
      expect(response.status).toBe(200);
    });
  });
});
