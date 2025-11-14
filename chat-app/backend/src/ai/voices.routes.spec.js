/**
 * Voices API 路由測試
 * 測試範圍：
 * - 獲取所有可用語音列表
 * - 獲取推薦的語音列表
 * - 按語言分組獲取語音
 * - 獲取語音映射表
 * - 獲取當前使用的 TTS 服務
 * - Google TTS 和 OpenAI TTS 模式切換
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import voicesRouter from './voices.routes.js';

// Mock dependencies
vi.mock('./googleTts.service.js', () => ({
  GOOGLE_VOICES: [
    {
      id: 'cmn-TW-Wavenet-A',
      name: '台灣國語女聲 A',
      gender: 'FEMALE',
      locale: 'cmn-TW',
      quality: 'WaveNet',
      description: '溫柔、自然',
      ageGroup: 'adult',
      recommended: true,
    },
    {
      id: 'cmn-TW-Wavenet-B',
      name: '台灣國語男聲 B',
      gender: 'MALE',
      locale: 'cmn-TW',
      quality: 'WaveNet',
      description: '沉穩、專業',
      ageGroup: 'adult',
      recommended: true,
    },
    {
      id: 'en-US-Neural2-A',
      name: 'US English Female A',
      gender: 'FEMALE',
      locale: 'en-US',
      quality: 'Neural2',
      description: 'Clear, professional',
      ageGroup: 'adult',
      recommended: false,
    },
  ],
  getRecommendedVoices: vi.fn(() => [
    {
      id: 'cmn-TW-Wavenet-A',
      name: '台灣國語女聲 A',
      gender: 'FEMALE',
      locale: 'cmn-TW',
      quality: 'WaveNet',
      description: '溫柔、自然',
      ageGroup: 'adult',
      recommended: true,
    },
    {
      id: 'cmn-TW-Wavenet-B',
      name: '台灣國語男聲 B',
      gender: 'MALE',
      locale: 'cmn-TW',
      quality: 'WaveNet',
      description: '沉穩、專業',
      ageGroup: 'adult',
      recommended: true,
    },
  ]),
  getVoicesByLocale: vi.fn(() => ({
    'cmn-TW': [
      {
        id: 'cmn-TW-Wavenet-A',
        name: '台灣國語女聲 A',
        gender: 'FEMALE',
        quality: 'WaveNet',
        description: '溫柔、自然',
        ageGroup: 'adult',
        recommended: true,
      },
      {
        id: 'cmn-TW-Wavenet-B',
        name: '台灣國語男聲 B',
        gender: 'MALE',
        quality: 'WaveNet',
        description: '沉穩、專業',
        ageGroup: 'adult',
        recommended: true,
      },
    ],
    'en-US': [
      {
        id: 'en-US-Neural2-A',
        name: 'US English Female A',
        gender: 'FEMALE',
        quality: 'Neural2',
        description: 'Clear, professional',
        ageGroup: 'adult',
        recommended: false,
      },
    ],
  })),
  VOICE_MAPPING: {
    nova: 'cmn-TW-Wavenet-A',
    shimmer: 'cmn-TW-Wavenet-B',
    alloy: 'cmn-TW-Standard-A',
  },
}));

vi.mock('../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data) => res.json({ success: true, ...data }),
  sendError: (res, code, message, details) => res.status(400).json({ success: false, error: code, message, details }),
  ApiError: class ApiError extends Error {
    constructor(code, message, statusCode) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Voices API Routes', () => {
  let app;
  let originalEnv;

  beforeEach(async () => {
    // 備份原始環境變數
    originalEnv = process.env.USE_GOOGLE_TTS;

    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/voices', voicesRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢復環境變數
    if (originalEnv !== undefined) {
      process.env.USE_GOOGLE_TTS = originalEnv;
    } else {
      delete process.env.USE_GOOGLE_TTS;
    }
  });

  describe('GET /api/voices - 獲取所有可用語音列表', () => {
    it('應該返回 OpenAI 語音列表（默認）', async () => {
      delete process.env.USE_GOOGLE_TTS;

      const response = await request(app)
        .get('/api/voices');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('openai');
      expect(response.body.voices).toBeDefined();
      expect(Array.isArray(response.body.voices)).toBe(true);
      expect(response.body.voices.length).toBeGreaterThan(0);
    });

    it('應該返回 Google TTS 語音列表', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response = await request(app)
        .get('/api/voices');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('google');
      expect(response.body.count).toBe(3);
      expect(response.body.voices).toBeDefined();
      expect(Array.isArray(response.body.voices)).toBe(true);
      expect(response.body.voices[0].id).toBe('cmn-TW-Wavenet-A');
    });

    it('OpenAI 語音應該包含必要的欄位', async () => {
      delete process.env.USE_GOOGLE_TTS;

      const response = await request(app)
        .get('/api/voices');

      expect(response.status).toBe(200);
      const voice = response.body.voices[0];
      expect(voice).toHaveProperty('id');
      expect(voice).toHaveProperty('name');
      expect(voice).toHaveProperty('gender');
      expect(voice).toHaveProperty('locale');
      expect(voice).toHaveProperty('quality');
      expect(voice).toHaveProperty('previewUrl');
    });

    it('Google 語音應該包含必要的欄位', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response = await request(app)
        .get('/api/voices');

      expect(response.status).toBe(200);
      const voice = response.body.voices[0];
      expect(voice).toHaveProperty('id');
      expect(voice).toHaveProperty('name');
      expect(voice).toHaveProperty('gender');
      expect(voice).toHaveProperty('locale');
      expect(voice).toHaveProperty('quality');
      expect(voice).toHaveProperty('ageGroup');
      expect(voice).toHaveProperty('previewUrl');
    });
  });

  describe('GET /api/voices/recommended - 獲取推薦的語音列表', () => {
    it('應該返回 OpenAI 推薦語音', async () => {
      delete process.env.USE_GOOGLE_TTS;

      const response = await request(app)
        .get('/api/voices/recommended');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('openai');
      expect(response.body.count).toBe(2);
      expect(response.body.voices).toBeDefined();
      expect(response.body.voices.length).toBe(2);
      expect(response.body.voices[0].id).toBe('nova');
      expect(response.body.voices[1].id).toBe('shimmer');
    });

    it('應該返回 Google TTS 推薦語音', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response = await request(app)
        .get('/api/voices/recommended');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('google');
      expect(response.body.count).toBe(2);
      expect(response.body.voices).toBeDefined();
      expect(response.body.voices[0].id).toBe('cmn-TW-Wavenet-A');
    });

    it('推薦語音應該包含預覽 URL', async () => {
      delete process.env.USE_GOOGLE_TTS;

      const response = await request(app)
        .get('/api/voices/recommended');

      expect(response.status).toBe(200);
      response.body.voices.forEach(voice => {
        expect(voice.previewUrl).toBeDefined();
        expect(typeof voice.previewUrl).toBe('string');
      });
    });
  });

  describe('GET /api/voices/by-locale - 按語言分組獲取語音', () => {
    it('應該返回 OpenAI 語音分組', async () => {
      delete process.env.USE_GOOGLE_TTS;

      const response = await request(app)
        .get('/api/voices/by-locale');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('openai');
      expect(response.body.locales).toBeDefined();
      expect(Array.isArray(response.body.locales)).toBe(true);
      expect(response.body.locales).toContain('multi');
      expect(response.body.voices).toBeDefined();
      expect(response.body.voices.multi).toBeDefined();
    });

    it('應該返回 Google TTS 語音分組', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response = await request(app)
        .get('/api/voices/by-locale');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('google');
      expect(response.body.locales).toBeDefined();
      expect(Array.isArray(response.body.locales)).toBe(true);
      expect(response.body.locales).toContain('cmn-TW');
      expect(response.body.locales).toContain('en-US');
    });

    it('Google 語音分組應該正確分類', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response = await request(app)
        .get('/api/voices/by-locale');

      expect(response.status).toBe(200);
      expect(response.body.voices['cmn-TW']).toBeDefined();
      expect(response.body.voices['cmn-TW'].length).toBe(2);
      expect(response.body.voices['en-US']).toBeDefined();
      expect(response.body.voices['en-US'].length).toBe(1);
    });
  });

  describe('GET /api/voices/mapping - 獲取語音映射表', () => {
    it('應該返回語音映射表', async () => {
      const response = await request(app)
        .get('/api/voices/mapping');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.mapping).toBeDefined();
      expect(typeof response.body.mapping).toBe('object');
    });

    it('映射表應該包含 OpenAI 到 Google 的映射', async () => {
      const response = await request(app)
        .get('/api/voices/mapping');

      expect(response.status).toBe(200);
      expect(response.body.mapping.nova).toBeDefined();
      expect(response.body.mapping.shimmer).toBeDefined();
      expect(response.body.description).toBeDefined();
    });

    it('映射表不受環境變數影響', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response1 = await request(app)
        .get('/api/voices/mapping');

      delete process.env.USE_GOOGLE_TTS;

      const response2 = await request(app)
        .get('/api/voices/mapping');

      expect(response1.body.mapping).toEqual(response2.body.mapping);
    });
  });

  describe('GET /api/voices/service - 獲取當前使用的 TTS 服務', () => {
    it('應該返回 OpenAI 服務資訊（默認）', async () => {
      delete process.env.USE_GOOGLE_TTS;

      const response = await request(app)
        .get('/api/voices/service');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('openai');
      expect(response.body.name).toBe('OpenAI TTS');
      expect(response.body.features).toBeDefined();
    });

    it('應該返回 Google TTS 服務資訊', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response = await request(app)
        .get('/api/voices/service');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('google');
      expect(response.body.name).toBe('Google Cloud TTS');
      expect(response.body.features).toBeDefined();
    });

    it('OpenAI 服務特性應該包含成本資訊', async () => {
      delete process.env.USE_GOOGLE_TTS;

      const response = await request(app)
        .get('/api/voices/service');

      expect(response.status).toBe(200);
      expect(response.body.features.costPerMillion).toBeDefined();
      expect(response.body.features.voiceCount).toBeDefined();
      expect(response.body.features.taiwanVoices).toBe(false);
    });

    it('Google TTS 服務特性應該包含成本資訊', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response = await request(app)
        .get('/api/voices/service');

      expect(response.status).toBe(200);
      expect(response.body.features.costPerMillion).toBeDefined();
      expect(response.body.features.freeQuota).toBeDefined();
      expect(response.body.features.voiceCount).toBeDefined();
      expect(response.body.features.taiwanVoices).toBe(true);
      expect(response.body.features.ssmlSupport).toBe(true);
    });
  });

  describe('環境變數切換測試', () => {
    it('USE_GOOGLE_TTS=false 應該使用 OpenAI', async () => {
      process.env.USE_GOOGLE_TTS = 'false';

      const response = await request(app)
        .get('/api/voices');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('openai');
    });

    it('USE_GOOGLE_TTS=true 應該使用 Google TTS', async () => {
      process.env.USE_GOOGLE_TTS = 'true';

      const response = await request(app)
        .get('/api/voices');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('google');
    });

    it('環境變數未設置應該默認使用 OpenAI', async () => {
      delete process.env.USE_GOOGLE_TTS;

      const response = await request(app)
        .get('/api/voices/service');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('openai');
    });
  });
});
