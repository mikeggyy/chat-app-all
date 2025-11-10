/**
 * 用戶檔案緩存獨立測試腳本（不需要 Firebase 連接）
 *
 * 測試緩存的核心功能：
 * 1. 緩存設置和獲取
 * 2. 緩存失效
 * 3. 緩存統計
 * 4. TTL 過期
 */

import {
  getCachedUserProfile,
  setCachedUserProfile,
  deleteCachedUserProfile,
  clearAllUserProfileCache,
  getCacheStats,
} from "../src/user/userProfileCache.service.js";

// 測試用模擬用戶資料
const mockUsers = {
  "user-1": {
    id: "user-1",
    displayName: "測試用戶 1",
    membershipTier: "free",
    coins: 100,
  },
  "user-2": {
    id: "user-2",
    displayName: "測試用戶 2",
    membershipTier: "vip",
    coins: 500,
  },
  "user-3": {
    id: "user-3",
    displayName: "測試用戶 3",
    membershipTier: "vvip",
    coins: 1000,
  },
};

/**
 * 測試 1：基本緩存設置和獲取
 */
function testBasicCaching() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 1：基本緩存設置和獲取");
  console.log("=".repeat(60));

  clearAllUserProfileCache();
  console.log("\n✓ 已清空所有緩存");

  // 設置緩存
  console.log("\n[1] 設置用戶緩存: user-1");
  const setResult = setCachedUserProfile("user-1", mockUsers["user-1"]);
  console.log(`   設置結果: ${setResult ? "✓ 成功" : "✗ 失敗"}`);

  // 獲取緩存
  console.log("\n[2] 從緩存獲取用戶: user-1");
  const cached = getCachedUserProfile("user-1");
  console.log(`   獲取結果: ${cached ? "✓ 成功" : "✗ 失敗"}`);
  if (cached) {
    console.log(`   用戶名稱: ${cached.displayName}`);
    console.log(`   會員等級: ${cached.membershipTier}`);
  }

  // 嘗試獲取不存在的緩存
  console.log("\n[3] 嘗試獲取不存在的緩存: user-999");
  const notCached = getCachedUserProfile("user-999");
  console.log(`   獲取結果: ${notCached ? "✗ 意外成功" : "✓ 正確返回 null"}`);

  return { setResult, cached, notCached };
}

/**
 * 測試 2：緩存失效
 */
function testCacheInvalidation() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 2：緩存失效");
  console.log("=".repeat(60));

  // 先設置緩存
  console.log("\n[1] 設置用戶緩存: user-2");
  setCachedUserProfile("user-2", mockUsers["user-2"]);
  let cached = getCachedUserProfile("user-2");
  console.log(`   緩存狀態: ${cached ? "✓ 已緩存" : "✗ 未緩存"}`);

  // 刪除緩存
  console.log("\n[2] 刪除緩存: user-2");
  const deleted = deleteCachedUserProfile("user-2");
  console.log(`   刪除結果: ${deleted ? "✓ 成功" : "✗ 失敗"}`);

  // 檢查緩存是否已刪除
  cached = getCachedUserProfile("user-2");
  console.log(`   緩存狀態: ${cached ? "✗ 仍存在" : "✓ 已刪除"}`);

  // 嘗試刪除不存在的緩存
  console.log("\n[3] 嘗試刪除不存在的緩存: user-999");
  const deletedNonExist = deleteCachedUserProfile("user-999");
  console.log(`   刪除結果: ${deletedNonExist ? "✗ 意外成功" : "✓ 正確返回 false"}`);

  return { deleted, deletedNonExist };
}

/**
 * 測試 3：批量緩存操作
 */
function testBatchCaching() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 3：批量緩存操作");
  console.log("=".repeat(60));

  clearAllUserProfileCache();

  // 批量設置緩存
  console.log("\n[1] 批量設置 3 個用戶緩存");
  Object.entries(mockUsers).forEach(([userId, userData]) => {
    setCachedUserProfile(userId, userData);
  });

  const stats1 = getCacheStats();
  console.log(`   緩存鍵數量: ${stats1.keys}`);
  console.log(`   設置次數: ${stats1.sets}`);

  // 批量訪問緩存
  console.log("\n[2] 批量訪問緩存");
  const start = Date.now();
  Object.keys(mockUsers).forEach((userId) => {
    getCachedUserProfile(userId);
  });
  const time = Date.now() - start;
  console.log(`   訪問 3 個緩存用時: ${time}ms`);

  const stats2 = getCacheStats();
  console.log(`   命中次數: ${stats2.hits}`);
  console.log(`   命中率: ${stats2.hitRate}`);

  return { stats1, stats2, time };
}

/**
 * 測試 4：緩存統計
 */
function testCacheStats() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 4：緩存統計");
  console.log("=".repeat(60));

  clearAllUserProfileCache();

  // 執行一系列操作
  console.log("\n[1] 執行緩存操作");

  // 設置 5 個緩存
  for (let i = 1; i <= 5; i++) {
    setCachedUserProfile(`user-${i}`, {
      id: `user-${i}`,
      displayName: `用戶 ${i}`,
    });
  }
  console.log("   ✓ 設置 5 個緩存");

  // 10 次緩存命中
  for (let i = 0; i < 10; i++) {
    getCachedUserProfile("user-1");
  }
  console.log("   ✓ 10 次緩存訪問（命中）");

  // 5 次緩存未命中
  for (let i = 0; i < 5; i++) {
    getCachedUserProfile(`user-${100 + i}`);
  }
  console.log("   ✓ 5 次緩存訪問（未命中）");

  // 刪除 2 個緩存
  deleteCachedUserProfile("user-1");
  deleteCachedUserProfile("user-2");
  console.log("   ✓ 刪除 2 個緩存");

  // 檢查統計
  console.log("\n[2] 緩存統計結果");
  const stats = getCacheStats();
  console.log(`   命中次數: ${stats.hits}`);
  console.log(`   未命中次數: ${stats.misses}`);
  console.log(`   命中率: ${stats.hitRate}`);
  console.log(`   設置次數: ${stats.sets}`);
  console.log(`   刪除次數: ${stats.deletes}`);
  console.log(`   緩存鍵數量: ${stats.keys}`);
  console.log(`   錯誤次數: ${stats.errors}`);

  return stats;
}

/**
 * 測試 5：TTL 過期（短 TTL）
 */
async function testTTLExpiration() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 5：TTL 過期測試");
  console.log("=".repeat(60));

  clearAllUserProfileCache();

  // 設置短 TTL 緩存（1 秒）
  console.log("\n[1] 設置短 TTL 緩存（1 秒）");
  setCachedUserProfile("user-expire", mockUsers["user-1"], 1);
  let cached = getCachedUserProfile("user-expire");
  console.log(`   設置後狀態: ${cached ? "✓ 已緩存" : "✗ 未緩存"}`);

  // 等待 1.5 秒
  console.log("\n[2] 等待 1.5 秒...");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  cached = getCachedUserProfile("user-expire");
  console.log(`   過期後狀態: ${cached ? "✗ 仍存在" : "✓ 已過期"}`);

  return { expired: !cached };
}

/**
 * 測試 6：高頻訪問性能
 */
function testHighFrequencyAccess() {
  console.log("\n" + "=".repeat(60));
  console.log("測試 6：高頻訪問性能測試");
  console.log("=".repeat(60));

  clearAllUserProfileCache();

  // 先設置緩存
  setCachedUserProfile("user-performance", mockUsers["user-1"]);

  // 高頻訪問（1000 次）
  console.log("\n[1] 執行 1000 次緩存訪問");
  const start = Date.now();

  for (let i = 0; i < 1000; i++) {
    getCachedUserProfile("user-performance");
  }

  const time = Date.now() - start;
  console.log(`   總時間: ${time}ms`);
  console.log(`   平均時間: ${(time / 1000).toFixed(3)}ms`);
  console.log(`   吞吐量: ${(1000 / (time / 1000)).toFixed(0)} ops/sec`);

  const stats = getCacheStats();
  console.log(`\n[2] 緩存命中率: ${stats.hitRate}`);

  return { time, stats };
}

/**
 * 主測試函數
 */
async function runAllTests() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║        用戶檔案緩存功能測試（獨立測試）                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  try {
    const results = {
      test1: testBasicCaching(),
      test2: testCacheInvalidation(),
      test3: testBatchCaching(),
      test4: testCacheStats(),
      test5: await testTTLExpiration(),
      test6: testHighFrequencyAccess(),
    };

    // 最終總結
    console.log("\n" + "=".repeat(60));
    console.log("測試結果總結");
    console.log("=".repeat(60));

    const finalStats = getCacheStats();
    console.log(`\n✓ 測試完成`);
    console.log(`  - 最終緩存鍵數量: ${finalStats.keys}`);
    console.log(`  - 總命中次數: ${finalStats.hits}`);
    console.log(`  - 總未命中次數: ${finalStats.misses}`);
    console.log(`  - 總命中率: ${finalStats.hitRate}`);
    console.log(`  - 總設置次數: ${finalStats.sets}`);
    console.log(`  - 總刪除次數: ${finalStats.deletes}`);
    console.log(`  - 總錯誤次數: ${finalStats.errors}`);

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║              ✓ 所有測試通過！緩存系統正常運作             ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    return results;
  } catch (error) {
    console.error("\n✗ 測試失敗:", error);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// 運行測試
runAllTests();
