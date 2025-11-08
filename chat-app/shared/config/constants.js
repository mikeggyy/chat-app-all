/**
 * 共享常量配置
 * 統一管理前後端的魔術數字和字串常量
 */

/**
 * 時間相關常量（毫秒）
 */
export const TIME_CONSTANTS = {
  // 秒
  ONE_SECOND: 1000,
  FIVE_SECONDS: 5 * 1000,
  TEN_SECONDS: 10 * 1000,
  FIFTEEN_SECONDS: 15 * 1000,
  THIRTY_SECONDS: 30 * 1000,

  // 分鐘
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,

  // 小時
  ONE_HOUR: 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  TWELVE_HOURS: 12 * 60 * 60 * 1000,
  TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000,

  // 天
  ONE_DAY: 24 * 60 * 60 * 1000,
  SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000,
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000,
};

/**
 * 文字長度限制
 */
export const TEXT_LENGTH_LIMITS = {
  // 用戶相關
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 50,
  DEFAULT_PROMPT_MAX: 200,
  BIO_MAX: 500,

  // 訊息相關
  MESSAGE_MIN: 1,
  MESSAGE_MAX: 2000,
  SYSTEM_PROMPT_MAX: 5000,

  // 其他
  TAG_MAX: 20,
  TITLE_MAX: 100,
  DESCRIPTION_MAX: 500,
};

/**
 * 數量限制
 */
export const QUANTITY_LIMITS = {
  // 歷史記錄
  MAX_HISTORY_MESSAGES: 200,
  MAX_HISTORY_WINDOW: 12, // AI 生成使用的歷史窗口
  SUGGESTION_WINDOW: 6, // 建議生成使用的歷史窗口

  // 列表
  MAX_FAVORITES: 100,
  MAX_CONVERSATIONS: 500,
  MAX_TAGS_PER_CHARACTER: 10,

  // 分頁
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // 緩存
  MAX_PROFILE_CACHE_SIZE: 1000,
  MAX_CHARACTER_CACHE_SIZE: 500,
};

/**
 * 檔案大小限制（位元組）
 */
export const FILE_SIZE_LIMITS = {
  AVATAR_MAX: 5 * 1024 * 1024, // 5MB
  IMAGE_MAX: 10 * 1024 * 1024, // 10MB
  JSON_PAYLOAD_MAX: 50 * 1024 * 1024, // 50MB (用於 base64 圖片)
};

/**
 * 圖片相關常量
 */
export const IMAGE_CONSTANTS = {
  // 壓縮品質
  WEBP_QUALITY: 60,
  JPEG_QUALITY: 80,

  // 尺寸
  AVATAR_SIZE: 200,
  THUMBNAIL_SIZE: 400,
  PORTRAIT_WIDTH: 832,
  PORTRAIT_HEIGHT: 1248,
};

/**
 * API 相關常量
 */
export const API_CONSTANTS = {
  // 超時時間
  DEFAULT_TIMEOUT: TIME_CONSTANTS.THIRTY_SECONDS,
  UPLOAD_TIMEOUT: TIME_CONSTANTS.FIVE_MINUTES,
  AI_GENERATION_TIMEOUT: 2 * TIME_CONSTANTS.ONE_MINUTE,

  // 重試
  MAX_RETRIES: 3,
  RETRY_DELAY: TIME_CONSTANTS.ONE_SECOND,
};

/**
 * 驗證規則
 */
export const VALIDATION_RULES = {
  // Email
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // 密碼
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,

  // UID
  UID_LENGTH: 10, // 6位英文 + 4位中文

  // ID 格式
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};

/**
 * HTTP 狀態碼
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * 錯誤代碼
 */
export const ERROR_CODES = {
  // 認證相關
  AUTH_TOKEN_EXPIRED: "auth/token-expired",
  AUTH_INVALID_TOKEN: "auth/invalid-token",
  AUTH_USER_NOT_FOUND: "auth/user-not-found",

  // 限制相關
  LIMIT_EXCEEDED: "limit/exceeded",
  RATE_LIMIT_EXCEEDED: "rate-limit/exceeded",

  // 驗證相關
  VALIDATION_FAILED: "validation/failed",
  INVALID_INPUT: "validation/invalid-input",

  // 資源相關
  RESOURCE_NOT_FOUND: "resource/not-found",
  RESOURCE_ALREADY_EXISTS: "resource/already-exists",
};

export default {
  TIME_CONSTANTS,
  TEXT_LENGTH_LIMITS,
  QUANTITY_LIMITS,
  FILE_SIZE_LIMITS,
  IMAGE_CONSTANTS,
  API_CONSTANTS,
  VALIDATION_RULES,
  HTTP_STATUS,
  ERROR_CODES,
};
