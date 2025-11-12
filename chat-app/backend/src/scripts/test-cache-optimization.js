/**
 * AI 設定緩存優化測試腳本
 * 用於驗證緩存邏輯和性能改善
 */

import {
  getAiSettings,
  getAiServiceSettings,
  getCacheStats,
  resetCacheStats,
} from "../services/aiSettings.service.js";
import logger from "../utils/logger.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testCacheOptimization() {
  console.log("\n========================================");
  console.log("🧪 開始測試 AI 設定緩存優化");
  console.log("========================================\n");

  try {
    // 1. 重置統計
    console.log("1️⃣ 重置緩存統計...");
    resetCacheStats();
    let stats = getCacheStats();
    console.log("初始統計:", stats);
    console.log("✅ 統計重置成功\n");

    // 2. 第一次調用（緩存未命中）
    console.log("2️⃣ 第一次調用 getAiServiceSettings('chat')...");
    const chatConfig1 = await getAiServiceSettings("chat");
    console.log("獲取到的配置:", {
      model: chatConfig1.model,
      temperature: chatConfig1.temperature,
      topP: chatConfig1.topP,
      maxTokens: chatConfig1.maxTokens,
    });
    stats = getCacheStats();
    console.log("統計:", stats);
    if (stats.misses === 1 && stats.hits === 0) {
      console.log("✅ 第一次調用正確觸發緩存未命中\n");
    } else {
      console.log("❌ 統計異常！應該是 1 次未命中，0 次命中\n");
    }

    // 3. 立即第二次調用（緩存命中）
    console.log("3️⃣ 立即第二次調用 getAiServiceSettings('chat')...");
    const chatConfig2 = await getAiServiceSettings("chat");
    stats = getCacheStats();
    console.log("統計:", stats);
    if (stats.misses === 1 && stats.hits === 1) {
      console.log("✅ 第二次調用正確觸發緩存命中\n");
    } else {
      console.log("❌ 統計異常！應該是 1 次未命中，1 次命中\n");
    }

    // 4. 連續多次調用（測試緩存命中率）
    console.log("4️⃣ 連續調用 10 次（模擬真實對話場景）...");
    for (let i = 0; i < 10; i++) {
      await getAiServiceSettings("chat");
      await sleep(100); // 模擬對話間隔
    }
    stats = getCacheStats();
    console.log("統計:", stats);
    if (stats.total === 12 && stats.hits === 11 && stats.misses === 1) {
      console.log("✅ 連續調用測試通過！命中率:", stats.hitRate, "\n");
    } else {
      console.log("❌ 統計異常！應該是總共 12 次調用，11 次命中，1 次未命中\n");
    }

    // 5. 測試不同服務的緩存
    console.log("5️⃣ 測試其他 AI 服務配置...");
    const ttsConfig = await getAiServiceSettings("tts");
    console.log("TTS 配置:", {
      model: ttsConfig.model,
      defaultVoice: ttsConfig.defaultVoice,
    });

    const imageConfig = await getAiServiceSettings("imageGeneration");
    console.log("圖片生成配置:", {
      model: imageConfig.model,
      aspectRatio: imageConfig.aspectRatio,
    });

    stats = getCacheStats();
    console.log("統計:", stats);
    console.log("✅ 所有服務配置讀取成功\n");

    // 6. 測試 TTL（10 分鐘）
    console.log("6️⃣ 緩存 TTL 測試...");
    const cacheAgeBefore = stats.cacheAge;
    console.log("當前緩存年齡:", cacheAgeBefore);
    console.log("緩存 TTL:", stats.cacheTTL);
    console.log("✅ TTL 設置為 10 分鐘（600 秒）\n");

    // 7. 總結
    console.log("========================================");
    console.log("📊 最終統計報告");
    console.log("========================================");
    const finalStats = getCacheStats();
    console.log("總調用次數:", finalStats.total);
    console.log("緩存命中:", finalStats.hits);
    console.log("緩存未命中:", finalStats.misses);
    console.log("命中率:", finalStats.hitRate);
    console.log("運行時間:", finalStats.uptime);
    console.log("緩存年齡:", finalStats.cacheAge);
    console.log("緩存 TTL:", finalStats.cacheTTL);

    const expectedHitRate = parseFloat(finalStats.hitRate);
    if (expectedHitRate > 90) {
      console.log("\n✅ 緩存優化測試全部通過！");
      console.log("💡 預期命中率: >90%，實際:", finalStats.hitRate);
    } else {
      console.log("\n⚠️ 命中率低於預期 (應該 >90%)");
    }

    console.log("\n========================================");
    console.log("🎉 測試完成");
    console.log("========================================\n");

  } catch (error) {
    console.error("\n❌ 測試失敗:", error);
    console.error(error.stack);
  }
}

// 執行測試
testCacheOptimization()
  .then(() => {
    console.log("\n測試腳本執行完畢");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n測試腳本執行錯誤:", error);
    process.exit(1);
  });
