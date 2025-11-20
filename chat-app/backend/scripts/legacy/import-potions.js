/**
 * 導入道具配置到 Firestore（多 SKU 架構）
 */

import "dotenv/config";
// import "../../src/setup-emulator.js"; // 註釋掉以連接生產環境
import { getFirestoreDb } from "../../src/firebase/index.js";
import { POTIONS_BASE_CONFIG } from "../../../shared/config/potions.js";

const db = getFirestoreDb();

// 套餐配置（數量、折扣、標籤）- 5 種方案
const PACKAGE_CONFIGS = {
  "memory_boost": [
    { quantity: 1, discount: 1.0, popular: false, badge: null },
    { quantity: 3, discount: 0.95, popular: false, badge: "9.5折" },
    { quantity: 5, discount: 0.9, popular: true, badge: "熱門 9折" },
    { quantity: 10, discount: 0.85, popular: false, badge: "8.5折" },
    { quantity: 20, discount: 0.8, popular: false, badge: "超值 8折" },
  ],
  "brain_boost": [
    { quantity: 1, discount: 1.0, popular: false, badge: null },
    { quantity: 3, discount: 0.95, popular: false, badge: "9.5折" },
    { quantity: 5, discount: 0.9, popular: true, badge: "熱門 9折" },
    { quantity: 10, discount: 0.85, popular: false, badge: "8.5折" },
    { quantity: 20, discount: 0.8, popular: false, badge: "超值 8折" },
  ],
};

// Emoji 映射表
const POTION_EMOJIS = {
  "memory_boost": "🧠",  // 記憶增強藥水 - 大腦
  "brain_boost": "⚡",    // 腦力激盪藥水 - 閃電
};

// 生成所有 SKU
function generatePotionSKUs() {
  const skus = [];
  const potions = Object.values(POTIONS_BASE_CONFIG);

  potions.forEach((potion, index) => {
    const packages = PACKAGE_CONFIGS[potion.id] || [];
    let categoryOrder = 1;

    packages.forEach((pkg) => {
      const totalPrice = potion.price * pkg.quantity;
      const finalPrice = Math.round(totalPrice * pkg.discount);
      const originalPrice = pkg.discount < 1 ? totalPrice : null;

      skus.push({
        id: `${potion.id}_${pkg.quantity}`,
        baseId: potion.id,
        name: potion.name,
        displayName: `${potion.name} ${pkg.quantity} 個`,
        description: potion.description,
        icon: POTION_EMOJIS[potion.id] || "🧪",
        priceType: "coins",
        unitPrice: finalPrice,
        currency: null,
        quantity: pkg.quantity,
        quantityUnit: "個",
        basePrice: potion.price,
        originalPrice: originalPrice,
        discount: pkg.discount,
        duration: potion.duration,
        effect: potion.effect,
        restrictedTiers: potion.restrictedTiers || [],
        restrictedMessage: potion.restrictedMessage || "",
        badge: pkg.badge,
        popular: pkg.popular,
        status: "active",
        order: (index * 100) + categoryOrder++,
      });
    });
  });

  return skus;
}

async function importPotions() {
  console.log("🌱 開始導入道具配置到 Firestore（多 SKU 統一格式）...\n");

  const potionSKUs = generatePotionSKUs();
  const now = new Date().toISOString();

  for (const sku of potionSKUs) {
    const skuData = {
      ...sku,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("potions").doc(sku.id).set(skuData);

    const priceDisplay = sku.originalPrice
      ? `${sku.unitPrice} 金幣 (原價 ${sku.originalPrice} 金幣)`
      : `${sku.unitPrice} 金幣`;

    console.log(`   ✓ ${sku.displayName} - ${priceDisplay} ${sku.badge ? `[${sku.badge}]` : ''}`);
  }

  console.log(`\n✅ 已導入 ${potionSKUs.length} 個道具 SKU\n`);

  console.log("🔍 驗證導入結果...");
  const snapshot = await db.collection("potions").get();

  const categories = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    const baseId = data.baseId || data.id.split('_')[0] + '_' + data.id.split('_')[1];
    if (!categories[baseId]) {
      categories[baseId] = [];
    }
    categories[baseId].push(data);
  });

  console.log("\n📊 各類道具 SKU:");
  Object.entries(categories).forEach(([baseId, skus]) => {
    console.log(`\n   ${baseId} (${skus.length} 個 SKU):`);
    skus.sort((a, b) => (a.order || 0) - (b.order || 0));
    skus.forEach(sku => {
      const priceDisplay = sku.originalPrice
        ? `${sku.unitPrice} 金幣 (原價 ${sku.originalPrice})`
        : `${sku.unitPrice} 金幣`;
      console.log(`     - ${sku.displayName}: ${priceDisplay} ${sku.badge ? `[${sku.badge}]` : ''}`);
    });
  });

  console.log("\n💡 查看 Firestore UI:");
  console.log("   http://localhost:4101/firestore\n");

  process.exit(0);
}

importPotions().catch((error) => {
  console.error("❌ 導入失敗:", error);
  process.exit(1);
});
