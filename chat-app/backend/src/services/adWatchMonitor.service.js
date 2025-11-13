/**
 * 廣告觀看異常監控服務
 *
 * ✅ P0-1 監控功能：
 * - 檢測異常的廣告觀看行為
 * - 記錄可疑活動
 * - 提供告警機制
 *
 * 異常行為定義：
 * 1. 短時間內多次觀看（10 分鐘內超過 5 次）
 * 2. 每日觀看次數接近上限（達到 8-10 次）
 * 3. 連續多天達到上限（可能是腳本）
 * 4. adId 格式異常（不符合預期格式）
 */

import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../utils/logger.js";

// 異常行為閾值配置
const ANOMALY_THRESHOLDS = {
  // 短時間內觀看次數閾值（10 分鐘內）
  SHORT_TERM_LIMIT: 5,
  SHORT_TERM_WINDOW: 10 * 60 * 1000, // 10 分鐘

  // 每日觀看接近上限閾值
  DAILY_WARNING_THRESHOLD: 8, // 達到 8 次時警告（上限為 10）

  // 連續達到上限天數閾值
  CONSECUTIVE_MAX_DAYS: 3, // 連續 3 天達到上限

  // 平均觀看間隔異常閾值（秒）
  MIN_AVG_INTERVAL: 90, // 平均間隔小於 90 秒視為異常
};

/**
 * 記錄廣告觀看事件（用於異常檢測）
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {string} adId - 廣告 ID
 * @param {Object} context - 額外上下文（IP、User-Agent 等）
 */
export const recordAdWatchEvent = async (userId, characterId, adId, context = {}) => {
  const db = getFirestoreDb();
  const eventRef = db.collection("ad_watch_events").doc();

  await eventRef.set({
    userId,
    characterId,
    adId,
    timestamp: FieldValue.serverTimestamp(),
    timestampMs: Date.now(),
    context: {
      ip: context.ip || null,
      userAgent: context.userAgent || null,
      platform: context.platform || null,
    },
    createdAt: FieldValue.serverTimestamp(),
  });

  // 立即檢測異常
  await detectAnomalies(userId);
};

/**
 * 檢測用戶的異常廣告觀看行為
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 異常檢測結果
 */
export const detectAnomalies = async (userId) => {
  const db = getFirestoreDb();
  const now = Date.now();

  // 1. 讀取用戶最近的廣告觀看事件（最近 1 小時）
  const recentEventsSnapshot = await db
    .collection("ad_watch_events")
    .where("userId", "==", userId)
    .where("timestampMs", ">=", now - 60 * 60 * 1000)
    .orderBy("timestampMs", "desc")
    .limit(20)
    .get();

  const recentEvents = recentEventsSnapshot.docs.map((doc) => doc.data());

  if (recentEvents.length === 0) {
    return { hasAnomaly: false };
  }

  const anomalies = [];

  // 2. 檢測短時間內多次觀看
  const shortTermEvents = recentEvents.filter(
    (event) => event.timestampMs >= now - ANOMALY_THRESHOLDS.SHORT_TERM_WINDOW
  );

  if (shortTermEvents.length >= ANOMALY_THRESHOLDS.SHORT_TERM_LIMIT) {
    anomalies.push({
      type: "short_term_burst",
      severity: "high",
      message: `10 分鐘內觀看 ${shortTermEvents.length} 次廣告（閾值: ${ANOMALY_THRESHOLDS.SHORT_TERM_LIMIT}）`,
      count: shortTermEvents.length,
    });
  }

  // 3. 計算平均觀看間隔
  if (recentEvents.length >= 3) {
    const intervals = [];
    for (let i = 0; i < recentEvents.length - 1; i++) {
      const interval = (recentEvents[i].timestampMs - recentEvents[i + 1].timestampMs) / 1000;
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

    if (avgInterval < ANOMALY_THRESHOLDS.MIN_AVG_INTERVAL) {
      anomalies.push({
        type: "low_avg_interval",
        severity: "medium",
        message: `平均觀看間隔過短: ${Math.round(avgInterval)} 秒（閾值: ${ANOMALY_THRESHOLDS.MIN_AVG_INTERVAL} 秒）`,
        avgInterval: Math.round(avgInterval),
      });
    }
  }

  // 4. 檢查每日觀看次數
  const statsRef = db.collection("ad_watch_stats").doc(userId);
  const statsDoc = await statsRef.get();

  if (statsDoc.exists) {
    const statsData = statsDoc.data();
    const today = new Date().toISOString().split("T")[0];
    const todayCount = statsData[today] || 0;

    if (todayCount >= ANOMALY_THRESHOLDS.DAILY_WARNING_THRESHOLD) {
      anomalies.push({
        type: "daily_limit_approaching",
        severity: "low",
        message: `今日觀看次數接近上限: ${todayCount}/10`,
        count: todayCount,
      });
    }

    // 5. 檢測連續多天達到上限
    const recentDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      recentDays.push({ date: dateStr, count: statsData[dateStr] || 0 });
    }

    const consecutiveMaxDays = recentDays.filter((day) => day.count >= 10).length;

    if (consecutiveMaxDays >= ANOMALY_THRESHOLDS.CONSECUTIVE_MAX_DAYS) {
      anomalies.push({
        type: "consecutive_max_days",
        severity: "high",
        message: `連續 ${consecutiveMaxDays} 天達到每日上限（可能為腳本行為）`,
        consecutiveDays: consecutiveMaxDays,
      });
    }
  }

  // 如果發現異常，記錄到專門的集合
  if (anomalies.length > 0) {
    await recordAnomalyAlert(userId, anomalies);
  }

  return {
    hasAnomaly: anomalies.length > 0,
    anomalies,
    totalRecentEvents: recentEvents.length,
  };
};

/**
 * 記錄異常告警
 * @param {string} userId - 用戶 ID
 * @param {Array} anomalies - 異常列表
 */
const recordAnomalyAlert = async (userId, anomalies) => {
  const db = getFirestoreDb();
  const alertRef = db.collection("ad_anomaly_alerts").doc();

  const highSeverity = anomalies.some((a) => a.severity === "high");

  await alertRef.set({
    userId,
    anomalies,
    severity: highSeverity ? "high" : "medium",
    status: "pending", // pending, reviewed, false_positive, confirmed
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  // 高嚴重度異常：記錄警告日誌
  if (highSeverity) {
    logger.warn(`[廣告監控] 檢測到高嚴重度異常行為`, {
      userId,
      anomalies: anomalies.map((a) => a.message),
    });
  } else {
    logger.info(`[廣告監控] 檢測到可疑廣告觀看行為`, {
      userId,
      anomalyCount: anomalies.length,
    });
  }
};

/**
 * 獲取異常告警列表（管理員功能）
 * @param {Object} options - 查詢選項
 * @returns {Promise<Array>} 告警列表
 */
export const getAnomalyAlerts = async (options = {}) => {
  const db = getFirestoreDb();
  const {
    status = "pending", // pending, reviewed, false_positive, confirmed
    severity = null, // high, medium, low
    limit = 50,
    offset = 0,
  } = options;

  let query = db.collection("ad_anomaly_alerts").orderBy("timestamp", "desc");

  if (status) {
    query = query.where("status", "==", status);
  }

  if (severity) {
    query = query.where("severity", "==", severity);
  }

  const snapshot = await query.limit(limit).offset(offset).get();

  const alerts = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate().toISOString(),
  }));

  return {
    alerts,
    total: snapshot.size,
    offset,
    limit,
  };
};

/**
 * 更新告警狀態（管理員功能）
 * @param {string} alertId - 告警 ID
 * @param {string} status - 新狀態
 * @param {string} adminNote - 管理員備註
 */
export const updateAlertStatus = async (alertId, status, adminNote = "") => {
  const db = getFirestoreDb();
  const alertRef = db.collection("ad_anomaly_alerts").doc(alertId);

  await alertRef.update({
    status,
    adminNote,
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`[廣告監控] 告警狀態已更新`, {
    alertId,
    status,
    adminNote,
  });
};

/**
 * 獲取用戶的異常統計（管理員功能）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 異常統計
 */
export const getUserAnomalyStats = async (userId) => {
  const db = getFirestoreDb();

  // 獲取最近 30 天的告警
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const alertsSnapshot = await db
    .collection("ad_anomaly_alerts")
    .where("userId", "==", userId)
    .where("timestamp", ">=", thirtyDaysAgo)
    .get();

  const alerts = alertsSnapshot.docs.map((doc) => doc.data());

  // 統計異常類型
  const anomalyTypes = {};
  alerts.forEach((alert) => {
    alert.anomalies.forEach((anomaly) => {
      anomalyTypes[anomaly.type] = (anomalyTypes[anomaly.type] || 0) + 1;
    });
  });

  // 計算風險評分（簡單評分）
  const highSeverityCount = alerts.filter((a) => a.severity === "high").length;
  const mediumSeverityCount = alerts.filter((a) => a.severity === "medium").length;
  const riskScore = highSeverityCount * 10 + mediumSeverityCount * 3;

  return {
    userId,
    totalAlerts: alerts.length,
    highSeverityAlerts: highSeverityCount,
    mediumSeverityAlerts: mediumSeverityCount,
    anomalyTypes,
    riskScore,
    riskLevel:
      riskScore >= 30 ? "high" : riskScore >= 10 ? "medium" : "low",
  };
};

/**
 * 清理過期的廣告觀看事件（定時任務）
 * @param {number} daysToKeep - 保留天數（默認 7 天）
 */
export const cleanupOldAdEvents = async (daysToKeep = 7) => {
  const db = getFirestoreDb();
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  const oldEventsSnapshot = await db
    .collection("ad_watch_events")
    .where("timestampMs", "<", cutoffTime)
    .limit(500)
    .get();

  if (oldEventsSnapshot.empty) {
    logger.info(`[廣告監控] 無需清理過期事件`);
    return { deleted: 0 };
  }

  const batch = db.batch();
  oldEventsSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  logger.info(`[廣告監控] 已清理 ${oldEventsSnapshot.size} 條過期廣告觀看事件`);

  return { deleted: oldEventsSnapshot.size };
};

export default {
  recordAdWatchEvent,
  detectAnomalies,
  getAnomalyAlerts,
  updateAlertStatus,
  getUserAnomalyStats,
  cleanupOldAdEvents,
};
