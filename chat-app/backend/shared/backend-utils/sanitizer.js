/**
 * 日誌脫敏工具
 * 自動識別和過濾日誌中的敏感信息
 */

/**
 * 敏感字段名稱列表（支援不同語言和格式）
 * 匹配這些字段名稱的值會被完全替換為 [REDACTED]
 */
const SENSITIVE_FIELD_NAMES = new Set([
  // 密碼相關
  'password',
  'passwd',
  'pwd',
  'pass',
  'secret',
  'passphrase',
  'newPassword',
  'oldPassword',
  'currentPassword',
  'confirmPassword',

  // Token 和 Key
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'apiKey',
  'api_key',
  'secretKey',
  'privateKey',
  'private_key',
  'publicKey',
  'public_key',
  'authToken',
  'bearerToken',
  'sessionToken',
  'csrfToken',

  // Firebase 相關
  'firebaseApiKey',
  'firebasePrivateKey',
  'serviceAccountKey',

  // OpenAI 和其他 API
  'openaiApiKey',
  'OPENAI_API_KEY',
  'replicateApiToken',
  'REPLICATE_API_TOKEN',

  // 支付相關
  'creditCard',
  'cardNumber',
  'cvv',
  'cvc',
  'cardCvv',
  'cardCvc',
  'expiryDate',
  'billingInfo',

  // 個人資訊（完全隱藏）
  'ssn',
  'socialSecurityNumber',
  'idNumber',
  'nationalId',
  'passport',
  'driverLicense',

  // 其他敏感資訊
  'authorization',
  'cookie',
  'x-api-key',
]);

/**
 * 需要部分隱藏的字段名稱
 * 這些字段會保留部分信息以便追蹤，但隱藏關鍵部分
 */
const PARTIALLY_HIDDEN_FIELDS = new Set([
  'email',
  'phone',
  'phoneNumber',
  'mobile',
  'mobileNumber',
  'userId',
  'username',
]);

/**
 * 正則表達式模式
 */
const PATTERNS = {
  // Email: 保留前 2 字元和 @ 後的域名
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // 手機號（台灣格式）: 09XXXXXXXX -> 09****XXXX
  phone: /^09\d{8}$/,

  // JWT Token: eyJ 開頭的 Base64 字符串
  jwt: /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,

  // API Key: 通常是長字串（32+ 字元）
  apiKey: /^[A-Za-z0-9_-]{32,}$/,

  // Bearer Token
  bearer: /^Bearer\s+.+$/i,

  // 信用卡號（簡單檢測：13-19 位數字）
  creditCard: /^\d{13,19}$/,
};

/**
 * 完全隱藏敏感值
 * @param {any} value - 原始值
 * @returns {string} 替換後的值
 */
const redactSensitiveValue = (value) => {
  if (value === null || value === undefined) {
    return value;
  }
  return '[REDACTED]';
};

/**
 * 部分隱藏 Email
 * 例如: user@example.com -> us***@example.com
 * @param {string} email - Email 地址
 * @returns {string} 部分隱藏的 Email
 */
const maskEmail = (email) => {
  if (typeof email !== 'string' || !PATTERNS.email.test(email)) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }

  const visiblePart = localPart.substring(0, 2);
  return `${visiblePart}***@${domain}`;
};

/**
 * 部分隱藏手機號
 * 例如: 0912345678 -> 09****5678
 * @param {string} phone - 手機號
 * @returns {string} 部分隱藏的手機號
 */
const maskPhone = (phone) => {
  if (typeof phone !== 'string' || !PATTERNS.phone.test(phone)) {
    return phone;
  }

  return phone.substring(0, 2) + '****' + phone.substring(6);
};

/**
 * 隱藏 Token（保留前後各 4 個字元）
 * 例如: eyJhbGciOiJIUzI1... -> eyJh...I1Ni
 * @param {string} token - Token 字串
 * @returns {string} 部分隱藏的 Token
 */
const maskToken = (token) => {
  if (typeof token !== 'string' || token.length < 20) {
    return '[TOKEN]';
  }

  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
};

/**
 * 檢查字段名是否為敏感字段
 * 支援大小寫不敏感和蛇形/駝峰命名法
 * @param {string} key - 字段名
 * @returns {boolean} 是否為敏感字段
 */
const isSensitiveField = (key) => {
  if (typeof key !== 'string') {
    return false;
  }

  // 轉為小寫進行比較
  const lowerKey = key.toLowerCase();

  // 直接匹配
  if (SENSITIVE_FIELD_NAMES.has(lowerKey)) {
    return true;
  }

  // 檢查是否包含敏感關鍵字
  for (const sensitiveWord of SENSITIVE_FIELD_NAMES) {
    if (lowerKey.includes(sensitiveWord.toLowerCase())) {
      return true;
    }
  }

  return false;
};

/**
 * 檢查字段名是否需要部分隱藏
 * @param {string} key - 字段名
 * @returns {boolean} 是否需要部分隱藏
 */
const isPartiallyHiddenField = (key) => {
  if (typeof key !== 'string') {
    return false;
  }

  const lowerKey = key.toLowerCase();
  return PARTIALLY_HIDDEN_FIELDS.has(lowerKey);
};

/**
 * 根據值的模式判斷是否為敏感數據
 * @param {any} value - 值
 * @returns {boolean} 是否為敏感數據
 */
const isSensitiveValueByPattern = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  // JWT Token
  if (PATTERNS.jwt.test(value)) {
    return true;
  }

  // Bearer Token
  if (PATTERNS.bearer.test(value)) {
    return true;
  }

  // API Key（長字串）
  if (PATTERNS.apiKey.test(value)) {
    return true;
  }

  // 信用卡號
  if (PATTERNS.creditCard.test(value.replace(/\s|-/g, ''))) {
    return true;
  }

  return false;
};

/**
 * 脫敏單個值
 * @param {string} key - 字段名
 * @param {any} value - 值
 * @returns {any} 脫敏後的值
 */
const sanitizeValue = (key, value) => {
  // null 或 undefined 直接返回
  if (value === null || value === undefined) {
    return value;
  }

  // 檢查字段名是否為敏感字段（完全隱藏）
  if (isSensitiveField(key)) {
    return redactSensitiveValue(value);
  }

  // 檢查字段名是否需要部分隱藏
  if (isPartiallyHiddenField(key)) {
    if (typeof value === 'string') {
      // Email
      if (PATTERNS.email.test(value)) {
        return maskEmail(value);
      }
      // 手機號
      if (PATTERNS.phone.test(value)) {
        return maskPhone(value);
      }
    }
    return value;
  }

  // 根據值的模式判斷
  if (isSensitiveValueByPattern(value)) {
    if (PATTERNS.jwt.test(value) || PATTERNS.bearer.test(value) || PATTERNS.apiKey.test(value)) {
      return maskToken(value);
    }
    if (PATTERNS.creditCard.test(value.replace(/\s|-/g, ''))) {
      return '[CARD]';
    }
  }

  return value;
};

/**
 * 深度脫敏對象
 * @param {any} obj - 要脫敏的對象
 * @param {number} depth - 當前深度（防止循環引用）
 * @param {Set} seen - 已處理的對象集合（防止循環引用）
 * @returns {any} 脫敏後的對象
 */
const sanitizeObject = (obj, depth = 0, seen = new Set()) => {
  // 防止過深的遞歸
  if (depth > 10) {
    return '[MAX_DEPTH]';
  }

  // 基本類型直接返回
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // 防止循環引用
  if (seen.has(obj)) {
    return '[CIRCULAR]';
  }
  seen.add(obj);

  // 處理 Date 對象
  if (obj instanceof Date) {
    return obj;
  }

  // 處理 Error 對象
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
    };
  }

  // 處理數組
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1, seen));
  }

  // 處理普通對象
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      // 遞歸處理嵌套對象
      sanitized[key] = sanitizeObject(value, depth + 1, seen);
    } else {
      // 脫敏單個值
      sanitized[key] = sanitizeValue(key, value);
    }
  }

  return sanitized;
};

/**
 * 主要的日誌脫敏函數
 * @param {...any} args - 日誌參數
 * @returns {Array} 脫敏後的參數數組
 */
export const sanitizeLogArgs = (...args) => {
  return args.map((arg) => {
    // 基本類型直接返回
    if (typeof arg !== 'object' || arg === null) {
      return arg;
    }

    // 對象進行深度脫敏
    return sanitizeObject(arg);
  });
};

/**
 * 脫敏單個對象（導出供外部使用）
 * @param {any} obj - 要脫敏的對象
 * @returns {any} 脫敏後的對象
 */
export const sanitize = (obj) => {
  return sanitizeObject(obj);
};

/**
 * 檢查字符串是否包含敏感信息（快速檢測）
 * @param {string} str - 要檢查的字符串
 * @returns {boolean} 是否包含敏感信息
 */
export const containsSensitiveData = (str) => {
  if (typeof str !== 'string') {
    return false;
  }

  // 檢查是否包含敏感關鍵字
  const lowerStr = str.toLowerCase();
  for (const keyword of ['password', 'token', 'secret', 'apikey', 'api_key']) {
    if (lowerStr.includes(keyword)) {
      return true;
    }
  }

  // 檢查是否匹配敏感模式
  return PATTERNS.jwt.test(str) || PATTERNS.apiKey.test(str);
};

export default {
  sanitize,
  sanitizeLogArgs,
  containsSensitiveData,
};
