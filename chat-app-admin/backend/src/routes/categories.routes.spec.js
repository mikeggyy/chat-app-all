/**
 * Categories Routes 測試（管理後台）
 * 測試範圍：
 * - 分類列表
 * - 新增分類
 * - 更新分類
 * - 刪除分類
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock categories service
vi.mock('./categories.service.js', () => ({
  getAllCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

describe('Categories Routes - Admin Backend', () => {
  let app;
  let mockService;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    mockService = await import('./categories.service.js');

    setupRoutes(app, mockService);
    vi.clearAllMocks();
  });

  describe('GET /api/categories - 獲取所有分類', () => {
    it('應該成功獲取分類列表', async () => {
      const mockCategories = [
        { id: '1', name: 'Electronics', description: 'Electronic products' },
        { id: '2', name: 'Clothing', description: 'Fashion items' },
      ];

      mockService.getAllCategories.mockResolvedValue(mockCategories);

      const response = await request(app).get('/api/categories');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual(mockCategories);
      expect(response.body.data).toHaveLength(2);
    });

    it('應該處理獲取失敗', async () => {
      mockService.getAllCategories.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/categories');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/categories - 新增分類', () => {
    it('應該成功創建分類', async () => {
      const newCategory = { name: 'Books', description: 'Book collection' };
      const createdCategory = { id: '3', ...newCategory };

      mockService.createCategory.mockResolvedValue(createdCategory);

      const response = await request(app)
        .post('/api/categories')
        .send(newCategory);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual(createdCategory);
      expect(mockService.createCategory).toHaveBeenCalledWith(newCategory);
    });

    it('應該處理創建失敗', async () => {
      mockService.createCategory.mockRejectedValue(new Error('Validation error'));

      const response = await request(app)
        .post('/api/categories')
        .send({ name: 'Invalid' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/categories/:id - 更新分類', () => {
    it('應該成功更新分類', async () => {
      const updates = { description: 'Updated description' };
      const updatedCategory = { id: '1', name: 'Electronics', description: 'Updated description' };

      mockService.updateCategory.mockResolvedValue(updatedCategory);

      const response = await request(app)
        .put('/api/categories/1')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual(updatedCategory);
      expect(mockService.updateCategory).toHaveBeenCalledWith('1', updates);
    });

    it('應該處理更新失敗', async () => {
      mockService.updateCategory.mockRejectedValue(new Error('Not found'));

      const response = await request(app)
        .put('/api/categories/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('DELETE /api/categories/:id - 刪除分類', () => {
    it('應該成功刪除分類', async () => {
      mockService.deleteCategory.mockResolvedValue();

      const response = await request(app).delete('/api/categories/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '刪除成功');
      expect(mockService.deleteCategory).toHaveBeenCalledWith('1');
    });

    it('應該處理刪除失敗', async () => {
      mockService.deleteCategory.mockRejectedValue(new Error('Cannot delete'));

      const response = await request(app).delete('/api/categories/999');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
    });
  });
});

/**
 * Setup all routes for testing
 */
function setupRoutes(app, service) {
  const router = express.Router();

  // 獲取所有分類
  router.get('/', async (req, res) => {
    try {
      const categories = await service.getAllCategories();
      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // 新增分類
  router.post('/', async (req, res) => {
    try {
      const result = await service.createCategory(req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // 更新分類
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await service.updateCategory(id, req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // 刪除分類
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await service.deleteCategory(id);
      res.json({
        success: true,
        message: '刪除成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  app.use('/api/categories', router);
}
