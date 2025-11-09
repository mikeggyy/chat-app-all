/**
 * 導入商品分類到 Firestore
 * 從前台商店的分類結構導入
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();

// 前台商店的分類結構
const CATEGORIES = [
  {
    id: "coins",
    label: "金幣卡",
    description: "購買金幣，用於商城內的各種消費",
    order: 1,
    collection: "coin_packages",
    icon: "💰",
  },
  {
    id: "potions",
    label: "道具",
    description: "購買增強道具，提升對話體驗",
    order: 2,
    collection: "potions",
    icon: "🧪",
  },
  {
    id: "character-unlock",
    label: "角色解鎖票",
    description: "解鎖與特定角色 7 天無限對話（300金幣/張）",
    order: 3,
    collection: "unlock_cards",
    icon: "🎫",
  },
  {
    id: "photo-unlock",
    label: "拍照卡",
    description: "用於生成角色AI照片（50金幣/張）",
    order: 4,
    collection: "unlock_cards",
    icon: "📸",
  },
  {
    id: "video-unlock",
    label: "影片卡",
    description: "用於生成角色AI短影片（200金幣/支）",
    order: 5,
    collection: "unlock_cards",
    icon: "🎥",
  },
  {
    id: "voice-unlock",
    label: "語音解鎖卡",
    description: "解鎖角色語音播放功能（免費/VIP用戶適用）",
    order: 6,
    collection: "unlock_cards",
    icon: "🔊",
  },
  {
    id: "create",
    label: "創建角色卡",
    description: "獲得創建專屬角色的機會",
    order: 7,
    collection: "unlock_cards",
    icon: "✨",
  },
  {
    id: "gifts",
    label: "禮物",
    description: "送給心儀角色的特別禮物",
    order: 8,
    collection: "gifts",
    icon: "🎁",
  },
];

async function importCategories() {
  console.log("🌱 開始導入商品分類到 Firestore...\n");

  console.log("📁 導入分類配置...");

  for (const category of CATEGORIES) {
    await db.collection("product_categories").doc(category.id).set({
      ...category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`   ✓ ${category.icon} ${category.label} (${category.id})`);
  }

  console.log(`✅ 已導入 ${CATEGORIES.length} 個分類\n`);

  // 驗證導入結果
  console.log("🔍 驗證導入結果...");
  const snapshot = await db.collection("product_categories").get();
  console.log(`   📁 product_categories: ${snapshot.size} 個文檔\n`);

  console.log("🎉 分類配置導入成功！");
  console.log(`📊 總共導入 ${CATEGORIES.length} 個分類\n`);

  console.log("💡 查看 Firestore UI:");
  console.log("   http://localhost:4101/firestore\n");

  process.exit(0);
}

importCategories().catch((error) => {
  console.error("❌ 導入失敗:", error);
  process.exit(1);
});
