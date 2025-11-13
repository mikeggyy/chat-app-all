/**
 * 統一錯誤處理工具
 * 提供友好的錯誤消息和自動 Toast 通知
 */

import { useToast } from '../composables/useToast';

/**
 * 錯誤類型對應的友好消息
 */
const ERROR_MESSAGES = {
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
const STATUS_CODE_MAP = {
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
 * @param {Error|Object} error - 錯誤對象
 * @returns {Object} { message, type, code, details }
 */
export function parseError(error) {
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

  // 網絡錯誤
  if (error.isNetworkError || error.status === 0) {
    return {
      message: ERROR_MESSAGES.NETWORK_ERROR,
      type: 'NETWORK_ERROR',
      code: 0,
      details: error.message,
    };
  }

  // 根據 HTTP 狀態碼確定錯誤類型
  const status = error.status || error.statusCode;
  const errorType = STATUS_CODE_MAP[status] || 'UNKNOWN_ERROR';

  // 優先使用後端返回的錯誤消息
  let message = error.message;

  // 如果錯誤消息看起來像是技術性錯誤，使用友好消息
  if (!message || message.startsWith('Request failed') || message.includes('fetch')) {
    message = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // 處理特定的錯誤碼（後端的 errorCode 字段）
  if (error.errorCode || error.code) {
    const errorCode = error.errorCode || error.code;

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
    code: status,
    details: error.details || null,
  };
}

/**
 * 處理錯誤並顯示 Toast 通知
 * @param {Error|Object|string} error - 錯誤對象
 * @param {Object} options - 選項
 * @param {boolean} options.showToast - 是否顯示 Toast（默認 true）
 * @param {string} options.fallbackMessage - 備用錯誤消息
 * @param {Function} options.onError - 錯誤回調
 * @param {boolean} options.silent - 靜默模式（不顯示 Toast，只記錄日誌）
 * @returns {Object} 解析後的錯誤信息
 */
export function handleError(error, options = {}) {
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
 * @param {Function} asyncFn - 異步函數
 * @param {Object} options - 錯誤處理選項
 * @returns {Function} 包裝後的函數
 */
export function withErrorHandling(asyncFn, options = {}) {
  return async (...args) => {
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
 * @param {Object} defaultOptions - 默認選項
 * @returns {Object} 錯誤處理器實例
 */
export function createErrorHandler(defaultOptions = {}) {
  return {
    handle: (error, options = {}) => handleError(error, { ...defaultOptions, ...options }),
    parse: parseError,
    wrap: (asyncFn, options = {}) => withErrorHandling(asyncFn, { ...defaultOptions, ...options }),
  };
}

/**
 * 檢查錯誤是否為特定類型
 * @param {Error} error - 錯誤對象
 * @param {string} type - 錯誤類型
 * @returns {boolean}
 */
export function isErrorType(error, type) {
  const parsed = parseError(error);
  return parsed.type === type;
}

/**
 * 檢查錯誤是否為網絡錯誤
 * @param {Error} error - 錯誤對象
 * @returns {boolean}
 */
export function isNetworkError(error) {
  return isErrorType(error, 'NETWORK_ERROR');
}

/**
 * 檢查錯誤是否為認證錯誤
 * @param {Error} error - 錯誤對象
 * @returns {boolean}
 */
export function isAuthError(error) {
  return isErrorType(error, 'UNAUTHORIZED') || isErrorType(error, 'FORBIDDEN');
}

/**
 * 檢查錯誤是否為限制錯誤
 * @param {Error} error - 錯誤對象
 * @returns {boolean}
 */
export function isLimitError(error) {
  return isErrorType(error, 'LIMIT_EXCEEDED');
}

/**
 * 處理多個錯誤
 * @param {Array} errors - 錯誤數組
 * @param {Object} options - 選項
 * @returns {Array} 解析後的錯誤信息數組
 */
export function handleErrors(errors, options = {}) {
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
