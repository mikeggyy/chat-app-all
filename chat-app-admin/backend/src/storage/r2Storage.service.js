/**
 * Cloudflare R2 Storage Service (管理後台)
 * 用於刪除用戶相關的圖片和影片檔案
 */

import {
  S3Client,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

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

    console.log("[管理後台][R2] 圖片刪除成功:", { key });
  } catch (error) {
    console.error("[管理後台][R2] 圖片刪除失敗:", error);
    throw new Error(`圖片刪除失敗: ${error.message}`);
  }
};

/**
 * 從 URL 中提取 R2 文件 key
 * @param {string} fileUrl - 完整的文件 URL
 * @returns {string} - 文件 key
 */
export const extractKeyFromUrl = (fileUrl) => {
  if (!fileUrl) {
    throw new Error("文件 URL 不能為空");
  }

  try {
    // R2 URL 格式: https://pub-xxx.r2.dev/photos/userId/characterId/filename.webp
    if (fileUrl.startsWith("http")) {
      const url = new URL(fileUrl);
      return url.pathname.substring(1); // 移除開頭的 '/'
    }

    // 已經是 key 格式
    return fileUrl;
  } catch (error) {
    throw new Error(`無效的文件 URL: ${fileUrl}`);
  }
};

/**
 * 刪除圖片（支持 URL 或 key）
 * @param {string} fileUrl - 文件 URL 或路徑
 * @returns {Promise<boolean>} - 是否成功刪除
 */
export const deleteImage = async (fileUrl) => {
  try {
    const fileKey = extractKeyFromUrl(fileUrl);
    await deleteImageFromR2(fileKey);
    return true;
  } catch (error) {
    console.error("[管理後台][Storage] 圖片刪除失敗:", error);
    return false;
  }
};

/**
 * 批量刪除圖片
 * @param {Array<string>} urls - 圖片 URL 列表
 * @returns {Promise<Object>} - 刪除結果統計
 */
export const deleteImages = async (urls) => {
  if (!Array.isArray(urls) || urls.length === 0) {
    return { total: 0, success: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    urls.map(url => deleteImage(url))
  );

  const stats = {
    total: urls.length,
    success: results.filter(r => r.status === "fulfilled" && r.value === true).length,
    failed: 0,
  };

  stats.failed = stats.total - stats.success;

  console.log(`[管理後台][R2] 批量刪除完成: 總計 ${stats.total}，成功 ${stats.success}，失敗 ${stats.failed}`);

  return stats;
};

export default {
  deleteImageFromR2,
  deleteImage,
  deleteImages,
  extractKeyFromUrl,
};
