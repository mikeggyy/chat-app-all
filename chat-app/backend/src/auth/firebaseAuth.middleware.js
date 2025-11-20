import { getFirebaseAdminAuth } from "../firebase/index.js";
import { TEST_ACCOUNTS, validateTestToken } from "../../shared/config/testAccounts.js";

import logger from "../utils/logger.js";
// Guest token support v2
const getBearerToken = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

export const requireFirebaseAuth = async (req, res, next) => {
  const rawToken = getBearerToken(req.headers.authorization);

  if (!rawToken) {
    logger.warn('[Auth] 缺少 Authorization Bearer 權杖');
    res.status(401).json({ message: "缺少 Authorization Bearer 權杖" });
    return;
  }

  logger.info('[Auth] 收到 token:', rawToken.substring(0, 20) + '...');

  // 處理測試 token（遊客登入）
  if (rawToken === TEST_ACCOUNTS.GUEST_TOKEN) {
    // 🔒 安全增強（2025-01）：多層安全檢查
    // 1. 生產環境完全禁用
    // 2. 非本地域名禁用
    // 3. Token 過期檢查

    const hostname = req.hostname || req.get('host')?.split(':')[0];
    const validation = validateTestToken(rawToken, hostname);

    if (!validation.valid) {
      const errorMessages = {
        invalid_token: "無效的測試 token",
        disabled_in_production: "測試帳號在生產環境已完全禁用",
        non_local_environment: "測試帳號僅限本地開發環境使用",
        token_expired: "測試 token 已過期，請重新登入",
      };

      logger.error(`[Auth] 🚨 測試帳號驗證失敗: ${validation.reason}`, {
        hostname,
        reason: validation.reason,
        message: validation.message,
      });

      res.status(401).json({
        message: errorMessages[validation.reason] || validation.message || "測試 token 驗證失敗",
        code: `auth/test-${validation.reason}`,
      });
      return;
    }

    // 允許通過 header 覆蓋測試用戶 ID（僅開發環境）
    const testUserId = req.headers['x-test-user-id'] || TEST_ACCOUNTS.GUEST_USER_ID;

    logger.info('[Auth] ✅ 測試帳號驗證成功（開發環境）', {
      hostname,
      userId: testUserId,
      overridden: testUserId !== TEST_ACCOUNTS.GUEST_USER_ID,
    });

    req.firebaseUser = {
      uid: testUserId,
      email: "test@example.com",
      name: "測試帳號",
      // 添加標記表示這是測試用戶
      isTestUser: true,
      // 添加 token 資訊
      tokenInfo: validation,
    };
    next();
    return;
  }

  // 處理 Firebase token（正式用戶）
  try {
    const auth = getFirebaseAdminAuth();
    // 在 emulator 模式下，使用 checkRevoked: false 來避免網絡請求
    const verifyOptions = process.env.USE_FIREBASE_EMULATOR === "true"
      ? { checkRevoked: false }
      : {};

    logger.info('[Auth] 開始驗證 Firebase token...', {
      tokenPrefix: rawToken.substring(0, 30) + '...',
      isEmulator: process.env.USE_FIREBASE_EMULATOR === "true",
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
    });

    const decoded = await auth.verifyIdToken(rawToken, verifyOptions);

    logger.info('[Auth] ✅ Firebase token 驗證成功', {
      uid: decoded.uid,
      email: decoded.email,
      iat: decoded.iat,
      exp: decoded.exp,
      aud: decoded.aud
    });

    req.firebaseUser = decoded;
    next();
  } catch (error) {
    const code =
      typeof error?.code === "string" ? error.code : "auth/token-verification";

    logger.error('[Auth] ❌ Firebase token 驗證失敗', {
      code,
      message: error.message,
      stack: error.stack,
      tokenPrefix: rawToken.substring(0, 30) + '...',
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
    });

    res.status(401).json({
      message: "Firebase 登入憑證驗證失敗",
      code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
