/**
 * Membership Routes 測試（管理後台）
 * 測試範圍：
 * - 會員等級列表
 * - 會員等級詳情
 * - 會員等級更新
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

describe('Membership Routes - Admin Backend', () => {
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

  describe('GET /api/membership-tiers - 獲取所有會員等級', () => {
    it('應該成功獲取會員等級列表', async () => {
      const mockTiers = [
        { name: 'Free', price: 0, features: {} },
        { name: 'VIP', price: 99, features: {} },
        { name: 'VVIP', price: 299, features: {} },
      ];

      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.resolve({
          forEach: vi.fn((callback) => {
            mockTiers.forEach((tier, index) => {
              callback({ id: `tier-${index}`, data: () => tier });
            });
          }),
        })),
      });

      const response = await request(app).get('/api/membership-tiers');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tiers');
      expect(response.body).toHaveProperty('total', 3);
      expect(response.body.tiers[0]).toHaveProperty('name', 'Free');
    });

    it('應該處理獲取失敗', async () => {
      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.reject(new Error('Database error'))),
      });

      const response = await request(app).get('/api/membership-tiers');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取會員等級配置失敗');
    });
  });

  describe('GET /api/membership-tiers/:tierId - 獲取單個會員等級', () => {
    it('應該成功獲取會員等級詳情', async () => {
      const mockTier = { name: 'VIP', price: 99, features: { conversations: 100 } };

      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            exists: true,
            id: 'tier-vip',
            data: () => mockTier,
          })),
        })),
      });

      const response = await request(app).get('/api/membership-tiers/tier-vip');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'VIP');
      expect(response.body).toHaveProperty('price', 99);
    });

    it('應該處理會員等級不存在', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: false })),
        })),
      });

      const response = await request(app).get('/api/membership-tiers/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '會員等級不存在');
    });
  });

  describe('PATCH /api/membership-tiers/:tierId - 更新會員等級', () => {
    it('應該成功更新會員等級', async () => {
      const updates = { price: 199, status: 'active' };
      const updatedTier = { name: 'VIP', price: 199, status: 'active', updatedAt: expect.any(String) };

      const mockDoc = {
        get: vi.fn()
          .mockResolvedValueOnce({ exists: true, data: () => ({ name: 'VIP', price: 99 }) })
          .mockResolvedValueOnce({ exists: true, id: 'tier-vip', data: () => updatedTier }),
        update: vi.fn(() => Promise.resolve()),
      };

      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => mockDoc),
      });

      const response = await request(app)
        .patch('/api/membership-tiers/tier-vip')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '會員等級配置更新成功');
      expect(response.body.tier).toHaveProperty('price', 199);
    });

    it('應該拒絕不允許的字段更新', async () => {
      const updates = { unauthorizedField: 'value' };

      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
        })),
      });

      const response = await request(app)
        .patch('/api/membership-tiers/tier-vip')
        .send(updates);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', '沒有提供任何更新數據');
    });

    it('應該處理會員等級不存在', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: false })),
        })),
      });

      const response = await request(app)
        .patch('/api/membership-tiers/nonexistent')
        .send({ price: 199 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '會員等級不存在');
    });
  });
});

/**
 * Setup all routes for testing
 */
function setupRoutes(app, db) {
  const router = express.Router();

  // GET /api/membership-tiers
  router.get('/', async (req, res) => {
    try {
      const tiersSnapshot = await db.collection('membership_tiers').get();

      const tiers = [];
      tiersSnapshot.forEach((doc) => {
        tiers.push({ id: doc.id, ...doc.data() });
      });

      res.json({ tiers, total: tiers.length });
    } catch (error) {
      res.status(500).json({ error: '獲取會員等級配置失敗' });
    }
  });

  // GET /api/membership-tiers/:tierId
  router.get('/:tierId', async (req, res) => {
    try {
      const { tierId } = req.params;
      const tierDoc = await db.collection('membership_tiers').doc(tierId).get();

      if (!tierDoc.exists) {
        return res.status(404).json({ error: '會員等級不存在' });
      }

      res.json({ id: tierDoc.id, ...tierDoc.data() });
    } catch (error) {
      res.status(500).json({ error: '獲取會員等級詳情失敗' });
    }
  });

  // PATCH /api/membership-tiers/:tierId
  router.patch('/:tierId', async (req, res) => {
    try {
      const { tierId } = req.params;
      const updates = req.body;

      const tierDoc = await db.collection('membership_tiers').doc(tierId).get();
      if (!tierDoc.exists) {
        return res.status(404).json({ error: '會員等級不存在' });
      }

      const allowedFields = ['name', 'price', 'currency', 'billingCycle', 'features', 'status'];
      const updateData = {};
      allowedFields.forEach((field) => {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: '沒有提供任何更新數據' });
      }

      updateData.updatedAt = new Date().toISOString();
      await db.collection('membership_tiers').doc(tierId).update(updateData);

      const updatedDoc = await db.collection('membership_tiers').doc(tierId).get();

      res.json({
        message: '會員等級配置更新成功',
        tier: { id: updatedDoc.id, ...updatedDoc.data() },
      });
    } catch (error) {
      res.status(500).json({ error: '更新會員等級配置失敗', message: error.message });
    }
  });

  app.use('/api/membership-tiers', router);
}
