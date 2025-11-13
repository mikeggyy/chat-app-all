import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import { HISTORY_LIMITS } from "../config/limits.js";
import logger from "../utils/logger.js";
import { LRUCache } from "../utils/LRUCache.js";

const CONVERSATIONS_COLLECTION = "conversations";

/**
 * 對話緩存
 * - maxSize: 1000 個對話
 * - ttl: 10 分鐘（600 秒）
 * - updateAgeOnGet: true（訪問時更新過期時間）
 *
 * 預期效果：
 * - 減少重複的 Firestore 讀取
 * - 防止內存無限增長
 * - 自動淘汰不活躍的對話
 */
const conversationCache = new LRUCache(1000, 10 * 60 * 1000, true);

const createConversationKey = (userId, characterId) => {
  const userKey = typeof userId === "string" ? userId.trim() : "";
  const characterKey = typeof characterId === "string" ? characterId.trim() : "";
  return `${userKey}::${characterKey}`;
};

const createMessageId = () => {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const normalizeRole = (value) => {
  if (typeof value !== "string") {
    return "partner";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "user" || normalized === "me" || normalized === "outbound") {
    return "user";
  }
  return "partner";
};

const pickMessageText = (payload = {}) => {
  if (typeof payload === "string") {
    return payload;
  }

  const candidates = ["text", "message", "content", "body"];

  for (const key of candidates) {
    if (typeof payload[key] === "string") {
      return payload[key];
    }
  }

  return "";
};

const normalizeMessagePayload = (payload = {}) => {
  // 調試：記錄接收到的 payload
  logger.info(`[對話服務] 🔍 normalizeMessagePayload 接收到的 payload 鍵: ${Object.keys(payload).join(', ')}`);
  logger.info(`[對話服務] 🔍 payload.imageUrl 存在: ${payload.imageUrl !== undefined}, 類型: ${typeof payload.imageUrl}`);

  const textSource = pickMessageText(payload);
  const text = typeof textSource === "string" ? textSource.trim() : "";

  if (!text.length) {
    throw new Error("訊息內容不得為空");
  }

  const roleSource =
    typeof payload === "string"
      ? "user"
      : payload.role ?? payload.speaker ?? payload.author ?? payload.from;

  const createdAt =
    typeof payload.createdAt === "string" && payload.createdAt.trim().length
      ? payload.createdAt.trim()
      : new Date().toISOString();

  const id =
    typeof payload.id === "string" && payload.id.trim().length
      ? payload.id.trim()
      : createMessageId();

  const result = {
    id,
    role: normalizeRole(roleSource),
    text,
    createdAt,
  };

  // 保留 imageUrl（如果存在）
  if (typeof payload.imageUrl === "string" && payload.imageUrl.trim().length) {
    const imageUrl = payload.imageUrl.trim();

    // ✅ P0 優化：檢查 imageUrl 是否為 base64（不應該出現）
    if (imageUrl.startsWith('data:image')) {
      logger.error('[對話服務] 錯誤：消息包含 base64 圖片，應該先上傳到 Storage');
      throw new Error('圖片應該先上傳到 Storage，不能直接使用 base64');
    }

    // ✅ P0 優化：檢查 URL 長度（Firebase Storage URL 通常 < 500 字符）
    const MAX_URL_LENGTH = 2000; // 2000 字符限制
    if (imageUrl.length > MAX_URL_LENGTH) {
      logger.error(`[對話服務] 圖片 URL 過長: ${imageUrl.length} 字符`);
      throw new Error(`圖片 URL 過長（${imageUrl.length} 字符），請檢查是否正確上傳`);
    }

    result.imageUrl = imageUrl;
    logger.info(`[對話服務] ✅ 訊息包含 imageUrl: ${result.imageUrl.substring(0, 50)}..., 長度: ${result.imageUrl.length}`);
  } else if (payload.imageUrl !== undefined) {
    logger.warn(`[對話服務] ⚠️ imageUrl 無效: type=${typeof payload.imageUrl}, value=${payload.imageUrl?.substring(0, 50)}`);
  } else {
    logger.warn(`[對話服務] ⚠️ payload 中沒有 imageUrl 字段`);
  }

  // 保留 video（如果存在）
  if (payload.video && typeof payload.video === "object") {
    const video = {};
    if (typeof payload.video.url === "string" && payload.video.url.trim().length) {
      video.url = payload.video.url.trim();

      // ✅ P0 優化：檢查 video URL 長度
      const MAX_URL_LENGTH = 2000;
      if (video.url.length > MAX_URL_LENGTH) {
        logger.error(`[對話服務] 視頻 URL 過長: ${video.url.length} 字符`);
        throw new Error(`視頻 URL 過長（${video.url.length} 字符）`);
      }
    }
    if (typeof payload.video.duration === "string") {
      video.duration = payload.video.duration.trim();
    }
    if (typeof payload.video.resolution === "string") {
      video.resolution = payload.video.resolution.trim();
    }

    if (video.url) {
      result.video = video;
      logger.info(`[對話服務] ✅ 訊息包含 video: ${video.url.substring(0, 50)}..., duration: ${video.duration || 'N/A'}`);
    }
  }

  // ✅ P0 優化：檢查單條消息總大小
  const MAX_SINGLE_MESSAGE_SIZE = 50 * 1024; // 50KB 限制
  const messageSize = JSON.stringify(result).length;

  if (messageSize > MAX_SINGLE_MESSAGE_SIZE) {
    logger.error(`[對話服務] 單條消息過大: ${(messageSize / 1024).toFixed(2)} KB`);
    throw new Error(`消息過大（${(messageSize / 1024).toFixed(2)} KB），請縮短文字或檢查圖片/視頻 URL`);
  }

  return result;
};

/**
 * 獲取對話文檔引用
 */
const getConversationRef = (userId, characterId) => {
  const key = createConversationKey(userId, characterId);
  const db = getFirestoreDb();
  return db.collection(CONVERSATIONS_COLLECTION).doc(key);
};

/**
 * 獲取對話歷史（帶緩存）
 */
export const getConversationHistory = async (userId, characterId) => {
  const cacheKey = createConversationKey(userId, characterId);

  // 1. 先檢查緩存
  const cached = conversationCache.get(cacheKey);
  if (cached !== undefined) {
    logger.info(`[對話服務] 💾 從緩存讀取對話: userId=${userId}, characterId=${characterId}`);
    // ✅ P1 優化：使用 structuredClone 替代 JSON.parse/stringify（快 5 倍）
    return structuredClone(cached);
  }

  // 2. 緩存未命中，從 Firestore 讀取
  const conversationRef = getConversationRef(userId, characterId);
  const doc = await conversationRef.get();

  if (!doc.exists) {
    // 空對話也緩存，避免重複查詢
    conversationCache.set(cacheKey, []);
    return [];
  }

  const data = doc.data();
  const messages = Array.isArray(data.messages) ? data.messages : [];

  // 調試：檢查讀取的消息中有多少包含圖片
  const messagesWithImages = messages.filter(m => m.imageUrl);
  logger.info(`[對話服務] 📖 從 Firestore 讀取對話歷史: userId=${userId}, characterId=${characterId}`);
  logger.info(`[對話服務] 📖 共 ${messages.length} 則訊息, 其中 ${messagesWithImages.length} 則包含圖片`);

  if (messagesWithImages.length > 0) {
    messagesWithImages.forEach((msg, index) => {
      logger.info(`[對話服務] 📖 照片消息 ${index + 1}: id=${msg.id}, imageUrlLength=${msg.imageUrl?.length}, imageUrlPrefix=${msg.imageUrl?.substring(0, 100)}`);
    });
  }

  // 3. 存入緩存
  conversationCache.set(cacheKey, messages);

  // ✅ P1 優化：使用 structuredClone 返回深拷貝
  return structuredClone(messages);
};

/**
 * 替換整個對話歷史
 */
export const replaceConversationHistory = async (userId, characterId, messages) => {
  const key = createConversationKey(userId, characterId);

  const normalizedMessages = Array.isArray(messages)
    ? messages.map((entry) => normalizeMessagePayload(entry))
    : [];

  const conversationRef = getConversationRef(userId, characterId);

  await conversationRef.set(
    {
      id: key,
      userId,
      characterId,
      messages: normalizedMessages,
      messageCount: normalizedMessages.length,
      lastMessage: normalizedMessages.length > 0
        ? normalizedMessages[normalizedMessages.length - 1].text
        : "",
      lastMessageAt: normalizedMessages.length > 0
        ? normalizedMessages[normalizedMessages.length - 1].createdAt
        : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 清除緩存
  conversationCache.delete(key);

  return getConversationHistory(userId, characterId);
};

/**
 * 添加多條訊息到對話歷史
 */
export const appendConversationMessages = async (userId, characterId, messages) => {
  if (!Array.isArray(messages) || !messages.length) {
    throw new Error("需提供至少一則訊息才能新增聊天紀錄");
  }

  const normalized = messages.map((entry) => normalizeMessagePayload(entry));

  // 調試：記錄準備添加的消息
  normalized.forEach((msg, index) => {
    logger.info(`[對話服務] 📝 準備添加消息 ${index + 1}/${normalized.length}: id=${msg.id}, role=${msg.role}, hasImageUrl=${!!msg.imageUrl}, imageUrlLength=${msg.imageUrl?.length || 0}`);
    if (msg.imageUrl) {
      logger.info(`[對話服務] 📝 消息包含圖片 URL: ${msg.imageUrl.substring(0, 100)}...`);
    }
  });

  const conversationRef = getConversationRef(userId, characterId);

  // 使用 transaction 確保數據一致性
  const db = getFirestoreDb();
  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(conversationRef);

    let currentMessages = [];
    if (doc.exists) {
      const data = doc.data();
      currentMessages = Array.isArray(data.messages) ? data.messages : [];
    }

    // 添加新訊息
    const updatedMessages = [...currentMessages, ...normalized];

    // 限制最大緩存訊息數量（防止文檔過大）
    if (updatedMessages.length > HISTORY_LIMITS.MAX_CACHED_MESSAGES) {
      const excessCount = updatedMessages.length - HISTORY_LIMITS.MAX_CACHED_MESSAGES;
      updatedMessages.splice(0, excessCount);
    }

    // ✅ 新增：檢查總大小，防止超過 Firestore 1MB 限制
    let totalSize = JSON.stringify(updatedMessages).length;
    let sizeOptimized = false;

    // 如果總大小超過限制，持續移除最舊的訊息直到符合限制
    while (totalSize > HISTORY_LIMITS.MAX_TOTAL_SIZE && updatedMessages.length > 10) {
      updatedMessages.shift(); // 移除最舊的訊息
      totalSize = JSON.stringify(updatedMessages).length;
      sizeOptimized = true;
    }

    // 記錄大小優化日誌（僅在實際優化時）
    if (sizeOptimized) {
      logger.warn(
        `[對話服務] ⚠️ 訊息總大小超過限制，已優化至 ${(totalSize / 1024).toFixed(2)} KB，` +
        `保留 ${updatedMessages.length} 則訊息`
      );
    }

    const lastMessage = updatedMessages[updatedMessages.length - 1];

    const key = createConversationKey(userId, characterId);

    // 檢查要保存的消息中是否有 imageUrl
    const messagesWithImages = updatedMessages.filter(m => m.imageUrl);
    logger.info(`[對話服務] 準備保存 ${updatedMessages.length} 則訊息, 其中 ${messagesWithImages.length} 則包含圖片`);

    transaction.set(
      conversationRef,
      {
        id: key,
        userId,
        characterId,
        messages: updatedMessages,
        messageCount: updatedMessages.length,
        lastMessage: lastMessage.text,
        lastMessageAt: lastMessage.createdAt,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: doc.exists ? (doc.data().createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 檢查返回的數據
    const returnedMessagesWithImages = updatedMessages.filter(m => m.imageUrl);
    logger.info(`[對話服務] 返回 ${updatedMessages.length} 則訊息, 其中 ${returnedMessagesWithImages.length} 則包含圖片`);

    return {
      appended: normalized.map((entry) => ({ ...entry })),
      history: updatedMessages.map((entry) => ({ ...entry })),
    };
  });

  // 驗證：從 Firestore 讀取回來檢查數據完整性
  try {
    const verifyDoc = await conversationRef.get();
    if (verifyDoc.exists) {
      const verifyData = verifyDoc.data();
      const verifyMessages = verifyData.messages || [];
      const verifyImagesCount = verifyMessages.filter(m => m.imageUrl).length;
      logger.info(`[對話服務] ✅ Firestore 驗證: 文檔包含 ${verifyMessages.length} 則訊息, 其中 ${verifyImagesCount} 則有圖片`);

      // 檢查剛添加的消息是否保存成功
      normalized.forEach((addedMsg) => {
        const found = verifyMessages.find(m => m.id === addedMsg.id);
        if (found) {
          logger.info(`[對話服務] ✅ 消息已保存: id=${found.id}, hasImageUrl=${!!found.imageUrl}`);
          if (addedMsg.imageUrl && !found.imageUrl) {
            logger.error(`[對話服務] ❌ 警告：消息在保存到 Firestore 後丟失了 imageUrl! id=${addedMsg.id}`);
          }
        } else {
          logger.error(`[對話服務] ❌ 消息保存失敗: id=${addedMsg.id}`);
        }
      });
    }
  } catch (verifyError) {
    logger.warn(`[對話服務] ⚠️ Firestore 驗證失敗:`, verifyError.message);
  }

  // 清除緩存
  const key = createConversationKey(userId, characterId);
  conversationCache.delete(key);

  return result;
};

/**
 * 添加單條訊息到對話歷史
 */
export const appendConversationMessage = async (userId, characterId, message) => {
  const { appended, history } = await appendConversationMessages(userId, characterId, [
    message,
  ]);
  return {
    appended: appended[0],
    history,
  };
};

/**
 * 清空對話歷史
 */
export const clearConversationHistory = async (userId, characterId) => {
  const conversationRef = getConversationRef(userId, characterId);
  await conversationRef.delete();

  // 清除緩存
  const key = createConversationKey(userId, characterId);
  conversationCache.delete(key);
};

/**
 * 獲取所有對話的快照（主要用於調試和監控）
 */
export const getConversationStoreSnapshot = async () => {
  const db = getFirestoreDb();
  const snapshot = await db.collection(CONVERSATIONS_COLLECTION).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      key: doc.id,
      history: Array.isArray(data.messages)
        ? data.messages.map((entry) => ({ ...entry }))
        : [],
    };
  });
};

/**
 * 獲取對話緩存統計資訊（包含 LRU 緩存統計）
 * @returns {Object} 緩存統計
 */
export const getConversationCacheStats = async () => {
  const db = getFirestoreDb();
  const snapshot = await db.collection(CONVERSATIONS_COLLECTION).get();

  let totalMessages = 0;
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.messages)) {
      totalMessages += data.messages.length;
    }
  });

  // 獲取 LRU 緩存統計
  const lruStats = conversationCache.getStats();

  return {
    firestore: {
      conversationCount: snapshot.size,
      totalMessages,
      averageMessagesPerConversation: snapshot.size > 0
        ? Math.round(totalMessages / snapshot.size)
        : 0,
    },
    cache: {
      ...lruStats,
      ttl: '10 分鐘',
      maxSize: 1000,
    },
  };
};

/**
 * 獲取指定對話中所有包含圖片的訊息
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @returns {Array} 包含圖片的訊息列表
 */
export const getConversationPhotos = async (userId, characterId) => {
  const history = await getConversationHistory(userId, characterId);

  // 過濾出包含 imageUrl 的訊息
  return history
    .filter((message) => message.imageUrl)
    .map((entry) => ({ ...entry }));
};

/**
 * 刪除指定的照片訊息
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {Array<string>} messageIds - 要刪除的訊息 ID 列表
 * @returns {Object} 刪除結果
 */
export const deleteConversationPhotos = async (userId, characterId, messageIds) => {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new Error("需提供至少一個訊息 ID");
  }

  const conversationRef = getConversationRef(userId, characterId);
  const db = getFirestoreDb();

  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(conversationRef);

    if (!doc.exists) {
      return {
        deleted: [],
        remaining: 0,
      };
    }

    const data = doc.data();
    const currentMessages = Array.isArray(data.messages) ? data.messages : [];

    const messageIdSet = new Set(messageIds);
    const deletedPhotos = [];

    // 過濾掉要刪除的訊息
    const newHistory = currentMessages.filter((message) => {
      if (messageIdSet.has(message.id) && message.imageUrl) {
        deletedPhotos.push({ ...message });
        return false;
      }
      return true;
    });

    // 更新對話歷史
    const lastMessage = newHistory.length > 0
      ? newHistory[newHistory.length - 1]
      : null;

    transaction.set(
      conversationRef,
      {
        messages: newHistory,
        messageCount: newHistory.length,
        lastMessage: lastMessage ? lastMessage.text : "",
        lastMessageAt: lastMessage ? lastMessage.createdAt : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      deleted: deletedPhotos,
      remaining: newHistory.filter((msg) => msg.imageUrl).length,
    };
  });

  // 清除緩存
  const key = createConversationKey(userId, characterId);
  conversationCache.delete(key);

  return result;
};

/**
 * 刪除指定的訊息（通用）
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {Array<string>} messageIds - 要刪除的訊息 ID 列表
 * @returns {Object} 刪除結果
 */
export const deleteConversationMessages = async (userId, characterId, messageIds) => {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new Error("需提供至少一個訊息 ID");
  }

  const conversationRef = getConversationRef(userId, characterId);
  const db = getFirestoreDb();

  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(conversationRef);

    if (!doc.exists) {
      return {
        deleted: [],
        remaining: 0,
      };
    }

    const data = doc.data();
    const currentMessages = Array.isArray(data.messages) ? data.messages : [];

    const messageIdSet = new Set(messageIds);
    const deletedMessages = [];

    // 過濾掉要刪除的訊息
    const newHistory = currentMessages.filter((message) => {
      if (messageIdSet.has(message.id)) {
        deletedMessages.push({ ...message });
        return false;
      }
      return true;
    });

    // 更新對話歷史
    const lastMessage = newHistory.length > 0
      ? newHistory[newHistory.length - 1]
      : null;

    transaction.set(
      conversationRef,
      {
        messages: newHistory,
        messageCount: newHistory.length,
        lastMessage: lastMessage ? lastMessage.text : "",
        lastMessageAt: lastMessage ? lastMessage.createdAt : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info(`[對話服務] 🗑️ 刪除訊息: userId=${userId}, characterId=${characterId}, 刪除數量=${deletedMessages.length}`);

    return {
      deleted: deletedMessages,
      remaining: newHistory.length,
    };
  });

  // 清除緩存
  const key = createConversationKey(userId, characterId);
  conversationCache.delete(key);

  return result;
};
