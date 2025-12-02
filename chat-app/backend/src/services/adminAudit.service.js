/**
 * 管理員操作審計日誌服務
 * ✅ 2025-12-02 新增：記錄所有管理員操作，用於安全審計和數據追溯
 *
 * 記錄的操作類型：
 * - USER_MEMBERSHIP_CHANGE: 用戶會員等級變更
 * - USER_COINS_ADJUST: 用戶金幣調整（增加/扣除/設置）
 * - USER_ASSET_ADJUST: 用戶資產調整
 * - USER_BAN: 用戶封禁/解封
 * - REFUND: 退款操作
 * - CHARACTER_CREATE: 角色創建
 * - CHARACTER_UPDATE: 角色更新
 * - CHARACTER_DELETE: 角色刪除
 * - CONFIG_UPDATE: 系統配置更新
 * - DATA_EXPORT: 數據導出
 * - DATA_DELETE: 數據刪除
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

const ADMIN_AUDIT_LOGS_COLLECTION = "admin_audit_logs";

/**
 * 審計操作類型枚舉
 */
export const ADMIN_AUDIT_TYPES = {
  // 用戶管理
  USER_MEMBERSHIP_CHANGE: "USER_MEMBERSHIP_CHANGE",
  USER_COINS_ADJUST: "USER_COINS_ADJUST",
  USER_ASSET_ADJUST: "USER_ASSET_ADJUST",
  USER_BAN: "USER_BAN",
  USER_UNBAN: "USER_UNBAN",
  USER_DELETE: "USER_DELETE",

  // 財務操作
  REFUND: "REFUND",
  FORCE_REFUND: "FORCE_REFUND",
  MANUAL_RECHARGE: "MANUAL_RECHARGE",

  // 角色管理
  CHARACTER_CREATE: "CHARACTER_CREATE",
  CHARACTER_UPDATE: "CHARACTER_UPDATE",
  CHARACTER_DELETE: "CHARACTER_DELETE",
  CHARACTER_RESTORE: "CHARACTER_RESTORE",

  // 系統配置
  CONFIG_UPDATE: "CONFIG_UPDATE",
  FEATURE_TOGGLE: "FEATURE_TOGGLE",

  // 數據操作
  DATA_EXPORT: "DATA_EXPORT",
  DATA_DELETE: "DATA_DELETE",
  DATA_RESTORE: "DATA_RESTORE",

  // 安全操作
  PERMISSION_CHANGE: "PERMISSION_CHANGE",
  API_KEY_ROTATE: "API_KEY_ROTATE",
  SECURITY_OVERRIDE: "SECURITY_OVERRIDE",
};

/**
 * 操作嚴重性等級
 */
export const SEVERITY_LEVELS = {
  LOW: "low",           // 一般操作，如查詢、配置查看
  MEDIUM: "medium",     // 中等操作，如數據更新、角色管理
  HIGH: "high",         // 高風險操作，如退款、用戶封禁
  CRITICAL: "critical", // 關鍵操作，如強制退款、數據刪除、權限變更
};

/**
 * 操作類型對應的默認嚴重性
 */
const DEFAULT_SEVERITY = {
  [ADMIN_AUDIT_TYPES.USER_MEMBERSHIP_CHANGE]: SEVERITY_LEVELS.MEDIUM,
  [ADMIN_AUDIT_TYPES.USER_COINS_ADJUST]: SEVERITY_LEVELS.HIGH,
  [ADMIN_AUDIT_TYPES.USER_ASSET_ADJUST]: SEVERITY_LEVELS.MEDIUM,
  [ADMIN_AUDIT_TYPES.USER_BAN]: SEVERITY_LEVELS.HIGH,
  [ADMIN_AUDIT_TYPES.USER_UNBAN]: SEVERITY_LEVELS.MEDIUM,
  [ADMIN_AUDIT_TYPES.USER_DELETE]: SEVERITY_LEVELS.CRITICAL,
  [ADMIN_AUDIT_TYPES.REFUND]: SEVERITY_LEVELS.HIGH,
  [ADMIN_AUDIT_TYPES.FORCE_REFUND]: SEVERITY_LEVELS.CRITICAL,
  [ADMIN_AUDIT_TYPES.MANUAL_RECHARGE]: SEVERITY_LEVELS.HIGH,
  [ADMIN_AUDIT_TYPES.CHARACTER_CREATE]: SEVERITY_LEVELS.LOW,
  [ADMIN_AUDIT_TYPES.CHARACTER_UPDATE]: SEVERITY_LEVELS.MEDIUM,
  [ADMIN_AUDIT_TYPES.CHARACTER_DELETE]: SEVERITY_LEVELS.HIGH,
  [ADMIN_AUDIT_TYPES.CHARACTER_RESTORE]: SEVERITY_LEVELS.MEDIUM,
  [ADMIN_AUDIT_TYPES.CONFIG_UPDATE]: SEVERITY_LEVELS.HIGH,
  [ADMIN_AUDIT_TYPES.FEATURE_TOGGLE]: SEVERITY_LEVELS.HIGH,
  [ADMIN_AUDIT_TYPES.DATA_EXPORT]: SEVERITY_LEVELS.MEDIUM,
  [ADMIN_AUDIT_TYPES.DATA_DELETE]: SEVERITY_LEVELS.CRITICAL,
  [ADMIN_AUDIT_TYPES.DATA_RESTORE]: SEVERITY_LEVELS.MEDIUM,
  [ADMIN_AUDIT_TYPES.PERMISSION_CHANGE]: SEVERITY_LEVELS.CRITICAL,
  [ADMIN_AUDIT_TYPES.API_KEY_ROTATE]: SEVERITY_LEVELS.CRITICAL,
  [ADMIN_AUDIT_TYPES.SECURITY_OVERRIDE]: SEVERITY_LEVELS.CRITICAL,
};

/**
 * 記錄管理員操作
 * @param {Object} params - 審計參數
 * @param {string} params.adminId - 執行操作的管理員 ID
 * @param {string} params.adminEmail - 管理員郵箱（用於識別）
 * @param {string} params.action - 操作類型 (ADMIN_AUDIT_TYPES)
 * @param {string} params.targetType - 目標類型 ('user' | 'character' | 'config' | 'system')
 * @param {string} params.targetId - 目標 ID（用戶 ID、角色 ID 等）
 * @param {Object} params.beforeState - 操作前狀態
 * @param {Object} params.afterState - 操作後狀態
 * @param {string} params.reason - 操作原因
 * @param {Object} params.metadata - 額外元數據
 * @param {string} params.ip - 請求 IP 地址
 * @param {string} params.userAgent - 請求 User-Agent
 * @returns {Promise<string>} 審計日誌 ID
 */
export const logAdminAction = async ({
  adminId,
  adminEmail = null,
  action,
  targetType,
  targetId = null,
  beforeState = null,
  afterState = null,
  reason = "",
  metadata = {},
  ip = null,
  userAgent = null,
}) => {
  if (!adminId || !action) {
    logger.warn("[管理員審計] 缺少必要參數 adminId 或 action，跳過記錄");
    return null;
  }

  // 驗證操作類型
  if (!Object.values(ADMIN_AUDIT_TYPES).includes(action)) {
    logger.warn(`[管理員審計] 未知的操作類型: ${action}`);
  }

  const db = getFirestoreDb();
  const severity = DEFAULT_SEVERITY[action] || SEVERITY_LEVELS.MEDIUM;

  const auditData = {
    // 管理員信息
    adminId,
    adminEmail,

    // 操作信息
    action,
    severity,
    targetType,
    targetId,

    // 狀態變更
    beforeState,
    afterState,

    // 原因和元數據
    reason,
    metadata,

    // 請求信息
    ip,
    userAgent,

    // 時間戳
    createdAt: FieldValue.serverTimestamp(),
    timestamp: new Date().toISOString(),
  };

  try {
    const logRef = await db.collection(ADMIN_AUDIT_LOGS_COLLECTION).add(auditData);

    // 根據嚴重性選擇日誌級別
    const logMessage = `[管理員審計] ${severity.toUpperCase()}: ${action} - admin=${adminId}, target=${targetType}:${targetId}, reason=${reason}`;

    if (severity === SEVERITY_LEVELS.CRITICAL) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }

    return logRef.id;
  } catch (error) {
    logger.error(`[管理員審計] 記錄失敗:`, error);
    // 不拋出錯誤，避免影響主業務流程
    return null;
  }
};

/**
 * 便捷方法：記錄用戶會員等級變更
 */
export const logMembershipChange = async (adminId, targetUserId, beforeTier, afterTier, reason, metadata = {}) => {
  return await logAdminAction({
    adminId,
    action: ADMIN_AUDIT_TYPES.USER_MEMBERSHIP_CHANGE,
    targetType: "user",
    targetId: targetUserId,
    beforeState: { membershipTier: beforeTier },
    afterState: { membershipTier: afterTier },
    reason,
    metadata,
  });
};

/**
 * 便捷方法：記錄用戶金幣調整
 */
export const logCoinsAdjust = async (adminId, targetUserId, beforeBalance, afterBalance, reason, metadata = {}) => {
  return await logAdminAction({
    adminId,
    action: ADMIN_AUDIT_TYPES.USER_COINS_ADJUST,
    targetType: "user",
    targetId: targetUserId,
    beforeState: { coins: beforeBalance },
    afterState: { coins: afterBalance },
    reason,
    metadata: {
      ...metadata,
      adjustment: afterBalance - beforeBalance,
    },
  });
};

/**
 * 便捷方法：記錄退款操作
 */
export const logRefund = async (adminId, targetUserId, transactionId, amount, reason, isForced = false, metadata = {}) => {
  return await logAdminAction({
    adminId,
    action: isForced ? ADMIN_AUDIT_TYPES.FORCE_REFUND : ADMIN_AUDIT_TYPES.REFUND,
    targetType: "user",
    targetId: targetUserId,
    beforeState: null,
    afterState: { refundedAmount: amount },
    reason,
    metadata: {
      ...metadata,
      transactionId,
      isForced,
    },
  });
};

/**
 * 便捷方法：記錄角色操作
 */
export const logCharacterAction = async (adminId, action, characterId, beforeState, afterState, reason, metadata = {}) => {
  return await logAdminAction({
    adminId,
    action,
    targetType: "character",
    targetId: characterId,
    beforeState,
    afterState,
    reason,
    metadata,
  });
};

/**
 * 便捷方法：記錄配置更新
 */
export const logConfigUpdate = async (adminId, configKey, beforeValue, afterValue, reason, metadata = {}) => {
  return await logAdminAction({
    adminId,
    action: ADMIN_AUDIT_TYPES.CONFIG_UPDATE,
    targetType: "config",
    targetId: configKey,
    beforeState: { value: beforeValue },
    afterState: { value: afterValue },
    reason,
    metadata,
  });
};

/**
 * 查詢審計日誌
 * @param {Object} options - 查詢選項
 * @param {string} options.adminId - 篩選管理員
 * @param {string} options.action - 篩選操作類型
 * @param {string} options.targetType - 篩選目標類型
 * @param {string} options.targetId - 篩選目標 ID
 * @param {string} options.severity - 篩選嚴重性
 * @param {Date} options.startDate - 開始日期
 * @param {Date} options.endDate - 結束日期
 * @param {number} options.limit - 限制返回數量
 * @param {number} options.offset - 偏移量
 * @returns {Promise<Array>} 審計日誌列表
 */
export const queryAuditLogs = async (options = {}) => {
  const {
    adminId = null,
    action = null,
    targetType = null,
    targetId = null,
    severity = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0,
  } = options;

  const db = getFirestoreDb();
  let query = db.collection(ADMIN_AUDIT_LOGS_COLLECTION);

  // 應用篩選條件
  if (adminId) {
    query = query.where("adminId", "==", adminId);
  }

  if (action) {
    query = query.where("action", "==", action);
  }

  if (targetType) {
    query = query.where("targetType", "==", targetType);
  }

  if (targetId) {
    query = query.where("targetId", "==", targetId);
  }

  if (severity) {
    query = query.where("severity", "==", severity);
  }

  if (startDate) {
    query = query.where("createdAt", ">=", startDate);
  }

  if (endDate) {
    query = query.where("createdAt", "<=", endDate);
  }

  // 排序和分頁
  query = query.orderBy("createdAt", "desc").limit(limit).offset(offset);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().timestamp,
  }));
};

/**
 * 獲取審計統計
 * @param {Object} options - 統計選項
 * @param {Date} options.startDate - 開始日期
 * @param {Date} options.endDate - 結束日期
 * @returns {Promise<Object>} 統計數據
 */
export const getAuditStats = async (options = {}) => {
  const { startDate = null, endDate = null } = options;

  const db = getFirestoreDb();
  let query = db.collection(ADMIN_AUDIT_LOGS_COLLECTION);

  if (startDate) {
    query = query.where("createdAt", ">=", startDate);
  }

  if (endDate) {
    query = query.where("createdAt", "<=", endDate);
  }

  const snapshot = await query.get();

  const stats = {
    totalActions: snapshot.size,
    byAction: {},
    bySeverity: {
      [SEVERITY_LEVELS.LOW]: 0,
      [SEVERITY_LEVELS.MEDIUM]: 0,
      [SEVERITY_LEVELS.HIGH]: 0,
      [SEVERITY_LEVELS.CRITICAL]: 0,
    },
    byAdmin: {},
  };

  snapshot.forEach((doc) => {
    const data = doc.data();

    // 按操作類型統計
    stats.byAction[data.action] = (stats.byAction[data.action] || 0) + 1;

    // 按嚴重性統計
    if (data.severity) {
      stats.bySeverity[data.severity] = (stats.bySeverity[data.severity] || 0) + 1;
    }

    // 按管理員統計
    if (data.adminId) {
      stats.byAdmin[data.adminId] = (stats.byAdmin[data.adminId] || 0) + 1;
    }
  });

  return stats;
};

export default {
  ADMIN_AUDIT_TYPES,
  SEVERITY_LEVELS,
  logAdminAction,
  logMembershipChange,
  logCoinsAdjust,
  logRefund,
  logCharacterAction,
  logConfigUpdate,
  queryAuditLogs,
  getAuditStats,
};
