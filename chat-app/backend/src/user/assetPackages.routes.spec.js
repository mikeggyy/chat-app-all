/**
 * AssetPackages API 路由測試
 * 測試範圍：
 * - 獲取解鎖卡套餐列表
 * - 獲取藥水商品列表
 * - 排序和過濾邏輯
 * - 錯誤處理
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

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  relaxedRateLimiter: (req, res, next) => next(),
}));

// ✅ 2025-12-02 修復：添加 errorFormatter mock
vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, options = {}) => {
    const status = options.status || 200;
    return res.status(status).json({ success: true, data });
  },
  sendError: (res, code, message, details) => {
    const status = code === 'INTERNAL_SERVER_ERROR' ? 500 : 400;
    return res.status(status).json({
      success: false,
      error: code,
      message,
      ...(details || {}),
    });
  },
}));

// Mock Firestore
const mockFirestoreGet = vi.fn();
const mockFirestoreWhere = vi.fn(() => ({
  get: mockFirestoreGet,
}));
const mockFirestoreCollection = vi.fn((collectionName) => ({
  where: mockFirestoreWhere,
}));

vi.mock('../firebase/index.js', () => ({
  getFirestoreDb: vi.fn(() => ({
    collection: mockFirestoreCollection,
  })),
}));

// Import the router after mocks
import assetPackagesRouter from './assetPackages.routes.js';

describe('AssetPackages API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use(assetPackagesRouter);

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

  describe('GET /api/assets/packages - 獲取解鎖卡套餐', () => {
    it('應該成功獲取解鎖卡套餐列表', async () => {
      const mockPackages = [
        { id: 'video-unlock-1', name: '1支影片卡', price: 10, status: 'active', order: 1 },
        { id: 'video-unlock-5', name: '5支影片卡', price: 45, status: 'active', order: 2 },
        { id: 'video-unlock-10', name: '10支影片卡', price: 85, status: 'active', order: 3 },
      ];

      const mockSnapshot = {
        forEach: (callback) => {
          mockPackages.forEach((pkg) => {
            callback({
              id: pkg.id,
              data: () => ({ name: pkg.name, price: pkg.price, status: pkg.status, order: pkg.order }),
            });
          });
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/assets/packages');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.packages).toHaveLength(3);
      expect(response.body.data.packages[0].id).toBe('video-unlock-1');

      // 驗證 Firestore 查詢
      expect(mockFirestoreCollection).toHaveBeenCalledWith('asset_packages');
      expect(mockFirestoreWhere).toHaveBeenCalledWith('status', '==', 'active');
      expect(mockFirestoreGet).toHaveBeenCalled();
    });

    it('應該只返回 active 狀態的商品', async () => {
      const mockSnapshot = {
        forEach: (callback) => {
          // 只有 active 狀態的商品（已被 Firestore 過濾）
          [
            { id: 'pkg-1', name: 'Package 1', status: 'active', order: 1 },
            { id: 'pkg-2', name: 'Package 2', status: 'active', order: 2 },
          ].forEach((pkg) => {
            callback({
              id: pkg.id,
              data: () => pkg,
            });
          });
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/assets/packages');

      expect(response.status).toBe(200);
      expect(response.body.data.packages).toHaveLength(2);
      // 驗證所有返回的商品都是 active
      response.body.data.packages.forEach((pkg) => {
        expect(pkg.status).toBe('active');
      });

      // 驗證 Firestore where 查詢
      expect(mockFirestoreWhere).toHaveBeenCalledWith('status', '==', 'active');
    });

    it('應該按 order 欄位排序', async () => {
      const mockPackages = [
        { id: 'pkg-3', name: 'Package 3', status: 'active', order: 30 },
        { id: 'pkg-1', name: 'Package 1', status: 'active', order: 10 },
        { id: 'pkg-2', name: 'Package 2', status: 'active', order: 20 },
      ];

      const mockSnapshot = {
        forEach: (callback) => {
          mockPackages.forEach((pkg) => {
            callback({
              id: pkg.id,
              data: () => pkg,
            });
          });
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/assets/packages');

      expect(response.status).toBe(200);
      expect(response.body.data.packages).toHaveLength(3);
      // 驗證排序（應該按 order 從小到大）
      expect(response.body.data.packages[0].order).toBe(10);
      expect(response.body.data.packages[1].order).toBe(20);
      expect(response.body.data.packages[2].order).toBe(30);
    });

    it('應該處理沒有 order 欄位的商品（默認為 0）', async () => {
      const mockPackages = [
        { id: 'pkg-1', name: 'Package 1', status: 'active' }, // 沒有 order
        { id: 'pkg-2', name: 'Package 2', status: 'active', order: 10 },
      ];

      const mockSnapshot = {
        forEach: (callback) => {
          mockPackages.forEach((pkg) => {
            callback({
              id: pkg.id,
              data: () => pkg,
            });
          });
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/assets/packages');

      expect(response.status).toBe(200);
      expect(response.body.data.packages).toHaveLength(2);
      // 沒有 order 的商品應該排在前面（order || 0）
      expect(response.body.data.packages[0].id).toBe('pkg-1');
      expect(response.body.data.packages[1].id).toBe('pkg-2');
    });

    it('應該處理空列表', async () => {
      const mockSnapshot = {
        forEach: (callback) => {
          // 空列表
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/assets/packages');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.packages).toHaveLength(0);
    });

    it('應該處理 Firestore 錯誤', async () => {
      mockFirestoreGet.mockRejectedValue(new Error('Firestore connection failed'));

      const response = await request(app).get('/api/assets/packages');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('獲取套餐列表失敗');
    });
  });

  describe('GET /api/potions/packages - 獲取藥水商品', () => {
    it('應該成功獲取藥水商品列表', async () => {
      const mockPotions = [
        { id: 'potion-voice-1h', name: '語音藥水 1小時', price: 20, status: 'active', order: 1 },
        { id: 'potion-photo-1d', name: '照片藥水 1天', price: 50, status: 'active', order: 2 },
        { id: 'potion-combo', name: '萬能藥水', price: 100, status: 'active', order: 3 },
      ];

      const mockSnapshot = {
        forEach: (callback) => {
          mockPotions.forEach((potion) => {
            callback({
              id: potion.id,
              data: () => ({ name: potion.name, price: potion.price, status: potion.status, order: potion.order }),
            });
          });
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/potions/packages');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.potions).toHaveLength(3);
      expect(response.body.data.potions[0].id).toBe('potion-voice-1h');

      // 驗證 Firestore 查詢
      expect(mockFirestoreCollection).toHaveBeenCalledWith('potions');
      expect(mockFirestoreWhere).toHaveBeenCalledWith('status', '==', 'active');
      expect(mockFirestoreGet).toHaveBeenCalled();
    });

    it('應該只返回 active 狀態的藥水', async () => {
      const mockSnapshot = {
        forEach: (callback) => {
          [
            { id: 'potion-1', name: 'Potion 1', status: 'active', order: 1 },
            { id: 'potion-2', name: 'Potion 2', status: 'active', order: 2 },
          ].forEach((potion) => {
            callback({
              id: potion.id,
              data: () => potion,
            });
          });
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/potions/packages');

      expect(response.status).toBe(200);
      expect(response.body.data.potions).toHaveLength(2);
      // 驗證所有返回的藥水都是 active
      response.body.data.potions.forEach((potion) => {
        expect(potion.status).toBe('active');
      });

      // 驗證 Firestore where 查詢
      expect(mockFirestoreWhere).toHaveBeenCalledWith('status', '==', 'active');
    });

    it('應該按 order 欄位排序', async () => {
      const mockPotions = [
        { id: 'potion-3', name: 'Potion 3', status: 'active', order: 30 },
        { id: 'potion-1', name: 'Potion 1', status: 'active', order: 10 },
        { id: 'potion-2', name: 'Potion 2', status: 'active', order: 20 },
      ];

      const mockSnapshot = {
        forEach: (callback) => {
          mockPotions.forEach((potion) => {
            callback({
              id: potion.id,
              data: () => potion,
            });
          });
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/potions/packages');

      expect(response.status).toBe(200);
      expect(response.body.data.potions).toHaveLength(3);
      // 驗證排序（應該按 order 從小到大）
      expect(response.body.data.potions[0].order).toBe(10);
      expect(response.body.data.potions[1].order).toBe(20);
      expect(response.body.data.potions[2].order).toBe(30);
    });

    it('應該處理沒有 order 欄位的藥水（默認為 0）', async () => {
      const mockPotions = [
        { id: 'potion-1', name: 'Potion 1', status: 'active' }, // 沒有 order
        { id: 'potion-2', name: 'Potion 2', status: 'active', order: 10 },
      ];

      const mockSnapshot = {
        forEach: (callback) => {
          mockPotions.forEach((potion) => {
            callback({
              id: potion.id,
              data: () => potion,
            });
          });
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/potions/packages');

      expect(response.status).toBe(200);
      expect(response.body.data.potions).toHaveLength(2);
      // 沒有 order 的藥水應該排在前面（order || 0）
      expect(response.body.data.potions[0].id).toBe('potion-1');
      expect(response.body.data.potions[1].id).toBe('potion-2');
    });

    it('應該處理空列表', async () => {
      const mockSnapshot = {
        forEach: (callback) => {
          // 空列表
        },
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/api/potions/packages');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.potions).toHaveLength(0);
    });

    it('應該處理 Firestore 錯誤', async () => {
      mockFirestoreGet.mockRejectedValue(new Error('Firestore connection failed'));

      const response = await request(app).get('/api/potions/packages');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('獲取藥水列表失敗');
    });
  });

  describe('速率限制測試', () => {
    it('應該使用 relaxedRateLimiter（60次/分鐘）', async () => {
      const mockSnapshot = {
        forEach: (callback) => {},
      };
      mockFirestoreGet.mockResolvedValue(mockSnapshot);

      // 連續發送多個請求（在測試中不會真正觸發速率限制，因為已 mock）
      const response1 = await request(app).get('/api/assets/packages');
      const response2 = await request(app).get('/api/potions/packages');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // 在實際環境中，這些端點都會受到 relaxedRateLimiter 限制
    });
  });
});
