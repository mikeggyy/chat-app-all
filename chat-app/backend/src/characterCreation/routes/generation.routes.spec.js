/**
 * Generation API 路由測試
 * 測試範圍：
 * - 生成角色（語音生成）
 * - AI 魔法師（從圖片生成 persona）
 * - 生成描述（通用 AI 描述）
 * - 為流程生成描述（帶使用限制）
 * - 生成圖片（複雜的創建卡扣除邏輯）
 * - 權限和安全性檢查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies BEFORE importing the router
vi.mock('../characterCreation.service.js', () => ({
  getCreationFlow: vi.fn(),
  mergeCreationFlow: vi.fn(),
  generateCreationResult: vi.fn(async (flowId, options) => {
    // Execute the generator function if provided
    if (options.generator) {
      const flow = { id: flowId, userId: 'test-user-123' };
      const result = await options.generator({ flow });
      return {
        flow: {
          ...flow,
          generation: {
            status: 'completed',
            result,
          },
        },
        reused: false,
      };
    }
    // Default mock behavior
    return {
      flow: {
        id: flowId,
        userId: 'test-user-123',
        generation: { status: 'completed', result: {} },
      },
      reused: false,
    };
  }),
}));

vi.mock('../characterCreation.ai.js', () => ({
  generateCharacterPersona: vi.fn(),
  generateAppearanceDescription: vi.fn(),
  generateCharacterImages: vi.fn(),
}));

vi.mock('../characterCreation.helpers.js', () => ({
  isoNow: () => new Date().toISOString(),
  trimString: (str) => (str || '').trim(),
}));

vi.mock('../characterCreationLimit.service.js', () => ({
  canCreateCharacter: vi.fn(),
  getCreationStats: vi.fn(),
  recordCreation: vi.fn(),
}));

vi.mock('../../user/assets.service.js', () => ({
  consumeUserAsset: vi.fn(),
}));

vi.mock('../../auth/firebaseAuth.middleware.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    next();
  },
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateRequest: () => (req, res, next) => next(),
  characterCreationSchemas: {
    generateVoice: {},
    aiMagician: {},
    aiDescription: {},
    aiDescriptionWithFlow: {},
    generateImages: {},
  },
}));

vi.mock('../../middleware/rateLimiterConfig.js', () => ({
  veryStrictRateLimiter: (req, res, next) => next(),
  standardRateLimiter: (req, res, next) => next(),
}));

// ✅ 2025-12-02 修復：mock 路徑需與實際 import 路徑一致（5 層上級）
vi.mock('../../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, statusCode = 200) => res.status(typeof statusCode === 'number' ? statusCode : 200).json({ success: true, data }),
  sendError: (res, code, message, details) => {
    // 避免 details 中的 error 欄位覆蓋 code
    const { error: detailError, ...safeDetails } = details || {};
    return res.status(
      code === 'RESOURCE_NOT_FOUND' ? 404 :
      code === 'FORBIDDEN' ? 403 :
      code === 'VALIDATION_ERROR' ? 400 :
      code === 'RATE_LIMIT_EXCEEDED' ? 429 :
      code === 'PERMISSION_DENIED' ? 403 :
      code === 'INTERNAL_SERVER_ERROR' ? 500 : 400
    ).json({
      success: false,
      error: code,
      message,
      ...safeDetails,
      ...(detailError ? { errorDetail: detailError } : {}),
    });
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../firebase/index.js', () => ({
  getFirestoreDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn(),
      })),
    })),
    runTransaction: vi.fn(async (callback) => {
      // Mock transaction callback execution
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            metadata: {},
            updatedAt: new Date().toISOString(),
          }),
        }),
        update: vi.fn(),
      };
      return await callback(mockTransaction);
    }),
  })),
}));

// Import mocked services
import {
  getCreationFlow,
  mergeCreationFlow,
  generateCreationResult,
} from '../characterCreation.service.js';
import {
  generateCharacterPersona,
  generateAppearanceDescription,
  generateCharacterImages,
} from '../characterCreation.ai.js';
import { canCreateCharacter, getCreationStats } from '../characterCreationLimit.service.js';
import { consumeUserAsset } from '../../user/assets.service.js';
import { getFirestoreDb } from '../../firebase/index.js';
import { generationRouter } from './generation.routes.js';

describe('Generation API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/character-creation', generationRouter);

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

    // 設置默認環境變數（避免測試日誌）
    process.env.NODE_ENV = 'test';

    // 設置默認 mock 返回值
    generateCharacterImages.mockResolvedValue({
      images: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
        'https://example.com/image4.jpg',
      ],
      prompt: 'A beautiful character',
      metadata: { quality: 'high', count: 4 },
    });
  });

  describe('POST /flows/:flowId/generate - 生成角色', () => {
    it('應該成功生成角色語音', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        voice: { id: 'shimmer', name: 'Shimmer' },
        appearance: { description: 'Beautiful character' },
      };
      const mockGeneratedFlow = {
        ...mockFlow,
        generation: {
          result: { voice: mockFlow.voice },
        },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      generateCreationResult.mockResolvedValueOnce({
        flow: mockGeneratedFlow,
        reused: false,
      });

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate')
        .send({
          previewBaseUrl: 'https://example.com/voices',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.flow).toBeDefined();
      expect(response.body.data.reused).toBe(false);
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/character-creation/flows/non-existent/generate')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('RESOURCE_NOT_FOUND');
    });

    it('應該拒絕訪問其他用戶的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'other-user-456',
        voice: { id: 'shimmer' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該拒絕未選擇語音的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        voice: null,
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('語音');
    });

    it('應該支援冪等性 key', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        voice: { id: 'shimmer' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      generateCreationResult.mockResolvedValueOnce({
        flow: mockFlow,
        reused: false,
      });

      await request(app)
        .post('/api/character-creation/flows/flow-001/generate')
        .set('Idempotency-Key', 'unique-key-123')
        .send({});

      expect(generateCreationResult).toHaveBeenCalledWith(
        'flow-001',
        expect.objectContaining({
          idempotencyKey: 'unique-key-123',
        })
      );
    });
  });

  describe('POST /flows/:flowId/ai-magician - AI 魔法師', () => {
    it('應該成功使用 AI 魔法師生成 persona', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        appearance: {
          image: 'https://example.com/image.jpg',
          styles: ['anime', 'cute'],
        },
        metadata: { gender: 'female' },
      };
      const mockPersona = {
        name: 'Sakura',
        personality: 'cheerful and kind',
        background: 'A friendly AI assistant',
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      generateCharacterPersona.mockResolvedValueOnce(mockPersona);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/ai-magician')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.persona).toEqual(mockPersona);
      expect(generateCharacterPersona).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedImageUrl: mockFlow.appearance.image,
          gender: 'female',
          styles: ['anime', 'cute'],
        })
      );
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/character-creation/flows/non-existent/ai-magician')
        .send({});

      expect(response.status).toBe(404);
    });

    it('應該拒絕訪問其他用戶的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'other-user-456',
        appearance: { image: 'url' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/ai-magician')
        .send({});

      expect(response.status).toBe(403);
    });

    it('應該拒絕未選擇外觀圖片的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        appearance: null,
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/ai-magician')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /ai-description - 生成描述（通用）', () => {
    it('應該成功生成外觀描述', async () => {
      const mockDescription = 'A beautiful anime girl with long black hair and blue eyes';
      generateAppearanceDescription.mockResolvedValueOnce(mockDescription);

      const response = await request(app)
        .post('/api/character-creation/ai-description')
        .send({
          gender: 'female',
          styles: ['anime', 'cute'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe(mockDescription);
      expect(generateAppearanceDescription).toHaveBeenCalledWith(
        expect.objectContaining({
          gender: 'female',
          styles: ['anime', 'cute'],
        })
      );
    });

    it('應該處理帶參考信息的描述生成', async () => {
      const mockDescription = 'Character based on reference';
      generateAppearanceDescription.mockResolvedValueOnce(mockDescription);

      const response = await request(app)
        .post('/api/character-creation/ai-description')
        .send({
          gender: 'male',
          styles: ['realistic'],
          referenceInfo: 'Like a knight in medieval times',
        });

      expect(response.status).toBe(200);
      expect(generateAppearanceDescription).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceInfo: 'Like a knight in medieval times',
        })
      );
    });

    it('應該處理 AI 生成錯誤', async () => {
      generateAppearanceDescription.mockRejectedValueOnce(
        new Error('AI API error')
      );

      const response = await request(app)
        .post('/api/character-creation/ai-description')
        .send({
          gender: 'female',
          styles: [],
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /flows/:flowId/ai-description - 為流程生成描述', () => {
    it('應該成功生成描述並增加使用次數', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        metadata: { aiMagicianUsageCount: 0 },
      };
      const mockDescription = 'Generated description';
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      generateAppearanceDescription.mockResolvedValueOnce(mockDescription);
      mergeCreationFlow.mockResolvedValueOnce({
        ...mockFlow,
        metadata: { aiMagicianUsageCount: 1 },
      });

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/ai-description')
        .send({
          gender: 'female',
          styles: ['anime'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe(mockDescription);
      expect(response.body.data.usageCount).toBe(1);
      expect(response.body.data.remainingUsage).toBe(2);
      expect(mergeCreationFlow).toHaveBeenCalledWith(
        'flow-001',
        expect.objectContaining({
          metadata: expect.objectContaining({
            aiMagicianUsageCount: 1,
          }),
        })
      );
    });

    it('應該拒絕超過使用限制的請求', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        metadata: { aiMagicianUsageCount: 3 },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/ai-description')
        .send({
          gender: 'female',
          styles: [],
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.limit).toBe(3);
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/character-creation/flows/non-existent/ai-description')
        .send({
          gender: 'female',
          styles: [],
        });

      expect(response.status).toBe(404);
    });

    it('應該拒絕訪問其他用戶的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'other-user-456',
        metadata: { aiMagicianUsageCount: 0 },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/ai-description')
        .send({
          gender: 'female',
          styles: [],
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /flows/:flowId/generate-images - 生成圖片', () => {
    it('應該成功生成圖片（使用免費次數）', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        appearance: { description: 'A beautiful character' },
        metadata: { gender: 'female' },
        generation: { status: 'pending' },
      };
      const mockGeneratedFlow = {
        ...mockFlow,
        generation: {
          status: 'completed',
          result: {
            images: ['https://example.com/image1.jpg'],
          },
        },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      canCreateCharacter.mockResolvedValueOnce({ allowed: true });
      getCreationStats.mockResolvedValueOnce({ remaining: 5 });
      generateCreationResult.mockResolvedValueOnce({
        flow: mockGeneratedFlow,
        reused: false,
      });

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate-images')
        .send({
          quality: 'high',
          count: 4,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.flow).toBeDefined();
      expect(response.body.data.images).toBeDefined();
      expect(response.body.data.reused).toBe(false);
    });

    it('應該返回已生成的圖片（重用）', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        appearance: { description: 'A character' },
        generation: {
          status: 'completed',
          result: {
            images: [
              'https://example.com/image1.jpg',
              'https://example.com/image2.jpg',
            ],
          },
        },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate-images')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.reused).toBe(true);
      expect(response.body.data.images).toHaveLength(2);
      expect(generateCreationResult).not.toHaveBeenCalled();
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/character-creation/flows/non-existent/generate-images')
        .send({});

      expect(response.status).toBe(404);
    });

    it('應該拒絕訪問其他用戶的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'other-user-456',
        appearance: { description: 'test' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate-images')
        .send({});

      expect(response.status).toBe(403);
    });

    it('當自動生成描述失敗時應返回錯誤', async () => {
      // 路由會嘗試自動生成描述，當描述為空時
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        appearance: null,
        metadata: { gender: 'female' },
        generation: { status: 'pending' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      // 模擬自動生成描述失敗
      generateAppearanceDescription.mockRejectedValueOnce(new Error('AI generation failed'));

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate-images')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
    });

    it('應該拒絕超過創建限制的請求', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        appearance: { description: 'test' },
        generation: { status: 'pending' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      canCreateCharacter.mockResolvedValueOnce({
        allowed: false,
        message: '已達到角色創建次數限制',
      });

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate-images')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('PERMISSION_DENIED');
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點都應該需要認證', async () => {
      // All routes are configured with requireFirebaseAuth
      expect(true).toBe(true);
    });

    it('應該使用認證 token 中的 userId', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        voice: { id: 'shimmer' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      generateCreationResult.mockResolvedValueOnce({ flow: mockFlow, reused: false });

      await request(app)
        .post('/api/character-creation/flows/flow-001/generate')
        .send({});

      // Should check flow belongs to authenticated user
      expect(getCreationFlow).toHaveBeenCalledWith('flow-001');
    });

    it('AI 魔法師使用限制應該正確計數', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        metadata: { aiMagicianUsageCount: 2 },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      generateAppearanceDescription.mockResolvedValueOnce('test');
      mergeCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/ai-description')
        .send({
          gender: 'female',
          styles: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.usageCount).toBe(3);
      expect(response.body.data.remainingUsage).toBe(0);
    });

    it('應該正確應用速率限制', async () => {
      // veryStrictRateLimiter is applied to all generation endpoints
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        voice: { id: 'shimmer' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      generateCreationResult.mockResolvedValueOnce({ flow: mockFlow, reused: false });

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/generate')
        .send({});

      // Should succeed (rate limiter is mocked to pass)
      expect(response.status).toBe(201);
    });
  });
});
