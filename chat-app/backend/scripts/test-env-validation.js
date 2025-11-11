#!/usr/bin/env node
/**
 * 環境變數驗證測試腳本
 *
 * 用途：在不啟動整個應用的情況下測試環境變數配置
 *
 * 使用方法：
 *   node scripts/test-env-validation.js
 *   npm run test:env
 */

import "dotenv/config";
import { validateEnvironment, printEnvSummary } from "../src/utils/validateEnv.js";

console.log("╔═══════════════════════════════════════════════════════════════╗");
console.log("║         環境變數驗證測試 - Chat App Backend                  ║");
console.log("╚═══════════════════════════════════════════════════════════════╝");
console.log();

// 執行驗證（不退出進程）
const result = validateEnvironment({
  strict: true,
  exitOnError: false,
});

console.log();
console.log("═".repeat(63));

if (result.valid) {
  console.log("✅ 驗證結果: 通過");
  console.log();
  printEnvSummary();
  console.log();
  console.log("🎉 環境變數配置完整，應用可以正常啟動！");
  process.exit(0);
} else {
  console.log("❌ 驗證結果: 失敗");
  console.log();
  console.log("發現以下問題：");
  console.log();

  result.errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error}`);
  });

  if (result.warnings.length > 0) {
    console.log();
    console.log("警告：");
    result.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
  }

  console.log();
  console.log("💡 提示：");
  console.log("  1. 請檢查 .env 文件是否存在");
  console.log("  2. 參考 .env.example 文件補充缺失的環境變數");
  console.log("  3. 確認環境變數格式正確（特別是 URL 和 API Key）");
  console.log();

  process.exit(1);
}
