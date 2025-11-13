/**
 * Cloudflare R2 Storage Service
 * 用於上傳和管理影片檔案
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import logger from "../utils/logger.js";
import { compressImage } from "../utils/imageCompression.service.js";

/**
 * 初始化 R2 客戶端
 */
const getR2Client = () => {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("缺少 R2 環境變數配置（R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY）");
  }

  return new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
};

/**
 * 生成唯一的檔案名稱
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {string} extension - 檔案副檔名（預設 mp4）
 * @param {string} type - 檔案類型（video 或 photo）
 * @returns {string} - 唯一檔案名稱
 */
const generateFileName = (userId, characterId, extension = "mp4", type = "videos") => {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString("hex");
  return `${type}/${userId}/${characterId}/${timestamp}-${randomHash}.${extension}`;
};

/**
 * 上傳影片到 R2
 * @param {Buffer} videoBuffer - 影片 Buffer
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {object} options - 選項
 * @returns {Promise<object>} - 上傳結果 { url, key }
 */
export const uploadVideoToR2 = async (videoBuffer, userId, characterId, options = {}) => {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucketName) {
    throw new Error("缺少 R2_BUCKET_NAME 環境變數");
  }

  if (!videoBuffer || !Buffer.isBuffer(videoBuffer)) {
    throw new Error("需要提供有效的影片 Buffer");
  }

  try {
    const client = getR2Client();
    const fileName = generateFileName(userId, characterId, options.extension || "mp4");

    logger.info("[R2] 開始上傳影片:", {
      fileName,
      size: Math.round(videoBuffer.length / 1024) + " KB",
    });

    // 上傳到 R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: videoBuffer,
      ContentType: options.contentType || "video/mp4",
      CacheControl: "public, max-age=31536000", // 1 年快取
    });

    await client.send(command);

    // 構建公開 URL
    const videoUrl = publicUrl
      ? `${publicUrl}/${fileName}`
      : `https://${bucketName}.r2.cloudflarestorage.com/${fileName}`;

    logger.info("[R2] 影片上傳成功:", {
      fileName,
      url: videoUrl,
    });

    return {
      url: videoUrl,
      key: fileName,
      size: videoBuffer.length,
    };
  } catch (error) {
    logger.error("[R2] 影片上傳失敗:", error);
    throw new Error("影片上傳到 R2 失敗");
  }
};

/**
 * 刪除 R2 上的影片
 * @param {string} key - 檔案 Key
 * @returns {Promise<void>}
 */
export const deleteVideoFromR2 = async (key) => {
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("缺少 R2_BUCKET_NAME 環境變數");
  }

  try {
    const client = getR2Client();

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await client.send(command);

    logger.info("[R2] 影片刪除成功:", { key });
  } catch (error) {
    logger.error("[R2] 影片刪除失敗:", error);
    throw new Error("影片刪除失敗");
  }
};

/**
 * 生成預簽名 URL（用於臨時私密存取）
 * @param {string} key - 檔案 Key
 * @param {number} expiresIn - 過期時間（秒）
 * @returns {Promise<string>} - 預簽名 URL
 */
export const getSignedVideoUrl = async (key, expiresIn = 3600) => {
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("缺少 R2_BUCKET_NAME 環境變數");
  }

  try {
    const client = getR2Client();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(client, command, {
      expiresIn,
    });

    return signedUrl;
  } catch (error) {
    logger.error("[R2] 預簽名 URL 生成失敗:", error);
    throw new Error("預簽名 URL 生成失敗");
  }
};

/**
 * 上傳圖片到 R2（含智能壓縮）
 * @param {Buffer|string} imageData - 圖片 Buffer 或 base64 字串
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID（可選，用於組織檔案結構）
 * @param {object} options - 選項
 * @param {string} options.contentType - MIME 類型
 * @param {string} options.extension - 檔案副檔名
 * @param {boolean} options.compress - 是否壓縮（默認 true）
 * @param {string} options.compressionQuality - 壓縮質量（high, standard, low, thumbnail），默認 standard
 * @param {number} options.maxWidth - 最大寬度（覆蓋預設）
 * @param {number} options.maxHeight - 最大高度（覆蓋預設）
 * @returns {Promise<object>} - 上傳結果 { url, key, size, compressionStats }
 */
export const uploadImageToR2 = async (imageData, userId, characterId = "general", options = {}) => {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucketName) {
    throw new Error("缺少 R2_BUCKET_NAME 環境變數");
  }

  if (!imageData) {
    throw new Error("需要提供有效的圖片數據");
  }

  // ✅ 壓縮選項（默認啟用）
  const {
    compress = true,
    compressionQuality = "standard",
    maxWidth = null,
    maxHeight = null,
  } = options;

  try {
    // 處理 base64 數據
    let imageBuffer;
    if (typeof imageData === "string") {
      // 移除 data URL 前綴（如果有）
      const base64String = imageData.replace(/^data:image\/\w+;base64,/, "");
      imageBuffer = Buffer.from(base64String, "base64");
    } else if (Buffer.isBuffer(imageData)) {
      imageBuffer = imageData;
    } else {
      throw new Error("不支援的圖片數據格式");
    }

    const originalSize = imageBuffer.length;
    let compressionStats = null;

    // ✅ 圖片壓縮（如果啟用）
    if (compress) {
      try {
        logger.info("[R2] 壓縮圖片中...", {
          originalSize: Math.round(originalSize / 1024) + " KB",
          quality: compressionQuality,
        });

        const compressionResult = await compressImage(imageBuffer, {
          format: options.extension || "webp",
          quality: compressionQuality,
          maxWidth,
          maxHeight,
        });

        imageBuffer = compressionResult.buffer;
        compressionStats = compressionResult.metadata;

        logger.info("[R2] 圖片壓縮完成:", {
          before: Math.round(originalSize / 1024) + " KB",
          after: Math.round(imageBuffer.length / 1024) + " KB",
          saved: compressionStats.compressionRatio + "%",
        });
      } catch (compressionError) {
        // 壓縮失敗不影響上傳，使用原始圖片
        logger.warn("[R2] 圖片壓縮失敗，使用原始圖片:", compressionError.message);
      }
    } else {
      logger.debug("[R2] 跳過圖片壓縮（compress=false）");
    }

    const client = getR2Client();
    const extension = options.extension || "webp";
    const fileName = generateFileName(userId, characterId, extension, "photos");

    logger.info("[R2] 開始上傳圖片:", {
      fileName,
      size: Math.round(imageBuffer.length / 1024) + " KB",
    });

    // 上傳到 R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: imageBuffer,
      ContentType: options.contentType || "image/webp",
      CacheControl: "public, max-age=31536000", // 1 年快取
    });

    await client.send(command);

    // 構建公開 URL
    const imageUrl = publicUrl
      ? `${publicUrl}/${fileName}`
      : `https://${bucketName}.r2.cloudflarestorage.com/${fileName}`;

    logger.info("[R2] 圖片上傳成功:", {
      fileName,
      url: imageUrl,
      finalSize: Math.round(imageBuffer.length / 1024) + " KB",
    });

    return {
      url: imageUrl,
      key: fileName,
      size: imageBuffer.length,
      compressionStats,
    };
  } catch (error) {
    logger.error("[R2] 圖片上傳失敗:", error);
    throw new Error(`圖片上傳到 R2 失敗: ${error.message}`);
  }
};

/**
 * 刪除 R2 上的圖片
 * @param {string} key - 檔案 Key
 * @returns {Promise<void>}
 */
export const deleteImageFromR2 = async (key) => {
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("缺少 R2_BUCKET_NAME 環境變數");
  }

  try {
    const client = getR2Client();

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await client.send(command);

    logger.info("[R2] 圖片刪除成功:", { key });
  } catch (error) {
    logger.error("[R2] 圖片刪除失敗:", error);
    throw new Error("圖片刪除失敗");
  }
};
