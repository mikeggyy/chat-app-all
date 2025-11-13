/**
 * 現代化 CSRF 保護中間件
 * 使用雙重 Cookie 提交模式（Double Submit Cookie Pattern）
 * 不依賴已棄用的 csurf 包
 */

import crypto from 'crypto';
import logger from './logger.js';

/**
 * 生成隨機 CSRF Token
 * @returns {string} CSRF Token
 */
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF Token 驗證中間件
 * @param {object} options - 配置選項
 * @returns {Function} Express 中間件
 */
export const csrfProtection = (options = {}) => {
  const {
    cookieName = '_csrf',
    headerName = 'x-csrf-token',
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
    cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 小時
    },
  } = options;

  return (req, res, next) => {
    // 跳過不需要 CSRF 保護的方法
    if (ignoreMethods.includes(req.method)) {
      return next();
    }

    // 從 Cookie 讀取 CSRF Token
    const cookieToken = req.cookies?.[cookieName];
    // 從 Header 讀取 CSRF Token
    const headerToken = req.headers[headerName] || req.body?._csrf;

    // 如果沒有 Cookie Token，這是第一次請求，跳過驗證
    // （Token 會在 GET 請求時設置）
    if (!cookieToken) {
      logger.warn('[CSRF] 請求缺少 CSRF Cookie', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'CSRF_TOKEN_MISSING',
        message: '請先獲取 CSRF Token',
      });
    }

    // 驗證 Token 是否匹配
    if (!headerToken || cookieToken !== headerToken) {
      logger.warn('[CSRF] CSRF Token 驗證失敗', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        hasCookieToken: !!cookieToken,
        hasHeaderToken: !!headerToken,
      });

      return res.status(403).json({
        error: 'CSRF_TOKEN_INVALID',
        message: 'CSRF Token 無效或已過期',
      });
    }

    // 驗證通過
    next();
  };
};

/**
 * 生成並設置 CSRF Token 的中間件
 * 用於 GET 請求，將 Token 設置到 Cookie 並返回給客戶端
 */
export const setCsrfToken = (options = {}) => {
  const {
    cookieName = '_csrf',
    cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 小時
    },
  } = options;

  return (req, res, next) => {
    // 檢查是否已有 Token
    let token = req.cookies?.[cookieName];

    // 如果沒有 Token，生成新的
    if (!token) {
      token = generateCsrfToken();
      res.cookie(cookieName, token, cookieOptions);
      logger.debug('[CSRF] 生成新的 CSRF Token');
    }

    // 將 Token 附加到 res.locals，供路由使用
    res.locals.csrfToken = token;

    next();
  };
};

/**
 * 獲取 CSRF Token 的路由處理器
 * 前端可以調用此端點獲取 Token
 */
export const getCsrfTokenHandler = (req, res) => {
  const token = res.locals.csrfToken;

  if (!token) {
    return res.status(500).json({
      error: 'CSRF_TOKEN_NOT_GENERATED',
      message: '無法生成 CSRF Token',
    });
  }

  res.json({
    csrfToken: token,
  });
};

/**
 * 簡化的 CSRF 保護應用函數
 * 自動配置 Token 生成和驗證
 */
export const applyCsrfProtection = (app, options = {}) => {
  const cookieParser = require('cookie-parser');

  // 1. 確保有 cookie-parser
  app.use(cookieParser());

  // 2. 為所有 GET 請求設置 CSRF Token
  app.use(setCsrfToken(options));

  // 3. 提供獲取 Token 的 API 端點
  app.get('/api/csrf-token', getCsrfTokenHandler);

  logger.info('[CSRF] CSRF 保護已啟用');
};

export default {
  csrfProtection,
  setCsrfToken,
  getCsrfTokenHandler,
  applyCsrfProtection,
};
