import "dotenv/config";
import { getFirestoreDb } from "../src/firebase/index.js";

/**
 * 初始化所有用戶的 assets 欄位
 *
 * 這個腳本會：
 * 1. 掃描 users 集合中的所有用戶
 * 2. 為沒有 assets 欄位的用戶添加預設的 assets 結構
 * 3. 為測試用戶添加一些測試資產
 */

async function initUserAssets() {
  try {
    console.log("\n=== 開始初始化用戶資產 ===\n");

    const db = getFirestoreDb();
    const usersRef = db.collection("users");
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
      console.log("⚠️  沒有找到任何用戶");
      return;
    }

    console.log(`找到 ${snapshot.size} 個用戶，開始處理...\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    // 預設的 assets 結構
    const defaultAssets = {
      characterUnlockCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,
      voiceUnlockCards: 0,
      createCards: 0,
      gifts: {
        rose: 0,
        chocolate: 0,
        cake: 0,
        teddy: 0,
        ring: 0,
        diamond: 0,
        crown: 0,
      },
    };

    // 測試用戶的資產（給他們一些卡片方便測試）
    const testAssets = {
      characterUnlockCards: 5,
      photoUnlockCards: 10,
      videoUnlockCards: 3,
      voiceUnlockCards: 20,
      createCards: 2,
      gifts: {
        rose: 2,
        chocolate: 1,
        cake: 1,
        teddy: 1,
        ring: 0,
        diamond: 0,
        crown: 0,
      },
    };

    for (const doc of snapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();
      const displayName = userData.displayName || "未知用戶";

      // 檢查是否已有 assets 欄位
      if (userData.assets && typeof userData.assets === "object") {
        console.log(`✓ ${displayName} (${userId}) - 已有 assets 欄位，跳過`);
        skippedCount++;
        continue;
      }

      // 判斷是否是測試用戶
      const isTestUser =
        userId.startsWith("test-") ||
        displayName.includes("測試") ||
        displayName.includes("Test");

      const assetsToSet = isTestUser ? testAssets : defaultAssets;

      // 更新用戶的 assets 欄位
      await doc.ref.update({
        assets: assetsToSet,
        updatedAt: new Date().toISOString(),
      });

      console.log(
        `✓ ${displayName} (${userId}) - ${
          isTestUser ? "已設置測試資產" : "已設置預設資產"
        }`
      );
      updatedCount++;
    }

    console.log(`\n=== 完成 ===`);
    console.log(`已更新: ${updatedCount} 個用戶`);
    console.log(`已跳過: ${skippedCount} 個用戶`);
    console.log(`\n✅ 用戶資產初始化完成！\n`);
  } catch (error) {
    console.error("\n❌ 初始化失敗:", error);
    process.exit(1);
  }
}

// 執行初始化
initUserAssets()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("執行失敗:", error);
    process.exit(1);
  });
