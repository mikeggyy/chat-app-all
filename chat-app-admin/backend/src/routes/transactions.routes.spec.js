/**
 * Transactions Routes 測試（管理後台）
 * 測試範圍：
 * - 交易記錄列表（分頁、篩選）
 * - 交易統計
 * - 單一交易詳情
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dependencies
vi.mock('../firebase/index.js', () => ({
  db: {
    collection: vi.fn(),
  },
}));

describe('Transactions Routes - Admin Backend', () => {
  let app;
  let mockDb;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    const { db } = await import('../firebase/index.js');
    mockDb = db;

    setupRoutes(app, mockDb);
    vi.clearAllMocks();
  });

  describe('GET /api/transactions - 獲取交易記錄列表', () => {
    it('應該成功獲取交易記錄（默認分頁）', async () => {
      const mockTransactions = [
        { type: 'purchase', amount: 100, status: 'completed', userId: 'user1' },
        { type: 'spend', amount: -50, status: 'completed', userId: 'user2' },
      ];

      const mockChain = {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn()
          .mockResolvedValueOnce({ size: 50 }) // total count
          .mockResolvedValueOnce({
            docs: mockTransactions.map((t, i) => ({
              id: `tx-${i}`,
              data: () => ({
                ...t,
                createdAt: { toDate: () => new Date() },
                updatedAt: { toDate: () => new Date() },
              }),
            })),
          }),
      };

      mockDb.collection.mockImplementation((name) => {
        if (name === 'transactions') return mockChain;
        if (name === 'users') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({
                exists: true,
                data: () => ({ displayName: 'Test User', email: 'test@example.com' }),
              })),
            })),
          };
        }
      });

      const response = await request(app).get('/api/transactions');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('transactions');
      expect(response.body.pagination).toHaveProperty('total', 50);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('pageSize', 20);
    });

    it('應該支持篩選條件（userId, type, status）', async () => {
      const mockChain = {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn()
          .mockResolvedValueOnce({ size: 5 })
          .mockResolvedValueOnce({ docs: [] }),
      };

      mockDb.collection.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/transactions')
        .query({ userId: 'user1', type: 'purchase', status: 'completed' });

      expect(response.status).toBe(200);
      expect(mockChain.where).toHaveBeenCalledWith('userId', '==', 'user1');
      expect(mockChain.where).toHaveBeenCalledWith('type', '==', 'purchase');
      expect(mockChain.where).toHaveBeenCalledWith('status', '==', 'completed');
    });

    it('應該支持日期範圍篩選', async () => {
      const mockChain = {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn()
          .mockResolvedValueOnce({ size: 10 })
          .mockResolvedValueOnce({ docs: [] }),
      };

      mockDb.collection.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/transactions')
        .query({ startDate: '2025-01-01', endDate: '2025-01-31' });

      expect(response.status).toBe(200);
      expect(mockChain.where).toHaveBeenCalledWith('createdAt', '>=', expect.any(Date));
      expect(mockChain.where).toHaveBeenCalledWith('createdAt', '<=', expect.any(Date));
    });
  });

  describe('GET /api/transactions/stats - 獲取交易統計', () => {
    it('應該成功獲取交易統計', async () => {
      const mockTransactions = [
        { type: 'purchase', amount: 100, status: 'completed' },
        { type: 'purchase', amount: 200, status: 'completed' },
        { type: 'spend', amount: -50, status: 'completed' },
        { type: 'reward', amount: 10, status: 'completed' },
        { type: 'refund', amount: 20, status: 'completed' },
      ];

      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.resolve({
          size: mockTransactions.length,
          docs: mockTransactions.map((t) => ({ data: () => t })),
        })),
      });

      const response = await request(app).get('/api/transactions/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.stats).toHaveProperty('totalTransactions', 5);
      expect(response.body.stats).toHaveProperty('totalPurchased', 300);
      expect(response.body.stats).toHaveProperty('totalSpent', 50);
      expect(response.body.stats).toHaveProperty('totalRewarded', 10);
      expect(response.body.stats).toHaveProperty('totalRefunded', 20);
    });

    it('應該處理獲取統計失敗', async () => {
      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.reject(new Error('Database error'))),
      });

      const response = await request(app).get('/api/transactions/stats');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '獲取交易統計失敗');
    });
  });

  describe('GET /api/transactions/:id - 獲取單一交易詳情', () => {
    it('應該成功獲取交易詳情', async () => {
      const mockTransaction = {
        type: 'purchase',
        amount: 100,
        status: 'completed',
        userId: 'user1',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
      };

      mockDb.collection.mockImplementation((name) => {
        if (name === 'transactions') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({
                exists: true,
                id: 'tx-123',
                data: () => mockTransaction,
              })),
            })),
          };
        }
        if (name === 'users') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({
                exists: true,
                data: () => ({ displayName: 'Test User', email: 'test@example.com' }),
              })),
            })),
          };
        }
      });

      const response = await request(app).get('/api/transactions/tx-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.transaction).toHaveProperty('id', 'tx-123');
      expect(response.body.transaction).toHaveProperty('type', 'purchase');
      expect(response.body.transaction).toHaveProperty('userName', 'Test User');
    });

    it('應該處理交易不存在', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: false })),
        })),
      });

      const response = await request(app).get('/api/transactions/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '交易記錄不存在');
    });
  });
});

/**
 * Setup all routes for testing
 */
function setupRoutes(app, db) {
  const router = express.Router();

  // GET /api/transactions
  router.get('/', async (req, res) => {
    try {
      const { page = 1, pageSize = 20, userId, type, status, startDate, endDate } = req.query;
      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;

      let query = db.collection('transactions').orderBy('createdAt', 'desc');

      if (userId) query = query.where('userId', '==', userId);
      if (type) query = query.where('type', '==', type);
      if (status) query = query.where('status', '==', status);
      if (startDate) query = query.where('createdAt', '>=', new Date(startDate));
      if (endDate) query = query.where('createdAt', '<=', new Date(endDate));

      const countSnapshot = await query.get();
      const total = countSnapshot.size;

      query = query.limit(limit).offset(offset);
      const snapshot = await query.get();
      const transactions = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        let userName = '未知用戶';
        let userEmail = '';

        if (data.userId) {
          try {
            const userDoc = await db.collection('users').doc(data.userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              userName = userData.displayName || userData.name || '未知用戶';
              userEmail = userData.email || '';
            }
          } catch (error) {
            console.error('獲取用戶資訊失敗:', error);
          }
        }

        transactions.push({
          id: doc.id,
          ...data,
          userName,
          userEmail,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
        });
      }

      res.json({
        success: true,
        transactions,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: '獲取交易記錄失敗', message: error.message });
    }
  });

  // GET /api/transactions/stats
  router.get('/stats', async (req, res) => {
    try {
      const snapshot = await db.collection('transactions').where('status', '==', 'completed').get();

      const stats = {
        totalTransactions: snapshot.size,
        totalPurchased: 0,
        totalSpent: 0,
        totalRewarded: 0,
        totalRefunded: 0,
        byType: {},
        byStatus: {},
      };

      snapshot.docs.forEach((doc) => {
        const transaction = doc.data();
        const type = transaction.type;
        const status = transaction.status;
        const amount = transaction.amount || 0;

        if (!stats.byType[type]) {
          stats.byType[type] = { count: 0, totalAmount: 0 };
        }
        stats.byType[type].count++;
        stats.byType[type].totalAmount += amount;

        if (!stats.byStatus[status]) {
          stats.byStatus[status] = 0;
        }
        stats.byStatus[status]++;

        switch (type) {
          case 'purchase': stats.totalPurchased += amount; break;
          case 'spend': stats.totalSpent += Math.abs(amount); break;
          case 'reward': stats.totalRewarded += amount; break;
          case 'refund': stats.totalRefunded += amount; break;
        }
      });

      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ success: false, error: '獲取交易統計失敗' });
    }
  });

  // GET /api/transactions/:id
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const doc = await db.collection('transactions').doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, error: '交易記錄不存在' });
      }

      const data = doc.data();
      let userName = '未知用戶';
      let userEmail = '';

      if (data.userId) {
        try {
          const userDoc = await db.collection('users').doc(data.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userName = userData.displayName || userData.name || '未知用戶';
            userEmail = userData.email || '';
          }
        } catch (error) {
          console.error('獲取用戶資訊失敗:', error);
        }
      }

      res.json({
        success: true,
        transaction: {
          id: doc.id,
          ...data,
          userName,
          userEmail,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: '獲取交易詳情失敗' });
    }
  });

  app.use('/api/transactions', router);
}
