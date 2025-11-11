/**
 * 初始化圖片生成設定
 * 用於將預設的 selfieScenarios 寫入 Firestore
 *
 * 使用方法：
 * node src/scripts/init-image-settings.js
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import admin from "firebase-admin";

// 載入環境變數
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../.env") });

// 初始化 Firebase Admin（如果尚未初始化）
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  });
}

const db = admin.firestore();

// 預設圖片生成配置（包含所有 selfieScenarios）
const DEFAULT_IMAGE_SETTINGS = {
  model: "gemini-2.5-flash-image",
  aspectRatio: "2:3",
  compressionQuality: 40,
  imagePromptTemplate: `A natural portrait photo. Character context: {角色背景設定}. Current situation: {最近對話內容}. Scene: The character is {場景描述}. Natural expression, warm lighting, candid photography style. Natural pose and activity. High quality portrait photo. IMPORTANT: No text, no words, no letters, no signs with writing in the image. Pure visual photo only.`,
  selfieScenarios: [
    // 休閒活動
    "browsing at a bookstore, looking at books",
    "shopping at a trendy boutique, holding shopping bags",
    "at a street food market, enjoying local snacks",
    "visiting an art gallery, admiring artwork",
    "at a movie theater entrance, excited for a film",

    // 戶外場景
    "walking in a botanical garden, surrounded by flowers",
    "at a city park, sitting on a bench under trees",
    "at the beach, enjoying the ocean view",
    "hiking on a scenic mountain trail",
    "visiting a zoo, watching animals",
    "at an amusement park, having fun",
    "strolling through a night market",

    // 美食相關
    "at a dessert café, enjoying sweet treats",
    "at a ramen restaurant, about to eat",
    "at a sushi bar, trying fresh sushi",
    "having brunch at a cozy restaurant",
    "at a bakery, choosing pastries",
    "at an ice cream shop, holding a cone",

    // 室內活動
    "at a cozy library, reading peacefully",
    "at a pottery studio, creating ceramics",
    "at a yoga studio, relaxing after class",
    "at a music store, browsing vinyl records",
    "at home, cooking in the kitchen",
    "working at a modern co-working space",

    // 娛樂場所
    "at a karaoke lounge, having fun with friends",
    "at a game arcade, playing games",
    "at a bowling alley, enjoying the atmosphere",
    "at a photography exhibition",
    "at a rooftop bar, enjoying city views",

    // 日常生活
    "at a farmers market, buying fresh produce",
    "at a flower shop, surrounded by beautiful flowers",
    "at a pet café, playing with cute animals",
    "waiting at a train station, casual moment",
    "at a convenience store, shopping casually",

    // 季節性場景
    "in an autumn forest with colorful maple leaves",
    "in a winter wonderland with snow falling gently",
    "under cherry blossoms in full bloom",
    "at a summer beach during golden hour sunset",
    "in a spring meadow filled with wildflowers",

    // 運動/健身場景
    "at a modern gym after workout",
    "by a swimming pool in sporty attire",
    "at a tennis court with racket",
    "at a skateboard park with board",
    "at a rock climbing gym",
    "jogging in a scenic park trail",

    // 文化/藝術場景
    "at a historical museum exploring exhibits",
    "at a concert hall before a performance",
    "at a traditional theater entrance",
    "at a craft fair browsing handmade items",
    "in a ceramic gallery admiring pottery",
    "at a dance studio after practice",

    // 旅遊/景點場景
    "at an airport lounge ready to travel",
    "in a luxurious hotel lobby",
    "at a scenic viewpoint overlooking the city",
    "at a famous landmark taking photos",
    "at a hot spring resort relaxing",
    "on a bridge with beautiful architecture",
    "at a cable car station enjoying mountain views",

    // 時尚/美容場景
    "at a hair salon getting styled",
    "in a fashion design studio",
    "at a jewelry store trying on accessories",
    "at a makeup counter getting beauty advice",

    // 創意工作場景
    "in a recording studio with headphones",
    "at a photography studio with camera",
    "in an art studio painting on canvas",
    "at a design workspace with tablet",

    // 自然探索場景
    "near a majestic waterfall",
    "in a serene bamboo forest",
    "by a peaceful lake with reflections",
    "on a wooden dock by the water",
    "in a lavender field during bloom season",
    "at a sunflower farm in summer",

    // 咖啡/飲品文化
    "at a specialty coffee roastery",
    "at a tea house enjoying traditional tea",
    "at a smoothie bar with fresh drinks",
    "at a wine tasting room",

    // 購物/市集
    "at a vintage flea market finding treasures",
    "at a record store browsing vinyls",
    "at a craft brewery tasting room",
    "in a luxurious department store",

    // 水上活動/海洋場景
    "on a luxury yacht deck sailing",
    "at a water park enjoying the slides",
    "on a paddleboard on calm waters",
    "at a marina with boats in background",
    "on a cruise ship deck at sea",
    "snorkeling in crystal clear waters",
    "at a beach resort infinity pool",
    "kayaking on a peaceful river",

    // 著名景點/地標
    "at a historic castle entrance",
    "at a traditional temple garden",
    "on a observation tower viewing deck",
    "at a iconic city square",
    "near a famous fountain landmark",
    "at a scenic coastal cliff",
    "in front of modern architecture marvel",

    // 戶外冒險
    "at a camping site in the mountains",
    "on a safari watching wildlife",
    "at a zip-line adventure park",
    "horseback riding on a scenic trail",
    "at a scenic overlook with binoculars",

    // 城市探索
    "exploring a vibrant street art district",
    "at a bustling central station",
    "on a vintage tram ride",
    "at a modern skyline viewpoint",
    "walking through historic old town",

    // 休閒度假
    "lounging by a resort poolside",
    "at a spa retreat relaxing",
    "in a cozy cabin in the woods",
    "at a glamping tent in nature",
    "on a hammock between palm trees",

    // 游泳池場景
    "at an indoor pool with mood lighting",
    "by an Olympic-sized swimming pool",
    "at a private villa pool",
    "in a rooftop infinity pool overlooking city",
    "at a tropical pool bar with drinks",
    "poolside at sunset with lounge chairs",
    "at a pool party atmosphere",

    // 飯店/酒店場景
    "in a luxury hotel room with city view",
    "at a boutique hotel lobby with art deco design",
    "in a hotel rooftop garden",
    "at a hotel café terrace",
    "in a grand hotel ballroom",
    "at a hotel spa entrance",
    "checking in at hotel reception desk",
    "in a hotel elevator with mirrors",
    "at a hotel penthouse suite",

    // 酒吧/夜生活場景
    "at a speakeasy bar with dim lighting",
    "at a cocktail bar trying signature drinks",
    "at a sports bar watching games",
    "at a jazz bar enjoying live music",
    "at a hotel bar lounge",
    "at a beach bar with ocean view",
    "at a whiskey bar sampling drinks",
    "at a trendy rooftop lounge",
    "at a vintage pub with cozy atmosphere",
    "at a wine bar tasting selection"
  ],
  scenarioSelectionChance: 0.7, // 70% 機率使用隨機場景
  description: "角色自拍照片生成 AI",
};

/**
 * 初始化 Firestore 中的圖片生成設定
 */
async function initImageSettings() {
  console.log("\n========================================");
  console.log("📝 初始化圖片生成設定");
  console.log("========================================\n");

  try {
    // 1. 讀取當前配置
    console.log("📖 讀取當前配置...");
    const docRef = db.collection("ai_settings").doc("global");
    const doc = await docRef.get();

    let currentSettings = {};

    if (doc.exists) {
      currentSettings = doc.data();
      console.log("✅ 找到現有的 ai_settings/global 文檔");

      // 檢查是否已有 imageGeneration 配置
      if (currentSettings.imageGeneration) {
        console.log("\n當前圖片生成配置：");
        console.log(`   Model: ${currentSettings.imageGeneration.model || "（未設定）"}`);
        console.log(`   Aspect Ratio: ${currentSettings.imageGeneration.aspectRatio || "（未設定）"}`);
        console.log(`   Scenarios 數量: ${currentSettings.imageGeneration.selfieScenarios?.length || 0}`);
        console.log(`   Scenario 選擇機率: ${currentSettings.imageGeneration.scenarioSelectionChance ?? "（未設定）"}`);
      } else {
        console.log("⚠️  未找到 imageGeneration 配置");
      }
    } else {
      console.log("⚠️  ai_settings/global 文檔不存在，將創建新文檔");
    }

    // 2. 更新配置
    console.log("\n🔄 更新圖片生成配置...");
    await docRef.set({
      imageGeneration: DEFAULT_IMAGE_SETTINGS,
      updatedAt: new Date().toISOString(),
    }, { merge: true }); // 使用 merge: true 保留其他設定

    console.log("✅ 新配置：");
    console.log(`   Model: ${DEFAULT_IMAGE_SETTINGS.model}`);
    console.log(`   Aspect Ratio: ${DEFAULT_IMAGE_SETTINGS.aspectRatio}`);
    console.log(`   Compression Quality: ${DEFAULT_IMAGE_SETTINGS.compressionQuality}`);
    console.log(`   Scenarios 數量: ${DEFAULT_IMAGE_SETTINGS.selfieScenarios.length}`);
    console.log(`   Scenario 選擇機率: ${DEFAULT_IMAGE_SETTINGS.scenarioSelectionChance * 100}%`);

    // 3. 顯示前 5 個場景作為範例
    console.log("\n📋 場景範例（前 5 個）：");
    DEFAULT_IMAGE_SETTINGS.selfieScenarios.slice(0, 5).forEach((scenario, index) => {
      console.log(`   ${index + 1}. ${scenario}`);
    });
    console.log(`   ... 以及其他 ${DEFAULT_IMAGE_SETTINGS.selfieScenarios.length - 5} 個場景`);

    // 4. 驗證更新
    console.log("\n🔍 驗證更新...");
    const updatedDoc = await docRef.get();
    const updatedSettings = updatedDoc.data();
    const updatedImageConfig = updatedSettings.imageGeneration;

    if (updatedImageConfig?.selfieScenarios?.length === DEFAULT_IMAGE_SETTINGS.selfieScenarios.length) {
      console.log("✅ 配置更新成功！");
    } else {
      console.error("❌ 配置更新後驗證失敗");
      console.error(`   預期場景數量: ${DEFAULT_IMAGE_SETTINGS.selfieScenarios.length}`);
      console.error(`   實際場景數量: ${updatedImageConfig?.selfieScenarios?.length || 0}`);
      process.exit(1);
    }

    console.log("\n========================================");
    console.log("✅ 圖片生成設定已初始化");
    console.log("========================================");
    console.log("\n📝 後續步驟：");
    console.log("1. 在管理後台前端重新載入頁面（Ctrl+F5 或 Cmd+Shift+R）");
    console.log("2. 檢查「圖片生成」分頁，確認場景列表已顯示");
    console.log("3. 可以開始編輯場景列表和選擇機率\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ 初始化失敗：", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行腳本
initImageSettings();
