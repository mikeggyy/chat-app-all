/**
 * 測試 VEO API 的正確請求格式
 * 測試 parameters vs generationConfig
 */

import "dotenv/config";
import { VertexAI } from "@google-cloud/vertexai";

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

async function testVeoFormat() {
  console.log("=".repeat(80));
  console.log("測試 VEO 3.0 Fast API 請求格式");
  console.log("=".repeat(80));
  console.log();

  const vertexAI = new VertexAI({
    project: projectId,
    location: location,
  });

  const model = vertexAI.preview.getGenerativeModel({
    model: "veo-3.0-fast-generate-001",
  });

  const testPrompt = "A short video of a person smiling and waving at the camera. Natural lighting, warm atmosphere.";

  console.log("測試提示詞:", testPrompt);
  console.log();

  // ============================================================
  // 測試 1: 使用 parameters (官方文檔格式)
  // ============================================================
  console.log("📋 測試 1: 使用 'parameters' 對象 (VEO 官方文檔格式)");
  console.log("-".repeat(80));

  const request1 = {
    contents: [
      {
        role: "user",
        parts: [{ text: testPrompt }],
      },
    ],
    parameters: {
      durationSeconds: 4,
      resolution: "720p",
      sampleCount: 1,
      generateAudio: false,
      aspectRatio: "9:16",
      enhancePrompt: true,
      compressionQuality: "optimized",
      personGeneration: "allow_adult",
    },
  };

  console.log("請求格式:");
  console.log(JSON.stringify(request1, null, 2));
  console.log();

  try {
    console.log("⏳ 發送請求...");
    const result1 = await model.generateContent(request1);
    console.log("✅ 成功！使用 'parameters' 格式有效");
    console.log("回應:", result1.response ? "收到回應" : "無回應");
    console.log();
  } catch (error) {
    console.log("❌ 失敗：", error.message);
    if (error.message.includes("429")) {
      console.log("   (配額超限 - 這是預期的)");
    } else if (error.message.includes("400")) {
      console.log("   ⚠️  可能是參數格式錯誤");
    }
    console.log();
  }

  // ============================================================
  // 測試 2: 使用 generationConfig (SDK 標準格式)
  // ============================================================
  console.log("📋 測試 2: 使用 'generationConfig' 對象 (SDK 標準格式)");
  console.log("-".repeat(80));

  const request2 = {
    contents: [
      {
        role: "user",
        parts: [{ text: testPrompt }],
      },
    ],
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      // VEO 專用參數
      durationSeconds: 4,
      resolution: "720p",
      sampleCount: 1,
      generateAudio: false,
      aspectRatio: "9:16",
      enhancePrompt: true,
      compressionQuality: "optimized",
      personGeneration: "allow_adult",
    },
  };

  console.log("請求格式:");
  console.log(JSON.stringify(request2, null, 2));
  console.log();

  try {
    console.log("⏳ 發送請求...");
    const result2 = await model.generateContent(request2);
    console.log("✅ 成功！使用 'generationConfig' 格式有效");
    console.log("回應:", result2.response ? "收到回應" : "無回應");
    console.log();
  } catch (error) {
    console.log("❌ 失敗：", error.message);
    if (error.message.includes("429")) {
      console.log("   (配額超限 - 這是預期的)");
    } else if (error.message.includes("400")) {
      console.log("   ⚠️  可能是參數格式錯誤");
    }
    console.log();
  }

  // ============================================================
  // 測試 3: 同時使用兩者
  // ============================================================
  console.log("📋 測試 3: 同時使用 'parameters' 和 'generationConfig'");
  console.log("-".repeat(80));

  const request3 = {
    contents: [
      {
        role: "user",
        parts: [{ text: testPrompt }],
      },
    ],
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
    parameters: {
      durationSeconds: 4,
      resolution: "720p",
      sampleCount: 1,
      generateAudio: false,
      aspectRatio: "9:16",
      enhancePrompt: true,
      compressionQuality: "optimized",
      personGeneration: "allow_adult",
    },
  };

  console.log("請求格式:");
  console.log(JSON.stringify(request3, null, 2));
  console.log();

  try {
    console.log("⏳ 發送請求...");
    const result3 = await model.generateContent(request3);
    console.log("✅ 成功！同時使用兩者有效");
    console.log("回應:", result3.response ? "收到回應" : "無回應");
    console.log();
  } catch (error) {
    console.log("❌ 失敗：", error.message);
    if (error.message.includes("429")) {
      console.log("   (配額超限 - 這是預期的)");
    } else if (error.message.includes("400")) {
      console.log("   ⚠️  可能是參數格式錯誤");
    }
    console.log();
  }

  // ============================================================
  // 總結
  // ============================================================
  console.log("=".repeat(80));
  console.log("📊 測試總結");
  console.log("=".repeat(80));
  console.log();
  console.log("✓ 如果看到 429 錯誤 → 配額問題（不是格式問題）");
  console.log("✓ 如果看到 400 錯誤 → 可能是參數格式錯誤");
  console.log("✓ 如果成功 → 該格式正確");
  console.log();
  console.log("建議：");
  console.log("1. 使用成功的格式更新 videoGeneration.service.js");
  console.log("2. 如果都是 429 → 啟用 USE_MOCK_VIDEO=true 繼續開發");
  console.log("3. 申請配額增加：https://console.cloud.google.com/iam-admin/quotas");
  console.log();
}

// 執行測試
testVeoFormat()
  .then(() => {
    console.log("✅ 測試完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 測試失敗:", error);
    process.exit(1);
  });
