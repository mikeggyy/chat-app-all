/**
 * 開發模式輔助函數 - 安全驗證
 *
 * 用於驗證開發模式繞過是否安全（防止在生產環境誤啟用）
 */

import logger from "./logger.js";
import { isDevUser } from "../../shared/config/testAccounts.js";

/**
 * 檢查是否可以使用開發模式繞過
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 選項
 * @param {string} options.featureName - 功能名稱（用於日誌）
 * @param {boolean} options.requireTestAccount - 是否要求測試帳號（默認從環境變數讀取）
 * @throws {Error} 如果不符合安全條件
 */
export const validateDevModeBypass = (userId, options = {}) => {
  const { featureName = "未知功能" } = options;

  // ✅ 1. 檢查環境變數
  const isDevBypassEnabled = process.env.ENABLE_DEV_PURCHASE_BYPASS === "true";

  if (!isDevBypassEnabled) {
    throw new Error("開發模式繞過未啟用");
  }

  // ✅ 2. 檢查是否為生產環境
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    logger.error(
      `[安全警告] 生產環境不允許使用開發模式繞過: feature=${featureName}, userId=${userId}`
    );
    throw new Error("生產環境不允許使用開發模式繞過");
  }

  // ✅ 3. 檢查是否為測試帳號（可選，從環境變數讀取）
  // 生產環境自動要求測試帳號，開發環境可配置
  const requireTestAccountFromEnv = process.env.REQUIRE_TEST_ACCOUNT_FOR_DEV_BYPASS !== "false";
  const requireTestAccount = options.requireTestAccount !== undefined
    ? options.requireTestAccount
    : requireTestAccountFromEnv;

  if (requireTestAccount) {
    const isTestUser = isDevUser(userId);

    if (!isTestUser) {
      logger.warn(
        `[安全警告] 非測試帳號嘗試使用開發模式繞過: feature=${featureName}, userId=${userId}`
      );
      throw new Error("只有測試帳號可以使用開發模式繞過");
    }
  } else {
    // 記錄允許任何帳號使用開發模式
    logger.info(
      `[開發模式] 允許任何帳號繞過支付: feature=${featureName}, userId=${userId}`
    );
  }

  // ✅ 4. 檢查 IP 地址（可選，如果配置了白名單）
  const allowedIPs = process.env.DEV_BYPASS_ALLOWED_IPS
    ? process.env.DEV_BYPASS_ALLOWED_IPS.split(",")
    : ["127.0.0.1", "::1", "localhost"];

  // 注意：在路由中使用時需要傳入 req.ip
  // 這裡只返回允許的 IP 列表，由調用方檢查

  // ✅ 5. 記錄安全日誌
  logger.warn(
    `[開發模式繞過] feature=${featureName}, userId=${userId}, env=${process.env.NODE_ENV}`
  );

  return {
    allowed: true,
    allowedIPs,
  };
};

/**
 * 中間件：驗證開發模式繞過
 *
 * 用法：
 * router.post('/purchase', requireFirebaseAuth, validateDevModeMiddleware('金幣購買'), async (req, res) => {
 *   // 業務邏輯
 * });
 */
export const validateDevModeMiddleware = (featureName) => {
  return (req, res, next) => {
    try {
      const userId = req.firebaseUser?.uid;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "未認證",
        });
      }

      // 驗證開發模式繞過
      const validation = validateDevModeBypass(userId, {
        featureName,
        requireTestAccount: true,
      });

      // 檢查 IP（如果配置了白名單）
      if (validation.allowedIPs && validation.allowedIPs.length > 0) {
        const clientIP =
          req.ip ||
          req.connection.remoteAddress ||
          req.headers["x-forwarded-for"];

        const normalizedIP = clientIP?.replace("::ffff:", ""); // 處理 IPv6 映射的 IPv4

        if (!validation.allowedIPs.includes(normalizedIP)) {
          logger.warn(
            `[安全警告] 未授權 IP 嘗試使用開發模式繞過: feature=${featureName}, userId=${userId}, IP=${normalizedIP}`
          );
          return res.status(403).json({
            success: false,
            error: "IP 未授權",
          });
        }
      }

      // 驗證通過，繼續
      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
  };
};

/**
 * 檢查是否應該啟用開發模式功能
 * （用於非繞過場景，例如顯示測試按鈕）
 *
 * @returns {boolean} 是否為開發模式
 */
export const isDevMode = () => {
  const nodeEnv = process.env.NODE_ENV || "development";
  return nodeEnv !== "production";
};

export default {
  validateDevModeBypass,
  validateDevModeMiddleware,
  isDevMode,
};
