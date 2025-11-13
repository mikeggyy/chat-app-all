/**
 * 圖片壓縮服務
 * 使用 sharp 庫對圖片進行優化壓縮
 * 目標：減少存儲成本和帶寬消耗，同時保持良好的視覺質量
 */

import sharp from "sharp";
import logger from "./logger.js";

/**
 * 壓縮配置預設值
 */
const COMPRESSION_PRESETS = {
  // 高質量（適合用戶頭像、角色肖像）
  high: {
    webp: { quality: 85, effort: 4 },
    jpeg: { quality: 85, progressive: true },
    png: { compressionLevel: 6 },
    maxWidth: 1920,
    maxHeight: 1920,
  },
  // 標準質量（適合一般圖片、聊天圖片）
  standard: {
    webp: { quality: 80, effort: 4 },
    jpeg: { quality: 80, progressive: true },
    png: { compressionLevel: 7 },
    maxWidth: 1600,
    maxHeight: 1600,
  },
  // 低質量（適合縮略圖）
  low: {
    webp: { quality: 70, effort: 3 },
    jpeg: { quality: 70, progressive: true },
    png: { compressionLevel: 8 },
    maxWidth: 800,
    maxHeight: 800,
  },
  // 縮略圖（非常小）
  thumbnail: {
    webp: { quality: 60, effort: 2 },
    jpeg: { quality: 60, progressive: true },
    png: { compressionLevel: 9 },
    maxWidth: 400,
    maxHeight: 400,
  },
};

/**
 * 壓縮圖片（從 Buffer 到 Buffer）
 * @param {Buffer} imageBuffer - 原始圖片 Buffer
 * @param {Object} options - 壓縮選項
 * @param {string} options.format - 輸出格式（webp, jpeg, png），默認 webp
 * @param {string} options.quality - 質量預設（high, standard, low, thumbnail），默認 standard
 * @param {number} options.maxWidth - 最大寬度（覆蓋預設）
 * @param {number} options.maxHeight - 最大高度（覆蓋預設）
 * @param {boolean} options.maintainAspectRatio - 保持寬高比，默認 true
 * @returns {Promise<{buffer: Buffer, metadata: Object}>} 壓縮後的圖片和元數據
 */
export const compressImage = async (imageBuffer, options = {}) => {
  const {
    format = "webp",
    quality = "standard",
    maxWidth = null,
    maxHeight = null,
    maintainAspectRatio = true,
  } = options;

  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error("需要提供有效的圖片 Buffer");
  }

  try {
    // 獲取預設配置
    const preset = COMPRESSION_PRESETS[quality] || COMPRESSION_PRESETS.standard;
    const targetWidth = maxWidth || preset.maxWidth;
    const targetHeight = maxHeight || preset.maxHeight;

    // 獲取原始圖片元數據
    const originalMetadata = await sharp(imageBuffer).metadata();
    logger.debug("[圖片壓縮] 原始圖片信息:", {
      format: originalMetadata.format,
      width: originalMetadata.width,
      height: originalMetadata.height,
      size: Math.round(imageBuffer.length / 1024) + " KB",
    });

    // 開始處理圖片
    let pipeline = sharp(imageBuffer);

    // 調整尺寸（如果需要）
    const needsResize =
      originalMetadata.width > targetWidth || originalMetadata.height > targetHeight;

    if (needsResize) {
      const resizeOptions = {
        fit: maintainAspectRatio ? "inside" : "cover",
        withoutEnlargement: true, // 不放大小圖片
      };

      pipeline = pipeline.resize(targetWidth, targetHeight, resizeOptions);

      logger.debug("[圖片壓縮] 調整尺寸:", {
        from: `${originalMetadata.width}x${originalMetadata.height}`,
        to: `最大 ${targetWidth}x${targetHeight}`,
      });
    }

    // 根據格式應用壓縮
    switch (format) {
      case "webp":
        pipeline = pipeline.webp(preset.webp);
        break;
      case "jpeg":
      case "jpg":
        pipeline = pipeline.jpeg(preset.jpeg);
        break;
      case "png":
        pipeline = pipeline.png(preset.png);
        break;
      default:
        // 默認使用 WebP（通常最優）
        pipeline = pipeline.webp(preset.webp);
    }

    // 執行壓縮
    const compressedBuffer = await pipeline.toBuffer();
    const compressedMetadata = await sharp(compressedBuffer).metadata();

    // 計算壓縮率
    const originalSize = imageBuffer.length;
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    logger.info("[圖片壓縮] 壓縮完成:", {
      format: compressedMetadata.format,
      size: {
        before: Math.round(originalSize / 1024) + " KB",
        after: Math.round(compressedSize / 1024) + " KB",
        saved: compressionRatio + "%",
      },
      dimensions: {
        before: `${originalMetadata.width}x${originalMetadata.height}`,
        after: `${compressedMetadata.width}x${compressedMetadata.height}`,
      },
    });

    return {
      buffer: compressedBuffer,
      metadata: {
        format: compressedMetadata.format,
        width: compressedMetadata.width,
        height: compressedMetadata.height,
        size: compressedSize,
        originalSize: originalSize,
        compressionRatio: parseFloat(compressionRatio),
      },
    };
  } catch (error) {
    logger.error("[圖片壓縮] 壓縮失敗:", error);
    throw new Error(`圖片壓縮失敗: ${error.message}`);
  }
};

/**
 * 壓縮 Base64 圖片
 * @param {string} base64Data - Base64 圖片數據（可包含或不包含 data URL 前綴）
 * @param {Object} options - 壓縮選項（同 compressImage）
 * @returns {Promise<{base64: string, metadata: Object}>} 壓縮後的 Base64 和元數據
 */
export const compressBase64Image = async (base64Data, options = {}) => {
  if (!base64Data || typeof base64Data !== "string") {
    throw new Error("需要提供有效的 Base64 字符串");
  }

  try {
    // 移除 data URL 前綴（如果有）
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64String, "base64");

    // 壓縮圖片
    const result = await compressImage(imageBuffer, options);

    // 確定 MIME type
    const format = options.format || "webp";
    const mimeType = format === "webp" ? "image/webp" :
                     format === "jpeg" || format === "jpg" ? "image/jpeg" :
                     format === "png" ? "image/png" :
                     "image/webp";

    // 轉換回 Base64
    const compressedBase64 = result.buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${compressedBase64}`;

    return {
      base64: dataUrl,
      metadata: result.metadata,
    };
  } catch (error) {
    logger.error("[圖片壓縮] Base64 壓縮失敗:", error);
    throw new Error(`Base64 圖片壓縮失敗: ${error.message}`);
  }
};

/**
 * 批量壓縮圖片
 * @param {Array<Buffer>} imageBuffers - 圖片 Buffer 數組
 * @param {Object} options - 壓縮選項
 * @returns {Promise<Array>} 壓縮結果數組
 */
export const compressImageBatch = async (imageBuffers, options = {}) => {
  if (!Array.isArray(imageBuffers) || imageBuffers.length === 0) {
    throw new Error("需要提供有效的圖片 Buffer 數組");
  }

  logger.info(`[圖片壓縮] 開始批量壓縮 ${imageBuffers.length} 張圖片`);

  try {
    const results = await Promise.all(
      imageBuffers.map((buffer, index) =>
        compressImage(buffer, options).catch((error) => {
          logger.error(`[圖片壓縮] 批量壓縮第 ${index + 1} 張失敗:`, error);
          return null;
        })
      )
    );

    const successCount = results.filter((r) => r !== null).length;
    logger.info(`[圖片壓縮] 批量壓縮完成: ${successCount}/${imageBuffers.length} 成功`);

    return results;
  } catch (error) {
    logger.error("[圖片壓縮] 批量壓縮失敗:", error);
    throw new Error(`批量壓縮失敗: ${error.message}`);
  }
};

/**
 * 獲取可用的壓縮預設列表
 * @returns {Object} 預設配置對象
 */
export const getAvailablePresets = () => {
  return Object.keys(COMPRESSION_PRESETS).reduce((acc, key) => {
    acc[key] = {
      ...COMPRESSION_PRESETS[key],
      description: getPresetDescription(key),
    };
    return acc;
  }, {});
};

/**
 * 獲取預設描述
 * @param {string} presetName - 預設名稱
 * @returns {string} 描述文字
 */
function getPresetDescription(presetName) {
  switch (presetName) {
    case "high":
      return "高質量（適合用戶頭像、角色肖像）";
    case "standard":
      return "標準質量（適合一般圖片、聊天圖片）";
    case "low":
      return "低質量（適合內容預覽）";
    case "thumbnail":
      return "縮略圖（最小文件大小）";
    default:
      return "未知預設";
  }
}

export default {
  compressImage,
  compressBase64Image,
  compressImageBatch,
  getAvailablePresets,
  COMPRESSION_PRESETS,
};
