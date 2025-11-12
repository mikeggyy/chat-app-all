/**
 * 導入解鎖卡配置到 Firestore（統一格式 - 多 SKU）
 * 為每個商品類型生成多個不同數量和價格的方案
 */

import "dotenv/config";
// import "../src/setup-emulator.js"; // 註釋掉以連接生產環境
import { getFirestoreDb } from "../src/firebase/index.js";
import { ASSET_CARDS_BASE_CONFIG } from "../../shared/config/assets.js";

const db = getFirestoreDb();

// 套餐配置（數量、折扣、標籤）- 5 種方案
const PACKAGE_CONFIGS = {
  "character-unlock": [
    { quantity: 1, discount: 1.0, popular: false, badge: null },
    { quantity: 3, discount: 0.95, popular: false, badge: "9.5折" },
    { quantity: 5, discount: 0.9, popular: true, badge: "熱門 9折" },
    { quantity: 10, discount: 0.85, popular: false, badge: "8.5折" },
    { quantity: 20, discount: 0.8, popular: false, badge: "超值 8折" },
  ],
  "photo-unlock": [
    { quantity: 1, discount: 1.0, popular: false, badge: null },
    { quantity: 10, discount: 0.95, popular: false, badge: "9.5折" },
    { quantity: 30, discount: 0.9, popular: true, badge: "熱門 9折" },
    { quantity: 50, discount: 0.85, popular: false, badge: "8.5折" },
    { quantity: 100, discount: 0.8, popular: false, badge: "超值 8折" },
  ],
  "video-unlock": [
    { quantity: 1, discount: 1.0, popular: false, badge: null },
    { quantity: 3, discount: 0.95, popular: false, badge: "9.5折" },
    { quantity: 5, discount: 0.9, popular: true, badge: "熱門 9折" },
    { quantity: 10, discount: 0.85, popular: false, badge: "8.5折" },
    { quantity: 20, discount: 0.8, popular: false, badge: "超值 8折" },
  ],
  "voice-unlock": [
    { quantity: 1, discount: 1.0, popular: false, badge: null },
    { quantity: 20, discount: 0.95, popular: false, badge: "9.5折" },
    { quantity: 50, discount: 0.9, popular: true, badge: "熱門 9折" },
    { quantity: 100, discount: 0.85, popular: false, badge: "8.5折" },
    { quantity: 200, discount: 0.8, popular: false, badge: "超值 8折" },
  ],
  "create": [
    { quantity: 1, discount: 1.0, popular: false, badge: null },
    { quantity: 3, discount: 0.95, popular: false, badge: "9.5折" },
    { quantity: 5, discount: 0.9, popular: true, badge: "熱門 9折" },
    { quantity: 10, discount: 0.85, popular: false, badge: "8.5折" },
    { quantity: 20, discount: 0.8, popular: false, badge: "超值 8折" },
  ],
};

// 基礎商品配置（根據成本分析調整價格）
const BASE_CARDS = [
  {
    baseId: "character_unlock",
    category: "character-unlock",
    name: "角色解鎖票",
    description: ASSET_CARDS_BASE_CONFIG.CHARACTER_UNLOCK.description,
    icon: "🎭",
    basePrice: 400, // 高價值長期服務（成本低，利潤率 80%）
    quantityUnit: ASSET_CARDS_BASE_CONFIG.CHARACTER_UNLOCK.displayConfig.unit, // 張
  },
  {
    baseId: "photo_unlock",
    category: "photo-unlock",
    name: "拍照卡",
    description: ASSET_CARDS_BASE_CONFIG.PHOTO_UNLOCK.description,
    icon: "📸",
    basePrice: 40, // 低價頻繁服務（成本 1.5 TWD，利潤率 70%）
    quantityUnit: ASSET_CARDS_BASE_CONFIG.PHOTO_UNLOCK.displayConfig.unit, // 張
  },
  {
    baseId: "video_unlock",
    category: "video-unlock",
    name: "影片卡",
    description: ASSET_CARDS_BASE_CONFIG.VIDEO_UNLOCK.description,
    icon: "🎬",
    basePrice: 200, // 高成本消耗服務（成本 3-9 TWD，利潤率 60%）
    quantityUnit: ASSET_CARDS_BASE_CONFIG.VIDEO_UNLOCK.displayConfig.unit, // 支
  },
  {
    baseId: "voice_unlock",
    category: "voice-unlock",
    name: "語音解鎖卡",
    description: ASSET_CARDS_BASE_CONFIG.VOICE_UNLOCK.description,
    icon: "🔊",
    basePrice: 25, // 極低成本高頻服務（成本 0.023 TWD，利潤率 90%）
    quantityUnit: ASSET_CARDS_BASE_CONFIG.VOICE_UNLOCK.displayConfig.unit, // 張
  },
  {
    baseId: "create_character",
    category: "create",
    name: "創建角色卡",
    description: ASSET_CARDS_BASE_CONFIG.CREATE_CHARACTER.description,
    icon: "✨",
    basePrice: 250, // 高價值稀缺服務（成本幾乎為 0，利潤率 85%）
    quantityUnit: ASSET_CARDS_BASE_CONFIG.CREATE_CHARACTER.displayConfig.unit, // 張
  },
];

// 生成所有 SKU
function generateSKUs() {
  const skus = [];

  BASE_CARDS.forEach((card) => {
    const packages = PACKAGE_CONFIGS[card.category] || [];
    let categoryOrder = 1; // 每個分類內重新計數

    packages.forEach((pkg) => {
      const totalPrice = card.basePrice * pkg.quantity;
      const finalPrice = Math.round(totalPrice * pkg.discount);
      const originalPrice = pkg.discount < 1 ? totalPrice : null;

      skus.push({
        // ID 格式: {baseId}_{quantity}
        id: `${card.baseId}_${pkg.quantity}`,

        // 基礎資訊
        baseId: card.baseId,
        category: card.category,
        name: card.name,
        displayName: `${card.name} ${pkg.quantity} ${card.quantityUnit}`,
        description: card.description,
        icon: card.icon,

        // 統一價格結構
        priceType: "coins",
        unitPrice: finalPrice, // 最終價格（已折扣）
        currency: null,

        // 數量資訊
        quantity: pkg.quantity, // 此 SKU 包含的數量
        quantityUnit: card.quantityUnit,

        // 價格資訊
        basePrice: card.basePrice, // 單價
        originalPrice: originalPrice, // 原價（未折扣前的總價）
        discount: pkg.discount, // 折扣率

        // 顯示設定
        badge: pkg.badge,
        popular: pkg.popular,
        status: "active",
        order: categoryOrder++, // 在分類內的順序（1, 2, 3...）
      });
    });
  });

  return skus;
}

const UNLOCK_CARD_SKUS = generateSKUs();

async function importUnlockCards() {
  console.log("🌱 開始導入解鎖卡配置到 Firestore（多 SKU 統一格式）...\n");

  const now = new Date().toISOString();

  for (const sku of UNLOCK_CARD_SKUS) {
    const skuData = {
      ...sku,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("unlock_cards").doc(sku.id).set(skuData);

    // 顯示價格資訊（包含折扣）
    const priceDisplay = sku.originalPrice
      ? `${sku.unitPrice} 金幣 (原價 ${sku.originalPrice} 金幣)`
      : `${sku.unitPrice} 金幣`;

    console.log(`   ✓ ${sku.displayName} - ${priceDisplay} ${sku.badge ? `[${sku.badge}]` : ''}`);
  }

  console.log(`\n✅ 已導入 ${UNLOCK_CARD_SKUS.length} 個解鎖卡 SKU\n`);

  // 驗證導入結果
  console.log("🔍 驗證導入結果...");
  const snapshot = await db.collection("unlock_cards").get();

  // 按分類統計
  const categories = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    if (!categories[data.category]) {
      categories[data.category] = [];
    }
    categories[data.category].push(data);
  });

  console.log("\n📊 各類解鎖卡 SKU:");
  Object.entries(categories).forEach(([category, skus]) => {
    console.log(`\n   ${category} (${skus.length} 個 SKU):`);
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

importUnlockCards().catch((error) => {
  console.error("❌ 導入失敗:", error);
  process.exit(1);
});
