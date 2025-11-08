/**
 * API 統一錯誤碼定義（跨應用共享）
 *
 * 使用規範：
 * - 錯誤碼格式：CATEGORY_SPECIFIC_ERROR
 * - HTTP 狀態碼對應：根據錯誤類型返回適當的狀態碼
 *
 * 使用位置：
 * - chat-app-3/backend
 * - chat-app-admin/backend
 */

/**
 * 錯誤碼定義
 */
export const ERROR_CODES = {
  // ========== 認證錯誤 (4xx) ==========
  AUTH_UNAUTHORIZED: {
    code: "AUTH_UNAUTHORIZED",
    status: 401,
    message: "未授權訪問",
  },
  AUTH_TOKEN_INVALID: {
    code: "AUTH_TOKEN_INVALID",
    status: 401,
    message: "無效的認證令牌",
  },
  AUTH_TOKEN_EXPIRED: {
    code: "AUTH_TOKEN_EXPIRED",
    status: 401,
    message: "認證令牌已過期",
  },
  AUTH_INSUFFICIENT_PERMISSIONS: {
    code: "AUTH_INSUFFICIENT_PERMISSIONS",
    status: 403,
    message: "權限不足",
  },

  // ========== 用戶錯誤 (4xx) ==========
  USER_NOT_FOUND: {
    code: "USER_NOT_FOUND",
    status: 404,
    message: "用戶不存在",
  },
  USER_ALREADY_EXISTS: {
    code: "USER_ALREADY_EXISTS",
    status: 409,
    message: "用戶已存在",
  },
  USER_DISABLED: {
    code: "USER_DISABLED",
    status: 403,
    message: "用戶帳號已被停用",
  },

  // ========== 資源錯誤 (4xx) ==========
  RESOURCE_NOT_FOUND: {
    code: "RESOURCE_NOT_FOUND",
    status: 404,
    message: "資源不存在",
  },
  RESOURCE_ALREADY_EXISTS: {
    code: "RESOURCE_ALREADY_EXISTS",
    status: 409,
    message: "資源已存在",
  },
  RESOURCE_LIMIT_EXCEEDED: {
    code: "RESOURCE_LIMIT_EXCEEDED",
    status: 429,
    message: "資源使用超過限制",
  },

  // ========== 驗證錯誤 (4xx) ==========
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    status: 400,
    message: "請求數據驗證失敗",
  },
  INVALID_REQUEST: {
    code: "INVALID_REQUEST",
    status: 400,
    message: "無效的請求",
  },
  MISSING_REQUIRED_FIELD: {
    code: "MISSING_REQUIRED_FIELD",
    status: 400,
    message: "缺少必要字段",
  },
  INVALID_FIELD_VALUE: {
    code: "INVALID_FIELD_VALUE",
    status: 400,
    message: "字段值無效",
  },

  // ========== 會員系統錯誤 (4xx) ==========
  MEMBERSHIP_REQUIRED: {
    code: "MEMBERSHIP_REQUIRED",
    status: 403,
    message: "需要會員資格",
  },
  MEMBERSHIP_TIER_INSUFFICIENT: {
    code: "MEMBERSHIP_TIER_INSUFFICIENT",
    status: 403,
    message: "會員等級不足",
  },
  MEMBERSHIP_EXPIRED: {
    code: "MEMBERSHIP_EXPIRED",
    status: 403,
    message: "會員資格已過期",
  },

  // ========== 支付錯誤 (4xx) ==========
  PAYMENT_FAILED: {
    code: "PAYMENT_FAILED",
    status: 402,
    message: "支付失敗",
  },
  INSUFFICIENT_BALANCE: {
    code: "INSUFFICIENT_BALANCE",
    status: 402,
    message: "餘額不足",
  },
  INVALID_PAYMENT_METHOD: {
    code: "INVALID_PAYMENT_METHOD",
    status: 400,
    message: "無效的支付方式",
  },

  // ========== 限制錯誤 (4xx) ==========
  RATE_LIMIT_EXCEEDED: {
    code: "RATE_LIMIT_EXCEEDED",
    status: 429,
    message: "請求過於頻繁",
  },
  CONVERSATION_LIMIT_REACHED: {
    code: "CONVERSATION_LIMIT_REACHED",
    status: 429,
    message: "對話次數已達上限",
  },
  VOICE_LIMIT_REACHED: {
    code: "VOICE_LIMIT_REACHED",
    status: 429,
    message: "語音次數已達上限",
  },
  PHOTO_LIMIT_REACHED: {
    code: "PHOTO_LIMIT_REACHED",
    status: 429,
    message: "拍照次數已達上限",
  },
  VIDEO_LIMIT_REACHED: {
    code: "VIDEO_LIMIT_REACHED",
    status: 429,
    message: "影片次數已達上限",
  },

  // ========== AI 服務錯誤 (5xx) ==========
  AI_SERVICE_UNAVAILABLE: {
    code: "AI_SERVICE_UNAVAILABLE",
    status: 503,
    message: "AI 服務暫時不可用",
  },
  AI_GENERATION_FAILED: {
    code: "AI_GENERATION_FAILED",
    status: 500,
    message: "AI 生成失敗",
  },
  AI_TIMEOUT: {
    code: "AI_TIMEOUT",
    status: 504,
    message: "AI 服務超時",
  },

  // ========== 系統錯誤 (5xx) ==========
  INTERNAL_SERVER_ERROR: {
    code: "INTERNAL_SERVER_ERROR",
    status: 500,
    message: "伺服器內部錯誤",
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    status: 500,
    message: "資料庫錯誤",
  },
  EXTERNAL_SERVICE_ERROR: {
    code: "EXTERNAL_SERVICE_ERROR",
    status: 502,
    message: "外部服務錯誤",
  },
  SERVICE_UNAVAILABLE: {
    code: "SERVICE_UNAVAILABLE",
    status: 503,
    message: "服務暫時不可用",
  },

  // ========== 冪等性錯誤 (4xx) ==========
  DUPLICATE_REQUEST: {
    code: "DUPLICATE_REQUEST",
    status: 409,
    message: "重複的請求",
  },
  IDEMPOTENCY_CONFLICT: {
    code: "IDEMPOTENCY_CONFLICT",
    status: 409,
    message: "冪等性衝突：此請求正在處理中",
  },
};

/**
 * 根據錯誤碼獲取錯誤信息
 * @param {string} code - 錯誤碼
 * @returns {Object} 錯誤信息
 */
export const getErrorByCode = (code) => {
  return ERROR_CODES[code] || ERROR_CODES.INTERNAL_SERVER_ERROR;
};

/**
 * Firebase 錯誤碼映射
 * 將 Firebase 的錯誤碼映射到統一的錯誤碼
 */
export const FIREBASE_ERROR_MAPPING = {
  "auth/user-not-found": "USER_NOT_FOUND",
  "auth/email-already-exists": "USER_ALREADY_EXISTS",
  "auth/invalid-email": "INVALID_FIELD_VALUE",
  "auth/invalid-password": "INVALID_FIELD_VALUE",
  "auth/user-disabled": "USER_DISABLED",
  "auth/id-token-expired": "AUTH_TOKEN_EXPIRED",
  "auth/invalid-id-token": "AUTH_TOKEN_INVALID",
  "auth/argument-error": "INVALID_REQUEST",
  "permission-denied": "AUTH_INSUFFICIENT_PERMISSIONS",
  "not-found": "RESOURCE_NOT_FOUND",
  "already-exists": "RESOURCE_ALREADY_EXISTS",
  "resource-exhausted": "RATE_LIMIT_EXCEEDED",
  "unauthenticated": "AUTH_UNAUTHORIZED",
};

/**
 * 將 Firebase 錯誤轉換為統一錯誤碼
 * @param {Error} error - Firebase 錯誤
 * @returns {string} 統一錯誤碼
 */
export const mapFirebaseError = (error) => {
  const firebaseCode = error.code;
  return FIREBASE_ERROR_MAPPING[firebaseCode] || "INTERNAL_SERVER_ERROR";
};
