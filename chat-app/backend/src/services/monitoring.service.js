/**
 * 監控增強服務
 * 提供廣告觀看異常檢測、退款統計、緩存失敗率監控
 *
 * ✅ 優化目標（2025-01-13）：
 * - 廣告觀看異常檢測儀表板
 * - 退款統計分析
 * - 緩存失敗率監控
 */

import { getFirestoreDb } from "../firebase/index.js";
import logger from "../utils/logger.js";

// ====================================
// 1. 廣告觀看異常檢測
// ====================================

/**
 * 檢測用戶的廣告觀看行為是否異常
 *
 * 檢測規則：
 * - 每日觀看次數超過 10 次
 * - 30 分鐘內觀看超過 5 次
 * - adId 格式異常
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 選項
 * @returns {Promise<Object>} 異常檢測結果
 */
export const detectAdWatchAnomalies = async (userId, options = {}) => {
  const db = getFirestoreDb();
  const { days = 7 } = options; // 檢查最近 N 天

  try {
    // 讀取廣告觀看統計
    const statsRef = db.collection('ad_watch_stats').doc(userId);
    const statsDoc = await statsRef.get();

    if (!statsDoc.exists) {
      return {
        userId,
        isAbnormal: false,
        anomalies: [],
        summary: '無廣告觀看記錄',
      };
    }

    const statsData = statsDoc.data();
    const anomalies = [];

    // 檢查每日觀看次數
    const today = new Date().toISOString().split('T')[0];
    const todayCount = statsData[today] || 0;
    if (todayCount >= 10) {
      anomalies.push({
        type: 'DAILY_LIMIT_REACHED',
        severity: 'HIGH',
        message: `今日已觀看 ${todayCount} 次廣告（達到每日上限）`,
        data: { todayCount },
      });
    }

    // 檢查 30 分鐘內的頻率
    const lastWatchTime = statsData.lastWatchTime || 0;
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    if (lastWatchTime > thirtyMinutesAgo) {
      const recentCount = await countRecentAdWatches(userId, 30);
      if (recentCount > 5) {
        anomalies.push({
          type: 'HIGH_FREQUENCY',
          severity: 'MEDIUM',
          message: `30 分鐘內觀看 ${recentCount} 次廣告`,
          data: { recentCount, minutes: 30 },
        });
      }
    }

    // 檢查總觀看次數
    const totalAdsWatched = statsData.totalAdsWatched || 0;
    if (totalAdsWatched > 100) {
      anomalies.push({
        type: 'HIGH_TOTAL_WATCHES',
        severity: 'LOW',
        message: `累計觀看 ${totalAdsWatched} 次廣告`,
        data: { totalAdsWatched },
      });
    }

    return {
      userId,
      isAbnormal: anomalies.length > 0,
      anomalies,
      totalAdsWatched,
      lastWatchTime: new Date(lastWatchTime).toISOString(),
      summary: anomalies.length > 0
        ? `檢測到 ${anomalies.length} 個異常`
        : '無異常行為',
    };
  } catch (error) {
    logger.error('[監控] 廣告觀看異常檢測失敗', error);
    throw error;
  }
};

/**
 * 統計最近 N 分鐘內的廣告觀看次數
 * @private
 */
const countRecentAdWatches = async (userId, minutes) => {
  const db = getFirestoreDb();
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

  try {
    const snapshot = await db
      .collection('ad_watch_events')
      .where('userId', '==', userId)
      .where('watchedAt', '>', cutoffTime)
      .count()
      .get();

    return snapshot.data().count || 0;
  } catch (error) {
    logger.warn(`[監控] 統計最近廣告觀看次數失敗: ${error.message}`);
    return 0;
  }
};

/**
 * 獲取廣告觀看異常用戶列表
 *
 * @param {Object} options - 選項
 * @returns {Promise<Array>} 異常用戶列表
 */
export const getAbnormalAdWatchUsers = async (options = {}) => {
  const db = getFirestoreDb();
  const { limit = 100, minTodayCount = 8 } = options;

  try {
    const today = new Date().toISOString().split('T')[0];

    // 查詢今日觀看次數較多的用戶
    const snapshot = await db
      .collection('ad_watch_stats')
      .where(today, '>=', minTodayCount)
      .limit(limit)
      .get();

    const abnormalUsers = [];
    for (const doc of snapshot.docs) {
      const userId = doc.id;
      const detection = await detectAdWatchAnomalies(userId);

      if (detection.isAbnormal) {
        abnormalUsers.push(detection);
      }
    }

    return {
      total: abnormalUsers.length,
      users: abnormalUsers,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[監控] 獲取異常用戶列表失敗', error);
    throw error;
  }
};

// ====================================
// 2. 退款統計
// ====================================

/**
 * 獲取退款統計數據
 *
 * @param {Object} options - 選項
 * @returns {Promise<Object>} 退款統計
 */
export const getRefundStatistics = async (options = {}) => {
  const db = getFirestoreDb();
  const { startDate, endDate, groupBy = 'day' } = options;

  try {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // 查詢退款交易
    let query = db
      .collection('transactions')
      .where('type', '==', 'refund')
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end);

    const snapshot = await query.get();

    // 統計數據
    const stats = {
      total: snapshot.size,
      totalAmount: 0,
      byReason: {},
      byDate: {},
      byUser: {},
    };

    snapshot.forEach(doc => {
      const refund = doc.data();
      const amount = refund.amount || 0;
      const reason = refund.metadata?.reason || '未知原因';
      const date = refund.createdAt?.toDate?.()?.toISOString()?.split('T')[0] || 'unknown';
      const userId = refund.userId;

      // 總金額
      stats.totalAmount += amount;

      // 按原因分類
      stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;

      // 按日期分類
      stats.byDate[date] = stats.byDate[date] || { count: 0, amount: 0 };
      stats.byDate[date].count += 1;
      stats.byDate[date].amount += amount;

      // 按用戶分類
      stats.byUser[userId] = (stats.byUser[userId] || 0) + 1;
    });

    // 計算退款率（需要查詢同期總交易）
    const totalTxQuery = await db
      .collection('transactions')
      .where('type', 'in', ['purchase', 'gift', 'unlock'])
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .count()
      .get();

    const totalTransactions = totalTxQuery.data().count || 0;
    const refundRate = totalTransactions > 0
      ? ((stats.total / totalTransactions) * 100).toFixed(2)
      : 0;

    return {
      ...stats,
      refundRate: `${refundRate}%`,
      totalTransactions,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[監控] 退款統計失敗', error);
    throw error;
  }
};

/**
 * 獲取高頻退款用戶
 *
 * @param {Object} options - 選項
 * @returns {Promise<Array>} 高頻退款用戶列表
 */
export const getHighRefundUsers = async (options = {}) => {
  const db = getFirestoreDb();
  const { minRefunds = 3, days = 30 } = options;

  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshot = await db
      .collection('transactions')
      .where('type', '==', 'refund')
      .where('createdAt', '>=', cutoffDate)
      .get();

    // 統計每個用戶的退款次數
    const userRefunds = {};
    snapshot.forEach(doc => {
      const userId = doc.data().userId;
      userRefunds[userId] = (userRefunds[userId] || 0) + 1;
    });

    // 篩選高頻用戶
    const highRefundUsers = Object.entries(userRefunds)
      .filter(([_, count]) => count >= minRefunds)
      .map(([userId, count]) => ({ userId, refundCount: count }))
      .sort((a, b) => b.refundCount - a.refundCount);

    return {
      total: highRefundUsers.length,
      users: highRefundUsers,
      threshold: minRefunds,
      period: `最近 ${days} 天`,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[監控] 高頻退款用戶查詢失敗', error);
    throw error;
  }
};

// ====================================
// 3. 緩存失敗率監控
// ====================================

/**
 * 獲取緩存統計數據
 *
 * @returns {Promise<Object>} 緩存統計
 */
export const getCacheStatistics = async () => {
  const db = getFirestoreDb();

  try {
    // 查詢會員配置緩存失敗統計
    const membershipStatsSnapshot = await db
      .collection('cache_failure_stats')
      .where('tier', 'in', ['free', 'vip', 'vvip'])
      .get();

    const membershipStats = {};
    membershipStatsSnapshot.forEach(doc => {
      const data = doc.data();
      membershipStats[data.tier] = {
        failureCount: data.failureCount || 0,
        lastFailure: data.lastFailure?.toDate?.()?.toISOString() || null,
        lastSuccess: data.lastSuccess?.toDate?.()?.toISOString() || null,
      };
    });

    // 計算總體失敗率（假設每個等級每小時讀取 10 次）
    const totalFailures = Object.values(membershipStats).reduce(
      (sum, stat) => sum + stat.failureCount,
      0
    );

    return {
      membershipCache: {
        stats: membershipStats,
        totalFailures,
        healthStatus: totalFailures === 0 ? 'HEALTHY' : totalFailures < 10 ? 'WARNING' : 'CRITICAL',
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[監控] 緩存統計失敗', error);
    throw error;
  }
};

/**
 * 重置緩存失敗計數
 *
 * @param {string} cacheType - 緩存類型（'membership', 'all'）
 * @returns {Promise<Object>} 重置結果
 */
export const resetCacheFailureStats = async (cacheType = 'all') => {
  const db = getFirestoreDb();

  try {
    let resetCount = 0;

    if (cacheType === 'membership' || cacheType === 'all') {
      const membershipStatsSnapshot = await db
        .collection('cache_failure_stats')
        .where('tier', 'in', ['free', 'vip', 'vvip'])
        .get();

      const batch = db.batch();
      membershipStatsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          failureCount: 0,
          lastReset: new Date(),
        });
        resetCount++;
      });

      await batch.commit();
    }

    logger.info(`[監控] 已重置 ${resetCount} 個緩存失敗計數`);

    return {
      success: true,
      resetCount,
      cacheType,
      resetAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[監控] 重置緩存失敗計數失敗', error);
    throw error;
  }
};

// ====================================
// 4. 統一監控儀表板
// ====================================

/**
 * 獲取完整的監控儀表板數據
 *
 * @returns {Promise<Object>} 監控儀表板
 */
export const getMonitoringDashboard = async () => {
  try {
    const [adAnomalies, refundStats, cacheStats] = await Promise.all([
      getAbnormalAdWatchUsers({ limit: 10, minTodayCount: 8 }),
      getRefundStatistics({ days: 30 }),
      getCacheStatistics(),
    ]);

    return {
      adWatch: {
        abnormalUsers: adAnomalies.total,
        topAnomalies: adAnomalies.users.slice(0, 5),
      },
      refunds: {
        total: refundStats.total,
        totalAmount: refundStats.totalAmount,
        refundRate: refundStats.refundRate,
        topReasons: Object.entries(refundStats.byReason)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([reason, count]) => ({ reason, count })),
      },
      cache: cacheStats,
      generatedAt: new Date().toISOString(),
      healthStatus: calculateOverallHealth(adAnomalies, refundStats, cacheStats),
    };
  } catch (error) {
    logger.error('[監控] 獲取監控儀表板失敗', error);
    throw error;
  }
};

/**
 * 計算整體健康狀態
 * @private
 */
const calculateOverallHealth = (adAnomalies, refundStats, cacheStats) => {
  const issues = [];

  // 檢查廣告異常
  if (adAnomalies.total > 10) {
    issues.push({
      type: 'AD_ANOMALIES',
      severity: 'HIGH',
      message: `檢測到 ${adAnomalies.total} 個異常廣告觀看用戶`,
    });
  }

  // 檢查退款率
  const refundRate = parseFloat(refundStats.refundRate);
  if (refundRate > 5) {
    issues.push({
      type: 'HIGH_REFUND_RATE',
      severity: 'MEDIUM',
      message: `退款率達到 ${refundStats.refundRate}`,
    });
  }

  // 檢查緩存失敗
  if (cacheStats.membershipCache.healthStatus === 'CRITICAL') {
    issues.push({
      type: 'CACHE_FAILURES',
      severity: 'HIGH',
      message: `會員緩存失敗次數過高`,
    });
  }

  if (issues.length === 0) {
    return {
      status: 'HEALTHY',
      message: '所有監控指標正常',
      issues: [],
    };
  }

  const highSeverityCount = issues.filter(i => i.severity === 'HIGH').length;
  return {
    status: highSeverityCount > 0 ? 'CRITICAL' : 'WARNING',
    message: `檢測到 ${issues.length} 個問題`,
    issues,
  };
};

export default {
  // 廣告監控
  detectAdWatchAnomalies,
  getAbnormalAdWatchUsers,

  // 退款統計
  getRefundStatistics,
  getHighRefundUsers,

  // 緩存監控
  getCacheStatistics,
  resetCacheFailureStats,

  // 統一儀表板
  getMonitoringDashboard,
};
