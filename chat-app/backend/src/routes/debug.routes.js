/**
 * 調試路由
 * 僅用於開發環境調試認證問題
 */

import { Router } from 'express';
import { getFirebaseAdminAuth } from '../firebase/index.js';
import logger from '../utils/logger.js';

const router = Router();

// ⚠️ 僅在開發環境啟用
if (process.env.NODE_ENV !== 'production') {

  /**
   * POST /api/debug/verify-token
   * 直接測試 token 驗證
   * Body: { token: string }
   */
  router.post('/verify-token', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: '缺少 token',
        });
      }

      logger.info('[Debug] 開始驗證 token...');
      logger.info(`[Debug] Token (前 30 字元): ${token.substring(0, 30)}...`);

      // 移除 Bearer 前綴（如果有）
      const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

      const auth = getFirebaseAdminAuth();

      // 設置較長的超時時間
      const verifyOptions = process.env.USE_FIREBASE_EMULATOR === 'true'
        ? { checkRevoked: false }
        : {};

      logger.info('[Debug] 調用 auth.verifyIdToken...');

      const decoded = await auth.verifyIdToken(cleanToken, verifyOptions);

      logger.info('[Debug] ✅ Token 驗證成功');

      return res.json({
        success: true,
        message: 'Token 驗證成功',
        user: {
          uid: decoded.uid,
          email: decoded.email,
          iat: decoded.iat,
          exp: decoded.exp,
        },
      });

    } catch (error) {
      logger.error('[Debug] ❌ Token 驗證失敗:', error);

      return res.status(401).json({
        success: false,
        error: 'Token 驗證失敗',
        code: error.code || 'unknown',
        message: error.message,
        details: {
          errorCode: error.code,
          errorMessage: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        },
      });
    }
  });

  /**
   * GET /api/debug/firebase-status
   * 檢查 Firebase Admin SDK 狀態
   */
  router.get('/firebase-status', async (req, res) => {
    try {
      const auth = getFirebaseAdminAuth();

      return res.json({
        success: true,
        message: 'Firebase Admin SDK 已初始化',
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        nodeEnv: process.env.NODE_ENV || 'development',
        useEmulator: process.env.USE_FIREBASE_EMULATOR === 'true',
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin SDK 初始化失敗',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/debug/auth-test
   * 測試認證中間件
   */
  router.get('/auth-test', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: '缺少 Authorization header',
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    try {
      const auth = getFirebaseAdminAuth();
      const decoded = await auth.verifyIdToken(token);

      return res.json({
        success: true,
        message: '認證成功',
        user: {
          uid: decoded.uid,
          email: decoded.email,
        },
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: '認證失敗',
        code: error.code,
        message: error.message,
      });
    }
  });
}

export default router;
