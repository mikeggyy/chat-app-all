/**
 * 用戶資產服務
 * 管理 users/{userId}/assets 子集合
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

const USERS_COLLECTION = "users";
const ASSETS_SUBCOLLECTION = "assets";

/**
 * 資產類型
 */
export const ASSET_TYPES = {
  // 解鎖卡
  CHARACTER_UNLOCK_CARD: "characterUnlockCard",
  PHOTO_UNLOCK_CARD: "photoUnlockCard",
  VIDEO_UNLOCK_CARD: "videoUnlockCard",
  VOICE_UNLOCK_CARD: "voiceUnlockCard",
  CREATE_CARD: "createCards", // 注意：Firestore 中使用複數形式
};

/**
 * 獲取資產引用
 */
const getAssetRef = (userId, assetType, itemId = null) => {
  const db = getFirestoreDb();
  const assetId = itemId ? `${assetType}_${itemId}` : assetType;
  return db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(ASSETS_SUBCOLLECTION)
    .doc(assetId);
};

/**
 * 獲取用戶的所有資產
 * @param {string} userId - 用戶 ID
 * @param {string} type - 資產類型（可選）
 * @returns {Promise<Array>} 資產列表
 */
export const getUserAssets = async (userId, type = null) => {
  const db = getFirestoreDb();
  let query = db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(ASSETS_SUBCOLLECTION);

  if (type) {
    query = query.where("type", "==", type);
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * 獲取單個資產
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {string} itemId - 物品 ID（禮物需要）
 * @returns {Promise<Object|null>} 資產數據
 */
export const getUserAsset = async (userId, assetType, itemId = null) => {
  const assetRef = getAssetRef(userId, assetType, itemId);
  const doc = await assetRef.get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  };
};

/**
 * 設置資產數量
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {number} quantity - 數量
 * @param {string} itemId - 物品 ID（禮物需要）
 * @returns {Promise<Object>} 資產數據
 */
export const setAssetQuantity = async (userId, assetType, quantity, itemId = null) => {
  if (quantity < 0) {
    throw new Error("資產數量不能為負數");
  }

  const db = getFirestoreDb();
  const assetRef = getAssetRef(userId, assetType, itemId);
  const userRef = db.collection(USERS_COLLECTION).doc(userId);

  await db.runTransaction(async (transaction) => {
    const assetData = {
      type: assetType,
      quantity: quantity,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (itemId) {
      assetData.itemId = itemId;
    }

    // 更新子集合
    transaction.set(assetRef, assetData, { merge: true });

    // 同步更新主文檔（向後兼容，確保管理後台能看到）
    const userDoc = await transaction.get(userRef);
    if (userDoc.exists) {
      const assetTypeMapping = {
        characterUnlockCard: "characterUnlockCards",
        photoUnlockCard: "photoUnlockCards",
        videoUnlockCard: "videoUnlockCards",
        voiceUnlockCard: "voiceUnlockCards",
        createCards: "createCards",
      };

      const mainDocKey = assetTypeMapping[assetType];

      if (mainDocKey) {
        // 解鎖卡：更新 assets.{assetKey}
        transaction.update(userRef, {
          [`assets.${mainDocKey}`]: quantity,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  });

  logger.info(`[資產子集合] 設置資產數量（已同步主文檔）: userId=${userId}, type=${assetType}, itemId=${itemId || 'null'}, quantity=${quantity}`);

  return {
    type: assetType,
    quantity: quantity,
    itemId: itemId,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * 增加資產數量
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {number} amount - 增加數量
 * @param {string} itemId - 物品 ID（禮物需要）
 * @returns {Promise<Object>} 更新結果
 */
export const addAsset = async (userId, assetType, amount, itemId = null) => {
  if (amount <= 0) {
    throw new Error("增加數量必須大於 0");
  }

  const db = getFirestoreDb();
  const assetRef = getAssetRef(userId, assetType, itemId);
  const userRef = db.collection(USERS_COLLECTION).doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(assetRef);
    const userDoc = await transaction.get(userRef);

    let currentQuantity = 0;
    if (doc.exists) {
      currentQuantity = doc.data().quantity || 0;
    }

    const newQuantity = currentQuantity + amount;

    const assetData = {
      type: assetType,
      quantity: newQuantity,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (itemId) {
      assetData.itemId = itemId;
    }

    if (!doc.exists) {
      assetData.createdAt = FieldValue.serverTimestamp();
    }

    // 更新子集合
    transaction.set(assetRef, assetData, { merge: true });

    // 同步更新主文檔（向後兼容，確保管理後台能看到）
    if (userDoc.exists) {
      const assetTypeMapping = {
        characterUnlockCard: "characterUnlockCards",
        photoUnlockCard: "photoUnlockCards",
        videoUnlockCard: "videoUnlockCards",
        voiceUnlockCard: "voiceUnlockCards",
        createCards: "createCards",
      };

      const mainDocKey = assetTypeMapping[assetType];

      if (mainDocKey) {
        // 解鎖卡：更新 assets.{assetKey}
        transaction.update(userRef, {
          [`assets.${mainDocKey}`]: newQuantity,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      previousQuantity: currentQuantity,
      newQuantity,
      added: amount,
    };
  });

  logger.info(`[資產子集合] 增加資產（已同步主文檔）: userId=${userId}, type=${assetType}, itemId=${itemId || 'null'}, added=${amount}, newQuantity=${result.newQuantity}`);

  return result;
};

/**
 * 減少資產數量
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {number} amount - 減少數量
 * @param {string} itemId - 物品 ID（禮物需要）
 * @returns {Promise<Object>} 更新結果
 */
export const deductAsset = async (userId, assetType, amount, itemId = null) => {
  if (amount <= 0) {
    throw new Error("減少數量必須大於 0");
  }

  const db = getFirestoreDb();
  const assetRef = getAssetRef(userId, assetType, itemId);
  const userRef = db.collection(USERS_COLLECTION).doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(assetRef);
    const userDoc = await transaction.get(userRef);

    if (!doc.exists) {
      throw new Error(`資產不足: ${assetType}${itemId ? ` (${itemId})` : ''}`);
    }

    const currentQuantity = doc.data().quantity || 0;

    if (currentQuantity < amount) {
      throw new Error(`資產數量不足: 當前 ${currentQuantity}, 需要 ${amount}`);
    }

    const newQuantity = currentQuantity - amount;

    // 更新子集合
    transaction.update(assetRef, {
      quantity: newQuantity,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 同步更新主文檔（向後兼容，確保管理後台能看到）
    if (userDoc.exists) {
      const assetTypeMapping = {
        characterUnlockCard: "characterUnlockCards",
        photoUnlockCard: "photoUnlockCards",
        videoUnlockCard: "videoUnlockCards",
        voiceUnlockCard: "voiceUnlockCards",
        createCards: "createCards",
      };

      const mainDocKey = assetTypeMapping[assetType];

      if (mainDocKey) {
        // 解鎖卡：更新 assets.{assetKey}
        transaction.update(userRef, {
          [`assets.${mainDocKey}`]: newQuantity,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      previousQuantity: currentQuantity,
      newQuantity,
      deducted: amount,
    };
  });

  logger.info(`[資產子集合] 減少資產（已同步主文檔）: userId=${userId}, type=${assetType}, itemId=${itemId || 'null'}, deducted=${amount}, newQuantity=${result.newQuantity}`);

  return result;
};

/**
 * 獲取所有解鎖卡餘額
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 解鎖卡餘額
 */
export const getUnlockCardsBalance = async (userId) => {
  const cardTypes = [
    ASSET_TYPES.CHARACTER_UNLOCK_CARD,
    ASSET_TYPES.PHOTO_UNLOCK_CARD,
    ASSET_TYPES.VIDEO_UNLOCK_CARD,
    ASSET_TYPES.VOICE_UNLOCK_CARD,
    ASSET_TYPES.CREATE_CARD,
  ];

  const balance = {
    characterUnlockCards: 0,
    photoUnlockCards: 0,
    videoUnlockCards: 0,
    voiceUnlockCards: 0,
    createCards: 0,
  };

  for (const cardType of cardTypes) {
    const asset = await getUserAsset(userId, cardType);
    if (asset) {
      // 轉換為舊格式的鍵名
      if (cardType === ASSET_TYPES.CHARACTER_UNLOCK_CARD) {
        balance.characterUnlockCards = asset.quantity || 0;
      } else if (cardType === ASSET_TYPES.PHOTO_UNLOCK_CARD) {
        balance.photoUnlockCards = asset.quantity || 0;
      } else if (cardType === ASSET_TYPES.VIDEO_UNLOCK_CARD) {
        balance.videoUnlockCards = asset.quantity || 0;
      } else if (cardType === ASSET_TYPES.VOICE_UNLOCK_CARD) {
        balance.voiceUnlockCards = asset.quantity || 0;
      } else if (cardType === ASSET_TYPES.CREATE_CARD) {
        balance.createCards = asset.quantity || 0;
      }
    }
  }

  return balance;
};

/**
 * 批量設置資產（用於數據遷移）
 * @param {string} userId - 用戶 ID
 * @param {Object} assets - 資產對象
 * @returns {Promise<Object>} 設置結果
 */
export const batchSetAssets = async (userId, assets) => {
  if (!assets || typeof assets !== "object") {
    return { success: true, count: 0 };
  }

  const db = getFirestoreDb();
  const batch = db.batch();

  let count = 0;

  // 處理解鎖卡
  const cardMapping = {
    characterUnlockCards: ASSET_TYPES.CHARACTER_UNLOCK_CARD,
    photoUnlockCards: ASSET_TYPES.PHOTO_UNLOCK_CARD,
    videoUnlockCards: ASSET_TYPES.VIDEO_UNLOCK_CARD,
    voiceUnlockCards: ASSET_TYPES.VOICE_UNLOCK_CARD,
    createCards: ASSET_TYPES.CREATE_CARD,
  };

  for (const [key, assetType] of Object.entries(cardMapping)) {
    if (assets[key] !== undefined && assets[key] !== null) {
      const quantity = parseInt(assets[key]) || 0;
      const assetRef = getAssetRef(userId, assetType);

      batch.set(
        assetRef,
        {
          type: assetType,
          quantity,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  logger.info(`[資產子集合] 批量設置資產: userId=${userId}, count=${count}`);

  return { success: true, count };
};

/**
 * 清除用戶的所有資產（謹慎使用）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 刪除結果
 */
export const clearAllAssets = async (userId) => {
  const db = getFirestoreDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(ASSETS_SUBCOLLECTION)
    .get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }

  logger.warn(`[資產子集合] 清除所有資產: userId=${userId}, count=${snapshot.size}`);

  return {
    success: true,
    deletedCount: snapshot.size,
  };
};

export default {
  ASSET_TYPES,
  getUserAssets,
  getUserAsset,
  setAssetQuantity,
  addAsset,
  deductAsset,
  getUnlockCardsBalance,
  batchSetAssets,
  clearAllAssets,
};
