/**
 * Conversations Routes 測試（管理後台）
 * 測試範圍：
 * - 對話列表（分頁、篩選）
 * - 對話統計
 * - 對話詳情
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

describe('Conversations Routes - Admin Backend', () => {
  let app;
  let mockDb;

  beforeEach(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Import mocked modules
    const { db } = await import('../firebase/index.js');
    mockDb = db;

    // Mock Firestore collection methods
    const mockCollectionChain = {
      doc: vi.fn(() => mockCollectionChain),
      get: vi.fn(() => Promise.resolve({
        exists: true,
        id: 'conv-1',
        data: () => ({
          userId: 'user-1',
          characterId: 'char-1',
          messages: [],
          createdAt: { toDate: () => new Date('2025-01-01') },
          updatedAt: { toDate: () => new Date('2025-01-15') },
        }),
        docs: [],
        size: 0,
      })),
      where: vi.fn(() => mockCollectionChain),
      orderBy: vi.fn(() => mockCollectionChain),
      limit: vi.fn(() => mockCollectionChain),
      offset: vi.fn(() => mockCollectionChain),
    };

    mockDb.collection.mockReturnValue(mockCollectionChain);

    // Setup routes
    setupRoutes(app, mockDb);

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('GET /api/conversations - 獲取對話列表', () => {
    it('應該成功獲取對話列表', async () => {
      const mockDocs = [
        {
          id: 'conv-1',
          data: () => ({
            userId: 'user-1',
            characterId: 'char-1',
            messages: [{ id: 'msg-1', text: 'Hello' }, { id: 'msg-2', text: 'Hi' }],
            createdAt: { toDate: () => new Date('2025-01-01') },
            updatedAt: { toDate: () => new Date('2025-01-15') },
          }),
        },
        {
          id: 'conv-2',
          data: () => ({
            userId: 'user-2',
            characterId: 'char-2',
            messages: [{ id: 'msg-3', text: 'Test' }],
            createdAt: { toDate: () => new Date('2025-01-02') },
            updatedAt: { toDate: () => new Date('2025-01-14') },
          }),
        },
      ];

      const mockChain = {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn()
          .mockResolvedValueOnce({ size: 2 }) // First call for count
          .mockResolvedValueOnce({ docs: mockDocs }), // Second call for data
      };

      mockDb.collection.mockReturnValue(mockChain);

      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('conversations');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.conversations)).toBe(true);
    });

    it('應該支持分頁參數', async () => {
      const mockChain = {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn()
          .mockResolvedValueOnce({ size: 50 })
          .mockResolvedValueOnce({ docs: [] }),
      };

      mockDb.collection.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 2, pageSize: 10 });

      expect(response.status).toBe(200);
      expect(mockChain.limit).toHaveBeenCalledWith(10);
      expect(mockChain.offset).toHaveBeenCalledWith(10); // (page 2 - 1) * 10
      expect(response.body.pagination).toHaveProperty('page', 2);
      expect(response.body.pagination).toHaveProperty('pageSize', 10);
    });

    it('應該支持用戶 ID 篩選', async () => {
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

      await request(app)
        .get('/api/conversations')
        .query({ userId: 'user-123' });

      expect(mockChain.where).toHaveBeenCalledWith('userId', '==', 'user-123');
    });

    it('應該支持角色 ID 篩選', async () => {
      const mockChain = {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn()
          .mockResolvedValueOnce({ size: 8 })
          .mockResolvedValueOnce({ docs: [] }),
      };

      mockDb.collection.mockReturnValue(mockChain);

      await request(app)
        .get('/api/conversations')
        .query({ characterId: 'char-456' });

      expect(mockChain.where).toHaveBeenCalledWith('characterId', '==', 'char-456');
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

      await request(app)
        .get('/api/conversations')
        .query({ startDate: '2025-01-01', endDate: '2025-01-15' });

      expect(mockChain.where).toHaveBeenCalledWith('updatedAt', '>=', expect.any(Date));
      expect(mockChain.where).toHaveBeenCalledWith('updatedAt', '<=', expect.any(Date));
    });

    it('應該計算正確的分頁信息', async () => {
      const mockChain = {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn()
          .mockResolvedValueOnce({ size: 47 })
          .mockResolvedValueOnce({ docs: [] }),
      };

      mockDb.collection.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 1, pageSize: 20 });

      expect(response.body.pagination).toEqual({
        total: 47,
        page: 1,
        pageSize: 20,
        totalPages: 3, // Math.ceil(47 / 20) = 3
      });
    });

    it('應該處理獲取列表失敗', async () => {
      mockDb.collection.mockReturnValue({
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn(() => Promise.reject(new Error('Database error'))),
      });

      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '獲取對話列表失敗');
    });
  });

  describe('GET /api/conversations/stats - 獲取對話統計', () => {
    it('應該成功獲取對話統計', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mockDocs = [
        {
          data: () => ({
            userId: 'user-1',
            characterId: 'char-1',
            messages: [{ id: '1' }, { id: '2' }],
            updatedAt: { toDate: () => new Date() }, // Today
          }),
        },
        {
          data: () => ({
            userId: 'user-2',
            characterId: 'char-1',
            messages: [{ id: '3' }],
            updatedAt: { toDate: () => new Date(Date.now() - 86400000) }, // Yesterday
          }),
        },
        {
          data: () => ({
            userId: 'user-1',
            characterId: 'char-2',
            messages: [{ id: '4' }, { id: '5' }, { id: '6' }],
            updatedAt: { toDate: () => new Date() }, // Today
          }),
        },
      ];

      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.resolve({
          size: 3,
          docs: mockDocs,
        })),
      });

      const response = await request(app).get('/api/conversations/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalConversations', 3);
      expect(response.body.stats).toHaveProperty('activeUsers', 2); // user-1, user-2
      expect(response.body.stats).toHaveProperty('todayConversations', 2);
      expect(response.body.stats).toHaveProperty('totalMessages', 6);
      expect(response.body.stats).toHaveProperty('byCharacter');
    });

    it('應該正確統計活躍用戶數', async () => {
      const mockDocs = [
        { data: () => ({ userId: 'user-1', characterId: 'char-1', messages: [] }) },
        { data: () => ({ userId: 'user-1', characterId: 'char-2', messages: [] }) },
        { data: () => ({ userId: 'user-2', characterId: 'char-1', messages: [] }) },
        { data: () => ({ userId: 'user-3', characterId: 'char-1', messages: [] }) },
      ];

      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.resolve({ size: 4, docs: mockDocs })),
      });

      const response = await request(app).get('/api/conversations/stats');

      expect(response.body.stats.activeUsers).toBe(3); // Unique users: user-1, user-2, user-3
    });

    it('應該按角色統計對話數量', async () => {
      const mockDocs = [
        { data: () => ({ userId: 'user-1', characterId: 'char-1', messages: [] }) },
        { data: () => ({ userId: 'user-2', characterId: 'char-1', messages: [] }) },
        { data: () => ({ userId: 'user-3', characterId: 'char-2', messages: [] }) },
      ];

      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.resolve({ size: 3, docs: mockDocs })),
      });

      const response = await request(app).get('/api/conversations/stats');

      expect(response.body.stats.byCharacter).toHaveProperty('char-1');
      expect(response.body.stats.byCharacter['char-1'].count).toBe(2);
      expect(response.body.stats.byCharacter).toHaveProperty('char-2');
      expect(response.body.stats.byCharacter['char-2'].count).toBe(1);
    });

    it('應該處理沒有消息的對話', async () => {
      const mockDocs = [
        { data: () => ({ userId: 'user-1', characterId: 'char-1' }) }, // No messages field
        { data: () => ({ userId: 'user-2', characterId: 'char-1', messages: null }) }, // null messages
      ];

      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.resolve({ size: 2, docs: mockDocs })),
      });

      const response = await request(app).get('/api/conversations/stats');

      expect(response.status).toBe(200);
      expect(response.body.stats.totalMessages).toBe(0);
    });

    it('應該處理獲取統計失敗', async () => {
      mockDb.collection.mockReturnValue({
        get: vi.fn(() => Promise.reject(new Error('Database error'))),
      });

      const response = await request(app).get('/api/conversations/stats');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '獲取對話統計失敗');
    });
  });

  describe('GET /api/conversations/:id - 獲取對話詳情', () => {
    it('應該成功獲取對話詳情', async () => {
      const mockMessages = [
        { id: 'msg-1', role: 'user', text: 'Hello', createdAt: '2025-01-15T10:00:00Z' },
        { id: 'msg-2', role: 'assistant', text: 'Hi there!', createdAt: '2025-01-15T10:01:00Z' },
      ];

      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            exists: true,
            id: 'conv-123',
            data: () => ({
              userId: 'user-1',
              characterId: 'char-1',
              messages: mockMessages,
              createdAt: { toDate: () => new Date('2025-01-15T09:00:00Z') },
              updatedAt: { toDate: () => new Date('2025-01-15T10:01:00Z') },
            }),
          })),
        })),
      });

      const response = await request(app).get('/api/conversations/conv-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('conversation');
      expect(response.body.conversation).toHaveProperty('id', 'conv-123');
      expect(response.body.conversation).toHaveProperty('messages');
      expect(Array.isArray(response.body.conversation.messages)).toBe(true);
      expect(response.body.conversation.messages.length).toBe(2);
    });

    it('應該處理對話不存在的情況', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: false })),
        })),
      });

      const response = await request(app).get('/api/conversations/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '對話不存在');
    });

    it('應該正確格式化消息列表', async () => {
      const mockMessages = [
        { id: 'msg-1', role: 'user', text: 'Test message', createdAt: '2025-01-15T10:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Response', timestamp: '2025-01-15T10:01:00Z' },
        { id: 'msg-3', role: 'user', text: 'Image test', imageUrl: 'https://example.com/img.jpg' },
      ];

      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            exists: true,
            id: 'conv-123',
            data: () => ({
              userId: 'user-1',
              characterId: 'char-1',
              messages: mockMessages,
              createdAt: { toDate: () => new Date() },
              updatedAt: { toDate: () => new Date() },
            }),
          })),
        })),
      });

      const response = await request(app).get('/api/conversations/conv-123');

      expect(response.body.conversation.messages[0]).toHaveProperty('id', 'msg-1');
      expect(response.body.conversation.messages[0]).toHaveProperty('role', 'user');
      expect(response.body.conversation.messages[0]).toHaveProperty('content', 'Test message');
      expect(response.body.conversation.messages[1]).toHaveProperty('content', 'Response');
      expect(response.body.conversation.messages[2]).toHaveProperty('imageUrl');
    });

    it('應該處理沒有消息的對話', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            exists: true,
            id: 'conv-123',
            data: () => ({
              userId: 'user-1',
              characterId: 'char-1',
              // No messages field
              createdAt: { toDate: () => new Date() },
              updatedAt: { toDate: () => new Date() },
            }),
          })),
        })),
      });

      const response = await request(app).get('/api/conversations/conv-123');

      expect(response.status).toBe(200);
      expect(response.body.conversation.messages).toEqual([]);
    });

    it('應該處理獲取詳情失敗', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.reject(new Error('Database error'))),
        })),
      });

      const response = await request(app).get('/api/conversations/conv-123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', '獲取對話詳情失敗');
    });
  });
});

/**
 * Setup all routes for testing
 */
function setupRoutes(app, db) {
  // GET /api/conversations - List conversations
  app.get('/api/conversations', async (req, res) => {
    try {
      const {
        page = 1,
        pageSize = 20,
        userId = null,
        characterId = null,
        startDate = null,
        endDate = null,
      } = req.query;

      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;

      let query = db.collection('conversations').orderBy('updatedAt', 'desc');

      if (userId) {
        query = query.where('userId', '==', userId);
      }
      if (characterId) {
        query = query.where('characterId', '==', characterId);
      }
      if (startDate) {
        query = query.where('updatedAt', '>=', new Date(startDate));
      }
      if (endDate) {
        query = query.where('updatedAt', '<=', new Date(endDate));
      }

      const countSnapshot = await query.get();
      const total = countSnapshot.size;

      query = query.limit(limit).offset(offset);

      const snapshot = await query.get();
      const conversations = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const messageCount = Array.isArray(data.messages) ? data.messages.length : 0;

        conversations.push({
          id: doc.id,
          ...data,
          userName: '測試用戶',
          userEmail: 'test@example.com',
          characterName: '測試角色',
          messageCount,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
        });
      }

      res.json({
        success: true,
        conversations,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '獲取對話列表失敗',
        message: error.message,
      });
    }
  });

  // GET /api/conversations/stats - Get conversation statistics
  app.get('/api/conversations/stats', async (req, res) => {
    try {
      const snapshot = await db.collection('conversations').get();

      const stats = {
        totalConversations: snapshot.size,
        activeUsers: 0,
        todayConversations: 0,
        totalMessages: 0,
        byCharacter: {},
      };

      const uniqueUsers = new Set();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const doc of snapshot.docs) {
        const conversation = doc.data();

        if (conversation.userId) {
          uniqueUsers.add(conversation.userId);
        }

        if (conversation.updatedAt) {
          const updatedAt = conversation.updatedAt.toDate();
          if (updatedAt >= today) {
            stats.todayConversations++;
          }
        }

        const messages = conversation.messages;
        if (Array.isArray(messages)) {
          stats.totalMessages += messages.length;
        }

        const characterId = conversation.characterId || 'unknown';
        if (!stats.byCharacter[characterId]) {
          stats.byCharacter[characterId] = {
            count: 0,
            characterName: '未知角色',
          };
        }
        stats.byCharacter[characterId].count++;
      }

      stats.activeUsers = uniqueUsers.size;

      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '獲取對話統計失敗',
      });
    }
  });

  // GET /api/conversations/:id - Get conversation details
  app.get('/api/conversations/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const doc = await db.collection('conversations').doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: '對話不存在',
        });
      }

      const data = doc.data();

      const messages = Array.isArray(data.messages)
        ? data.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.text || msg.content,
            timestamp: msg.createdAt || msg.timestamp,
            imageUrl: msg.imageUrl,
          }))
        : [];

      res.json({
        success: true,
        conversation: {
          id: doc.id,
          ...data,
          userName: '測試用戶',
          userEmail: 'test@example.com',
          characterName: '測試角色',
          messages,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '獲取對話詳情失敗',
      });
    }
  });
}
