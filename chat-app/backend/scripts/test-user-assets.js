import "dotenv/config";
import { getUserById } from "../src/user/user.service.js";
import { getUserAssets, setUserAssets } from "../src/user/assets.service.js";

/**
 * 測試用戶資產 API
 * 這個腳本用於檢查用戶資產數據是否正確載入和返回
 */

const testUserId = process.argv[2];

if (!testUserId) {
  console.error("請提供用戶 ID：node test-user-assets.js <userId>");
  process.exit(1);
}

async function testUserAssets() {
  try {
    console.log(`\n=== 測試用戶 ${testUserId} 的資產數據 ===\n`);

    // 1. 獲取用戶資料
    console.log("1. 獲取用戶資料...");
    const user = await getUserById(testUserId);

    if (!user) {
      console.error(`❌ 找不到用戶 ${testUserId}`);
      process.exit(1);
    }

    console.log("✅ 用戶資料：");
    console.log("   - displayName:", user.displayName);
    console.log("   - email:", user.email);
    console.log("   - assets 欄位:", user.assets ? "存在" : "不存在");

    if (user.assets) {
      console.log("   - assets 內容:", JSON.stringify(user.assets, null, 2));
    }

    // 2. 獲取用戶資產
    console.log("\n2. 通過 getUserAssets 獲取資產...");
    const assets = await getUserAssets(testUserId);
    console.log("✅ 返回的資產數據:");
    console.log(JSON.stringify(assets, null, 2));

    // 3. 檢查是否所有欄位都是 0
    const allZero =
      assets.characterUnlockCards === 0 &&
      assets.photoUnlockCards === 0 &&
      assets.videoUnlockCards === 0 &&
      assets.voiceUnlockCards === 0 &&
      assets.createCards === 0;

    if (allZero) {
      console.log("\n⚠️  警告：所有資產數量都是 0！");
      console.log("這可能是因為：");
      console.log("  1. 資料庫中沒有 assets 欄位");
      console.log("  2. 用戶確實沒有任何資產");

      // 4. 提供設置測試資料的選項
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question("\n是否要為此用戶添加測試資產？(y/n): ", async (answer) => {
        if (answer.toLowerCase() === "y") {
          console.log("\n3. 設置測試資產...");
          const testAssets = {
            characterUnlockCards: 5,
            photoUnlockCards: 10,
            videoUnlockCards: 3,
            voiceUnlockCards: 20,
            createCards: 2,
            gifts: {
              rose: 1,
              chocolate: 2,
              cake: 0,
              teddy: 1,
              ring: 0,
              diamond: 0,
              crown: 0,
            },
          };

          const updatedAssets = await setUserAssets(testUserId, testAssets);
          console.log("✅ 已設置測試資產:");
          console.log(JSON.stringify(updatedAssets, null, 2));

          console.log("\n✅ 完成！請刷新前端頁面查看效果。");
        } else {
          console.log("\n跳過設置測試資產。");
        }
        rl.close();
        process.exit(0);
      });
    } else {
      console.log("\n✅ 用戶有資產數據！");
      process.exit(0);
    }
  } catch (error) {
    console.error("\n❌ 測試失敗:", error);
    process.exit(1);
  }
}

testUserAssets();
