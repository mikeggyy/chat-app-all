/**
 * 清理所有商品數據（僅刪除,不導入）
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();

async function cleanCollection(collectionName) {
  console.log(`🗑️  清理集合: ${collectionName}`);
  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    console.log(`   ⚠️  集合為空,跳過\n`);
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`   ✓ 已刪除 ${snapshot.size} 個文檔\n`);
}

async function main() {
  console.log("🧹 開始清理所有商品集合...\n");

  // 清理所有商品集合
  await cleanCollection("unlock_cards");
  await cleanCollection("coin_packages");
  await cleanCollection("potions");
  await cleanCollection("gifts");

  console.log("✅ 清理完成！");
  console.log("\n💡 接下來請依序執行導入腳本:");
  console.log("   npm run import:unlock-cards");
  console.log("   npm run import:coin-packages");
  console.log("   npm run import:potions");
  console.log("   npm run import:gifts");
  console.log("\n或執行:");
  console.log("   npm run import:all\n");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ 錯誤:", error);
  process.exit(1);
});
