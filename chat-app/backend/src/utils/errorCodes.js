/**
 * 統一錯誤碼系統
 * 提供標準化的錯誤碼和錯誤消息
 *
 * 錯誤碼格式：CATEGORY_SPECIFIC_REASON
 * 例如：AUTH_TOKEN_EXPIRED, PAYMENT_INSUFFICIENT_BALANCE
 */

// ==================== 錯誤碼類別 ====================

/**
 * 認證和授權錯誤 (1xxx)
 */
export const AUTH_ERRORS = {
  // Token 相關
  TOKEN_MISSING: {
    code: 'AUTH_TOKEN_MISSING',
    status: 401,
    message: '請提供認證 token',
  },
  TOKEN_INVALID: {
    code: 'AUTH_TOKEN_INVALID',
    status: 401,
    message: '認證 token 無效',
  },
  TOKEN_EXPIRED: {
    code: 'AUTH_TOKEN_EXPIRED',
    status: 401,
    message: '認證 token 已過期，請重新登入',
  },

  // 權限相關
  PERMISSION_DENIED: {
    code: 'AUTH_PERMISSION_DENIED',
    status: 403,
    message: '您沒有權限執行此操作',
  },
  UNAUTHORIZED_ACCESS: {
    code: 'AUTH_UNAUTHORIZED_ACCESS',
    status: 403,
    message: '無權訪問此資源',
  },
  NOT_SAME_USER: {
    code: 'AUTH_NOT_SAME_USER',
    status: 403,
    message: '您只能操作自己的數據',
  },

  // 帳號相關
  ACCOUNT_NOT_FOUND: {
    code: 'AUTH_ACCOUNT_NOT_FOUND',
    status: 404,
    message: '帳號不存在',
  },
  ACCOUNT_DISABLED: {
    code: 'AUTH_ACCOUNT_DISABLED',
    status: 403,
    message: '帳號已被停用',
  },
  ACCOUNT_SUSPENDED: {
    code: 'AUTH_ACCOUNT_SUSPENDED',
    status: 403,
    message: '帳號已被暫停',
  },
};

/**
 * 驗證錯誤 (2xxx)
 */
export const VALIDATION_ERRORS = {
  MISSING_PARAMETER: {
    code: 'VALIDATION_MISSING_PARAMETER',
    status: 400,
    message: '缺少必要參數',
  },
  INVALID_PARAMETER: {
    code: 'VALIDATION_INVALID_PARAMETER',
    status: 400,
    message: '參數格式不正確',
  },
  PARAMETER_OUT_OF_RANGE: {
    code: 'VALIDATION_PARAMETER_OUT_OF_RANGE',
    status: 400,
    message: '參數超出有效範圍',
  },
  INVALID_EMAIL: {
    code: 'VALIDATION_INVALID_EMAIL',
    status: 400,
    message: 'Email 格式不正確',
  },
  INVALID_PHONE: {
    code: 'VALIDATION_INVALID_PHONE',
    status: 400,
    message: '手機號碼格式不正確',
  },
};

/**
 * 資源錯誤 (3xxx)
 */
export const RESOURCE_ERRORS = {
  NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    status: 404,
    message: '找不到請求的資源',
  },
  ALREADY_EXISTS: {
    code: 'RESOURCE_ALREADY_EXISTS',
    status: 409,
    message: '資源已存在',
  },
  CONFLICT: {
    code: 'RESOURCE_CONFLICT',
    status: 409,
    message: '資源衝突',
  },
  CHARACTER_NOT_FOUND: {
    code: 'RESOURCE_CHARACTER_NOT_FOUND',
    status: 404,
    message: '找不到指定的 AI 角色',
  },
  USER_NOT_FOUND: {
    code: 'RESOURCE_USER_NOT_FOUND',
    status: 404,
    message: '找不到指定的用戶',
  },
};

/**
 * 支付和金幣錯誤 (4xxx)
 */
export const PAYMENT_ERRORS = {
  // 餘額不足
  INSUFFICIENT_BALANCE: {
    code: 'PAYMENT_INSUFFICIENT_BALANCE',
    status: 402,
    message: '金幣餘額不足',
  },
  INSUFFICIENT_COINS: {
    code: 'PAYMENT_INSUFFICIENT_COINS',
    status: 402,
    message: '金幣不足，請先儲值',
  },

  // 購買相關
  PURCHASE_FAILED: {
    code: 'PAYMENT_PURCHASE_FAILED',
    status: 500,
    message: '購買失敗，請稍後再試',
  },
  INVALID_PACKAGE: {
    code: 'PAYMENT_INVALID_PACKAGE',
    status: 400,
    message: '無效的套餐 ID',
  },
  PAYMENT_DECLINED: {
    code: 'PAYMENT_DECLINED',
    status: 402,
    message: '支付被拒絕',
  },

  // 交易相關
  TRANSACTION_FAILED: {
    code: 'PAYMENT_TRANSACTION_FAILED',
    status: 500,
    message: '交易處理失敗',
  },
  DUPLICATE_TRANSACTION: {
    code: 'PAYMENT_DUPLICATE_TRANSACTION',
    status: 409,
    message: '重複的交易請求',
  },
};

/**
 * 業務邏輯錯誤 (5xxx)
 */
export const BUSINESS_ERRORS = {
  // 限制相關
  LIMIT_EXCEEDED: {
    code: 'BUSINESS_LIMIT_EXCEEDED',
    status: 429,
    message: '已達到使用限制',
  },
  CONVERSATION_LIMIT_REACHED: {
    code: 'BUSINESS_CONVERSATION_LIMIT_REACHED',
    status: 429,
    message: '已達到對話次數限制',
  },
  VOICE_LIMIT_REACHED: {
    code: 'BUSINESS_VOICE_LIMIT_REACHED',
    status: 429,
    message: '已達到語音播放次數限制',
  },
  PHOTO_LIMIT_REACHED: {
    code: 'BUSINESS_PHOTO_LIMIT_REACHED',
    status: 429,
    message: '已達到照片生成次數限制',
  },
  VIDEO_LIMIT_REACHED: {
    code: 'BUSINESS_VIDEO_LIMIT_REACHED',
    status: 429,
    message: '已達到影片生成次數限制',
  },

  // 會員相關
  MEMBERSHIP_REQUIRED: {
    code: 'BUSINESS_MEMBERSHIP_REQUIRED',
    status: 403,
    message: '此功能需要會員資格',
  },
  INVALID_MEMBERSHIP_TIER: {
    code: 'BUSINESS_INVALID_MEMBERSHIP_TIER',
    status: 400,
    message: '無效的會員等級',
  },
  DOWNGRADE_NOT_ALLOWED: {
    code: 'BUSINESS_DOWNGRADE_NOT_ALLOWED',
    status: 400,
    message: '不允許降級會員',
  },

  // 資產相關
  ASSET_NOT_FOUND: {
    code: 'BUSINESS_ASSET_NOT_FOUND',
    status: 404,
    message: '找不到指定的資產',
  },
  INSUFFICIENT_ASSETS: {
    code: 'BUSINESS_INSUFFICIENT_ASSETS',
    status: 402,
    message: '資產數量不足',
  },
  INVALID_ASSET_TYPE: {
    code: 'BUSINESS_INVALID_ASSET_TYPE',
    status: 400,
    message: '無效的資產類型',
  },

  // 角色創建相關
  CHARACTER_CREATION_FAILED: {
    code: 'BUSINESS_CHARACTER_CREATION_FAILED',
    status: 500,
    message: 'AI 角色創建失敗',
  },
  MAX_CHARACTERS_REACHED: {
    code: 'BUSINESS_MAX_CHARACTERS_REACHED',
    status: 429,
    message: '已達到最大角色創建數量',
  },
};

/**
 * 速率限制錯誤 (6xxx)
 */
export const RATE_LIMIT_ERRORS = {
  GENERAL: {
    code: 'RATE_LIMIT_EXCEEDED',
    status: 429,
    message: '請求過於頻繁，請稍後再試',
  },
  PURCHASE: {
    code: 'RATE_LIMIT_PURCHASE_EXCEEDED',
    status: 429,
    message: '購買操作過於頻繁，請稍後再試',
  },
  GIFT: {
    code: 'RATE_LIMIT_GIFT_EXCEEDED',
    status: 429,
    message: '送禮操作過於頻繁，請稍後再試',
  },
  AUTH: {
    code: 'RATE_LIMIT_AUTH_EXCEEDED',
    status: 429,
    message: '認證嘗試過多，請稍後再試',
  },
  AI_GENERATION: {
    code: 'RATE_LIMIT_AI_GENERATION_EXCEEDED',
    status: 429,
    message: 'AI 生成請求過於頻繁，請稍後再試',
  },
};

/**
 * 系統錯誤 (7xxx)
 */
export const SYSTEM_ERRORS = {
  INTERNAL_ERROR: {
    code: 'SYSTEM_INTERNAL_ERROR',
    status: 500,
    message: '系統錯誤，請稍後再試',
  },
  SERVICE_UNAVAILABLE: {
    code: 'SYSTEM_SERVICE_UNAVAILABLE',
    status: 503,
    message: '服務暫時不可用',
  },
  DATABASE_ERROR: {
    code: 'SYSTEM_DATABASE_ERROR',
    status: 500,
    message: '數據庫錯誤',
  },
  EXTERNAL_SERVICE_ERROR: {
    code: 'SYSTEM_EXTERNAL_SERVICE_ERROR',
    status: 502,
    message: '外部服務錯誤',
  },
  TIMEOUT: {
    code: 'SYSTEM_TIMEOUT',
    status: 504,
    message: '請求超時',
  },
};

/**
 * AI 服務錯誤 (8xxx)
 */
export const AI_ERRORS = {
  GENERATION_FAILED: {
    code: 'AI_GENERATION_FAILED',
    status: 500,
    message: 'AI 生成失敗，請稍後再試',
  },
  CONVERSATION_FAILED: {
    code: 'AI_CONVERSATION_FAILED',
    status: 500,
    message: 'AI 對話生成失敗',
  },
  IMAGE_GENERATION_FAILED: {
    code: 'AI_IMAGE_GENERATION_FAILED',
    status: 500,
    message: 'AI 圖片生成失敗',
  },
  VIDEO_GENERATION_FAILED: {
    code: 'AI_VIDEO_GENERATION_FAILED',
    status: 500,
    message: 'AI 影片生成失敗',
  },
  TTS_GENERATION_FAILED: {
    code: 'AI_TTS_GENERATION_FAILED',
    status: 500,
    message: 'AI 語音生成失敗',
  },
  MODEL_OVERLOADED: {
    code: 'AI_MODEL_OVERLOADED',
    status: 503,
    message: 'AI 模型負載過高，請稍後再試',
  },
  QUOTA_EXCEEDED: {
    code: 'AI_QUOTA_EXCEEDED',
    status: 429,
    message: 'AI 服務配額已用盡',
  },
};

// ==================== 工具函數 ====================

/**
 * 根據錯誤碼獲取錯誤信息
 * @param {string} errorCode - 錯誤碼
 * @returns {Object|null} 錯誤信息對象
 */
export const getErrorByCode = (errorCode) => {
  const allErrors = [
    ...Object.values(AUTH_ERRORS),
    ...Object.values(VALIDATION_ERRORS),
    ...Object.values(RESOURCE_ERRORS),
    ...Object.values(PAYMENT_ERRORS),
    ...Object.values(BUSINESS_ERRORS),
    ...Object.values(RATE_LIMIT_ERRORS),
    ...Object.values(SYSTEM_ERRORS),
    ...Object.values(AI_ERRORS),
  ];

  return allErrors.find(error => error.code === errorCode) || null;
};

/**
 * 創建標準化的錯誤響應
 * @param {Object} error - 錯誤對象（來自 ERROR_CODES）
 * @param {Object} details - 額外的錯誤詳情
 * @returns {Object} 標準化的錯誤響應
 */
export const createErrorResponse = (error, details = {}) => {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...details,
    },
  };
};

/**
 * 發送錯誤響應
 * @param {Object} res - Express response 對象
 * @param {Object} error - 錯誤對象（來自 ERROR_CODES）
 * @param {Object} details - 額外的錯誤詳情
 */
export const sendErrorResponse = (res, error, details = {}) => {
  res.status(error.status).json(createErrorResponse(error, details));
};

// ==================== 錯誤碼索引 ====================

/**
 * 所有錯誤碼的集合
 */
export const ERROR_CODES = {
  AUTH: AUTH_ERRORS,
  VALIDATION: VALIDATION_ERRORS,
  RESOURCE: RESOURCE_ERRORS,
  PAYMENT: PAYMENT_ERRORS,
  BUSINESS: BUSINESS_ERRORS,
  RATE_LIMIT: RATE_LIMIT_ERRORS,
  SYSTEM: SYSTEM_ERRORS,
  AI: AI_ERRORS,
};

/**
 * 快速訪問常用錯誤
 */
export const COMMON_ERRORS = {
  // 認證
  UNAUTHORIZED: AUTH_ERRORS.TOKEN_INVALID,
  FORBIDDEN: AUTH_ERRORS.PERMISSION_DENIED,

  // 驗證
  INVALID_INPUT: VALIDATION_ERRORS.INVALID_PARAMETER,
  MISSING_PARAM: VALIDATION_ERRORS.MISSING_PARAMETER,

  // 資源
  NOT_FOUND: RESOURCE_ERRORS.NOT_FOUND,
  CONFLICT: RESOURCE_ERRORS.CONFLICT,

  // 支付
  NO_MONEY: PAYMENT_ERRORS.INSUFFICIENT_BALANCE,

  // 業務
  LIMIT_REACHED: BUSINESS_ERRORS.LIMIT_EXCEEDED,

  // 系統
  SERVER_ERROR: SYSTEM_ERRORS.INTERNAL_ERROR,
  SERVICE_DOWN: SYSTEM_ERRORS.SERVICE_UNAVAILABLE,

  // 速率限制
  TOO_MANY_REQUESTS: RATE_LIMIT_ERRORS.GENERAL,
};

export default {
  ERROR_CODES,
  COMMON_ERRORS,
  getErrorByCode,
  createErrorResponse,
  sendErrorResponse,
};
