/**
 * 統一的應用錯誤類
 * 提供標準化的錯誤處理和分類
 *
 * ✅ 優化點：
 * - 統一的錯誤結構
 * - 錯誤分類（Operational vs Programming）
 * - HTTP 狀態碼映射
 * - 錯誤元數據支持
 * - 與 errorCodes.js 整合
 */

import logger from "./logger.js";
import { ERROR_CODES } from "./errorCodes.js";

/**
 * 基礎應用錯誤類
 * 所有自定義錯誤都應該繼承此類
 */
export class AppError extends Error {
  /**
   * @param {string} message - 錯誤訊息
   * @param {number} statusCode - HTTP 狀態碼
   * @param {string} errorCode - 錯誤代碼（來自 errorCodes.js）
   * @param {Object} metadata - 額外的錯誤元數據
   * @param {boolean} isOperational - 是否為可預期的操作錯誤
   */
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', metadata = {}, isOperational = true) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.metadata = metadata;
    this.isOperational = isOperational; // true = 可預期的錯誤，false = 程式錯誤
    this.timestamp = new Date().toISOString();

    // 保留錯誤堆棧追蹤
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 轉換為 JSON 格式（用於 API 響應）
   */
  toJSON() {
    const response = {
      success: false,
      error: {
        message: this.message,
        code: this.errorCode,
        timestamp: this.timestamp,
      }
    };

    // 開發環境添加額外信息
    if (process.env.NODE_ENV !== 'production') {
      response.error.stack = this.stack;
      response.error.metadata = this.metadata;
    } else if (Object.keys(this.metadata).length > 0) {
      // 生產環境只添加安全的元數據
      response.error.details = this.metadata;
    }

    return response;
  }
}

/**
 * 驗證錯誤（400 Bad Request）
 * 用於請求參數驗證失敗
 */
export class ValidationError extends AppError {
  constructor(message = '請求參數驗證失敗', metadata = {}) {
    super(message, 400, ERROR_CODES.VALIDATION?.INVALID_INPUT || 'VALIDATION_ERROR', metadata);
  }
}

/**
 * 認證錯誤（401 Unauthorized）
 * 用於未登入或 token 無效
 */
export class AuthenticationError extends AppError {
  constructor(message = '未授權訪問，請先登入', metadata = {}) {
    super(message, 401, ERROR_CODES.AUTH?.UNAUTHORIZED || 'AUTH_ERROR', metadata);
  }
}

/**
 * 授權錯誤（403 Forbidden）
 * 用於權限不足
 */
export class ForbiddenError extends AppError {
  constructor(message = '權限不足，無法執行此操作', metadata = {}) {
    super(message, 403, ERROR_CODES.AUTH?.FORBIDDEN || 'FORBIDDEN', metadata);
  }
}

/**
 * 資源不存在錯誤（404 Not Found）
 */
export class NotFoundError extends AppError {
  constructor(resource = '資源', metadata = {}) {
    super(`找不到指定的${resource}`, 404, ERROR_CODES.RESOURCE?.NOT_FOUND || 'NOT_FOUND', metadata);
  }
}

/**
 * 衝突錯誤（409 Conflict）
 * 用於資源衝突（如重複創建）
 */
export class ConflictError extends AppError {
  constructor(message = '資源衝突', metadata = {}) {
    super(message, 409, ERROR_CODES.RESOURCE?.CONFLICT || 'CONFLICT', metadata);
  }
}

/**
 * 速率限制錯誤（429 Too Many Requests）
 */
export class RateLimitError extends AppError {
  constructor(message = '請求過於頻繁，請稍後再試', metadata = {}) {
    super(message, 429, ERROR_CODES.LIMIT?.RATE_LIMIT_EXCEEDED || 'RATE_LIMIT_EXCEEDED', metadata);
  }
}

/**
 * 業務邏輯錯誤（422 Unprocessable Entity）
 * 用於業務規則驗證失敗
 */
export class BusinessError extends AppError {
  constructor(message, metadata = {}) {
    super(message, 422, ERROR_CODES.BUSINESS?.RULE_VIOLATION || 'BUSINESS_ERROR', metadata);
  }
}

/**
 * 餘額不足錯誤
 */
export class InsufficientBalanceError extends BusinessError {
  constructor(required, current, metadata = {}) {
    super(
      `金幣不足，需要 ${required} 金幣，當前餘額 ${current} 金幣`,
      { required, current, ...metadata }
    );
    this.errorCode = ERROR_CODES.PAYMENT?.INSUFFICIENT_BALANCE || 'INSUFFICIENT_BALANCE';
  }
}

/**
 * 限制超出錯誤
 */
export class LimitExceededError extends BusinessError {
  constructor(limitType, metadata = {}) {
    super(
      `已達到${limitType}使用限制`,
      { limitType, ...metadata }
    );
    this.errorCode = ERROR_CODES.LIMIT?.LIMIT_EXCEEDED || 'LIMIT_EXCEEDED';
  }
}

/**
 * 服務不可用錯誤（503 Service Unavailable）
 */
export class ServiceUnavailableError extends AppError {
  constructor(service = '服務', metadata = {}) {
    super(`${service}暫時不可用，請稍後再試`, 503, ERROR_CODES.SYSTEM?.SERVICE_UNAVAILABLE || 'SERVICE_UNAVAILABLE', metadata);
  }
}

/**
 * 外部 API 錯誤
 */
export class ExternalAPIError extends AppError {
  constructor(service, originalError, metadata = {}) {
    super(
      `外部服務 ${service} 調用失敗`,
      502,
      ERROR_CODES.EXTERNAL?.API_ERROR || 'EXTERNAL_API_ERROR',
      { service, originalError: originalError?.message, ...metadata }
    );
  }
}

/**
 * 內部伺服器錯誤（500 Internal Server Error）
 * 用於未預期的程式錯誤
 */
export class InternalError extends AppError {
  constructor(message = '內部伺服器錯誤', metadata = {}, originalError = null) {
    super(message, 500, ERROR_CODES.SYSTEM?.INTERNAL_ERROR || 'INTERNAL_ERROR', metadata, false);

    if (originalError) {
      this.originalError = originalError;
      this.stack = originalError.stack || this.stack;
    }
  }
}

/**
 * 錯誤處理中間件
 * 統一處理所有錯誤並返回標準格式的響應
 */
export const errorHandler = (err, req, res, next) => {
  // 如果是 AppError，直接使用其屬性
  if (err instanceof AppError) {
    // 記錄錯誤（操作錯誤使用 warn，程式錯誤使用 error）
    if (err.isOperational) {
      logger.warn(`[${err.errorCode}] ${err.message}`, {
        path: req.path,
        method: req.method,
        userId: req.firebaseUser?.uid,
        metadata: err.metadata,
      });
    } else {
      logger.error(`[${err.errorCode}] ${err.message}`, {
        path: req.path,
        method: req.method,
        userId: req.firebaseUser?.uid,
        metadata: err.metadata,
        stack: err.stack,
      });
    }

    return res.status(err.statusCode).json(err.toJSON());
  }

  // 處理未預期的錯誤（非 AppError）
  logger.error('未預期的錯誤:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.firebaseUser?.uid,
  });

  // 轉換為 InternalError
  const internalError = new InternalError('系統發生未預期的錯誤', {}, err);
  return res.status(500).json(internalError.toJSON());
};

/**
 * 異步路由處理包裝器
 * 自動捕獲異步錯誤並傳遞給錯誤處理中間件
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 從舊的錯誤對象轉換為 AppError
 * 用於逐步遷移現有代碼
 */
export const toAppError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  // 根據錯誤訊息或屬性判斷類型
  if (error.message?.includes('找不到') || error.message?.includes('不存在')) {
    return new NotFoundError(error.message);
  }

  if (error.message?.includes('未授權') || error.message?.includes('未登入')) {
    return new AuthenticationError(error.message);
  }

  if (error.message?.includes('權限不足') || error.message?.includes('無權')) {
    return new ForbiddenError(error.message);
  }

  if (error.message?.includes('金幣不足') || error.message?.includes('餘額不足')) {
    return new InsufficientBalanceError(0, 0, { originalMessage: error.message });
  }

  if (error.message?.includes('已達到') || error.message?.includes('限制')) {
    return new LimitExceededError('', { originalMessage: error.message });
  }

  // 默認轉換為 InternalError
  return new InternalError(error.message || '未知錯誤', {}, error);
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BusinessError,
  InsufficientBalanceError,
  LimitExceededError,
  ServiceUnavailableError,
  ExternalAPIError,
  InternalError,
  errorHandler,
  asyncHandler,
  toAppError,
};
