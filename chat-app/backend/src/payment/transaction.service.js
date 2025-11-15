/**
 * 交易記錄服務
 * 處理所有金幣交易的記錄和查詢
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

const TRANSACTIONS_COLLECTION = "transactions";

/**
 * 交易類型
 */
export const TRANSACTION_TYPES = {
  PURCHASE: "purchase",           // 購買金幣
  SPEND: "spend",                 // 消費金幣
  REWARD: "reward",               // 獲得獎勵
  REFUND: "refund",               // 退款
  ADMIN: "admin",                 // 管理員操作
};

/**
 * 交易狀態
 */
export const TRANSACTION_STATUS = {
  PENDING: "pending",             // 待處理
  COMPLETED: "completed",         // 已完成
  FAILED: "failed",               // 失敗
  CANCELLED: "cancelled",         // 已取消
};

/**
 * 創建交易記錄（在 Firestore Transaction 內使用）
 * @param {Object} transaction - Firestore Transaction 對象
 * @param {Object} data - 交易數據
 * @returns {Object} 交易記錄參考和數據
 */
export const createTransactionInTx = (transaction, data) => {
  const {
    userId,
    type,
    amount,
    description,
    metadata = {},
    balanceBefore,
    balanceAfter,
    status = TRANSACTION_STATUS.COMPLETED,
  } = data;

  // 驗證必要欄位
  if (!userId || !type || amount === undefined || amount === null) {
    throw new Error("交易記錄缺少必要欄位：userId, type, amount");
  }

  if (!Object.values(TRANSACTION_TYPES).includes(type)) {
    throw new Error(`無效的交易類型：${type}`);
  }

  const db = getFirestoreDb();
  const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc();

  const transactionData = {
    id: transactionRef.id,
    userId,
    type,
    amount,
    description: description || "",
    metadata,
    balanceBefore: balanceBefore || 0,
    balanceAfter: balanceAfter || 0,
    status,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // 在事務內創建交易記錄
  transaction.set(transactionRef, transactionData);

  logger.info(`[交易服務] 在事務內創建交易記錄: ${transactionRef.id}, 用戶: ${userId}, 類型: ${type}, 金額: ${amount}`);

  return {
    ref: transactionRef,
    data: transactionData,
  };
};

/**
 * 創建交易記錄
 * @param {Object} data - 交易數據
 * @returns {Promise<Object>} 交易記錄
 */
export const createTransaction = async (data) => {
  const {
    userId,
    type,
    amount,
    description,
    metadata = {},
    balanceBefore,
    balanceAfter,
    status = TRANSACTION_STATUS.COMPLETED,
  } = data;

  // 驗證必要欄位
  if (!userId || !type || amount === undefined || amount === null) {
    throw new Error("交易記錄缺少必要欄位：userId, type, amount");
  }

  if (!Object.values(TRANSACTION_TYPES).includes(type)) {
    throw new Error(`無效的交易類型：${type}`);
  }

  const db = getFirestoreDb();
  const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc();

  const transaction = {
    id: transactionRef.id,
    userId,
    type,
    amount,
    description: description || "",
    metadata,
    balanceBefore: balanceBefore || 0,
    balanceAfter: balanceAfter || 0,
    status,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await transactionRef.set(transaction);

  logger.info(`[交易服務] 創建交易記錄: ${transactionRef.id}, 用戶: ${userId}, 類型: ${type}, 金額: ${amount}`);

  return {
    ...transaction,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * 獲取用戶的交易記錄
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Array>} 交易記錄列表
 */
export const getUserTransactions = async (userId, options = {}) => {
  const {
    limit = 50,
    offset = 0,
    type = null,
    status = null,
    startDate = null,
    endDate = null,
  } = options;

  const db = getFirestoreDb();
  let query = db
    .collection(TRANSACTIONS_COLLECTION)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc");

  // 添加類型過濾
  if (type) {
    query = query.where("type", "==", type);
  }

  // 添加狀態過濾
  if (status) {
    query = query.where("status", "==", status);
  }

  // 添加日期範圍過濾
  if (startDate) {
    query = query.where("createdAt", ">=", new Date(startDate));
  }
  if (endDate) {
    query = query.where("createdAt", "<=", new Date(endDate));
  }

  // 分頁
  if (offset > 0) {
    query = query.offset(offset);
  }
  query = query.limit(limit);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * 獲取交易記錄詳情
 * @param {string} transactionId - 交易 ID
 * @returns {Promise<Object|null>} 交易記錄
 */
export const getTransaction = async (transactionId) => {
  const db = getFirestoreDb();
  const doc = await db.collection(TRANSACTIONS_COLLECTION).doc(transactionId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  };
};

/**
 * 更新交易狀態
 * @param {string} transactionId - 交易 ID
 * @param {string} status - 新狀態
 * @param {Object} metadata - 額外資訊
 * @returns {Promise<Object>} 更新後的交易記錄
 */
export const updateTransactionStatus = async (transactionId, status, metadata = {}) => {
  if (!Object.values(TRANSACTION_STATUS).includes(status)) {
    throw new Error(`無效的交易狀態：${status}`);
  }

  const db = getFirestoreDb();
  const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);

  const updateData = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // 如果有額外資訊，更新 metadata
  if (Object.keys(metadata).length > 0) {
    const doc = await transactionRef.get();
    if (doc.exists) {
      const currentMetadata = doc.data().metadata || {};
      updateData.metadata = {
        ...currentMetadata,
        ...metadata,
      };
    }
  }

  await transactionRef.update(updateData);

  logger.info(`[交易服務] 更新交易狀態: ${transactionId}, 新狀態: ${status}`);

  return await getTransaction(transactionId);
};

/**
 * 獲取用戶交易統計
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 統計選項
 * @returns {Promise<Object>} 統計數據
 */
export const getUserTransactionStats = async (userId, options = {}) => {
  const {
    startDate = null,
    endDate = null,
  } = options;

  const db = getFirestoreDb();
  let query = db
    .collection(TRANSACTIONS_COLLECTION)
    .where("userId", "==", userId)
    .where("status", "==", TRANSACTION_STATUS.COMPLETED);

  // 添加日期範圍
  if (startDate) {
    query = query.where("createdAt", ">=", new Date(startDate));
  }
  if (endDate) {
    query = query.where("createdAt", "<=", new Date(endDate));
  }

  const snapshot = await query.get();

  const stats = {
    totalTransactions: snapshot.size,
    totalPurchased: 0,    // 總購買金額
    totalSpent: 0,        // 總消費金額
    totalRewarded: 0,     // 總獎勵金額
    totalRefunded: 0,     // 總退款金額
    byType: {},
  };

  snapshot.docs.forEach((doc) => {
    const transaction = doc.data();
    const type = transaction.type;
    const amount = transaction.amount || 0;

    // 按類型統計
    if (!stats.byType[type]) {
      stats.byType[type] = {
        count: 0,
        totalAmount: 0,
      };
    }
    stats.byType[type].count++;
    stats.byType[type].totalAmount += amount;

    // ✅ P1-3 修復：統一使用絕對值累計（amount 已統一為正數）
    // 按交易類型累計
    switch (type) {
      case TRANSACTION_TYPES.PURCHASE:
        stats.totalPurchased += amount;
        break;
      case TRANSACTION_TYPES.SPEND:
        stats.totalSpent += amount; // 移除 Math.abs()，amount 已是絕對值
        break;
      case TRANSACTION_TYPES.REWARD:
        stats.totalRewarded += amount;
        break;
      case TRANSACTION_TYPES.REFUND:
        stats.totalRefunded += amount;
        break;
    }
  });

  return stats;
};

/**
 * 刪除用戶的所有交易記錄（管理員功能，謹慎使用）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 刪除結果
 */
export const deleteUserTransactions = async (userId) => {
  const db = getFirestoreDb();
  const snapshot = await db
    .collection(TRANSACTIONS_COLLECTION)
    .where("userId", "==", userId)
    .get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }

  logger.warn(`[交易服務] 刪除用戶所有交易記錄: ${userId}, 數量: ${snapshot.size}`);

  return {
    success: true,
    deletedCount: snapshot.size,
  };
};

/**
 * 清除所有交易記錄（測試用）
 * @returns {Promise<Object>} 刪除結果
 */
export const clearAllTransactions = async () => {
  const db = getFirestoreDb();
  const snapshot = await db.collection(TRANSACTIONS_COLLECTION).get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }

  logger.warn(`[交易服務] 清除所有交易記錄, 數量: ${snapshot.size}`);

  return {
    success: true,
    deletedCount: snapshot.size,
  };
};

export default {
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  createTransaction,
  createTransactionInTx,
  getUserTransactions,
  getTransaction,
  updateTransactionStatus,
  getUserTransactionStats,
  deleteUserTransactions,
  clearAllTransactions,
};
