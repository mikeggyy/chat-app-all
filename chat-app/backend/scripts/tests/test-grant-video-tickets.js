/**
 * 測試發放影片生成卡功能
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { grantTickets } from "../src/membership/unlockTickets.service.js";
import { getVideoStats, canGenerateVideo } from "../src/ai/videoLimit.service.js";
import { upsertUser } from "../src/user/user.service.js";

const TEST_USER_ID = "test-video-tickets-789";

async function testGrantVideoTickets() {
  console.log("\n========================================");
  console.log("🎁 影片生成卡發放測試");
  console.log("========================================\n");

  try {
    // 0. 創建測試用戶
    console.log("0️⃣ 創建測試用戶...\n");
    await upsertUser({
      id: TEST_USER_ID,
      userId: TEST_USER_ID,
      email: "test-tickets@example.com",
      displayName: "影片卡測試用戶",
      membershipTier: "free",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log("✓ 用戶創建成功\n");

    // 1. 檢查初始狀態
    console.log("1️⃣ 檢查初始影片卡數量...\n");
    const initialStats = await getVideoStats(TEST_USER_ID);
    console.log(`初始影片卡: ${initialStats.cards} 張\n`);

    // 2. 發放 VIP 等級的影片卡（1 張）
    console.log("2️⃣ 模擬 VIP 開通，發放 1 張影片卡...\n");
    await grantTickets(TEST_USER_ID, {
      videoUnlockCards: 1,
    });
    console.log("✓ VIP 影片卡發放成功\n");

    // 3. 檢查發放後的狀態
    console.log("3️⃣ 檢查發放後的影片卡數量...\n");
    const vipStats = await getVideoStats(TEST_USER_ID);
    console.log(`當前影片卡: ${vipStats.cards} 張`);
    console.log(`剩餘次數: ${vipStats.remaining}`);
    console.log(`是否可生成: ${vipStats.remaining > 0 ? "是" : "否"}\n`);

    // 4. 檢查生成權限
    console.log("4️⃣ 檢查影片生成權限...\n");
    const canGenerate = await canGenerateVideo(TEST_USER_ID);
    console.log(`允許生成: ${canGenerate.canGenerate ? "是" : "否"}`);
    console.log(`剩餘次數: ${canGenerate.remaining || 0}\n`);

    // 5. 再發放 VVIP 等級的影片卡（5 張）
    console.log("5️⃣ 模擬升級到 VVIP，再發放 5 張影片卡...\n");
    await grantTickets(TEST_USER_ID, {
      videoUnlockCards: 5,
    });
    console.log("✓ VVIP 影片卡發放成功\n");

    // 6. 檢查最終狀態
    console.log("6️⃣ 檢查最終影片卡數量...\n");
    const vvipStats = await getVideoStats(TEST_USER_ID);
    console.log(`最終影片卡: ${vvipStats.cards} 張`);
    console.log(`剩餘次數: ${vvipStats.remaining}`);
    console.log(`是否可生成: ${vvipStats.remaining > 0 ? "是" : "否"}\n`);

    console.log("========================================");
    console.log("✅ 測試完成！");
    console.log("========================================\n");

    // 總結
    console.log("📊 測試總結:");
    console.log(`  初始: ${initialStats.cards} 張`);
    console.log(`  VIP 發放後: ${vipStats.cards} 張 (應該是 1 張)`);
    console.log(`  VVIP 發放後: ${vvipStats.cards} 張 (應該是 6 張)`);
    console.log("");

    // 驗證結果
    if (vipStats.cards === 1 && vvipStats.cards === 6) {
      console.log("✅ 所有測試通過！影片卡片發放正確。\n");
    } else {
      console.log("❌ 測試失敗！影片卡片數量不符合預期。");
      console.log(`   VIP 預期: 1 張，實際: ${vipStats.cards} 張`);
      console.log(`   VVIP 預期: 6 張，實際: ${vvipStats.cards} 張\n`);
    }

  } catch (error) {
    console.error("\n❌ 測試失敗:", error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

// 執行測試
testGrantVideoTickets();
