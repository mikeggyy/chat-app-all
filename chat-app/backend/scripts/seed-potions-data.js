/**
 * 為測試用戶添加藥水數據（不清理，用於查看資料庫）
 * 使用新的兩階段庫存系統：potionInventory + activePotionEffects
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";

const db = getFirestoreDb();

async function seedPotionsData() {
  console.log("========================================");
  console.log("添加藥水測試數據到 Firestore");
  console.log("(兩階段庫存系統)");
  console.log("========================================\n");

  try {
    // 使用一個固定的測試用戶 ID
    const TEST_USER_ID = "test-user-with-potions";

    // 檢查用戶是否存在，不存在則創建
    const userDoc = await db.collection("users").doc(TEST_USER_ID).get();

    if (!userDoc.exists) {
      console.log("📝 創建測試用戶...");
      await db.collection("users").doc(TEST_USER_ID).set({
        displayName: "藥水測試用戶",
        email: "potion-test@example.com",
        membershipTier: "vip",
        walletBalance: 5000,
        assets: {
          photoUnlockCards: 5,
          videoUnlockCards: 3,
          voiceUnlockCards: 10,
          characterUnlockCards: 2,
          createCards: 1,
          gifts: {},
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log("✅ 測試用戶已創建");
      console.log(`   User ID: ${TEST_USER_ID}`);
      console.log(`   Email: potion-test@example.com`);
      console.log();
    } else {
      console.log("✅ 測試用戶已存在");
      console.log(`   User ID: ${TEST_USER_ID}`);
      console.log();
    }

    const now = new Date();

    // 構建藥水數據
    console.log("📦 設置藥水庫存...");
    const potionInventory = {
      memoryBoost: 5,  // 5 個未使用的記憶增強藥水
      brainBoost: 3,   // 3 個未使用的腦力激盪藥水
    };

    console.log("   ✅ 記憶增強藥水庫存: 5 個");
    console.log("   ✅ 腦力激盪藥水庫存: 3 個");
    console.log();

    // 構建激活的效果數據
    console.log("⚡ 設置激活的藥水效果...");
    const activePotionEffects = {};

    // 記憶增強藥水效果 - 角色 1 (還剩 15 天)
    const memoryEffect1ExpiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    activePotionEffects["memory_boost_match-001"] = {
      characterId: "match-001",
      potionType: "memory_boost",
      activatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: memoryEffect1ExpiresAt.toISOString(),
    };

    console.log("   ✅ memory_boost_match-001");
    console.log(`      角色: match-001`);
    console.log(`      過期: ${memoryEffect1ExpiresAt.toLocaleString("zh-TW")}`);
    console.log(`      剩餘: 15 天`);

    // 記憶增強藥水效果 - 角色 2 (還剩 25 天)
    const memoryEffect2ExpiresAt = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000);
    activePotionEffects["memory_boost_match-002"] = {
      characterId: "match-002",
      potionType: "memory_boost",
      activatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: memoryEffect2ExpiresAt.toISOString(),
    };

    console.log("   ✅ memory_boost_match-002");
    console.log(`      角色: match-002`);
    console.log(`      過期: ${memoryEffect2ExpiresAt.toLocaleString("zh-TW")}`);
    console.log(`      剩餘: 25 天`);

    // 腦力激盪藥水效果 (還剩 20 天)
    const brainEffectExpiresAt = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    activePotionEffects["brain_boost"] = {
      potionType: "brain_boost",
      activatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: brainEffectExpiresAt.toISOString(),
    };

    console.log("   ✅ brain_boost");
    console.log(`      過期: ${brainEffectExpiresAt.toLocaleString("zh-TW")}`);
    console.log(`      剩餘: 20 天`);

    // 添加一個已過期的效果（用於測試）
    const expiredDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    activePotionEffects["memory_boost_expired"] = {
      characterId: "expired",
      potionType: "memory_boost",
      activatedAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: expiredDate.toISOString(),
    };

    console.log("   ✅ memory_boost_expired (已過期 5 天)");
    console.log();

    // 將所有藥水數據寫入 usage_limits 集合
    await db
      .collection("usage_limits")
      .doc(TEST_USER_ID)
      .set(
        {
          potionInventory,
          activePotionEffects,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    // 總結
    console.log("========================================");
    console.log("✅ 藥水數據添加完成！");
    console.log("========================================\n");

    console.log("📊 數據摘要：");
    console.log(`   用戶 ID: ${TEST_USER_ID}`);
    console.log();
    console.log("📦 庫存（未使用）：");
    console.log(`   記憶增強藥水: ${potionInventory.memoryBoost} 個`);
    console.log(`   腦力激盪藥水: ${potionInventory.brainBoost} 個`);
    console.log();
    console.log("⚡ 激活效果（已使用）：");
    console.log(`   記憶增強藥水 (match-001): 15 天後過期`);
    console.log(`   記憶增強藥水 (match-002): 25 天後過期`);
    console.log(`   記憶增強藥水 (expired): 已過期`);
    console.log(`   腦力激盪藥水: 20 天後過期`);
    console.log();

    console.log("🔍 查看數據：");
    console.log("   1. Firebase Emulator UI:");
    console.log("      http://localhost:4001/firestore");
    console.log();
    console.log("   2. 集合路徑:");
    console.log("      usage_limits/{userId}");
    console.log();
    console.log("   3. 數據結構:");
    console.log("      usage_limits/{userId}: {");
    console.log("        potionInventory: { memoryBoost: 5, brainBoost: 3 },");
    console.log("        activePotionEffects: {");
    console.log("          memory_boost_match-001: { characterId, activatedAt, expiresAt },");
    console.log("          memory_boost_match-002: { characterId, activatedAt, expiresAt },");
    console.log("          brain_boost: { activatedAt, expiresAt },");
    console.log("          memory_boost_expired: { characterId, activatedAt, expiresAt }");
    console.log("        }");
    console.log("      }");
    console.log();
    console.log("   4. 在管理後台查看:");
    console.log("      - 搜索用戶: potion-test@example.com");
    console.log("      - 或 UID: test-user-with-potions");
    console.log();

    process.exit(0);
  } catch (error) {
    console.error("\n❌ 添加數據時發生錯誤:");
    console.error("錯誤訊息:", error.message);
    console.error("錯誤堆疊:", error.stack);
    process.exit(1);
  }
}

// 執行腳本
console.log("\n🚀 開始添加藥水測試數據（兩階段庫存系統）...\n");
seedPotionsData();
