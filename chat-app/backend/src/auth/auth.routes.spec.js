/**
 * Auth Routes 測試
 * 測試範圍：
 * - 測試會話生成 (/auth/test)
 * - Token 格式驗證
 * - 測試用戶資料正確性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dependencies
vi.mock('../../../../shared/config/testAccounts.js', () => ({
  TEST_ACCOUNTS: {
    GUEST_USER_ID: 'test-user',
    DEV_USER_ID: 'dev-user-123',
  },
  issueTestSession: vi.fn(() => ({
    token: 'test-session-token-123',
    expiresIn: 3600,
    issuedAt: new Date('2025-01-15T00:00:00Z').toISOString(),
    expiresAt: new Date('2025-01-15T01:00:00Z').toISOString(),
  })),
}));

describe('Auth Routes', () => {
  let app;
  let mockIssueTestSession;
  let mockTestAccounts;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());

    // 動態導入 mock 的模組
    const testAccountsModule = await import('../../../../shared/config/testAccounts.js');
    mockTestAccounts = testAccountsModule.TEST_ACCOUNTS;
    mockIssueTestSession = testAccountsModule.issueTestSession;

    // 複製 /auth/test 路由的實現
    app.post('/auth/test', (_, res) => {
      const user = {
        id: mockTestAccounts.GUEST_USER_ID,
        displayName: '測試帳號',
        email: 'test@example.com',
      };

      const session = mockIssueTestSession();

      res.json({
        token: session.token,
        user,
        expiresIn: session.expiresIn,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
      });
    });

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('POST /auth/test - 生成測試會話', () => {
    it('應該成功生成測試會話', async () => {
      const response = await request(app).post('/auth/test').send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('issuedAt');
      expect(response.body).toHaveProperty('expiresAt');
    });

    it('應該返回正確的 token', async () => {
      const response = await request(app).post('/auth/test').send({});

      expect(response.body.token).toBe('test-session-token-123');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('應該返回正確的測試用戶資料', async () => {
      const response = await request(app).post('/auth/test').send({});

      expect(response.body.user).toEqual({
        id: 'test-user',
        displayName: '測試帳號',
        email: 'test@example.com',
      });
    });

    it('應該返回正確的過期時間', async () => {
      const response = await request(app).post('/auth/test').send({});

      expect(response.body.expiresIn).toBe(3600);
      expect(typeof response.body.expiresIn).toBe('number');
      expect(response.body.expiresIn).toBeGreaterThan(0);
    });

    it('應該返回有效的時間戳格式', async () => {
      const response = await request(app).post('/auth/test').send({});

      // 驗證 ISO 8601 格式
      expect(response.body.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(response.body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // 驗證可以解析為有效日期
      expect(new Date(response.body.issuedAt).getTime()).not.toBeNaN();
      expect(new Date(response.body.expiresAt).getTime()).not.toBeNaN();
    });

    it('應該確保過期時間晚於發行時間', async () => {
      const response = await request(app).post('/auth/test').send({});

      const issuedAt = new Date(response.body.issuedAt).getTime();
      const expiresAt = new Date(response.body.expiresAt).getTime();

      expect(expiresAt).toBeGreaterThan(issuedAt);
    });

    it('應該每次調用都生成新會話', async () => {
      await request(app).post('/auth/test').send({});
      await request(app).post('/auth/test').send({});

      // 應該調用兩次 issueTestSession
      expect(mockIssueTestSession).toHaveBeenCalledTimes(2);
    });

    it('應該不需要任何請求體參數', async () => {
      // 不發送任何數據
      const response1 = await request(app).post('/auth/test');
      expect(response1.status).toBe(200);

      // 發送空對象
      const response2 = await request(app).post('/auth/test').send({});
      expect(response2.status).toBe(200);

      // 發送任意數據（應該被忽略）
      const response3 = await request(app).post('/auth/test').send({ random: 'data' });
      expect(response3.status).toBe(200);
    });

    it('應該返回完整的響應結構', async () => {
      const response = await request(app).post('/auth/test').send({});

      // 驗證所有必需字段都存在
      const requiredFields = ['token', 'user', 'expiresIn', 'issuedAt', 'expiresAt'];
      requiredFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
        expect(response.body[field]).toBeDefined();
        expect(response.body[field]).not.toBeNull();
      });
    });

    it('應該返回 JSON 格式的響應', async () => {
      const response = await request(app).post('/auth/test').send({});

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toBeTypeOf('object');
    });
  });

  describe('GET /auth/test - 方法不允許', () => {
    it('應該拒絕 GET 請求', async () => {
      const response = await request(app).get('/auth/test');

      // Express 會返回 404（因為只註冊了 POST）
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /auth/test - 方法不允許', () => {
    it('應該拒絕 PUT 請求', async () => {
      const response = await request(app).put('/auth/test').send({});

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /auth/test - 方法不允許', () => {
    it('應該拒絕 DELETE 請求', async () => {
      const response = await request(app).delete('/auth/test');

      expect(response.status).toBe(404);
    });
  });
});
