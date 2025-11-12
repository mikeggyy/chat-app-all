/**
 * 測試 AI 設定服務
 * 用於驗證從 Firestore 讀取 AI 設定是否正常
 *
 * 使用方法：
 * node src/scripts/test-ai-settings.js
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// 載入環境變數
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../.env") });

import { getAiSettings, refreshAiSettings, getAiServiceSettings } from "../services/aiSettings.service.js";
import logger from "../utils/logger.js";

async function testAiSettings() {
  logger.info("\n========================================");
  logger.info("🧪 測試 AI 設定服務");
  logger.info("========================================\n");

  try {
    // 測試 1: 讀取完整 AI 設定
    logger.info("📖 測試 1: 讀取完整 AI 設定");
    const settings = await getAiSettings();

    logger.info("✅ AI 設定讀取成功\n");
    logger.info("設定摘要:");
    logger.info("  - 聊天 AI 模型:", settings.chat?.model);
    logger.info("  - TTS 模型:", settings.tts?.model);
    logger.info("  - TTS 預設語音:", settings.tts?.defaultVoice);
    logger.info("  - 圖片生成模型:", settings.imageGeneration?.model);
    logger.info("  - 圖片場景數量:", settings.imageGeneration?.selfieScenarios?.length);
    logger.info("  - 影片生成提供者:", settings.videoGeneration?.provider);
    logger.info("  - 影片生成模型:", settings.videoGeneration?.model);
    logger.info("  - 影片時長:", settings.videoGeneration?.durationSeconds + "s");
    logger.info("  - 影片解析度:", settings.videoGeneration?.resolution);
    logger.info("  - 更新時間:", settings.updatedAt);

    // 測試 2: 測試緩存機制
    logger.info("\n📖 測試 2: 測試緩存機制（應該使用緩存）");
    const startTime = Date.now();
    const cachedSettings = await getAiSettings();
    const duration = Date.now() - startTime;
    logger.info(`✅ 緩存讀取耗時: ${duration}ms (應該 < 10ms)`);

    // 測試 3: 讀取特定服務設定
    logger.info("\n📖 測試 3: 讀取特定服務設定");
    const videoSettings = await getAiServiceSettings("videoGeneration");
    logger.info("✅ 影片生成設定:");
    logger.info("  - Provider:", videoSettings.provider);
    logger.info("  - Model:", videoSettings.model);
    logger.info("  - Duration:", videoSettings.durationSeconds + "s");
    logger.info("  - Resolution:", videoSettings.resolution);
    logger.info("  - Aspect Ratio:", videoSettings.aspectRatio);
    logger.info("  - Enable Retry:", videoSettings.enableRetry);
    logger.info("  - Max Retries:", videoSettings.maxRetries);
    logger.info("  - Use Mock Video:", videoSettings.useMockVideo);

    const imageSettings = await getAiServiceSettings("imageGeneration");
    logger.info("\n✅ 圖片生成設定:");
    logger.info("  - Model:", imageSettings.model);
    logger.info("  - Aspect Ratio:", imageSettings.aspectRatio);
    logger.info("  - Compression Quality:", imageSettings.compressionQuality);
    logger.info("  - Scenario Count:", imageSettings.selfieScenarios?.length);
    logger.info("  - Selection Chance:", (imageSettings.scenarioSelectionChance * 100) + "%");

    // 測試 4: 手動刷新緩存
    logger.info("\n📖 測試 4: 手動刷新緩存");
    const refreshedSettings = await refreshAiSettings();
    logger.info("✅ 緩存刷新成功");

    logger.info("\n========================================");
    logger.info("✅ 所有測試通過");
    logger.info("========================================\n");

    process.exit(0);
  } catch (error) {
    logger.error("\n❌ 測試失敗:", error);
    logger.error(error.stack);
    process.exit(1);
  }
}

// 執行測試
testAiSettings();
