/**
 * 更新所有商品的時間戳
 * 為沒有 createdAt 和 updatedAt 的商品添加當前時間
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();

// 需要更新的集合列表
const COLLECTIONS = [
  'coin_packages',
  'gifts',
  'potions',
  'unlock_cards',
  'product_categories'
];

async function updateTimestamps() {
  console.log("🌱 開始更新商品時間戳...\n");

  const now = new Date().toISOString();
  let totalUpdated = 0;

  for (const collectionName of COLLECTIONS) {
    console.log(`📁 處理集合: ${collectionName}`);

    const snapshot = await db.collection(collectionName).get();
    let updatedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const updates = {};

      // 檢查是否缺少 createdAt
      if (!data.createdAt) {
        updates.createdAt = now;
      }

      // 檢查是否缺少 updatedAt
      if (!data.updatedAt) {
        updates.updatedAt = now;
      }

      // 如果有需要更新的字段
      if (Object.keys(updates).length > 0) {
        await db.collection(collectionName).doc(doc.id).update(updates);
        updatedCount++;
        console.log(`   ✓ 更新 ${doc.id}: ${Object.keys(updates).join(', ')}`);
      }
    }

    if (updatedCount === 0) {
      console.log(`   ✓ ${collectionName}: 所有文檔都已有時間戳`);
    } else {
      console.log(`   ✅ ${collectionName}: 更新了 ${updatedCount} 個文檔`);
    }

    totalUpdated += updatedCount;
    console.log();
  }

  console.log("🎉 時間戳更新完成！");
  console.log(`📊 總共更新了 ${totalUpdated} 個文檔\n`);

  console.log("💡 查看 Firestore UI:");
  console.log("   http://localhost:4101/firestore\n");

  process.exit(0);
}

updateTimestamps().catch((error) => {
  console.error("❌ 更新失敗:", error);
  process.exit(1);
});
