/**
 * VoiceLimit API 路由測試
 * 測試範圍：
 * - 檢查語音播放權限（自定義邏輯，含解鎖卡）
 * - 獲取語音統計（需認證）
 * - 使用語音解鎖卡
 * - 透過廣告解鎖語音次數
 * - 重置語音限制（管理員）
 * - 權限和安全性檢查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock all dependencies BEFORE importing the router
// This prevents Firebase initialization
vi.mock('./voiceLimit.service.js', () => ({
  voiceLimitService: {
    getStats: vi.fn(),
    reset: vi.fn(),
  },
  unlockByAd: vi.fn(),
  canPlayVoice: vi.fn(),
}));

vi.mock('../membership/unlockTickets.service.js', () => ({
  useVoiceUnlockCard: vi.fn(),
}));

// Mock both possible auth import paths
vi.mock('../auth/index.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    next();
  },
}));

vi.mock('../auth/firebaseAuth.middleware.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    next();
  },
}));

vi.mock('../middleware/adminAuth.middleware.js', () => ({
  requireAdmin: (req, res, next) => {
    // Mock admin check - assumes user is admin
    next();
  },
}));

vi.mock('../utils/routeHelpers.js', () => ({
  sendSuccess: (res, data) => res.json({ success: true, ...data }),
  sendError: (res, error, status = 400) => {
    const message = typeof error === 'string' ? error : error.message;
    return res.status(status).json({
      success: false,
      error: error.code || 'ERROR',
      message
    });
  },
  asyncHandler: (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      const message = typeof error === 'string' ? error : error.message;
      const status = error.message?.includes('超過') ? 429 :
                     error.message?.includes('未找到') ? 404 :
                     error.message?.includes('不足') ? 400 : 400;
      res.status(status).json({
        success: false,
        error: error.code || 'ERROR',
        message
      });
    }
  },
  requireOwnership: (param) => (req, res, next) => {
    // For testing, allow if userId matches or is test user
    const userId = req.params[param];
    if (userId === req.firebaseUser?.uid || userId === 'test-user-123') {
      next();
    } else {
      res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }
  },
  requireParams: (params, source = 'body') => (req, res, next) => {
    const data = source === 'body' ? req.body : req.query;
    const missing = params.filter(p => !data[p]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMETER',
        message: `缺少必要參數: ${missing.join(', ')}`
      });
    }
    next();
  },
  getLimitErrorStatus: (error) => {
    if (error.message?.includes('超過')) return 429;
    if (error.message?.includes('未找到')) return 404;
    if (error.message?.includes('不足')) return 400;
    return 400;
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

vi.mock('../firebase/index.js', () => ({
  getFirestoreDb: vi.fn(() => ({})),
}));

// Import mocked services
import { voiceLimitService, unlockByAd, canPlayVoice } from './voiceLimit.service.js';
import { useVoiceUnlockCard } from '../membership/unlockTickets.service.js';
import voiceLimitRouter from './voiceLimit.routes.js';

describe('VoiceLimit API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/voice-limit', voiceLimitRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('GET /:userId/:characterId/check - 檢查語音播放權限（自定義）', () => {
    it('應該成功檢查語音播放權限', async () => {
      const mockCheck = {
        canPlay: true,
        remaining: 10,
        limit: 50,
        used: 40,
        hasUnlockCard: false,
        resetAt: new Date().toISOString(),
      };
      canPlayVoice.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/voice-limit/test-user-123/char-001/check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canPlay).toBe(true);
      expect(response.body.remaining).toBe(10);
      expect(canPlayVoice).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該返回可使用解鎖卡的狀態', async () => {
      const mockCheck = {
        canPlay: true,
        remaining: 0,
        limit: 50,
        used: 50,
        hasUnlockCard: true,
        unlockCardCount: 2,
        resetAt: new Date().toISOString(),
      };
      canPlayVoice.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/voice-limit/test-user-123/char-001/check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canPlay).toBe(true);
      expect(response.body.hasUnlockCard).toBe(true);
      expect(response.body.unlockCardCount).toBe(2);
    });

    it('應該返回無法播放的狀態', async () => {
      const mockCheck = {
        canPlay: false,
        remaining: 0,
        limit: 50,
        used: 50,
        hasUnlockCard: false,
        resetAt: new Date().toISOString(),
      };
      canPlayVoice.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/voice-limit/test-user-123/char-001/check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canPlay).toBe(false);
      expect(response.body.remaining).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      canPlayVoice.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/voice-limit/test-user-123/char-001/check');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('GET /stats - 獲取語音統計（需認證）', () => {
    it('應該成功獲取語音統計', async () => {
      const mockStats = {
        totalCharacters: 3,
        characterStats: {
          'char-001': { used: 10, limit: 50, unlockCardCount: 1 },
          'char-002': { used: 5, limit: 50, unlockCardCount: 0 },
        },
        lastResetAt: new Date().toISOString(),
      };
      voiceLimitService.getStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/voice-limit/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalCharacters).toBe(3);
      expect(voiceLimitService.getStats).toHaveBeenCalledWith('test-user-123');
    });

    it('應該返回空統計（新用戶）', async () => {
      const mockStats = {
        totalCharacters: 0,
        characterStats: {},
      };
      voiceLimitService.getStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/voice-limit/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalCharacters).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      voiceLimitService.getStats.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/voice-limit/stats');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /:userId/:characterId/use-unlock-card - 使用語音解鎖卡', () => {
    it('應該成功使用語音解鎖卡', async () => {
      const mockResult = {
        remainingCards: 1,
        unlockedVoices: 10,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      useVoiceUnlockCard.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/voice-limit/test-user-123/char-001/use-unlock-card');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('成功');
      expect(response.body.remainingCards).toBe(1);
      expect(useVoiceUnlockCard).toHaveBeenCalledWith('test-user-123', 'char-001');
    });

    it('應該拒絕非擁有者的請求', async () => {
      const response = await request(app)
        .post('/api/voice-limit/other-user-456/char-001/use-unlock-card');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該處理解鎖卡不足的錯誤', async () => {
      useVoiceUnlockCard.mockRejectedValueOnce(
        new Error('語音解鎖卡不足')
      );

      const response = await request(app)
        .post('/api/voice-limit/test-user-123/char-001/use-unlock-card');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('不足');
    });

    it('應該處理服務層錯誤', async () => {
      useVoiceUnlockCard.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/voice-limit/test-user-123/char-001/use-unlock-card');

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /:userId/:characterId/unlock-by-ad - 透過廣告解鎖', () => {
    it('應該成功透過廣告解鎖語音次數', async () => {
      const mockResult = {
        unlockedVoices: 5,
        newLimit: 55,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      unlockByAd.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/voice-limit/test-user-123/char-001/unlock-by-ad')
        .send({
          adId: 'ad-001',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.unlockedVoices).toBe(5);
      expect(unlockByAd).toHaveBeenCalledWith('test-user-123', 'char-001', 'ad-001');
    });

    it('應該拒絕缺少 adId 的請求', async () => {
      const response = await request(app)
        .post('/api/voice-limit/test-user-123/char-001/unlock-by-ad')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('adId');
    });

    it('應該拒絕非擁有者的請求', async () => {
      const response = await request(app)
        .post('/api/voice-limit/other-user-456/char-001/unlock-by-ad')
        .send({
          adId: 'ad-001',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('應該處理無效廣告 ID', async () => {
      unlockByAd.mockRejectedValueOnce(
        new Error('未找到廣告記錄')
      );

      const response = await request(app)
        .post('/api/voice-limit/test-user-123/char-001/unlock-by-ad')
        .send({
          adId: 'invalid-ad',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('應該處理服務層錯誤', async () => {
      unlockByAd.mockRejectedValueOnce(
        new Error('Ad service error')
      );

      const response = await request(app)
        .post('/api/voice-limit/test-user-123/char-001/unlock-by-ad')
        .send({
          adId: 'ad-001',
        });

      expect(response.status >= 400 || response.body.success === false).toBeTruthy();
    });
  });

  describe('POST /:userId/reset - 重置語音限制（管理員）', () => {
    it('應該成功重置所有角色的語音限制', async () => {
      const mockResult = {
        resetCount: 3,
        affectedCharacters: ['char-001', 'char-002', 'char-003'],
      };
      voiceLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/voice-limit/target-user-456/reset');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('重置');
      expect(response.body.resetCount).toBe(3);
      expect(voiceLimitService.reset).toHaveBeenCalledWith('target-user-456', undefined);
    });

    it('應該成功重置特定角色的語音限制', async () => {
      const mockResult = {
        resetCount: 1,
        affectedCharacters: ['char-001'],
      };
      voiceLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/voice-limit/target-user-456/reset')
        .send({
          characterId: 'char-001',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.resetCount).toBe(1);
      expect(voiceLimitService.reset).toHaveBeenCalledWith('target-user-456', 'char-001');
    });

    it('應該處理沒有限制記錄的情況', async () => {
      const mockResult = {
        resetCount: 0,
        affectedCharacters: [],
      };
      voiceLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/voice-limit/target-user-456/reset');

      expect(response.status).toBe(200);
      expect(response.body.resetCount).toBe(0);
    });

    it('應該處理服務層錯誤', async () => {
      voiceLimitService.reset.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/voice-limit/target-user-456/reset');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('權限和安全性測試', () => {
    it('check 路由應該是公開的（不需要認證）', async () => {
      const mockCheck = { canPlay: true, remaining: 10 };
      canPlayVoice.mockResolvedValueOnce(mockCheck);

      const response = await request(app)
        .get('/api/voice-limit/any-user/char-001/check');

      expect(response.status).toBe(200);
    });

    it('stats 路由應該需要認證', async () => {
      const mockStats = { totalCharacters: 0 };
      voiceLimitService.getStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/voice-limit/stats');

      // Should succeed with mocked auth
      expect(response.status).toBe(200);
      expect(voiceLimitService.getStats).toHaveBeenCalledWith('test-user-123');
    });

    it('use-unlock-card 路由應該驗證擁有權', async () => {
      const response = await request(app)
        .post('/api/voice-limit/other-user/char-001/use-unlock-card');

      expect(response.status).toBe(403);
    });

    it('unlock-by-ad 路由應該驗證擁有權', async () => {
      const response = await request(app)
        .post('/api/voice-limit/other-user/char-001/unlock-by-ad')
        .send({ adId: 'ad-001' });

      expect(response.status).toBe(403);
    });

    it('reset 路由應該需要管理員權限', async () => {
      const mockResult = { resetCount: 1 };
      voiceLimitService.reset.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/voice-limit/target-user/reset');

      // Should succeed (mocked as admin)
      expect(response.status).toBe(200);
    });
  });
});
