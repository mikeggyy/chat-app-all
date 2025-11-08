import { randomUUID } from "node:crypto";

const generationLogs = new Map();

const isoNow = () => new Date().toISOString();

const trimString = (value) =>
  typeof value === "string" ? value.trim() : "";

/**
 * 記錄角色生成請求
 * @param {Object} params - 生成參數
 * @param {string} params.userId - 用戶ID
 * @param {string} params.flowId - 流程ID
 * @param {string} params.gender - 性別
 * @param {string} params.description - 形象描述
 * @param {Array<string>} params.styles - 風格列表
 * @param {Object} params.referenceInfo - 參考圖片信息
 * @returns {Object} 生成記錄
 */
export const createGenerationLog = ({
  userId,
  flowId,
  gender,
  description,
  styles = [],
  referenceInfo = null,
}) => {
  const now = isoNow();
  const logId = `genlog-${randomUUID()}`;

  const log = {
    id: logId,
    userId: trimString(userId),
    flowId: trimString(flowId),
    status: "pending", // pending, processing, success, failed
    input: {
      gender: trimString(gender),
      description: trimString(description),
      styles: Array.isArray(styles) ? styles : [],
      referenceInfo: referenceInfo || null,
    },
    result: null,
    error: null,
    timestamps: {
      requested: now,
      started: null,
      completed: null,
    },
    metadata: {
      userAgent: null,
      ipAddress: null,
    },
    createdAt: now,
    updatedAt: now,
  };

  generationLogs.set(logId, log);
  return { ...log };
};

/**
 * 更新生成記錄狀態為處理中
 * @param {string} logId - 記錄ID
 * @returns {Object} 更新後的記錄
 */
export const markGenerationStarted = (logId) => {
  const log = generationLogs.get(logId);
  if (!log) {
    const error = new Error("找不到生成記錄");
    error.status = 404;
    throw error;
  }

  const now = isoNow();
  log.status = "processing";
  log.timestamps.started = now;
  log.updatedAt = now;

  return { ...log };
};

/**
 * 更新生成記錄為成功
 * @param {string} logId - 記錄ID
 * @param {Object} result - 生成結果
 * @returns {Object} 更新後的記錄
 */
export const markGenerationSuccess = (logId, result = null) => {
  const log = generationLogs.get(logId);
  if (!log) {
    const error = new Error("找不到生成記錄");
    error.status = 404;
    throw error;
  }

  const now = isoNow();
  log.status = "success";
  log.result = result;
  log.error = null;
  log.timestamps.completed = now;
  log.updatedAt = now;

  return { ...log };
};

/**
 * 更新生成記錄為失敗
 * @param {string} logId - 記錄ID
 * @param {Error|string} error - 錯誤信息
 * @returns {Object} 更新後的記錄
 */
export const markGenerationFailed = (logId, error) => {
  const log = generationLogs.get(logId);
  if (!log) {
    const err = new Error("找不到生成記錄");
    err.status = 404;
    throw err;
  }

  const now = isoNow();
  log.status = "failed";
  log.error = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
    timestamp: now,
  };
  log.timestamps.completed = now;
  log.updatedAt = now;

  return { ...log };
};

/**
 * 獲取單個生成記錄
 * @param {string} logId - 記錄ID
 * @returns {Object|null} 生成記錄
 */
export const getGenerationLog = (logId) => {
  const log = generationLogs.get(logId);
  return log ? { ...log } : null;
};

/**
 * 獲取用戶的所有生成記錄
 * @param {string} userId - 用戶ID
 * @param {Object} options - 查詢選項
 * @param {number} options.limit - 限制數量
 * @param {number} options.offset - 偏移量
 * @returns {Array<Object>} 生成記錄列表
 */
export const getUserGenerationLogs = (userId, { limit = 50, offset = 0 } = {}) => {
  const userLogs = Array.from(generationLogs.values())
    .filter((log) => log.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(offset, offset + limit);

  return userLogs.map((log) => ({ ...log }));
};

/**
 * 獲取流程的生成記錄
 * @param {string} flowId - 流程ID
 * @returns {Object|null} 生成記錄
 */
export const getFlowGenerationLog = (flowId) => {
  const logs = Array.from(generationLogs.values())
    .filter((log) => log.flowId === flowId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return logs.length > 0 ? { ...logs[0] } : null;
};

/**
 * 獲取所有生成記錄（用於管理）
 * @param {Object} options - 查詢選項
 * @param {number} options.limit - 限制數量
 * @param {number} options.offset - 偏移量
 * @param {string} options.status - 狀態篩選
 * @returns {Object} 包含記錄和總數
 */
export const getAllGenerationLogs = ({ limit = 50, offset = 0, status = null } = {}) => {
  let logs = Array.from(generationLogs.values());

  if (status) {
    logs = logs.filter((log) => log.status === status);
  }

  const total = logs.length;
  const items = logs
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(offset, offset + limit)
    .map((log) => ({ ...log }));

  return {
    items,
    total,
    limit,
    offset,
  };
};

/**
 * 獲取生成統計信息
 * @param {string} userId - 用戶ID（可選）
 * @returns {Object} 統計信息
 */
export const getGenerationStats = (userId = null) => {
  let logs = Array.from(generationLogs.values());

  if (userId) {
    logs = logs.filter((log) => log.userId === userId);
  }

  const stats = {
    total: logs.length,
    pending: logs.filter((log) => log.status === "pending").length,
    processing: logs.filter((log) => log.status === "processing").length,
    success: logs.filter((log) => log.status === "success").length,
    failed: logs.filter((log) => log.status === "failed").length,
  };

  return stats;
};

/**
 * 清空所有生成記錄（僅用於測試）
 */
export const clearGenerationLogs = () => {
  generationLogs.clear();
};
