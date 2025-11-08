/**
 * 環境變數驗證工具
 * 確保所有必要的環境變數在應用啟動時都已正確設置
 */

import logger from "./logger.js";

/**
 * 定義必要的環境變數
 * 根據環境（開發/生產）和使用的服務不同，某些變數可能是可選的
 */
const ENV_CONFIG = {
  // Firebase Admin SDK（生產環境必需）
  firebase: {
    required: ["FIREBASE_ADMIN_PROJECT_ID"],
    optional: [
      "FIREBASE_ADMIN_CLIENT_EMAIL",
      "FIREBASE_ADMIN_PRIVATE_KEY",
      "USE_FIREBASE_EMULATOR",
      "FIREBASE_EMULATOR_HOST",
      "FIREBASE_EMULATOR_AUTH_PORT",
      "FIREBASE_EMULATOR_FIRESTORE_PORT",
    ],
  },

  // AI 服務
  ai: {
    required: ["OPENAI_API_KEY", "GOOGLE_AI_API_KEY"],
    optional: ["REPLICATE_API_TOKEN"],
  },

  // 伺服器配置
  server: {
    required: [],
    optional: ["PORT", "NODE_ENV", "CORS_ORIGIN"],
  },

  // 測試帳號配置
  testing: {
    required: [],
    optional: [
      "ENABLE_TEST_ACCOUNTS_IN_PROD",
      "TEST_TOKEN_EXPIRY_HOURS",
    ],
  },
};

/**
 * 驗證環境變數是否存在且非空
 * @param {string} varName - 環境變數名稱
 * @returns {boolean}
 */
function isEnvVarSet(varName) {
  const value = process.env[varName];
  return value !== undefined && value !== null && value.trim() !== "";
}

/**
 * 檢查必要的環境變數
 * @param {string[]} requiredVars - 必要的環境變數列表
 * @returns {{missing: string[], invalid: string[]}}
 */
function checkRequiredVars(requiredVars) {
  const missing = [];
  const invalid = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    } else if (process.env[varName].trim() === "") {
      invalid.push(varName);
    }
  }

  return { missing, invalid };
}

/**
 * 獲取環境特定的必要變數
 * @returns {string[]}
 */
function getRequiredVars() {
  const isProduction = process.env.NODE_ENV === "production";
  const useEmulator = process.env.USE_FIREBASE_EMULATOR === "true";

  const required = [
    ...ENV_CONFIG.firebase.required,
    ...ENV_CONFIG.ai.required,
  ];

  // 生產環境需要 Firebase 憑證
  if (isProduction && !useEmulator) {
    required.push(
      "FIREBASE_ADMIN_CLIENT_EMAIL",
      "FIREBASE_ADMIN_PRIVATE_KEY"
    );
  }

  return required;
}

/**
 * 驗證所有環境變數
 * @param {Object} options - 驗證選項
 * @param {boolean} options.strict - 嚴格模式（缺少必要變數時拋出錯誤）
 * @param {boolean} options.exitOnError - 發現錯誤時退出進程
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
export function validateEnvironment(options = {}) {
  const { strict = true, exitOnError = true } = options;
  const errors = [];
  const warnings = [];

  const isProduction = process.env.NODE_ENV === "production";
  const isDevelopment = !isProduction;
  const useEmulator = process.env.USE_FIREBASE_EMULATOR === "true";

  logger.info("🔍 驗證環境變數配置...");
  logger.info(`環境: ${isProduction ? "生產環境" : "開發環境"}`);
  logger.info(`Firebase Emulator: ${useEmulator ? "啟用" : "停用"}`);

  // 1. 檢查必要的環境變數
  const requiredVars = getRequiredVars();
  const { missing, invalid } = checkRequiredVars(requiredVars);

  if (missing.length > 0) {
    errors.push(`缺少必要的環境變數: ${missing.join(", ")}`);
    logger.error(`❌ 缺少必要的環境變數: ${missing.join(", ")}`);
  }

  if (invalid.length > 0) {
    errors.push(`以下環境變數為空: ${invalid.join(", ")}`);
    logger.error(`❌ 以下環境變數為空: ${invalid.join(", ")}`);
  }

  // 2. 檢查 Firebase 配置
  if (!useEmulator) {
    if (!isEnvVarSet("FIREBASE_ADMIN_CLIENT_EMAIL")) {
      warnings.push("FIREBASE_ADMIN_CLIENT_EMAIL 未設置，可能影響 Firebase Admin SDK");
    }

    if (!isEnvVarSet("FIREBASE_ADMIN_PRIVATE_KEY")) {
      warnings.push("FIREBASE_ADMIN_PRIVATE_KEY 未設置，可能影響 Firebase Admin SDK");
    }
  }

  // 3. 檢查 AI 服務 API Keys
  if (!isEnvVarSet("OPENAI_API_KEY")) {
    errors.push("OPENAI_API_KEY 未設置，AI 對話功能將無法使用");
  }

  if (!isEnvVarSet("GOOGLE_AI_API_KEY")) {
    errors.push("GOOGLE_AI_API_KEY 未設置，圖片生成功能將無法使用");
  }

  // 4. 檢查生產環境特定配置
  if (isProduction) {
    if (!isEnvVarSet("CORS_ORIGIN")) {
      errors.push("生產環境必須設置 CORS_ORIGIN");
    }

    if (process.env.CORS_ORIGIN === "*") {
      errors.push("生產環境不允許 CORS_ORIGIN=*");
    }

    if (process.env.ENABLE_TEST_ACCOUNTS_IN_PROD === "true") {
      warnings.push("⚠️ 生產環境啟用了測試帳號，這可能是安全風險");
    }
  }

  // 5. 檢查 Emulator 配置
  if (useEmulator) {
    const emulatorVars = [
      "FIREBASE_EMULATOR_HOST",
      "FIREBASE_EMULATOR_AUTH_PORT",
      "FIREBASE_EMULATOR_FIRESTORE_PORT",
    ];

    for (const varName of emulatorVars) {
      if (!isEnvVarSet(varName)) {
        warnings.push(`使用 Emulator 但未設置 ${varName}，將使用預設值`);
      }
    }
  }

  // 6. 檢查端口配置
  if (isEnvVarSet("PORT")) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`無效的 PORT 值: ${process.env.PORT}`);
    }
  }

  // 7. 輸出警告
  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      logger.warn(`⚠️  ${warning}`);
    });
  }

  // 8. 判斷驗證結果
  const valid = errors.length === 0;

  if (valid) {
    logger.info("✅ 環境變數驗證通過");
  } else {
    logger.error("❌ 環境變數驗證失敗");
    errors.forEach((error) => {
      logger.error(`   - ${error}`);
    });

    if (strict && exitOnError) {
      logger.error("應用程式無法啟動，請修正環境變數配置");
      logger.error("請參考 .env.example 文件");
      process.exit(1);
    }
  }

  return { valid, errors, warnings };
}

/**
 * 打印環境變數配置摘要（隱藏敏感信息）
 */
export function printEnvSummary() {
  const maskSecret = (value) => {
    if (!value) return "未設置";
    if (value.length <= 8) return "***";
    return value.substring(0, 4) + "..." + value.substring(value.length - 4);
  };

  logger.info("📋 環境變數配置摘要:");
  logger.info(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  logger.info(`   PORT: ${process.env.PORT || "4000"}`);
  logger.info(`   USE_FIREBASE_EMULATOR: ${process.env.USE_FIREBASE_EMULATOR || "false"}`);
  logger.info(`   FIREBASE_ADMIN_PROJECT_ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID || "未設置"}`);
  logger.info(`   OPENAI_API_KEY: ${maskSecret(process.env.OPENAI_API_KEY)}`);
  logger.info(`   GOOGLE_AI_API_KEY: ${maskSecret(process.env.GOOGLE_AI_API_KEY)}`);
  logger.info(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || "未設置（開發模式預設）"}`);
}

/**
 * 快速驗證（應用啟動時調用）
 */
export function validateEnvOrExit() {
  const result = validateEnvironment({
    strict: true,
    exitOnError: true,
  });

  if (result.valid) {
    printEnvSummary();
  }

  return result;
}

export default {
  validateEnvironment,
  validateEnvOrExit,
  printEnvSummary,
};
