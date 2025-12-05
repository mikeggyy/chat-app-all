/**
 * 影片生成 API 路由（管理後台）
 * 掛載路徑：/api/video-generation
 *
 * 功能：上傳圖片生成影片，使用與前台相同的影片生成邏輯
 */

import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole } from "../middleware/admin.middleware.js";
import Replicate from "replicate";
import fetch from "node-fetch";
import logger from "../utils/logger.js";

// 複用主應用的服務
import { uploadVideoToR2, uploadImageToR2 } from "../../../../chat-app/backend/src/storage/r2Storage.service.js";
import { getAiServiceSettings } from "../../../../chat-app/backend/src/services/aiSettings.service.js";

const router = express.Router();

/**
 * 從 Replicate API 的輸出結構中提取影片 URL
 */
const extractVideoUrlFromOutput = (output, visited = new Set()) => {
  if (output === null || typeof output === "undefined") {
    return null;
  }

  if (typeof output === "string") {
    return /^https?:\/\//i.test(output.trim()) ? output : null;
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
    "url", "videoUrl", "video_url", "video", "result",
    "results", "output", "outputs", "data", "data_url", "location", "href",
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
 * 處理圖片 URL（將 base64 或本地路徑上傳到 R2）
 */
const processImageUrl = async (imageUrl, adminId) => {
  // 檢查是否為 data URL（base64 編碼的圖片）
  if (imageUrl.startsWith("data:")) {
    logger.info("[Admin Video] 檢測到 data URL，解析並上傳到 R2");
    try {
      const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      logger.info(`[Admin Video] 成功解析 data URL (${Math.round(imageBuffer.length / 1024)} KB)`);

      const uploadResult = await uploadImageToR2(imageBuffer, `admin-${adminId}`, "video-source", {
        contentType: "image/webp",
        extension: "webp",
      });

      logger.info("[Admin Video] 圖片已上傳到 R2:", uploadResult.url);
      return uploadResult.url;
    } catch (error) {
      logger.error("[Admin Video] 處理 data URL 失敗:", error);
      throw new Error(`處理圖片失敗: ${error.message}`);
    }
  }

  // 如果已經是完整的公開 URL，直接返回
  if ((imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) &&
      !imageUrl.includes("localhost") &&
      !imageUrl.includes("127.0.0.1")) {
    return imageUrl;
  }

  throw new Error("請提供有效的圖片 URL 或 base64 格式圖片");
};

/**
 * 使用 Replicate Stable Video Diffusion 生成影片
 */
const generateVideoWithReplicate = async (imageUrl, adminId) => {
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateToken) {
    throw new Error("缺少 REPLICATE_API_TOKEN 環境變數");
  }

  const videoConfig = await getAiServiceSettings("videoGeneration");

  logger.info("[Admin Video - Replicate] 開始生成影片");

  // 處理圖片 URL
  const processedImageUrl = await processImageUrl(imageUrl, adminId);

  // 初始化 Replicate 客戶端
  const replicate = new Replicate({
    auth: replicateToken,
    useFileOutput: false,
  });

  logger.info("[Admin Video - Replicate] 發送 API 請求...");

  const output = await replicate.run(
    "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
    {
      input: {
        cond_aug: 0.02,
        decoding_t: 14,
        input_image: processedImageUrl,
        video_length: "25_frames_with_svd_xt",
        sizing_strategy: "maintain_aspect_ratio",
        motion_bucket_id: 127,
        frames_per_second: 6,
      }
    }
  );

  logger.info("[Admin Video - Replicate] API 回應成功");

  const tempVideoUrl = extractVideoUrlFromOutput(output);

  if (!tempVideoUrl) {
    throw new Error("Replicate 無法提供有效的影片 URL");
  }

  // 下載影片
  logger.info("[Admin Video - Replicate] 下載影片...");
  const videoResponse = await fetch(tempVideoUrl);

  if (!videoResponse.ok) {
    throw new Error(`下載影片失敗: ${videoResponse.statusText}`);
  }

  const arrayBuffer = await videoResponse.arrayBuffer();
  const videoBuffer = Buffer.from(arrayBuffer);

  logger.info("[Admin Video - Replicate] 影片下載成功，大小:", Math.round(videoBuffer.length / 1024) + " KB");

  // 上傳到 R2
  const uploadResult = await uploadVideoToR2(videoBuffer, `admin-${adminId}`, "generated", {
    contentType: "video/mp4",
    extension: "mp4",
  });

  logger.info("[Admin Video - Replicate] 影片已上傳到 R2");

  return {
    videoUrl: uploadResult.url,
    duration: "4.2s",
    resolution: videoConfig.resolution || "720p",
    size: uploadResult.size,
    provider: "replicate",
  };
};

/**
 * 使用 Hailuo 02 生成影片
 * @param {string} imageUrl - 圖片 URL
 * @param {string} adminId - 管理員 ID
 * @param {string} prompt - 提示詞
 * @param {object} options - 進階選項
 */
const generateVideoWithHailuo = async (imageUrl, adminId, prompt = "", options = {}) => {
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateToken) {
    throw new Error("缺少 REPLICATE_API_TOKEN 環境變數");
  }

  const videoConfig = await getAiServiceSettings("videoGeneration");

  // 合併選項：請求參數 > videoConfig > 預設值
  const durationSeconds = options.durationSeconds ?? videoConfig.durationSeconds ?? 8;
  const resolution = options.resolution || videoConfig.resolution || "720p";
  const aspectRatio = options.aspectRatio || videoConfig.aspectRatio || "9:16";
  const enhancePrompt = options.enhancePrompt ?? videoConfig.enhancePrompt ?? true;

  logger.info("[Admin Video - Hailuo] 開始生成影片", {
    durationSeconds,
    resolution,
    aspectRatio,
    enhancePrompt,
  });

  // 處理圖片 URL
  const processedImageUrl = await processImageUrl(imageUrl, adminId);

  // 如果沒有提供 prompt，使用預設
  const finalPrompt = prompt || "A natural video of a person with subtle movements, warm lighting, candid documentary style.";

  // 初始化 Replicate 客戶端
  const replicate = new Replicate({
    auth: replicateToken,
    useFileOutput: false,
  });

  const replicateModel = videoConfig.model || "minimax/hailuo-02";
  logger.info(`[Admin Video - Hailuo] 發送 API 請求... (model: ${replicateModel})`);

  const output = await replicate.run(
    replicateModel,
    {
      input: {
        prompt: finalPrompt,
        duration: durationSeconds,
        resolution: resolution,
        aspect_ratio: aspectRatio,
        first_frame_image: processedImageUrl,
        prompt_optimizer: enhancePrompt,
      }
    }
  );

  logger.info("[Admin Video - Hailuo] API 回應成功");

  const tempVideoUrl = extractVideoUrlFromOutput(output);

  if (!tempVideoUrl) {
    throw new Error("Hailuo 無法提供有效的影片 URL");
  }

  // 下載影片
  logger.info("[Admin Video - Hailuo] 下載影片...");
  const videoResponse = await fetch(tempVideoUrl);

  if (!videoResponse.ok) {
    throw new Error(`下載影片失敗: ${videoResponse.statusText}`);
  }

  const arrayBuffer = await videoResponse.arrayBuffer();
  const videoBuffer = Buffer.from(arrayBuffer);

  logger.info("[Admin Video - Hailuo] 影片下載成功，大小:", Math.round(videoBuffer.length / 1024) + " KB");

  // 上傳到 R2
  const uploadResult = await uploadVideoToR2(videoBuffer, `admin-${adminId}`, "generated", {
    contentType: "video/mp4",
    extension: "mp4",
  });

  logger.info("[Admin Video - Hailuo] 影片已上傳到 R2");

  return {
    videoUrl: uploadResult.url,
    duration: `${durationSeconds}s`,
    resolution: resolution,
    aspectRatio: aspectRatio,
    size: uploadResult.size,
    provider: "hailuo",
  };
};

/**
 * POST /api/video-generation/generate
 * 上傳圖片生成影片
 * 🔒 權限：admin 以上
 */
router.post("/generate", requireMinRole("admin"), async (req, res) => {
  try {
    const {
      imageUrl,
      prompt,
      provider: requestedProvider,
      durationSeconds,
      resolution,
      aspectRatio,
      enhancePrompt,
    } = req.body;
    const adminId = req.user?.uid || "unknown";

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: "需要提供圖片 URL 或 base64 圖片",
      });
    }

    logger.info(`[Admin Video] 管理員 ${adminId} 請求生成影片`);

    // 讀取 AI 設定
    const videoConfig = await getAiServiceSettings("videoGeneration");

    // 決定使用哪個提供者
    const provider = requestedProvider || videoConfig.provider || "hailuo";
    logger.info(`[Admin Video] 使用提供者: ${provider}`);

    // 進階選項
    const options = {
      durationSeconds,
      resolution,
      aspectRatio,
      enhancePrompt,
    };

    let result;

    if (provider === "replicate") {
      result = await generateVideoWithReplicate(imageUrl, adminId);
    } else if (provider === "hailuo") {
      result = await generateVideoWithHailuo(imageUrl, adminId, prompt, options);
    } else {
      return res.status(400).json({
        success: false,
        error: `不支援的影片生成提供者: ${provider}`,
      });
    }

    // 保存生成記錄
    await db.collection("adminGeneratedVideos").add({
      adminId,
      ...result,
      prompt: prompt || null,
      createdAt: new Date().toISOString(),
    });

    logger.info("[Admin Video] 影片生成成功:", result.videoUrl);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("[Admin Video] 影片生成失敗:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "影片生成失敗",
    });
  }
});

/**
 * GET /api/video-generation/history
 * 獲取影片生成歷史（支援分頁）
 * 🔒 權限：admin 以上
 */
router.get("/history", requireMinRole("admin"), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const collectionRef = db.collection("adminGeneratedVideos");

    // 獲取總數
    const countSnapshot = await collectionRef.count().get();
    const total = countSnapshot.data().count;

    // 獲取當前頁資料
    let query = collectionRef.orderBy("createdAt", "desc");

    // 如果不是第一頁，需要跳過前面的記錄
    if (offset > 0) {
      // 先獲取要跳過的最後一筆記錄
      const skipSnapshot = await collectionRef
        .orderBy("createdAt", "desc")
        .limit(offset)
        .get();

      if (!skipSnapshot.empty) {
        const lastDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.limit(limit).get();

    const videos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("[Admin Video] 獲取歷史失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取影片生成歷史失敗",
    });
  }
});

/**
 * DELETE /api/video-generation/history/:id
 * 刪除影片生成記錄
 * 🔒 權限：admin 以上
 */
router.delete("/history/:id", requireMinRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.uid || "unknown";

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "需要提供記錄 ID",
      });
    }

    // 檢查記錄是否存在
    const docRef = db.collection("adminGeneratedVideos").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "找不到該記錄",
      });
    }

    // 刪除記錄
    await docRef.delete();

    logger.info(`[Admin Video] 管理員 ${adminId} 刪除了影片記錄 ${id}`);

    res.json({
      success: true,
      message: "記錄已刪除",
    });
  } catch (error) {
    logger.error("[Admin Video] 刪除記錄失敗:", error);
    res.status(500).json({
      success: false,
      error: "刪除記錄失敗",
    });
  }
});

/**
 * GET /api/video-generation/providers
 * 獲取可用的影片生成提供者
 * 🔒 權限：admin 以上
 */
router.get("/providers", requireMinRole("admin"), async (req, res) => {
  try {
    const videoConfig = await getAiServiceSettings("videoGeneration");

    res.json({
      success: true,
      currentProvider: videoConfig.provider || "hailuo",
      // 預設設定（用於前端初始化）
      defaultSettings: {
        durationSeconds: videoConfig.durationSeconds || 8,
        resolution: videoConfig.resolution || "720p",
        aspectRatio: videoConfig.aspectRatio || "9:16",
        enhancePrompt: videoConfig.enhancePrompt !== false,
      },
      providers: [
        {
          id: "hailuo",
          name: "Hailuo 02",
          description: "高品質影片生成，支援提示詞和進階參數設定",
          supportsPrompt: true,
          supportsAdvancedSettings: true,
          defaultDuration: `${videoConfig.durationSeconds || 8}s`,
        },
        {
          id: "replicate",
          name: "Stable Video Diffusion",
          description: "穩定的影片生成，基於圖片動畫（固定參數）",
          supportsPrompt: false,
          supportsAdvancedSettings: false,
          defaultDuration: "4.2s",
        },
      ],
    });
  } catch (error) {
    logger.error("[Admin Video] 獲取提供者列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取提供者列表失敗",
    });
  }
});

export default router;
