/**
 * Gemini AI 圖片生成服務（Nano Banana / Gemini 2.5 Flash Image）
 * 用於生成角色一致性的自拍照片
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";
import { getAiServiceSettings } from "../services/aiSettings.service.js";
import { shouldUseMockMode } from "../utils/envModeHelper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 獲取 Gemini AI 客戶端
 */
const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 GOOGLE_AI_API_KEY 環境變數");
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * 風格映射表（將原本的風格名稱轉換為 Gemini prompt）
 */
const STYLE_PROMPTS = {
  "Disney Charactor": "Disney animation style, vibrant colors, expressive features, stylized proportions, animated character aesthetic",
  "Cinematic": "cinematic photography, dramatic lighting, film-like quality, professional color grading, movie scene aesthetic",
  "Digital Art": "digital art style, clean lines, polished finish, artistic illustration, digital painting",
  "Photographic (Default)": "photorealistic, natural lighting, high quality photography, realistic details",
  "Fantasy art": "fantasy art style, magical atmosphere, ethereal lighting, fantastical elements, artistic interpretation",
  "Neonpunk": "neonpunk aesthetic, cyberpunk vibes, neon lights, futuristic urban setting, vibrant glowing colors",
  "Comic book": "comic book style, bold outlines, pop art colors, graphic novel aesthetic, illustrated",
  "Anime": "anime style, manga-inspired, japanese animation aesthetic, expressive eyes, stylized features"
};

/**
 * 將圖片檔案轉換為 Base64 格式（用於 Gemini API）
 * @param {string} imagePath - 圖片檔案路徑
 * @returns {object} - 包含 inlineData 的物件
 */
const fileToGenerativePart = (imagePath) => {
  const imageData = fs.readFileSync(imagePath);
  return {
    inlineData: {
      data: imageData.toString("base64"),
      mimeType: "image/webp",
    },
  };
};

/**
 * 壓縮圖片為低質量 WebP 格式
 * @param {string} base64String - Base64 編碼的圖片（可含或不含 data URL 前綴）
 * @param {number} quality - WebP 質量 (1-100)，預設從 Firestore 讀取
 * @returns {Promise<string>} - 壓縮後的 Base64 字串（不含前綴）
 */
const compressImageToWebP = async (base64String, quality = 40) => {
  try {
    // 移除 data:image/xxx;base64, 前綴（如果有）
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");

    // 將 base64 轉換為 Buffer
    const buffer = Buffer.from(base64Data, "base64");

    // 使用 sharp 壓縮為 WebP 格式
    const compressedBuffer = await sharp(buffer)
      .webp({ quality }) // 設定 WebP 質量
      .toBuffer();

    // 轉回 base64
    return compressedBuffer.toString("base64");
  } catch (error) {
    logger.error("[Gemini] 圖片壓縮失敗:", error);
    // 壓縮失敗時返回原圖
    return base64String.replace(/^data:image\/\w+;base64,/, "");
  }
};

/**
 * 將 Base64 字串轉換為 Gemini API 格式
 * @param {string} base64String - Base64 編碼的圖片
 * @param {string} mimeType - MIME 類型（預設 image/webp）
 * @returns {object} - 包含 inlineData 的物件
 */
const base64ToGenerativePart = (base64String, mimeType = "image/webp") => {
  // 移除 data:image/xxx;base64, 前綴（如果有）
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");

  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType,
    },
  };
};

/**
 * 使用 Gemini 2.5 Flash Image 生成角色一致性的圖片
 * @param {string} characterImageBase64 - 角色參考圖片（Base64）
 * @param {string} prompt - 圖片生成提示詞
 * @param {object} options - 生成選項
 * @param {string} options.styleName - 風格名稱
 * @param {string} options.aspectRatio - 圖片比例（預設 "2:3"）
 * @returns {Promise<string>} - 生成的圖片 URL
 */
export const generateGeminiImage = async (characterImageBase64, prompt, options = {}) => {
  if (!characterImageBase64 || typeof characterImageBase64 !== "string") {
    const error = new Error("需要提供角色參考照片（Base64）");
    error.status = 400;
    throw error;
  }

  if (!prompt || typeof prompt !== "string") {
    const error = new Error("需要提供圖片生成提示詞");
    error.status = 400;
    throw error;
  }

  try {
    // 🔥 從 Firestore 讀取圖片生成設定
    const imageConfig = await getAiServiceSettings("imageGeneration");

    // 🔧 測試模式：返回測試圖片，不消耗 Gemini API 配額
    // 自動根據環境判斷：NODE_ENV, Git 分支, 主機名等
    if (shouldUseMockMode('image')) {
      logger.info(`[Gemini] 🧪 測試模式啟用，使用測試圖片替代 Gemini API 調用`);

      // 讀取測試圖片並轉為 base64
      const testImagePath = path.join(__dirname, "..", "..", "..", "frontend", "public", "test", "test.webp");
      const testImageBuffer = fs.readFileSync(testImagePath);
      const testImageBase64 = testImageBuffer.toString("base64");
      const imageDataUrl = `data:image/webp;base64,${testImageBase64}`;

      logger.info(`[Gemini] 🧪 測試圖片載入成功，大小: ${Math.round(testImageBase64.length / 1024)} KB`);

      // 返回測試圖片（模擬 Gemini API 的返回格式）
      return {
        imageDataUrl,
        selectedScenario: options.selectedScenario || null,
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
          note: "測試模式 - 未調用 API"
        }
      };
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: imageConfig.model || "gemini-2.5-flash-image"
    });

    logger.info("[Gemini] 開始生成圖片 (model: " + (imageConfig.model || "gemini-2.5-flash-image") + ")");

    // 準備參考圖片
    const referenceImage = base64ToGenerativePart(characterImageBase64);

    // 構建完整的 prompt（包含風格）
    const styleName = options.styleName || "Photographic (Default)";
    const stylePrompt = STYLE_PROMPTS[styleName] || STYLE_PROMPTS["Photographic (Default)"];
    const fullPrompt = `${prompt}\n\nStyle: ${stylePrompt}`;

    // 🔥 使用 Firestore 中的 aspectRatio 設定
    const aspectRatio = options.aspectRatio || imageConfig.aspectRatio || "2:3";

    logger.debug("[Gemini] 輸入參數:", {
      styleName: styleName,
      aspectRatio: aspectRatio,
      promptLength: fullPrompt.length,
      compressionQuality: imageConfig.compressionQuality || 40,
    });

    // 生成圖片（帶參考圖片保持角色一致性）
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            referenceImage,
            {
              text: `Generate an image based on this reference character. Keep the character's appearance consistent.\n\n${fullPrompt}`
            }
          ]
        }
      ],
      generationConfig: {
        // Gemini 2.5 Flash Image 支援的比例
        responseModalities: ["image"],
        imageConfig: {
          aspectRatio: aspectRatio
        }
      }
    });

    const response = result.response;

    // 記錄 token 使用情況（如果 API 有返回）
    const usageMetadata = response.usageMetadata || null;
    if (usageMetadata) {
      logger.info("[Gemini] Token 使用情況:", {
        promptTokens: usageMetadata.promptTokenCount,
        candidatesTokens: usageMetadata.candidatesTokenCount,
        totalTokens: usageMetadata.totalTokenCount,
      });
    } else {
      logger.info("[Gemini] API 未返回 token 使用信息");
    }

    logger.debug("[Gemini] API 回應狀態:", {
      candidates: response.candidates?.length || 0,
      usageMetadata: usageMetadata,
    });

    // 提取生成的圖片
    if (!response.candidates || response.candidates.length === 0) {
      logger.error("[Gemini] 沒有生成候選結果");
      throw new Error("Gemini 未返回生成結果");
    }

    const candidate = response.candidates[0];

    // Gemini 返回的圖片在 content.parts 中
    if (!candidate.content || !candidate.content.parts) {
      logger.error("[Gemini] 候選結果格式錯誤:", candidate);
      throw new Error("Gemini 返回格式錯誤");
    }

    // 尋找圖片部分
    const imagePart = candidate.content.parts.find(part => part.inlineData);

    if (!imagePart || !imagePart.inlineData) {
      logger.error("[Gemini] 未找到圖片數據");
      throw new Error("Gemini 未返回圖片");
    }

    // Gemini 返回的是 base64 編碼的圖片
    const imageBase64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    logger.debug("[Gemini] 原始圖片大小:", Math.round(imageBase64.length / 1024), "KB");

    // 🔥 使用 Firestore 設定的壓縮質量
    const compressionQuality = imageConfig.compressionQuality || 40;
    const compressedBase64 = await compressImageToWebP(imageBase64, compressionQuality);

    // 轉換為 data URL 格式
    const imageDataUrl = `data:image/webp;base64,${compressedBase64}`;

    logger.info("[Gemini] 壓縮後大小:", Math.round(compressedBase64.length / 1024), "KB", `(quality: ${compressionQuality})`);

    // 返回圖片、使用情況、以及選擇的場景（如果有）
    return {
      imageDataUrl,
      selectedScenario: options.selectedScenario || null, // 🔥 返回場景信息供記錄到 Firestore
      usageMetadata: usageMetadata || {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
        note: "API 未返回 token 使用信息"
      }
    };

  } catch (error) {
    logger.error("[Gemini] 圖片生成失敗:");
    logger.error("  錯誤類型:", error.constructor.name);
    logger.error("  錯誤訊息:", error.message);
    if (error.status) {
      logger.error("  HTTP 狀態:", error.status);
    }
    if (error.statusCode) {
      logger.error("  狀態碼:", error.statusCode);
    }
    if (error.code) {
      logger.error("  錯誤代碼:", error.code);
    }
    if (error.details) {
      logger.error("  詳細信息:", JSON.stringify(error.details, null, 2));
    }
    if (error.response) {
      logger.error("  API 回應:", JSON.stringify(error.response, null, 2));
    }
    logger.error("  完整錯誤:", error);

    if (error.status === 400 || error.status === 401) {
      throw error;
    }

    const wrappedError = new Error("Gemini 圖片生成失敗，請稍後再試");
    wrappedError.status = 500;
    wrappedError.originalError = error;
    throw wrappedError;
  }
};

/**
 * ❌ 已移除硬編碼的 SELFIE_SCENARIOS 陣列
 * ✅ 現在從 Firestore 的 ai_settings/global 讀取 imageGeneration.selfieScenarios
 */

/**
 * 構建圖片生成提示詞（Gemini 版本）
 * 🔥 從 Firestore 讀取模板和場景列表，支援變數替換
 * 根據角色資料和最近對話構建詳細的場景描述
 *
 * @param {object} character - 角色資料
 * @param {array} recentMessages - 最近的對話記錄
 * @returns {Promise<object>} - { prompt: string, selectedScenario: string|null }
 */
export const buildGeminiPrompt = async (character, recentMessages = []) => {
  // 🔥 從 Firestore 讀取圖片生成設定
  const imageConfig = await getAiServiceSettings("imageGeneration");

  // 使用 Firestore 中的模板
  let template = imageConfig.imagePromptTemplate || `A natural portrait photo. Character context: {角色背景設定}. Current situation: {最近對話內容}. Scene: The character is {場景描述}. Natural expression, warm lighting, candid photography style. Natural pose and activity. High quality portrait photo. IMPORTANT: No text, no words, no letters, no signs with writing in the image. Pure visual photo only.`;

  // 替換 {角色背景設定}
  const characterBackground = character.background || "";
  template = template.replace(/\{角色背景設定\}/g, characterBackground);

  // 替換 {最近對話內容}
  let conversationContext = "";
  if (recentMessages.length > 0) {
    const lastMessages = recentMessages.slice(-3);
    conversationContext = lastMessages
      .map(m => m.text || m.content)
      .filter(Boolean)
      .join(" ")
      .substring(0, 200);
  }
  template = template.replace(/\{最近對話內容\}/g, conversationContext);

  // 🎯 根據 scenarioSelectionChance 決定是否使用隨機場景
  let selectedScenario = null;
  const scenarioChance = imageConfig.scenarioSelectionChance ?? 0.7; // 預設 70%
  const selfieScenarios = imageConfig.selfieScenarios || [];

  if (selfieScenarios.length > 0 && Math.random() < scenarioChance) {
    // 隨機選擇一個場景
    const randomIndex = Math.floor(Math.random() * selfieScenarios.length);
    selectedScenario = selfieScenarios[randomIndex];

    logger.info(`[Gemini Prompt] 🎲 選擇隨機場景 (${randomIndex + 1}/${selfieScenarios.length}): "${selectedScenario}"`);
  } else {
    logger.info("[Gemini Prompt] 📝 不使用隨機場景 (根據 scenarioSelectionChance 或場景列表為空)");
  }

  // 替換 {場景描述}
  const sceneDescription = selectedScenario || "in a natural everyday setting";
  template = template.replace(/\{場景描述\}/g, sceneDescription);

  logger.debug("[Gemini Prompt] 生成的 prompt 長度:", template.length);

  return {
    prompt: template,
    selectedScenario: selectedScenario // 🔥 返回選擇的場景供後續記錄
  };
};
