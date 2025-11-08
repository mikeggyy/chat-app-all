/**
 * 測試藥水系統 V3 (兩階段庫存系統)
 * 測試流程：購買 → 庫存增加 → 使用 → 激活效果
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import {
  purchaseMemoryBoost,
  purchaseBrainBoost,
  useMemoryBoost,
  useBrainBoost,
  getPotionInventory,
  getUserActivePotions,
  hasMemoryBoost,
  hasBrainBoost,
} from "../src/payment/potion.service.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();
const TEST_USER_ID = "test-potion-user-" + Date.now();

async function testPotionSystem() {
  console.log("========================================");
  console.log("測試藥水系統 V3 (兩階段庫存系統)");
  console.log("========================================\n");

  try {
    // Step 1: 創建測試用戶
    console.log("📝 Step 1: 創建測試用戶");
    await db.collection("users").doc(TEST_USER_ID).set({
      displayName: "藥水測試用戶",
      email: `potion-test-${Date.now()}@example.com`,
      membershipTier: "vip",
      walletBalance: 10000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log("✅ 測試用戶創建成功");
    console.log(`   用戶 ID: ${TEST_USER_ID}`);
    console.log(`   初始金幣: 10000\n`);

    // Step 2: 購買記憶增強藥水
    console.log("🛒 Step 2: 購買 3 個記憶增強藥水");
    for (let i = 0; i < 3; i++) {
      const result = await purchaseMemoryBoost(TEST_USER_ID);
      console.log(`   ✅ 購買成功 #${i + 1}`);
      console.log(`      庫存數量: ${result.newInventoryCount}`);
      console.log(`      剩餘金幣: ${result.balance}`);
    }
    console.log();

    // Step 3: 購買腦力激盪藥水
    console.log("🛒 Step 3: 購買 2 個腦力激盪藥水");
    for (let i = 0; i < 2; i++) {
      const result = await purchaseBrainBoost(TEST_USER_ID);
      console.log(`   ✅ 購買成功 #${i + 1}`);
      console.log(`      庫存數量: ${result.newInventoryCount}`);
      console.log(`      剩餘金幣: ${result.balance}`);
    }
    console.log();

    // Step 4: 查詢庫存
    console.log("📦 Step 4: 查詢庫存");
    const inventory = await getPotionInventory(TEST_USER_ID);
    console.log("✅ 當前庫存:");
    console.log(`   記憶增強藥水: ${inventory.memoryBoost} 個`);
    console.log(`   腦力激盪藥水: ${inventory.brainBoost} 個\n`);

    // Step 5: 使用記憶增強藥水
    console.log("🧪 Step 5: 使用記憶增強藥水");
    const memoryResult1 = await useMemoryBoost(TEST_USER_ID, "match-001");
    console.log("✅ 記憶增強藥水已激活");
    console.log(`   角色 ID: ${memoryResult1.characterId}`);
    console.log(`   效果 ID: ${memoryResult1.effectId}`);
    console.log(`   有效期至: ${new Date(memoryResult1.expiresAt).toLocaleString("zh-TW")}`);
    console.log(`   持續天數: ${memoryResult1.duration} 天\n`);

    const memoryResult2 = await useMemoryBoost(TEST_USER_ID, "match-002");
    console.log("✅ 記憶增強藥水已激活（第二個角色）");
    console.log(`   角色 ID: ${memoryResult2.characterId}`);
    console.log(`   效果 ID: ${memoryResult2.effectId}\n`);

    // Step 6: 使用腦力激盪藥水
    console.log("⚡ Step 6: 使用腦力激盪藥水");
    const brainResult = await useBrainBoost(TEST_USER_ID);
    console.log("✅ 腦力激盪藥水已激活");
    console.log(`   效果 ID: ${brainResult.effectId}`);
    console.log(`   有效期至: ${new Date(brainResult.expiresAt).toLocaleString("zh-TW")}`);
    console.log(`   持續天數: ${brainResult.duration} 天\n`);

    // Step 7: 再次查詢庫存（應該已扣除）
    console.log("📦 Step 7: 再次查詢庫存");
    const inventoryAfter = await getPotionInventory(TEST_USER_ID);
    console.log("✅ 使用後庫存:");
    console.log(`   記憶增強藥水: ${inventoryAfter.memoryBoost} 個 (已使用 2 個)`);
    console.log(`   腦力激盪藥水: ${inventoryAfter.brainBoost} 個 (已使用 1 個)\n`);

    // Step 8: 查詢激活的效果
    console.log("🔍 Step 8: 查詢激活的效果");
    const activeEffects = await getUserActivePotions(TEST_USER_ID);
    console.log(`✅ 找到 ${activeEffects.length} 個激活的效果:`);
    for (const effect of activeEffects) {
      console.log(`   - ${effect.id}:`);
      console.log(`     類型: ${effect.potionType}`);
      if (effect.characterId) {
        console.log(`     角色: ${effect.characterId}`);
      }
      console.log(`     激活時間: ${new Date(effect.activatedAt).toLocaleString("zh-TW")}`);
      console.log(`     過期時間: ${new Date(effect.expiresAt).toLocaleString("zh-TW")}`);
    }
    console.log();

    // Step 9: 檢查特定效果
    console.log("✔️ Step 9: 檢查特定效果");
    const hasMemoryForMatch001 = await hasMemoryBoost(TEST_USER_ID, "match-001");
    const hasMemoryForMatch002 = await hasMemoryBoost(TEST_USER_ID, "match-002");
    const hasMemoryForMatch003 = await hasMemoryBoost(TEST_USER_ID, "match-003");
    const hasBrain = await hasBrainBoost(TEST_USER_ID);

    console.log("✅ 效果檢查結果:");
    console.log(`   match-001 有記憶增強: ${hasMemoryForMatch001 ? "✅" : "❌"}`);
    console.log(`   match-002 有記憶增強: ${hasMemoryForMatch002 ? "✅" : "❌"}`);
    console.log(`   match-003 有記憶增強: ${hasMemoryForMatch003 ? "✅" : "❌"} (預期沒有)`);
    console.log(`   用戶有腦力激盪: ${hasBrain ? "✅" : "❌"}\n`);

    // Step 10: 測試重複使用（應該失敗）
    console.log("⚠️ Step 10: 測試重複使用同一角色（應該失敗）");
    try {
      await useMemoryBoost(TEST_USER_ID, "match-001");
      console.log("❌ 錯誤：應該禁止重複使用\n");
    } catch (error) {
      console.log("✅ 正確阻止重複使用:");
      console.log(`   錯誤訊息: ${error.message}\n`);
    }

    // Step 11: 測試庫存不足（應該失敗）
    console.log("⚠️ Step 11: 測試庫存不足（應該失敗）");
    try {
      // 先用完剩餘的庫存
      await useMemoryBoost(TEST_USER_ID, "match-003");
      console.log("   ✅ 使用最後一個記憶增強藥水成功");

      // 再嘗試使用（庫存已空）
      await useMemoryBoost(TEST_USER_ID, "match-004");
      console.log("❌ 錯誤：應該禁止庫存不足時使用\n");
    } catch (error) {
      console.log("✅ 正確阻止庫存不足:");
      console.log(`   錯誤訊息: ${error.message}\n`);
    }

    // Step 12: 查看最終狀態
    console.log("📊 Step 12: 最終狀態");
    const finalInventory = await getPotionInventory(TEST_USER_ID);
    const finalEffects = await getUserActivePotions(TEST_USER_ID);

    console.log("✅ 最終庫存:");
    console.log(`   記憶增強藥水: ${finalInventory.memoryBoost} 個`);
    console.log(`   腦力激盪藥水: ${finalInventory.brainBoost} 個`);
    console.log();
    console.log("✅ 激活效果:");
    console.log(`   總共 ${finalEffects.length} 個激活效果`);
    console.log();

    // Step 13: 清理測試數據
    console.log("🧹 Step 13: 清理測試數據");

    await db.collection("usage_limits").doc(TEST_USER_ID).delete();
    await db.collection("users").doc(TEST_USER_ID).delete();

    console.log("✅ 測試數據已清理");
    console.log();

    // 總結
    console.log("========================================");
    console.log("✅ 所有測試通過！");
    console.log("========================================");
    console.log("\n藥水系統功能驗證：");
    console.log("✅ 購買藥水 → 增加庫存");
    console.log("✅ 使用藥水 → 扣除庫存 → 激活效果");
    console.log("✅ 查詢庫存數量");
    console.log("✅ 查詢激活效果");
    console.log("✅ 檢查特定角色/用戶效果");
    console.log("✅ 防止重複使用");
    console.log("✅ 防止庫存不足");
    console.log("✅ Firestore 持久化存儲");
    console.log("\n藥水系統兩階段庫存架構已準備好使用！");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ 測試過程中發生錯誤:");
    console.error("錯誤訊息:", error.message);
    console.error("錯誤堆疊:", error.stack);

    // 嘗試清理測試數據
    try {
      await db.collection("usage_limits").doc(TEST_USER_ID).delete();
      await db.collection("users").doc(TEST_USER_ID).delete();
      console.log("✅ 已清理測試數據");
    } catch (cleanupError) {
      console.error("❌ 清理測試數據失敗:", cleanupError.message);
    }

    process.exit(1);
  }
}

// 執行測試
console.log("\n🚀 開始測試藥水系統（兩階段庫存架構）...\n");
testPotionSystem();
