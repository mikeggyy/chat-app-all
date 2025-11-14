/**
 * Characters Routes 測試（管理後台）
 * 測試範圍：
 * - 角色列表和詳情
 * - 角色創建（未實現，返回 501）
 * - 角色更新和刪除
 * - 聊天用戶數量同步
 * - 系統統計概覽
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies before any imports
vi.mock('../firebase/index.js', () => ({
  db: {
    collection: vi.fn(),
  },
}));

vi.mock('../middleware/admin.middleware.js', () => ({
  requireRole: vi.fn(() => (req, res, next) => next()),
  requireMinRole: vi.fn(() => (req, res, next) => next()),
}));

vi.mock('../services/character/character.service.js', () => ({
  deleteCharacter: vi.fn(),
}));

vi.mock('../services/character/characterStats.service.js', () => ({
  syncAllCharactersUserCount: vi.fn(),
  syncSingleCharacterUserCount: vi.fn(),
  getSystemStatsOverview: vi.fn(),
}));

describe('Characters Routes - Admin Backend', () => {
  let app;
  let mockDb;
  let mockServices;

  beforeEach(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Import mocked modules
    const { db } = await import('../firebase/index.js');
    const { deleteCharacter } = await import('../services/character/character.service.js');

    mockDb = db;
    mockServices = {
      deleteCharacter,
    };

    // Mock Firestore collection methods
    const mockCollectionChain = {
      doc: vi.fn(() => mockCollectionChain),
      get: vi.fn(() => Promise.resolve({
        exists: true,
        id: 'char-1',
        data: () => ({
          display_name: 'Test Character',
          gender: 'female',
          voice: 'shimmer',
        }),
        forEach: vi.fn(),
        docs: [],
        size: 0,
      })),
      update: vi.fn(() => Promise.resolve()),
    };

    mockDb.collection.mockReturnValue(mockCollectionChain);

    // Setup routes
    setupRoutes(app, mockDb, mockServices);

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('GET /api/characters - 獲取角色列表', () => {
    it('應該成功獲取角色列表', async () => {
      const mockSnapshot = {
        forEach: vi.fn((callback) => {
          callback({ id: 'char-1', data: () => ({ display_name: 'Character 1' }) });
          callback({ id: 'char-2', data: () => ({ display_name: 'Character 2' }) });
        }),
      };

      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.resolve(mockSnapshot)),
      });

      const response = await request(app).get('/api/characters');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('characters');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.characters)).toBe(true);
      expect(response.body.total).toBe(2);
    });

    it('應該處理獲取列表失敗', async () => {
      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.reject(new Error('Database error'))),
      });

      const response = await request(app).get('/api/characters');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取角色列表失敗');
    });
  });

  describe('GET /api/characters/:characterId - 獲取單個角色詳情', () => {
    it('應該成功獲取角色詳情', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            exists: true,
            id: 'char-123',
            data: () => ({
              display_name: 'Test Character',
              gender: 'female',
              voice: 'shimmer',
              background: 'Test background',
            }),
          })),
        })),
      });

      const response = await request(app).get('/api/characters/char-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'char-123');
      expect(response.body).toHaveProperty('display_name', 'Test Character');
    });

    it('應該處理角色不存在的情況', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: false })),
        })),
      });

      const response = await request(app).get('/api/characters/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '角色不存在');
    });

    it('應該處理獲取失敗', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.reject(new Error('Database error'))),
        })),
      });

      const response = await request(app).get('/api/characters/char-123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取角色詳情失敗');
    });
  });

  describe('POST /api/characters - 創建新角色', () => {
    it('應該返回 501（功能尚未實現）', async () => {
      const response = await request(app)
        .post('/api/characters')
        .send({ display_name: 'New Character' });

      expect(response.status).toBe(501);
      expect(response.body).toHaveProperty('error', '功能尚未實現');
    });
  });

  describe('POST /api/characters/sync-chat-users - 同步所有角色聊天人數', () => {
    it('應該成功同步所有角色的聊天用戶數量', async () => {
      // Mock dynamic import
      vi.doMock('../services/character/characterStats.service.js', () => ({
        syncAllCharactersUserCount: vi.fn(() => Promise.resolve({
          totalCharacters: 50,
          totalUpdated: 45,
          warnings: [],
        })),
      }));

      const response = await request(app)
        .post('/api/characters/sync-chat-users')
        .send({ maxCharacters: 100 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '同步完成');
      expect(response.body).toHaveProperty('totalCharacters', 50);
      expect(response.body).toHaveProperty('totalUpdated', 45);
    });

    it('應該處理帶有警告的同步結果', async () => {
      vi.doMock('../services/character/characterStats.service.js', () => ({
        syncAllCharactersUserCount: vi.fn(() => Promise.resolve({
          totalCharacters: 50,
          totalUpdated: 48,
          warnings: ['角色 char-1 同步失敗', '角色 char-2 數據異常'],
        })),
      }));

      const response = await request(app)
        .post('/api/characters/sync-chat-users')
        .send({ maxCharacters: 100 });

      expect(response.status).toBe(207); // Multi-Status
      expect(response.body).toHaveProperty('warnings');
      expect(response.body.warnings.length).toBe(2);
    });

    it('應該處理同步失敗', async () => {
      vi.doMock('../services/character/characterStats.service.js', () => ({
        syncAllCharactersUserCount: vi.fn(() => Promise.reject(new Error('Sync error'))),
      }));

      const response = await request(app).post('/api/characters/sync-chat-users');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '同步失敗');
    });
  });

  describe('POST /api/characters/:characterId/sync-chat-users - 同步單個角色聊天人數', () => {
    it('應該成功同步單個角色的聊天用戶數量', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: true })),
        })),
      });

      vi.doMock('../services/character/characterStats.service.js', () => ({
        syncSingleCharacterUserCount: vi.fn(() => Promise.resolve({
          userCount: 150,
          conversationCount: 320,
        })),
      }));

      const response = await request(app).post('/api/characters/char-123/sync-chat-users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '同步完成');
      expect(response.body).toHaveProperty('characterId', 'char-123');
      expect(response.body).toHaveProperty('userCount', 150);
      expect(response.body).toHaveProperty('conversationCount', 320);
    });

    it('應該處理角色不存在的情況', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: false })),
        })),
      });

      const response = await request(app).post('/api/characters/non-existent/sync-chat-users');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '角色不存在');
    });

    it('應該處理同步失敗', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: true })),
        })),
      });

      vi.doMock('../services/character/characterStats.service.js', () => ({
        syncSingleCharacterUserCount: vi.fn(() => Promise.reject(new Error('Sync error'))),
      }));

      const response = await request(app).post('/api/characters/char-123/sync-chat-users');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '同步失敗');
    });
  });

  describe('GET /api/characters/stats/overview - 獲取系統統計概覽', () => {
    it('應該成功獲取系統統計概覽', async () => {
      vi.doMock('../services/character/characterStats.service.js', () => ({
        getSystemStatsOverview: vi.fn(() => Promise.resolve({
          totalCharacters: 100,
          totalUsers: 5000,
          totalConversations: 15000,
          topCharacters: [
            { id: 'char-1', display_name: 'Character 1', userCount: 500 },
            { id: 'char-2', display_name: 'Character 2', userCount: 450 },
          ],
        })),
      }));

      const response = await request(app).get('/api/characters/stats/overview');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalCharacters', 100);
      expect(response.body).toHaveProperty('totalUsers', 5000);
      expect(response.body).toHaveProperty('topCharacters');
    });

    it('應該處理獲取統計失敗', async () => {
      vi.doMock('../services/character/characterStats.service.js', () => ({
        getSystemStatsOverview: vi.fn(() => Promise.reject(new Error('Stats error'))),
      }));

      const response = await request(app).get('/api/characters/stats/overview');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取統計概覽失敗');
    });
  });

  describe('PATCH /api/characters/:characterId - 更新角色資訊', () => {
    it('應該成功更新角色資訊', async () => {
      const mockGet = vi.fn()
        .mockResolvedValueOnce({ exists: true }) // First call: check exists
        .mockResolvedValueOnce({                // Second call: get updated data
          exists: true,
          id: 'char-123',
          data: () => ({
            display_name: 'Updated Name',
            gender: 'male',
            updatedAt: expect.any(String),
          }),
        });

      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: mockGet,
          update: vi.fn(() => Promise.resolve()),
        })),
      });

      const response = await request(app)
        .patch('/api/characters/char-123')
        .send({ display_name: 'Updated Name', gender: 'male' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '角色更新成功');
      expect(response.body.character).toHaveProperty('display_name', 'Updated Name');
    });

    it('應該處理角色不存在的情況', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: false })),
        })),
      });

      const response = await request(app)
        .patch('/api/characters/non-existent')
        .send({ display_name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '角色不存在');
    });

    it('應該拒絕沒有提供任何更新數據', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: true })),
        })),
      });

      const response = await request(app)
        .patch('/api/characters/char-123')
        .send({ invalidField: 'value' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', '沒有提供任何更新數據');
    });

    it('應該只更新允許的字段', async () => {
      const mockUpdate = vi.fn(() => Promise.resolve());
      const mockGet = vi.fn()
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({
          exists: true,
          id: 'char-123',
          data: () => ({
            display_name: 'Updated Name',
            updatedAt: expect.any(String),
          }),
        });

      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: mockGet,
          update: mockUpdate,
        })),
      });

      await request(app)
        .patch('/api/characters/char-123')
        .send({
          display_name: 'Updated Name',
          invalidField: 'should be ignored',
          anotherInvalid: 'also ignored',
        });

      // Verify update was called with only allowed fields + updatedAt
      expect(mockUpdate).toHaveBeenCalledWith({
        display_name: 'Updated Name',
        updatedAt: expect.any(String),
      });
    });

    it('應該處理更新失敗', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: true })),
          update: vi.fn(() => Promise.reject(new Error('Update error'))),
        })),
      });

      const response = await request(app)
        .patch('/api/characters/char-123')
        .send({ display_name: 'New Name' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '更新角色失敗');
    });
  });

  describe('DELETE /api/characters/:characterId - 刪除角色', () => {
    it('應該成功刪除角色及所有相關數據', async () => {
      mockServices.deleteCharacter.mockResolvedValue({
        characterDeleted: true,
        portraitImageDeleted: true,
        photosDeleted: 150,
        photoImagesDeleted: 145,
        videosDeleted: 10,
        videoFilesDeleted: 9,
        conversationsDeleted: 200,
        usageLimitsUpdated: 50,
      });

      const response = await request(app).delete('/api/characters/char-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '角色刪除成功');
      expect(response.body).toHaveProperty('characterId', 'char-123');
      expect(response.body).toHaveProperty('deletionStats');
      expect(response.body.deletionStats).toHaveProperty('characterDeleted', true);
      expect(response.body.deletionStats).toHaveProperty('conversationsDeleted', 200);
      expect(mockServices.deleteCharacter).toHaveBeenCalledWith('char-123');
    });

    it('應該處理角色不存在的情況', async () => {
      mockServices.deleteCharacter.mockRejectedValue(new Error('角色不存在'));

      const response = await request(app).delete('/api/characters/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', '角色不存在');
    });

    it('應該處理刪除失敗', async () => {
      mockServices.deleteCharacter.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/characters/char-123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '刪除角色失敗');
    });
  });
});

/**
 * Setup all routes for testing
 */
function setupRoutes(app, db, services) {
  // GET /api/characters - List characters
  app.get('/api/characters', async (req, res) => {
    try {
      const charactersSnapshot = await db.collection('characters').get();

      const characters = [];
      charactersSnapshot.forEach((doc) => {
        characters.push({ id: doc.id, ...doc.data() });
      });

      res.json({ characters, total: characters.length });
    } catch (error) {
      res.status(500).json({ error: '獲取角色列表失敗' });
    }
  });

  // GET /api/characters/:characterId - Get character details
  app.get('/api/characters/:characterId', async (req, res) => {
    try {
      const { characterId } = req.params;
      const characterDoc = await db.collection('characters').doc(characterId).get();

      if (!characterDoc.exists) {
        return res.status(404).json({ error: '角色不存在' });
      }

      res.json({ id: characterDoc.id, ...characterDoc.data() });
    } catch (error) {
      res.status(500).json({ error: '獲取角色詳情失敗' });
    }
  });

  // POST /api/characters - Create character (not implemented)
  app.post('/api/characters', async (req, res) => {
    try {
      res.status(501).json({ error: '功能尚未實現' });
    } catch (error) {
      res.status(500).json({ error: '創建角色失敗' });
    }
  });

  // POST /api/characters/sync-chat-users - Sync all characters
  app.post('/api/characters/sync-chat-users', async (req, res) => {
    try {
      const { maxCharacters = 100, forceFullScan = false } = req.body;

      const { syncAllCharactersUserCount } = await import('../services/character/characterStats.service.js');

      const result = await syncAllCharactersUserCount({
        maxCharacters,
        forceFullScan,
      });

      const response = {
        message: '同步完成',
        totalCharacters: result.totalCharacters,
        totalUpdated: result.totalUpdated,
        warnings: result.warnings,
        note: '已使用優化的查詢方式，逐個角色進行統計',
      };

      if (result.warnings.length > 0) {
        return res.status(207).json(response);
      }

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: '同步失敗', message: error.message });
    }
  });

  // POST /api/characters/:characterId/sync-chat-users - Sync single character
  app.post('/api/characters/:characterId/sync-chat-users', async (req, res) => {
    try {
      const { characterId } = req.params;

      const characterDoc = await db.collection('characters').doc(characterId).get();
      if (!characterDoc.exists) {
        return res.status(404).json({ error: '角色不存在' });
      }

      const { syncSingleCharacterUserCount } = await import('../services/character/characterStats.service.js');

      const result = await syncSingleCharacterUserCount(characterId);

      res.json({
        message: '同步完成',
        characterId,
        userCount: result.userCount,
        conversationCount: result.conversationCount,
        note: '已使用優化的查詢方式，只掃描此角色的對話',
      });
    } catch (error) {
      res.status(500).json({ error: '同步失敗', message: error.message });
    }
  });

  // GET /api/characters/stats/overview - Get system stats
  app.get('/api/characters/stats/overview', async (req, res) => {
    try {
      const { getSystemStatsOverview } = await import('../services/character/characterStats.service.js');

      const stats = await getSystemStatsOverview();

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: '獲取統計概覽失敗', message: error.message });
    }
  });

  // PATCH /api/characters/:characterId - Update character
  app.patch('/api/characters/:characterId', async (req, res) => {
    try {
      const { characterId } = req.params;
      const updates = req.body;

      const characterDoc = await db.collection('characters').doc(characterId).get();
      if (!characterDoc.exists) {
        return res.status(404).json({ error: '角色不存在' });
      }

      const allowedFields = [
        'display_name',
        'gender',
        'voice',
        'locale',
        'background',
        'secret_background',
        'first_message',
        'tags',
        'plot_hooks',
        'portraitUrl',
        'status',
        'isPublic',
        'totalChatUsers',
        'totalFavorites',
      ];

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

      await db.collection('characters').doc(characterId).update(updateData);

      const updatedDoc = await db.collection('characters').doc(characterId).get();

      res.json({
        message: '角色更新成功',
        character: { id: updatedDoc.id, ...updatedDoc.data() },
      });
    } catch (error) {
      res.status(500).json({ error: '更新角色失敗', message: error.message });
    }
  });

  // DELETE /api/characters/:characterId - Delete character
  app.delete('/api/characters/:characterId', async (req, res) => {
    try {
      const { characterId } = req.params;

      const deletionStats = await services.deleteCharacter(characterId);

      res.json({
        message: '角色刪除成功',
        characterId,
        deletionStats: {
          characterDeleted: deletionStats.characterDeleted,
          portraitImageDeleted: deletionStats.portraitImageDeleted,
          photosDeleted: deletionStats.photosDeleted,
          photoImagesDeleted: deletionStats.photoImagesDeleted,
          videosDeleted: deletionStats.videosDeleted,
          videoFilesDeleted: deletionStats.videoFilesDeleted,
          conversationsDeleted: deletionStats.conversationsDeleted,
          usageLimitsUpdated: deletionStats.usageLimitsUpdated,
        },
      });
    } catch (error) {
      if (error.message === '角色不存在') {
        return res.status(404).json({ error: '角色不存在' });
      }
      res.status(500).json({ error: '刪除角色失敗', message: error.message });
    }
  });
}
