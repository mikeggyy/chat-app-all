/**
 * Veo 3.1 Fast Video Generation Service
 * 用於生成角色相關的短影片
 */

import { VertexAI } from "@google-cloud/vertexai";
import fetch from "node-fetch";
import logger from "../utils/logger.js";
import { uploadVideoToR2 } from "../storage/r2Storage.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import { retryVeoApiCall } from "../utils/retryWithBackoff.js";
import { getCharacterById } from "../services/character/characterCache.service.js";

const db = getFirestoreDb();

// 測試模式開關（配額不足時使用）
const USE_MOCK_VIDEO = process.env.USE_MOCK_VIDEO === "true";

// 重試策略配置
const ENABLE_RETRY = process.env.VEO_ENABLE_RETRY !== "false"; // 預設啟用
const MAX_RETRIES = parseInt(process.env.VEO_MAX_RETRIES || "3");

/**
 * 獲取 Vertex AI 客戶端
 */
const getVertexAIClient = () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  if (!projectId) {
    throw new Error("缺少 GOOGLE_CLOUD_PROJECT_ID 環境變數");
  }

  // Vertex AI 會自動使用應用程式預設憑證 (Application Default Credentials)
  // 本地開發：使用 GOOGLE_APPLICATION_CREDENTIALS 環境變數指定的服務帳號金鑰
  // 生產環境：使用 Cloud Run 的服務帳號
  return new VertexAI({
    project: projectId,
    location: location,
  });
};

/**
 * 構建影片生成提示詞
 * @param {object} character - 角色資料
 * @param {array} recentMessages - 最近的對話訊息
 * @returns {string} - 影片生成提示詞
 */
const buildVideoPrompt = (character, recentMessages = []) => {
  // 基礎場景描述
  let prompt = `A short video clip featuring a person. `;

  // 添加角色背景信息
  if (character.background) {
    prompt += `Character context: ${character.background}. `;
  }

  // 從最近對話中提取場景線索
  if (recentMessages.length > 0) {
    const lastMessages = recentMessages.slice(-3);
    const conversationContext = lastMessages
      .map((m) => m.text || m.content)
      .filter(Boolean)
      .join(" ");

    if (conversationContext.length > 0) {
      prompt += `Current situation: ${conversationContext.substring(0, 150)}. `;
    }
  }

  // 添加影片風格描述
  prompt += `Create a natural, candid video moment. The person can be engaged in daily activities like talking, smiling, walking, or relaxing. Natural expressions, warm lighting, documentary style. The setting can be indoors or outdoors, creating an authentic and relatable atmosphere. Keep the video simple and focused on the person.`;

  return prompt;
};

/**
 * 使用 Veo 3.1 Fast 生成影片
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {object} options - 生成選項
 * @returns {Promise<object>} - 生成結果 { videoUrl, thumbnailUrl, duration }
 */
export const generateVideoForCharacter = async (userId, characterId, options = {}) => {
  if (!userId || typeof userId !== "string") {
    const error = new Error("需要提供用戶 ID");
    error.status = 400;
    throw error;
  }

  if (!characterId || typeof characterId !== "string") {
    const error = new Error("需要提供角色 ID");
    error.status = 400;
    throw error;
  }

  // 測試模式：返回模擬影片（不消耗 API 配額）
  if (USE_MOCK_VIDEO) {
    logger.warn("[Veo] ⚠️ 測試模式啟用：返回模擬影片（不調用 API）");

    // 模擬 API 延遲
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      videoUrl: `https://storage.googleapis.com/mock-videos/character-${characterId}-${Date.now()}.mp4`,
      duration: "8s",
      resolution: "720p",
      size: 1024 * 800, // 800KB
      isMock: true, // 標記為測試影片
    };
  }

  try {
    // ✅ 優先從緩存獲取角色資料
    let character = getCharacterById(characterId);

    // ⚠️ 緩存未命中，回退到 Firestore
    if (!character) {
      logger.warn(`[Veo] 角色 ${characterId} 不在緩存中，查詢 Firestore`);
      const characterDoc = await db.collection("characters").doc(characterId).get();

      if (!characterDoc.exists) {
        const error = new Error("找不到該角色");
        error.status = 404;
        throw error;
      }

      character = characterDoc.data();
    } else {
      logger.info(`[Veo] ✅ 從緩存獲取角色: ${characterId}`);
    }

    // 獲取最近的對話記錄（用於構建場景）
    const conversationRef = db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(characterId);

    const conversationDoc = await conversationRef.get();
    const conversationData = conversationDoc.data() || {};
    const recentMessages = (conversationData.messages || []).slice(-5);

    // 構建提示詞
    const prompt = options.prompt || buildVideoPrompt(character, recentMessages);

    logger.info("[Veo] 開始生成影片:", {
      userId,
      characterId,
      promptLength: prompt.length,
    });

    // 初始化 Vertex AI
    const vertexAI = getVertexAIClient();

    // 獲取生成模型
    const model = vertexAI.preview.getGenerativeModel({
      model: "veo-3.0-fast-generate-001", // Veo 3.0 Fast (穩定版)
    });

    logger.info("[Veo] 模型初始化完成，準備生成影片");

    // 準備 contents parts（包含提示詞和角色圖片）
    const contentParts = [];

    // 添加角色圖片（如果有）
    if (character.photoUrl || character.avatarUrl || character.imageUrl) {
      const imageUrl = character.photoUrl || character.avatarUrl || character.imageUrl;

      try {
        logger.info("[Veo] 正在下載角色圖片:", imageUrl);

        // 下載圖片
        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
          logger.warn("[Veo] 無法下載角色圖片，將只使用文字提示");
        } else {
          const arrayBuffer = await imageResponse.arrayBuffer();
          const imageBuffer = Buffer.from(arrayBuffer);
          const imageBase64 = imageBuffer.toString("base64");

          logger.info("[Veo] 角色圖片已轉換為 Base64，大小:", Math.round(imageBuffer.length / 1024) + " KB");

          // 添加圖片到 contents
          contentParts.push({
            inlineData: {
              mimeType: "image/jpeg", // 假設是 JPEG，也可以根據 URL 判斷
              data: imageBase64,
            },
          });
        }
      } catch (error) {
        logger.warn("[Veo] 下載角色圖片失敗:", error.message);
        logger.warn("[Veo] 將只使用文字提示生成影片");
      }
    }

    // 添加文字提示
    contentParts.push({
      text: prompt,
    });

    // 構建生成請求
    const generateRequest = {
      contents: [
        {
          role: "user",
          parts: contentParts,
        },
      ],
      // Veo 3.0 參數配置（根據官方文檔）
      parameters: {
        durationSeconds: 8,              // 使用參考圖片時必須是 8 秒
        resolution: "720p",              // 解析度：720p 或 1080p
        sampleCount: 1,                  // 生成 1 個樣本 (1-4)
        generateAudio: false,            // Veo 3 必需參數：不生成音頻
        aspectRatio: "9:16",             // 垂直影片（適合手機）
        enhancePrompt: true,             // 使用 Gemini 強化提示
        compressionQuality: "optimized", // 優化壓縮（或 "lossless"）
        personGeneration: "allow_adult", // 允許成人人物生成
      },
    };

    // 生成影片（Vertex AI 會返回長時間運行的操作）
    logger.info("[Veo] 發送影片生成請求...");

    let result;
    if (ENABLE_RETRY) {
      // 使用重試策略
      logger.info(`[Veo] 重試已啟用（最多 ${MAX_RETRIES} 次）`);
      result = await retryVeoApiCall(async () => {
        return await model.generateContent(generateRequest);
      });
    } else {
      // 不使用重試（原始行為）
      logger.info("[Veo] 重試已停用");
      result = await model.generateContent(generateRequest);
    }

    logger.debug("[Veo] API 回應狀態:", {
      response: result.response ? "已返回" : "無回應",
    });

    // 提取生成的影片數據
    if (!result.response) {
      logger.error("[Veo] 沒有收到回應");
      throw new Error("Veo 未返回生成結果");
    }

    const response = result.response;

    // 從回應中提取影片數據
    let videoData = null;
    let videoBuffer = null;

    // 檢查是否有候選回應
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          // 檢查是否有 inlineData（Base64 編碼的影片）
          if (part.inlineData && part.inlineData.data) {
            logger.info("[Veo] 找到 inline 影片數據");
            videoBuffer = Buffer.from(part.inlineData.data, "base64");
            break;
          }

          // 檢查是否有 fileData（GCS URI）
          if (part.fileData && part.fileData.fileUri) {
            logger.info("[Veo] 找到影片 URI:", part.fileData.fileUri);
            // 如果是 GCS URI，我們需要下載它
            // 這部分可能需要額外的處理
            const error = new Error(
              "目前不支持從 GCS URI 下載影片，請聯繫技術支持"
            );
            error.status = 501; // Not Implemented
            throw error;
          }
        }
      }
    }

    if (!videoBuffer) {
      logger.error("[Veo] 無法提取影片數據");
      logger.error("[Veo] 回應結構:", JSON.stringify(response, null, 2));
      throw new Error("Veo 返回格式錯誤：無法找到影片數據");
    }

    logger.info("[Veo] 影片數據提取成功，大小:", Math.round(videoBuffer.length / 1024) + " KB");

    logger.info("[Veo] 開始上傳影片到 R2");

    // 上傳到 R2 永久存儲
    const uploadResult = await uploadVideoToR2(videoBuffer, userId, characterId, {
      contentType: "video/mp4",
      extension: "mp4",
    });

    logger.info("[Veo] 影片已上傳到 R2:", {
      url: uploadResult.url,
      size: Math.round(uploadResult.size / 1024) + " KB",
    });

    // 儲存記錄到 Firestore
    const videoRecord = {
      userId,
      characterId,
      videoUrl: uploadResult.url,
      r2Key: uploadResult.key,
      size: uploadResult.size,
      duration: options.duration || "8s",
      resolution: options.resolution || "720p",
      aspectRatio: options.aspectRatio || "9:16",
      prompt: prompt.substring(0, 500), // 只儲存前 500 字元
      createdAt: new Date().toISOString(),
    };

    await db.collection("generatedVideos").add(videoRecord);

    logger.info("[Veo] 影片記錄已儲存到 Firestore");

    return {
      videoUrl: uploadResult.url,
      duration: options.duration || "8s",
      resolution: options.resolution || "720p",
      size: uploadResult.size,
    };
  } catch (error) {
    logger.error("[Veo] 影片生成失敗" + (ENABLE_RETRY ? "（所有重試都失敗）" : "") + ":");
    logger.error(`  錯誤訊息: ${error.message}`);
    logger.error(`  錯誤類型: ${error.constructor.name}`);
    logger.error(`  錯誤狀態: ${error.status}`);
    if (error.stack) {
      logger.error(`  錯誤堆棧:\n${error.stack}`);
    }
    if (error.originalError) {
      logger.error(`  原始錯誤: ${error.originalError}`);
    }

    // 處理 429 配額超限錯誤
    if (error.message && error.message.includes("429")) {
      const retryInfo = ENABLE_RETRY
        ? `已嘗試 ${MAX_RETRIES} 次重試仍失敗。`
        : "";
      const quotaError = new Error(
        `影片生成服務暫時繁忙，${retryInfo}請稍後再試或聯繫管理員增加配額。`
      );
      quotaError.status = 429;
      quotaError.originalError = error;
      throw quotaError;
    }

    // 直接拋出帶有狀態碼的錯誤（400, 404, 503 等）
    if (error.status === 400 || error.status === 404 || error.status === 503) {
      throw error;
    }

    // 其他錯誤包裝為通用錯誤
    const wrappedError = new Error("影片生成失敗，請稍後再試");
    wrappedError.status = 500;
    wrappedError.originalError = error;
    throw wrappedError;
  }
};
