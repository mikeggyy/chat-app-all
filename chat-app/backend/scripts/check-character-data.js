import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import logger from "../src/utils/logger.js";

/**
 * 檢查指定角色的完整數據
 * 用於診斷角色詳情頁面缺少數據的問題
 */
async function checkCharacterData(characterId) {
  try {
    const db = getFirestoreDb();

    console.log(`\n📋 檢查角色數據: ${characterId}\n`);
    console.log("=".repeat(60));

    // 從 Firestore 讀取角色數據
    const doc = await db.collection("characters").doc(characterId).get();

    if (!doc.exists) {
      console.log(`❌ 角色不存在: ${characterId}`);
      return;
    }

    const data = doc.data();

    // 顯示基本信息
    console.log("\n📌 基本信息:");
    console.log(`  ID: ${doc.id}`);
    console.log(`  姓名: ${data.display_name || "未設定"}`);
    console.log(`  性別: ${data.gender || "未設定"}`);
    console.log(`  語音: ${typeof data.voice === 'object' ? JSON.stringify(data.voice) : (data.voice || "未設定")}`);
    console.log(`  狀態: ${data.status || "未設定"}`);
    console.log(`  公開: ${data.isPublic}`);

    // 顯示圖片
    console.log("\n🖼️  圖片:");
    console.log(`  頭像 URL: ${data.portraitUrl ? "✅ 已設定" : "❌ 未設定"}`);
    if (data.portraitUrl) {
      console.log(`  URL: ${data.portraitUrl.substring(0, 80)}...`);
    }

    // 顯示詳細設定（這些是可能缺少的字段）
    console.log("\n📝 詳細設定:");
    console.log(`  背景設定 (background):`);
    if (data.background) {
      console.log(`    ✅ 已設定 (${data.background.length} 字)`);
      console.log(`    內容: ${data.background.substring(0, 100)}${data.background.length > 100 ? "..." : ""}`);
    } else {
      console.log(`    ❌ 未設定或為空`);
    }

    console.log(`\n  隱藏設定 (secret_background):`);
    if (data.secret_background) {
      console.log(`    ✅ 已設定 (${data.secret_background.length} 字)`);
      console.log(`    內容: ${data.secret_background.substring(0, 100)}${data.secret_background.length > 100 ? "..." : ""}`);
    } else {
      console.log(`    ❌ 未設定或為空`);
    }

    console.log(`\n  開場白 (first_message):`);
    if (data.first_message) {
      console.log(`    ✅ 已設定 (${data.first_message.length} 字)`);
      console.log(`    內容: ${data.first_message.substring(0, 100)}${data.first_message.length > 100 ? "..." : ""}`);
    } else {
      console.log(`    ❌ 未設定或為空`);
    }

    console.log(`\n  外觀描述 (appearanceDescription):`);
    if (data.appearanceDescription) {
      console.log(`    ✅ 已設定 (${data.appearanceDescription.length} 字)`);
      console.log(`    內容: ${data.appearanceDescription.substring(0, 100)}${data.appearanceDescription.length > 100 ? "..." : ""}`);
    } else {
      console.log(`    ❌ 未設定或為空`);
    }

    // 顯示其他信息
    console.log("\n🎨 風格和標籤:");
    console.log(`  風格 (styles): ${Array.isArray(data.styles) && data.styles.length > 0 ? data.styles.join(", ") : "未設定"}`);
    console.log(`  標籤 (tags): ${Array.isArray(data.tags) && data.tags.length > 0 ? data.tags.join(", ") : "未設定"}`);

    console.log("\n📊 統計:");
    console.log(`  聊天用戶數: ${data.totalChatUsers || 0}`);
    console.log(`  收藏數: ${data.totalFavorites || 0}`);

    console.log("\n⏰ 時間:");
    console.log(`  創建時間: ${data.createdAt || "未設定"}`);
    console.log(`  更新時間: ${data.updatedAt || "未設定"}`);

    console.log("\n" + "=".repeat(60));

    // 診斷建議
    console.log("\n💡 診斷建議:");
    const missingFields = [];
    if (!data.background) missingFields.push("背景設定 (background)");
    if (!data.secret_background) missingFields.push("隱藏設定 (secret_background)");
    if (!data.first_message) missingFields.push("開場白 (first_message)");

    if (missingFields.length > 0) {
      console.log(`\n⚠️  發現缺少以下字段:`);
      missingFields.forEach(field => console.log(`   - ${field}`));
      console.log(`\n📝 這些字段在角色創建時可能沒有填寫。`);
      console.log(`   前端的角色詳情頁面使用 v-if 條件渲染，`);
      console.log(`   所以這些區塊不會顯示。`);
      console.log(`\n✅ 解決方案:`);
      console.log(`   1. 使用管理後臺編輯角色，補充這些字段`);
      console.log(`   2. 或直接在 Firestore Console 中編輯`);
      console.log(`   3. 或在角色創建流程中確保這些字段被填寫`);
    } else {
      console.log(`\n✅ 所有主要字段都已設定！`);
      console.log(`   如果前端仍然不顯示，請檢查：`);
      console.log(`   1. 前端 API 調用是否成功`);
      console.log(`   2. 瀏覽器控制台是否有錯誤`);
      console.log(`   3. 角色緩存是否需要重新加載`);
    }

    console.log("\n");

  } catch (error) {
    logger.error("檢查角色數據失敗:", error);
    console.error("\n❌ 錯誤:", error.message);
  }
}

// 從命令行參數獲取角色 ID
const characterId = process.argv[2];

if (!characterId) {
  console.log("\n使用方法:");
  console.log("  node check-character-data.js <character-id>");
  console.log("\n範例:");
  console.log("  node check-character-data.js match-1763545954300-rrzog6v");
  console.log("\n");
  process.exit(1);
}

checkCharacterData(characterId).then(() => {
  process.exit(0);
});
