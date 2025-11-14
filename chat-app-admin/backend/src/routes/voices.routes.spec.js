/**
 * Voices Routes 測試（管理後台）
 * 測試範圍：
 * - 獲取語音列表（從主應用 API）
 * - 獲取推薦語音列表
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('Voices Routes - Admin Backend', () => {
  let app;
  let mockAxios;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    const axios = await import('axios');
    mockAxios = axios.default;

    setupRoutes(app, mockAxios);
    vi.clearAllMocks();
  });

  describe('GET /api/voices - 獲取所有語音列表', () => {
    it('應該成功從主應用獲取語音列表', async () => {
      const mockVoices = {
        voices: [
          { id: 'nova', name: 'Nova', gender: 'female' },
          { id: 'shimmer', name: 'Shimmer', gender: 'female' },
          { id: 'alloy', name: 'Alloy', gender: 'neutral' },
        ],
      };

      mockAxios.get.mockResolvedValue({ data: mockVoices });

      const response = await request(app).get('/api/voices');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockVoices);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/voices'),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('應該處理主應用 API 請求失敗', async () => {
      mockAxios.get.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/api/voices');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取語音列表失敗');
      expect(response.body).toHaveProperty('message', 'Connection refused');
    });

    it('應該處理主應用 API 超時', async () => {
      mockAxios.get.mockRejectedValue(new Error('Timeout exceeded'));

      const response = await request(app).get('/api/voices');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取語音列表失敗');
    });
  });

  describe('GET /api/voices/recommended - 獲取推薦語音列表', () => {
    it('應該成功獲取推薦語音列表', async () => {
      const mockRecommended = {
        recommended: [
          { id: 'nova', name: 'Nova', reason: 'Natural and friendly' },
          { id: 'shimmer', name: 'Shimmer', reason: 'Warm and expressive' },
        ],
      };

      mockAxios.get.mockResolvedValue({ data: mockRecommended });

      const response = await request(app).get('/api/voices/recommended');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommended);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/voices/recommended'),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('應該處理推薦語音獲取失敗', async () => {
      mockAxios.get.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app).get('/api/voices/recommended');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', '獲取推薦語音列表失敗');
      expect(response.body).toHaveProperty('message', 'Service unavailable');
    });
  });
});

/**
 * Setup all routes for testing
 */
function setupRoutes(app, axios) {
  const router = express.Router();
  const MAIN_APP_API_URL = process.env.MAIN_APP_API_URL || 'http://localhost:4000';

  // GET /api/voices
  router.get('/', async (req, res) => {
    try {
      const response = await axios.get(`${MAIN_APP_API_URL}/api/voices`, {
        timeout: 10000,
      });

      res.json(response.data);
    } catch (error) {
      console.error('[管理後台] 獲取語音列表失敗:', error.message);
      res.status(500).json({
        error: '獲取語音列表失敗',
        message: error.message,
      });
    }
  });

  // GET /api/voices/recommended
  router.get('/recommended', async (req, res) => {
    try {
      const response = await axios.get(`${MAIN_APP_API_URL}/api/voices/recommended`, {
        timeout: 10000,
      });

      res.json(response.data);
    } catch (error) {
      console.error('[管理後台] 獲取推薦語音列表失敗:', error.message);
      res.status(500).json({
        error: '獲取推薦語音列表失敗',
        message: error.message,
      });
    }
  });

  app.use('/api/voices', router);
}
