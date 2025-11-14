/**
 * Dashboard Routes 測試（管理後台）
 * 測試範圍：
 * - 儀表板統計
 * - 用戶增長趨勢
 * - 對話活躍度趨勢
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

vi.mock('../utils/firestoreCache.js', () => ({
  getCached: vi.fn((key, fn) => fn()), // Execute function directly without caching
  CACHE_TTL: {
    DASHBOARD: 600000,
    TRENDS: 900000,
  },
}));

describe('Dashboard Routes - Admin Backend', () => {
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

  describe('GET /api/dashboard/stats - 獲取儀表板統計', () => {
    it('應該成功獲取儀表板統計', async () => {
      // Mock count queries
      mockDb.collection.mockImplementation((name) => {
        const mockChain = {
          count: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          get: vi.fn(() => {
            if (name === 'users') {
              return Promise.resolve({ data: () => ({ count: 1000 }) });
            } else if (name === 'conversations') {
              return Promise.resolve({ data: () => ({ count: 5000 }) });
            } else if (name === 'characters') {
              return Promise.resolve({ data: () => ({ count: 50 }) });
            } else if (name === 'transactions') {
              return Promise.resolve({
                forEach: vi.fn((callback) => {
                  callback({ data: () => ({ type: 'purchase', amount: 100, status: 'completed' }) });
                  callback({ data: () => ({ type: 'purchase', amount: 200, status: 'completed' }) });
                }),
              });
            }
          }),
        };
        return mockChain;
      });

      const response = await request(app).get('/api/dashboard/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalUsers', 1000);
      expect(response.body.stats).toHaveProperty('totalConversations', 5000);
      expect(response.body.stats).toHaveProperty('activeCharacters', 50);
      expect(response.body.stats).toHaveProperty('totalRevenue', 300);
    });

    it('應該處理獲取統計失敗', async () => {
      mockDb.collection.mockImplementation(() => ({
        count: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.reject(new Error('Database error'))),
      }));

      const response = await request(app).get('/api/dashboard/stats');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '獲取儀表板統計失敗');
    });
  });

  describe('GET /api/dashboard/user-trends - 獲取用戶增長趨勢', () => {
    it('應該成功獲取用戶增長趨勢', async () => {
      const mockUsers = [
        { data: () => ({ createdAt: { toDate: () => new Date('2025-01-01') } }) },
        { data: () => ({ createdAt: { toDate: () => new Date('2025-01-01') } }) },
        { data: () => ({ createdAt: { toDate: () => new Date('2025-01-02') } }) },
      ];

      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.resolve({
          forEach: vi.fn((callback) => mockUsers.forEach(callback)),
        })),
      });

      const response = await request(app).get('/api/dashboard/user-trends').query({ days: 7 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('trend');
      expect(response.body.trend).toHaveProperty('dates');
      expect(response.body.trend).toHaveProperty('values');
      expect(Array.isArray(response.body.trend.dates)).toBe(true);
      expect(Array.isArray(response.body.trend.values)).toBe(true);
    });

    it('應該使用默認天數 30', async () => {
      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.resolve({ forEach: vi.fn() })),
      });

      const response = await request(app).get('/api/dashboard/user-trends');

      expect(response.status).toBe(200);
      expect(response.body.trend.dates.length).toBe(30);
    });

    it('應該處理獲取趨勢失敗', async () => {
      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.reject(new Error('Database error'))),
      });

      const response = await request(app).get('/api/dashboard/user-trends');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '獲取用戶趨勢失敗');
    });
  });

  describe('GET /api/dashboard/conversation-trends - 獲取對話活躍度趨勢', () => {
    it('應該成功獲取對話活躍度趨勢', async () => {
      const mockConversations = [
        { data: () => ({ updatedAt: { toDate: () => new Date('2025-01-01') } }) },
        { data: () => ({ updatedAt: { toDate: () => new Date('2025-01-02') } }) },
        { data: () => ({ updatedAt: { toDate: () => new Date('2025-01-02') } }) },
      ];

      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.resolve({
          forEach: vi.fn((callback) => mockConversations.forEach(callback)),
        })),
      });

      const response = await request(app).get('/api/dashboard/conversation-trends').query({ days: 7 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('trend');
      expect(response.body.trend).toHaveProperty('dates');
      expect(response.body.trend).toHaveProperty('values');
      expect(Array.isArray(response.body.trend.dates)).toBe(true);
    });

    it('應該使用默認天數 30', async () => {
      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.resolve({ forEach: vi.fn() })),
      });

      const response = await request(app).get('/api/dashboard/conversation-trends');

      expect(response.status).toBe(200);
      expect(response.body.trend.dates.length).toBe(30);
    });

    it('應該處理獲取趨勢失敗', async () => {
      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.reject(new Error('Database error'))),
      });

      const response = await request(app).get('/api/dashboard/conversation-trends');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '獲取對話趨勢失敗');
    });
  });
});

/**
 * Setup all routes for testing
 */
function setupRoutes(app, db) {
  // GET /api/dashboard/stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const [usersCount, conversationsCount, charactersCount, transactionsSnapshot] =
        await Promise.all([
          db.collection('users').count().get(),
          db.collection('conversations').count().get(),
          db.collection('characters').where('status', '==', 'active').count().get(),
          db.collection('transactions').where('status', '==', 'completed').get(),
        ]);

      let totalRevenue = 0;
      transactionsSnapshot.forEach((doc) => {
        const transaction = doc.data();
        if (transaction.type === 'purchase' && transaction.amount > 0) {
          totalRevenue += Math.abs(transaction.amount);
        }
      });

      const stats = {
        totalUsers: usersCount.data().count,
        totalConversations: conversationsCount.data().count,
        activeCharacters: charactersCount.data().count,
        totalRevenue,
      };

      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '獲取儀表板統計失敗',
        message: error.message,
      });
    }
  });

  // GET /api/dashboard/user-trends
  app.get('/api/dashboard/user-trends', async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const usersSnapshot = await db
        .collection('users')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const trendData = {};
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        trendData[dateStr] = 0;
      }

      usersSnapshot.forEach((doc) => {
        const user = doc.data();
        if (user.createdAt) {
          let createdDate;
          if (user.createdAt.toDate) {
            createdDate = user.createdAt.toDate();
          } else {
            createdDate = new Date(user.createdAt);
          }

          const dateStr = createdDate.toISOString().split('T')[0];
          if (trendData[dateStr] !== undefined) {
            trendData[dateStr]++;
          }
        }
      });

      const dates = Object.keys(trendData).sort();
      const values = dates.map((date) => trendData[date]);

      res.json({
        success: true,
        trend: { dates, values },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '獲取用戶趨勢失敗',
        message: error.message,
      });
    }
  });

  // GET /api/dashboard/conversation-trends
  app.get('/api/dashboard/conversation-trends', async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const conversationsSnapshot = await db
        .collection('conversations')
        .where('updatedAt', '>=', startDate)
        .where('updatedAt', '<=', endDate)
        .get();

      const trendData = {};
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        trendData[dateStr] = 0;
      }

      conversationsSnapshot.forEach((doc) => {
        const conversation = doc.data();
        if (conversation.updatedAt) {
          let updatedDate;
          if (conversation.updatedAt.toDate) {
            updatedDate = conversation.updatedAt.toDate();
          } else {
            updatedDate = new Date(conversation.updatedAt);
          }

          const dateStr = updatedDate.toISOString().split('T')[0];
          if (trendData[dateStr] !== undefined) {
            trendData[dateStr]++;
          }
        }
      });

      const dates = Object.keys(trendData).sort();
      const values = dates.map((date) => trendData[date]);

      res.json({
        success: true,
        trend: { dates, values },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '獲取對話趨勢失敗',
        message: error.message,
      });
    }
  });
}
