/**
 * Video Generation Service
 * 支援多種影片生成提供者：Veo 3.1 Fast、Replicate SVD 或 Hailuo 02
 */

import { VertexAI } from "@google-cloud/vertexai";
import Replicate from "replicate";
import fetch from "node-fetch";
import logger from "../utils/logger.js";
import { uploadVideoToR2 } from "../storage/r2Storage.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import { retryVeoApiCall } from "../utils/retryWithBackoff.js";
import { getCharacterById } from "../services/character/characterCache.service.js";
import { getAiServiceSettings } from "../services/aiSettings.service.js";

const db = getFirestoreDb();

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
 * 從模板構建影片生成提示詞
 * @param {string} template - 提示詞模板
 * @param {object} character - 角色資料
 * @param {array} recentMessages - 最近的對話訊息
 * @returns {string} - 影片生成提示詞
 */
const buildVideoPromptFromTemplate = (template, character, recentMessages = []) => {
  let prompt = template;

  // 替換 {角色背景設定}
  const characterBackground = character.background || "";
  prompt = prompt.replace(/\{角色背景設定\}/g, characterBackground);

  // 替換 {最近對話內容}
  let conversationContext = "";
  if (recentMessages.length > 0) {
    const lastMessages = recentMessages.slice(-3);
    conversationContext = lastMessages
      .map((m) => m.text || m.content)
      .filter(Boolean)
      .join(" ")
      .substring(0, 150);
  }
  prompt = prompt.replace(/\{最近對話內容\}/g, conversationContext);

  return prompt;
};

/**
 * 判斷字串是否為 HTTP(S) URL
 * @param {unknown} value
 * @returns {boolean}
 */
const isValidHttpUrl = (value) => {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
};

/**
 * 安全序列化輸出以供日誌使用
 * @param {unknown} payload
 * @returns {string}
 */
const safeStringify = (payload) => {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

/**
 * 從 Replicate API 的輸出結構中提取影片 URL
 * @param {unknown} output - Replicate 回傳的輸出
 * @param {Set<any>} visited - 用於避免循環引用
 * @returns {string|null}
 */
const extractVideoUrlFromOutput = (output, visited = new Set()) => {
  if (output === null || typeof output === "undefined") {
    return null;
  }

  if (typeof output === "string") {
    return isValidHttpUrl(output) ? output : null;
  }

  if (typeof output !== "object") {
    return null;
  }

  if (visited.has(output)) {
    return null;
  }
  visited.add(output);

  if (Array.isArray(output)) {
    for (const item of output) {
      const candidate = extractVideoUrlFromOutput(item, visited);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  const candidateKeys = [
    "url",
    "videoUrl",
    "video_url",
    "video",
    "result",
    "results",
    "output",
    "outputs",
    "data",
    "data_url",
    "location",
    "href",
  ];

  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(output, key)) {
      const candidate = extractVideoUrlFromOutput(output[key], visited);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
};

/**
 * 生成 Mock 影片（測試模式）
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @returns {Promise<object>} - 生成結果 { videoUrl, duration, resolution, size, isMock }
 */
const generateMockVideo = async (userId, characterId) => {
  logger.warn("[Mock Video] ⚠️ 測試模式啟用：返回模擬影片（不調用 API）");

  // 模擬 API 延遲
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const mockVideoUrl = `https://storage.googleapis.com/mock-videos/character-${characterId}-${Date.now()}.mp4`;
  const mockDuration = "8s";
  const mockResolution = "720p";

  // 儲存 mock 影片記錄到 Firestore
  const videoRecord = {
    userId,
    characterId,
    videoUrl: mockVideoUrl,
    r2Key: null, // mock 模式沒有 R2 key
    size: 1024 * 800, // 800KB
    duration: mockDuration,
    resolution: mockResolution,
    aspectRatio: "9:16",
    prompt: "Mock video for testing",
    isMock: true,
    createdAt: new Date().toISOString(),
  };

  await db.collection("generatedVideos").add(videoRecord);
  logger.info("[Mock Video] 影片記錄已儲存到 Firestore");

  // 同時保存到獨立的相簿
  try {
    const { savePhotoToAlbum } = await import("../photoAlbum/photoAlbum.service.js");
    await savePhotoToAlbum(userId, {
      characterId,
      video: {
        url: mockVideoUrl,
        duration: mockDuration,
        resolution: mockResolution,
      },
      text: "AI 生成的影片（測試）",
      type: 'video',
      messageId: null,
      createdAt: new Date().toISOString(),
    });
    logger.info(`[相簿] Mock 影片已保存到相簿: userId=${userId}, characterId=${characterId}`);
  } catch (albumError) {
    logger.error("[相簿] 保存 mock 影片到相簿失敗:", albumError);
  }

  return {
    videoUrl: mockVideoUrl,
    duration: mockDuration,
    resolution: mockResolution,
    size: 1024 * 800,
    isMock: true,
  };
};

/**
 * 使用 Replicate Stable Video Diffusion 生成影片
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {object} character - 角色資料
 * @param {object} options - 生成選項
 * @returns {Promise<object>} - 生成結果 { videoUrl, duration, resolution, size }
 */
const generateVideoWithReplicate = async (userId, characterId, character, options = {}) => {
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateToken) {
    throw new Error("缺少 REPLICATE_API_TOKEN 環境變數");
  }

  try {
    // 🔥 讀取 AI 設定（Replicate SVD 不使用 prompt，但需要讀取其他設定）
    const videoConfig = await getAiServiceSettings("videoGeneration");

    logger.info("[Replicate SVD] 開始生成影片:", {
      userId,
      characterId,
      characterName: character.name,
    });

    // 獲取圖片 URL（優先使用自定義圖片，否則使用角色預設圖片）
    let imageUrl = options.imageUrl || null;

    if (!imageUrl) {
      // 沒有自定義圖片，使用角色預設圖片
      imageUrl = character.photoUrl || character.avatarUrl || character.imageUrl;
    }

    if (!imageUrl) {
      const error = new Error("角色缺少圖片，無法生成影片");
      error.status = 400;
      throw error;
    }

    if (options.imageUrl) {
      logger.info("[Replicate SVD] 使用自定義圖片（從相簿選擇）:", imageUrl);
    } else {
      logger.info("[Replicate SVD] 使用角色預設圖片:", imageUrl);
    }

    // 初始化 Replicate 客戶端
    // 使用 useFileOutput: false 讓 SDK 直接返回 URL 字串，避免處理 FileOutput 物件
    const replicate = new Replicate({
      auth: replicateToken,
      useFileOutput: false,
    });

    // 調用 Stable Video Diffusion 模型
    logger.info("[Replicate SVD] 發送 API 請求...");

    const output = await replicate.run(
      "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
      {
        input: {
          cond_aug: 0.02,
          decoding_t: 14,
          input_image: imageUrl,
          video_length: "25_frames_with_svd_xt",
          sizing_strategy: "maintain_aspect_ratio",
          motion_bucket_id: 127,
          frames_per_second: 6,
        }
      }
    );

    logger.info("[Replicate SVD] API 回應成功");
    logger.info("[Replicate SVD] Output 類型:", Array.isArray(output) ? "array" : typeof output);

    const tempVideoUrl = extractVideoUrlFromOutput(output);

    if (!tempVideoUrl) {
      logger.error("[Replicate SVD] 無法從 API 回應提取影片 URL", {
        type: typeof output,
        isArray: Array.isArray(output),
        output: safeStringify(output),
      });
      throw new Error("Replicate SVD 無法提供有效的影片 URL");
    }

    logger.info("[Replicate SVD] 臨時影片 URL:", tempVideoUrl);

    // 下載影片
    logger.info("[Replicate SVD] 下載影片...");
    const videoResponse = await fetch(tempVideoUrl);

    if (!videoResponse.ok) {
      throw new Error(`下載影片失敗: ${videoResponse.statusText}`);
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);

    logger.info("[Replicate SVD] 影片下載成功，大小:", Math.round(videoBuffer.length / 1024) + " KB");

    // 上傳到 R2 永久存儲
    logger.info("[Replicate SVD] 開始上傳影片到 R2");

    const uploadResult = await uploadVideoToR2(videoBuffer, userId, characterId, {
      contentType: "video/mp4",
      extension: "mp4",
    });

    logger.info("[Replicate SVD] 影片已上傳到 R2:", {
      url: uploadResult.url,
      size: Math.round(uploadResult.size / 1024) + " KB",
    });

    // 🔥 影片資訊（SVD-XT 生成約 4.2 秒的影片，25 幀 @ 6 FPS）
    const duration = "4.2s"; // SVD 固定為 25 幀 @ 6 FPS
    const resolution = videoConfig.resolution || "720p";

    // 儲存記錄到 Firestore
    const videoRecord = {
      userId,
      characterId,
      videoUrl: uploadResult.url,
      r2Key: uploadResult.key,
      size: uploadResult.size,
      duration,
      resolution,
      aspectRatio: "maintain", // SVD 維持原始比例
      provider: "replicate", // 🔥 使用 Firestore 的提供者類型
      model: videoConfig.model || "stability-ai/stable-video-diffusion", // 🔥 記錄具體模型
      createdAt: new Date().toISOString(),
    };

    await db.collection("generatedVideos").add(videoRecord);
    logger.info("[Replicate SVD] 影片記錄已儲存到 Firestore");

    // 同時保存到獨立的相簿
    try {
      const { savePhotoToAlbum } = await import("../photoAlbum/photoAlbum.service.js");
      await savePhotoToAlbum(userId, {
        characterId,
        video: {
          url: uploadResult.url,
          duration,
          resolution,
        },
        text: "AI 生成的影片",
        type: 'video',
        messageId: null,
        createdAt: new Date().toISOString(),
      });
      logger.info(`[相簿] Replicate 影片已保存到相簿: userId=${userId}, characterId=${characterId}`);
    } catch (albumError) {
      logger.error("[相簿] 保存 Replicate 影片到相簿失敗:", albumError);
    }

    return {
      videoUrl: uploadResult.url,
      duration,
      resolution,
      size: uploadResult.size,
      provider: "replicate", // 🔥 使用 Firestore 的提供者類型
      model: videoConfig.model || "stability-ai/stable-video-diffusion", // 🔥 返回具體模型
    };
  } catch (error) {
    logger.error("[Replicate SVD] 影片生成失敗:");
    logger.error(`  錯誤訊息: ${error.message}`);
    logger.error(`  錯誤類型: ${error.constructor.name}`);
    if (error.stack) {
      logger.error(`  錯誤堆棧:\n${error.stack}`);
    }

    // 如果是已有狀態碼的錯誤，直接拋出
    if (error.status) {
      throw error;
    }

    // 其他錯誤包裝為通用錯誤
    const wrappedError = new Error("影片生成失敗，請稍後再試");
    wrappedError.status = 500;
    wrappedError.originalError = error;
    throw wrappedError;
  }
};

/**
 * 使用 Hailuo 02 生成影片
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {object} character - 角色資料
 * @param {object} options - 生成選項
 * @returns {Promise<object>} - 生成結果 { videoUrl, duration, resolution, size }
 */
const generateVideoWithHailuo = async (userId, characterId, character, options = {}) => {
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateToken) {
    throw new Error("缺少 REPLICATE_API_TOKEN 環境變數");
  }

  try {
    // 🔥 讀取 AI 設定
    const videoConfig = await getAiServiceSettings("videoGeneration");

    logger.info("[Hailuo 02] 開始生成影片:", {
      userId,
      characterId,
      characterName: character.name,
    });

    // 獲取對話記錄
    const conversationRef = db.collection("users").doc(userId)
      .collection("conversations").doc(characterId);
    const conversationDoc = await conversationRef.get();
    const recentMessages = (conversationDoc.data()?.messages || []).slice(-5);

    // 🔥 使用模板生成提示詞（從 Firestore 讀取）
    let prompt = options.prompt || buildVideoPromptFromTemplate(
      videoConfig.videoPromptTemplate,
      character,
      recentMessages
    );

    // ✅ 限制提示詞長度（防止超長提示詞增加成本）
    const MAX_VIDEO_PROMPT_LENGTH = 500;
    if (prompt.length > MAX_VIDEO_PROMPT_LENGTH) {
      logger.warn(`[Hailuo] 提示詞過長 (${prompt.length} 字符)，已截斷至 ${MAX_VIDEO_PROMPT_LENGTH} 字符`);
      prompt = prompt.substring(0, MAX_VIDEO_PROMPT_LENGTH);
    }

    // 獲取圖片 URL（優先使用自定義圖片，否則使用角色預設圖片）
    let imageUrl = options.imageUrl || null;

    if (!imageUrl) {
      // 沒有自定義圖片，使用角色預設圖片
      imageUrl = character.photoUrl || character.avatarUrl || character.imageUrl;
    }

    if (!imageUrl) {
      const error = new Error("角色缺少圖片，無法生成影片");
      error.status = 400;
      throw error;
    }

    // 簡化日誌：只記錄關鍵信息
    logger.info(`[Hailuo 02] 生成影片 - 使用${options.imageUrl ? '自定義' : '預設'}圖片`);

    // 初始化 Replicate 客戶端
    const replicate = new Replicate({
      auth: replicateToken,
      useFileOutput: false,
    });

    // 🔥 調用 Hailuo 02 模型（從 Firestore 讀取參數）
    const replicateModel = videoConfig.model || "minimax/hailuo-02";
    logger.info(`[Hailuo 02] 發送 API 請求... (model: ${replicateModel})`);

    const output = await replicate.run(
      replicateModel,
      {
        input: {
          prompt: prompt,
          duration: videoConfig.durationSeconds || 10,
          resolution: videoConfig.resolution || "512p",
          first_frame_image: imageUrl,
          prompt_optimizer: videoConfig.enhancePrompt !== false, // 從 Firestore 讀取
        }
      }
    );

    logger.info("[Hailuo 02] API 回應成功");

    const tempVideoUrl = extractVideoUrlFromOutput(output);

    if (!tempVideoUrl) {
      logger.error("[Hailuo 02] 無法從 API 回應提取影片 URL", {
        type: typeof output,
        isArray: Array.isArray(output),
        output: safeStringify(output),
      });
      throw new Error("Hailuo 02 無法提供有效的影片 URL");
    }

    logger.info("[Hailuo 02] 臨時影片 URL:", tempVideoUrl);

    // 下載影片
    logger.info("[Hailuo 02] 下載影片...");
    const videoResponse = await fetch(tempVideoUrl);

    if (!videoResponse.ok) {
      throw new Error(`下載影片失敗: ${videoResponse.statusText}`);
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);

    logger.info("[Hailuo 02] 影片下載成功，大小:", Math.round(videoBuffer.length / 1024) + " KB");

    // 上傳到 R2 永久存儲
    logger.info("[Hailuo 02] 開始上傳影片到 R2");

    const uploadResult = await uploadVideoToR2(videoBuffer, userId, characterId, {
      contentType: "video/mp4",
      extension: "mp4",
    });

    logger.info("[Hailuo 02] 影片已上傳到 R2:", {
      url: uploadResult.url,
      size: Math.round(uploadResult.size / 1024) + " KB",
    });

    // 🔥 影片資訊（從 Firestore 讀取）
    const duration = `${videoConfig.durationSeconds || 10}s`;
    const resolution = videoConfig.resolution || "512p";

    // 儲存記錄到 Firestore
    const videoRecord = {
      userId,
      characterId,
      videoUrl: uploadResult.url,
      r2Key: uploadResult.key,
      size: uploadResult.size,
      duration,
      resolution,
      provider: "hailuo", // 🔥 使用 Firestore 的提供者類型
      model: videoConfig.model || "minimax/hailuo-02", // 🔥 記錄具體模型
      createdAt: new Date().toISOString(),
    };

    await db.collection("generatedVideos").add(videoRecord);
    logger.info("[Hailuo 02] 影片記錄已儲存到 Firestore");

    // 同時保存到獨立的相簿
    try {
      const { savePhotoToAlbum } = await import("../photoAlbum/photoAlbum.service.js");
      await savePhotoToAlbum(userId, {
        characterId,
        video: {
          url: uploadResult.url,
          duration,
          resolution,
        },
        text: "AI 生成的影片",
        type: 'video',
        messageId: null,
        createdAt: new Date().toISOString(),
      });
      logger.info(`[相簿] Hailuo 02 影片已保存到相簿: userId=${userId}, characterId=${characterId}`);
    } catch (albumError) {
      logger.error("[相簿] 保存 Hailuo 02 影片到相簿失敗:", albumError);
    }

    return {
      videoUrl: uploadResult.url,
      duration,
      resolution,
      size: uploadResult.size,
      provider: "hailuo", // 🔥 使用 Firestore 的提供者類型
      model: videoConfig.model || "minimax/hailuo-02", // 🔥 返回具體模型
    };
  } catch (error) {
    logger.error("[Hailuo 02] 影片生成失敗:");
    logger.error(`  錯誤訊息: ${error.message}`);
    logger.error(`  錯誤類型: ${error.constructor.name}`);
    if (error.stack) {
      logger.error(`  錯誤堆棧:\n${error.stack}`);
    }

    // 如果是已有狀態碼的錯誤，直接拋出
    if (error.status) {
      throw error;
    }

    // 其他錯誤包裝為通用錯誤
    const wrappedError = new Error("影片生成失敗，請稍後再試");
    wrappedError.status = 500;
    wrappedError.originalError = error;
    throw wrappedError;
  }
};

/**
 * 使用 Veo 3.1 Fast 生成影片
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {object} character - 角色資料
 * @param {object} options - 生成選項
 * @returns {Promise<object>} - 生成結果 { videoUrl, duration, resolution, size }
 */
const generateVideoWithVeo = async (userId, characterId, character, options = {}) => {
  try {
    // 🔥 讀取 AI 設定
    const videoConfig = await getAiServiceSettings("videoGeneration");

    // 獲取最近的對話記錄（用於構建場景）
    const conversationRef = db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(characterId);

    const conversationDoc = await conversationRef.get();
    const conversationData = conversationDoc.data() || {};
    const recentMessages = (conversationData.messages || []).slice(-5);

    // 🔥 使用模板生成提示詞（從 Firestore 讀取）
    let prompt = options.prompt || buildVideoPromptFromTemplate(
      videoConfig.videoPromptTemplate,
      character,
      recentMessages
    );

    // ✅ 限制提示詞長度（防止超長提示詞增加成本）
    const MAX_VIDEO_PROMPT_LENGTH = 500;
    if (prompt.length > MAX_VIDEO_PROMPT_LENGTH) {
      logger.warn(`[Veo] 提示詞過長 (${prompt.length} 字符)，已截斷至 ${MAX_VIDEO_PROMPT_LENGTH} 字符`);
      prompt = prompt.substring(0, MAX_VIDEO_PROMPT_LENGTH);
    }

    logger.info("[Veo] 開始生成影片:", {
      userId,
      characterId,
      promptLength: prompt.length,
    });

    // 初始化 Vertex AI
    const vertexAI = getVertexAIClient();

    // 🔥 獲取生成模型（從 Firestore 讀取）
    const modelName = videoConfig.model || "veo-3.0-fast-generate-001";
    const model = vertexAI.preview.getGenerativeModel({
      model: modelName,
    });

    logger.info(`[Veo] 使用模型: ${modelName}`);

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

    // 🔥 構建生成請求（使用 Firestore 的參數）
    const generateRequest = {
      contents: [
        {
          role: "user",
          parts: contentParts,
        },
      ],
      // Veo 3.0 參數配置（從 Firestore 讀取）
      parameters: {
        durationSeconds: videoConfig.durationSeconds || 8,
        resolution: videoConfig.resolution || "720p",
        sampleCount: videoConfig.sampleCount || 1,
        generateAudio: false,  // Veo 3 必需參數：不生成音頻
        aspectRatio: videoConfig.aspectRatio || "9:16",
        enhancePrompt: videoConfig.enhancePrompt !== false,  // 預設啟用
        compressionQuality: videoConfig.compressionQuality || "optimized",
        personGeneration: videoConfig.personGeneration || "allow_adult",
      },
    };

    // 生成影片（Vertex AI 會返回長時間運行的操作）
    logger.info("[Veo] 發送影片生成請求...");

    let result;
    // 🔥 使用 Firestore 的重試設定
    if (videoConfig.enableRetry !== false) {
      const maxRetries = videoConfig.maxRetries || 3;
      logger.info(`[Veo] 重試已啟用（最多 ${maxRetries} 次）`);
      result = await retryVeoApiCall(async () => {
        return await model.generateContent(generateRequest);
      }, maxRetries);
    } else {
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

    // 儲存記錄到 Firestore（使用 Firestore 的設定）
    const videoRecord = {
      userId,
      characterId,
      videoUrl: uploadResult.url,
      r2Key: uploadResult.key,
      size: uploadResult.size,
      duration: `${videoConfig.durationSeconds}s`,
      resolution: videoConfig.resolution || "720p",
      aspectRatio: videoConfig.aspectRatio || "9:16",
      prompt: prompt.substring(0, 500), // 只儲存前 500 字元
      provider: "veo", // 🔥 使用 Firestore 的提供者類型
      model: videoConfig.model || "veo-3.0-fast-generate-001", // 🔥 記錄具體模型
      createdAt: new Date().toISOString(),
    };

    await db.collection("generatedVideos").add(videoRecord);

    logger.info("[Veo] 影片記錄已儲存到 Firestore");

    // 同時保存到獨立的相簿（確保清除對話後影片仍保留）
    try {
      const { savePhotoToAlbum } = await import("../photoAlbum/photoAlbum.service.js");
      await savePhotoToAlbum(userId, {
        characterId,
        video: {
          url: uploadResult.url,
          duration: options.duration || "8s",
          resolution: options.resolution || "720p",
        },
        text: "AI 生成的影片",
        type: 'video',
        messageId: null, // 影片生成時還沒有消息 ID
        createdAt: new Date().toISOString(),
      });
      logger.info(`[相簿] 影片已保存到相簿: userId=${userId}, characterId=${characterId}`);
    } catch (albumError) {
      // 即使相簿保存失敗，也不影響主流程（影片已經生成並上傳）
      logger.error("[相簿] 保存影片到相簿失敗:", albumError);
    }

    return {
      videoUrl: uploadResult.url,
      duration: `${videoConfig.durationSeconds}s`,
      resolution: videoConfig.resolution || "720p",
      size: uploadResult.size,
      provider: "veo", // 🔥 使用 Firestore 的提供者類型
      model: videoConfig.model || "veo-3.0-fast-generate-001", // 🔥 返回具體模型
    };
  } catch (error) {
    const videoConfig = await getAiServiceSettings("videoGeneration").catch(() => ({ enableRetry: false }));
    logger.error("[Veo] 影片生成失敗" + (videoConfig.enableRetry ? "（所有重試都失敗）" : "") + ":");
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
      const retryInfo = videoConfig.enableRetry
        ? `已嘗試 ${videoConfig.maxRetries || 3} 次重試仍失敗。`
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

/**
 * 生成角色影片（主函數 - 路由器）
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {object} options - 生成選項
 * @returns {Promise<object>} - 生成結果 { videoUrl, duration, resolution, size }
 */
export const generateVideoForCharacter = async (userId, characterId, options = {}) => {
  // 驗證參數
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

  // 🔥 讀取 AI 設定
  const videoConfig = await getAiServiceSettings("videoGeneration");

  // 測試模式優先（從 Firestore 讀取，不管使用哪個提供者）
  if (videoConfig.useMockVideo === true) {
    logger.info("[Video Generation] 使用測試模式（Mock Video）");
    return await generateMockVideo(userId, characterId);
  }

  // 獲取角色資料
  let character = getCharacterById(characterId);

  // 緩存未命中，從 Firestore 查詢
  if (!character) {
    logger.warn(`[Video Generation] 角色 ${characterId} 不在緩存中，查詢 Firestore`);
    const characterDoc = await db.collection("characters").doc(characterId).get();

    if (!characterDoc.exists) {
      const error = new Error("找不到該角色");
      error.status = 404;
      throw error;
    }

    character = characterDoc.data();
  } else {
    logger.info(`[Video Generation] ✅ 從緩存獲取角色: ${characterId}`);
  }

  // 🔥 根據 Firestore 的提供者設定選擇生成方式
  const provider = videoConfig.provider || "veo";
  logger.info(`[Video Generation] 使用提供者: ${provider} (從 Firestore 讀取)`);

  if (provider === "replicate") {
    return await generateVideoWithReplicate(userId, characterId, character, options);
  } else if (provider === "hailuo") {
    return await generateVideoWithHailuo(userId, characterId, character, options);
  } else if (provider === "veo") {
    return await generateVideoWithVeo(userId, characterId, character, options);
  } else {
    const error = new Error(`不支援的影片生成提供者: ${provider}`);
    error.status = 500;
    throw error;
  }
};
