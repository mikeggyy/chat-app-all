/**
 * 資產變更審計日誌服務
 * 記錄所有資產的增加和消耗操作，用於審計和數據分析
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

const ASSET_AUDIT_LOGS_COLLECTION = "asset_audit_logs";

/**
 * 記錄資產變更
 * @param {Object} params - 日誌參數
 * @param {string} params.userId - 用戶 ID
 * @param {string} params.assetType - 資產類型
 * @param {string} params.action - 操作類型 ('add' | 'consume' | 'set')
 * @param {number} params.amount - 變更數量
 * @param {number} params.previousQuantity - 變更前數量
 * @param {number} params.newQuantity - 變更後數量
 * @param {string} params.reason - 變更原因
 * @param {Object} params.metadata - 額外元數據
 * @returns {Promise<string>} 日誌文檔 ID
 */
export const logAssetChange = async ({
  userId,
  assetType,
  action,
  amount,
  previousQuantity,
  newQuantity,
  reason = "",
  metadata = {},
}) => {
  if (!userId || !assetType || !action) {
    throw new Error("userId, assetType, action 是必填參數");
  }

  const db = getFirestoreDb();

  const logData = {
    userId,
    assetType,
    action,
    amount: amount || 0,
    previousQuantity: previousQuantity || 0,
    newQuantity: newQuantity || 0,
    reason,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  };

  try {
    const logRef = await db.collection(ASSET_AUDIT_LOGS_COLLECTION).add(logData);

    logger.debug(
      `[資產審計] 記錄變更: userId=${userId}, assetType=${assetType}, action=${action}, amount=${amount}, reason=${reason}`
    );

    return logRef.id;
  } catch (error) {
    logger.error(`[資產審計] 記錄失敗:`, error);
    // 不拋出錯誤，避免影響主業務流程
    return null;
  }
};

/**
 * 獲取用戶的資產變更歷史
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 查詢選項
 * @param {string} options.assetType - 篩選特定資產類型
 * @param {number} options.limit - 限制返回數量
 * @param {Date} options.startDate - 開始日期
 * @param {Date} options.endDate - 結束日期
 * @returns {Promise<Array>} 變更記錄列表
 */
export const getUserAssetHistory = async (userId, options = {}) => {
  const {
    assetType = null,
    limit = 50,
    startDate = null,
    endDate = null,
  } = options;

  const db = getFirestoreDb();
  let query = db
    .collection(ASSET_AUDIT_LOGS_COLLECTION)
    .where("userId", "==", userId);

  if (assetType) {
    query = query.where("assetType", "==", assetType);
  }

  if (startDate) {
    query = query.where("createdAt", ">=", startDate);
  }

  if (endDate) {
    query = query.where("createdAt", "<=", endDate);
  }

  query = query.orderBy("createdAt", "desc").limit(limit);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * 獲取資產變更統計
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {Object} options - 選項
 * @param {Date} options.startDate - 開始日期
 * @param {Date} options.endDate - 結束日期
 * @returns {Promise<Object>} 統計數據
 */
export const getAssetChangeStats = async (userId, assetType, options = {}) => {
  const { startDate = null, endDate = null } = options;

  const db = getFirestoreDb();
  let query = db
    .collection(ASSET_AUDIT_LOGS_COLLECTION)
    .where("userId", "==", userId)
    .where("assetType", "==", assetType);

  if (startDate) {
    query = query.where("createdAt", ">=", startDate);
  }

  if (endDate) {
    query = query.where("createdAt", "<=", endDate);
  }

  const snapshot = await query.get();

  const stats = {
    totalChanges: snapshot.size,
    totalAdded: 0,
    totalConsumed: 0,
    totalSet: 0,
  };

  snapshot.forEach((doc) => {
    const data = doc.data();
    switch (data.action) {
      case "add":
        stats.totalAdded += data.amount || 0;
        break;
      case "consume":
        stats.totalConsumed += data.amount || 0;
        break;
      case "set":
        stats.totalSet++;
        break;
    }
  });

  return stats;
};
