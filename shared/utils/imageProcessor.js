/**
 * 圖片處理工具模塊（跨應用共享）
 *
 * 提供圖片壓縮、格式轉換、大小調整等功能
 * 使用 sharp 庫進行高效的圖片處理
 *
 * 使用位置：
 * - chat-app/backend（AI 圖片生成）
 * - chat-app-admin/backend（圖片管理）
 */

import sharp from "sharp";

/**
 * 將 base64 圖片壓縮為 WebP 格式
 *
 * WebP 格式優點：
 * - 體積比 PNG/JPEG 小 25-35%
 * - 支持透明度
 * - 現代瀏覽器廣泛支持
 *
 * @param {string} base64String - Base64 編碼的圖片字符串（可包含 data:image 前綴）
 * @param {number} [quality=30] - 壓縮質量 (0-100)，建議值：
 *   - 10-30: 高壓縮率，適合預覽圖
 *   - 40-60: 平衡質量和大小，適合一般使用
 *   - 70-90: 高質量，文件較大
 * @returns {Promise<string>} 壓縮後的 base64 字符串（不含前綴）
 * @throws {Error} 壓縮失敗時拋出錯誤
 *
 * @example
 * const compressed = await compressImageToWebP(base64Image, 60);
 * // 使用壓縮後的圖片
 * const dataUrl = `data:image/webp;base64,${compressed}`;
 */
export const compressImageToWebP = async (base64String, quality = 30) => {
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
    console.error("[ImageProcessor] WebP 壓縮失敗:", error);
    // 壓縮失敗時返回原圖（移除前綴）
    return base64String.replace(/^data:image\/\w+;base64,/, "");
  }
};

/**
 * 將 base64 圖片壓縮為 JPEG 格式
 *
 * @param {string} base64String - Base64 編碼的圖片字符串
 * @param {number} [quality=60] - 壓縮質量 (0-100)
 * @returns {Promise<string>} 壓縮後的 base64 字符串（不含前綴）
 *
 * @example
 * const compressed = await compressImageToJPEG(base64Image, 80);
 */
export const compressImageToJPEG = async (base64String, quality = 60) => {
  try {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const compressedBuffer = await sharp(buffer)
      .jpeg({ quality, mozjpeg: true }) // 使用 mozjpeg 引擎獲得更好的壓縮
      .toBuffer();

    return compressedBuffer.toString("base64");
  } catch (error) {
    console.error("[ImageProcessor] JPEG 壓縮失敗:", error);
    return base64String.replace(/^data:image\/\w+;base64,/, "");
  }
};

/**
 * 調整圖片大小
 *
 * @param {string} base64String - Base64 編碼的圖片字符串
 * @param {Object} options - 調整選項
 * @param {number} [options.width] - 目標寬度（像素）
 * @param {number} [options.height] - 目標高度（像素）
 * @param {string} [options.fit='cover'] - 適應方式：'cover', 'contain', 'fill', 'inside', 'outside'
 * @param {string} [options.format='webp'] - 輸出格式：'webp', 'jpeg', 'png'
 * @param {number} [options.quality=60] - 壓縮質量 (0-100)
 * @returns {Promise<string>} 調整後的 base64 字符串（不含前綴）
 *
 * @example
 * // 調整為 800x600 的 WebP 圖片
 * const resized = await resizeImage(base64Image, {
 *   width: 800,
 *   height: 600,
 *   fit: 'cover',
 *   format: 'webp',
 *   quality: 60
 * });
 */
export const resizeImage = async (base64String, options = {}) => {
  try {
    const {
      width,
      height,
      fit = "cover",
      format = "webp",
      quality = 60,
    } = options;

    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    let sharpInstance = sharp(buffer);

    // 調整大小
    if (width || height) {
      sharpInstance = sharpInstance.resize(width, height, { fit });
    }

    // 轉換格式並壓縮
    switch (format) {
      case "webp":
        sharpInstance = sharpInstance.webp({ quality });
        break;
      case "jpeg":
        sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
        break;
      case "png":
        sharpInstance = sharpInstance.png({
          quality,
          compressionLevel: 9,
        });
        break;
      default:
        sharpInstance = sharpInstance.webp({ quality });
    }

    const resizedBuffer = await sharpInstance.toBuffer();
    return resizedBuffer.toString("base64");
  } catch (error) {
    console.error("[ImageProcessor] 圖片調整失敗:", error);
    return base64String.replace(/^data:image\/\w+;base64,/, "");
  }
};

/**
 * 獲取圖片元數據
 *
 * @param {string} base64String - Base64 編碼的圖片字符串
 * @returns {Promise<Object>} 圖片元數據
 * @returns {number} returns.width - 圖片寬度
 * @returns {number} returns.height - 圖片高度
 * @returns {string} returns.format - 圖片格式
 * @returns {number} returns.size - 文件大小（字節）
 *
 * @example
 * const metadata = await getImageMetadata(base64Image);
 * console.log(`尺寸：${metadata.width}x${metadata.height}`);
 * console.log(`格式：${metadata.format}`);
 * console.log(`大小：${(metadata.size / 1024).toFixed(2)} KB`);
 */
export const getImageMetadata = async (base64String) => {
  try {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const metadata = await sharp(buffer).metadata();

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
      hasAlpha: metadata.hasAlpha,
      space: metadata.space,
    };
  } catch (error) {
    console.error("[ImageProcessor] 獲取圖片元數據失敗:", error);
    throw error;
  }
};

/**
 * 智能壓縮圖片
 * 根據圖片大小自動選擇最佳壓縮參數
 *
 * @param {string} base64String - Base64 編碼的圖片字符串
 * @param {Object} [options] - 選項
 * @param {number} [options.maxWidth=1920] - 最大寬度
 * @param {number} [options.maxHeight=1080] - 最大高度
 * @param {number} [options.targetSizeKB=200] - 目標文件大小（KB）
 * @returns {Promise<Object>} 壓縮結果
 * @returns {string} returns.data - 壓縮後的 base64 字符串（不含前綴）
 * @returns {Object} returns.metadata - 壓縮後的圖片元數據
 * @returns {number} returns.compressionRatio - 壓縮率（0-1）
 *
 * @example
 * const result = await smartCompress(largeImage, { targetSizeKB: 150 });
 * console.log(`壓縮率：${(result.compressionRatio * 100).toFixed(1)}%`);
 * console.log(`最終大小：${(result.metadata.size / 1024).toFixed(2)} KB`);
 */
export const smartCompress = async (base64String, options = {}) => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    targetSizeKB = 200,
  } = options;

  try {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    const originalBuffer = Buffer.from(base64Data, "base64");
    const originalSize = originalBuffer.length;

    // 獲取原始元數據
    const originalMetadata = await sharp(originalBuffer).metadata();

    // 計算縮放比例
    let scale = 1;
    if (originalMetadata.width > maxWidth || originalMetadata.height > maxHeight) {
      const widthScale = maxWidth / originalMetadata.width;
      const heightScale = maxHeight / originalMetadata.height;
      scale = Math.min(widthScale, heightScale);
    }

    const targetWidth = Math.round(originalMetadata.width * scale);
    const targetHeight = Math.round(originalMetadata.height * scale);

    // 從高質量開始嘗試壓縮
    let quality = 80;
    let compressedData = null;
    let compressedSize = 0;

    while (quality >= 10) {
      const buffer = await sharp(originalBuffer)
        .resize(targetWidth, targetHeight, { fit: "inside" })
        .webp({ quality })
        .toBuffer();

      compressedSize = buffer.length;
      const sizeKB = compressedSize / 1024;

      if (sizeKB <= targetSizeKB || quality <= 10) {
        compressedData = buffer.toString("base64");
        break;
      }

      quality -= 10;
    }

    const metadata = {
      width: targetWidth,
      height: targetHeight,
      format: "webp",
      size: compressedSize,
      quality,
    };

    return {
      data: compressedData,
      metadata,
      compressionRatio: (originalSize - compressedSize) / originalSize,
    };
  } catch (error) {
    console.error("[ImageProcessor] 智能壓縮失敗:", error);
    throw error;
  }
};
