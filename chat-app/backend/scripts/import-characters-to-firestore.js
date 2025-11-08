import "dotenv/config";
import { getFirestoreDb } from "../src/firebase/index.js";
import { aiMatches } from "../src/match/match.data.js";

async function importCharacters() {
  console.log("🌱 開始將 AI 角色導入 Firestore...\n");

  try {
    const db = getFirestoreDb();

    console.log(`📊 總共有 ${aiMatches.length} 個 AI 角色\n`);

    // 使用 batch 批量寫入
    const batch = db.batch();

    aiMatches.forEach(character => {
      const ref = db.collection("characters").doc(character.id);

      // 準備數據
      const data = {
        ...character,
        // 確保必要字段
        tags: character.tags || [],
        plot_hooks: character.plot_hooks || [],
        status: "active",
        isPublic: true,
        // 時間戳會在提交時自動設置
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      batch.set(ref, data);
      console.log(`✓ 準備角色: ${character.display_name} (${character.id})`);
    });

    // 提交批量寫入
    console.log("\n📤 正在提交到 Firestore...");
    await batch.commit();
    console.log("✅ 批量寫入成功！\n");

    // 驗證
    console.log("🔍 驗證寫入結果...");
    const snapshot = await db.collection("characters").get();
    console.log(`✅ characters 集合中共有 ${snapshot.size} 個文檔\n`);

    console.log("📋 已導入的角色:");
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`   - ${data.display_name} (ID: ${doc.id})`);
      console.log(`     性別: ${data.gender} | 語音: ${data.voice}`);
      console.log(`     背景: ${data.background.substring(0, 30)}...`);
    });

    console.log("\n🎉 角色數據導入成功！");
    console.log("\n💡 查看 Firestore UI:");
    console.log("   http://localhost:4101/firestore");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ 導入失敗:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

importCharacters();
