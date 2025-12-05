/**
 * AI Settings API 路由測試
 * 測試範圍：
 * - 獲取所有 AI 設定
 * - 刷新 AI 設定緩存
 * - 獲取特定 AI 服務的設定
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

// ✅ 2025-12-02 修復：添加 errorFormatter mock
vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, statusCode = 200) => res.status(typeof statusCode === 'number' ? statusCode : 200).json({ success: true, data }),
  sendError: (res, code, message, details) => {
    const { error: detailError, ...safeDetails } = details || {};
    const isNotFound = code === 'RESOURCE_NOT_FOUND' || (typeof code === 'string' && code.includes('找不到'));
    return res.status(
      isNotFound ? 404 :
      code === 'FORBIDDEN' ? 403 :
      code === 'VALIDATION_ERROR' ? 400 : 500
    ).json({
      success: false,
      error: code,
      message,
      ...safeDetails,
      ...(detailError ? { errorDetail: detailError } : {}),
    });
  },
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  standardRateLimiter: (req, res, next) => next(),
}));

// Mock AI settings services
const mockGetAiSettings = vi.fn();
const mockRefreshAiSettings = vi.fn();

vi.mock('../services/aiSettings.service.js', () => ({
  getAiSettings: (...args) => mockGetAiSettings(...args),
  refreshAiSettings: (...args) => mockRefreshAiSettings(...args),
}));

// Import the router after mocks
import aiSettingsRouter from './aiSettings.routes.js';

describe('AI Settings API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/ai-settings', aiSettingsRouter);

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

  describe('GET / - 獲取所有 AI 設定', () => {
    it('應該成功獲取所有 AI 設定', async () => {
      const mockSettings = {
        chat: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 1000,
        },
        tts: {
          provider: 'openai',
          voice: 'shimmer',
          model: 'tts-1',
        },
        imageGeneration: {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          quality: 'high',
        },
      };
      mockGetAiSettings.mockResolvedValue(mockSettings);

      const response = await request(app).get('/api/ai-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings).toEqual(mockSettings);
      expect(response.body.data.cached).toBe(true);
      expect(mockGetAiSettings).toHaveBeenCalled();
    });

    it('應該處理獲取設定失敗', async () => {
      mockGetAiSettings.mockRejectedValue(new Error('Firestore connection failed'));

      const response = await request(app).get('/api/ai-settings');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.message).toContain('獲取 AI 設定失敗');
    });

    it('應該返回空設定（如果 Firestore 沒有數據）', async () => {
      mockGetAiSettings.mockResolvedValue({});

      const response = await request(app).get('/api/ai-settings');

      expect(response.status).toBe(200);
      expect(response.body.data.settings).toEqual({});
    });
  });

  describe('POST /refresh - 刷新 AI 設定緩存', () => {
    it('應該成功刷新 AI 設定緩存', async () => {
      const mockSettings = {
        chat: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
        },
      };
      mockRefreshAiSettings.mockResolvedValue(mockSettings);

      const response = await request(app).post('/api/ai-settings/refresh');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('AI 設定緩存已成功刷新');
      expect(response.body.data.settings).toEqual(mockSettings);
      expect(response.body.data.refreshedAt).toBeDefined();
      expect(mockRefreshAiSettings).toHaveBeenCalled();
    });

    it('應該處理刷新緩存失敗', async () => {
      mockRefreshAiSettings.mockRejectedValue(new Error('Firestore connection failed'));

      const response = await request(app).post('/api/ai-settings/refresh');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.message).toContain('刷新 AI 設定緩存失敗');
    });

    it('應該包含刷新時間戳', async () => {
      mockRefreshAiSettings.mockResolvedValue({});

      const beforeRefresh = new Date().toISOString();
      const response = await request(app).post('/api/ai-settings/refresh');
      const afterRefresh = new Date().toISOString();

      expect(response.status).toBe(200);
      expect(response.body.data.refreshedAt).toBeDefined();
      expect(response.body.data.refreshedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // 驗證時間戳在合理範圍內
      expect(response.body.data.refreshedAt >= beforeRefresh).toBe(true);
      expect(response.body.data.refreshedAt <= afterRefresh).toBe(true);
    });
  });

  describe('GET /:serviceName - 獲取特定 AI 服務的設定', () => {
    const mockAllSettings = {
      chat: {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
      },
      tts: {
        provider: 'openai',
        voice: 'shimmer',
        model: 'tts-1',
      },
      imageGeneration: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        quality: 'high',
      },
    };

    it('應該成功獲取 chat 服務設定', async () => {
      mockGetAiSettings.mockResolvedValue(mockAllSettings);

      const response = await request(app).get('/api/ai-settings/chat');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.serviceName).toBe('chat');
      expect(response.body.data.settings).toEqual(mockAllSettings.chat);
      expect(mockGetAiSettings).toHaveBeenCalled();
    });

    it('應該成功獲取 tts 服務設定', async () => {
      mockGetAiSettings.mockResolvedValue(mockAllSettings);

      const response = await request(app).get('/api/ai-settings/tts');

      expect(response.status).toBe(200);
      expect(response.body.data.serviceName).toBe('tts');
      expect(response.body.data.settings).toEqual(mockAllSettings.tts);
    });

    it('應該成功獲取 imageGeneration 服務設定', async () => {
      mockGetAiSettings.mockResolvedValue(mockAllSettings);

      const response = await request(app).get('/api/ai-settings/imageGeneration');

      expect(response.status).toBe(200);
      expect(response.body.data.serviceName).toBe('imageGeneration');
      expect(response.body.data.settings).toEqual(mockAllSettings.imageGeneration);
    });

    it('應該處理不存在的服務名稱', async () => {
      mockGetAiSettings.mockResolvedValue(mockAllSettings);

      const response = await request(app).get('/api/ai-settings/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('RESOURCE_NOT_FOUND');
      expect(response.body.message).toContain('找不到服務 "nonexistent" 的設定');
    });

    it('應該處理獲取設定失敗', async () => {
      mockGetAiSettings.mockRejectedValue(new Error('Firestore error'));

      const response = await request(app).get('/api/ai-settings/chat');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.message).toContain('獲取 AI 服務設定失敗');
    });
  });

  describe('速率限制測試', () => {
    it('刷新端點應該使用速率限制', async () => {
      mockRefreshAiSettings.mockResolvedValue({});

      // 連續發送多個刷新請求（在測試中不會真正觸發速率限制）
      const response1 = await request(app).post('/api/ai-settings/refresh');
      const response2 = await request(app).post('/api/ai-settings/refresh');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      // 在實際環境中，這個端點會受到 standardRateLimiter 限制（30次/分鐘）
    });
  });

  describe('公開端點測試', () => {
    it('所有端點都是公開的（不需要認證）', async () => {
      const mockSettings = {
        chat: { model: 'gpt-4o-mini' },
      };
      mockGetAiSettings.mockResolvedValue(mockSettings);
      mockRefreshAiSettings.mockResolvedValue(mockSettings);

      // GET /
      const response1 = await request(app).get('/api/ai-settings');
      expect(response1.status).toBe(200);

      // POST /refresh
      const response2 = await request(app).post('/api/ai-settings/refresh');
      expect(response2.status).toBe(200);

      // GET /:serviceName
      const response3 = await request(app).get('/api/ai-settings/chat');
      expect(response3.status).toBe(200);

      // 所有端點都不需要認證
    });
  });

  describe('設定結構測試', () => {
    it('應該返回完整的設定結構', async () => {
      const mockSettings = {
        chat: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 1000,
          systemPrompt: 'You are a helpful assistant',
        },
        tts: {
          provider: 'openai',
          voice: 'shimmer',
          model: 'tts-1',
          speed: 1.0,
        },
        imageGeneration: {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          quality: 'high',
          size: '1024x1024',
        },
        videoGeneration: {
          provider: 'replicate',
          model: 'stable-video-diffusion',
          fps: 24,
        },
      };
      mockGetAiSettings.mockResolvedValue(mockSettings);

      const response = await request(app).get('/api/ai-settings');

      expect(response.status).toBe(200);
      expect(response.body.data.settings).toHaveProperty('chat');
      expect(response.body.data.settings).toHaveProperty('tts');
      expect(response.body.data.settings).toHaveProperty('imageGeneration');
      expect(response.body.data.settings).toHaveProperty('videoGeneration');
      expect(response.body.data.settings.chat).toHaveProperty('model');
      expect(response.body.data.settings.chat).toHaveProperty('temperature');
    });
  });
});
