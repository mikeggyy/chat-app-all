/**
 * 路由輔助函數
 * 提供統一的響應格式、錯誤處理和權限驗證
 * ✅ 2025-12-02 優化：擴展統一路由驗證框架
 */

import logger from "./logger.js";
import { handleIdempotentRequest } from "./idempotency.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js";
import { logAdminAction, ADMIN_AUDIT_TYPES } from "../services/adminAudit.service.js";

/**
 * 統一成功響應格式
 * @param {Object} res - Express response 對象
 * @param {Object} data - 響應數據
 * @param {number} status - HTTP status code (default: 200)
 *
 * 注意：此函數與 shared/utils/errorFormatter.js 中的 sendSuccess 稍有不同
 * 這裡的 data 會被展開到響應中（向後兼容），而 shared 版本會包裝在 data 欄位中
 *
 * 建議新代碼使用 shared/utils/errorFormatter.js 的 sendSuccess
 */
export function sendSuccess(res, data = {}, status = 200) {
  res.status(status).json({
    success: true,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * 統一錯誤響應格式
 * @param {Object} res - Express response 對象
 * @param {string|Error} error - 錯誤訊息或錯誤對象
 * @param {number} status - HTTP status code (default: 400)
 *
 * 注意：建議新代碼使用 shared/utils/errorFormatter.js 的 sendError
 * 以獲得更完整的錯誤碼系統支持
 */
export function sendError(res, error, status = 400) {
  const message = error instanceof Error ? error.message : error;

  res.status(status).json({
    success: false,
    error: message,
    message, // 向後兼容，有些前端可能使用 message 欄位
    timestamp: new Date().toISOString(),
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
      // 檢查是否已經發送響應，避免 "Cannot set headers after they are sent" 錯誤
      if (!res.headersSent) {
        sendError(res, error, 500);
      }
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

// ========== 2025-12-02 新增：擴展路由輔助功能 ==========

/**
 * 錯誤碼映射表
 * 將常見錯誤訊息映射到標準 HTTP 狀態碼
 */
export const ERROR_STATUS_MAP = {
  // 認證相關 (401)
  "未認證": 401,
  "認證失敗": 401,
  "token 無效": 401,
  "token 過期": 401,

  // 權限相關 (403)
  "無權限": 403,
  "禁止訪問": 403,
  "僅限管理員": 403,
  "無權操作": 403,

  // 資源相關 (404)
  "找不到": 404,
  "不存在": 404,
  "資源不存在": 404,

  // 衝突相關 (409)
  "已存在": 409,
  "重複": 409,
  "衝突": 409,

  // 限制相關 (429)
  "已達上限": 429,
  "次數不足": 429,
  "已用完": 429,
  "請稍後": 429,

  // 參數相關 (400)
  "缺少": 400,
  "無效": 400,
  "格式錯誤": 400,
  "必須提供": 400,
};

/**
 * 根據錯誤訊息智能判斷 HTTP 狀態碼
 * @param {Error|string} error - 錯誤對象或訊息
 * @returns {number} HTTP 狀態碼
 */
export function getErrorStatus(error) {
  const message = (error instanceof Error ? error.message : error).toLowerCase();

  for (const [keyword, status] of Object.entries(ERROR_STATUS_MAP)) {
    if (message.includes(keyword.toLowerCase())) {
      return status;
    }
  }

  // 預設為 500
  return 500;
}

/**
 * 財務操作路由包裝器
 * 自動處理：冪等性、認證、審計日誌、錯誤處理
 *
 * @param {Function} handler - 處理函數 (req, res, userId) => Promise<result>
 * @param {Object} options - 選項
 * @param {string} options.operationType - 操作類型（用於日誌）
 * @param {string} options.idempotencyPrefix - 冪等性鍵前綴
 * @param {number} options.idempotencyTTL - 冪等性 TTL（毫秒）
 * @param {boolean} options.requireIdempotencyKey - 是否必須提供冪等性鍵
 */
export function createFinancialRouteHandler(handler, options = {}) {
  const {
    operationType = "財務操作",
    idempotencyPrefix = "financial",
    idempotencyTTL = IDEMPOTENCY_TTL.COIN_PACKAGE,
    requireIdempotencyKey = true,
  } = options;

  return asyncHandler(async (req, res) => {
    const userId = req.firebaseUser?.uid;

    // 1. 認證檢查
    if (!userId) {
      return sendError(res, "未認證", 401);
    }

    // 2. 冪等性鍵檢查
    const idempotencyKey = req.body.idempotencyKey || req.headers["idempotency-key"];

    if (requireIdempotencyKey && !idempotencyKey) {
      return sendError(
        res,
        `缺少必要參數：idempotencyKey（${operationType}必須提供冪等性鍵以防止重複操作）`,
        400
      );
    }

    try {
      let result;

      if (idempotencyKey) {
        // 3. 使用冪等性處理
        const requestId = `${idempotencyPrefix}:${userId}:${idempotencyKey}`;
        result = await handleIdempotentRequest(
          requestId,
          () => handler(req, res, userId),
          { ttl: idempotencyTTL }
        );
      } else {
        // 無冪等性鍵，直接執行
        result = await handler(req, res, userId);
      }

      logger.info(`[${operationType}] 成功: userId=${userId}`);
      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[${operationType}] 失敗: ${error.message}`);
      const status = getErrorStatus(error);
      sendError(res, error, status);
    }
  });
}

/**
 * 管理員操作路由包裝器
 * 自動處理：認證、權限驗證、審計日誌、錯誤處理
 *
 * @param {Function} handler - 處理函數 (req, res, adminId) => Promise<result>
 * @param {Object} options - 選項
 * @param {string} options.auditAction - 審計操作類型 (ADMIN_AUDIT_TYPES)
 * @param {string} options.targetType - 目標類型 ('user' | 'character' | 'config')
 * @param {Function} options.getTargetId - 獲取目標 ID 的函數 (req) => targetId
 * @param {Function} options.getBeforeState - 獲取操作前狀態的函數（可選）
 * @param {boolean} options.requireSuperAdmin - 是否需要超級管理員權限
 */
export function createAdminRouteHandler(handler, options = {}) {
  const {
    auditAction = null,
    targetType = "system",
    getTargetId = () => null,
    getBeforeState = null,
    requireSuperAdmin = false,
  } = options;

  return asyncHandler(async (req, res) => {
    const adminId = req.firebaseUser?.uid;
    const adminEmail = req.firebaseUser?.email;
    const isAdmin = req.firebaseUser?.customClaims?.admin;
    const isSuperAdmin = req.firebaseUser?.customClaims?.super_admin;

    // 1. 認證檢查
    if (!adminId) {
      return sendError(res, "未認證", 401);
    }

    // 2. 權限檢查
    if (requireSuperAdmin && !isSuperAdmin) {
      return sendError(res, "此操作需要超級管理員權限", 403);
    }

    if (!isAdmin && !isSuperAdmin) {
      return sendError(res, "此操作僅限管理員使用", 403);
    }

    const targetId = getTargetId(req);
    let beforeState = null;

    // 3. 獲取操作前狀態（用於審計）
    if (getBeforeState) {
      try {
        beforeState = await getBeforeState(req);
      } catch (e) {
        logger.warn(`[管理員操作] 獲取操作前狀態失敗: ${e.message}`);
      }
    }

    try {
      // 4. 執行處理函數
      const result = await handler(req, res, adminId);

      // 5. 記錄審計日誌
      if (auditAction) {
        try {
          await logAdminAction({
            adminId,
            adminEmail,
            action: auditAction,
            targetType,
            targetId,
            beforeState,
            afterState: result,
            reason: req.body.reason || req.query.reason || "",
            ip: req.ip,
            userAgent: req.get("User-Agent"),
          });
        } catch (auditError) {
          logger.error(`[管理員操作] 審計日誌記錄失敗: ${auditError.message}`);
        }
      }

      logger.info(`[管理員操作] ${auditAction || "操作"} 成功: adminId=${adminId}, targetId=${targetId}`);
      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[管理員操作] 失敗: ${error.message}`);
      const status = getErrorStatus(error);
      sendError(res, error, status);
    }
  });
}

/**
 * 組合多個中間件
 * @param {...Function} middlewares - 中間件列表
 * @returns {Function} 組合後的中間件
 */
export function composeMiddlewares(...middlewares) {
  return async (req, res, next) => {
    let index = 0;

    const runNext = async () => {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];

      try {
        await middleware(req, res, runNext);
      } catch (error) {
        next(error);
      }
    };

    await runNext();
  };
}

/**
 * 請求日誌中間件
 * 記錄請求的基本信息
 *
 * @param {Object} options - 選項
 * @param {boolean} options.logBody - 是否記錄請求體
 * @param {Array<string>} options.sensitiveFields - 敏感字段列表（會被遮蔽）
 */
export function requestLogger(options = {}) {
  const {
    logBody = false,
    sensitiveFields = ["password", "token", "secret", "key", "authorization"],
  } = options;

  return (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    // 響應完成時記錄
    res.on("finish", () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      let logData = {
        method,
        url: originalUrl,
        status: statusCode,
        duration: `${duration}ms`,
        ip,
      };

      if (logBody && req.body) {
        // 遮蔽敏感字段
        const sanitizedBody = { ...req.body };
        for (const field of sensitiveFields) {
          if (field in sanitizedBody) {
            sanitizedBody[field] = "***";
          }
        }
        logData.body = sanitizedBody;
      }

      if (statusCode >= 400) {
        logger.warn(`[HTTP] ${method} ${originalUrl} ${statusCode} ${duration}ms`, logData);
      } else {
        logger.debug(`[HTTP] ${method} ${originalUrl} ${statusCode} ${duration}ms`);
      }
    });

    next();
  };
}

export default {
  sendSuccess,
  sendError,
  asyncHandler,
  requireOwnership,
  requireParams,
  getLimitErrorStatus,
  createLimitRouteHandler,
  // 2025-12-02 新增
  ERROR_STATUS_MAP,
  getErrorStatus,
  createFinancialRouteHandler,
  createAdminRouteHandler,
  composeMiddlewares,
  requestLogger,
};
