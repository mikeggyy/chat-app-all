import { getFirestoreDb } from "../firebase/index.js";
import logger from "../utils/logger.js";

/**
 * 獲取所有角色風格
 * @returns {Promise<Array>} 風格列表
 */
export const listCharacterStyles = async () => {
  try {
    const db = getFirestoreDb();
    const snapshot = await db
      .collection("character_styles")
      .where("status", "==", "active")
      .orderBy("order", "asc")
      .get();

    const styles = [];
    snapshot.forEach((doc) => {
      styles.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Character Styles] Retrieved ${styles.length} styles`);
    }

    return styles;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Character Styles] Failed to list styles:", error);
    }
    throw error;
  }
};

/**
 * 獲取單個風格
 * @param {string} styleId - 風格ID
 * @returns {Promise<Object|null>} 風格資料
 */
export const getCharacterStyle = async (styleId) => {
  try {
    const db = getFirestoreDb();
    const doc = await db.collection("character_styles").doc(styleId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Character Styles] Failed to get style:", error);
    }
    throw error;
  }
};

/**
 * 創建或更新風格
 * @param {string} styleId - 風格ID
 * @param {Object} styleData - 風格資料
 * @returns {Promise<Object>} 更新後的風格資料
 */
export const upsertCharacterStyle = async (styleId, styleData) => {
  try {
    const db = getFirestoreDb();
    const docRef = db.collection("character_styles").doc(styleId);
    const doc = await docRef.get();

    const timestamp = new Date().toISOString();
    const data = {
      ...styleData,
      updatedAt: timestamp,
    };

    if (!doc.exists) {
      data.createdAt = timestamp;
    }

    await docRef.set(data, { merge: true });

    return {
      id: styleId,
      ...data,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Character Styles] Failed to upsert style:", error);
    }
    throw error;
  }
};

/**
 * 刪除風格（軟刪除，設為 inactive）
 * @param {string} styleId - 風格ID
 * @returns {Promise<void>}
 */
export const deleteCharacterStyle = async (styleId) => {
  try {
    const db = getFirestoreDb();
    await db.collection("character_styles").doc(styleId).update({
      status: "inactive",
      updatedAt: new Date().toISOString(),
    });

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Character Styles] Deleted style: ${styleId}`);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Character Styles] Failed to delete style:", error);
    }
    throw error;
  }
};
