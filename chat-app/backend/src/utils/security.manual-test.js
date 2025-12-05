/**
 * 安全性功能測試
 * 測試 AppError、XSS 清理等安全功能
 *
 * 運行方式：node src/utils/security.test.js
 */

import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  InsufficientBalanceError,
  toAppError,
} from "./AppError.js";
import { sanitize, sanitizeStrict, sanitizeHTML } from "../middleware/xssSanitizer.js";
import logger from "./logger.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testSecurity() {
  logger.info("=".repeat(60));
  logger.info("開始安全性功能測試");
  logger.info("=".repeat(60));

  let passedTests = 0;
  let failedTests = 0;

  // ============================================
  // AppError 測試
  // ============================================

  // 測試 1: 基本 AppError
  logger.info("\n[測試 1] 基本 AppError 創建");
  try {
    const error = new AppError("測試錯誤", 400, "TEST_ERROR", { test: true });
    if (
      error.message === "測試錯誤" &&
      error.statusCode === 400 &&
      error.errorCode === "TEST_ERROR" &&
      error.isOperational === true
    ) {
      logger.info("✅ 通過：基本 AppError 功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：基本 AppError 功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：基本 AppError 測試拋出異常", error);
    failedTests++;
  }

  // 測試 2: ValidationError
  logger.info("\n[測試 2] ValidationError");
  try {
    const error = new ValidationError("參數驗證失敗", { field: "email" });
    if (
      error.statusCode === 400 &&
      error.message === "參數驗證失敗" &&
      error.metadata.field === "email"
    ) {
      logger.info("✅ 通過：ValidationError 功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：ValidationError 功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：ValidationError 測試拋出異常", error);
    failedTests++;
  }

  // 測試 3: AuthenticationError
  logger.info("\n[測試 3] AuthenticationError");
  try {
    const error = new AuthenticationError();
    if (error.statusCode === 401) {
      logger.info("✅ 通過：AuthenticationError 功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：AuthenticationError 功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：AuthenticationError 測試拋出異常", error);
    failedTests++;
  }

  // 測試 4: NotFoundError
  logger.info("\n[測試 4] NotFoundError");
  try {
    const error = new NotFoundError("用戶");
    if (error.statusCode === 404 && error.message.includes("用戶")) {
      logger.info("✅ 通過：NotFoundError 功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：NotFoundError 功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：NotFoundError 測試拋出異常", error);
    failedTests++;
  }

  // 測試 5: InsufficientBalanceError
  logger.info("\n[測試 5] InsufficientBalanceError");
  try {
    const error = new InsufficientBalanceError(100, 50);
    if (
      error.statusCode === 422 &&
      error.message.includes("100") &&
      error.message.includes("50")
    ) {
      logger.info("✅ 通過：InsufficientBalanceError 功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：InsufficientBalanceError 功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：InsufficientBalanceError 測試拋出異常", error);
    failedTests++;
  }

  // 測試 6: toAppError 轉換
  logger.info("\n[測試 6] toAppError 轉換");
  try {
    const originalError = new Error("找不到用戶");
    const appError = toAppError(originalError);
    if (appError instanceof NotFoundError) {
      logger.info("✅ 通過：toAppError 轉換功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：toAppError 轉換功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：toAppError 測試拋出異常", error);
    failedTests++;
  }

  // 測試 7: toJSON 序列化
  logger.info("\n[測試 7] toJSON 序列化");
  try {
    const error = new ValidationError("測試", { field: "test" });
    const json = error.toJSON();
    if (
      json.success === false &&
      json.error.message === "測試" &&
      json.error.code
    ) {
      logger.info("✅ 通過：toJSON 序列化功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：toJSON 序列化功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：toJSON 測試拋出異常", error);
    failedTests++;
  }

  // ============================================
  // XSS 清理測試
  // ============================================

  // 測試 8: 基本 XSS 清理
  logger.info("\n[測試 8] 基本 XSS 清理");
  try {
    const malicious = '<script>alert("XSS")</script>Hello';
    const sanitized = sanitizeStrict(malicious);
    if (!sanitized.includes('<script>') && sanitized.includes('Hello')) {
      logger.info("✅ 通過：基本 XSS 清理功能正常");
      logger.info(`   原始: ${malicious}`);
      logger.info(`   清理後: ${sanitized}`);
      passedTests++;
    } else {
      logger.error("❌ 失敗：基本 XSS 清理功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：基本 XSS 清理測試拋出異常", error);
    failedTests++;
  }

  // 測試 9: 清理嵌套對象
  logger.info("\n[測試 9] 清理嵌套對象");
  try {
    const maliciousObj = {
      name: '<script>alert(1)</script>Test',
      nested: {
        value: '<img src=x onerror=alert(1)>',
      },
      array: ['<b>bold</b>', 'normal'],
    };
    const sanitized = sanitize(maliciousObj);
    if (
      !JSON.stringify(sanitized).includes('<script>') &&
      !JSON.stringify(sanitized).includes('onerror')
    ) {
      logger.info("✅ 通過：嵌套對象清理功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：嵌套對象清理功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：嵌套對象清理測試拋出異常", error);
    failedTests++;
  }

  // 測試 10: 保留 data URI
  logger.info("\n[測試 10] 保留 data URI");
  try {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sanitized = sanitize(dataUri);
    if (sanitized === dataUri) {
      logger.info("✅ 通過：data URI 保留功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：data URI 保留功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：data URI 測試拋出異常", error);
    failedTests++;
  }

  // 測試 11: 清理陣列
  logger.info("\n[測試 11] 清理陣列");
  try {
    const maliciousArray = [
      '<script>alert(1)</script>',
      'normal text',
      '<img src=x onerror=alert(1)>',
    ];
    const sanitized = sanitize(maliciousArray);
    if (
      Array.isArray(sanitized) &&
      !JSON.stringify(sanitized).includes('<script>') &&
      sanitized.includes('normal text')
    ) {
      logger.info("✅ 通過：陣列清理功能正常");
      passedTests++;
    } else {
      logger.error("❌ 失敗：陣列清理功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：陣列清理測試拋出異常", error);
    failedTests++;
  }

  // 測試 12: sanitizeHTML（允許安全標籤）
  logger.info("\n[測試 12] sanitizeHTML（允許安全標籤）");
  try {
    const html = '<p>Hello <strong>World</strong></p><script>alert(1)</script>';
    const sanitized = sanitizeHTML(html);
    if (
      sanitized.includes('<p>') &&
      sanitized.includes('<strong>') &&
      !sanitized.includes('<script>')
    ) {
      logger.info("✅ 通過：sanitizeHTML 功能正常");
      logger.info(`   原始: ${html}`);
      logger.info(`   清理後: ${sanitized}`);
      passedTests++;
    } else {
      logger.error("❌ 失敗：sanitizeHTML 功能異常");
      failedTests++;
    }
  } catch (error) {
    logger.error("❌ 失敗：sanitizeHTML 測試拋出異常", error);
    failedTests++;
  }

  // 測試結果總結
  logger.info("\n" + "=".repeat(60));
  logger.info("測試結果總結");
  logger.info("=".repeat(60));
  logger.info(`✅ 通過: ${passedTests} 個測試`);
  if (failedTests > 0) {
    logger.error(`❌ 失敗: ${failedTests} 個測試`);
  }
  logger.info(`總計: ${passedTests + failedTests} 個測試`);
  logger.info("=".repeat(60));

  process.exit(failedTests > 0 ? 1 : 0);
}

// 運行測試
testSecurity().catch(error => {
  logger.error("測試執行失敗:", error);
  process.exit(1);
});
