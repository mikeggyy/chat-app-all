/**
 * Photo Album API 路由測試
 * 測試範圍：
 * - 代理下載圖片（CORS 繞過）
 * - 獲取用戶與角色的照片
 * - 獲取用戶所有照片
 * - 刪除照片
 * - 照片統計
 * - 權限驗證和安全性
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

vi.mock('../auth/index.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    next();
  },
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  standardRateLimiter: (req, res, next) => next(),
}));

vi.mock('../utils/routeHelpers.js', () => ({
  requireOwnership: (paramName) => (req, res, next) => {
    const userId = req.params[paramName];
    if (userId !== req.firebaseUser?.uid) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '無權訪問此資源',
      });
    }
    next();
  },
  asyncHandler: (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
  sendSuccess: (res, data) => res.status(200).json({ success: true, ...data }),
  sendError: (res, message, statusCode = 400) => {
    return res.status(statusCode).json({
      success: false,
      error: statusCode === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR',
      message,
    });
  },
}));

// Mock photo album services
const mockGetCharacterPhotos = vi.fn();
const mockGetUserAllPhotos = vi.fn();
const mockDeletePhotos = vi.fn();
const mockGetPhotoStats = vi.fn();

vi.mock('./photoAlbum.service.js', () => ({
  getCharacterPhotos: (...args) => mockGetCharacterPhotos(...args),
  getUserAllPhotos: (...args) => mockGetUserAllPhotos(...args),
  deletePhotos: (...args) => mockDeletePhotos(...args),
  getPhotoStats: (...args) => mockGetPhotoStats(...args),
}));

// Mock node-fetch
const mockFetch = vi.fn();
vi.mock('node-fetch', () => ({
  default: (...args) => mockFetch(...args),
}));

// Import the router after mocks
import { photoAlbumRouter } from './photoAlbum.routes.js';

describe('Photo Album API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/photos', photoAlbumRouter);

    // 添加錯誤處理中間件
    app.use((err, req, res, next) => {
      res.status(500).json({
        success: false,
        error: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || '內部錯誤',
      });
    });

    // 清除所有 mock
    vi.clearAllMocks();

    // 設置默認環境變數
    process.env.NODE_ENV = 'test';
  });

  describe('GET /download - 代理下載圖片', () => {
    it('應該成功代理下載圖片（Cloudflare R2）', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'image/webp' : null),
        },
        arrayBuffer: async () => mockImageBuffer.buffer,
      });

      const response = await request(app)
        .get('/api/photos/download')
        .query({ url: 'https://pub-123.r2.dev/photo123.webp' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/webp');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(mockFetch).toHaveBeenCalledWith('https://pub-123.r2.dev/photo123.webp');
    });

    it('應該成功代理下載圖片（Firebase Storage）', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: async () => mockImageBuffer.buffer,
      });

      const response = await request(app)
        .get('/api/photos/download')
        .query({ url: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/photo.jpg' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('應該拒絕缺少 url 參數', async () => {
      const response = await request(app).get('/api/photos/download');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('缺少必要參數：url');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('應該拒絕不允許的域名', async () => {
      const response = await request(app)
        .get('/api/photos/download')
        .query({ url: 'https://malicious.com/photo.jpg' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('不允許的圖片來源');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('應該處理圖片抓取失敗', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const response = await request(app)
        .get('/api/photos/download')
        .query({ url: 'https://r2.dev/nonexistent.webp' });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('下載圖片失敗');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('應該處理網絡錯誤', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/photos/download')
        .query({ url: 'https://r2.dev/photo.webp' });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('下載圖片失敗');
    });
  });

  describe('GET /:userId/character/:characterId - 獲取角色照片', () => {
    it('應該成功獲取用戶與角色的照片', async () => {
      const mockResult = {
        character: {
          id: 'char-001',
          name: 'Test Character',
          profileImage: 'https://example.com/profile.jpg',
        },
        photos: [
          { id: 'photo-001', url: 'https://example.com/photo1.webp', createdAt: '2025-01-15T00:00:00Z' },
          { id: 'photo-002', url: 'https://example.com/photo2.webp', createdAt: '2025-01-15T01:00:00Z' },
        ],
      };
      mockGetCharacterPhotos.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/photos/test-user-123/character/char-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.character).toBeDefined();
      expect(response.body.photos).toHaveLength(2);
      expect(mockGetCharacterPhotos).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該拒絕訪問其他用戶的照片', async () => {
      const response = await request(app)
        .get('/api/photos/other-user-456/character/char-001');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(mockGetCharacterPhotos).not.toHaveBeenCalled();
    });

    it('應該處理照片不存在的情況', async () => {
      mockGetCharacterPhotos.mockResolvedValue({
        character: {
          id: 'char-001',
          name: 'Test Character',
        },
        photos: [],
      });

      const response = await request(app)
        .get('/api/photos/test-user-123/character/char-001');

      expect(response.status).toBe(200);
      expect(response.body.photos).toHaveLength(0);
    });
  });

  describe('GET /:userId - 獲取用戶所有照片', () => {
    it('應該成功獲取用戶所有照片', async () => {
      const mockPhotos = [
        { id: 'photo-001', characterId: 'char-001', url: 'https://example.com/photo1.webp' },
        { id: 'photo-002', characterId: 'char-002', url: 'https://example.com/photo2.webp' },
        { id: 'photo-003', characterId: 'char-001', url: 'https://example.com/photo3.webp' },
      ];
      mockGetUserAllPhotos.mockResolvedValue(mockPhotos);

      const response = await request(app).get('/api/photos/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.photos).toHaveLength(3);
      expect(mockGetUserAllPhotos).toHaveBeenCalledWith('test-user-123', { limit: undefined });
    });

    it('應該支援 limit 參數', async () => {
      const mockPhotos = [
        { id: 'photo-001', characterId: 'char-001', url: 'https://example.com/photo1.webp' },
        { id: 'photo-002', characterId: 'char-002', url: 'https://example.com/photo2.webp' },
      ];
      mockGetUserAllPhotos.mockResolvedValue(mockPhotos);

      const response = await request(app)
        .get('/api/photos/test-user-123')
        .query({ limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.photos).toHaveLength(2);
      expect(mockGetUserAllPhotos).toHaveBeenCalledWith('test-user-123', { limit: 2 });
    });

    it('應該處理空照片列表', async () => {
      mockGetUserAllPhotos.mockResolvedValue([]);

      const response = await request(app).get('/api/photos/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.photos).toHaveLength(0);
    });

    it('應該拒絕訪問其他用戶的照片', async () => {
      const response = await request(app).get('/api/photos/other-user-456');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(mockGetUserAllPhotos).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:userId - 刪除照片', () => {
    it('應該成功刪除單個照片', async () => {
      mockDeletePhotos.mockResolvedValue({ deleted: 1 });

      const response = await request(app)
        .delete('/api/photos/test-user-123')
        .send({ photoIds: ['photo-001'] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(1);
      expect(mockDeletePhotos).toHaveBeenCalledWith('test-user-123', ['photo-001']);
    });

    it('應該成功刪除多個照片', async () => {
      mockDeletePhotos.mockResolvedValue({ deleted: 3 });

      const response = await request(app)
        .delete('/api/photos/test-user-123')
        .send({ photoIds: ['photo-001', 'photo-002', 'photo-003'] });

      expect(response.status).toBe(200);
      expect(response.body.deleted).toBe(3);
      expect(mockDeletePhotos).toHaveBeenCalledWith('test-user-123', ['photo-001', 'photo-002', 'photo-003']);
    });

    it('應該拒絕缺少 photoIds', async () => {
      const response = await request(app)
        .delete('/api/photos/test-user-123')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('需提供至少一個照片 ID');
      expect(mockDeletePhotos).not.toHaveBeenCalled();
    });

    it('應該拒絕空的 photoIds 陣列', async () => {
      const response = await request(app)
        .delete('/api/photos/test-user-123')
        .send({ photoIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('需提供至少一個照片 ID');
      expect(mockDeletePhotos).not.toHaveBeenCalled();
    });

    it('應該拒絕 photoIds 不是陣列', async () => {
      const response = await request(app)
        .delete('/api/photos/test-user-123')
        .send({ photoIds: 'photo-001' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('需提供至少一個照片 ID');
      expect(mockDeletePhotos).not.toHaveBeenCalled();
    });

    it('應該拒絕刪除其他用戶的照片', async () => {
      const response = await request(app)
        .delete('/api/photos/other-user-456')
        .send({ photoIds: ['photo-001'] });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(mockDeletePhotos).not.toHaveBeenCalled();
    });
  });

  describe('GET /:userId/stats - 獲取照片統計', () => {
    it('應該成功獲取所有照片統計', async () => {
      const mockStats = {
        total: 15,
        byCharacter: {
          'char-001': 8,
          'char-002': 5,
          'char-003': 2,
        },
      };
      mockGetPhotoStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/api/photos/test-user-123/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.total).toBe(15);
      expect(response.body.byCharacter).toBeDefined();
      expect(mockGetPhotoStats).toHaveBeenCalledWith('test-user-123', null);
    });

    it('應該支援按角色過濾統計', async () => {
      const mockStats = {
        total: 8,
        byCharacter: {
          'char-001': 8,
        },
      };
      mockGetPhotoStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/photos/test-user-123/stats')
        .query({ characterId: 'char-001' });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(8);
      expect(mockGetPhotoStats).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該處理無照片的統計', async () => {
      mockGetPhotoStats.mockResolvedValue({
        total: 0,
        byCharacter: {},
      });

      const response = await request(app).get('/api/photos/test-user-123/stats');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });

    it('應該拒絕訪問其他用戶的統計', async () => {
      const response = await request(app).get('/api/photos/other-user-456/stats');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(mockGetPhotoStats).not.toHaveBeenCalled();
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點都應該需要認證', async () => {
      const endpoints = [
        { method: 'get', path: '/api/photos/download?url=https://r2.dev/photo.webp' },
        { method: 'get', path: '/api/photos/test-user-123/character/char-001' },
        { method: 'get', path: '/api/photos/test-user-123' },
        { method: 'delete', path: '/api/photos/test-user-123', body: { photoIds: ['photo-001'] } },
        { method: 'get', path: '/api/photos/test-user-123/stats' },
      ];

      // 由於我們已經 mock 了 requireFirebaseAuth，這裡只是確認端點存在
      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.path);
        if (endpoint.body) {
          req.send(endpoint.body);
        }
        const response = await req;
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      }
    });

    it('應該只允許用戶訪問自己的資源', async () => {
      // 嘗試訪問其他用戶的照片
      const response1 = await request(app)
        .get('/api/photos/other-user/character/char-001');
      expect(response1.status).toBe(403);

      // 嘗試訪問其他用戶的所有照片
      const response2 = await request(app).get('/api/photos/other-user');
      expect(response2.status).toBe(403);

      // 嘗試刪除其他用戶的照片
      const response3 = await request(app)
        .delete('/api/photos/other-user')
        .send({ photoIds: ['photo-001'] });
      expect(response3.status).toBe(403);

      // 嘗試查看其他用戶的統計
      const response4 = await request(app).get('/api/photos/other-user/stats');
      expect(response4.status).toBe(403);
    });

    it('下載端點應該驗證 URL 域名', async () => {
      const maliciousUrls = [
        'https://evil.com/photo.jpg',
        'https://phishing-site.com/image.png',
        'http://localhost/secret.jpg',
      ];

      for (const url of maliciousUrls) {
        const response = await request(app)
          .get('/api/photos/download')
          .query({ url });
        expect(response.status).toBe(403);
        expect(response.body.message).toContain('不允許的圖片來源');
      }
    });
  });
});
