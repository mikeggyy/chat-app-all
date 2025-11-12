/**
 * 更新影片生成提供者配置
 * 用於快速切換 Firestore 中的影片生成提供者設定
 *
 * 使用方法：
 * node src/scripts/update-video-provider.js hailuo
 * node src/scripts/update-video-provider.js veo
 * node src/scripts/update-video-provider.js replicate
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import admin from "firebase-admin";
import logger from "../utils/logger.js";

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

// 不同提供者的預設配置
const PROVIDER_CONFIGS = {
  hailuo: {
    provider: "hailuo",
    model: "minimax/hailuo-02",
    durationSeconds: 10,
    resolution: "512p",
    aspectRatio: "16:9",
    enableRetry: true,
    maxRetries: 3,
    useMockVideo: false,
    description: "Hailuo 02 影片生成（Minimax）",
  },
  veo: {
    provider: "veo",
    model: "veo-3.0-fast-generate-001",
    durationSeconds: 8,
    resolution: "720p",
    aspectRatio: "9:16",
    enableRetry: true,
    maxRetries: 3,
    useMockVideo: false,
    description: "Veo 3.0 Fast 影片生成（Google Vertex AI）",
  },
  replicate: {
    provider: "replicate",
    model: "stability-ai/stable-video-diffusion",
    durationSeconds: 4,
    resolution: "576x1024",
    aspectRatio: "9:16",
    enableRetry: true,
    maxRetries: 3,
    useMockVideo: false,
    description: "Stable Video Diffusion（Replicate）",
  },
};

/**
 * 更新 Firestore 中的影片生成提供者配置
 */
async function updateVideoProvider(providerName) {
  logger.info("\n========================================");
  logger.info(`📝 更新影片生成提供者配置為: ${providerName}`);
  logger.info("========================================\n");

  // 驗證提供者名稱
  if (!PROVIDER_CONFIGS[providerName]) {
    logger.error(`❌ 錯誤：不支援的提供者 "${providerName}"`);
    logger.info("\n可用的提供者：");
    logger.info("  - hailuo    (Minimax Hailuo 02)");
    logger.info("  - veo       (Google Veo 3.0 Fast)");
    logger.info("  - replicate (Stable Video Diffusion)");
    logger.info("\n使用方法：");
    logger.info("  node src/scripts/update-video-provider.js hailuo");
    logger.info("  node src/scripts/update-video-provider.js veo");
    logger.info("  node src/scripts/update-video-provider.js replicate\n");
    process.exit(1);
  }

  const newConfig = PROVIDER_CONFIGS[providerName];

  try {
    // 1. 讀取當前配置
    logger.info("📖 讀取當前配置...");
    const docRef = db.collection("ai_settings").doc("global");
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.error("❌ 錯誤：ai_settings/global 文檔不存在");
      process.exit(1);
    }

    const currentSettings = doc.data();
    const currentVideoConfig = currentSettings.videoGeneration || {};

    logger.info("✅ 當前配置：");
    logger.info(`   Provider: ${currentVideoConfig.provider || "（未設定）"}`);
    logger.info(`   Model: ${currentVideoConfig.model || "（未設定）"}`);
    logger.info(`   Duration: ${currentVideoConfig.durationSeconds || "（未設定）"}s`);
    logger.info(`   Resolution: ${currentVideoConfig.resolution || "（未設定）"}`);

    // 2. 更新配置
    logger.info("\n🔄 更新為新配置...");
    await docRef.update({
      "videoGeneration": newConfig,
      "updatedAt": new Date().toISOString(),
    });

    logger.info("✅ 新配置：");
    logger.info(`   Provider: ${newConfig.provider}`);
    logger.info(`   Model: ${newConfig.model}`);
    logger.info(`   Duration: ${newConfig.durationSeconds}s`);
    logger.info(`   Resolution: ${newConfig.resolution}`);
    logger.info(`   Aspect Ratio: ${newConfig.aspectRatio}`);
    logger.info(`   Description: ${newConfig.description}`);

    // 3. 驗證更新
    logger.info("\n🔍 驗證更新...");
    const updatedDoc = await docRef.get();
    const updatedSettings = updatedDoc.data();
    const updatedVideoConfig = updatedSettings.videoGeneration;

    if (updatedVideoConfig.provider === newConfig.provider &&
        updatedVideoConfig.model === newConfig.model) {
      logger.info("✅ 配置更新成功！");
    } else {
      logger.error("❌ 配置更新後驗證失敗");
      process.exit(1);
    }

    logger.info("\n========================================");
    logger.info("✅ 影片生成提供者配置已更新");
    logger.info("========================================");
    logger.info("\n📝 後續步驟：");
    logger.info("1. 如果後端正在運行，請呼叫 POST /api/ai-settings/refresh 刷新緩存");
    logger.info("2. 或者重啟後端服務");
    logger.info("3. 在管理後台確認配置已生效\n");

    process.exit(0);
  } catch (error) {
    logger.error("\n❌ 更新失敗：", error);
    logger.error(error.stack);
    process.exit(1);
  }
}

// 執行腳本
const providerArg = process.argv[2];

if (!providerArg) {
  logger.info("\n使用方法：");
  logger.info("  node src/scripts/update-video-provider.js <provider>\n");
  logger.info("可用的提供者：");
  logger.info("  - hailuo    (Minimax Hailuo 02)");
  logger.info("  - veo       (Google Veo 3.0 Fast)");
  logger.info("  - replicate (Stable Video Diffusion)\n");
  logger.info("範例：");
  logger.info("  node src/scripts/update-video-provider.js hailuo\n");
  process.exit(1);
}

updateVideoProvider(providerArg.toLowerCase());
