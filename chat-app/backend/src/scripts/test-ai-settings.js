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
  console.log("\n========================================");
  console.log("🧪 測試 AI 設定服務");
  console.log("========================================\n");

  try {
    // 測試 1: 讀取完整 AI 設定
    console.log("📖 測試 1: 讀取完整 AI 設定");
    const settings = await getAiSettings();

    console.log("✅ AI 設定讀取成功\n");
    console.log("設定摘要:");
    console.log("  - 聊天 AI 模型:", settings.chat?.model);
    console.log("  - TTS 模型:", settings.tts?.model);
    console.log("  - TTS 預設語音:", settings.tts?.defaultVoice);
    console.log("  - 圖片生成模型:", settings.imageGeneration?.model);
    console.log("  - 圖片場景數量:", settings.imageGeneration?.selfieScenarios?.length);
    console.log("  - 影片生成提供者:", settings.videoGeneration?.provider);
    console.log("  - 影片生成模型:", settings.videoGeneration?.model);
    console.log("  - 影片時長:", settings.videoGeneration?.durationSeconds + "s");
    console.log("  - 影片解析度:", settings.videoGeneration?.resolution);
    console.log("  - 更新時間:", settings.updatedAt);

    // 測試 2: 測試緩存機制
    console.log("\n📖 測試 2: 測試緩存機制（應該使用緩存）");
    const startTime = Date.now();
    const cachedSettings = await getAiSettings();
    const duration = Date.now() - startTime;
    console.log(`✅ 緩存讀取耗時: ${duration}ms (應該 < 10ms)`);

    // 測試 3: 讀取特定服務設定
    console.log("\n📖 測試 3: 讀取特定服務設定");
    const videoSettings = await getAiServiceSettings("videoGeneration");
    console.log("✅ 影片生成設定:");
    console.log("  - Provider:", videoSettings.provider);
    console.log("  - Model:", videoSettings.model);
    console.log("  - Duration:", videoSettings.durationSeconds + "s");
    console.log("  - Resolution:", videoSettings.resolution);
    console.log("  - Aspect Ratio:", videoSettings.aspectRatio);
    console.log("  - Enable Retry:", videoSettings.enableRetry);
    console.log("  - Max Retries:", videoSettings.maxRetries);
    console.log("  - Use Mock Video:", videoSettings.useMockVideo);

    const imageSettings = await getAiServiceSettings("imageGeneration");
    console.log("\n✅ 圖片生成設定:");
    console.log("  - Model:", imageSettings.model);
    console.log("  - Aspect Ratio:", imageSettings.aspectRatio);
    console.log("  - Compression Quality:", imageSettings.compressionQuality);
    console.log("  - Scenario Count:", imageSettings.selfieScenarios?.length);
    console.log("  - Selection Chance:", (imageSettings.scenarioSelectionChance * 100) + "%");

    // 測試 4: 手動刷新緩存
    console.log("\n📖 測試 4: 手動刷新緩存");
    const refreshedSettings = await refreshAiSettings();
    console.log("✅ 緩存刷新成功");

    console.log("\n========================================");
    console.log("✅ 所有測試通過");
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ 測試失敗:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行測試
testAiSettings();
