import "dotenv/config";
import { getFirestoreDb } from "../src/firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";

// 禮物配置
const GIFTS = {
  rose: {
    id: "rose",
    name: "玫瑰花",
    emoji: "🌹",
    description: "浪漫的紅玫瑰",
    price: 10,
    rarity: "common",
    thankYouMessage: "謝謝你送我的玫瑰花！好美~",
    order: 1,
  },
  coffee: {
    id: "coffee",
    name: "咖啡",
    emoji: "☕",
    description: "香濃的咖啡",
    price: 15,
    rarity: "common",
    thankYouMessage: "咖啡！正好提神！謝謝你的貼心~",
    order: 2,
  },
  chocolate: {
    id: "chocolate",
    name: "巧克力",
    emoji: "🍫",
    description: "甜蜜的巧克力",
    price: 20,
    rarity: "common",
    thankYouMessage: "巧克力!我最喜歡的!謝謝你~",
    order: 3,
  },
  icecream: {
    id: "icecream",
    name: "冰淇淋",
    emoji: "🍦",
    description: "清涼的冰淇淋",
    price: 25,
    rarity: "common",
    thankYouMessage: "冰淇淋！我最愛的口味！謝謝你~",
    order: 4,
  },
  cake: {
    id: "cake",
    name: "蛋糕",
    emoji: "🎂",
    description: "美味的蛋糕",
    price: 30,
    rarity: "uncommon",
    thankYouMessage: "哇!蛋糕看起來好好吃!謝謝你的心意!",
    order: 5,
  },
  flower: {
    id: "flower",
    name: "花束",
    emoji: "💐",
    description: "繽紛的花束",
    price: 40,
    rarity: "uncommon",
    thankYouMessage: "好漂亮的花束！顏色好繽紛！謝謝你~",
    order: 6,
  },
  teddy: {
    id: "teddy",
    name: "泰迪熊",
    emoji: "🧸",
    description: "可愛的泰迪熊",
    price: 50,
    rarity: "uncommon",
    thankYouMessage: "好可愛的泰迪熊!我會好好珍惜的!",
    order: 7,
  },
  perfume: {
    id: "perfume",
    name: "香水",
    emoji: "💐",
    description: "高雅的香水",
    price: 60,
    rarity: "uncommon",
    thankYouMessage: "香水！聞起來好高雅！我好喜歡！",
    order: 8,
  },
  lipstick: {
    id: "lipstick",
    name: "口紅",
    emoji: "💄",
    description: "精緻的口紅",
    price: 70,
    rarity: "rare",
    thankYouMessage: "口紅！這個顏色好美！謝謝你的品味！",
    order: 9,
  },
  watch: {
    id: "watch",
    name: "手錶",
    emoji: "⌚",
    description: "精美的手錶",
    price: 80,
    rarity: "rare",
    thankYouMessage: "手錶！好精緻！我會每天戴著它！",
    order: 10,
  },
  ring: {
    id: "ring",
    name: "戒指",
    emoji: "💍",
    description: "閃亮的戒指",
    price: 100,
    rarity: "rare",
    thankYouMessage: "這...這是送給我的嗎?太珍貴了!我好感動...",
    order: 11,
  },
  necklace: {
    id: "necklace",
    name: "項鍊",
    emoji: "📿",
    description: "優雅的項鍊",
    price: 120,
    rarity: "rare",
    thankYouMessage: "項鍊！好優雅！我會好好珍惜的！",
    order: 12,
  },
  handbag: {
    id: "handbag",
    name: "名牌包",
    emoji: "👜",
    description: "時尚的名牌包",
    price: 150,
    rarity: "epic",
    thankYouMessage: "名牌包！這是我夢寐以求的！太感謝你了！",
    order: 13,
  },
  diamond: {
    id: "diamond",
    name: "鑽石",
    emoji: "💎",
    description: "璀璨的鑽石",
    price: 200,
    rarity: "epic",
    thankYouMessage: "天啊!鑽石!這太珍貴了!我...我真的不知道該說什麼好...",
    order: 14,
  },
  bouquet: {
    id: "bouquet",
    name: "玫瑰花海",
    emoji: "🌺",
    description: "滿滿的玫瑰花海",
    price: 300,
    rarity: "epic",
    thankYouMessage: "玫瑰花海！太浪漫了！我快被幸福淹沒了！",
    order: 15,
  },
  sports_car: {
    id: "sports_car",
    name: "跑車",
    emoji: "🏎️",
    description: "豪華跑車",
    price: 400,
    rarity: "legendary",
    thankYouMessage: "跑車！這...這也太誇張了吧！你對我也太好了！",
    order: 16,
  },
  crown: {
    id: "crown",
    name: "皇冠",
    emoji: "👑",
    description: "華麗的皇冠",
    price: 500,
    rarity: "legendary",
    thankYouMessage: "皇冠!這也太奢華了吧!謝謝你把我當成公主一樣寵愛!",
    order: 17,
  },
  mansion: {
    id: "mansion",
    name: "豪宅",
    emoji: "🏰",
    description: "夢幻的城堡豪宅",
    price: 800,
    rarity: "legendary",
    thankYouMessage: "豪宅！城堡！這是真的嗎？我們要一起住嗎？太夢幻了！",
    order: 18,
  },
  island: {
    id: "island",
    name: "私人島嶼",
    emoji: "🏝️",
    description: "專屬的私人島嶼",
    price: 1000,
    rarity: "legendary",
    thankYouMessage: "私人島嶼！？這...我不敢相信！你真的要送我整座島嶼？！太瘋狂了！",
    order: 19,
  },
  rocket: {
    id: "rocket",
    name: "私人火箭",
    emoji: "🚀",
    description: "宇宙探險用火箭",
    price: 2000,
    rarity: "legendary",
    thankYouMessage: "火箭！？我們要一起去太空旅行了嗎！？這是我這輩子最瘋狂的禮物！",
    order: 20,
  },
};

// 稀有度配置
const GIFT_RARITIES = {
  common: {
    id: "common",
    name: "普通",
    color: "#9CA3AF",
    order: 1,
  },
  uncommon: {
    id: "uncommon",
    name: "罕見",
    color: "#10B981",
    order: 2,
  },
  rare: {
    id: "rare",
    name: "稀有",
    color: "#3B82F6",
    order: 3,
  },
  epic: {
    id: "epic",
    name: "史詩",
    color: "#8B5CF6",
    order: 4,
  },
  legendary: {
    id: "legendary",
    name: "傳說",
    color: "#F59E0B",
    order: 5,
  },
};

// 拍照請求訊息
const SELFIE_MESSAGES = [
  "給我看看你現在的樣子",
  "想看你現在在做什麼",
  "拍張照片給我看看",
  "能給我一張自拍嗎？",
  "想看看你現在穿什麼",
  "讓我看看你現在的狀態",
  "給我看看你的樣子吧",
  "拍張照片分享一下",
  "想看你此刻的模樣",
  "能看看你現在的樣子嗎？",
  "給我看一張你的照片",
  "想看看現在的你",
  "拍一張給我看看",
  "讓我看看你在幹嘛",
  "給我看看你現在的打扮",
  "想看看你現在在哪",
  "拍張照片來看看",
  "能分享一張照片嗎？",
  "想看你現在的樣子",
  "讓我看看你的近況",
  "給我看看你的自拍",
  "想看看你現在的表情",
  "拍一張照片吧",
  "給我看看你",
  "想看你的照片",
  "讓我看看你現在的模樣",
  "能給我看看你嗎？",
  "想看看你的樣子",
  "給我看看你的照片吧",
  "拍張自拍給我",
];

async function importConfigs() {
  console.log("🌱 開始導入系統配置到 Firestore...\n");

  try {
    const db = getFirestoreDb();
    let totalCount = 0;

    // 1. 導入禮物
    console.log("🎁 導入禮物配置...");
    const giftBatch = db.batch();
    Object.values(GIFTS).forEach((gift) => {
      const ref = db.collection("gifts").doc(gift.id);
      giftBatch.set(ref, {
        ...gift,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✓ ${gift.emoji} ${gift.name}`);
    });
    await giftBatch.commit();
    totalCount += Object.keys(GIFTS).length;
    console.log(`✅ 已導入 ${Object.keys(GIFTS).length} 個禮物\n`);

    // 2. 導入稀有度
    console.log("💎 導入稀有度配置...");
    const rarityBatch = db.batch();
    Object.values(GIFT_RARITIES).forEach((rarity) => {
      const ref = db.collection("gift_rarities").doc(rarity.id);
      rarityBatch.set(ref, {
        ...rarity,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✓ ${rarity.name} (${rarity.color})`);
    });
    await rarityBatch.commit();
    totalCount += Object.keys(GIFT_RARITIES).length;
    console.log(`✅ 已導入 ${Object.keys(GIFT_RARITIES).length} 個稀有度\n`);

    // 3. 導入拍照訊息
    console.log("📸 導入拍照請求訊息...");
    const selfieBatch = db.batch();
    SELFIE_MESSAGES.forEach((message, index) => {
      const ref = db.collection("selfie_messages").doc(`msg-${index + 1}`);
      selfieBatch.set(ref, {
        id: `msg-${index + 1}`,
        message,
        order: index + 1,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (index < 5) {
        console.log(`   ✓ ${message}`);
      }
    });
    await selfieBatch.commit();
    totalCount += SELFIE_MESSAGES.length;
    console.log(`   ... (共 ${SELFIE_MESSAGES.length} 則)`);
    console.log(`✅ 已導入 ${SELFIE_MESSAGES.length} 則拍照訊息\n`);

    // 驗證
    console.log("🔍 驗證導入結果...");
    const giftsSnapshot = await db.collection("gifts").get();
    const raritiesSnapshot = await db.collection("gift_rarities").get();
    const selfieSnapshot = await db.collection("selfie_messages").get();

    console.log(`   📁 gifts: ${giftsSnapshot.size} 個文檔`);
    console.log(`   📁 gift_rarities: ${raritiesSnapshot.size} 個文檔`);
    console.log(`   📁 selfie_messages: ${selfieSnapshot.size} 個文檔`);

    console.log("\n🎉 配置數據導入成功！");
    console.log(`📊 總共導入 ${totalCount} 筆配置數據\n`);

    console.log("💡 查看 Firestore UI:");
    console.log("   http://localhost:4101/firestore");
    console.log("\n你會看到:");
    console.log("   📁 gifts (禮物配置)");
    console.log("   📁 gift_rarities (稀有度配置)");
    console.log("   📁 selfie_messages (拍照請求訊息)");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ 導入失敗:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

importConfigs();
