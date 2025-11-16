/**
 * 統一錯誤處理工具
 * 提供友好的錯誤消息和自動 Toast 通知
 */

import { useToast } from '../composables/useToast.js';

/**
 * 錯誤類型
 */
export type ErrorType =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INSUFFICIENT_BALANCE'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_OPERATION'
  | 'UNKNOWN_ERROR';

/**
 * 錯誤碼類型
 */
export type ErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_COINS'
  | 'LIMIT_EXCEEDED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'PERMISSION_DENIED'
  | string;

/**
 * 解析後的錯誤對象
 */
export interface ParsedError {
  message: string;
  type: ErrorType;
  code: number | null;
  details: any;
}

/**
 * 擴展的錯誤對象
 */
export interface ExtendedError extends Error {
  isNetworkError?: boolean;
  status?: number;
  statusCode?: number;
  errorCode?: ErrorCode;
  code?: ErrorCode;
  details?: any;
}

/**
 * 錯誤處理選項
 */
export interface ErrorHandlerOptions {
  showToast?: boolean;
  fallbackMessage?: string | null;
  onError?: ((error: ParsedError) => void) | null;
  silent?: boolean;
}

/**
 * 錯誤處理器實例
 */
export interface ErrorHandlerInstance {
  handle: (error: Error | ExtendedError | string | any, options?: ErrorHandlerOptions) => ParsedError;
  parse: (error: Error | ExtendedError | string | any) => ParsedError;
  wrap: <T extends (...args: any[]) => Promise<any>>(
    asyncFn: T,
    options?: ErrorHandlerOptions
  ) => (...args: Parameters<T>) => Promise<ReturnType<T>>;
}

/**
 * 錯誤類型對應的友好消息
 */
const ERROR_MESSAGES: Record<ErrorType, string> = {
  // 網絡錯誤
  NETWORK_ERROR: '網絡連接失敗，請檢查您的網絡設置',
  TIMEOUT_ERROR: '請求超時，請重試',

  // 認證錯誤
  UNAUTHORIZED: '您尚未登入或登入已過期，請重新登入',
  FORBIDDEN: '您沒有權限執行此操作',

  // 客戶端錯誤
  BAD_REQUEST: '請求參數有誤，請檢查輸入',
  NOT_FOUND: '請求的資源不存在',
  CONFLICT: '操作衝突，請刷新後重試',

  // 服務器錯誤
  SERVER_ERROR: '服務器錯誤，請稍後再試',
  SERVICE_UNAVAILABLE: '服務暫時不可用，請稍後再試',

  // 業務邏輯錯誤
  INSUFFICIENT_BALANCE: '餘額不足',
  LIMIT_EXCEEDED: '已達到使用限制',
  INVALID_OPERATION: '無效的操作',

  // 默認錯誤
  UNKNOWN_ERROR: '發生未知錯誤，請稍後再試',
};

/**
 * HTTP 狀態碼對應的錯誤類型
 */
const STATUS_CODE_MAP: Record<number, ErrorType> = {
  0: 'NETWORK_ERROR',
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'TIMEOUT_ERROR',
  409: 'CONFLICT',
  429: 'LIMIT_EXCEEDED',
  500: 'SERVER_ERROR',
  502: 'SERVICE_UNAVAILABLE',
  503: 'SERVICE_UNAVAILABLE',
  504: 'TIMEOUT_ERROR',
};

/**
 * 解析錯誤對象，提取友好的錯誤消息
 * @param error - 錯誤對象
 * @returns { message, type, code, details }
 */
export function parseError(error: Error | ExtendedError | string | any): ParsedError {
  // 如果是字符串，直接返回
  if (typeof error === 'string') {
    return {
      message: error,
      type: 'UNKNOWN_ERROR',
      code: null,
      details: null,
    };
  }

  // 如果不是 Error 對象，嘗試轉換
  if (!(error instanceof Error)) {
    return {
      message: ERROR_MESSAGES.UNKNOWN_ERROR,
      type: 'UNKNOWN_ERROR',
      code: null,
      details: error,
    };
  }

  const extError = error as ExtendedError;

  // 網絡錯誤
  if (extError.isNetworkError || extError.status === 0) {
    return {
      message: ERROR_MESSAGES.NETWORK_ERROR,
      type: 'NETWORK_ERROR',
      code: 0,
      details: error.message,
    };
  }

  // 根據 HTTP 狀態碼確定錯誤類型
  const status = extError.status || extError.statusCode;
  const errorType: ErrorType = (status !== undefined && STATUS_CODE_MAP[status]) || 'UNKNOWN_ERROR';

  // 優先使用後端返回的錯誤消息
  let message = error.message;

  // 如果錯誤消息看起來像是技術性錯誤，使用友好消息
  if (!message || message.startsWith('Request failed') || message.includes('fetch')) {
    message = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // 處理特定的錯誤碼（後端的 errorCode 字段）
  if (extError.errorCode || extError.code) {
    const errorCode = extError.errorCode || extError.code;

    // 根據錯誤碼提供更具體的消息
    switch (errorCode) {
      case 'INSUFFICIENT_BALANCE':
      case 'INSUFFICIENT_COINS':
        message = ERROR_MESSAGES.INSUFFICIENT_BALANCE;
        break;
      case 'LIMIT_EXCEEDED':
      case 'RATE_LIMIT_EXCEEDED':
        message = ERROR_MESSAGES.LIMIT_EXCEEDED;
        break;
      case 'UNAUTHORIZED':
      case 'TOKEN_EXPIRED':
        message = ERROR_MESSAGES.UNAUTHORIZED;
        break;
      case 'FORBIDDEN':
      case 'PERMISSION_DENIED':
        message = ERROR_MESSAGES.FORBIDDEN;
        break;
      default:
        // 保持原始消息
        break;
    }
  }

  return {
    message,
    type: errorType,
    code: status || null,
    details: extError.details || null,
  };
}

/**
 * 處理錯誤並顯示 Toast 通知
 * @param error - 錯誤對象
 * @param options - 選項
 * @returns 解析後的錯誤信息
 */
export function handleError(
  error: Error | ExtendedError | string | any,
  options: ErrorHandlerOptions = {}
): ParsedError {
  const {
    showToast = true,
    fallbackMessage = null,
    onError = null,
    silent = false,
  } = options;

  const parsedError = parseError(error);
  const finalMessage = fallbackMessage || parsedError.message;

  // 記錄錯誤到控制台（開發環境）
  if (import.meta.env.DEV) {
    console.error('[Error Handler]', {
      type: parsedError.type,
      code: parsedError.code,
      message: finalMessage,
      details: parsedError.details,
      original: error,
    });
  }

  // 顯示 Toast（如果不是靜默模式）
  if (!silent && showToast) {
    const { error: showError } = useToast();
    showError(finalMessage);
  }

  // 執行錯誤回調
  if (onError && typeof onError === 'function') {
    try {
      onError(parsedError);
    } catch (callbackError) {
      console.error('[Error Handler] Error in callback:', callbackError);
    }
  }

  return parsedError;
}

/**
 * 為異步函數添加錯誤處理包裝
 * @param asyncFn - 異步函數
 * @param options - 錯誤處理選項
 * @returns 包裝後的函數
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  asyncFn: T,
  options: ErrorHandlerOptions = {}
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      handleError(error, options);
      throw error; // 重新拋出錯誤以保持原有流程
    }
  };
}

/**
 * 創建錯誤處理器實例（用於組件中）
 * @param defaultOptions - 默認選項
 * @returns 錯誤處理器實例
 */
export function createErrorHandler(defaultOptions: ErrorHandlerOptions = {}): ErrorHandlerInstance {
  return {
    handle: (error: Error | ExtendedError | string | any, options: ErrorHandlerOptions = {}) =>
      handleError(error, { ...defaultOptions, ...options }),
    parse: parseError,
    wrap: <T extends (...args: any[]) => Promise<any>>(
      asyncFn: T,
      options: ErrorHandlerOptions = {}
    ) => withErrorHandling(asyncFn, { ...defaultOptions, ...options }),
  };
}

/**
 * 檢查錯誤是否為特定類型
 * @param error - 錯誤對象
 * @param type - 錯誤類型
 * @returns boolean
 */
export function isErrorType(error: Error | ExtendedError | string | any, type: ErrorType): boolean {
  const parsed = parseError(error);
  return parsed.type === type;
}

/**
 * 檢查錯誤是否為網絡錯誤
 * @param error - 錯誤對象
 * @returns boolean
 */
export function isNetworkError(error: Error | ExtendedError | string | any): boolean {
  return isErrorType(error, 'NETWORK_ERROR');
}

/**
 * 檢查錯誤是否為認證錯誤
 * @param error - 錯誤對象
 * @returns boolean
 */
export function isAuthError(error: Error | ExtendedError | string | any): boolean {
  return isErrorType(error, 'UNAUTHORIZED') || isErrorType(error, 'FORBIDDEN');
}

/**
 * 檢查錯誤是否為限制錯誤
 * @param error - 錯誤對象
 * @returns boolean
 */
export function isLimitError(error: Error | ExtendedError | string | any): boolean {
  return isErrorType(error, 'LIMIT_EXCEEDED');
}

/**
 * 處理多個錯誤
 * @param errors - 錯誤數組
 * @param options - 選項
 * @returns 解析後的錯誤信息數組
 */
export function handleErrors(
  errors: (Error | ExtendedError | string | any)[] | Error | ExtendedError | string | any,
  options: ErrorHandlerOptions = {}
): ParsedError[] {
  if (!Array.isArray(errors)) {
    return [handleError(errors, options)];
  }

  return errors.map((error) => handleError(error, { ...options, showToast: false }));
}

export default {
  parseError,
  handleError,
  withErrorHandling,
  createErrorHandler,
  isErrorType,
  isNetworkError,
  isAuthError,
  isLimitError,
  handleErrors,
  ERROR_MESSAGES,
};
