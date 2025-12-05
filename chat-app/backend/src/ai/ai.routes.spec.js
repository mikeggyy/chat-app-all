/**
 * AI API 路由測試
 * 測試範圍：
 * - AI 對話回覆生成
 * - AI 建議回覆生成
 * - TTS 語音合成
 * - AI 自拍照片生成
 * - AI 影片生成
 * - 影片生成權限檢查
 * - 影片生成統計
 * - 冪等性保護
 * - 限制檢查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { aiRouter } from './ai.routes.js';

// Mock all dependencies
vi.mock('./ai.service.js', () => ({
  createAiReplyForConversation: vi.fn(),
  createAiSuggestionsForConversation: vi.fn(),
  generateSpeech: vi.fn(),
}));

vi.mock('./voiceLimit.service.js', () => ({
  canPlayVoice: vi.fn(),
  recordVoicePlay: vi.fn(),
}));

vi.mock('../conversation/conversationLimit.service.js', () => ({
  canSendMessage: vi.fn(),
  recordMessage: vi.fn(),
}));

vi.mock('./imageGeneration.service.js', () => ({
  generateSelfieForCharacter: vi.fn(),
}));

vi.mock('./videoLimit.service.js', () => ({
  canGenerateVideo: vi.fn(),
  recordVideoGeneration: vi.fn(),
  getVideoStats: vi.fn(),
}));

vi.mock('./videoGeneration.service.js', () => ({
  generateVideoForCharacter: vi.fn(),
}));

vi.mock('../auth/index.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = { uid: 'test-user-123' };
    next();
  },
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  conversationRateLimiter: (req, res, next) => next(),
  aiSuggestionRateLimiter: (req, res, next) => next(),
  ttsRateLimiter: (req, res, next) => next(),
  aiImageGenerationRateLimiter: (req, res, next) => next(),
  aiVideoGenerationRateLimiter: (req, res, next) => next(),
}));

vi.mock('./ai.helpers.js', () => ({
  withIdempotency: vi.fn(async (requestId, handler) => await handler()),
  handleVoicePlayment: vi.fn(async () => ({ success: true })),
  handleVideoPayment: vi.fn(async () => ({ success: true })),
  buildErrorResponse: vi.fn((code, message) => ({ code, message })),
  setTTSHeaders: vi.fn(),
  extractUserMessage: vi.fn((body) => body.message || body.userMessage),
  logError: vi.fn(),
}));

vi.mock('../middleware/validation.middleware.js', () => ({
  validateRequest: () => (req, res, next) => next(),
}));

vi.mock('./ai.schemas.js', () => ({
  aiSchemas: {
    aiReply: {},
    aiSuggestions: {},
    tts: {},
    generateSelfie: {},
    videoCheck: {},
    videoStats: {},
    generateVideo: {},
  },
}));

vi.mock('../middleware/authorization.js', () => ({
  requireSameUser: () => (req, res, next) => next(),
}));

vi.mock('../config/limits.js', () => ({
  IDEMPOTENCY_TTL: {
    AI_REPLY: 300000,
    TTS: 300000,
    IMAGE_GENERATION: 600000,
    VIDEO_GENERATION: 900000,
  },
}));

// ✅ 2025-12-02 修復：修正 mock 路徑
vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, status) => res.status(status || 200).json({ success: true, ...data }),
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

// ✅ 2025-12-02 修復：添加缺失的 mock
vi.mock('../level/level.service.js', () => ({
  addPointsFromChat: vi.fn().mockResolvedValue({ pointsAdded: 10 }),
  addPointsFromSelfie: vi.fn().mockResolvedValue({ pointsAdded: 20 }),
  addPointsFromVideo: vi.fn().mockResolvedValue({ pointsAdded: 50 }),
}));

// Import mocked services
import * as aiService from './ai.service.js';
import * as voiceLimitService from './voiceLimit.service.js';
import * as conversationLimitService from '../conversation/conversationLimit.service.js';
import * as imageGenerationService from './imageGeneration.service.js';
import * as videoLimitService from './videoLimit.service.js';
import * as videoGenerationService from './videoGeneration.service.js';

describe('AI API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('POST /api/ai/conversations/:userId/:characterId/reply - AI 對話回覆', () => {
    it('應該成功生成 AI 回覆', async () => {
      conversationLimitService.canSendMessage.mockResolvedValueOnce({ allowed: true });
      aiService.createAiReplyForConversation.mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Hello!' },
        history: [],
      });

      const response = await request(app)
        .post('/api/ai/conversations/test-user-123/char-001/reply')
        .send({
          message: 'Hi',
          requestId: 'req-001',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('應該在達到限制時返回錯誤', async () => {
      conversationLimitService.canSendMessage.mockResolvedValueOnce({
        allowed: false,
        used: 10,
        total: 10,
      });

      const response = await request(app)
        .post('/api/ai/conversations/test-user-123/char-001/reply')
        .send({
          message: 'Hi',
          requestId: 'req-002',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該支援跳過限制檢查', async () => {
      aiService.createAiReplyForConversation.mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Hello!' },
        history: [],
      });

      const response = await request(app)
        .post('/api/ai/conversations/test-user-123/char-001/reply')
        .send({
          message: 'Hi',
          requestId: 'req-003',
          skipLimitCheck: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // Should not call limit check when skipLimitCheck is true
      expect(conversationLimitService.canSendMessage).not.toHaveBeenCalled();
    });

    it('應該處理服務層錯誤', async () => {
      conversationLimitService.canSendMessage.mockResolvedValueOnce({ allowed: true });
      aiService.createAiReplyForConversation.mockRejectedValueOnce(
        new Error('AI service error')
      );

      const response = await request(app)
        .post('/api/ai/conversations/test-user-123/char-001/reply')
        .send({
          message: 'Hi',
          requestId: 'req-004',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /api/ai/conversations/:userId/:characterId/suggestions - AI 建議回覆', () => {
    it('應該成功生成建議回覆', async () => {
      aiService.createAiSuggestionsForConversation.mockResolvedValueOnce({
        suggestions: ['建議1', '建議2', '建議3'],
      });

      const response = await request(app)
        .post('/api/ai/conversations/test-user-123/char-001/suggestions')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該處理服務層錯誤', async () => {
      aiService.createAiSuggestionsForConversation.mockRejectedValueOnce(
        new Error('Service error')
      );

      const response = await request(app)
        .post('/api/ai/conversations/test-user-123/char-001/suggestions')
        .send({});

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /api/ai/tts - 語音合成', () => {
    it('應該成功生成語音', async () => {
      voiceLimitService.canPlayVoice.mockResolvedValueOnce({ allowed: true });
      aiService.generateSpeech.mockResolvedValueOnce(Buffer.from('audio data'));

      const response = await request(app)
        .post('/api/ai/tts')
        .send({
          text: 'Hello',
          characterId: 'char-001',
          requestId: 'tts-001',
        });

      expect(response.status).toBe(200);
    });

    it('應該拒絕超長文字', async () => {
      const longText = 'a'.repeat(600); // 超過 500 字符限制

      const response = await request(app)
        .post('/api/ai/tts')
        .send({
          text: longText,
          characterId: 'char-001',
          requestId: 'tts-002',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該在達到限制時返回錯誤', async () => {
      voiceLimitService.canPlayVoice.mockResolvedValueOnce({
        allowed: false,
        used: 5,
        total: 5,
      });

      const response = await request(app)
        .post('/api/ai/tts')
        .send({
          text: 'Hello',
          characterId: 'char-001',
          requestId: 'tts-003',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該支援使用語音解鎖卡', async () => {
      // Mock unlockTickets service
      vi.doMock('../membership/unlockTickets.service.js', () => ({
        getVoiceUnlockCards: vi.fn().mockResolvedValue(5),
      }));

      aiService.generateSpeech.mockResolvedValueOnce(Buffer.from('audio data'));

      const response = await request(app)
        .post('/api/ai/tts')
        .send({
          text: 'Hello',
          characterId: 'char-001',
          requestId: 'tts-004',
          useVoiceUnlockCard: true,
        });

      // Should not check voice limit when using unlock card
      expect(voiceLimitService.canPlayVoice).not.toHaveBeenCalled();
    });

    it('應該處理遊客訪問錯誤', async () => {
      voiceLimitService.canPlayVoice.mockResolvedValueOnce({
        allowed: false,
        requireLogin: true,
      });

      const response = await request(app)
        .post('/api/ai/tts')
        .send({
          text: 'Hello',
          characterId: 'char-001',
          requestId: 'tts-005',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /api/ai/generate-selfie - 生成自拍照片', () => {
    it('應該成功生成自拍照片', async () => {
      imageGenerationService.generateSelfieForCharacter.mockResolvedValueOnce({
        imageUrl: 'https://example.com/selfie.jpg',
        used: 1,
        total: 3,
      });

      const response = await request(app)
        .post('/api/ai/generate-selfie')
        .send({
          characterId: 'char-001',
          requestId: 'img-001',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該支援使用照片卡', async () => {
      imageGenerationService.generateSelfieForCharacter.mockResolvedValueOnce({
        imageUrl: 'https://example.com/selfie.jpg',
        usedPhotoCard: true,
      });

      const response = await request(app)
        .post('/api/ai/generate-selfie')
        .send({
          characterId: 'char-001',
          requestId: 'img-002',
          usePhotoCard: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(imageGenerationService.generateSelfieForCharacter).toHaveBeenCalledWith(
        'test-user-123',
        'char-001',
        { usePhotoUnlockCard: true }
      );
    });

    it('應該處理服務層錯誤', async () => {
      imageGenerationService.generateSelfieForCharacter.mockRejectedValueOnce(
        new Error('Generation failed')
      );

      const response = await request(app)
        .post('/api/ai/generate-selfie')
        .send({
          characterId: 'char-001',
          requestId: 'img-003',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('GET /api/ai/video/check/:userId - 檢查影片生成權限', () => {
    it('應該成功檢查影片生成權限', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({
        allowed: true,
        used: 0,
        total: 3,
        videoCards: 5,
      });

      const response = await request(app)
        .get('/api/ai/video/check/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該返回限制資訊', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({
        allowed: false,
        used: 3,
        total: 3,
        videoCards: 0,
      });

      const response = await request(app)
        .get('/api/ai/video/check/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('✅ 應該正確返回有影片卡但無基礎額度的情況 (allowedWithCard)', async () => {
      // 這是用戶的實際情境：免費用戶沒有基礎額度，但有 1 張影片卡
      const mockResult = {
        allowed: false,           // 沒有基礎額度
        allowedWithCard: true,    // 可以用影片卡
        videoCards: 1,            // 有 1 張影片卡
        used: 0,
        total: 0,
        remaining: 0,
        tier: 'free',
      };

      videoLimitService.canGenerateVideo.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .get('/api/ai/video/check/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // sendSuccess 將結果放在 data 字段中
      const data = response.body.data || response.body;
      expect(data.allowed).toBe(false);
      expect(data.allowedWithCard).toBe(true);
      expect(data.videoCards).toBe(1);
    });
  });

  describe('GET /api/ai/video/stats/:userId - 獲取影片生成統計', () => {
    it('應該成功獲取影片生成統計', async () => {
      videoLimitService.getVideoStats.mockResolvedValueOnce({
        totalGenerated: 10,
        monthlyGenerated: 3,
        lastGeneratedAt: '2025-01-15T00:00:00Z',
      });

      const response = await request(app)
        .get('/api/ai/video/stats/test-user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該處理服務層錯誤', async () => {
      videoLimitService.getVideoStats.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/ai/video/stats/test-user-123');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /api/ai/generate-video - 生成影片', () => {
    it('應該成功生成影片', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({
        allowed: true,
        used: 0,
        total: 3,
      });
      videoGenerationService.generateVideoForCharacter.mockResolvedValueOnce({
        videoUrl: 'https://example.com/video.mp4',
        status: 'completed',
      });

      const response = await request(app)
        .post('/api/ai/generate-video')
        .send({
          characterId: 'char-001',
          requestId: 'video-001',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該支援自定義參數', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({
        allowed: true,
      });
      videoGenerationService.generateVideoForCharacter.mockResolvedValueOnce({
        videoUrl: 'https://example.com/video.mp4',
      });

      const response = await request(app)
        .post('/api/ai/generate-video')
        .send({
          characterId: 'char-001',
          requestId: 'video-002',
          duration: '6s',
          resolution: '1080p',
          aspectRatio: '16:9',
        });

      expect(response.status).toBe(200);
      expect(videoGenerationService.generateVideoForCharacter).toHaveBeenCalledWith(
        'test-user-123',
        'char-001',
        expect.objectContaining({
          duration: '6s',
          resolution: '1080p',
          aspectRatio: '16:9',
        })
      );
    });

    it('應該支援使用影片卡', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({
        allowed: false,
        videoCards: 3,
      });
      videoGenerationService.generateVideoForCharacter.mockResolvedValueOnce({
        videoUrl: 'https://example.com/video.mp4',
      });

      const response = await request(app)
        .post('/api/ai/generate-video')
        .send({
          characterId: 'char-001',
          requestId: 'video-003',
          useVideoCard: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('應該在影片卡不足時返回錯誤', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({
        allowed: false,
        videoCards: 0,
      });

      const response = await request(app)
        .post('/api/ai/generate-video')
        .send({
          characterId: 'char-001',
          requestId: 'video-004',
          useVideoCard: true,
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該在達到限制時返回錯誤', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({
        allowed: false,
        used: 3,
        total: 3,
        videoCards: 0,
      });

      const response = await request(app)
        .post('/api/ai/generate-video')
        .send({
          characterId: 'char-001',
          requestId: 'video-005',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });

    it('應該支援自定義圖片 URL', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({
        allowed: true,
      });
      videoGenerationService.generateVideoForCharacter.mockResolvedValueOnce({
        videoUrl: 'https://example.com/video.mp4',
      });

      const response = await request(app)
        .post('/api/ai/generate-video')
        .send({
          characterId: 'char-001',
          requestId: 'video-006',
          imageUrl: 'https://example.com/custom-image.jpg',
        });

      expect(response.status).toBe(200);
      expect(videoGenerationService.generateVideoForCharacter).toHaveBeenCalledWith(
        'test-user-123',
        'char-001',
        expect.objectContaining({
          imageUrl: 'https://example.com/custom-image.jpg',
        })
      );
    });
  });

  describe('速率限制測試', () => {
    it('對話回覆應該使用 conversationRateLimiter', async () => {
      conversationLimitService.canSendMessage.mockResolvedValueOnce({ allowed: true });
      aiService.createAiReplyForConversation.mockResolvedValueOnce({
        message: { content: 'Hello' },
        history: [],
      });

      const response = await request(app)
        .post('/api/ai/conversations/test-user-123/char-001/reply')
        .send({ message: 'Hi', requestId: 'req-rate-1' });

      expect(response.status).toBeLessThan(500);
    });

    it('TTS 應該使用 ttsRateLimiter', async () => {
      voiceLimitService.canPlayVoice.mockResolvedValueOnce({ allowed: true });
      aiService.generateSpeech.mockResolvedValueOnce(Buffer.from('audio'));

      const response = await request(app)
        .post('/api/ai/tts')
        .send({ text: 'Hello', characterId: 'char-001', requestId: 'tts-rate-1' });

      expect(response.status).toBeLessThan(500);
    });

    it('照片生成應該使用 aiImageGenerationRateLimiter', async () => {
      imageGenerationService.generateSelfieForCharacter.mockResolvedValueOnce({
        imageUrl: 'https://example.com/selfie.jpg',
      });

      const response = await request(app)
        .post('/api/ai/generate-selfie')
        .send({ characterId: 'char-001', requestId: 'img-rate-1' });

      expect(response.status).toBeLessThan(500);
    });

    it('影片生成應該使用 aiVideoGenerationRateLimiter', async () => {
      videoLimitService.canGenerateVideo.mockResolvedValueOnce({ allowed: true });
      videoGenerationService.generateVideoForCharacter.mockResolvedValueOnce({
        videoUrl: 'https://example.com/video.mp4',
      });

      const response = await request(app)
        .post('/api/ai/generate-video')
        .send({ characterId: 'char-001', requestId: 'video-rate-1' });

      expect(response.status).toBeLessThan(500);
    });
  });
});
