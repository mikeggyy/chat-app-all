import "dotenv/config";
import { db } from "./src/firebase/index.js";

async function testCharacterLookup() {
  try {
    console.log("=== 檢查對話數據 ===");

    // 獲取前 3 個對話
    const conversationsSnapshot = await db
      .collection("conversations")
      .limit(3)
      .get();

    console.log(`找到 ${conversationsSnapshot.size} 個對話\n`);

    for (const doc of conversationsSnapshot.docs) {
      const data = doc.data();
      console.log(`對話 ID: ${doc.id}`);
      console.log(`  userId: ${data.userId}`);
      console.log(`  characterId: ${data.characterId}`);
      console.log(`  messages 數量: ${Array.isArray(data.messages) ? data.messages.length : 0}`);

      // 嘗試查找角色
      if (data.characterId) {
        try {
          const characterDoc = await db
            .collection("characters")
            .doc(data.characterId)
            .get();

          if (characterDoc.exists) {
            const characterData = characterDoc.data();
            console.log(`  ✓ 找到角色: ${characterData.name || "(無名稱)"}`);
            console.log(`    角色數據:`, {
              id: characterDoc.id,
              name: characterData.name,
              status: characterData.status,
              isPublic: characterData.isPublic
            });
          } else {
            console.log(`  ✗ 找不到角色文檔: ${data.characterId}`);
          }
        } catch (error) {
          console.log(`  ✗ 查找角色時出錯:`, error.message);
        }
      } else {
        console.log(`  ✗ 對話沒有 characterId 欄位`);
      }
      console.log("");
    }

    // 檢查 characters 集合
    console.log("\n=== 檢查角色數據 ===");
    const charactersSnapshot = await db
      .collection("characters")
      .limit(5)
      .get();

    console.log(`找到 ${charactersSnapshot.size} 個角色\n`);

    for (const doc of charactersSnapshot.docs) {
      const data = doc.data();
      console.log(`角色 ID: ${doc.id}`);
      console.log(`  完整數據:`, JSON.stringify(data, null, 2));
      console.log("");
    }

  } catch (error) {
    console.error("測試失敗:", error);
  } finally {
    process.exit(0);
  }
}

testCharacterLookup();
