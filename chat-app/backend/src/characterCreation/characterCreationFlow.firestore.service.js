import { getFirestoreDb } from "../firebase/index.js";
import {
  getDocument,
  setDocument,
  updateDocument,
  queryCollection,
} from "../utils/firestoreHelpers.js";
import logger from "../utils/logger.js";

const COLLECTION_NAME = "character_creation_flows";

/**
 * 創建新的角色創建流程記錄
 * @param {string} flowId - 流程 ID
 * @param {Object} flowData - 流程數據
 * @returns {Promise<Object>} 創建的流程記錄
 */
export async function createFlow(flowId, flowData) {
  try {
    const db = getFirestoreDb();
    const docRef = db.collection(COLLECTION_NAME).doc(flowId);

    const now = new Date().toISOString();
    const data = {
      ...flowData,
      id: flowId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(data);

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Firestore] Created character creation flow: ${flowId}`);
    }

    return { id: flowId, ...data };
  } catch (error) {
    logger.error(`[Firestore] Failed to create flow ${flowId}:`, error);
    throw new Error(`無法建立角色創建流程: ${error.message}`);
  }
}

/**
 * 獲取角色創建流程
 * @param {string} flowId - 流程 ID
 * @returns {Promise<Object|null>} 流程數據或 null
 */
export async function getFlow(flowId) {
  try {
    const flow = await getDocument(COLLECTION_NAME, flowId);
    return flow;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error(`[Firestore] Failed to get flow ${flowId}:`, error);
    }
    return null;
  }
}

/**
 * 更新角色創建流程
 * @param {string} flowId - 流程 ID
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<Object>} 更新後的流程數據
 */
export async function updateFlow(flowId, updates) {
  try {
    const db = getFirestoreDb();
    const docRef = db.collection(COLLECTION_NAME).doc(flowId);

    const now = new Date().toISOString();
    const updateData = {
      ...updates,
      updatedAt: now,
    };

    await docRef.update(updateData);

    // 獲取更新後的文檔
    const updatedFlow = await getFlow(flowId);

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Firestore] Updated character creation flow: ${flowId}`);
    }

    return updatedFlow;
  } catch (error) {
    logger.error(`[Firestore] Failed to update flow ${flowId}:`, error);
    throw new Error(`無法更新角色創建流程: ${error.message}`);
  }
}

/**
 * 完全替換流程數據（用於包含嵌套數據的更新）
 * @param {string} flowId - 流程 ID
 * @param {Object} flowData - 新的流程數據
 * @returns {Promise<Object>} 更新後的流程數據
 */
export async function setFlow(flowId, flowData) {
  try {
    const db = getFirestoreDb();
    const docRef = db.collection(COLLECTION_NAME).doc(flowId);

    const now = new Date().toISOString();
    const data = {
      ...flowData,
      id: flowId,
      updatedAt: now,
    };

    // 保留 createdAt
    const existing = await getFlow(flowId);
    if (existing && existing.createdAt) {
      data.createdAt = existing.createdAt;
    } else {
      data.createdAt = now;
    }

    await docRef.set(data, { merge: false });

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Firestore] Set character creation flow: ${flowId}`);
    }

    return { id: flowId, ...data };
  } catch (error) {
    logger.error(`[Firestore] Failed to set flow ${flowId}:`, error);
    throw new Error(`無法設置角色創建流程: ${error.message}`);
  }
}

/**
 * 刪除角色創建流程
 * @param {string} flowId - 流程 ID
 * @returns {Promise<void>}
 */
export async function deleteFlow(flowId) {
  try {
    const db = getFirestoreDb();
    const docRef = db.collection(COLLECTION_NAME).doc(flowId);

    await docRef.delete();

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Firestore] Deleted character creation flow: ${flowId}`);
    }
  } catch (error) {
    logger.error(`[Firestore] Failed to delete flow ${flowId}:`, error);
    throw new Error(`無法刪除角色創建流程: ${error.message}`);
  }
}

/**
 * 查詢用戶的所有創建流程
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Array>} 流程列表
 */
export async function getUserFlows(userId, options = {}) {
  try {
    const queryOptions = {
      where: [["userId", "==", userId]],
      orderBy: [["createdAt", "desc"]],
      limit: options.limit || 50,
    };

    const flows = await queryCollection(COLLECTION_NAME, queryOptions);

    return flows;
  } catch (error) {
    logger.error(`[Firestore] Failed to get user flows for ${userId}:`, error);
    return [];
  }
}

/**
 * 查詢指定狀態的流程
 * @param {string} status - 流程狀態
 * @param {Object} options - 查詢選項
 * @returns {Promise<Array>} 流程列表
 */
export async function getFlowsByStatus(status, options = {}) {
  try {
    const queryOptions = {
      where: [["status", "==", status]],
      orderBy: [["updatedAt", "desc"]],
      limit: options.limit || 100,
    };

    const flows = await queryCollection(COLLECTION_NAME, queryOptions);

    return flows;
  } catch (error) {
    logger.error(`[Firestore] Failed to get flows by status ${status}:`, error);
    return [];
  }
}

/**
 * 清理過期的草稿流程（超過 7 天未更新）
 * @returns {Promise<number>} 刪除的流程數量
 */
export async function cleanupExpiredDrafts() {
  try {
    const db = getFirestoreDb();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where("status", "==", "draft")
      .where("updatedAt", "<", sevenDaysAgo.toISOString())
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    const deletedCount = snapshot.size;

    if (process.env.NODE_ENV !== "test" && deletedCount > 0) {
      logger.info(`[Firestore] Cleaned up ${deletedCount} expired draft flows`);
    }

    return deletedCount;
  } catch (error) {
    logger.error("[Firestore] Failed to cleanup expired drafts:", error);
    return 0;
  }
}
