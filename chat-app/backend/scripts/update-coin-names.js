/**
 * 更新金幣套餐名稱：金幣 -> 金幣卡
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();

async function updateCoinNames() {
  console.log("🌱 開始更新金幣套餐名稱...\n");

  const snapshot = await db.collection("coin_packages").get();
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // 檢查名稱中是否包含 "金幣"
    if (data.name && data.name.includes("金幣") && !data.name.includes("金幣卡")) {
      const newName = data.name.replace(/金幣/g, "金幣卡");

      await db.collection("coin_packages").doc(doc.id).update({
        name: newName,
        updatedAt: new Date().toISOString()
      });

      console.log(`   ✓ ${data.name} → ${newName}`);
      updatedCount++;
    }
  }

  console.log(`\n✅ 已更新 ${updatedCount} 個金幣套餐名稱`);
  console.log("\n💡 查看 Firestore UI:");
  console.log("   http://localhost:4101/firestore\n");

  process.exit(0);
}

updateCoinNames().catch((error) => {
  console.error("❌ 更新失敗:", error);
  process.exit(1);
});
