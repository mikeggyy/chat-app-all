/**
 * 測試重試邏輯
 * 模擬 429 錯誤和成功場景
 */

import "dotenv/config";
import { retryVeoApiCall, retryWithExponentialBackoff } from "../src/utils/retryWithBackoff.js";

console.log("🧪 測試重試邏輯");
console.log("=".repeat(80));
console.log();

// ============================================================
// 測試 1: 模擬兩次失敗後成功
// ============================================================
console.log("📋 測試 1: 模擬兩次失敗後成功");
console.log("-".repeat(80));

let attemptCount1 = 0;

async function mockApiCall1() {
  attemptCount1++;
  console.log(`\n📞 API 調用 #${attemptCount1}`);

  if (attemptCount1 < 3) {
    // 前兩次失敗（模擬 429）
    const error = new Error(
      "[VertexAI.ClientError]: got status: 429 Too Many Requests. Quota exceeded"
    );
    console.log("❌ 失敗：429 配額超限");
    throw error;
  }

  // 第三次成功
  console.log("✅ 成功！");
  return { success: true, videoUrl: "https://mock-video.mp4" };
}

try {
  console.log("開始測試...\n");
  const result1 = await retryVeoApiCall(mockApiCall1);
  console.log("\n🎉 測試 1 成功！");
  console.log("結果:", result1);
} catch (error) {
  console.log("\n💥 測試 1 失敗:", error.message);
}

console.log("\n" + "=".repeat(80));
console.log();

// ============================================================
// 測試 2: 所有重試都失敗
// ============================================================
console.log("📋 測試 2: 所有重試都失敗（4 次都返回 429）");
console.log("-".repeat(80));

let attemptCount2 = 0;

async function mockApiCall2() {
  attemptCount2++;
  console.log(`\n📞 API 調用 #${attemptCount2}`);

  // 每次都失敗
  const error = new Error(
    "[VertexAI.ClientError]: got status: 429 Too Many Requests. Quota exceeded"
  );
  console.log("❌ 失敗：429 配額超限");
  throw error;
}

try {
  console.log("開始測試...\n");
  const result2 = await retryVeoApiCall(mockApiCall2);
  console.log("\n✅ 測試 2 成功（不應該到這裡）:", result2);
} catch (error) {
  console.log("\n💥 測試 2 預期失敗（所有重試都失敗）");
  console.log("錯誤:", error.message);
  console.log(`總共嘗試了 ${attemptCount2} 次`);
}

console.log("\n" + "=".repeat(80));
console.log();

// ============================================================
// 測試 3: 第一次就成功
// ============================================================
console.log("📋 測試 3: 第一次就成功");
console.log("-".repeat(80));

let attemptCount3 = 0;

async function mockApiCall3() {
  attemptCount3++;
  console.log(`\n📞 API 調用 #${attemptCount3}`);
  console.log("✅ 成功！");
  return { success: true, videoUrl: "https://mock-video.mp4" };
}

try {
  console.log("開始測試...\n");
  const result3 = await retryVeoApiCall(mockApiCall3);
  console.log("\n🎉 測試 3 成功！");
  console.log("結果:", result3);
  console.log(`只嘗試了 ${attemptCount3} 次（預期 1 次）`);
} catch (error) {
  console.log("\n💥 測試 3 失敗:", error.message);
}

console.log("\n" + "=".repeat(80));
console.log();

// ============================================================
// 測試 4: 自定義重試配置
// ============================================================
console.log("📋 測試 4: 自定義重試配置（只重試 1 次）");
console.log("-".repeat(80));

let attemptCount4 = 0;

async function mockApiCall4() {
  attemptCount4++;
  console.log(`\n📞 API 調用 #${attemptCount4}`);

  if (attemptCount4 === 1) {
    console.log("❌ 失敗：429 配額超限");
    const error = new Error("429 Too Many Requests");
    throw error;
  }

  console.log("✅ 成功！");
  return { success: true };
}

try {
  console.log("開始測試（最多重試 1 次）...\n");
  const result4 = await retryWithExponentialBackoff(mockApiCall4, {
    maxRetries: 2, // 總共 2 次嘗試（1 次原始 + 1 次重試）
    baseDelay: 500, // 快速測試，只等 500ms
    shouldRetry: (error) => error.message.includes("429"),
  });
  console.log("\n🎉 測試 4 成功！");
  console.log("結果:", result4);
  console.log(`總共嘗試了 ${attemptCount4} 次（預期 2 次）`);
} catch (error) {
  console.log("\n💥 測試 4 失敗:", error.message);
}

console.log("\n" + "=".repeat(80));
console.log();

// ============================================================
// 測試總結
// ============================================================
console.log("📊 測試總結");
console.log("=".repeat(80));
console.log();
console.log("✅ 測試 1: 兩次失敗後成功 - " + (attemptCount1 === 3 ? "通過" : "失敗"));
console.log("✅ 測試 2: 所有重試都失敗 - " + (attemptCount2 === 3 ? "通過" : "失敗"));
console.log("✅ 測試 3: 第一次就成功 - " + (attemptCount3 === 1 ? "通過" : "失敗"));
console.log("✅ 測試 4: 自定義重試配置 - " + (attemptCount4 === 2 ? "通過" : "失敗"));
console.log();
console.log("🎉 所有測試完成！");
