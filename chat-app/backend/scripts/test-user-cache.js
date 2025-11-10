/**
 * 用戶檔案緩存測試腳本
 *
 * 測試緩存的以下功能：
 * 1. 緩存命中和未命中
 * 2. 緩存設置和獲取
 * 3. 緩存失效
 * 4. 性能提升對比
 *
 * 使用方法：
 * node scripts/test-user-cache.js
 */

import {
  getUserProfileWithCache,
  getCachedUserProfile,
  setCachedUserProfile,
  deleteCachedUserProfile,
  clearAllUserProfileCache,
  getCacheStats,
  logCacheStats,
} from "../src/user/userProfileCache.service.js";
import { getUserById } from "../src/user/user.service.js";
import logger from "../src/utils/logger.js";

// 測試用戶 ID（請替換為實際存在的用戶 ID）
const TEST_USER_IDS = [
  "test-user-1",
  "test-user-2",
  "test-user-3",
];

/**
 * 測試 1：基本緩存功能
 */
async function testBasicCaching() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 1：基本緩存功能");
  console.log("=".repeat(60));

  const userId = TEST_USER_IDS[0];

  // 清空緩存
  clearAllUserProfileCache();
  console.log("\n✓ 已清空所有緩存");

  // 第一次獲取（應該從數據庫讀取）
  console.log(`\n[1] 第一次獲取用戶檔案: ${userId}`);
  const start1 = Date.now();
  const profile1 = await getUserProfileWithCache(userId);
  const time1 = Date.now() - start1;
  console.log(`   時間: ${time1}ms`);
  console.log(`   結果: ${profile1 ? "✓ 成功" : "✗ 失敗"}`);

  // 第二次獲取（應該從緩存讀取）
  console.log(`\n[2] 第二次獲取用戶檔案（應使用緩存）: ${userId}`);
  const start2 = Date.now();
  const profile2 = await getUserProfileWithCache(userId);
  const time2 = Date.now() - start2;
  console.log(`   時間: ${time2}ms`);
  console.log(`   結果: ${profile2 ? "✓ 成功" : "✗ 失敗"}`);
  console.log(`   性能提升: ${((1 - time2 / time1) * 100).toFixed(1)}%`);

  // 檢查緩存統計
  console.log("\n[3] 緩存統計:");
  const stats = getCacheStats();
  console.log(`   命中次數: ${stats.hits}`);
  console.log(`   未命中次數: ${stats.misses}`);
  console.log(`   命中率: ${stats.hitRate}`);
  console.log(`   緩存鍵數量: ${stats.keys}`);

  return { time1, time2, stats };
}

/**
 * 測試 2：緩存失效
 */
async function testCacheInvalidation() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 2：緩存失效");
  console.log("=".repeat(60));

  const userId = TEST_USER_IDS[0];

  // 先獲取並緩存
  console.log(`\n[1] 獲取用戶檔案並緩存: ${userId}`);
  await getUserProfileWithCache(userId);
  let cached = getCachedUserProfile(userId);
  console.log(`   緩存狀態: ${cached ? "✓ 已緩存" : "✗ 未緩存"}`);

  // 刪除緩存
  console.log(`\n[2] 刪除緩存: ${userId}`);
  const deleted = deleteCachedUserProfile(userId);
  console.log(`   刪除結果: ${deleted ? "✓ 成功" : "✗ 失敗"}`);

  // 檢查緩存是否已刪除
  cached = getCachedUserProfile(userId);
  console.log(`   緩存狀態: ${cached ? "✗ 仍存在" : "✓ 已刪除"}`);

  return { deleted };
}

/**
 * 測試 3：批量獲取性能
 */
async function testBatchPerformance() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 3：批量獲取性能對比");
  console.log("=".repeat(60));

  clearAllUserProfileCache();

  // 模擬 100 次用戶檔案查詢（無緩存）
  console.log("\n[1] 100 次查詢（無緩存）");
  const userId = TEST_USER_IDS[0];
  const start1 = Date.now();

  for (let i = 0; i < 100; i++) {
    await getUserById(userId);
  }

  const time1 = Date.now() - start1;
  console.log(`   總時間: ${time1}ms`);
  console.log(`   平均時間: ${(time1 / 100).toFixed(2)}ms`);

  // 模擬 100 次用戶檔案查詢（有緩存）
  console.log("\n[2] 100 次查詢（有緩存）");
  clearAllUserProfileCache();
  const start2 = Date.now();

  for (let i = 0; i < 100; i++) {
    await getUserProfileWithCache(userId);
  }

  const time2 = Date.now() - start2;
  console.log(`   總時間: ${time2}ms`);
  console.log(`   平均時間: ${(time2 / 100).toFixed(2)}ms`);

  // 計算性能提升
  const improvement = ((1 - time2 / time1) * 100).toFixed(1);
  console.log(`\n[3] 性能提升: ${improvement}%`);
  console.log(`   節省時間: ${time1 - time2}ms`);

  // 顯示緩存統計
  logCacheStats();

  return { time1, time2, improvement };
}

/**
 * 測試 4：緩存容量和過期
 */
async function testCacheExpiration() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 4：緩存容量和過期測試");
  console.log("=".repeat(60));

  clearAllUserProfileCache();

  // 創建測試用戶資料
  const testUsers = Array.from({ length: 10 }, (_, i) => ({
    id: `test-user-${i}`,
    displayName: `測試用戶 ${i}`,
    membershipTier: "free",
  }));

  // 設置多個用戶緩存
  console.log("\n[1] 設置 10 個用戶緩存");
  for (const user of testUsers) {
    setCachedUserProfile(user.id, user);
  }

  let stats = getCacheStats();
  console.log(`   緩存鍵數量: ${stats.keys}`);

  // 設置短 TTL 緩存（1 秒）
  console.log("\n[2] 設置短 TTL 緩存（1 秒）");
  setCachedUserProfile("test-expire", { id: "test-expire" }, 1);
  let cached = getCachedUserProfile("test-expire");
  console.log(`   設置後狀態: ${cached ? "✓ 已緩存" : "✗ 未緩存"}`);

  // 等待 2 秒
  console.log("\n[3] 等待 2 秒...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  cached = getCachedUserProfile("test-expire");
  console.log(`   過期後狀態: ${cached ? "✗ 仍存在" : "✓ 已過期"}`);

  // 最終統計
  stats = getCacheStats();
  console.log(`\n[4] 最終緩存鍵數量: ${stats.keys}`);

  return stats;
}

/**
 * 測試 5：並發訪問
 */
async function testConcurrentAccess() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 5：並發訪問測試");
  console.log("=".repeat(60));

  clearAllUserProfileCache();
  const userId = TEST_USER_IDS[0];

  console.log("\n[1] 發起 50 個並發請求");
  const start = Date.now();

  const promises = Array.from({ length: 50 }, () =>
    getUserProfileWithCache(userId)
  );

  await Promise.all(promises);

  const time = Date.now() - start;
  console.log(`   總時間: ${time}ms`);
  console.log(`   平均時間: ${(time / 50).toFixed(2)}ms`);

  // 顯示緩存統計
  const stats = getCacheStats();
  console.log(`\n[2] 緩存統計:`);
  console.log(`   命中次數: ${stats.hits}`);
  console.log(`   未命中次數: ${stats.misses}`);
  console.log(`   命中率: ${stats.hitRate}`);

  return { time, stats };
}

/**
 * 主測試函數
 */
async function runAllTests() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           用戶檔案緩存功能測試                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  try {
    // 運行所有測試
    await testBasicCaching();
    await testCacheInvalidation();
    await testBatchPerformance();
    await testCacheExpiration();
    await testConcurrentAccess();

    // 最終統計
    console.log("\n" + "=".repeat(60));
    console.log("最終緩存統計");
    console.log("=".repeat(60));
    logCacheStats();

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                    ✓ 所有測試完成                         ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n✗ 測試失敗:", error);
    process.exit(1);
  }

  process.exit(0);
}

// 運行測試
runAllTests();
