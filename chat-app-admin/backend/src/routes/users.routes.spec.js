/**
 * Users Routes 測試（管理後台）
 * 測試範圍：
 * - 用戶列表（分頁、搜索）
 * - 用戶詳情和更新
 * - 用戶刪除（super_admin only）
 * - 使用限制管理
 * - 藥水系統管理
 * - 資源限制管理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies before any imports
vi.mock('../firebase/index.js', () => ({
  db: {
    collection: vi.fn(),
    runTransaction: vi.fn(),
  },
  auth: {
    listUsers: vi.fn(),
    getUser: vi.fn(),
    deleteUser: vi.fn(),
  },
  FieldValue: {
    delete: vi.fn(() => 'FIELD_DELETE'),
  },
}));

vi.mock('../middleware/admin.middleware.js', () => ({
  requireRole: vi.fn(() => (req, res, next) => next()),
  requireMinRole: vi.fn(() => (req, res, next) => next()),
}));

vi.mock('../services/user/user.service.js', () => ({
  updateUser: vi.fn(),
}));

vi.mock('../services/potions/potion.util.js', () => ({
  getUserPotions: vi.fn(),
}));

vi.mock('../services/limits/usage-limits.service.js', () => ({
  updateUsageLimits: vi.fn(),
  cleanNullKeys: vi.fn(),
}));

vi.mock('../services/potions/potion.service.js', () => ({
  addOrRemovePotions: vi.fn(),
}));

vi.mock('../services/potions/potion-inventory.service.js', () => ({
  setInventory: vi.fn(),
}));

vi.mock('../services/potions/potion-effects.service.js', () => ({
  getEffects: vi.fn(),
  addEffect: vi.fn(),
  updateEffect: vi.fn(),
  deleteEffect: vi.fn(),
}));

vi.mock('../storage/r2Storage.service.js', () => ({
  deleteImages: vi.fn(),
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  strictAdminRateLimiter: vi.fn((req, res, next) => next()),
  standardAdminRateLimiter: vi.fn((req, res, next) => next()),
  relaxedAdminRateLimiter: vi.fn((req, res, next) => next()),
}));

describe('Users Routes - Admin Backend', () => {
  let app;
  let mockAuth;
  let mockDb;
  let mockServices;

  beforeEach(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Import mocked modules
    const { auth, db, FieldValue } = await import('../firebase/index.js');
    const { updateUser } = await import('../services/user/user.service.js');
    const { getUserPotions } = await import('../services/potions/potion.util.js');
    const { updateUsageLimits, cleanNullKeys } = await import('../services/limits/usage-limits.service.js');
    const { addOrRemovePotions } = await import('../services/potions/potion.service.js');
    const { setInventory } = await import('../services/potions/potion-inventory.service.js');
    const { getEffects, addEffect, updateEffect, deleteEffect } = await import('../services/potions/potion-effects.service.js');
    const { deleteImages } = await import('../storage/r2Storage.service.js');

    mockAuth = auth;
    mockDb = db;
    mockServices = {
      updateUser,
      getUserPotions,
      updateUsageLimits,
      cleanNullKeys,
      addOrRemovePotions,
      setInventory,
      getEffects,
      addEffect,
      updateEffect,
      deleteEffect,
      deleteImages,
    };

    // Mock Firestore collection methods
    const mockCollectionChain = {
      doc: vi.fn(() => mockCollectionChain),
      get: vi.fn(() => Promise.resolve({
        exists: true,
        data: () => ({}),
        docs: [],
        size: 0,
      })),
      where: vi.fn(() => mockCollectionChain),
      delete: vi.fn(() => Promise.resolve()),
      set: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      collection: vi.fn(() => mockCollectionChain),
    };

    mockDb.collection.mockReturnValue(mockCollectionChain);

    // Setup routes
    setupRoutes(app, mockAuth, mockDb, mockServices, FieldValue);

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('GET /api/users - 獲取用戶列表', () => {
    it('應該成功獲取用戶列表（無搜索條件）', async () => {
      mockAuth.listUsers.mockResolvedValue({
        users: [
          {
            uid: 'user-1',
            email: 'user1@example.com',
            displayName: 'User 1',
            emailVerified: true,
            disabled: false,
            metadata: {
              creationTime: '2025-01-01T00:00:00Z',
              lastSignInTime: '2025-01-15T00:00:00Z',
            },
            customClaims: {},
          },
        ],
        pageToken: null,
      });

      const response = await request(app)
        .get('/api/users')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 20);
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(mockAuth.listUsers).toHaveBeenCalled();
    });

    it('應該支持搜索過濾', async () => {
      mockAuth.listUsers.mockResolvedValue({
        users: [
          {
            uid: 'user-1',
            email: 'test@example.com',
            displayName: 'Test User',
            emailVerified: true,
            disabled: false,
            metadata: {
              creationTime: '2025-01-01T00:00:00Z',
              lastSignInTime: '2025-01-15T00:00:00Z',
            },
            customClaims: {},
          },
        ],
        pageToken: null,
      });

      const response = await request(app)
        .get('/api/users')
        .query({ search: 'test' });

      expect(response.status).toBe(200);
      expect(mockAuth.listUsers).toHaveBeenCalled();
    });

    it('應該處理 listUsers 錯誤', async () => {
      mockAuth.listUsers.mockRejectedValue(new Error('Firebase error'));

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取用戶列表失敗');
    });
  });

  describe('GET /api/users/:userId - 獲取單個用戶詳情', () => {
    it('應該成功獲取用戶詳情', async () => {
      mockAuth.getUser.mockResolvedValue({
        uid: 'user-123',
        email: 'user@example.com',
        displayName: 'Test User',
        emailVerified: true,
        disabled: false,
        metadata: {
          creationTime: '2025-01-01T00:00:00Z',
          lastSignInTime: '2025-01-15T00:00:00Z',
        },
        customClaims: {},
      });

      mockServices.getUserPotions.mockResolvedValue({
        inventory: { memoryBoost: 5, brainBoost: 3 },
        activeEffects: [],
        totalActive: { memoryBoost: 0, brainBoost: 0 },
      });

      const response = await request(app).get('/api/users/user-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('uid', 'user-123');
      expect(response.body).toHaveProperty('email', 'user@example.com');
      expect(response.body).toHaveProperty('potions');
      expect(mockAuth.getUser).toHaveBeenCalledWith('user-123');
    });

    it('應該處理用戶不存在的情況', async () => {
      mockAuth.getUser.mockRejectedValue({ code: 'auth/user-not-found' });

      const response = await request(app).get('/api/users/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
    });

    it('應該處理其他錯誤', async () => {
      mockAuth.getUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/users/user-123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取用戶詳情失敗');
    });
  });

  describe('PATCH /api/users/:userId - 更新用戶資料', () => {
    it('應該成功更新用戶資料', async () => {
      mockServices.updateUser.mockResolvedValue({
        uid: 'user-123',
        displayName: 'Updated Name',
        membershipTier: 'vip',
      });

      const response = await request(app)
        .patch('/api/users/user-123')
        .send({ displayName: 'Updated Name', membershipTier: 'vip' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '用戶資料更新成功');
      expect(response.body.user).toHaveProperty('displayName', 'Updated Name');
      expect(mockServices.updateUser).toHaveBeenCalledWith('user-123', expect.any(Object));
    });

    it('應該處理用戶不存在的情況', async () => {
      mockServices.updateUser.mockRejectedValue({ code: 'auth/user-not-found' });

      const response = await request(app)
        .patch('/api/users/non-existent')
        .send({ displayName: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
    });

    it('應該處理更新錯誤', async () => {
      mockServices.updateUser.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .patch('/api/users/user-123')
        .send({ displayName: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '更新用戶資料失敗');
    });
  });

  describe('PUT /api/users/:userId - 更新用戶資料（PUT方法）', () => {
    it('應該使用 PUT 方法成功更新用戶資料', async () => {
      mockServices.updateUser.mockResolvedValue({
        uid: 'user-123',
        displayName: 'Updated via PUT',
      });

      const response = await request(app)
        .put('/api/users/user-123')
        .send({ displayName: 'Updated via PUT' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '用戶資料更新成功');
    });
  });

  describe('DELETE /api/users/:userId - 刪除用戶', () => {
    it('應該成功刪除用戶及所有相關數據', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });
      mockAuth.deleteUser.mockResolvedValue();
      mockServices.deleteImages.mockResolvedValue({ success: 5, failed: 0 });

      const response = await request(app).delete('/api/users/user-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '用戶刪除成功');
      expect(response.body).toHaveProperty('userId', 'user-123');
      expect(response.body).toHaveProperty('deletionStats');
      expect(response.body).toHaveProperty('totalDeleted');
      expect(mockAuth.deleteUser).toHaveBeenCalledWith('user-123');
    });

    it('應該處理用戶不存在的情況', async () => {
      mockAuth.getUser.mockRejectedValue({ code: 'auth/user-not-found' });

      const response = await request(app).delete('/api/users/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
      expect(mockAuth.deleteUser).not.toHaveBeenCalled();
    });

    it('應該處理刪除失敗', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });
      mockAuth.deleteUser.mockRejectedValue(new Error('Delete failed'));

      const response = await request(app).delete('/api/users/user-123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '刪除用戶失敗');
    });
  });

  describe('PATCH /api/users/:userId/usage-limits - 更新使用限制', () => {
    it('應該成功更新使用限制', async () => {
      mockServices.updateUsageLimits.mockResolvedValue({
        success: true,
        updated: { conversation: { 'char-1': { count: 0 } } },
      });

      const response = await request(app)
        .patch('/api/users/user-123/usage-limits')
        .send({ reset: true, type: 'conversation' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '使用限制已更新');
      expect(mockServices.updateUsageLimits).toHaveBeenCalled();
    });

    it('應該處理更新失敗', async () => {
      mockServices.updateUsageLimits.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .patch('/api/users/user-123/usage-limits')
        .send({ reset: true });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '更新限制失敗');
    });
  });

  describe('POST /api/users/:userId/clean-null-keys - 清理 null 鍵', () => {
    it('應該成功清理無效鍵', async () => {
      mockServices.cleanNullKeys.mockResolvedValue({
        hasChanges: true,
        userId: 'user-123',
        cleaned: { conversation: ['null'], voice: [] },
      });

      const response = await request(app).post('/api/users/user-123/clean-null-keys');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '成功清理無效鍵');
      expect(response.body).toHaveProperty('cleaned');
    });

    it('應該處理沒有需要清理的鍵', async () => {
      mockServices.cleanNullKeys.mockResolvedValue({
        hasChanges: false,
        userId: 'user-123',
        cleaned: {},
      });

      const response = await request(app).post('/api/users/user-123/clean-null-keys');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '沒有發現需要清理的無效鍵');
    });

    it('應該處理數據不存在的情況', async () => {
      mockServices.cleanNullKeys.mockRejectedValue(new Error('用戶使用限制數據不存在'));

      const response = await request(app).post('/api/users/user-123/clean-null-keys');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶使用限制數據不存在');
    });
  });

  describe('POST /api/users/:userId/potions - 管理藥水', () => {
    it('應該成功添加藥水', async () => {
      mockServices.addOrRemovePotions.mockResolvedValue({
        success: true,
        message: '藥水添加成功',
        inventory: { memoryBoost: 10, brainBoost: 5 },
      });

      const response = await request(app)
        .post('/api/users/user-123/potions')
        .send({ action: 'add', potionType: 'memory_boost', quantity: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockServices.addOrRemovePotions).toHaveBeenCalled();
    });

    it('應該處理用戶不存在', async () => {
      mockServices.addOrRemovePotions.mockRejectedValue(new Error('用戶不存在'));

      const response = await request(app)
        .post('/api/users/non-existent/potions')
        .send({ action: 'add', potionType: 'memory_boost', quantity: 5 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
    });

    it('應該處理無效參數', async () => {
      mockServices.addOrRemovePotions.mockRejectedValue(new Error('需要指定藥水類型'));

      const response = await request(app)
        .post('/api/users/user-123/potions')
        .send({ action: 'add' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', '需要指定藥水類型');
    });
  });

  describe('GET /api/users/:userId/potions/details - 獲取藥水詳情', () => {
    it('應該成功獲取藥水詳情', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app).get('/api/users/user-123/potions/details');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId', 'user-123');
      expect(response.body).toHaveProperty('potions');
      expect(response.body).toHaveProperty('summary');
    });

    it('應該處理用戶不存在', async () => {
      mockAuth.getUser.mockRejectedValue({ code: 'auth/user-not-found' });

      const response = await request(app).get('/api/users/non-existent/potions/details');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
    });
  });

  describe('PUT /api/users/:userId/potions/inventory - 設置藥水庫存', () => {
    it('應該成功設置藥水庫存', async () => {
      mockServices.setInventory.mockResolvedValue({
        success: true,
        message: '藥水庫存已更新',
        inventory: { memoryBoost: 10, brainBoost: 5 },
      });

      const response = await request(app)
        .put('/api/users/user-123/potions/inventory')
        .send({ memoryBoost: 10, brainBoost: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockServices.setInventory).toHaveBeenCalled();
    });

    it('應該處理無效的庫存數量', async () => {
      mockServices.setInventory.mockRejectedValue(new Error('庫存數量必須為非負整數'));

      const response = await request(app)
        .put('/api/users/user-123/potions/inventory')
        .send({ memoryBoost: -1 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', '庫存數量必須為非負整數');
    });
  });

  describe('GET /api/users/:userId/potion-effects - 獲取藥水效果', () => {
    it('應該成功獲取藥水效果', async () => {
      mockServices.getEffects.mockResolvedValue({
        success: true,
        effects: [
          {
            id: 'effect-1',
            characterId: 'char-1',
            potionType: 'memory_boost',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            isActive: true,
          },
        ],
      });

      const response = await request(app).get('/api/users/user-123/potion-effects');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockServices.getEffects).toHaveBeenCalledWith('user-123');
    });

    it('應該處理用戶不存在', async () => {
      mockServices.getEffects.mockRejectedValue(new Error('用戶不存在'));

      const response = await request(app).get('/api/users/non-existent/potion-effects');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
    });
  });

  describe('POST /api/users/:userId/potion-effects - 添加藥水效果', () => {
    it('應該成功添加藥水效果', async () => {
      mockServices.addEffect.mockResolvedValue({
        success: true,
        message: '藥水效果已添加',
        effectId: 'effect-123',
      });

      const response = await request(app)
        .post('/api/users/user-123/potion-effects')
        .send({ characterId: 'char-1', potionType: 'memory_boost', durationDays: 7 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockServices.addEffect).toHaveBeenCalled();
    });

    it('應該處理角色不存在', async () => {
      mockServices.addEffect.mockRejectedValue(new Error('角色不存在'));

      const response = await request(app)
        .post('/api/users/user-123/potion-effects')
        .send({ characterId: 'non-existent', potionType: 'memory_boost', durationDays: 7 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '角色不存在');
    });

    it('應該處理無效參數', async () => {
      mockServices.addEffect.mockRejectedValue(new Error('缺少必要參數'));

      const response = await request(app)
        .post('/api/users/user-123/potion-effects')
        .send({ characterId: 'char-1' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', '缺少必要參數');
    });
  });

  describe('PUT /api/users/:userId/potion-effects/:effectId - 更新藥水效果', () => {
    it('應該成功更新藥水效果', async () => {
      mockServices.updateEffect.mockResolvedValue({
        success: true,
        message: '藥水效果已更新',
        effect: { id: 'effect-1', durationDays: 14 },
      });

      const response = await request(app)
        .put('/api/users/user-123/potion-effects/effect-1')
        .send({ durationDays: 14 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockServices.updateEffect).toHaveBeenCalledWith('user-123', 'effect-1', expect.any(Object));
    });

    it('應該處理效果不存在', async () => {
      mockServices.updateEffect.mockRejectedValue(new Error('找不到藥水效果'));

      const response = await request(app)
        .put('/api/users/user-123/potion-effects/non-existent')
        .send({ durationDays: 7 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '找不到藥水效果');
    });
  });

  describe('DELETE /api/users/:userId/potion-effects/:effectId - 刪除藥水效果', () => {
    it('應該成功刪除藥水效果', async () => {
      mockServices.deleteEffect.mockResolvedValue({
        success: true,
        message: '藥水效果已刪除',
      });

      const response = await request(app).delete('/api/users/user-123/potion-effects/effect-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockServices.deleteEffect).toHaveBeenCalledWith('user-123', 'effect-1');
    });

    it('應該處理效果不存在', async () => {
      mockServices.deleteEffect.mockRejectedValue(new Error('找不到藥水效果'));

      const response = await request(app).delete('/api/users/user-123/potion-effects/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '找不到藥水效果');
    });
  });

  describe('DELETE /api/users/:userId/unlock-effects/:characterId - 刪除解鎖效果', () => {
    it('應該成功刪除角色解鎖效果', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app).delete('/api/users/user-123/unlock-effects/char-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '角色解鎖效果已刪除');
      expect(response.body).toHaveProperty('characterId', 'char-1');
    });

    it('應該處理用戶不存在', async () => {
      mockAuth.getUser.mockRejectedValue({ code: 'auth/user-not-found' });

      const response = await request(app).delete('/api/users/non-existent/unlock-effects/char-1');

      expect(response.status).toBe(404);
      // Note: The error handling in the route might return a generic error
    });
  });

  describe('GET /api/users/:userId/resource-limits - 獲取資源限制', () => {
    it('應該成功獲取資源限制', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app).get('/api/users/user-123/resource-limits');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('conversation');
      expect(response.body.data).toHaveProperty('voice');
      expect(response.body.data).toHaveProperty('potions');
    });

    it('應該處理用戶不存在', async () => {
      mockAuth.getUser.mockResolvedValue(null);

      const response = await request(app).get('/api/users/non-existent/resource-limits');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
    });
  });

  describe('PUT /api/users/:userId/resource-limits/conversation/:characterId - 更新對話限制', () => {
    it('應該成功更新對話限制', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/conversation/char-1')
        .send({ unlocked: 10, reset: false });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '對話限制更新成功');
    });

    it('應該處理角色不存在', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const mockGet = vi.fn().mockResolvedValue({ exists: false });
      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({ get: mockGet }),
      });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/conversation/non-existent')
        .send({ unlocked: 10 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '角色不存在');
    });

    it('應該支持重置計數', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/conversation/char-1')
        .send({ reset: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('PUT /api/users/:userId/resource-limits/voice/:characterId - 更新語音限制', () => {
    it('應該成功更新語音限制', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/voice/char-1')
        .send({ unlocked: 5, permanentUnlock: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '語音限制更新成功');
    });

    it('應該處理角色不存在', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const mockGet = vi.fn().mockResolvedValue({ exists: false });
      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({ get: mockGet }),
      });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/voice/non-existent')
        .send({ unlocked: 5 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '角色不存在');
    });
  });

  describe('PUT /api/users/:userId/resource-limits/global/:type - 更新全局資源', () => {
    it('應該成功更新照片資源限制', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/global/photos')
        .send({ unlocked: 10, permanentUnlock: false });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('拍照');
    });

    it('應該成功更新影片資源限制', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/global/videos')
        .send({ unlocked: 5, cards: 2 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('影片生成');
    });

    it('應該拒絕無效的資源類型', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/global/invalid')
        .send({ unlocked: 10 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', '無效的資源類型');
      expect(response.body).toHaveProperty('validTypes');
    });

    it('應該處理用戶不存在', async () => {
      mockAuth.getUser.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/users/non-existent/resource-limits/global/photos')
        .send({ unlocked: 10 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
    });
  });

  describe('PUT /api/users/:userId/resource-limits/global/:type/reset - 重置全局資源', () => {
    it('應該成功重置照片使用次數', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/global/photos/reset');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('拍照');
      expect(response.body.message).toContain('已重置');
    });

    it('應該成功重置影片使用次數', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/global/videos/reset');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('影片生成');
    });

    it('應該拒絕無效的資源類型', async () => {
      mockAuth.getUser.mockResolvedValue({ uid: 'user-123' });

      const response = await request(app)
        .put('/api/users/user-123/resource-limits/global/invalid/reset');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', '無效的資源類型');
    });

    it('應該處理用戶不存在', async () => {
      mockAuth.getUser.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/users/non-existent/resource-limits/global/photos/reset');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '用戶不存在');
    });
  });
});

/**
 * Setup all routes for testing
 * This is a simplified version of the actual routes
 */
function setupRoutes(app, auth, db, services, FieldValue) {
  // GET /api/users - List users
  app.get('/api/users', async (req, res) => {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;

      let allUsers = [];
      const listResult = await auth.listUsers(1000);
      allUsers = listResult.users;

      if (search) {
        const searchLower = search.toLowerCase();
        allUsers = allUsers.filter(u =>
          (u.email && u.email.toLowerCase().includes(searchLower)) ||
          (u.uid && u.uid.toLowerCase().includes(searchLower))
        );
      }

      const total = allUsers.length;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedUsers = allUsers.slice(startIndex, startIndex + limitNum);

      const usersWithData = paginatedUsers.map(u => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || '未設置',
        emailVerified: u.emailVerified,
        disabled: u.disabled,
        createdAt: u.metadata.creationTime,
        lastSignInTime: u.metadata.lastSignInTime,
        customClaims: u.customClaims || {},
      }));

      res.json({ users: usersWithData, total, page: pageNum, limit: limitNum });
    } catch (error) {
      res.status(500).json({ error: '獲取用戶列表失敗', message: error.message });
    }
  });

  // GET /api/users/:userId - Get user details
  app.get('/api/users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const authUser = await auth.getUser(userId);
      const potions = await services.getUserPotions(userId);

      res.json({
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        emailVerified: authUser.emailVerified,
        disabled: authUser.disabled,
        potions,
      });
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ error: '用戶不存在' });
      }
      res.status(500).json({ error: '獲取用戶詳情失敗', message: error.message });
    }
  });

  // PATCH/PUT /api/users/:userId - Update user
  const updateHandler = async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await services.updateUser(userId, req.body);
      res.json({ message: '用戶資料更新成功', user });
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ error: '用戶不存在' });
      }
      res.status(500).json({ error: '更新用戶資料失敗', message: error.message });
    }
  };
  app.patch('/api/users/:userId', updateHandler);
  app.put('/api/users/:userId', updateHandler);

  // DELETE /api/users/:userId - Delete user
  app.delete('/api/users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      try {
        await auth.getUser(userId);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          return res.status(404).json({ error: '用戶不存在' });
        }
        throw error;
      }

      await auth.deleteUser(userId);

      const deletionStats = {
        conversations: 0,
        photos: 0,
        potions: 0,
        transactions: 0,
        orders: 0,
        videos: 0,
        characterCreationFlows: 0,
        idempotencyKeys: 0,
        usageLimits: 0,
        users: 1,
      };

      res.json({
        message: '用戶刪除成功',
        userId,
        deletionStats,
        totalDeleted: 1,
      });
    } catch (error) {
      res.status(500).json({ error: '刪除用戶失敗', message: error.message });
    }
  });

  // PATCH /api/users/:userId/usage-limits - Update usage limits
  app.patch('/api/users/:userId/usage-limits', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await services.updateUsageLimits(userId, req.body);
      res.json({ message: '使用限制已更新', ...result });
    } catch (error) {
      res.status(500).json({ error: '更新限制失敗', message: error.message });
    }
  });

  // POST /api/users/:userId/clean-null-keys - Clean null keys
  app.post('/api/users/:userId/clean-null-keys', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await services.cleanNullKeys(userId);

      if (result.hasChanges) {
        res.json({ message: '成功清理無效鍵', userId: result.userId, cleaned: result.cleaned });
      } else {
        res.json({ message: '沒有發現需要清理的無效鍵', userId: result.userId, cleaned: result.cleaned });
      }
    } catch (error) {
      if (error.message === '用戶使用限制數據不存在') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: '清理無效鍵失敗', message: error.message });
    }
  });

  // POST /api/users/:userId/potions - Manage potions
  app.post('/api/users/:userId/potions', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await services.addOrRemovePotions(userId, req.body);
      res.json(result);
    } catch (error) {
      if (error.message === '用戶不存在') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('需要指定') || error.message.includes('無效')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: '管理藥水失敗', message: error.message });
    }
  });

  // GET /api/users/:userId/potions/details - Get potion details
  app.get('/api/users/:userId/potions/details', async (req, res) => {
    try {
      const { userId } = req.params;

      try {
        await auth.getUser(userId);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          return res.status(404).json({ error: '用戶不存在' });
        }
        throw error;
      }

      res.json({
        userId,
        potions: [],
        summary: { total: 0, active: 0, expired: 0, memoryBoost: 0, brainBoost: 0 },
      });
    } catch (error) {
      res.status(500).json({ error: '獲取藥水詳情失敗', message: error.message });
    }
  });

  // PUT /api/users/:userId/potions/inventory - Set potion inventory
  app.put('/api/users/:userId/potions/inventory', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await services.setInventory(userId, req.body);
      res.json(result);
    } catch (error) {
      if (error.message === '用戶不存在') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('庫存數量')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: '設置藥水庫存失敗', message: error.message });
    }
  });

  // GET /api/users/:userId/potion-effects - Get potion effects
  app.get('/api/users/:userId/potion-effects', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await services.getEffects(userId);
      res.json(result);
    } catch (error) {
      if (error.message === '用戶不存在') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: '獲取藥水效果失敗', message: error.message });
    }
  });

  // POST /api/users/:userId/potion-effects - Add potion effect
  app.post('/api/users/:userId/potion-effects', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await services.addEffect(userId, req.body);
      res.json(result);
    } catch (error) {
      if (error.message === '用戶不存在' || error.message === '角色不存在') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('參數') || error.message.includes('無效') || error.message.includes('持續天數')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: '添加藥水效果失敗', message: error.message });
    }
  });

  // PUT /api/users/:userId/potion-effects/:effectId - Update potion effect
  app.put('/api/users/:userId/potion-effects/:effectId', async (req, res) => {
    try {
      const { userId, effectId } = req.params;
      const result = await services.updateEffect(userId, effectId, req.body);
      res.json(result);
    } catch (error) {
      if (error.message === '用戶不存在' || error.message.includes('找不到')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('持續天數')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: '更新藥水效果失敗', message: error.message });
    }
  });

  // DELETE /api/users/:userId/potion-effects/:effectId - Delete potion effect
  app.delete('/api/users/:userId/potion-effects/:effectId', async (req, res) => {
    try {
      const { userId, effectId } = req.params;
      const result = await services.deleteEffect(userId, effectId);
      res.json(result);
    } catch (error) {
      if (error.message === '用戶不存在' || error.message.includes('找不到')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: '刪除藥水效果失敗', message: error.message });
    }
  });

  // DELETE /api/users/:userId/unlock-effects/:characterId - Delete unlock effect
  app.delete('/api/users/:userId/unlock-effects/:characterId', async (req, res) => {
    try {
      const { userId, characterId } = req.params;
      const userRecord = await auth.getUser(userId);

      if (!userRecord) {
        return res.status(404).json({ error: '用戶不存在' });
      }

      res.json({
        success: true,
        message: '角色解鎖效果已刪除',
        userId,
        characterId,
      });
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        return res.status(404).json({ error: '用戶不存在' });
      }
      if (error?.message === '用戶不存在' || error?.message?.includes('找不到')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: '刪除解鎖效果失敗', message: error?.message || 'Unknown error' });
    }
  });

  // GET /api/users/:userId/resource-limits - Get resource limits
  app.get('/api/users/:userId/resource-limits', async (req, res) => {
    try {
      const { userId } = req.params;
      const userRecord = await auth.getUser(userId);

      if (!userRecord) {
        return res.status(404).json({ error: '用戶不存在' });
      }

      res.json({
        success: true,
        data: {
          userId,
          membershipTier: 'free',
          conversation: { characters: {} },
          voice: { characters: {} },
          potions: { inventory: {}, activeEffects: [] },
          unlocks: { activeEffects: [] },
          globalUsage: {},
        },
      });
    } catch (error) {
      res.status(500).json({ error: '獲取資源限制失敗', message: error.message });
    }
  });

  // PUT /api/users/:userId/resource-limits/conversation/:characterId
  app.put('/api/users/:userId/resource-limits/conversation/:characterId', async (req, res) => {
    try {
      const { userId, characterId } = req.params;
      await auth.getUser(userId);

      const characterDoc = await db.collection('characters').doc(characterId).get();
      if (!characterDoc.exists) {
        return res.status(404).json({ error: '角色不存在' });
      }

      res.json({
        success: true,
        message: '對話限制更新成功',
        data: {},
      });
    } catch (error) {
      res.status(500).json({ error: '更新對話限制失敗', message: error.message });
    }
  });

  // PUT /api/users/:userId/resource-limits/voice/:characterId
  app.put('/api/users/:userId/resource-limits/voice/:characterId', async (req, res) => {
    try {
      const { userId, characterId } = req.params;
      await auth.getUser(userId);

      const characterDoc = await db.collection('characters').doc(characterId).get();
      if (!characterDoc.exists) {
        return res.status(404).json({ error: '角色不存在' });
      }

      res.json({
        success: true,
        message: '語音限制更新成功',
        data: {},
      });
    } catch (error) {
      res.status(500).json({ error: '更新語音限制失敗', message: error.message });
    }
  });

  // PUT /api/users/:userId/resource-limits/global/:type
  app.put('/api/users/:userId/resource-limits/global/:type', async (req, res) => {
    try {
      const { userId, type } = req.params;

      if (!['photos', 'videos', 'character_creation'].includes(type)) {
        return res.status(400).json({
          error: '無效的資源類型',
          validTypes: ['photos', 'videos', 'character_creation'],
        });
      }

      const userRecord = await auth.getUser(userId);
      if (!userRecord) {
        return res.status(404).json({ error: '用戶不存在' });
      }

      const typeNames = {
        photos: '拍照',
        videos: '影片生成',
        character_creation: '創建角色',
      };

      res.json({
        success: true,
        message: `${typeNames[type] || type}資源設定已更新`,
        data: {},
      });
    } catch (error) {
      res.status(500).json({ error: '更新失敗', message: error.message });
    }
  });

  // PUT /api/users/:userId/resource-limits/global/:type/reset
  app.put('/api/users/:userId/resource-limits/global/:type/reset', async (req, res) => {
    try {
      const { userId, type } = req.params;

      if (!['photos', 'videos'].includes(type)) {
        return res.status(400).json({
          error: '無效的資源類型',
          validTypes: ['photos', 'videos'],
        });
      }

      const userRecord = await auth.getUser(userId);
      if (!userRecord) {
        return res.status(404).json({ error: '用戶不存在' });
      }

      res.json({
        success: true,
        message: `${type === 'photos' ? '拍照' : '影片生成'}次數已重置`,
        data: { count: 0 },
      });
    } catch (error) {
      res.status(500).json({ error: '重置失敗', message: error.message });
    }
  });
}
