/**
 * Debug API 路由測試
 * 測試範圍：
 * - Token 驗證測試端點
 * - Firebase 狀態檢查
 * - 認證測試端點
 * - 僅開發環境可用
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  sendSuccess: (res, data, options = {}) => {
    const status = options.status || 200;
    return res.status(status).json({ success: true, data });
  },
  sendError: (res, code, message, details) => {
    const status = code === 'AUTH_TOKEN_INVALID' ? 401 :
                   code === 'AUTH_MISSING_TOKEN' ? 401 :
                   code === 'VALIDATION_ERROR' ? 400 :
                   code === 'INTERNAL_SERVER_ERROR' ? 500 : 400;
    return res.status(status).json({
      success: false,
      error: code,
      message,
      ...(details || {}),
    });
  },
}));

// Mock Firebase Admin Auth
const mockVerifyIdToken = vi.fn();
const mockGetFirebaseAdminAuth = vi.fn(() => ({
  verifyIdToken: mockVerifyIdToken,
}));

vi.mock('../firebase/index.js', () => ({
  getFirebaseAdminAuth: (...args) => mockGetFirebaseAdminAuth(...args),
}));

// Import the router after mocks
import debugRouter from './debug.routes.js';

describe('Debug API Routes', () => {
  let app;
  let originalNodeEnv;

  beforeEach(async () => {
    // 保存原始環境變數
    originalNodeEnv = process.env.NODE_ENV;

    // 設置為開發環境（Debug routes 僅在開發環境可用）
    process.env.NODE_ENV = 'development';

    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use('/api/debug', debugRouter);

    // 添加錯誤處理中間件
    app.use((err, req, res, next) => {
      res.status(500).json({
        success: false,
        error: err.message || '內部錯誤',
      });
    });

    // 清除所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢復原始環境變數
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('POST /verify-token - 驗證 Firebase ID Token', () => {
    it('應該成功驗證有效的 token', async () => {
      const mockDecodedToken = {
        uid: 'test-user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      const response = await request(app)
        .post('/api/debug/verify-token')
        .send({ token: 'valid-firebase-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ 2025-12-02 修復：使用 response.body.data.xxx
      expect(response.body.data.message).toContain('驗證成功');
      expect(response.body.data.user).toEqual({
        uid: 'test-user-123',
        email: 'test@example.com',
        iat: mockDecodedToken.iat,
        exp: mockDecodedToken.exp,
      });
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-firebase-token', expect.any(Object));
    });

    it('應該移除 Bearer 前綴後驗證', async () => {
      const mockDecodedToken = {
        uid: 'test-user-456',
        email: 'user@test.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      const response = await request(app)
        .post('/api/debug/verify-token')
        .send({ token: 'Bearer valid-firebase-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // 應該移除 'Bearer ' 前綴
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-firebase-token', expect.any(Object));
    });

    it('應該拒絕缺少 token 的請求', async () => {
      const response = await request(app).post('/api/debug/verify-token').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復：message 包含錯誤訊息
      expect(response.body.message).toContain('缺少 token');
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('應該處理無效的 token', async () => {
      mockVerifyIdToken.mockRejectedValue({
        code: 'auth/invalid-id-token',
        message: 'Invalid token',
      });

      const response = await request(app)
        .post('/api/debug/verify-token')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復：檢查 message 而非 error 包含錯誤訊息
      expect(response.body.message).toContain('驗證失敗');
      expect(response.body.code).toBe('auth/invalid-id-token');
    });

    it('應該處理過期的 token', async () => {
      mockVerifyIdToken.mockRejectedValue({
        code: 'auth/id-token-expired',
        message: 'Token has expired',
      });

      const response = await request(app)
        .post('/api/debug/verify-token')
        .send({ token: 'expired-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('auth/id-token-expired');
    });

    it('應該在 Emulator 模式下使用不同的驗證選項', async () => {
      process.env.USE_FIREBASE_EMULATOR = 'true';

      const mockDecodedToken = {
        uid: 'emulator-user',
        email: 'emulator@test.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      const response = await request(app)
        .post('/api/debug/verify-token')
        .send({ token: 'emulator-token' });

      expect(response.status).toBe(200);
      // Emulator 模式應該使用 { checkRevoked: false }
      expect(mockVerifyIdToken).toHaveBeenCalledWith('emulator-token', { checkRevoked: false });

      delete process.env.USE_FIREBASE_EMULATOR;
    });
  });

  describe('GET /firebase-status - 檢查 Firebase Admin SDK 狀態', () => {
    it('應該成功返回 Firebase 狀態', async () => {
      process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project-123';

      const response = await request(app).get('/api/debug/firebase-status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ 2025-12-02 修復
      expect(response.body.data.message).toContain('Firebase Admin SDK 已初始化');
      expect(response.body.data.projectId).toBe('test-project-123');
      expect(response.body.data.nodeEnv).toBe('development');
      expect(response.body.data.useEmulator).toBe(false);
      expect(mockGetFirebaseAdminAuth).toHaveBeenCalled();
    });

    it('應該顯示 Emulator 模式狀態', async () => {
      process.env.USE_FIREBASE_EMULATOR = 'true';

      const response = await request(app).get('/api/debug/firebase-status');

      expect(response.status).toBe(200);
      // ✅ 2025-12-02 修復
      expect(response.body.data.useEmulator).toBe(true);

      delete process.env.USE_FIREBASE_EMULATOR;
    });

    it('應該處理 Firebase 初始化失敗', async () => {
      mockGetFirebaseAdminAuth.mockImplementationOnce(() => {
        throw new Error('Firebase initialization failed');
      });

      const response = await request(app).get('/api/debug/firebase-status');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('Firebase Admin SDK 初始化失敗');
    });
  });

  describe('GET /auth-test - 測試認證中間件', () => {
    it('應該成功驗證帶有 Authorization header 的請求', async () => {
      const mockDecodedToken = {
        uid: 'auth-test-user',
        email: 'authtest@example.com',
      };
      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      const response = await request(app)
        .get('/api/debug/auth-test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ 2025-12-02 修復
      expect(response.body.data.message).toContain('認證成功');
      expect(response.body.data.user).toEqual({
        uid: 'auth-test-user',
        email: 'authtest@example.com',
      });
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
    });

    it('應該拒絕缺少 Authorization header 的請求', async () => {
      const response = await request(app).get('/api/debug/auth-test');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('缺少 Authorization header');
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('應該處理無效的 token', async () => {
      mockVerifyIdToken.mockRejectedValue({
        code: 'auth/argument-error',
        message: 'Malformed token',
      });

      const response = await request(app)
        .get('/api/debug/auth-test')
        .set('Authorization', 'Bearer malformed-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      // ✅ 2025-12-02 修復
      expect(response.body.message).toContain('認證失敗');
      expect(response.body.code).toBe('auth/argument-error');
    });

    it('應該移除 Authorization header 中的 Bearer 前綴', async () => {
      const mockDecodedToken = {
        uid: 'test-user',
        email: 'test@example.com',
      };
      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      await request(app)
        .get('/api/debug/auth-test')
        .set('Authorization', 'Bearer token-without-prefix');

      // 應該只傳遞 token，不包含 'Bearer ' 前綴
      expect(mockVerifyIdToken).toHaveBeenCalledWith('token-without-prefix');
    });
  });

  describe('環境限制測試', () => {
    it('生產環境應該不註冊 Debug routes', async () => {
      // 在生產環境，Debug routes 不會被註冊
      // 這是通過 routes 文件中的條件檢查實現的：
      // if (process.env.NODE_ENV !== 'production') { ... }

      // 我們無法直接測試這個，因為路由已經在 import 時註冊了
      // 但我們可以驗證所有端點在開發環境都可用

      expect(process.env.NODE_ENV).toBe('development');

      mockVerifyIdToken.mockResolvedValue({
        uid: 'test',
        email: 'test@test.com',
        iat: Date.now(),
        exp: Date.now() + 3600,
      });

      const response1 = await request(app)
        .post('/api/debug/verify-token')
        .send({ token: 'test' });

      const response2 = await request(app).get('/api/debug/firebase-status');

      const response3 = await request(app)
        .get('/api/debug/auth-test')
        .set('Authorization', 'Bearer test');

      // 所有端點在開發環境都應該可用
      expect(response1.status).not.toBe(404);
      expect(response2.status).not.toBe(404);
      expect(response3.status).not.toBe(404);
    });
  });

  describe('錯誤詳情測試', () => {
    // ✅ 2025-12-02 修復：更新測試以匹配實際路由行為
    // 路由只傳送 code 和 errorMessage，不傳送堆棧
    it('驗證失敗應該包含錯誤代碼', async () => {
      const mockError = new Error('Token verification failed');
      mockError.code = 'auth/test-error';

      mockVerifyIdToken.mockRejectedValue(mockError);

      const response = await request(app)
        .post('/api/debug/verify-token')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('auth/test-error');
      expect(response.body.errorMessage).toBe('Token verification failed');
    });
  });
});
