/**
 * 測試實際用戶的影片生成權限
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { canGenerateVideo } from "../src/ai/videoLimit.service.js";

const ACTUAL_USER_ID = "PS7LYFSstdgyr7b9sCOKFgt3QVB3";

async function testActualUserVideo() {
  console.log("\n========================================");
  console.log("🎥 測試實際用戶影片生成權限");
  console.log("========================================\n");

  try {
    console.log(`用戶 ID: ${ACTUAL_USER_ID}\n`);

    // 檢查是否可以生成影片
    console.log("檢查影片生成權限...\n");
    const canGenerate = await canGenerateVideo(ACTUAL_USER_ID);

    console.log("\n========================================");
    console.log("✅ API 返回結果:");
    console.log("========================================");
    console.log(JSON.stringify(canGenerate, null, 2));

    console.log("\n========================================");
    console.log("📊 關鍵欄位檢查:");
    console.log("========================================");
    console.log(`  allowed: ${canGenerate.allowed}`);
    console.log(`  videoCards: ${canGenerate.videoCards}`);
    console.log(`  canGenerate: ${canGenerate.canGenerate}`);
    console.log(`  canPurchaseCard: ${canGenerate.canPurchaseCard}`);
    console.log(`  tier: ${canGenerate.tier}`);

    if (canGenerate.videoCards > 0) {
      console.log("\n✅ 用戶有影片卡，前端應該顯示彈窗詢問是否使用！");
    } else {
      console.log("\n⚠️  用戶沒有影片卡，前端應該顯示購買提示！");
    }

  } catch (error) {
    console.error("\n❌ 測試失敗:", error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testActualUserVideo();
