import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 先載入環境變數
dotenv.config({ path: join(__dirname, "../.env") });

const characterStyles = [
  {
    id: "modern-urban",
    label: "現代都市",
    era: "現代",
    thumbnail: "modern-urban.webp",
    order: 1,
    status: "active",
  },
  {
    id: "highschool-life",
    label: "高中校園",
    era: "現代",
    thumbnail: "highschool-life.webp",
    order: 2,
    status: "active",
  },
  {
    id: "classic-elegant",
    label: "經典優雅",
    era: "現代",
    thumbnail: "classic-elegant.webp",
    order: 3,
    status: "active",
  },
  {
    id: "psychedelic-retro",
    label: "迷幻復古",
    era: "現代",
    thumbnail: "psychedelic-retro.webp",
    order: 4,
    status: "active",
  },
  {
    id: "epic-fantasy",
    label: "史詩奇幻",
    era: "奇幻",
    thumbnail: "epic-fantasy.webp",
    order: 5,
    status: "active",
  },
  {
    id: "steampunk",
    label: "蒸汽龐克",
    era: "奇幻",
    thumbnail: "steampunk.webp",
    order: 6,
    status: "active",
  },
  {
    id: "fairy-tale",
    label: "童話世界",
    era: "奇幻",
    thumbnail: "fairy-tale.webp",
    order: 7,
    status: "active",
  },
  {
    id: "underwater-fantasy",
    label: "水下奇幻",
    era: "奇幻",
    thumbnail: "underwater-fantasy.webp",
    order: 8,
    status: "active",
  },
  {
    id: "cyberpunk",
    label: "賽博龐克",
    era: "未來",
    thumbnail: "cyberpunk.webp",
    order: 9,
    status: "active",
  },
  {
    id: "space-exploration",
    label: "太空探索",
    era: "未來",
    thumbnail: "space-exploration.webp",
    order: 10,
    status: "active",
  },
  {
    id: "futuristic-military",
    label: "未來軍事",
    era: "未來",
    thumbnail: "futuristic-military.webp",
    order: 11,
    status: "active",
  },
  {
    id: "post-apocalyptic",
    label: "末日廢土",
    era: "未來",
    thumbnail: "post-apocalyptic.webp",
    order: 12,
    status: "active",
  },
  {
    id: "rococo-luxe",
    label: "洛可可奢華",
    era: "歷史",
    thumbnail: "rococo-luxe.webp",
    order: 13,
    status: "active",
  },
  {
    id: "norse-myth",
    label: "北歐神話",
    era: "歷史",
    thumbnail: "norse-myth.webp",
    order: 14,
    status: "active",
  },
  {
    id: "western-outlaw",
    label: "西部牛仔",
    era: "歷史",
    thumbnail: "western-outlaw.webp",
    order: 15,
    status: "active",
  },
  {
    id: "foggy-detective",
    label: "霧都偵探",
    era: "現代",
    thumbnail: "foggy-detective.webp",
    order: 16,
    status: "active",
  },
  {
    id: "vampire-nocturne",
    label: "吸血鬼夜曲",
    era: "奇幻",
    thumbnail: "vampire-nocturne.webp",
    order: 17,
    status: "active",
  },
  {
    id: "lycanthrope-wilds",
    label: "狼人荒野",
    era: "奇幻",
    thumbnail: "lycanthrope-wilds.webp",
    order: 18,
    status: "active",
  },
  {
    id: "arcane-academy",
    label: "奧術學院",
    era: "奇幻",
    thumbnail: "arcane-academy.webp",
    order: 19,
    status: "active",
  },
];

async function importCharacterStyles() {
  try {
    console.log("開始匯入角色風格資料到 Firestore...");

    // 使用動態導入確保在環境變數載入後才導入 Firebase
    const { getFirestoreDb } = await import("../src/firebase/index.js");

    const db = getFirestoreDb();
    const batch = db.batch();

    const timestamp = new Date().toISOString();

    characterStyles.forEach((style) => {
      const docRef = db.collection("character_styles").doc(style.id);
      batch.set(docRef, {
        ...style,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    await batch.commit();

    console.log(`✅ 成功匯入 ${characterStyles.length} 個角色風格`);
    console.log("\n角色風格列表：");
    characterStyles.forEach((style) => {
      console.log(`  - ${style.label} (${style.era})`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ 匯入角色風格失敗：", error);
    process.exit(1);
  }
}

importCharacterStyles();
