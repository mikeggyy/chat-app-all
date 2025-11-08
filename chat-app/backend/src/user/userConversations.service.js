/**
 * 用戶對話列表服務
 * 管理 users/{userId}/conversations 子集合
 */

import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../utils/logger.js";

const USERS_COLLECTION = "users";
const CONVERSATIONS_SUBCOLLECTION = "conversations";

/**
 * 規範化對話數據
 */
const normalizeConversationData = (conversationId, metadata = {}) => {
  const baseId = typeof conversationId === "string" ? conversationId.trim() : "";
  if (!baseId) {
    throw new Error("對話 ID 不得為空");
  }

  const conversation = {
    conversationId: baseId,
    characterId: metadata.characterId || baseId,
    updatedAt: new Date().toISOString(),
  };

  // 可選欄位
  if (metadata.character) {
    conversation.character = metadata.character;
  }
  if (metadata.lastMessage) {
    conversation.lastMessage = metadata.lastMessage;
  }
  if (metadata.lastMessageAt) {
    conversation.lastMessageAt = metadata.lastMessageAt;
  }
  if (metadata.lastSpeaker) {
    conversation.lastSpeaker = metadata.lastSpeaker;
  }
  if (metadata.partnerLastMessage) {
    conversation.partnerLastMessage = metadata.partnerLastMessage;
  }
  if (metadata.partnerLastRepliedAt) {
    conversation.partnerLastRepliedAt = metadata.partnerLastRepliedAt;
  }

  return conversation;
};

/**
 * 獲取用戶的對話引用
 */
const getConversationRef = (userId, conversationId) => {
  const db = getFirestoreDb();
  return db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(CONVERSATIONS_SUBCOLLECTION)
    .doc(conversationId);
};

/**
 * 獲取用戶的所有對話列表
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Array>} 對話列表
 */
export const getUserConversations = async (userId, options = {}) => {
  const {
    limit = 100,
    orderBy = "updatedAt",
    orderDirection = "desc",
  } = options;

  const db = getFirestoreDb();
  let query = db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(CONVERSATIONS_SUBCOLLECTION)
    .orderBy(orderBy, orderDirection);

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * 獲取單個對話詳情
 * @param {string} userId - 用戶 ID
 * @param {string} conversationId - 對話 ID
 * @returns {Promise<Object|null>} 對話數據
 */
export const getUserConversation = async (userId, conversationId) => {
  const conversationRef = getConversationRef(userId, conversationId);
  const doc = await conversationRef.get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  };
};

/**
 * 添加或更新用戶的對話記錄
 * @param {string} userId - 用戶 ID
 * @param {string} conversationId - 對話 ID
 * @param {Object} metadata - 對話元數據
 * @returns {Promise<Object>} 對話數據（包含 isNewConversation 標記）
 */
export const addOrUpdateConversation = async (userId, conversationId, metadata = {}) => {
  const normalizedId = typeof conversationId === "string" ? conversationId.trim() : "";
  if (!normalizedId) {
    throw new Error("對話 ID 不得為空");
  }

  const conversationData = normalizeConversationData(normalizedId, metadata);
  const conversationRef = getConversationRef(userId, normalizedId);

  // 檢查對話是否已存在（用於判斷是否為首次對話）
  const existingDoc = await conversationRef.get();
  const isNewConversation = !existingDoc.exists;

  // 使用 set 確保數據被創建或更新
  await conversationRef.set(
    {
      ...conversationData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info(`[對話子集合] ${isNewConversation ? '新增' : '更新'}對話: userId=${userId}, conversationId=${normalizedId}`);

  return {
    ...conversationData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isNewConversation, // 返回是否為首次對話的標記
  };
};

/**
 * 移除用戶的對話記錄
 * @param {string} userId - 用戶 ID
 * @param {string} conversationId - 對話 ID
 * @returns {Promise<void>}
 */
export const removeConversation = async (userId, conversationId) => {
  const normalizedId = typeof conversationId === "string" ? conversationId.trim() : "";
  if (!normalizedId) {
    throw new Error("對話 ID 不得為空");
  }

  const conversationRef = getConversationRef(userId, normalizedId);
  await conversationRef.delete();

  logger.info(`[對話子集合] 移除對話: userId=${userId}, conversationId=${normalizedId}`);
};

/**
 * 批量添加對話記錄（用於數據遷移）
 * @param {string} userId - 用戶 ID
 * @param {Array} conversations - 對話列表
 * @returns {Promise<Object>} 添加結果
 */
export const batchAddConversations = async (userId, conversations) => {
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return { success: true, count: 0 };
  }

  const db = getFirestoreDb();
  const batch = db.batch();

  let count = 0;

  for (const conv of conversations) {
    // 從舊格式中提取 conversationId
    let conversationId;
    if (typeof conv === "string") {
      conversationId = conv;
    } else if (conv.conversationId) {
      conversationId = conv.conversationId;
    } else if (conv.characterId) {
      conversationId = conv.characterId;
    } else if (conv.id) {
      conversationId = conv.id;
    }

    if (!conversationId) {
      logger.warn(`[對話子集合] 跳過無效對話: ${JSON.stringify(conv)}`);
      continue;
    }

    const conversationData = normalizeConversationData(conversationId, conv);
    const conversationRef = getConversationRef(userId, conversationId);

    batch.set(
      conversationRef,
      {
        ...conversationData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    count++;
  }

  if (count > 0) {
    await batch.commit();
  }

  logger.info(`[對話子集合] 批量添加對話: userId=${userId}, count=${count}`);

  return { success: true, count };
};

/**
 * 刪除用戶的所有對話記錄（謹慎使用）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 刪除結果
 */
export const clearAllConversations = async (userId) => {
  const db = getFirestoreDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(CONVERSATIONS_SUBCOLLECTION)
    .get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }

  logger.warn(`[對話子集合] 清除所有對話: userId=${userId}, count=${snapshot.size}`);

  return {
    success: true,
    deletedCount: snapshot.size,
  };
};

/**
 * 獲取對話數量
 * @param {string} userId - 用戶 ID
 * @returns {Promise<number>} 對話數量
 */
export const getConversationsCount = async (userId) => {
  const db = getFirestoreDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(CONVERSATIONS_SUBCOLLECTION)
    .count()
    .get();

  return snapshot.data().count;
};

export default {
  getUserConversations,
  getUserConversation,
  addOrUpdateConversation,
  removeConversation,
  batchAddConversations,
  clearAllConversations,
  getConversationsCount,
};
