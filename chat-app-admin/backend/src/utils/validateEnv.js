/**
 * 環境變數驗證工具（管理後臺專用）
 * 確保所有必要的環境變數在應用啟動時都已正確設置
 */

/**
 * 定義必要的環境變數
 * 管理後臺的環境變數相對簡單，主要用於管理和監控
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
      "FIRESTORE_EMULATOR_HOST",
    ],
  },

  // Cloudflare R2 Storage（與主應用共享）
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
    optional: ["PORT", "NODE_ENV", "CORS_ORIGIN", "MAIN_APP_API_URL"],
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
    ...ENV_CONFIG.storage.required,
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

  console.log("🔍 [管理後臺] 驗證環境變數配置...");
  console.log(`環境: ${isProduction ? "生產環境" : "開發環境"}`);
  console.log(`Firebase Emulator: ${useEmulator ? "啟用" : "停用"}`);

  // 1. 檢查必要的環境變數
  const requiredVars = getRequiredVars();
  const { missing, invalid } = checkRequiredVars(requiredVars);

  if (missing.length > 0) {
    errors.push(`缺少必要的環境變數: ${missing.join(", ")}`);
    console.error(`❌ 缺少必要的環境變數: ${missing.join(", ")}`);
  }

  if (invalid.length > 0) {
    errors.push(`以下環境變數為空: ${invalid.join(", ")}`);
    console.error(`❌ 以下環境變數為空: ${invalid.join(", ")}`);
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

  // 3. 檢查生產環境特定配置
  if (isProduction) {
    if (!isEnvVarSet("CORS_ORIGIN")) {
      errors.push("生產環境必須設置 CORS_ORIGIN");
    }

    if (process.env.CORS_ORIGIN === "*") {
      errors.push("生產環境不允許 CORS_ORIGIN=*");
    }
  }

  // 4. 檢查 Emulator 配置
  if (useEmulator) {
    const emulatorVars = ["FIREBASE_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST"];

    for (const varName of emulatorVars) {
      if (!isEnvVarSet(varName)) {
        warnings.push(`使用 Emulator 但未設置 ${varName}，將使用預設值`);
      }
    }
  }

  // 5. 檢查端口配置
  if (isEnvVarSet("PORT")) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`無效的 PORT 值: ${process.env.PORT}`);
    }

    // 檢查是否與主應用端口衝突
    if (port === 4000) {
      warnings.push("⚠️ PORT 4000 與主應用衝突，建議使用 4001");
    }
  }

  // 6. 檢查 Cloudflare R2 Storage 配置
  const r2Vars = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
  const r2Missing = r2Vars.filter((varName) => !isEnvVarSet(varName));

  if (r2Missing.length > 0) {
    errors.push(`Cloudflare R2 Storage 配置不完整，缺少: ${r2Missing.join(", ")}`);
    console.error(`❌ 圖片儲存將無法使用`);
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

  // 7. 檢查主應用 API URL
  if (!isEnvVarSet("MAIN_APP_API_URL")) {
    warnings.push("⚠️ MAIN_APP_API_URL 未設置，某些功能可能無法正常運作");
  }

  // 8. 輸出警告
  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      console.warn(`⚠️  ${warning}`);
    });
  }

  // 9. 判斷驗證結果
  const valid = errors.length === 0;

  if (valid) {
    console.log("✅ 環境變數驗證通過");
  } else {
    console.error("❌ 環境變數驗證失敗");
    errors.forEach((error) => {
      console.error(`   - ${error}`);
    });

    if (strict && exitOnError) {
      console.error("應用程式無法啟動，請修正環境變數配置");
      console.error("請參考 .env.example 文件");
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

  console.log("📋 [管理後臺] 環境變數配置摘要:");
  console.log("─".repeat(60));

  // 伺服器配置
  console.log("🖥️  伺服器配置:");
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`   PORT: ${process.env.PORT || "4001"}`);
  console.log(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || "未設置（開發模式預設）"}`);

  // Firebase 配置
  console.log("\n🔥 Firebase 配置:");
  console.log(`   USE_FIREBASE_EMULATOR: ${process.env.USE_FIREBASE_EMULATOR || "false"}`);
  console.log(`   FIREBASE_ADMIN_PROJECT_ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID || "未設置"}`);

  // Cloudflare R2 Storage 配置
  console.log("\n💾 Cloudflare R2 Storage:");
  console.log(`   BUCKET_NAME: ${process.env.R2_BUCKET_NAME || "未設置"}`);
  console.log(`   PUBLIC_URL: ${process.env.R2_PUBLIC_URL || "未設置"}`);
  console.log(`   ENDPOINT: ${maskSecret(process.env.R2_ENDPOINT)}`);
  console.log(`   ACCESS_KEY_ID: ${maskSecret(process.env.R2_ACCESS_KEY_ID)}`);

  // 主應用 API
  console.log("\n🔗 主應用整合:");
  console.log(`   MAIN_APP_API_URL: ${process.env.MAIN_APP_API_URL || "未設置"}`);

  console.log("─".repeat(60));
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
