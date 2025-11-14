/**
 * Character Styles API 路由測試
 * 測試範圍：
 * - 列出所有角色風格
 * - 獲取單個角色風格
 * - 創建/更新角色風格（管理員）
 * - 刪除角色風格（管理員）
 * - 權限驗證
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dependencies BEFORE importing the router
vi.mock('../utils/routeHelpers.js', () => ({
  asyncHandler: (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
  sendSuccess: (res, data) => res.status(200).json({ success: true, ...data }),
  sendError: (res, message, statusCode = 400) => {
    return res.status(statusCode).json({
      success: false,
      error: statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR',
      message,
    });
  },
}));

// Mock admin middleware
let isAdmin = false;
vi.mock('../middleware/adminAuth.middleware.js', () => ({
  requireAdmin: (req, res, next) => {
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '需要管理員權限',
      });
    }
    next();
  },
}));

// Mock character styles services
const mockListCharacterStyles = vi.fn();
const mockGetCharacterStyle = vi.fn();
const mockUpsertCharacterStyle = vi.fn();
const mockDeleteCharacterStyle = vi.fn();

vi.mock('./characterStyles.service.js', () => ({
  listCharacterStyles: (...args) => mockListCharacterStyles(...args),
  getCharacterStyle: (...args) => mockGetCharacterStyle(...args),
  upsertCharacterStyle: (...args) => mockUpsertCharacterStyle(...args),
  deleteCharacterStyle: (...args) => mockDeleteCharacterStyle(...args),
}));

// Import the router after mocks
import { characterStylesRouter } from './characterStyles.routes.js';

describe('Character Styles API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/character-styles', characterStylesRouter);

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

    // 重置管理員權限
    isAdmin = false;
  });

  describe('GET / - 列出所有角色風格', () => {
    it('應該成功獲取所有角色風格', async () => {
      const mockStyles = [
        {
          id: 'modern',
          label: '現代風',
          era: 'contemporary',
          description: '現代都市風格',
          active: true,
        },
        {
          id: 'vintage',
          label: '復古風',
          era: 'vintage',
          description: '復古懷舊風格',
          active: true,
        },
      ];
      mockListCharacterStyles.mockResolvedValue(mockStyles);

      const response = await request(app).get('/api/character-styles');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.styles).toHaveLength(2);
      expect(response.body.styles[0].id).toBe('modern');
      expect(mockListCharacterStyles).toHaveBeenCalled();
    });

    it('應該處理空列表', async () => {
      mockListCharacterStyles.mockResolvedValue([]);

      const response = await request(app).get('/api/character-styles');

      expect(response.status).toBe(200);
      expect(response.body.styles).toHaveLength(0);
    });

    it('不需要認證（公開端點）', async () => {
      mockListCharacterStyles.mockResolvedValue([
        { id: 'modern', label: '現代風', era: 'contemporary' },
      ]);

      const response = await request(app).get('/api/character-styles');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /:id - 獲取單個角色風格', () => {
    it('應該成功獲取單個角色風格', async () => {
      const mockStyle = {
        id: 'modern',
        label: '現代風',
        era: 'contemporary',
        description: '現代都市風格',
        active: true,
        previewImages: ['https://example.com/preview1.jpg'],
      };
      mockGetCharacterStyle.mockResolvedValue(mockStyle);

      const response = await request(app).get('/api/character-styles/modern');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe('modern');
      expect(response.body.label).toBe('現代風');
      expect(mockGetCharacterStyle).toHaveBeenCalledWith('modern');
    });

    it('應該處理風格不存在', async () => {
      mockGetCharacterStyle.mockResolvedValue(null);

      const response = await request(app).get('/api/character-styles/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
      expect(response.body.message).toContain('找不到指定的風格');
      expect(mockGetCharacterStyle).toHaveBeenCalledWith('nonexistent');
    });

    it('不需要認證（公開端點）', async () => {
      mockGetCharacterStyle.mockResolvedValue({
        id: 'vintage',
        label: '復古風',
        era: 'vintage',
      });

      const response = await request(app).get('/api/character-styles/vintage');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /:id - 創建/更新角色風格（管理員）', () => {
    beforeEach(() => {
      // 設置為管理員
      isAdmin = true;
    });

    it('應該成功創建新的角色風格', async () => {
      const newStyle = {
        label: '科幻風',
        era: 'futuristic',
        description: '未來科技風格',
        active: true,
      };
      mockUpsertCharacterStyle.mockResolvedValue({
        id: 'scifi',
        ...newStyle,
      });

      const response = await request(app)
        .post('/api/character-styles/scifi')
        .send(newStyle);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe('scifi');
      expect(response.body.label).toBe('科幻風');
      expect(mockUpsertCharacterStyle).toHaveBeenCalledWith('scifi', newStyle);
    });

    it('應該成功更新現有的角色風格', async () => {
      const updatedStyle = {
        label: '現代風（更新）',
        era: 'contemporary',
        description: '更新後的現代都市風格',
        active: true,
      };
      mockUpsertCharacterStyle.mockResolvedValue({
        id: 'modern',
        ...updatedStyle,
      });

      const response = await request(app)
        .post('/api/character-styles/modern')
        .send(updatedStyle);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.label).toBe('現代風（更新）');
    });

    it('應該拒絕缺少 label', async () => {
      const invalidStyle = {
        era: 'contemporary',
        description: '缺少 label',
      };

      const response = await request(app)
        .post('/api/character-styles/modern')
        .send(invalidStyle);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('label 和 era 為必填欄位');
      expect(mockUpsertCharacterStyle).not.toHaveBeenCalled();
    });

    it('應該拒絕缺少 era', async () => {
      const invalidStyle = {
        label: '現代風',
        description: '缺少 era',
      };

      const response = await request(app)
        .post('/api/character-styles/modern')
        .send(invalidStyle);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('label 和 era 為必填欄位');
      expect(mockUpsertCharacterStyle).not.toHaveBeenCalled();
    });

    it('應該拒絕非管理員訪問', async () => {
      isAdmin = false;

      const response = await request(app)
        .post('/api/character-styles/modern')
        .send({
          label: '現代風',
          era: 'contemporary',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.message).toContain('需要管理員權限');
      expect(mockUpsertCharacterStyle).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:id - 刪除角色風格（管理員）', () => {
    beforeEach(() => {
      // 設置為管理員
      isAdmin = true;
    });

    it('應該成功刪除角色風格', async () => {
      mockDeleteCharacterStyle.mockResolvedValue();

      const response = await request(app).delete('/api/character-styles/modern');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('風格已刪除');
      expect(mockDeleteCharacterStyle).toHaveBeenCalledWith('modern');
    });

    it('應該處理刪除不存在的風格', async () => {
      mockDeleteCharacterStyle.mockRejectedValue(new Error('風格不存在'));

      const response = await request(app).delete('/api/character-styles/nonexistent');

      expect(response.status).toBe(500);
      expect(mockDeleteCharacterStyle).toHaveBeenCalledWith('nonexistent');
    });

    it('應該拒絕非管理員訪問', async () => {
      isAdmin = false;

      const response = await request(app).delete('/api/character-styles/modern');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.message).toContain('需要管理員權限');
      expect(mockDeleteCharacterStyle).not.toHaveBeenCalled();
    });
  });

  describe('權限測試', () => {
    it('公開端點不需要認證', async () => {
      mockListCharacterStyles.mockResolvedValue([]);
      mockGetCharacterStyle.mockResolvedValue({ id: 'test', label: 'Test', era: 'modern' });

      const response1 = await request(app).get('/api/character-styles');
      expect(response1.status).toBe(200);

      const response2 = await request(app).get('/api/character-styles/test');
      expect(response2.status).toBe(200);
    });

    it('管理端點需要管理員權限', async () => {
      isAdmin = false;

      const response1 = await request(app)
        .post('/api/character-styles/test')
        .send({ label: 'Test', era: 'modern' });
      expect(response1.status).toBe(403);

      const response2 = await request(app).delete('/api/character-styles/test');
      expect(response2.status).toBe(403);
    });

    it('管理員可以執行所有操作', async () => {
      isAdmin = true;
      mockUpsertCharacterStyle.mockResolvedValue({ id: 'test', label: 'Test', era: 'modern' });
      mockDeleteCharacterStyle.mockResolvedValue();

      const response1 = await request(app)
        .post('/api/character-styles/test')
        .send({ label: 'Test', era: 'modern' });
      expect(response1.status).toBe(200);

      const response2 = await request(app).delete('/api/character-styles/test');
      expect(response2.status).toBe(200);
    });
  });
});
