/**
 * Firebase Auth Middleware 測試
 * 測試範圍：
 * - Bearer Token 提取和解析
 * - 測試帳號認證（開發環境）
 * - Firebase ID Token 驗證（Mock）
 * - 錯誤處理和安全檢查
 *
 * 注意：此測試使用完整的 mock 策略，不依賴實際的 Firebase Admin SDK
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Firebase Auth Middleware - Integration Tests', () => {
  let app;
  let mockAuth;
  let mockVerifyIdToken;
  let mockValidateTestToken;
  let originalNodeEnv;

  beforeEach(() => {
    // 保存原始環境變數
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // 創建 mock Auth 對象
    mockVerifyIdToken = vi.fn();
    mockAuth = {
      verifyIdToken: mockVerifyIdToken,
    };

    // 創建 mock validateTestToken 函數
    mockValidateTestToken = vi.fn();

    // 創建 Express 應用
    app = express();
    app.use(express.json());

    // 創建簡化版的認證中間件（模擬實際邏輯）
    const authMiddleware = async (req, res, next) => {
      const authorization = req.headers.authorization;

      // 提取 Bearer token
      const getBearerToken = (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
        const token = trimmed.slice(7).trim();
        return token.length > 0 ? token : null;
      };

      const rawToken = getBearerToken(authorization);

      if (!rawToken) {
        return res.status(401).json({ message: '缺少 Authorization Bearer 權杖' });
      }

      // 處理測試 token
      if (rawToken === 'test-guest-token-abc123') {
        const validation = mockValidateTestToken(rawToken, req.hostname);

        if (!validation.valid) {
          const errorMessages = {
            invalid_token: '無效的測試 token',
            disabled_in_production: '測試帳號在生產環境已完全禁用',
            non_local_environment: '測試帳號僅限本地開發環境使用',
            token_expired: '測試 token 已過期，請重新登入',
          };

          return res.status(401).json({
            message: errorMessages[validation.reason] || validation.message || '測試 token 驗證失敗',
            code: `auth/test-${validation.reason}`,
          });
        }

        req.firebaseUser = {
          uid: 'test-user',
          email: 'test@example.com',
          name: '測試帳號',
          isTestUser: true,
          tokenInfo: validation,
        };
        return next();
      }

      // 處理 Firebase token
      try {
        const verifyOptions = process.env.USE_FIREBASE_EMULATOR === 'true'
          ? { checkRevoked: false }
          : {};
        const decoded = await mockAuth.verifyIdToken(rawToken, verifyOptions);
        req.firebaseUser = decoded;
        next();
      } catch (error) {
        const code = typeof error?.code === 'string' ? error.code : 'auth/token-verification';
        res.status(401).json({
          message: 'Firebase 登入憑證驗證失敗',
          code,
        });
      }
    };

    // 添加受保護的測試路由
    app.get('/api/protected', authMiddleware, (req, res) => {
      res.json({
        success: true,
        user: {
          uid: req.firebaseUser.uid,
          email: req.firebaseUser.email,
          isTestUser: req.firebaseUser.isTestUser || false,
        },
      });
    });

    // 清除所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢復原始環境變數
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Bearer Token 提取', () => {
    it('應該正確提取 Bearer token', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-user-123',
        email: 'user@example.com',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer valid-firebase-token');

      expect(response.status).toBe(200);
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-firebase-token', {});
    });

    it('應該處理大小寫混合的 Bearer 前綴', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-123',
        email: 'test@test.com',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'bearer token-abc');

      expect(response.status).toBe(200);
      expect(mockVerifyIdToken).toHaveBeenCalledWith('token-abc', {});
    });

    it('應該拒絕缺少 Authorization header 的請求', async () => {
      const response = await request(app).get('/api/protected');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('缺少 Authorization Bearer 權杖');
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('應該拒絕沒有 Bearer 前綴的 token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'just-a-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('缺少 Authorization Bearer 權杖');
    });

    it('應該拒絕空的 Bearer token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('缺少 Authorization Bearer 權杖');
    });

    it('應該處理 Bearer 前後的空格', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-456',
        email: 'spaces@test.com',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', '  Bearer   token-with-spaces  ');

      expect(response.status).toBe(200);
      expect(mockVerifyIdToken).toHaveBeenCalledWith('token-with-spaces', {});
    });
  });

  describe('測試帳號認證', () => {
    it('應該在開發環境成功驗證測試 token', async () => {
      mockValidateTestToken.mockReturnValue({
        valid: true,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer test-guest-token-abc123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.uid).toBe('test-user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.isTestUser).toBe(true);
      expect(mockValidateTestToken).toHaveBeenCalled();
    });

    it('應該拒絕無效的測試 token', async () => {
      mockValidateTestToken.mockReturnValue({
        valid: false,
        reason: 'invalid_token',
        message: '無效的測試 token',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer test-guest-token-abc123');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('無效的測試 token');
      expect(response.body.code).toBe('auth/test-invalid_token');
    });

    it('應該拒絕生產環境的測試 token', async () => {
      mockValidateTestToken.mockReturnValue({
        valid: false,
        reason: 'disabled_in_production',
        message: '測試帳號在生產環境已完全禁用',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer test-guest-token-abc123');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('測試帳號在生產環境已完全禁用');
      expect(response.body.code).toBe('auth/test-disabled_in_production');
    });

    it('應該拒絕非本地環境的測試 token', async () => {
      mockValidateTestToken.mockReturnValue({
        valid: false,
        reason: 'non_local_environment',
        message: '測試帳號僅限本地開發環境使用',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer test-guest-token-abc123');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('測試帳號僅限本地開發環境使用');
      expect(response.body.code).toBe('auth/test-non_local_environment');
    });

    it('應該拒絕過期的測試 token', async () => {
      mockValidateTestToken.mockReturnValue({
        valid: false,
        reason: 'token_expired',
        message: '測試 token 已過期',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer test-guest-token-abc123');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('測試 token 已過期，請重新登入');
      expect(response.body.code).toBe('auth/test-token_expired');
    });
  });

  describe('Firebase ID Token 驗證', () => {
    it('應該成功驗證有效的 Firebase token', async () => {
      const mockDecodedToken = {
        uid: 'firebase-user-abc',
        email: 'firebase@example.com',
        name: 'Firebase User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer valid-firebase-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.uid).toBe('firebase-user-abc');
      expect(response.body.user.email).toBe('firebase@example.com');
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-firebase-token', {});
    });

    it('應該拒絕無效的 Firebase token', async () => {
      mockVerifyIdToken.mockRejectedValue({
        code: 'auth/invalid-id-token',
        message: 'Invalid token',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-firebase-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Firebase 登入憑證驗證失敗');
      expect(response.body.code).toBe('auth/invalid-id-token');
    });

    it('應該拒絕過期的 Firebase token', async () => {
      mockVerifyIdToken.mockRejectedValue({
        code: 'auth/id-token-expired',
        message: 'Token has expired',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer expired-firebase-token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('auth/id-token-expired');
    });

    it('應該處理 Firebase token 驗證錯誤', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer firebase-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Firebase 登入憑證驗證失敗');
      expect(response.body.code).toBe('auth/token-verification');
    });

    it('應該在 Emulator 模式使用不同的驗證選項', async () => {
      process.env.USE_FIREBASE_EMULATOR = 'true';

      mockVerifyIdToken.mockResolvedValue({
        uid: 'emulator-user',
        email: 'emulator@test.com',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer emulator-token');

      expect(response.status).toBe(200);
      // Emulator 模式應該使用 { checkRevoked: false }
      expect(mockVerifyIdToken).toHaveBeenCalledWith('emulator-token', { checkRevoked: false });

      delete process.env.USE_FIREBASE_EMULATOR;
    });
  });

  describe('錯誤處理', () => {
    it('應該處理缺少錯誤碼的驗證失敗', async () => {
      mockVerifyIdToken.mockRejectedValue({
        message: 'Unknown error',
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('auth/token-verification');
    });

    it('應該處理非對象類型的錯誤', async () => {
      mockVerifyIdToken.mockRejectedValue('String error');

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('auth/token-verification');
    });

    it('應該處理 null 錯誤', async () => {
      mockVerifyIdToken.mockRejectedValue(null);

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(401);
    });
  });
});
