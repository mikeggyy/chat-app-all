/**
 * 測試影片生成次數限制功能
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import {
  canGenerateVideo,
  getVideoStats,
  recordVideoGeneration,
} from "../src/ai/videoLimit.service.js";

const TEST_USER_ID = "test-user-123";

async function testVideoLimits() {
  console.log("\n========================================");
  console.log("🎥 影片生成次數限制測試");
  console.log("========================================\n");

  try {
    // 1. 獲取初始統計
    console.log("1️⃣ 獲取初始影片生成統計...\n");
    const initialStats = await getVideoStats(TEST_USER_ID);
    console.log("初始統計:", JSON.stringify(initialStats, null, 2));

    // 2. 檢查是否可以生成影片
    console.log("\n2️⃣ 檢查影片生成權限...\n");
    const canGenerate = await canGenerateVideo(TEST_USER_ID);
    console.log("權限檢查結果:", JSON.stringify(canGenerate, null, 2));

    if (!canGenerate.canGenerate) {
      console.log("\n⚠️  無法生成影片，原因:", canGenerate.reason || canGenerate.message);
      console.log("   會員等級:", canGenerate.tier);
      console.log("   限制:", canGenerate.limit);
      return;
    }

    // 3. 記錄一次影片生成
    console.log("\n3️⃣ 記錄一次影片生成...\n");
    const recordResult = await recordVideoGeneration(TEST_USER_ID);
    console.log("記錄結果:", JSON.stringify(recordResult, null, 2));

    // 4. 再次獲取統計
    console.log("\n4️⃣ 獲取更新後的統計...\n");
    const updatedStats = await getVideoStats(TEST_USER_ID);
    console.log("更新後統計:", JSON.stringify(updatedStats, null, 2));

    // 5. 再次檢查權限
    console.log("\n5️⃣ 再次檢查影片生成權限...\n");
    const canGenerateAgain = await canGenerateVideo(TEST_USER_ID);
    console.log("權限檢查結果:", JSON.stringify(canGenerateAgain, null, 2));

    console.log("\n========================================");
    console.log("✅ 測試完成！");
    console.log("========================================\n");

    // 總結
    console.log("📊 測試總結:");
    console.log(`   會員等級: ${updatedStats.tier}`);
    console.log(`   影片限制: ${updatedStats.standardVideosLimit === 0 ? "無權限" : `${updatedStats.standardVideosLimit} 次/月`}`);
    console.log(`   已使用: ${updatedStats.used} 次`);
    console.log(`   剩餘: ${updatedStats.remaining === -1 ? "無限" : `${updatedStats.remaining} 次`}`);
    console.log(`   重置週期: ${updatedStats.resetPeriod}`);
    console.log(`   是否可生成: ${canGenerateAgain.canGenerate ? "是" : "否"}\n`);

  } catch (error) {
    console.error("\n❌ 測試失敗:", error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

// 執行測試
testVideoLimits();
