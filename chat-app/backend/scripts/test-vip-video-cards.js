/**
 * 測試 VIP/VVIP 升級時發放影片生成卡功能
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { upgradeMembership } from "../src/membership/membership.service.js";
import { getVideoStats } from "../src/ai/videoLimit.service.js";
import { getUserById, upsertUser } from "../src/user/user.service.js";

const TEST_USER_ID = "test-vip-user-456";

async function testVIPVideoCards() {
  console.log("\n========================================");
  console.log("🎥 VIP 會員影片生成卡發放測試");
  console.log("========================================\n");

  try {
    // 1. 創建測試用戶（免費會員）
    console.log("1️⃣ 創建測試用戶（免費會員）...\n");
    await upsertUser({
      id: TEST_USER_ID,
      userId: TEST_USER_ID,
      email: "test-vip@example.com",
      displayName: "VIP 測試用戶",
      membershipTier: "free",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log("✓ 用戶創建成功\n");

    // 2. 檢查初始影片生成統計（免費用戶）
    console.log("2️⃣ 檢查初始影片生成統計（免費用戶）...\n");
    const freeStats = await getVideoStats(TEST_USER_ID);
    console.log("免費會員統計:");
    console.log(`  - 會員等級: ${freeStats.tier}`);
    console.log(`  - 影片卡片: ${freeStats.cards} 張`);
    console.log(`  - 影片限制: ${freeStats.standardVideosLimit}`);
    console.log(`  - 剩餘次數: ${freeStats.remaining}\n`);

    // 3. 升級為 VIP
    console.log("3️⃣ 升級為 VIP...\n");
    const vipMembership = await upgradeMembership(TEST_USER_ID, "vip", {
      durationMonths: 1,
      autoRenew: false,
    });
    console.log("✓ 升級成功！");
    console.log(`  - 新等級: ${vipMembership.tier}`);
    console.log(`  - 狀態: ${vipMembership.status}`);
    console.log(`  - 到期日: ${vipMembership.expiresAt}\n`);

    // 4. 檢查升級後的影片生成統計（VIP）
    console.log("4️⃣ 檢查升級後的影片生成統計（VIP）...\n");
    const vipStats = await getVideoStats(TEST_USER_ID);
    console.log("VIP 會員統計:");
    console.log(`  - 會員等級: ${vipStats.tier}`);
    console.log(`  - 影片卡片: ${vipStats.cards} 張`);
    console.log(`  - 影片限制: ${vipStats.standardVideosLimit}`);
    console.log(`  - 剩餘次數: ${vipStats.remaining}`);
    console.log(`  - 是否可生成: ${vipStats.remaining > 0 ? "是" : "否"}\n`);

    // 5. 測試從 VIP 升級到 VVIP
    console.log("5️⃣ 從 VIP 升級到 VVIP...\n");
    const vvipMembership = await upgradeMembership(TEST_USER_ID, "vvip", {
      durationMonths: 1,
      autoRenew: false,
    });
    console.log("✓ 升級成功！");
    console.log(`  - 新等級: ${vvipMembership.tier}\n`);

    // 6. 檢查升級後的影片生成統計（VVIP）
    console.log("6️⃣ 檢查升級後的影片生成統計（VVIP）...\n");
    const vvipStats = await getVideoStats(TEST_USER_ID);
    console.log("VVIP 會員統計:");
    console.log(`  - 會員等級: ${vvipStats.tier}`);
    console.log(`  - 影片卡片: ${vvipStats.cards} 張`);
    console.log(`  - 影片限制: ${vvipStats.standardVideosLimit}`);
    console.log(`  - 剩餘次數: ${vvipStats.remaining}`);
    console.log(`  - 是否可生成: ${vvipStats.remaining > 0 ? "是" : "否"}\n`);

    console.log("========================================");
    console.log("✅ 測試完成！");
    console.log("========================================\n");

    // 總結
    console.log("📊 測試總結:");
    console.log(`  免費會員: ${freeStats.cards} 張影片卡`);
    console.log(`  VIP 會員: ${vipStats.cards} 張影片卡 (應該是 1 張)`);
    console.log(`  VVIP 會員: ${vvipStats.cards} 張影片卡 (應該是 1 + 5 = 6 張)`);
    console.log("");

    // 驗證結果
    const vipExpected = 1;
    const vvipExpected = 6; // VIP 的 1 張 + VVIP 的 5 張

    if (vipStats.cards === vipExpected && vvipStats.cards === vvipExpected) {
      console.log("✅ 所有測試通過！影片卡片發放正確。\n");
    } else {
      console.log("❌ 測試失敗！影片卡片數量不符合預期。");
      console.log(`   VIP 預期: ${vipExpected} 張，實際: ${vipStats.cards} 張`);
      console.log(`   VVIP 預期: ${vvipExpected} 張，實際: ${vvipStats.cards} 張\n`);
    }

  } catch (error) {
    console.error("\n❌ 測試失敗:", error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

// 執行測試
testVIPVideoCards();
