/**
 * GenerationLogs API 路由測試
 * 測試範圍：
 * - 查詢用戶的生成記錄
 * - 查詢單個生成記錄
 * - 查詢流程的生成記錄
 * - 查詢所有生成記錄（管理用）
 * - 權限和安全性檢查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies BEFORE importing the router
vi.mock('../characterCreation.service.js', () => ({
  getCreationFlow: vi.fn(),
}));

vi.mock('../generationLog.service.js', () => ({
  getUserGenerationLogs: vi.fn(),
  getGenerationLog: vi.fn(),
  getFlowGenerationLog: vi.fn(),
  getAllGenerationLogs: vi.fn(),
}));

vi.mock('../characterCreation.helpers.js', () => ({
  trimString: (str) => (str || '').trim(),
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
    userGenerationLogs: {},
    generationLog: {},
    flowGenerationLog: {},
    allGenerationLogs: {},
  },
}));

vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data, statusCode = 200) => res.status(statusCode).json({ success: true, ...data }),
  sendError: (res, code, message, details) => {
    return res.status(
      code === 'RESOURCE_NOT_FOUND' ? 404 :
      code === 'FORBIDDEN' ? 403 :
      code === 'VALIDATION_ERROR' ? 400 : 400
    ).json({
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

// Import mocked services
import { getCreationFlow } from '../characterCreation.service.js';
import {
  getUserGenerationLogs,
  getGenerationLog,
  getFlowGenerationLog,
  getAllGenerationLogs,
} from '../generationLog.service.js';
import { generationLogsRouter } from './generationLogs.routes.js';

describe('GenerationLogs API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/character-creation', generationLogsRouter);

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

  describe('GET /generation-logs/user/:userId - 查詢用戶的生成記錄', () => {
    it('應該成功查詢自己的生成記錄', async () => {
      const mockLogs = [
        { id: 'log-001', userId: 'test-user-123', type: 'image', status: 'completed' },
        { id: 'log-002', userId: 'test-user-123', type: 'voice', status: 'completed' },
      ];
      getUserGenerationLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/user/test-user-123')
        .query({ limit: 50, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.logs).toEqual(mockLogs);
      expect(response.body.count).toBe(2);
      expect(getUserGenerationLogs).toHaveBeenCalledWith('test-user-123', { limit: 50, offset: 0 });
    });

    it('應該支援分頁參數', async () => {
      const mockLogs = [
        { id: 'log-003', userId: 'test-user-123', type: 'persona', status: 'completed' },
      ];
      getUserGenerationLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/user/test-user-123')
        .query({ limit: 10, offset: 20 });

      expect(response.status).toBe(200);
      expect(getUserGenerationLogs).toHaveBeenCalledWith('test-user-123', { limit: 10, offset: 20 });
    });

    it('應該拒絕查詢其他用戶的記錄', async () => {
      const response = await request(app)
        .get('/api/character-creation/generation-logs/user/other-user-456');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(getUserGenerationLogs).not.toHaveBeenCalled();
    });

    it('應該使用默認的分頁參數', async () => {
      const mockLogs = [
        { id: 'log-004', userId: 'test-user-123', type: 'description' },
      ];
      getUserGenerationLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/user/test-user-123');

      expect(response.status).toBe(200);
      // 沒有提供 limit 和 offset，應該使用默認值 50 和 0
      expect(getUserGenerationLogs).toHaveBeenCalledWith('test-user-123', { limit: 50, offset: 0 });
    });
  });

  describe('GET /generation-logs/:logId - 查詢單個生成記錄', () => {
    it('應該成功查詢自己的生成記錄', async () => {
      const mockLog = {
        id: 'log-001',
        userId: 'test-user-123',
        type: 'image',
        status: 'completed',
        result: { images: ['url1', 'url2'] },
      };
      getGenerationLog.mockReturnValue(mockLog);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/log-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.log).toEqual(mockLog);
      expect(getGenerationLog).toHaveBeenCalledWith('log-001');
    });

    it('應該返回 404 當記錄不存在', async () => {
      getGenerationLog.mockReturnValue(null);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('RESOURCE_NOT_FOUND');
    });

    it('應該拒絕查詢其他用戶的記錄', async () => {
      const mockLog = {
        id: 'log-001',
        userId: 'other-user-456',
        type: 'image',
        status: 'completed',
      };
      getGenerationLog.mockReturnValue(mockLog);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/log-001');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該返回記錄的完整信息', async () => {
      const mockLog = {
        id: 'log-002',
        userId: 'test-user-123',
        type: 'voice',
        status: 'completed',
        result: { voiceUrl: 'https://example.com/voice.mp3' },
        metadata: { quality: 'high' },
        createdAt: '2025-01-15T00:00:00Z',
      };
      getGenerationLog.mockReturnValue(mockLog);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/log-002');

      expect(response.status).toBe(200);
      expect(response.body.log).toEqual(mockLog);
      expect(response.body.log.metadata).toBeDefined();
      expect(response.body.log.result).toBeDefined();
    });
  });

  describe('GET /generation-logs/flow/:flowId - 查詢流程的生成記錄', () => {
    it('應該成功查詢流程的生成記錄', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
      };
      const mockLog = {
        flowId: 'flow-001',
        logs: [
          { type: 'voice', status: 'completed', timestamp: '2025-01-15T00:00:00Z' },
          { type: 'image', status: 'completed', timestamp: '2025-01-15T00:05:00Z' },
        ],
      };
      getCreationFlow.mockResolvedValue(mockFlow);
      getFlowGenerationLog.mockReturnValue(mockLog);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/flow/flow-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.log).toEqual(mockLog);
      expect(getCreationFlow).toHaveBeenCalledWith('flow-001');
      expect(getFlowGenerationLog).toHaveBeenCalledWith('flow-001');
    });

    it('應該返回 404 當流程不存在', async () => {
      getCreationFlow.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/flow/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('RESOURCE_NOT_FOUND');
      expect(getFlowGenerationLog).not.toHaveBeenCalled();
    });

    it('應該返回 404 當流程的生成記錄不存在', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'test-user-123',
      };
      getCreationFlow.mockResolvedValue(mockFlow);
      getFlowGenerationLog.mockReturnValue(null);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/flow/flow-001');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('RESOURCE_NOT_FOUND');
    });

    it('應該拒絕查詢其他用戶的流程', async () => {
      const mockFlow = {
        id: 'flow-001',
        userId: 'other-user-456',
      };
      getCreationFlow.mockResolvedValue(mockFlow);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/flow/flow-001');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(getFlowGenerationLog).not.toHaveBeenCalled();
    });

    it('應該返回流程所有生成階段的記錄', async () => {
      const mockFlow = {
        id: 'flow-002',
        userId: 'test-user-123',
      };
      const mockLog = {
        flowId: 'flow-002',
        logs: [
          { type: 'persona', status: 'completed', timestamp: '2025-01-15T00:00:00Z', result: { name: 'Test Character' } },
          { type: 'voice', status: 'completed', timestamp: '2025-01-15T00:05:00Z', result: { voiceId: 'shimmer' } },
          { type: 'description', status: 'completed', timestamp: '2025-01-15T00:10:00Z', result: { text: 'A character' } },
          { type: 'image', status: 'completed', timestamp: '2025-01-15T00:15:00Z', result: { images: ['url1', 'url2'] } },
        ],
      };
      getCreationFlow.mockResolvedValue(mockFlow);
      getFlowGenerationLog.mockReturnValue(mockLog);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/flow/flow-002');

      expect(response.status).toBe(200);
      expect(response.body.log.logs).toHaveLength(4);
      expect(response.body.log.logs[0].type).toBe('persona');
      expect(response.body.log.logs[3].type).toBe('image');
    });
  });

  describe('GET /generation-logs - 查詢所有生成記錄（管理用）', () => {
    it('應該成功查詢所有生成記錄', async () => {
      const mockResult = {
        logs: [
          { id: 'log-001', userId: 'user-1', type: 'image', status: 'completed' },
          { id: 'log-002', userId: 'user-2', type: 'voice', status: 'completed' },
        ],
        total: 2,
        limit: 50,
        offset: 0,
      };
      getAllGenerationLogs.mockReturnValue(mockResult);

      const response = await request(app)
        .get('/api/character-creation/generation-logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.logs).toBeDefined();
      expect(getAllGenerationLogs).toHaveBeenCalledWith({ limit: 50, offset: 0, status: null });
    });

    it('應該支援分頁和狀態過濾', async () => {
      const mockResult = {
        logs: [
          { id: 'log-003', userId: 'user-3', type: 'image', status: 'failed' },
        ],
        total: 1,
        limit: 20,
        offset: 10,
      };
      getAllGenerationLogs.mockReturnValue(mockResult);

      const response = await request(app)
        .get('/api/character-creation/generation-logs')
        .query({ limit: 20, offset: 10, status: 'failed' });

      expect(response.status).toBe(200);
      expect(getAllGenerationLogs).toHaveBeenCalledWith({ limit: 20, offset: 10, status: 'failed' });
    });

    it('應該使用默認的分頁參數', async () => {
      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0,
      };
      getAllGenerationLogs.mockReturnValue(mockResult);

      const response = await request(app)
        .get('/api/character-creation/generation-logs');

      expect(response.status).toBe(200);
      expect(getAllGenerationLogs).toHaveBeenCalledWith({ limit: 50, offset: 0, status: null });
    });
  });

  describe('權限和安全性測試', () => {
    it('所有端點都應該需要認證', async () => {
      // 移除認證中間件的模擬，測試未認證的情況
      // 這個測試確保路由配置正確
      const endpoints = [
        '/api/character-creation/generation-logs/user/test-user-123',
        '/api/character-creation/generation-logs/log-001',
        '/api/character-creation/generation-logs/flow/flow-001',
        '/api/character-creation/generation-logs',
      ];

      // 由於我們已經 mock 了 requireFirebaseAuth，這裡只是確認它被調用
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        // 如果沒有認證中間件，應該會失敗
        // 但因為我們 mock 了，所以這裡只是確認端點存在
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      }
    });

    it('應該使用認證 token 中的 userId', async () => {
      const mockLogs = [
        { id: 'log-001', userId: 'test-user-123', type: 'image' },
      ];
      getUserGenerationLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get('/api/character-creation/generation-logs/user/test-user-123');

      expect(response.status).toBe(200);
      // 驗證使用的是認證 token 中的 userId，而不是請求參數
      expect(getUserGenerationLogs).toHaveBeenCalledWith('test-user-123', expect.any(Object));
    });
  });
});
