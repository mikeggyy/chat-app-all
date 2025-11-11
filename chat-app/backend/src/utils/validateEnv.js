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
      "FIREBASE_STORAGE_BUCKET",
      "USE_FIREBASE_EMULATOR",
      "FIREBASE_EMULATOR_HOST",
      "FIREBASE_EMULATOR_AUTH_PORT",
      "FIREBASE_EMULATOR_FIRESTORE_PORT",
      "FIREBASE_STORAGE_EMULATOR_PORT",
    ],
  },

  // AI 服務 - 基礎 API Keys
  ai: {
    required: ["OPENAI_API_KEY", "GOOGLE_AI_API_KEY"],
    optional: ["REPLICATE_API_TOKEN", "USE_GOOGLE_TTS"],
  },

  // Google Cloud Vertex AI（影片生成 + TTS）
  googleCloud: {
    required: [],
    optional: [
      "GOOGLE_CLOUD_PROJECT_ID",
      "GOOGLE_CLOUD_LOCATION",
      "GOOGLE_APPLICATION_CREDENTIALS",
    ],
  },

  // 影片生成服務
  video: {
    required: ["VIDEO_GENERATION_PROVIDER"],
    optional: [
      "USE_MOCK_VIDEO",
      "VEO_ENABLE_RETRY",
      "VEO_MAX_RETRIES",
    ],
  },

  // Cloudflare R2 Storage（圖片和影片儲存）
  storage: {
    required: [
      "R2_ENDPOINT",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "R2_PUBLIC_URL",
    ],
    optional: [],
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

  // 開發環境配置
  development: {
    required: [],
    optional: ["ENABLE_DEV_PURCHASE_BYPASS"],
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
  const videoProvider = process.env.VIDEO_GENERATION_PROVIDER;
  const useGoogleTTS = process.env.USE_GOOGLE_TTS === "true";

  const required = [
    ...ENV_CONFIG.firebase.required,
    ...ENV_CONFIG.ai.required,
    ...ENV_CONFIG.storage.required,
    ...ENV_CONFIG.video.required,
  ];

  // 生產環境需要 Firebase 憑證
  if (isProduction && !useEmulator) {
    required.push(
      "FIREBASE_ADMIN_CLIENT_EMAIL",
      "FIREBASE_ADMIN_PRIVATE_KEY"
    );
  }

  // 如果使用 Veo 影片生成或 Google Cloud TTS，需要 Google Cloud 憑證
  const needsGoogleCloud = videoProvider === "veo" || useGoogleTTS;
  if (needsGoogleCloud) {
    required.push(
      "GOOGLE_CLOUD_PROJECT_ID",
      "GOOGLE_CLOUD_LOCATION"
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

  // 7. 檢查 Cloudflare R2 Storage 配置
  const r2Vars = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
  const r2Missing = r2Vars.filter((varName) => !isEnvVarSet(varName));

  if (r2Missing.length > 0) {
    errors.push(`Cloudflare R2 Storage 配置不完整，缺少: ${r2Missing.join(", ")}`);
    logger.error(`❌ 圖片和影片儲存將無法使用`);
  } else {
    // 驗證 R2_ENDPOINT 格式
    const r2Endpoint = process.env.R2_ENDPOINT;
    if (r2Endpoint && !r2Endpoint.startsWith("https://")) {
      errors.push(`R2_ENDPOINT 必須以 https:// 開頭: ${r2Endpoint}`);
    }

    // 驗證 R2_PUBLIC_URL 格式
    const r2PublicUrl = process.env.R2_PUBLIC_URL;
    if (r2PublicUrl && !r2PublicUrl.startsWith("https://")) {
      errors.push(`R2_PUBLIC_URL 必須以 https:// 開頭: ${r2PublicUrl}`);
    }
  }

  // 8. 檢查影片生成提供者配置
  const videoProvider = process.env.VIDEO_GENERATION_PROVIDER;
  const validProviders = ["hailuo", "replicate", "veo"];

  if (!videoProvider) {
    errors.push("VIDEO_GENERATION_PROVIDER 未設置，影片生成功能將無法使用");
  } else if (!validProviders.includes(videoProvider)) {
    errors.push(`無效的 VIDEO_GENERATION_PROVIDER: ${videoProvider}，有效選項: ${validProviders.join(", ")}`);
  } else {
    logger.info(`✅ 影片生成提供者: ${videoProvider}`);

    // Veo 特定驗證
    if (videoProvider === "veo") {
      if (!isEnvVarSet("GOOGLE_CLOUD_PROJECT_ID") || !isEnvVarSet("GOOGLE_CLOUD_LOCATION")) {
        errors.push("使用 Veo 影片生成需要設置 GOOGLE_CLOUD_PROJECT_ID 和 GOOGLE_CLOUD_LOCATION");
      }

      const location = process.env.GOOGLE_CLOUD_LOCATION;
      if (location && location !== "us-central1") {
        warnings.push(`⚠️ Veo 影片生成僅支援 us-central1 地區，當前設置: ${location}`);
      }

      // 檢查是否使用 mock 模式
      if (process.env.USE_MOCK_VIDEO === "true") {
        warnings.push("⚠️ 影片生成使用 Mock 模式，不會呼叫實際 API");
      }
    }

    // Replicate 特定驗證
    if (videoProvider === "replicate" && !isEnvVarSet("REPLICATE_API_TOKEN")) {
      errors.push("使用 Replicate 影片生成需要設置 REPLICATE_API_TOKEN");
    }
  }

  // 9. 檢查 TTS 服務配置
  const useGoogleTTS = process.env.USE_GOOGLE_TTS === "true";
  if (useGoogleTTS) {
    logger.info("✅ TTS 服務: Google Cloud TTS");

    if (!isEnvVarSet("GOOGLE_CLOUD_PROJECT_ID") || !isEnvVarSet("GOOGLE_CLOUD_LOCATION")) {
      errors.push("使用 Google Cloud TTS 需要設置 GOOGLE_CLOUD_PROJECT_ID 和 GOOGLE_CLOUD_LOCATION");
    }
  } else {
    logger.info("✅ TTS 服務: OpenAI TTS");
  }

  // 10. 檢查 Google Cloud 憑證
  if (isEnvVarSet("GOOGLE_CLOUD_PROJECT_ID")) {
    logger.info(`✅ Google Cloud 專案 ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);

    if (isEnvVarSet("GOOGLE_APPLICATION_CREDENTIALS")) {
      logger.info(`✅ Google Cloud 憑證檔案: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    } else {
      warnings.push("⚠️ GOOGLE_APPLICATION_CREDENTIALS 未設置，將使用預設憑證");
    }
  }

  // 11. 檢查開發環境購買繞過
  if (process.env.ENABLE_DEV_PURCHASE_BYPASS === "true") {
    if (isProduction) {
      errors.push("🚨 嚴重警告：生產環境不應啟用 ENABLE_DEV_PURCHASE_BYPASS");
      logger.error("❌ 這將導致所有購買都繞過實際支付流程！");
    } else {
      warnings.push("⚠️ 開發環境購買繞過已啟用（ENABLE_DEV_PURCHASE_BYPASS=true）");
    }
  }

  // 12. 檢查 VEO 重試配置
  if (videoProvider === "veo" && process.env.VEO_ENABLE_RETRY === "true") {
    const maxRetries = parseInt(process.env.VEO_MAX_RETRIES, 10);
    if (isNaN(maxRetries) || maxRetries < 0 || maxRetries > 10) {
      warnings.push(`⚠️ VEO_MAX_RETRIES 值異常: ${process.env.VEO_MAX_RETRIES}，建議設置 2-3 次`);
    } else {
      logger.info(`✅ Veo 重試策略已啟用，最大重試次數: ${maxRetries}`);
    }
  }

  // 13. 輸出警告
  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      logger.warn(`⚠️  ${warning}`);
    });
  }

  // 14. 判斷驗證結果
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
  logger.info("─".repeat(60));

  // 伺服器配置
  logger.info("🖥️  伺服器配置:");
  logger.info(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  logger.info(`   PORT: ${process.env.PORT || "4000"}`);
  logger.info(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || "未設置（開發模式預設）"}`);

  // Firebase 配置
  logger.info("\n🔥 Firebase 配置:");
  logger.info(`   USE_FIREBASE_EMULATOR: ${process.env.USE_FIREBASE_EMULATOR || "false"}`);
  logger.info(`   FIREBASE_ADMIN_PROJECT_ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID || "未設置"}`);
  logger.info(`   FIREBASE_STORAGE_BUCKET: ${process.env.FIREBASE_STORAGE_BUCKET || "未設置"}`);

  // AI 服務配置
  logger.info("\n🤖 AI 服務配置:");
  logger.info(`   OPENAI_API_KEY: ${maskSecret(process.env.OPENAI_API_KEY)}`);
  logger.info(`   GOOGLE_AI_API_KEY: ${maskSecret(process.env.GOOGLE_AI_API_KEY)}`);
  logger.info(`   USE_GOOGLE_TTS: ${process.env.USE_GOOGLE_TTS || "false"}`);

  // Google Cloud 配置
  if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
    logger.info("\n☁️  Google Cloud 配置:");
    logger.info(`   PROJECT_ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
    logger.info(`   LOCATION: ${process.env.GOOGLE_CLOUD_LOCATION || "未設置"}`);
    logger.info(`   CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || "使用預設憑證"}`);
  }

  // 影片生成配置
  logger.info("\n🎬 影片生成配置:");
  logger.info(`   PROVIDER: ${process.env.VIDEO_GENERATION_PROVIDER || "未設置"}`);
  logger.info(`   USE_MOCK_VIDEO: ${process.env.USE_MOCK_VIDEO || "false"}`);
  if (process.env.VIDEO_GENERATION_PROVIDER === "veo") {
    logger.info(`   VEO_ENABLE_RETRY: ${process.env.VEO_ENABLE_RETRY || "false"}`);
    logger.info(`   VEO_MAX_RETRIES: ${process.env.VEO_MAX_RETRIES || "3"}`);
  }
  if (process.env.VIDEO_GENERATION_PROVIDER === "replicate") {
    logger.info(`   REPLICATE_API_TOKEN: ${maskSecret(process.env.REPLICATE_API_TOKEN)}`);
  }

  // Cloudflare R2 Storage 配置
  logger.info("\n💾 Cloudflare R2 Storage:");
  logger.info(`   BUCKET_NAME: ${process.env.R2_BUCKET_NAME || "未設置"}`);
  logger.info(`   PUBLIC_URL: ${process.env.R2_PUBLIC_URL || "未設置"}`);
  logger.info(`   ENDPOINT: ${maskSecret(process.env.R2_ENDPOINT)}`);
  logger.info(`   ACCESS_KEY_ID: ${maskSecret(process.env.R2_ACCESS_KEY_ID)}`);

  // 開發環境配置
  if (process.env.NODE_ENV !== "production") {
    logger.info("\n🔧 開發環境配置:");
    logger.info(`   ENABLE_DEV_PURCHASE_BYPASS: ${process.env.ENABLE_DEV_PURCHASE_BYPASS || "false"}`);
  }

  logger.info("─".repeat(60));
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
