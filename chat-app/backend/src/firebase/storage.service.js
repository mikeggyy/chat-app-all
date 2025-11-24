/**
 * Storage 服務（使用 Cloudflare R2）
 * 處理圖片上傳和 URL 生成
 *
 * 注意：已從 Firebase Storage 遷移到 Cloudflare R2 以降低成本
 */

import { uploadImageToR2, deleteImageFromR2 } from "../storage/r2Storage.service.js";
import logger from "../utils/logger.js";

/**
 * 上傳 Base64 圖片到 R2 Storage
 * @param {string} base64Data - Base64 編碼的圖片數據（可包含或不包含 data URL 前綴）
 * @param {string} userId - 用戶 ID
 * @param {string} filename - 文件名（不含路徑，用於提取副檔名）
 * @param {string} contentType - MIME 類型（預設 image/webp）
 * @param {object} options - 可選參數
 * @param {string} options.characterId - 角色 ID（如果不提供，會從 filename 解析）
 * @returns {Promise<string>} - R2 中的文件 URL
 */
export const uploadBase64Image = async (
  base64Data,
  userId,
  filename,
  contentType = "image/webp",
  options = {}
) => {
  try {
    // 從 filename 提取副檔名
    const extension = filename.split(".").pop() || "webp";

    // ✅ 修復：優先使用傳入的 characterId，否則從 filename 解析
    // filename 格式: {prefix}-{characterId}-{timestamp}-{random}.webp
    // 例如: selfie-match-001-1234567890-abc123.webp
    let characterId = options.characterId;

    if (!characterId) {
      const filenameParts = filename.split("-");
      // 處理 characterId 可能包含連字符的情況（如 match-001）
      // prefix-characterId-timestamp-random.webp
      if (filenameParts.length >= 4) {
        // 嘗試識別 timestamp（純數字且長度 >= 10）
        let timestampIndex = -1;
        for (let i = 2; i < filenameParts.length; i++) {
          if (/^\d{10,}$/.test(filenameParts[i])) {
            timestampIndex = i;
            break;
          }
        }

        if (timestampIndex > 1) {
          // characterId 是從 index 1 到 timestampIndex-1 的部分
          characterId = filenameParts.slice(1, timestampIndex).join("-");
        } else {
          characterId = filenameParts[1];
        }
      } else if (filenameParts.length >= 2) {
        characterId = filenameParts[1];
      } else {
        characterId = "general";
      }
    }

    logger.debug(`[Storage] 上傳圖片到 R2: userId=${userId}, characterId=${characterId}, extension=${extension}`);

    // 使用 R2 上傳
    const result = await uploadImageToR2(base64Data, userId, characterId, {
      contentType,
      extension,
    });

    logger.info(`[Storage] 圖片上傳成功 (R2): ${result.key}, 大小: ${Math.round(result.size / 1024)}KB`);

    return result.url;
  } catch (error) {
    logger.error("[Storage] 圖片上傳失敗 (R2):");
    logger.error("  錯誤類型:", error.constructor.name);
    logger.error("  錯誤訊息:", error.message);
    if (error.code) logger.error("  錯誤代碼:", error.code);
    if (error.status) logger.error("  HTTP 狀態:", error.status);
    throw new Error(`圖片上傳失敗: ${error.message}`);
  }
};

/**
 * 刪除 R2 Storage 中的圖片
 * @param {string} fileUrl - 文件 URL 或路徑
 * @returns {Promise<boolean>} - 是否成功刪除
 */
export const deleteImage = async (fileUrl) => {
  try {
    // 從 URL 提取文件 key
    let fileKey;
    if (fileUrl.startsWith("http")) {
      // R2 URL 格式: https://pub-xxx.r2.dev/photos/userId/characterId/filename.webp
      const url = new URL(fileUrl);
      fileKey = url.pathname.substring(1); // 移除開頭的 '/'
    } else {
      fileKey = fileUrl;
    }

    await deleteImageFromR2(fileKey);

    logger.info(`[Storage] 圖片刪除成功 (R2): ${fileKey}`);
    return true;
  } catch (error) {
    logger.error("[Storage] 圖片刪除失敗 (R2):", error);
    return false;
  }
};

/**
 * 生成唯一的文件名
 * @param {string} prefix - 文件名前綴（selfie/gift）
 * @param {string} characterId - 角色 ID
 * @returns {string} - 唯一文件名
 */
export const generateFilename = (prefix, characterId) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${characterId}-${timestamp}-${random}.webp`;
};

export default {
  uploadBase64Image,
  deleteImage,
  generateFilename,
};
