/**
 * CSRF 保護集成測試
 * 確保所有寫操作端點都受到 CSRF Token 保護
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import {
  setCsrfToken,
  getCsrfTokenHandler,
  csrfProtection,
} from '../../../../shared/backend-utils/csrfProtection.js';

describe('CSRF Protection Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(setCsrfToken());

    // CSRF Token 獲取端點
    app.get('/api/csrf-token', getCsrfTokenHandler);

    // 應用 CSRF 保護到所有寫操作（跳過公開路徑）
    app.use((req, res, next) => {
      const publicPaths = ['/api/auth/login', '/api/auth/register'];
      const isPublicPath = publicPaths.some((path) =>
        req.path.startsWith(path)
      );
      const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
        req.method
      );

      if (isWriteMethod && !isPublicPath) {
        return csrfProtection()(req, res, next);
      }

      next();
    });

    // 測試端點
    app.post('/api/test-protected', (req, res) => {
      res.json({ success: true, message: 'Protected endpoint accessed' });
    });

    app.post('/api/auth/login', (req, res) => {
      res.json({ success: true, message: 'Public endpoint (no CSRF required)' });
    });

    app.get('/api/test-read', (req, res) => {
      res.json({ success: true, message: 'Read endpoint (no CSRF required)' });
    });
  });

  afterEach(() => {
    app = null;
  });

  describe('CSRF Token 獲取', () => {
    it('應該成功獲取 CSRF Token', async () => {
      const response = await request(app).get('/api/csrf-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('csrfToken');
      expect(typeof response.body.csrfToken).toBe('string');
      expect(response.body.csrfToken.length).toBeGreaterThan(0);
    });

    it('應該在 Cookie 中設置 CSRF Token', async () => {
      const response = await request(app).get('/api/csrf-token');

      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      const csrfCookie = cookies.find((cookie) => cookie.startsWith('_csrf='));
      expect(csrfCookie).toBeDefined();
    });
  });

  describe('寫操作端點保護', () => {
    it('應該拒絕沒有 CSRF Token 的 POST 請求', async () => {
      const response = await request(app)
        .post('/api/test-protected')
        .send({ data: 'test' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
      expect(response.body.message).toBe('請先獲取 CSRF Token');
    });

    it('應該拒絕無效的 CSRF Token', async () => {
      const response = await request(app)
        .post('/api/test-protected')
        .set('x-csrf-token', 'invalid-token')
        .send({ data: 'test' });

      expect(response.status).toBe(403);
      // 當沒有 Cookie Token 時，返回 CSRF_TOKEN_MISSING
      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
    });

    it('應該接受有效 CSRF Token 的 POST 請求', async () => {
      // 1. 獲取 CSRF Token
      const tokenRes = await request(app).get('/api/csrf-token');
      const csrfToken = tokenRes.body.csrfToken;
      const cookies = tokenRes.headers['set-cookie'];

      // 2. 使用 Token 發送請求
      const response = await request(app)
        .post('/api/test-protected')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Protected endpoint accessed');
    });

    it('應該支持多個連續請求使用同一個 Token', async () => {
      // 1. 獲取 CSRF Token
      const tokenRes = await request(app).get('/api/csrf-token');
      const csrfToken = tokenRes.body.csrfToken;
      const cookies = tokenRes.headers['set-cookie'];

      // 2. 第一個請求
      const response1 = await request(app)
        .post('/api/test-protected')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ data: 'test1' });

      expect(response1.status).toBe(200);

      // 3. 第二個請求（使用同一個 Token）
      const response2 = await request(app)
        .post('/api/test-protected')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ data: 'test2' });

      expect(response2.status).toBe(200);
    });
  });

  describe('公開端點', () => {
    it('公開端點不需要 CSRF Token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('讀操作端點', () => {
    it('GET 請求不需要 CSRF Token', async () => {
      const response = await request(app).get('/api/test-read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('錯誤處理', () => {
    it('應該拒絕 Cookie 和 Header Token 不匹配的請求', async () => {
      // 1. 獲取 CSRF Token
      const tokenRes = await request(app).get('/api/csrf-token');
      const cookies = tokenRes.headers['set-cookie'];

      // 2. 使用不同的 Token
      const response = await request(app)
        .post('/api/test-protected')
        .set('Cookie', cookies)
        .set('x-csrf-token', 'different-token')
        .send({ data: 'test' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_INVALID');
    });

    it('應該拒絕只有 Header Token 沒有 Cookie 的請求', async () => {
      const response = await request(app)
        .post('/api/test-protected')
        .set('x-csrf-token', 'some-token')
        .send({ data: 'test' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
    });
  });

  describe('PUT/DELETE/PATCH 請求保護', () => {
    beforeEach(() => {
      app.put('/api/test-protected-put', (req, res) => {
        res.json({ success: true, method: 'PUT' });
      });
      app.delete('/api/test-protected-delete', (req, res) => {
        res.json({ success: true, method: 'DELETE' });
      });
      app.patch('/api/test-protected-patch', (req, res) => {
        res.json({ success: true, method: 'PATCH' });
      });
    });

    it('應該保護 PUT 請求', async () => {
      const response = await request(app)
        .put('/api/test-protected-put')
        .send({ data: 'test' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
    });

    it('應該保護 DELETE 請求', async () => {
      const response = await request(app).delete('/api/test-protected-delete');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
    });

    it('應該保護 PATCH 請求', async () => {
      const response = await request(app)
        .patch('/api/test-protected-patch')
        .send({ data: 'test' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
    });

    it('有效 Token 應該允許所有寫操作', async () => {
      // 獲取 Token
      const tokenRes = await request(app).get('/api/csrf-token');
      const csrfToken = tokenRes.body.csrfToken;
      const cookies = tokenRes.headers['set-cookie'];

      // 測試 PUT
      const putRes = await request(app)
        .put('/api/test-protected-put')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ data: 'test' });
      expect(putRes.status).toBe(200);

      // 測試 DELETE
      const deleteRes = await request(app)
        .delete('/api/test-protected-delete')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);
      expect(deleteRes.status).toBe(200);

      // 測試 PATCH
      const patchRes = await request(app)
        .patch('/api/test-protected-patch')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ data: 'test' });
      expect(patchRes.status).toBe(200);
    });
  });
});
