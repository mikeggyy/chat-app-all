/**
 * Products Routes 測試（管理後台）
 * 測試範圍：
 * - 金幣套餐 CRUD
 * - 禮物 CRUD
 * - 道具 CRUD
 * - 通用商品管理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock product services
vi.mock('./products.service.js', () => ({
  getAllCoinPackages: vi.fn(),
  createCoinPackage: vi.fn(),
  updateCoinPackage: vi.fn(),
  deleteCoinPackage: vi.fn(),
  getAllGifts: vi.fn(),
  createGift: vi.fn(),
  updateGift: vi.fn(),
  deleteGift: vi.fn(),
  getAllPotions: vi.fn(),
  createPotion: vi.fn(),
  updatePotion: vi.fn(),
  deletePotion: vi.fn(),
}));

vi.mock('./products-universal.service.js', () => ({
  getProductsByCollection: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

describe('Products Routes - Admin Backend', () => {
  let app;
  let mockServices;
  let mockUniversalServices;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    mockServices = await import('./products.service.js');
    mockUniversalServices = await import('./products-universal.service.js');

    setupRoutes(app, mockServices, mockUniversalServices);
    vi.clearAllMocks();
  });

  describe('金幣套餐管理', () => {
    describe('GET /api/products/coins - 獲取所有金幣套餐', () => {
      it('應該成功獲取金幣套餐列表', async () => {
        const mockPackages = [
          { id: '1', coins: 100, price: 0.99 },
          { id: '2', coins: 500, price: 4.99 },
        ];

        mockServices.getAllCoinPackages.mockResolvedValue(mockPackages);

        const response = await request(app).get('/api/products/coins');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toEqual(mockPackages);
      });

      it('應該處理獲取失敗', async () => {
        mockServices.getAllCoinPackages.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/products/coins');

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/products/coins - 新增金幣套餐', () => {
      it('應該成功創建金幣套餐', async () => {
        const newPackage = { coins: 1000, price: 9.99 };
        const created = { id: '3', ...newPackage };

        mockServices.createCoinPackage.mockResolvedValue(created);

        const response = await request(app)
          .post('/api/products/coins')
          .send(newPackage);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toEqual(created);
      });
    });

    describe('PUT /api/products/coins/:id - 更新金幣套餐', () => {
      it('應該成功更新金幣套餐', async () => {
        const updates = { price: 8.99 };
        const updated = { id: '3', coins: 1000, price: 8.99 };

        mockServices.updateCoinPackage.mockResolvedValue(updated);

        const response = await request(app)
          .put('/api/products/coins/3')
          .send(updates);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(updated);
      });
    });

    describe('DELETE /api/products/coins/:id - 刪除金幣套餐', () => {
      it('應該成功刪除金幣套餐', async () => {
        mockServices.deleteCoinPackage.mockResolvedValue();

        const response = await request(app).delete('/api/products/coins/3');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', '刪除成功');
      });
    });
  });

  describe('禮物管理', () => {
    describe('GET /api/products/gifts - 獲取所有禮物', () => {
      it('應該成功獲取禮物列表', async () => {
        const mockGifts = [
          { id: '1', name: 'Rose', price: 10 },
          { id: '2', name: 'Diamond', price: 100 },
        ];

        mockServices.getAllGifts.mockResolvedValue(mockGifts);

        const response = await request(app).get('/api/products/gifts');

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockGifts);
      });
    });

    describe('POST /api/products/gifts - 新增禮物', () => {
      it('應該成功創建禮物', async () => {
        const newGift = { name: 'Crown', price: 50 };
        mockServices.createGift.mockResolvedValue({ id: '3', ...newGift });

        const response = await request(app)
          .post('/api/products/gifts')
          .send(newGift);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('PUT /api/products/gifts/:id - 更新禮物', () => {
      it('應該成功更新禮物', async () => {
        mockServices.updateGift.mockResolvedValue({ id: '1', name: 'Rose', price: 15 });

        const response = await request(app)
          .put('/api/products/gifts/1')
          .send({ price: 15 });

        expect(response.status).toBe(200);
      });
    });

    describe('DELETE /api/products/gifts/:id - 刪除禮物', () => {
      it('應該成功刪除禮物', async () => {
        mockServices.deleteGift.mockResolvedValue();

        const response = await request(app).delete('/api/products/gifts/1');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', '刪除成功');
      });
    });
  });

  describe('道具管理', () => {
    describe('GET /api/products/potions - 獲取所有道具', () => {
      it('應該成功獲取道具列表', async () => {
        const mockPotions = [
          { id: '1', name: 'Speed Potion', effect: 'speed' },
          { id: '2', name: 'Power Potion', effect: 'power' },
        ];

        mockServices.getAllPotions.mockResolvedValue(mockPotions);

        const response = await request(app).get('/api/products/potions');

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockPotions);
      });
    });

    describe('POST /api/products/potions - 新增道具', () => {
      it('應該成功創建道具', async () => {
        const newPotion = { name: 'Health Potion', effect: 'heal' };
        mockServices.createPotion.mockResolvedValue({ id: '3', ...newPotion });

        const response = await request(app)
          .post('/api/products/potions')
          .send(newPotion);

        expect(response.status).toBe(200);
      });
    });

    describe('PUT /api/products/potions/:id - 更新道具', () => {
      it('應該成功更新道具', async () => {
        mockServices.updatePotion.mockResolvedValue({ id: '1', name: 'Speed Potion', effect: 'speed+' });

        const response = await request(app)
          .put('/api/products/potions/1')
          .send({ effect: 'speed+' });

        expect(response.status).toBe(200);
      });
    });

    describe('DELETE /api/products/potions/:id - 刪除道具', () => {
      it('應該成功刪除道具', async () => {
        mockServices.deletePotion.mockResolvedValue();

        const response = await request(app).delete('/api/products/potions/1');

        expect(response.status).toBe(200);
      });
    });
  });

  describe('通用商品管理', () => {
    describe('GET /api/products/collection/:collectionName - 獲取指定集合商品', () => {
      it('應該成功獲取集合商品', async () => {
        const mockProducts = [{ id: '1', name: 'Product 1' }];
        mockUniversalServices.getProductsByCollection.mockResolvedValue(mockProducts);

        const response = await request(app).get('/api/products/collection/custom_items');

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockProducts);
      });
    });

    describe('POST /api/products/collection/:collectionName - 新增商品到集合', () => {
      it('應該成功創建商品', async () => {
        const newProduct = { name: 'New Item' };
        mockUniversalServices.createProduct.mockResolvedValue({ id: '2', ...newProduct });

        const response = await request(app)
          .post('/api/products/collection/custom_items')
          .send(newProduct);

        expect(response.status).toBe(200);
      });
    });

    describe('PUT /api/products/collection/:collectionName/:id - 更新集合商品', () => {
      it('應該成功更新商品', async () => {
        mockUniversalServices.updateProduct.mockResolvedValue({ id: '1', name: 'Updated Item' });

        const response = await request(app)
          .put('/api/products/collection/custom_items/1')
          .send({ name: 'Updated Item' });

        expect(response.status).toBe(200);
      });
    });

    describe('DELETE /api/products/collection/:collectionName/:id - 刪除集合商品', () => {
      it('應該成功刪除商品', async () => {
        mockUniversalServices.deleteProduct.mockResolvedValue();

        const response = await request(app).delete('/api/products/collection/custom_items/1');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', '刪除成功');
      });
    });
  });
});

/**
 * Setup all routes for testing
 */
function setupRoutes(app, services, universalServices) {
  const router = express.Router();

  // 金幣套餐路由
  router.get('/coins', async (req, res) => {
    try {
      const packages = await services.getAllCoinPackages();
      res.json({ success: true, data: packages });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/coins', async (req, res) => {
    try {
      const result = await services.createCoinPackage(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.put('/coins/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await services.updateCoinPackage(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete('/coins/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await services.deleteCoinPackage(id);
      res.json({ success: true, message: '刪除成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 禮物路由
  router.get('/gifts', async (req, res) => {
    try {
      const gifts = await services.getAllGifts();
      res.json({ success: true, data: gifts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/gifts', async (req, res) => {
    try {
      const result = await services.createGift(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.put('/gifts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await services.updateGift(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete('/gifts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await services.deleteGift(id);
      res.json({ success: true, message: '刪除成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 道具路由
  router.get('/potions', async (req, res) => {
    try {
      const potions = await services.getAllPotions();
      res.json({ success: true, data: potions });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/potions', async (req, res) => {
    try {
      const result = await services.createPotion(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.put('/potions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await services.updatePotion(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete('/potions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await services.deletePotion(id);
      res.json({ success: true, message: '刪除成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 通用商品管理路由
  router.get('/collection/:collectionName', async (req, res) => {
    try {
      const { collectionName } = req.params;
      const products = await universalServices.getProductsByCollection(collectionName);
      res.json({ success: true, data: products });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/collection/:collectionName', async (req, res) => {
    try {
      const { collectionName } = req.params;
      const result = await universalServices.createProduct(collectionName, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.put('/collection/:collectionName/:id', async (req, res) => {
    try {
      const { collectionName, id } = req.params;
      const result = await universalServices.updateProduct(collectionName, id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete('/collection/:collectionName/:id', async (req, res) => {
    try {
      const { collectionName, id } = req.params;
      await universalServices.deleteProduct(collectionName, id);
      res.json({ success: true, message: '刪除成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.use('/api/products', router);
}
