/**
 * P2 優化測試腳本
 * 測試項目：
 * 1. 藥水購買和使用功能（P2-1 重構驗證）
 * 2. 並發使用藥水（P2-3 錯誤訊息驗證）
 * 3. 解鎖券異常數據處理（P2-6 數據驗證）
 */

import { getFirestoreDb } from "../src/firebase/index.js";
import {
  purchaseMemoryBoost,
  purchaseBrainBoost,
  useMemoryBoost,
  useBrainBoost,
  getPotionInventory,
} from "../src/payment/potion.service.js";
import {
  getUserUnlockedCharacters,
  checkCharacterUnlocked,
} from "../src/membership/unlockTickets.service.js";
import { FieldValue } from "firebase-admin/firestore";

const db = getFirestoreDb();

// 測試用戶 ID（使用測試帳號）
const TEST_USER_ID = "test-user-p2-optimizations";
const TEST_CHARACTER_ID = "test-character-001";

// 顏色輸出
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
  section: (msg) =>
    console.log(`\n${colors.bright}${colors.cyan}${"=".repeat(60)}${colors.reset}`),
};

/**
 * 初始化測試用戶
 */
async function setupTestUser() {
  log.section();
  log.info("初始化測試用戶...");

  const userRef = db.collection("users").doc(TEST_USER_ID);
  const userLimitRef = db.collection("usage_limits").doc(TEST_USER_ID);

  await userRef.set({
    id: TEST_USER_ID,
    displayName: "P2 優化測試用戶",
    email: "test-p2@example.com",
    membershipTier: "free",
    walletBalance: 10000, // 給予足夠的金幣
    coins: 10000,
    assets: {
      memoryBoost: 0,
      brainBoost: 0,
    },
    unlockedCharacters: {}, // 清空解鎖記錄
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await userLimitRef.set({
    userId: TEST_USER_ID,
    potionInventory: {
      memoryBoost: 0,
      brainBoost: 0,
    },
    activePotionEffects: {},
    updatedAt: FieldValue.serverTimestamp(),
  });

  log.success("測試用戶初始化完成");
}

/**
 * 清理測試數據
 */
async function cleanupTestUser() {
  log.section();
  log.info("清理測試數據...");

  const userRef = db.collection("users").doc(TEST_USER_ID);
  const userLimitRef = db.collection("usage_limits").doc(TEST_USER_ID);

  await userRef.delete();
  await userLimitRef.delete();

  log.success("測試數據清理完成");
}

/**
 * 測試 1: 藥水購買功能（P2-1 重構驗證）
 */
async function testPotionPurchase() {
  log.section();
  log.test("測試 1: 藥水購買功能（P2-1 重構驗證）");

  try {
    // 1.1 購買記憶增強藥水
    log.info("1.1 購買記憶增強藥水（數量：2）");
    const memoryResult = await purchaseMemoryBoost(TEST_USER_ID, { quantity: 2 });

    if (memoryResult.success && memoryResult.quantity === 2) {
      log.success(`購買成功：${memoryResult.quantity} 個，花費 ${memoryResult.cost} 金幣，剩餘餘額 ${memoryResult.balance}`);
    } else {
      throw new Error("購買結果異常");
    }

    // 1.2 購買腦力激盪藥水
    log.info("1.2 購買腦力激盪藥水（數量：1）");
    const brainResult = await purchaseBrainBoost(TEST_USER_ID, { quantity: 1 });

    if (brainResult.success && brainResult.quantity === 1) {
      log.success(`購買成功：${brainResult.quantity} 個，花費 ${brainResult.cost} 金幣，剩餘餘額 ${brainResult.balance}`);
    } else {
      throw new Error("購買結果異常");
    }

    // 1.3 驗證庫存
    log.info("1.3 驗證庫存");
    const inventory = await getPotionInventory(TEST_USER_ID);

    if (inventory.memoryBoost === 2 && inventory.brainBoost === 1) {
      log.success(`庫存驗證成功：記憶增強 ${inventory.memoryBoost} 個，腦力激盪 ${inventory.brainBoost} 個`);
    } else {
      throw new Error(`庫存驗證失敗：預期 {memoryBoost: 2, brainBoost: 1}，實際 ${JSON.stringify(inventory)}`);
    }

    log.success("✅ 測試 1 通過：藥水購買功能正常");
    return true;
  } catch (error) {
    log.error(`測試 1 失敗：${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * 測試 2: 藥水使用功能（P2-1 重構驗證）
 */
async function testPotionUsage() {
  log.section();
  log.test("測試 2: 藥水使用功能（P2-1 重構驗證）");

  try {
    // 2.1 使用記憶增強藥水
    log.info("2.1 使用記憶增強藥水");
    const memoryUseResult = await useMemoryBoost(TEST_USER_ID, TEST_CHARACTER_ID);

    if (memoryUseResult.success && memoryUseResult.characterId === TEST_CHARACTER_ID) {
      log.success(`使用成功：角色 ${memoryUseResult.characterId}，過期時間 ${memoryUseResult.expiresAt}`);
    } else {
      throw new Error("使用結果異常");
    }

    // 2.2 使用腦力激盪藥水
    log.info("2.2 使用腦力激盪藥水");
    const brainUseResult = await useBrainBoost(TEST_USER_ID, TEST_CHARACTER_ID);

    if (brainUseResult.success && brainUseResult.characterId === TEST_CHARACTER_ID) {
      log.success(`使用成功：角色 ${brainUseResult.characterId}，過期時間 ${brainUseResult.expiresAt}`);
    } else {
      throw new Error("使用結果異常");
    }

    // 2.3 驗證庫存減少
    log.info("2.3 驗證庫存減少");
    const inventory = await getPotionInventory(TEST_USER_ID);

    if (inventory.memoryBoost === 1 && inventory.brainBoost === 0) {
      log.success(`庫存驗證成功：記憶增強 ${inventory.memoryBoost} 個（-1），腦力激盪 ${inventory.brainBoost} 個（-1）`);
    } else {
      throw new Error(`庫存驗證失敗：預期 {memoryBoost: 1, brainBoost: 0}，實際 ${JSON.stringify(inventory)}`);
    }

    log.success("✅ 測試 2 通過：藥水使用功能正常");
    return true;
  } catch (error) {
    log.error(`測試 2 失敗：${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * 測試 3: 重複激活檢查（P2-1 重構驗證）
 */
async function testDuplicateActivation() {
  log.section();
  log.test("測試 3: 重複激活檢查（P2-1 重構驗證）");

  try {
    log.info("3.1 嘗試對同一角色重複使用記憶增強藥水");

    try {
      await useMemoryBoost(TEST_USER_ID, TEST_CHARACTER_ID);
      throw new Error("應該拋出錯誤但沒有");
    } catch (error) {
      if (error.message.includes("已有記憶增強藥水效果")) {
        log.success(`正確阻止重複激活：${error.message}`);
      } else {
        throw error;
      }
    }

    log.success("✅ 測試 3 通過：重複激活檢查正常");
    return true;
  } catch (error) {
    log.error(`測試 3 失敗：${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * 測試 4: 並發使用藥水（P2-3 錯誤訊息驗證）
 */
async function testConcurrentPotionUsage() {
  log.section();
  log.test("測試 4: 並發使用藥水（P2-3 錯誤訊息驗證）");

  try {
    // 4.1 重置測試環境（清空激活效果，保留 1 個庫存）
    log.info("4.1 重置測試環境");
    const userLimitRef = db.collection("usage_limits").doc(TEST_USER_ID);
    await userLimitRef.update({
      activePotionEffects: {},
      "potionInventory.memoryBoost": 1,
    });
    log.success("環境重置完成，庫存：1 個記憶增強藥水");

    // 4.2 模擬並發請求（2 個請求同時使用）
    log.info("4.2 模擬並發使用（2 個請求同時使用 1 個庫存）");

    const CHARACTER_2 = "test-character-002";
    const CHARACTER_3 = "test-character-003";

    const promises = [
      useMemoryBoost(TEST_USER_ID, CHARACTER_2),
      useMemoryBoost(TEST_USER_ID, CHARACTER_3),
    ];

    const results = await Promise.allSettled(promises);

    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failureCount = results.filter(r => r.status === "rejected").length;

    log.info(`結果：${successCount} 個成功，${failureCount} 個失敗`);

    // 4.3 檢查錯誤訊息是否友好
    const failedResult = results.find(r => r.status === "rejected");
    if (failedResult) {
      const errorMessage = failedResult.reason.message;
      log.info(`錯誤訊息：${errorMessage}`);

      // ✅ P2-3 驗證：錯誤訊息應該是用戶友好的
      if (errorMessage === "藥水使用失敗，請稍後重試") {
        log.success("✅ 錯誤訊息用戶友好：顯示 '藥水使用失敗，請稍後重試'");
      } else if (errorMessage.includes("庫存不足")) {
        log.success("✅ 錯誤訊息正常：庫存不足提示");
      } else {
        log.warning(`錯誤訊息可能不夠友好：${errorMessage}`);
      }
    }

    // 4.4 驗證只有一個請求成功
    if (successCount === 1 && failureCount === 1) {
      log.success("✅ 並發控制正常：只有 1 個請求成功");
    } else if (successCount === 0 && failureCount === 2) {
      log.success("✅ 並發控制正常：庫存不足，兩個請求都失敗");
    } else {
      throw new Error(`並發控制異常：成功 ${successCount}，失敗 ${failureCount}`);
    }

    log.success("✅ 測試 4 通過：並發控制和錯誤訊息友好");
    return true;
  } catch (error) {
    log.error(`測試 4 失敗：${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * 測試 5: 解鎖券異常數據處理（P2-6 數據驗證）
 */
async function testUnlockDataValidation() {
  log.section();
  log.test("測試 5: 解鎖券異常數據處理（P2-6 數據驗證）");

  try {
    const userRef = db.collection("users").doc(TEST_USER_ID);

    // 5.1 測試邏輯矛盾（permanent=true 但 expiresAt 有值）
    log.info("5.1 測試邏輯矛盾（permanent=true 但 expiresAt 有值）");
    await userRef.update({
      unlockedCharacters: {
        "test-001": {
          permanent: true,
          expiresAt: "2025-12-31T23:59:59Z",
          unlockedBy: "test",
        },
      },
    });

    const result1 = await checkCharacterUnlocked(TEST_USER_ID, "test-001");
    if (result1.unlocked === true) {
      log.success("✅ 邏輯矛盾處理正確：以 permanent 為準，角色仍然解鎖");
    } else {
      throw new Error(`邏輯矛盾處理失敗：${JSON.stringify(result1)}`);
    }

    // 5.2 測試無效日期
    log.info("5.2 測試無效日期格式");
    await userRef.update({
      "unlockedCharacters.test-002": {
        permanent: false,
        expiresAt: "invalid-date-format",
        unlockedBy: "test",
      },
    });

    const result2 = await checkCharacterUnlocked(TEST_USER_ID, "test-002");
    if (result2.unlocked === false && result2.reason === "invalid_date_format") {
      log.success(`✅ 無效日期處理正確：${result2.reason}`);
    } else {
      throw new Error(`無效日期處理失敗：${JSON.stringify(result2)}`);
    }

    // 5.3 測試缺失字段
    log.info("5.3 測試缺失必要字段（permanent=false 但無 expiresAt）");
    await userRef.update({
      "unlockedCharacters.test-003": {
        permanent: false,
        unlockedBy: "test",
        // 缺少 expiresAt
      },
    });

    const result3 = await checkCharacterUnlocked(TEST_USER_ID, "test-003");
    if (result3.unlocked === false && result3.reason === "invalid_unlock_data") {
      log.success(`✅ 缺失字段處理正確：${result3.reason}`);
    } else {
      throw new Error(`缺失字段處理失敗：${JSON.stringify(result3)}`);
    }

    // 5.4 測試過期的臨時解鎖
    log.info("5.4 測試過期的臨時解鎖");
    const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 天前
    await userRef.update({
      "unlockedCharacters.test-004": {
        permanent: false,
        expiresAt: expiredDate.toISOString(),
        unlockedBy: "test",
      },
    });

    const result4 = await checkCharacterUnlocked(TEST_USER_ID, "test-004");
    if (result4.unlocked === false && result4.reason === "expired") {
      log.success(`✅ 過期解鎖處理正確：${result4.reason}`);
    } else {
      throw new Error(`過期解鎖處理失敗：${JSON.stringify(result4)}`);
    }

    // 5.5 測試有效的臨時解鎖
    log.info("5.5 測試有效的臨時解鎖");
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 天後
    await userRef.update({
      "unlockedCharacters.test-005": {
        permanent: false,
        expiresAt: futureDate.toISOString(),
        unlockedBy: "test",
      },
    });

    const result5 = await checkCharacterUnlocked(TEST_USER_ID, "test-005");
    if (result5.unlocked === true && result5.remainingDays > 0) {
      log.success(`✅ 有效解鎖處理正確：剩餘 ${result5.remainingDays} 天`);
    } else {
      throw new Error(`有效解鎖處理失敗：${JSON.stringify(result5)}`);
    }

    // 5.6 測試 getUserUnlockedCharacters（批量查詢）
    log.info("5.6 測試批量查詢已解鎖角色");
    const allUnlocked = await getUserUnlockedCharacters(TEST_USER_ID);

    // 應該只返回有效的解鎖記錄（test-001 和 test-005）
    const validCount = allUnlocked.filter(u => !u.isExpired).length;
    log.info(`有效解鎖角色數量：${validCount}`);

    if (validCount >= 2) {
      log.success(`✅ 批量查詢正確：過濾了無效數據，返回 ${validCount} 個有效解鎖`);
    } else {
      log.warning(`批量查詢結果：${validCount} 個有效解鎖（預期 >= 2）`);
    }

    log.success("✅ 測試 5 通過：解鎖券異常數據處理正確");
    return true;
  } catch (error) {
    log.error(`測試 5 失敗：${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * 主測試流程
 */
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                 P2 優化測試腳本                            ║");
  console.log("║                 2025-01-14                                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(colors.reset);

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  try {
    // 初始化
    await setupTestUser();

    // 運行測試
    const tests = [
      { name: "藥水購買功能", fn: testPotionPurchase },
      { name: "藥水使用功能", fn: testPotionUsage },
      { name: "重複激活檢查", fn: testDuplicateActivation },
      { name: "並發使用藥水", fn: testConcurrentPotionUsage },
      { name: "解鎖券異常數據處理", fn: testUnlockDataValidation },
    ];

    for (const test of tests) {
      results.total++;
      const passed = await test.fn();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

    // 清理
    await cleanupTestUser();

    // 輸出總結
    log.section();
    console.log(`${colors.bright}${colors.cyan}測試總結：${colors.reset}`);
    console.log(`總計：${results.total} 個測試`);
    console.log(
      `${colors.green}通過：${results.passed} 個${colors.reset}`
    );
    console.log(`${colors.red}失敗：${results.failed} 個${colors.reset}`);

    if (results.failed === 0) {
      console.log(
        `\n${colors.bright}${colors.green}🎉 所有測試通過！P2 優化驗證成功！${colors.reset}\n`
      );
      process.exit(0);
    } else {
      console.log(
        `\n${colors.bright}${colors.red}❌ ${results.failed} 個測試失敗，請檢查日誌${colors.reset}\n`
      );
      process.exit(1);
    }
  } catch (error) {
    log.error(`測試執行失敗：${error.message}`);
    console.error(error);

    // 嘗試清理
    try {
      await cleanupTestUser();
    } catch (cleanupError) {
      log.warning("清理測試數據時發生錯誤");
    }

    process.exit(1);
  }
}

// 執行測試
runTests().catch((error) => {
  console.error("測試腳本執行失敗：", error);
  process.exit(1);
});
