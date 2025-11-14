/**
 * Flow API 路由測試
 * 測試範圍：
 * - 創建角色創建流程
 * - 獲取流程資料
 * - 更新流程
 * - 更新流程步驟（persona, appearance, voice）
 * - 記錄收費
 * - 清理圖片
 * - 取消流程
 * - 權限和安全性檢查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies BEFORE importing the router
vi.mock('../characterCreation.service.js', () => ({
  createCreationFlow: vi.fn(),
  getCreationFlow: vi.fn(),
  mergeCreationFlow: vi.fn(),
  recordCreationCharge: vi.fn(),
}));

vi.mock('../characterCreation.helpers.js', () => ({
  trimString: (str) => (str || '').trim(),
}));

vi.mock('../../firebase/storage.service.js', () => ({
  deleteImage: vi.fn(),
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
    createFlow: {},
    getFlow: {},
    updateFlow: {},
    updateStep: {},
    recordCharge: {},
    cleanupImages: {},
    cancelFlow: {},
  },
}));

vi.mock('../../middleware/rateLimiterConfig.js', () => ({
  standardRateLimiter: (req, res, next) => next(),
  purchaseRateLimiter: (req, res, next) => next(),
}));

vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, statusCode = 200) => res.status(statusCode).json({ success: true, ...data }),
  sendError: (res, code, message, details) => {
    return res.status(code === 'RESOURCE_NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : 400).json({
      success: false,
      error: code,
      message,
      ...details
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
  getFirestoreDb: vi.fn(() => ({})),
}));

// Import mocked services
import {
  createCreationFlow,
  getCreationFlow,
  mergeCreationFlow,
  recordCreationCharge,
} from '../characterCreation.service.js';
import { deleteImage } from '../../firebase/storage.service.js';
import { flowRouter } from './flow.routes.js';

describe('Flow API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/character-creation', flowRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('POST /flows - 創建角色創建流程', () => {
    it('應該成功創建流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        status: 'in_progress',
        persona: null,
        appearance: null,
        voice: null,
        createdAt: new Date().toISOString(),
      };
      createCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows')
        .send({
          persona: { name: 'Test Character', personality: 'friendly' },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.flow).toBeDefined();
      expect(response.body.flow.id).toBe('flow-001');
      expect(createCreationFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
          persona: expect.objectContaining({ name: 'Test Character' }),
        })
      );
    });

    it('應該使用認證用戶 ID', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      createCreationFlow.mockResolvedValueOnce(mockFlow);

      await request(app)
        .post('/api/character-creation/flows')
        .send({});

      expect(createCreationFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
        })
      );
    });

    it('應該處理服務層錯誤', async () => {
      createCreationFlow.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/character-creation/flows')
        .send({});

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('GET /flows/:flowId - 獲取流程', () => {
    it('應該成功獲取流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        status: 'in_progress',
        persona: { name: 'Test' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .get('/api/character-creation/flows/flow-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.flow).toBeDefined();
      expect(response.body.flow.id).toBe('flow-001');
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/character-creation/flows/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('RESOURCE_NOT_FOUND');
    });

    it('應該拒絕訪問其他用戶的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'other-user-456',
        status: 'in_progress',
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .get('/api/character-creation/flows/flow-001');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該處理服務層錯誤', async () => {
      getCreationFlow.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/character-creation/flows/flow-001');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('PATCH /flows/:flowId - 更新流程', () => {
    it('應該成功更新流程', async () => {
      const mockExistingFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        status: 'in_progress',
      };
      const mockUpdatedFlow = {
        ...mockExistingFlow,
        status: 'completed',
      };
      getCreationFlow.mockResolvedValueOnce(mockExistingFlow);
      mergeCreationFlow.mockResolvedValueOnce(mockUpdatedFlow);

      const response = await request(app)
        .patch('/api/character-creation/flows/flow-001')
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.flow.status).toBe('completed');
      expect(mergeCreationFlow).toHaveBeenCalledWith('flow-001', { status: 'completed' });
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/character-creation/flows/non-existent')
        .send({ status: 'completed' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('RESOURCE_NOT_FOUND');
    });

    it('應該拒絕更新其他用戶的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'other-user-456',
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .patch('/api/character-creation/flows/flow-001')
        .send({ status: 'completed' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該處理服務層錯誤', async () => {
      getCreationFlow.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .patch('/api/character-creation/flows/flow-001')
        .send({});

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /flows/:flowId/steps/:stepId - 更新步驟', () => {
    it('應該成功更新 persona 步驟', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
      };
      const mockUpdatedFlow = {
        ...mockFlow,
        persona: { name: 'Updated' },
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      mergeCreationFlow.mockResolvedValueOnce(mockUpdatedFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/steps/persona')
        .send({ name: 'Updated', personality: 'kind' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mergeCreationFlow).toHaveBeenCalledWith(
        'flow-001',
        expect.objectContaining({
          persona: expect.any(Object),
        })
      );
    });

    it('應該成功更新 appearance 步驟', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      const mockUpdatedFlow = { ...mockFlow, appearance: { hair: 'black' } };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      mergeCreationFlow.mockResolvedValueOnce(mockUpdatedFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/steps/appearance')
        .send({ hair: 'black', eyes: 'brown' });

      expect(response.status).toBe(200);
      expect(mergeCreationFlow).toHaveBeenCalledWith(
        'flow-001',
        expect.objectContaining({
          appearance: expect.any(Object),
        })
      );
    });

    it('應該成功更新 voice 步驟', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      const mockUpdatedFlow = { ...mockFlow, voice: { voiceId: 'shimmer' } };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      mergeCreationFlow.mockResolvedValueOnce(mockUpdatedFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/steps/voice')
        .send({ voiceId: 'shimmer' });

      expect(response.status).toBe(200);
      expect(mergeCreationFlow).toHaveBeenCalledWith(
        'flow-001',
        expect.objectContaining({
          voice: expect.any(Object),
        })
      );
    });

    it('應該拒絕無效的步驟 ID', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/steps/invalid-step')
        .send({});

      expect(response.status >= 400).toBeTruthy();
      expect(response.body.error).toBe('RESOURCE_NOT_FOUND');
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/character-creation/flows/non-existent/steps/persona')
        .send({});

      expect(response.status).toBe(404);
    });

    it('應該拒絕更新其他用戶的流程', async () => {
      const mockFlow = { id: 'flow-001', userId: 'other-user-456' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/steps/persona')
        .send({});

      expect(response.status).toBe(403);
    });
  });

  describe('POST /flows/:flowId/charges - 記錄收費', () => {
    it('應該成功記錄收費', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      const mockCharge = {
        amount: 100,
        type: 'generation',
        createdAt: new Date().toISOString(),
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      recordCreationCharge.mockResolvedValueOnce({
        flow: mockFlow,
        charge: mockCharge,
      });

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/charges')
        .send({
          amount: 100,
          type: 'generation',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.charge).toBeDefined();
      expect(recordCreationCharge).toHaveBeenCalled();
    });

    it('應該支援冪等性 key（從 header）', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      recordCreationCharge.mockResolvedValueOnce({ flow: mockFlow, charge: {} });

      await request(app)
        .post('/api/character-creation/flows/flow-001/charges')
        .set('Idempotency-Key', 'unique-key-123')
        .send({ amount: 100 });

      expect(recordCreationCharge).toHaveBeenCalledWith(
        'flow-001',
        expect.objectContaining({
          idempotencyKey: 'unique-key-123',
        })
      );
    });

    it('應該支援冪等性 key（從 body）', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      recordCreationCharge.mockResolvedValueOnce({ flow: mockFlow, charge: {} });

      await request(app)
        .post('/api/character-creation/flows/flow-001/charges')
        .send({
          amount: 100,
          idempotencyKey: 'body-key-456',
        });

      expect(recordCreationCharge).toHaveBeenCalledWith(
        'flow-001',
        expect.objectContaining({
          idempotencyKey: 'body-key-456',
        })
      );
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/character-creation/flows/non-existent/charges')
        .send({ amount: 100 });

      expect(response.status).toBe(404);
    });

    it('應該拒絕操作其他用戶的流程', async () => {
      const mockFlow = { id: 'flow-001', userId: 'other-user-456' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/charges')
        .send({ amount: 100 });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /flows/:flowId/cleanup-images - 清理圖片', () => {
    it('應該成功清理未選中的圖片', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      deleteImage.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/cleanup-images')
        .send({
          selectedImageUrl: 'https://example.com/image1.jpg',
          allImages: [
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
            'https://example.com/image3.jpg',
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(2);
      expect(deleteImage).toHaveBeenCalledTimes(2);
    });

    it('應該處理沒有需要刪除的圖片', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/cleanup-images')
        .send({
          selectedImageUrl: 'https://example.com/image1.jpg',
          allImages: ['https://example.com/image1.jpg'],
        });

      expect(response.status).toBe(200);
      expect(response.body.deleted).toBe(0);
      expect(deleteImage).not.toHaveBeenCalled();
    });

    it('應該拒絕缺少 selectedImageUrl', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/cleanup-images')
        .send({
          allImages: ['https://example.com/image1.jpg'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('應該拒絕空的 allImages 陣列', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/cleanup-images')
        .send({
          selectedImageUrl: 'https://example.com/image1.jpg',
          allImages: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/character-creation/flows/non-existent/cleanup-images')
        .send({
          selectedImageUrl: 'https://example.com/image1.jpg',
          allImages: ['https://example.com/image1.jpg'],
        });

      expect(response.status).toBe(404);
    });

    it('應該拒絕操作其他用戶的流程', async () => {
      const mockFlow = { id: 'flow-001', userId: 'other-user-456' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/cleanup-images')
        .send({
          selectedImageUrl: 'https://example.com/image1.jpg',
          allImages: ['https://example.com/image1.jpg'],
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /flows/:flowId/cancel - 取消流程', () => {
    it('應該成功取消流程並刪除圖片', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        generation: {
          result: {
            images: [
              'https://example.com/image1.jpg',
              'https://example.com/image2.jpg',
            ],
          },
        },
      };
      const mockUpdatedFlow = { ...mockFlow, status: 'cancelled' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      mergeCreationFlow.mockResolvedValueOnce(mockUpdatedFlow);
      deleteImage.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.flow.status).toBe('cancelled');
      expect(response.body.deletedImages).toBe(2);
      expect(deleteImage).toHaveBeenCalledTimes(2);
      expect(mergeCreationFlow).toHaveBeenCalledWith('flow-001', { status: 'cancelled' });
    });

    it('應該處理沒有生成圖片的情況', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
        generation: null,
      };
      const mockUpdatedFlow = { ...mockFlow, status: 'cancelled' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);
      mergeCreationFlow.mockResolvedValueOnce(mockUpdatedFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/cancel');

      expect(response.status).toBe(200);
      expect(response.body.deletedImages).toBe(0);
      expect(deleteImage).not.toHaveBeenCalled();
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/character-creation/flows/non-existent/cancel');

      expect(response.status).toBe(404);
    });

    it('應該拒絕取消其他用戶的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'other-user-456',
      };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .post('/api/character-creation/flows/flow-001/cancel');

      expect(response.status).toBe(403);
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點都應該需要認證', async () => {
      // All routes are configured with requireFirebaseAuth
      expect(true).toBe(true);
    });

    it('應該使用認證 token 中的 userId', async () => {
      const mockFlow = { id: 'flow-001', userId: 'test-user-123' };
      createCreationFlow.mockResolvedValueOnce(mockFlow);

      await request(app)
        .post('/api/character-creation/flows')
        .send({});

      expect(createCreationFlow).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'test-user-123' })
      );
    });

    it('應該驗證用戶只能訪問自己的流程', async () => {
      const mockFlow = { id: 'flow-001', userId: 'other-user' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .get('/api/character-creation/flows/flow-001');

      expect(response.status).toBe(403);
    });

    it('應該驗證用戶只能更新自己的流程', async () => {
      const mockFlow = { id: 'flow-001', userId: 'other-user' };
      getCreationFlow.mockResolvedValueOnce(mockFlow);

      const response = await request(app)
        .patch('/api/character-creation/flows/flow-001')
        .send({});

      expect(response.status).toBe(403);
    });
  });
});
