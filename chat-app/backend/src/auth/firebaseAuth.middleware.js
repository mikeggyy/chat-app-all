import { getFirebaseAdminAuth } from "../firebase/index.js";
import { TEST_ACCOUNTS, validateTestToken } from "../../../../shared/config/testAccounts.js";

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
    // 🔒 安全增強：在生產環境完全禁用測試帳號
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      logger.error('[Auth] 🚨 生產環境禁止使用測試帳號');
      res.status(401).json({
        message: "測試帳號在生產環境已停用",
        code: "auth/test-disabled-in-production",
      });
      return;
    }

    const validation = validateTestToken(rawToken);

    if (!validation.valid) {
      const errorMessages = {
        invalid_token: "無效的測試 token",
        disabled_in_production: "測試帳號在生產環境已停用",
        token_expired: "測試 token 已過期，請重新登入",
      };

      res.status(401).json({
        message: errorMessages[validation.reason] || "測試 token 驗證失敗",
        code: `auth/test-${validation.reason}`,
      });
      return;
    }

    logger.info('[Auth] ✅ 測試帳號驗證成功（開發環境）');
    req.firebaseUser = {
      uid: TEST_ACCOUNTS.GUEST_USER_ID,
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
    const decoded = await auth.verifyIdToken(rawToken, verifyOptions);
    req.firebaseUser = decoded;
    next();
  } catch (error) {
    const code =
      typeof error?.code === "string" ? error.code : "auth/token-verification";
    logger.error("Firebase ID token verification failed:", error);
    res.status(401).json({
      message: "Firebase 登入憑證驗證失敗",
      code,
    });
  }
};
