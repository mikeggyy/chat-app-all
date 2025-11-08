/**
 * 導入禮物配置到 Firestore（統一格式）
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import { GIFTS } from "../../shared/config/gifts.js";

const db = getFirestoreDb();

async function importGifts() {
  console.log("🌱 開始導入禮物配置到 Firestore（統一格式）...\n");

  const now = new Date().toISOString();
  const gifts = Object.values(GIFTS);

  // 排序映射
  const order = {};
  gifts.forEach((gift, index) => {
    order[gift.id] = index + 1;
  });

  for (const gift of gifts) {
    const giftData = {
      ...gift,

      // 統一欄位
      icon: gift.emoji,
      priceType: "coins",
      unitPrice: gift.price,
      currency: null,

      // 數量設定
      defaultQuantity: 1,
      minQuantity: 1,
      maxQuantity: 99,
      quantityUnit: "個",

      // 顯示設定
      order: order[gift.id],
      badge: null,
      popular: false,
      status: "active",

      // 時間戳
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("gifts").doc(gift.id).set(giftData);
    console.log(`   ✓ ${gift.name} - 單價: ${giftData.unitPrice} 金幣 (${gift.rarity})`);
  }

  console.log(`\n✅ 已導入 ${gifts.length} 個禮物\n`);

  // 驗證導入結果
  console.log("🔍 驗證導入結果...");
  const snapshot = await db.collection("gifts").get();

  console.log("\n📊 按稀有度統計:");
  const rarityCount = {};
  snapshot.forEach(doc => {
    const rarity = doc.data().rarity;
    rarityCount[rarity] = (rarityCount[rarity] || 0) + 1;
  });

  Object.entries(rarityCount).forEach(([rarity, count]) => {
    console.log(`   - ${rarity}: ${count} 個`);
  });

  console.log("\n💡 查看 Firestore UI:");
  console.log("   http://localhost:4101/firestore\n");

  process.exit(0);
}

importGifts().catch((error) => {
  console.error("❌ 導入失敗:", error);
  process.exit(1);
});
