/**
 * 照片相簿服務
 * 獨立存儲照片，不依賴對話歷史
 */

import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../utils/logger.js";

const PHOTOS_COLLECTION = "user_photos";

/**
 * 創建照片 ID
 */
const createPhotoId = () => {
  return `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 獲取用戶照片集合引用
 */
const getUserPhotosRef = (userId) => {
  const db = getFirestoreDb();
  return db.collection(PHOTOS_COLLECTION).doc(userId).collection("photos");
};

/**
 * 保存照片或影片到相簿
 * @param {string} userId - 用戶 ID
 * @param {Object} photoData - 照片/影片數據
 * @returns {Promise<Object>} 保存的照片/影片數據
 */
export const savePhotoToAlbum = async (userId, photoData) => {
  const {
    characterId,
    imageUrl,
    videoUrl,
    video, // { url, duration, resolution }
    text,
    type = 'selfie', // 'selfie' | 'gift' | 'video'
    giftId = null,
    messageId = null,
    createdAt = new Date().toISOString(),
  } = photoData;

  // 必須有 imageUrl 或 videoUrl/video
  const hasImage = imageUrl && typeof imageUrl === 'string';
  const hasVideo = (videoUrl && typeof videoUrl === 'string') || (video && video.url);

  if (!userId || !characterId || (!hasImage && !hasVideo)) {
    throw new Error("缺少必要參數：userId, characterId, imageUrl 或 videoUrl/video");
  }

  const photoId = createPhotoId();
  const photosRef = getUserPhotosRef(userId);

  const item = {
    id: photoId,
    userId,
    characterId,
    text: text || '',
    type,
    giftId,
    messageId,
    createdAt,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // 添加圖片 URL（如果有）
  if (hasImage) {
    item.imageUrl = imageUrl;
    item.mediaType = 'image';
  }

  // 添加影片數據（如果有）
  if (hasVideo) {
    if (video && video.url) {
      item.videoUrl = video.url;
      item.video = {
        url: video.url,
        duration: video.duration || null,
        resolution: video.resolution || null,
      };
    } else if (videoUrl) {
      item.videoUrl = videoUrl;
      item.video = { url: videoUrl };
    }
    item.mediaType = 'video';
  }

  await photosRef.doc(photoId).set(item);

  const mediaTypeLabel = item.mediaType === 'video' ? '影片' : '照片';
  logger.info(`${mediaTypeLabel}已保存到相簿: userId=${userId}, characterId=${characterId}, type=${type}`);

  return item;
};

/**
 * 獲取用戶與特定角色的所有照片
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @returns {Promise<Object>} 包含照片列表和角色資訊的對象
 */
export const getCharacterPhotos = async (userId, characterId) => {
  if (!userId || !characterId) {
    throw new Error("缺少必要參數：userId, characterId");
  }

  const photosRef = getUserPhotosRef(userId);
  const snapshot = await photosRef
    .where("characterId", "==", characterId)
    .orderBy("createdAt", "desc")
    .get();

  const photos = [];
  snapshot.forEach((doc) => {
    photos.push(doc.data());
  });

  // 嘗試從角色緩存獲取角色資訊
  let character = null;
  try {
    const { getCharacterById } = await import("../services/character/characterCache.service.js");
    character = getCharacterById(characterId);

    // 如果從緩存找不到，嘗試直接從 Firestore 查詢（可能是用戶創建的角色）
    if (!character) {
      const db = getFirestoreDb();
      const characterDoc = await db.collection("characters").doc(characterId).get();
      if (characterDoc.exists) {
        character = {
          id: characterDoc.id,
          ...characterDoc.data(),
        };
      }
    }
  } catch (error) {
    logger.warn(`獲取角色資訊失敗 (characterId=${characterId}):`, error.message);
    // 不拋出錯誤，繼續返回照片，只是沒有角色資訊
  }

  return {
    photos,
    character,
  };
};

/**
 * 獲取用戶的所有照片（所有角色）
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Array>} 照片列表
 */
export const getUserAllPhotos = async (userId, options = {}) => {
  if (!userId) {
    throw new Error("缺少必要參數：userId");
  }

  const { limit = 100 } = options;
  const photosRef = getUserPhotosRef(userId);

  let query = photosRef.orderBy("createdAt", "desc");

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();

  const photos = [];
  snapshot.forEach((doc) => {
    photos.push(doc.data());
  });

  return photos;
};

/**
 * 刪除指定照片
 * @param {string} userId - 用戶 ID
 * @param {Array<string>} photoIds - 照片 ID 列表
 * @returns {Promise<Object>} 刪除結果
 */
export const deletePhotos = async (userId, photoIds) => {
  if (!userId || !Array.isArray(photoIds) || photoIds.length === 0) {
    throw new Error("缺少必要參數：userId, photoIds");
  }

  const photosRef = getUserPhotosRef(userId);
  const db = getFirestoreDb();

  // 先獲取照片文檔，以便獲取 imageUrl 用於刪除遠端儲存的圖片
  const photoUrls = [];
  const photoDocsPromises = photoIds.map(photoId => photosRef.doc(photoId).get());
  const photoDocs = await Promise.all(photoDocsPromises);

  photoDocs.forEach(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data?.imageUrl) {
        photoUrls.push(data.imageUrl);
      }
    }
  });

  // 使用 batch 批量刪除 Firestore 記錄
  const batch = db.batch();
  let deletedCount = 0;

  for (const photoId of photoIds) {
    const photoDoc = photosRef.doc(photoId);
    batch.delete(photoDoc);
    deletedCount++;
  }

  await batch.commit();

  logger.info(`已刪除 ${deletedCount} 張照片記錄: userId=${userId}`);

  // 刪除遠端儲存的圖片文件（R2）
  if (photoUrls.length > 0) {
    try {
      const { deleteImage } = await import("../firebase/storage.service.js");

      const deleteResults = await Promise.allSettled(
        photoUrls.map(async (url) => {
          try {
            await deleteImage(url);
            logger.info(`[照片清理] 成功刪除遠端圖片: ${url}`);
            return { url, success: true };
          } catch (error) {
            logger.error(`[照片清理] 刪除遠端圖片失敗: ${url}`, error);
            return { url, success: false, error: error.message };
          }
        })
      );

      const successCount = deleteResults.filter(r => r.status === "fulfilled" && r.value.success).length;
      const failCount = deleteResults.length - successCount;

      logger.info(`[照片清理] 遠端圖片刪除完成: 成功 ${successCount} 個，失敗 ${failCount} 個`);
    } catch (error) {
      logger.error(`[照片清理] 刪除遠端圖片時發生錯誤:`, error);
      // 不拋出錯誤，因為 Firestore 記錄已經刪除，這只是清理遠端儲存
    }
  }

  return {
    deleted: deletedCount,
  };
};

/**
 * 刪除用戶與特定角色的所有照片
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @returns {Promise<Object>} 刪除結果
 */
export const deleteCharacterPhotos = async (userId, characterId) => {
  if (!userId || !characterId) {
    throw new Error("缺少必要參數：userId, characterId");
  }

  const photosRef = getUserPhotosRef(userId);
  const snapshot = await photosRef
    .where("characterId", "==", characterId)
    .get();

  if (snapshot.empty) {
    return { deleted: 0 };
  }

  // 收集所有照片的 imageUrl
  const photoUrls = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data?.imageUrl) {
      photoUrls.push(data.imageUrl);
    }
  });

  // 刪除 Firestore 記錄
  const db = getFirestoreDb();
  const batch = db.batch();

  snapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  logger.info(`已刪除角色所有照片記錄: userId=${userId}, characterId=${characterId}, count=${snapshot.size}`);

  // 刪除遠端儲存的圖片文件（R2）
  if (photoUrls.length > 0) {
    try {
      const { deleteImage } = await import("../firebase/storage.service.js");

      const deleteResults = await Promise.allSettled(
        photoUrls.map(async (url) => {
          try {
            await deleteImage(url);
            logger.info(`[照片清理] 成功刪除遠端圖片: ${url}`);
            return { url, success: true };
          } catch (error) {
            logger.error(`[照片清理] 刪除遠端圖片失敗: ${url}`, error);
            return { url, success: false, error: error.message };
          }
        })
      );

      const successCount = deleteResults.filter(r => r.status === "fulfilled" && r.value.success).length;
      const failCount = deleteResults.length - successCount;

      logger.info(`[照片清理] 角色照片遠端刪除完成: 成功 ${successCount} 個，失敗 ${failCount} 個`);
    } catch (error) {
      logger.error(`[照片清理] 刪除角色照片遠端儲存時發生錯誤:`, error);
      // 不拋出錯誤，因為 Firestore 記錄已經刪除，這只是清理遠端儲存
    }
  }

  return {
    deleted: snapshot.size,
  };
};

/**
 * 獲取照片統計
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID（可選）
 * @returns {Promise<Object>} 照片統計
 */
export const getPhotoStats = async (userId, characterId = null) => {
  if (!userId) {
    throw new Error("缺少必要參數：userId");
  }

  const photosRef = getUserPhotosRef(userId);

  let query = photosRef;
  if (characterId) {
    query = query.where("characterId", "==", characterId);
  }

  const snapshot = await query.get();

  const stats = {
    total: snapshot.size,
    bySelfie: 0,
    byGift: 0,
  };

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.type === 'selfie') {
      stats.bySelfie++;
    } else if (data.type === 'gift') {
      stats.byGift++;
    }
  });

  return stats;
};

export default {
  savePhotoToAlbum,
  getCharacterPhotos,
  getUserAllPhotos,
  deletePhotos,
  deleteCharacterPhotos,
  getPhotoStats,
};
