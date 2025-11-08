/**
 * Gemini AI 圖片生成服務（Nano Banana / Gemini 2.5 Flash Image）
 * 用於生成角色一致性的自拍照片
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import logger from "../utils/logger.js";

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
 * @param {number} quality - WebP 質量 (1-100)，預設 30（降低以適應 Firestore 限制）
 * @returns {Promise<string>} - 壓縮後的 Base64 字串（不含前綴）
 */
const compressImageToWebP = async (base64String, quality = 30) => {
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
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image"
    });

    logger.info("[Gemini] 開始生成圖片");

    // 準備參考圖片
    const referenceImage = base64ToGenerativePart(characterImageBase64);

    // 構建完整的 prompt（包含風格）
    const styleName = options.styleName || "Photographic (Default)";
    const stylePrompt = STYLE_PROMPTS[styleName] || STYLE_PROMPTS["Photographic (Default)"];
    const fullPrompt = `${prompt}\n\nStyle: ${stylePrompt}`;

    logger.debug("[Gemini] 輸入參數:", {
      styleName: styleName,
      aspectRatio: options.aspectRatio || "2:3",
      promptLength: fullPrompt.length,
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
          aspectRatio: options.aspectRatio || "2:3"
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

    // 壓縮圖片為 WebP 格式（質量 40）- 降低質量以節省儲存和傳輸成本
    const compressedBase64 = await compressImageToWebP(imageBase64, 40);

    // 轉換為 data URL 格式
    const imageDataUrl = `data:image/webp;base64,${compressedBase64}`;

    logger.info("[Gemini] 壓縮後大小:", Math.round(compressedBase64.length / 1024), "KB");

    // 返回圖片和使用情況
    return {
      imageDataUrl,
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
 * 構建圖片生成提示詞（Gemini 版本）
 * 根據角色資料和最近對話構建詳細的場景描述
 */
export const buildGeminiPrompt = (character, recentMessages = []) => {
  // 基礎場景描述
  let prompt = `A natural portrait photo. `;

  // 添加角色背景信息
  if (character.background) {
    prompt += `Character context: ${character.background}. `;
  }

  // 從最近對話中提取場景線索
  if (recentMessages.length > 0) {
    const lastMessages = recentMessages.slice(-3);
    const conversationContext = lastMessages
      .map(m => m.text || m.content)
      .filter(Boolean)
      .join(" ");

    if (conversationContext.length > 0) {
      prompt += `Current situation: ${conversationContext.substring(0, 200)}. `;
    }
  }

  // 添加攝影風格描述
  prompt += `Capture a natural moment in the current scene. The character can be doing any activity or in any pose that fits the context - sitting, standing, walking, relaxing, or engaging in daily activities. Natural expression, warm lighting, candid photography style. The setting can be anywhere fitting - indoors, outdoors, café, street, park, bedroom, or any comfortable space. No need to hold a phone or camera - just a natural portrait. `;

  return prompt;
};
