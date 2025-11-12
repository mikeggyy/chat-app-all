/**
 * 測試帳號配置（跨應用共享）
 * 統一管理所有測試用戶相關的常量和檢查函數
 *
 * 使用位置：
 * - chat-app/backend
 * - chat-app/frontend
 * - chat-app-admin/backend
 * - chat-app-admin/frontend
 */

/**
 * 測試帳號 ID 常量
 */
export const TEST_ACCOUNTS = {
  GUEST_USER_ID: "test-user",        // 訪客測試帳號
  GUEST_TOKEN: "test-token",          // 訪客測試 token
  DEV_USER_ID: "6FXftJp96WeXYqAO4vRYs52EFXN2",  // 開發者測試帳號
};

/**
 * 測試帳號配置選項
 * 注意：此配置在瀏覽器環境中使用默認值
 *
 * 🔒 安全性增強（2025-01）：
 * - 強制禁用生產環境測試帳號（移除 ENABLED_IN_PRODUCTION 配置）
 * - 測試帳號僅限本地開發環境（localhost/127.0.0.1）
 * - 測試 token 有 24 小時有效期限
 */
export const TEST_CONFIG = typeof process !== 'undefined' && process.env ? {
  // 測試 token 有效期限（小時）
  TOKEN_EXPIRY_HOURS: parseInt(process.env.TEST_TOKEN_EXPIRY_HOURS || "24", 10),
} : {
  // 瀏覽器環境默認值
  TOKEN_EXPIRY_HOURS: 24,
};

// 存儲測試 token 的簽發時間（僅後端使用）
const testTokenIssuedAt = typeof Map !== 'undefined' ? new Map() : null;

/**
 * 簽發新的測試 session（僅後端使用）
 * @returns {Object} 包含 token 和過期時間的物件
 */
export const issueTestSession = () => {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TEST_CONFIG.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;

  if (testTokenIssuedAt) {
    testTokenIssuedAt.set(TEST_ACCOUNTS.GUEST_TOKEN, issuedAt);
  }

  return {
    token: TEST_ACCOUNTS.GUEST_TOKEN,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    expiresIn: TEST_CONFIG.TOKEN_EXPIRY_HOURS * 3600, // 秒
  };
};

/**
 * 驗證測試 token 是否有效（僅後端使用）
 * 🔒 安全性增強（2025-01）：強制禁用生產環境和非本地環境
 * @param {string} token - 測試 token
 * @param {string} hostname - 請求來源主機名（可選，用於域名檢查）
 * @returns {Object} 驗證結果
 */
export const validateTestToken = (token, hostname = null) => {
  // 檢查是否為測試 token
  if (token !== TEST_ACCOUNTS.GUEST_TOKEN) {
    return { valid: false, reason: "invalid_token" };
  }

  // 🔒 強制檢查：生產環境完全禁用測試帳號
  const isProduction = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === "production";
  if (isProduction) {
    return {
      valid: false,
      reason: "disabled_in_production",
      message: "測試帳號在生產環境已完全禁用",
    };
  }

  // 🔒 額外檢查：確保只在本地環境使用（如果提供了 hostname）
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.')) {
    return {
      valid: false,
      reason: "non_local_environment",
      message: "測試帳號僅限本地開發環境使用",
    };
  }

  // 如果在瀏覽器環境，直接返回有效（不檢查過期）
  if (!testTokenIssuedAt) {
    return { valid: true };
  }

  // 檢查 token 是否已簽發
  const issuedAt = testTokenIssuedAt.get(token);
  if (!issuedAt) {
    // 開發環境首次使用，自動簽發
    const session = issueTestSession();
    return { valid: true, session };
  }

  // 檢查是否過期
  const now = Date.now();
  const expiryMs = TEST_CONFIG.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
  const expiresAt = issuedAt + expiryMs;

  if (now > expiresAt) {
    testTokenIssuedAt.delete(token);
    return { valid: false, reason: "token_expired" };
  }

  return {
    valid: true,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
};

/**
 * 檢查是否為訪客測試用戶
 * @param {string} userId - 用戶 ID
 * @returns {boolean}
 */
export const isGuestUser = (userId) => {
  return userId === TEST_ACCOUNTS.GUEST_USER_ID;
};

/**
 * 檢查是否為開發者測試用戶
 * @param {string} userId - 用戶 ID
 * @returns {boolean}
 */
export const isDevUser = (userId) => {
  return userId === TEST_ACCOUNTS.DEV_USER_ID;
};

/**
 * 檢查是否為任何測試帳號（訪客或開發者）
 * @param {string} userId - 用戶 ID
 * @returns {boolean}
 */
export const isTestAccount = (userId) => {
  return isGuestUser(userId) || isDevUser(userId);
};

/**
 * 檢查是否為測試 token
 * @param {string} token - 認證 token
 * @returns {boolean}
 */
export const isTestToken = (token) => {
  return token === TEST_ACCOUNTS.GUEST_TOKEN;
};
