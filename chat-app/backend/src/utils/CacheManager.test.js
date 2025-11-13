/**
 * CacheManager 功能測試
 * 運行方式：node src/utils/CacheManager.test.js
 */

import { CacheManager } from "./CacheManager.js";
import logger from "./logger.js";

// 測試函數
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testCacheManager() {
  logger.info("=".repeat(60));
  logger.info("開始 CacheManager 功能測試");
  logger.info("=".repeat(60));

  let passedTests = 0;
  let failedTests = 0;

  // 測試 1: 基本的 set 和 get
  logger.info("\n[測試 1] 基本的 set 和 get");
  const cache1 = new CacheManager({ name: "Test1", ttl: 5000 });
  cache1.set("key1", "value1");
  const val1 = cache1.get("key1");
  if (val1 === "value1") {
    logger.info("✅ 通過：基本 set/get 功能正常");
    passedTests++;
  } else {
    logger.error("❌ 失敗：基本 set/get 功能異常");
    failedTests++;
  }

  // 測試 2: TTL 過期
  logger.info("\n[測試 2] TTL 過期功能");
  const cache2 = new CacheManager({ name: "Test2", ttl: 1000, enableAutoCleanup: false });
  cache2.set("key2", "value2");
  logger.info("等待 1.5 秒後檢查過期...");
  await sleep(1500);
  const val2 = cache2.get("key2");
  if (val2 === null) {
    logger.info("✅ 通過：TTL 過期功能正常");
    passedTests++;
  } else {
    logger.error("❌ 失敗：TTL 過期功能異常");
    failedTests++;
  }

  // 測試 3: 自定義 TTL
  logger.info("\n[測試 3] 自定義 TTL");
  const cache3 = new CacheManager({ name: "Test3", ttl: 5000, enableAutoCleanup: false });
  cache3.set("key3a", "value3a"); // 使用默認 TTL (5秒)
  cache3.set("key3b", "value3b", 1000); // 使用自定義 TTL (1秒)
  await sleep(1500);
  const val3a = cache3.get("key3a"); // 應該存在
  const val3b = cache3.get("key3b"); // 應該過期
  if (val3a === "value3a" && val3b === null) {
    logger.info("✅ 通過：自定義 TTL 功能正常");
    passedTests++;
  } else {
    logger.error("❌ 失敗：自定義 TTL 功能異常");
    failedTests++;
  }

  // 測試 4: 緩存清除
  logger.info("\n[測試 4] 緩存清除");
  const cache4 = new CacheManager({ name: "Test4", ttl: 5000, enableAutoCleanup: false });
  cache4.set("key4a", "value4a");
  cache4.set("key4b", "value4b");
  cache4.delete("key4a"); // 刪除單個
  const val4a = cache4.get("key4a");
  const val4b = cache4.get("key4b");
  cache4.clear(); // 清除所有
  const val4c = cache4.get("key4b");
  if (val4a === null && val4b === "value4b" && val4c === null) {
    logger.info("✅ 通過：緩存清除功能正常");
    passedTests++;
  } else {
    logger.error("❌ 失敗：緩存清除功能異常");
    failedTests++;
  }

  // 測試 5: has() 方法
  logger.info("\n[測試 5] has() 方法");
  const cache5 = new CacheManager({ name: "Test5", ttl: 5000, enableAutoCleanup: false });
  cache5.set("key5", "value5");
  const has5a = cache5.has("key5");
  const has5b = cache5.has("nonexistent");
  if (has5a === true && has5b === false) {
    logger.info("✅ 通過：has() 方法功能正常");
    passedTests++;
  } else {
    logger.error("❌ 失敗：has() 方法功能異常");
    failedTests++;
  }

  // 測試 6: size() 方法
  logger.info("\n[測試 6] size() 方法");
  const cache6 = new CacheManager({ name: "Test6", ttl: 5000, enableAutoCleanup: false });
  cache6.set("key6a", "value6a");
  cache6.set("key6b", "value6b");
  cache6.set("key6c", "value6c");
  const size6 = cache6.size();
  if (size6 === 3) {
    logger.info("✅ 通過：size() 方法功能正常");
    passedTests++;
  } else {
    logger.error("❌ 失敗：size() 方法功能異常");
    failedTests++;
  }

  // 測試 7: cleanup() 手動清理
  logger.info("\n[測試 7] cleanup() 手動清理");
  const cache7 = new CacheManager({ name: "Test7", ttl: 1000, enableAutoCleanup: false });
  cache7.set("key7a", "value7a");
  cache7.set("key7b", "value7b");
  await sleep(1500); // 等待過期
  cache7.set("key7c", "value7c"); // 新增一個未過期的
  const cleaned = cache7.cleanup();
  const size7 = cache7.size();
  if (cleaned === 2 && size7 === 1) {
    logger.info("✅ 通過：cleanup() 手動清理功能正常");
    passedTests++;
  } else {
    logger.error("❌ 失敗：cleanup() 手動清理功能異常");
    failedTests++;
  }

  // 測試 8: 統計功能
  logger.info("\n[測試 8] 統計功能");
  const cache8 = new CacheManager({ name: "Test8", ttl: 5000, enableAutoCleanup: false });
  cache8.set("key8", "value8");
  cache8.get("key8"); // hit
  cache8.get("key8"); // hit
  cache8.get("nonexistent"); // miss
  const stats8 = cache8.getStats();
  if (stats8.hits === 2 && stats8.misses === 1 && stats8.sets === 1) {
    logger.info("✅ 通過：統計功能正常");
    passedTests++;
    logger.info(`   命中率: ${stats8.hitRate}`);
  } else {
    logger.error("❌ 失敗：統計功能異常");
    failedTests++;
  }

  // 測試 9: 自動清理（啟用 autoCleanup）
  logger.info("\n[測試 9] 自動清理功能");
  const cache9 = new CacheManager({
    name: "Test9",
    ttl: 1000,
    enableAutoCleanup: true,
    cleanupInterval: 2000, // 2秒清理一次
  });
  cache9.set("key9", "value9");
  logger.info("等待 3 秒後檢查自動清理...");
  await sleep(3000);
  const stats9 = cache9.getStats();
  if (stats9.expirations > 0) {
    logger.info("✅ 通過：自動清理功能正常");
    passedTests++;
  } else {
    logger.error("❌ 失敗：自動清理功能異常");
    failedTests++;
  }
  cache9.destroy(); // 清理定時器

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

  // 清理所有測試緩存
  cache1.destroy();
  cache2.destroy();
  cache3.destroy();
  cache4.destroy();
  cache5.destroy();
  cache6.destroy();
  cache7.destroy();
  cache8.destroy();

  process.exit(failedTests > 0 ? 1 : 0);
}

// 運行測試
testCacheManager().catch(error => {
  logger.error("測試執行失敗:", error);
  process.exit(1);
});
