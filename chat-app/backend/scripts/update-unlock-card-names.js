/**
 * 更新解鎖卡名稱：加上分類前綴
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();

// 分類名稱對應
const CATEGORY_NAMES = {
  'character-unlock': '角色解鎖票',
  'photo-unlock': '拍照卡',
  'video-unlock': '影片卡',
  'voice-unlock': '語音解鎖卡',
  'create': '創建角色卡'
};

async function updateUnlockCardNames() {
  console.log("🌱 開始更新解鎖卡名稱...\n");

  const snapshot = await db.collection("unlock_cards").get();
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (data.category && data.name) {
      const categoryName = CATEGORY_NAMES[data.category];

      if (categoryName) {
        // 檢查名稱是否已經包含分類前綴
        if (!data.name.startsWith(categoryName)) {
          const newName = `${categoryName} ${data.name}`;

          await db.collection("unlock_cards").doc(doc.id).update({
            name: newName,
            updatedAt: new Date().toISOString()
          });

          console.log(`   ✓ ${data.name} → ${newName}`);
          updatedCount++;
        }
      }
    }
  }

  console.log(`\n✅ 已更新 ${updatedCount} 個解鎖卡名稱`);

  // 驗證結果
  console.log("\n🔍 驗證更新結果...");
  const verifySnapshot = await db.collection("unlock_cards").get();

  const byCategory = {};
  verifySnapshot.forEach(doc => {
    const category = doc.data().category;
    byCategory[category] = (byCategory[category] || 0) + 1;
  });

  console.log("\n📊 各分類統計:");
  Object.entries(byCategory).forEach(([category, count]) => {
    const categoryName = CATEGORY_NAMES[category] || category;
    console.log(`   - ${categoryName}: ${count} 個`);
  });

  console.log("\n💡 查看 Firestore UI:");
  console.log("   http://localhost:4101/firestore\n");

  process.exit(0);
}

updateUnlockCardNames().catch((error) => {
  console.error("❌ 更新失敗:", error);
  process.exit(1);
});
