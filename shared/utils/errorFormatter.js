import { ERROR_CODES, getErrorByCode, mapFirebaseError } from "./errorCodes.js";
import crypto from "crypto";

/**
 * 生成簡單的請求 ID
 * @returns {string} 請求 ID
 */
const generateRequestId = () => {
  return `req_${crypto.randomBytes(8).toString("hex")}`;
};

/**
 * API 統一錯誤響應格式化工具（跨應用共享）
 *
 * 統一的錯誤響應格式：
 * {
 *   status: 400,                    // HTTP 狀態碼
 *   code: "VALIDATION_ERROR",       // 統一錯誤碼
 *   message: "請求數據驗證失敗",     // 給用戶看的訊息
 *   details: {...},                 // 詳細錯誤信息（可選）
 *   requestId: "req_12345",         // 追蹤用（可選）
 *   timestamp: "2025-11-08T...",    // 錯誤發生時間
 * }
 */

/**
 * 創建標準錯誤響應
 *
 * @param {string} errorCode - 錯誤碼（來自 ERROR_CODES）
 * @param {string} [customMessage] - 自定義訊息（覆蓋默認訊息）
 * @param {Object} [details] - 詳細錯誤信息
 * @param {string} [requestId] - 請求 ID（用於追蹤）
 * @returns {Object} 標準錯誤響應物件
 */
export const createErrorResponse = (
  errorCode,
  customMessage = null,
  details = null,
  requestId = null
) => {
  const errorInfo = getErrorByCode(errorCode);

  const response = {
    status: errorInfo.status,
    code: errorInfo.code,
    message: customMessage || errorInfo.message,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    response.details = details;
  }

  if (requestId) {
    response.requestId = requestId;
  }

  return response;
};

/**
 * 從 Error 對象創建錯誤響應
 *
 * @param {Error} error - JavaScript Error 對象
 * @param {string} [defaultCode] - 默認錯誤碼（如果無法識別錯誤類型）
 * @param {string} [requestId] - 請求 ID
 * @returns {Object} 標準錯誤響應物件
 */
export const errorFromException = (error, defaultCode = "INTERNAL_SERVER_ERROR", requestId = null) => {
  // 檢查是否為 Firebase 錯誤
  if (error.code && error.code.startsWith("auth/")) {
    const mappedCode = mapFirebaseError(error);
    return createErrorResponse(mappedCode, error.message, null, requestId);
  }

  // 檢查是否已經是格式化的錯誤
  if (error.code && ERROR_CODES[error.code]) {
    return createErrorResponse(error.code, error.message, error.details, requestId);
  }

  // 默認為內部伺服器錯誤
  const errorInfo = getErrorByCode(defaultCode);
  return createErrorResponse(
    defaultCode,
    process.env.NODE_ENV === "production" ? errorInfo.message : error.message,
    process.env.NODE_ENV === "production" ? null : { stack: error.stack },
    requestId
  );
};

/**
 * Express 錯誤處理中間件
 * 使用方式：app.use(errorHandlerMiddleware);
 *
 * @param {Error} err - 錯誤對象
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 * @param {Function} next - Express Next
 */
export const errorHandlerMiddleware = (err, req, res, next) => {
  // 生成請求 ID（如果沒有）
  const requestId = req.id || req.headers["x-request-id"] || generateRequestId();

  // 記錄錯誤（在生產環境中應該發送到日誌服務）
  console.error(`[${requestId}] Error:`, {
    code: err.code,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // 創建錯誤響應
  const errorResponse = errorFromException(err, "INTERNAL_SERVER_ERROR", requestId);

  // 返回錯誤響應
  res.status(errorResponse.status).json(errorResponse);
};

/**
 * 創建自定義錯誤類
 * 使用方式：throw new ApiError("USER_NOT_FOUND", "找不到該用戶", { userId: "123" });
 */
export class ApiError extends Error {
  constructor(code, message = null, details = null) {
    const errorInfo = getErrorByCode(code);
    super(message || errorInfo.message);
    this.name = "ApiError";
    this.code = code;
    this.status = errorInfo.status;
    this.details = details;
  }
}

/**
 * 驗證錯誤響應（用於輸入驗證）
 *
 * @param {Array<Object>} validationErrors - 驗證錯誤列表
 * @param {string} [requestId] - 請求 ID
 * @returns {Object} 標準錯誤響應物件
 *
 * @example
 * validationErrorResponse([
 *   { field: "email", message: "無效的郵箱格式" },
 *   { field: "password", message: "密碼長度至少 6 個字符" }
 * ]);
 */
export const validationErrorResponse = (validationErrors, requestId = null) => {
  return createErrorResponse(
    "VALIDATION_ERROR",
    "請求數據驗證失敗",
    { errors: validationErrors },
    requestId
  );
};

/**
 * 限制錯誤響應（用於達到使用限制時）
 *
 * @param {string} limitType - 限制類型（conversation, voice, photo, video 等）
 * @param {Object} limitInfo - 限制詳情
 * @param {string} [requestId] - 請求 ID
 * @returns {Object} 標準錯誤響應物件
 *
 * @example
 * limitErrorResponse("conversation", {
 *   current: 10,
 *   limit: 10,
 *   resetAt: "2025-11-09T00:00:00Z"
 * });
 */
export const limitErrorResponse = (limitType, limitInfo, requestId = null) => {
  const limitCodeMap = {
    conversation: "CONVERSATION_LIMIT_REACHED",
    voice: "VOICE_LIMIT_REACHED",
    photo: "PHOTO_LIMIT_REACHED",
    video: "VIDEO_LIMIT_REACHED",
    rate: "RATE_LIMIT_EXCEEDED",
  };

  const errorCode = limitCodeMap[limitType] || "RESOURCE_LIMIT_EXCEEDED";

  return createErrorResponse(
    errorCode,
    null,
    limitInfo,
    requestId
  );
};

/**
 * 快速發送錯誤響應（在路由處理器中使用）
 *
 * @param {Object} res - Express Response
 * @param {string} errorCode - 錯誤碼
 * @param {string} [customMessage] - 自定義訊息
 * @param {Object} [details] - 詳細信息
 *
 * @example
 * sendError(res, "USER_NOT_FOUND", "找不到該用戶", { userId: "123" });
 */
export const sendError = (res, errorCode, customMessage = null, details = null) => {
  const errorResponse = createErrorResponse(errorCode, customMessage, details);
  res.status(errorResponse.status).json(errorResponse);
};

/**
 * 快速發送成功響應（標準格式）
 *
 * @param {Object} res - Express Response
 * @param {*} data - 響應數據
 * @param {Object} [meta] - 元數據（分頁、統計等）
 *
 * @example
 * sendSuccess(res, users, { total: 100, page: 1, limit: 20 });
 */
export const sendSuccess = (res, data, meta = null) => {
  const response = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  res.json(response);
};
