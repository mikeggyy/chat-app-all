/**
 * 路由輔助函數
 * 提供統一的響應格式、錯誤處理和權限驗證
 */

import logger from "./logger.js";

/**
 * 統一成功響應格式
 * @param {Object} res - Express response 對象
 * @param {Object} data - 響應數據
 * @param {number} status - HTTP status code (default: 200)
 */
export function sendSuccess(res, data = {}, status = 200) {
  res.status(status).json({
    success: true,
    ...data,
  });
}

/**
 * 統一錯誤響應格式
 * @param {Object} res - Express response 對象
 * @param {string|Error} error - 錯誤訊息或錯誤對象
 * @param {number} status - HTTP status code (default: 400)
 */
export function sendError(res, error, status = 400) {
  const message = error instanceof Error ? error.message : error;

  res.status(status).json({
    success: false,
    error: message,
    message, // 向後兼容，有些前端可能使用 message 欄位
  });
}

/**
 * 統一的 async route handler 包裝器
 * 自動捕獲錯誤並處理
 * @param {Function} handler - async 處理函數
 * @returns {Function} Express middleware
 */
export function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      logger.error("Route handler error:", error);
      sendError(res, error, 500);
    }
  };
}

/**
 * 權限驗證中間件工廠函數
 * 檢查當前用戶是否有權限操作指定用戶的資源
 * @param {string} userIdParamName - 路由參數中的 userId 欄位名稱 (default: 'userId')
 * @returns {Function} Express middleware
 */
export function requireOwnership(userIdParamName = "userId") {
  return (req, res, next) => {
    const targetUserId = req.params[userIdParamName] || req.body[userIdParamName];
    const currentUserId = req.firebaseUser?.uid;

    if (!currentUserId) {
      return sendError(res, "未認證", 401);
    }

    if (currentUserId !== targetUserId) {
      return sendError(res, "無權限操作其他用戶的資源", 403);
    }

    next();
  };
}

/**
 * 驗證必要參數
 * @param {Array<string>} paramNames - 必要參數名稱列表
 * @param {string} source - 參數來源 ('params', 'body', 'query')
 * @returns {Function} Express middleware
 */
export function requireParams(paramNames, source = "params") {
  return (req, res, next) => {
    const data = req[source];
    const missing = paramNames.filter((name) => !data[name]);

    if (missing.length > 0) {
      return sendError(
        res,
        `缺少必要參數: ${missing.join(", ")}`,
        400
      );
    }

    next();
  };
}

/**
 * 限制類型的專屬錯誤處理
 * 根據錯誤訊息返回適當的 HTTP status code
 * @param {Error} error - 錯誤對象
 * @returns {number} HTTP status code
 */
export function getLimitErrorStatus(error) {
  const message = error.message.toLowerCase();

  // 已達上限
  if (message.includes("已達") || message.includes("上限") || message.includes("已用完")) {
    return 429; // Too Many Requests
  }

  // 權限相關
  if (message.includes("權限") || message.includes("無法操作")) {
    return 403; // Forbidden
  }

  // 參數錯誤
  if (message.includes("需要提供") || message.includes("無效")) {
    return 400; // Bad Request
  }

  // 預設為 400
  return 400;
}

/**
 * 限制類型路由的統一包裝器
 * 自動處理權限、錯誤和響應格式
 */
export function createLimitRouteHandler(serviceFunction, options = {}) {
  const {
    requireAuth = true,
    requireOwner = true,
    extractParams = (req) => req.params,
  } = options;

  return asyncHandler(async (req, res) => {
    // 權限檢查
    if (requireAuth && !req.firebaseUser) {
      return sendError(res, "未認證", 401);
    }

    const params = extractParams(req);

    if (requireOwner && req.firebaseUser) {
      const { userId } = params;
      if (req.firebaseUser.uid !== userId) {
        return sendError(res, "無權限操作其他用戶的資源", 403);
      }
    }

    // 調用服務函數
    try {
      const result = serviceFunction(...Object.values(params));
      sendSuccess(res, result);
    } catch (error) {
      const status = getLimitErrorStatus(error);
      sendError(res, error, status);
    }
  });
}
