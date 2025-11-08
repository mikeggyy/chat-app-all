/**
 * 測試管理後台的用戶資產更新功能
 * 驗證 voiceUnlockCards, characterUnlockCards, createCards 的更新邏輯
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();

const TEST_USER_ID = "test-admin-update-" + Date.now();

async function testAdminAssetUpdate() {
  console.log("========================================");
  console.log("測試管理後台資產更新功能");
  console.log("========================================\n");

  try {
    // Step 1: 創建測試用戶
    console.log("📝 Step 1: 創建測試用戶");
    const initialData = {
      displayName: "資產更新測試",
      email: `test-${Date.now()}@example.com`,
      membershipTier: "free",
      walletBalance: 100,
      assets: {
        photoUnlockCards: 1,
        videoUnlockCards: 2,
        voiceUnlockCards: 3,
        characterUnlockCards: 4,
        createCards: 5,
        gifts: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection("users").doc(TEST_USER_ID).set(initialData);
    console.log("✅ 測試用戶創建成功");
    console.log("初始資產數據:", initialData.assets);
    console.log();

    // Step 2: 讀取初始數據
    console.log("📖 Step 2: 讀取初始數據確認");
    let userDoc = await db.collection("users").doc(TEST_USER_ID).get();
    let userData = userDoc.data();
    console.log("資產數據:", userData.assets);
    console.log();

    // Step 3: 模擬管理後台的更新邏輯（來自 users.routes.js 第 366-390 行）
    console.log("🔄 Step 3: 模擬管理後台更新邏輯");

    const assets = {
      photoUnlockCards: 10,
      videoUnlockCards: 20,
      voiceUnlockCards: 30,      // ← 這是問題欄位
      characterUnlockCards: 40,  // ← 這是問題欄位
      createCards: 50,           // ← 這是問題欄位
    };

    const firestoreUpdates = {};

    // 這是管理後台的實際邏輯
    if (assets.characterUnlockCards !== undefined) {
      firestoreUpdates["assets.characterUnlockCards"] = assets.characterUnlockCards;
    }
    if (assets.photoUnlockCards !== undefined) {
      firestoreUpdates["assets.photoUnlockCards"] = assets.photoUnlockCards;
    }
    if (assets.videoUnlockCards !== undefined) {
      firestoreUpdates["assets.videoUnlockCards"] = assets.videoUnlockCards;
    }
    if (assets.voiceUnlockCards !== undefined) {
      firestoreUpdates["assets.voiceUnlockCards"] = assets.voiceUnlockCards;
    }
    if (assets.createCards !== undefined) {
      firestoreUpdates["assets.createCards"] = assets.createCards;
    }

    firestoreUpdates.updatedAt = new Date().toISOString();

    console.log("準備更新的數據:", firestoreUpdates);
    console.log();

    // Step 4: 執行更新
    console.log("💾 Step 4: 執行 Firestore 更新");
    await db.collection("users").doc(TEST_USER_ID).update(firestoreUpdates);
    console.log("✅ 更新完成");
    console.log();

    // Step 5: 驗證更新結果
    console.log("🔍 Step 5: 驗證更新結果");
    userDoc = await db.collection("users").doc(TEST_USER_ID).get();
    userData = userDoc.data();

    console.log("更新後的完整資產數據:");
    console.log(JSON.stringify(userData.assets, null, 2));
    console.log();

    // Step 6: 逐個檢查欄位
    console.log("✔️ Step 6: 逐個檢查欄位更新狀態");
    const checks = [
      {
        field: "photoUnlockCards",
        expected: 10,
        actual: userData.assets?.photoUnlockCards,
      },
      {
        field: "videoUnlockCards",
        expected: 20,
        actual: userData.assets?.videoUnlockCards,
      },
      {
        field: "voiceUnlockCards",
        expected: 30,
        actual: userData.assets?.voiceUnlockCards,
      },
      {
        field: "characterUnlockCards",
        expected: 40,
        actual: userData.assets?.characterUnlockCards,
      },
      {
        field: "createCards",
        expected: 50,
        actual: userData.assets?.createCards,
      },
    ];

    let allPassed = true;
    checks.forEach((check) => {
      const passed = check.actual === check.expected;
      const status = passed ? "✅ PASS" : "❌ FAIL";
      const icon = check.field === "voiceUnlockCards" ||
                   check.field === "characterUnlockCards" ||
                   check.field === "createCards" ? "⭐" : "";
      console.log(
        `${status} ${icon} ${check.field.padEnd(25)} - 期望: ${check.expected}, 實際: ${check.actual}`
      );
      if (!passed) {
        allPassed = false;
        console.log(`   ⚠️  更新失敗！`);
      }
    });
    console.log();

    // Step 7: 清理測試數據
    console.log("🧹 Step 7: 清理測試數據");
    await db.collection("users").doc(TEST_USER_ID).delete();
    console.log("✅ 測試數據已刪除");
    console.log();

    // 總結
    console.log("========================================");
    if (allPassed) {
      console.log("✅ 所有測試通過！");
      console.log("   管理後台的資產更新邏輯正常工作");
      console.log("   voiceUnlockCards ✓");
      console.log("   characterUnlockCards ✓");
      console.log("   createCards ✓");
    } else {
      console.log("❌ 測試失敗！");
      console.log("   請檢查：");
      console.log("   1. Firebase Emulator 是否正常運行");
      console.log("   2. Firestore 更新權限設置");
      console.log("   3. 管理後台後端代碼邏輯");
    }
    console.log("========================================");

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("\n❌ 測試過程中發生錯誤:");
    console.error("錯誤訊息:", error.message);
    console.error("錯誤堆疊:", error.stack);

    // 嘗試清理測試數據
    try {
      await db.collection("users").doc(TEST_USER_ID).delete();
      console.log("✅ 已清理測試數據");
    } catch (cleanupError) {
      console.error("❌ 清理測試數據失敗:", cleanupError.message);
    }

    process.exit(1);
  }
}

// 執行測試
console.log("\n🚀 開始測試...\n");
testAdminAssetUpdate();
