/**
 * 錯誤日誌服務
 * 記錄系統關鍵錯誤，用於審計和故障排查
 */

import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "./logger.js";

const CRITICAL_ERRORS_COLLECTION = "critical_errors";

/**
 * 記錄關鍵錯誤
 * @param {Object} params - 錯誤參數
 * @param {string} params.errorType - 錯誤類型 (例如: 'rollback_failure', 'transaction_failure')
 * @param {string} params.userId - 用戶 ID
 * @param {string} params.operation - 失敗的操作 (例如: 'character_creation', 'asset_deduction')
 * @param {Error} params.error - 錯誤對象
 * @param {Object} params.context - 錯誤上下文信息
 * @returns {Promise<string>} 錯誤參考號
 */
export const logCriticalError = async ({
  errorType,
  userId,
  operation,
  error,
  context = {},
}) => {
  if (!errorType || !userId || !operation) {
    throw new Error("errorType, userId, operation 是必填參數");
  }

  const db = getFirestoreDb();

  // 生成錯誤參考號 (格式: ERR-時間戳-隨機碼)
  const timestamp = Date.now();
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const errorReference = `ERR-${timestamp}-${randomCode}`;

  const errorData = {
    errorReference,
    errorType,
    userId,
    operation,
    errorMessage: error?.message || "未知錯誤",
    errorStack: error?.stack || null,
    context,
    resolved: false, // 管理員可以標記為已解決
    createdAt: FieldValue.serverTimestamp(),
  };

  try {
    const errorRef = await db.collection(CRITICAL_ERRORS_COLLECTION).add(errorData);

    logger.error(
      `[錯誤日誌] 記錄關鍵錯誤: ${errorReference}, type=${errorType}, userId=${userId}, operation=${operation}`
    );

    return errorReference;
  } catch (logError) {
    logger.error(`[錯誤日誌] 記錄失敗:`, logError);
    // 即使日誌記錄失敗，也返回一個參考號
    return errorReference;
  }
};

/**
 * 獲取未解決的錯誤列表（管理員功能）
 * @param {Object} options - 查詢選項
 * @param {number} options.limit - 限制返回數量
 * @param {string} options.errorType - 篩選特定錯誤類型
 * @returns {Promise<Array>} 錯誤列表
 */
export const getUnresolvedErrors = async (options = {}) => {
  const { limit = 50, errorType = null } = options;

  const db = getFirestoreDb();
  let query = db
    .collection(CRITICAL_ERRORS_COLLECTION)
    .where("resolved", "==", false);

  if (errorType) {
    query = query.where("errorType", "==", errorType);
  }

  query = query.orderBy("createdAt", "desc").limit(limit);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * 標記錯誤為已解決（管理員功能）
 * @param {string} errorId - 錯誤文檔 ID
 * @param {string} resolvedBy - 解決者 ID
 * @param {string} resolution - 解決方案描述
 * @returns {Promise<void>}
 */
export const markErrorAsResolved = async (errorId, resolvedBy, resolution = "") => {
  const db = getFirestoreDb();

  await db.collection(CRITICAL_ERRORS_COLLECTION).doc(errorId).update({
    resolved: true,
    resolvedBy,
    resolution,
    resolvedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`[錯誤日誌] 錯誤已標記為已解決: ${errorId}, resolvedBy=${resolvedBy}`);
};

export default {
  logCriticalError,
  getUnresolvedErrors,
  markErrorAsResolved,
};
