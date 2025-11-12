/**
 * 導入金幣套餐配置到 Firestore（統一格式）
 */

import "dotenv/config";
// import "../src/setup-emulator.js"; // 註釋掉以連接生產環境
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();

// 金幣套餐統一配置（5 種方案，對應 5 階梯折扣）
// 透過贈送金幣實現折扣效果：
// - 第 1 階：無贈送（100% 支付）
// - 第 2 階：贈送 5%（相當於 9.5 折）
// - 第 3 階：贈送 11%（相當於 9 折）- 熱門
// - 第 4 階：贈送 18%（相當於 8.5 折）
// - 第 5 階：贈送 25%（相當於 8 折）- 超值
const COIN_PACKAGES = [
  {
    id: "coins_100",
    name: "100 金幣卡",
    description: "購買金幣，用於商城內的各種消費",
    icon: "💰",

    // 統一價格結構
    priceType: "currency",
    unitPrice: 30,
    currency: "TWD",

    // 金幣內容（第 1 階：無贈送）
    coins: 100,        // 基礎金幣
    bonus: 0,          // 贈送金幣（0%）
    totalCoins: 100,   // 總金幣

    // 數量設定
    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 1,
    quantityUnit: "份",

    // 顯示設定
    badge: null,
    popular: false,
    bestValue: false,
    status: "active",
    order: 1,
  },
  {
    id: "coins_300",
    name: "300 金幣卡",
    description: "購買金幣，用於商城內的各種消費",
    icon: "💰",

    priceType: "currency",
    unitPrice: 90,
    currency: "TWD",

    // 第 2 階：贈送 5%（相當於 9.5 折）
    coins: 300,
    bonus: 15,         // 贈送 15 金幣（5%）
    totalCoins: 315,

    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 1,
    quantityUnit: "份",

    badge: "贈送 5%",
    popular: false,
    bestValue: false,
    status: "active",
    order: 2,
  },
  {
    id: "coins_1000",
    name: "1000 金幣卡",
    description: "購買金幣，用於商城內的各種消費",
    icon: "💰",

    priceType: "currency",
    unitPrice: 300,
    currency: "TWD",

    // 第 3 階：贈送 11%（相當於 9 折）- 熱門
    coins: 1000,
    bonus: 111,        // 贈送 111 金幣（11.1%）
    totalCoins: 1111,

    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 1,
    quantityUnit: "份",

    badge: "熱門",
    popular: true,
    bestValue: false,
    status: "active",
    order: 3,
  },
  {
    id: "coins_3000",
    name: "3000 金幣卡",
    description: "購買金幣，用於商城內的各種消費",
    icon: "💰",

    priceType: "currency",
    unitPrice: 900,
    currency: "TWD",

    // 第 4 階：贈送 18%（相當於 8.5 折）
    coins: 3000,
    bonus: 529,        // 贈送 529 金幣（17.6%）
    totalCoins: 3529,

    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 1,
    quantityUnit: "份",

    badge: "贈送 18%",
    popular: false,
    bestValue: false,
    status: "active",
    order: 4,
  },
  {
    id: "coins_5000",
    name: "5000 金幣卡",
    description: "購買金幣，用於商城內的各種消費",
    icon: "💰",

    priceType: "currency",
    unitPrice: 1500,
    currency: "TWD",

    // 第 5 階：贈送 25%（相當於 8 折）- 超值
    coins: 5000,
    bonus: 1250,       // 贈送 1250 金幣（25%）
    totalCoins: 6250,

    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 1,
    quantityUnit: "份",

    badge: "超值",
    popular: false,
    bestValue: true,
    status: "active",
    order: 5,
  },
];

async function importCoinPackages() {
  console.log("🌱 開始導入金幣套餐配置到 Firestore（5 種方案）...\n");

  const now = new Date().toISOString();

  for (const pkg of COIN_PACKAGES) {
    const pkgData = {
      ...pkg,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("coin_packages").doc(pkg.id).set(pkgData);
    const bonusDisplay = pkg.bonus > 0 ? ` (贈送 ${pkg.bonus} 金幣)` : '';
    console.log(`   ✓ ${pkg.name} - ${pkg.unitPrice} ${pkg.currency} → ${pkg.totalCoins} 金幣${bonusDisplay} ${pkg.badge ? `[${pkg.badge}]` : ''}`);
  }

  console.log(`\n✅ 已導入 ${COIN_PACKAGES.length} 個金幣套餐\n`);

  // 驗證導入結果
  console.log("🔍 驗證導入結果...");
  const snapshot = await db.collection("coin_packages").get();

  console.log("\n📊 金幣套餐列表:");
  snapshot.forEach(doc => {
    const data = doc.data();
    const bonusDisplay = data.bonus > 0 ? ` (含贈送 ${data.bonus})` : '';
    console.log(`   - ${data.name}: ${data.unitPrice} ${data.currency} → ${data.totalCoins} 金幣${bonusDisplay}`);
  });

  console.log("\n💡 查看 Firestore UI:");
  console.log("   http://localhost:4101/firestore\n");

  process.exit(0);
}

importCoinPackages().catch((error) => {
  console.error("❌ 導入失敗:", error);
  process.exit(1);
});
