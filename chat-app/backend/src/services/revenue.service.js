/**
 * 營收統計服務
 *
 * P1 優化：提供營收相關的數據分析 API
 * - 總營收統計
 * - 會員訂閱分析
 * - 金幣消費分析
 * - 轉化漏斗
 * - 用戶 LTV 估算
 *
 * @module revenue.service
 */

import { getFirestoreDb } from "../firebase/index.js";
import logger from "../utils/logger.js";

// ====================================
// 1. 營收概覽
// ====================================

/**
 * 獲取營收概覽統計
 *
 * @param {Object} options - 選項
 * @param {string} options.startDate - 開始日期 (ISO 8601)
 * @param {string} options.endDate - 結束日期 (ISO 8601)
 * @returns {Promise<Object>} 營收概覽
 */
export const getRevenueOverview = async (options = {}) => {
  const db = getFirestoreDb();

  try {
    const start = options.startDate
      ? new Date(options.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 默認最近 30 天
    const end = options.endDate ? new Date(options.endDate) : new Date();

    // 並行查詢多個數據源
    const [
      membershipStats,
      coinPurchaseStats,
      giftStats,
      assetPurchaseStats,
    ] = await Promise.all([
      getMembershipRevenueStats(start, end),
      getCoinPurchaseStats(start, end),
      getGiftConsumptionStats(start, end),
      getAssetPurchaseStats(start, end),
    ]);

    // 計算總營收（假設 1 TWD = 1 收入單位）
    const totalRevenue = {
      membership: membershipStats.totalRevenue,
      coinPurchase: coinPurchaseStats.totalRevenue,
      total: membershipStats.totalRevenue + coinPurchaseStats.totalRevenue,
    };

    // 計算環比（與上一個週期比較）
    const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(start.getTime() - 1);

    const [prevMembershipStats, prevCoinStats] = await Promise.all([
      getMembershipRevenueStats(previousStart, previousEnd),
      getCoinPurchaseStats(previousStart, previousEnd),
    ]);

    const previousTotalRevenue = prevMembershipStats.totalRevenue + prevCoinStats.totalRevenue;
    const revenueGrowth = previousTotalRevenue > 0
      ? ((totalRevenue.total - previousTotalRevenue) / previousTotalRevenue * 100).toFixed(2)
      : null;

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        days: periodDays,
      },
      totalRevenue,
      revenueGrowth: revenueGrowth !== null ? `${revenueGrowth}%` : 'N/A',
      breakdown: {
        membership: membershipStats,
        coinPurchase: coinPurchaseStats,
        giftConsumption: giftStats,
        assetPurchase: assetPurchaseStats,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[營收統計] 獲取營收概覽失敗:', error);
    throw error;
  }
};

/**
 * 獲取會員訂閱營收統計
 */
const getMembershipRevenueStats = async (start, end) => {
  const db = getFirestoreDb();

  try {
    // 查詢會員訂閱交易
    const snapshot = await db
      .collection('transactions')
      .where('type', 'in', ['membership_upgrade', 'membership_renew', 'membership_purchase'])
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get();

    const stats = {
      totalRevenue: 0,
      count: snapshot.size,
      byTier: { lite: 0, vip: 0, vvip: 0 },
      byCycle: { monthly: 0, quarterly: 0, yearly: 0 },
    };

    snapshot.forEach(doc => {
      const tx = doc.data();
      const amount = tx.amount || tx.metadata?.price || 0;
      const tier = tx.metadata?.tier || 'unknown';
      const cycle = tx.metadata?.billingCycle || 'monthly';

      stats.totalRevenue += amount;

      if (stats.byTier[tier] !== undefined) {
        stats.byTier[tier] += amount;
      }

      if (stats.byCycle[cycle] !== undefined) {
        stats.byCycle[cycle] += amount;
      }
    });

    return stats;
  } catch (error) {
    logger.warn(`[營收統計] 會員訂閱統計失敗: ${error.message}`);
    return { totalRevenue: 0, count: 0, byTier: {}, byCycle: {} };
  }
};

/**
 * 獲取金幣購買統計
 */
const getCoinPurchaseStats = async (start, end) => {
  const db = getFirestoreDb();

  try {
    const snapshot = await db
      .collection('transactions')
      .where('type', '==', 'coin_purchase')
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get();

    const stats = {
      totalRevenue: 0,
      count: snapshot.size,
      totalCoins: 0,
      byPackage: {},
    };

    snapshot.forEach(doc => {
      const tx = doc.data();
      const amount = tx.amount || tx.metadata?.price || 0;
      const coins = tx.metadata?.coins || 0;
      const packageId = tx.metadata?.packageId || 'unknown';

      stats.totalRevenue += amount;
      stats.totalCoins += coins;
      stats.byPackage[packageId] = (stats.byPackage[packageId] || 0) + 1;
    });

    return stats;
  } catch (error) {
    logger.warn(`[營收統計] 金幣購買統計失敗: ${error.message}`);
    return { totalRevenue: 0, count: 0, totalCoins: 0, byPackage: {} };
  }
};

/**
 * 獲取禮物消費統計
 */
const getGiftConsumptionStats = async (start, end) => {
  const db = getFirestoreDb();

  try {
    const snapshot = await db
      .collection('transactions')
      .where('type', '==', 'gift')
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get();

    const stats = {
      totalCoinsSpent: 0,
      count: snapshot.size,
      byRarity: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
      topGifts: {},
    };

    snapshot.forEach(doc => {
      const tx = doc.data();
      const coins = Math.abs(tx.amount || 0);
      const rarity = tx.metadata?.rarity || 'common';
      const giftId = tx.metadata?.giftId || 'unknown';

      stats.totalCoinsSpent += coins;

      if (stats.byRarity[rarity] !== undefined) {
        stats.byRarity[rarity] += coins;
      }

      stats.topGifts[giftId] = (stats.topGifts[giftId] || 0) + 1;
    });

    // 排序 topGifts
    stats.topGifts = Object.entries(stats.topGifts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});

    return stats;
  } catch (error) {
    logger.warn(`[營收統計] 禮物消費統計失敗: ${error.message}`);
    return { totalCoinsSpent: 0, count: 0, byRarity: {}, topGifts: {} };
  }
};

/**
 * 獲取資產購買統計
 */
const getAssetPurchaseStats = async (start, end) => {
  const db = getFirestoreDb();

  try {
    const snapshot = await db
      .collection('transactions')
      .where('type', 'in', ['asset_purchase', 'unlock', 'photo_generation', 'video_generation'])
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get();

    const stats = {
      totalCoinsSpent: 0,
      count: snapshot.size,
      byType: {},
    };

    snapshot.forEach(doc => {
      const tx = doc.data();
      const coins = Math.abs(tx.amount || 0);
      const type = tx.type || 'unknown';

      stats.totalCoinsSpent += coins;
      stats.byType[type] = (stats.byType[type] || 0) + coins;
    });

    return stats;
  } catch (error) {
    logger.warn(`[營收統計] 資產購買統計失敗: ${error.message}`);
    return { totalCoinsSpent: 0, count: 0, byType: {} };
  }
};

// ====================================
// 2. 會員分析
// ====================================

/**
 * 獲取會員統計分析
 *
 * @returns {Promise<Object>} 會員分析數據
 */
export const getMembershipAnalytics = async () => {
  const db = getFirestoreDb();

  try {
    // 查詢所有用戶
    const usersSnapshot = await db.collection('users').get();

    const stats = {
      total: usersSnapshot.size,
      byTier: { free: 0, lite: 0, vip: 0, vvip: 0 },
      byStatus: { active: 0, cancelled: 0, expired: 0 },
      conversionFunnel: {
        registered: usersSnapshot.size,
        firstPurchase: 0,
        subscribed: 0,
        upgraded: 0,
      },
      retention: {
        day1: 0,
        day7: 0,
        day30: 0,
      },
    };

    const now = new Date();

    usersSnapshot.forEach(doc => {
      const user = doc.data();
      const tier = user.membershipTier || 'free';
      const status = user.membershipStatus || 'active';

      // 統計等級分布
      if (stats.byTier[tier] !== undefined) {
        stats.byTier[tier]++;
      }

      // 統計狀態分布
      if (stats.byStatus[status] !== undefined) {
        stats.byStatus[status]++;
      }

      // 轉化漏斗
      if (user.firstPurchaseAt) {
        stats.conversionFunnel.firstPurchase++;
      }

      if (tier !== 'free') {
        stats.conversionFunnel.subscribed++;
      }

      if (user.membershipUpgradeHistory?.length > 1) {
        stats.conversionFunnel.upgraded++;
      }

      // 留存計算
      const createdAt = user.createdAt ? new Date(user.createdAt) : null;
      const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt) : null;

      if (createdAt && lastActiveAt) {
        const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        const daysSinceActive = Math.floor((now - lastActiveAt) / (1000 * 60 * 60 * 24));

        if (daysSinceCreation >= 1 && daysSinceActive <= 1) {
          stats.retention.day1++;
        }
        if (daysSinceCreation >= 7 && daysSinceActive <= 7) {
          stats.retention.day7++;
        }
        if (daysSinceCreation >= 30 && daysSinceActive <= 30) {
          stats.retention.day30++;
        }
      }
    });

    // 計算轉化率
    stats.conversionRates = {
      freeToLite: stats.byTier.free > 0
        ? ((stats.byTier.lite / stats.byTier.free) * 100).toFixed(2) + '%'
        : 'N/A',
      liteToVip: stats.byTier.lite > 0
        ? ((stats.byTier.vip / stats.byTier.lite) * 100).toFixed(2) + '%'
        : 'N/A',
      vipToVvip: stats.byTier.vip > 0
        ? ((stats.byTier.vvip / stats.byTier.vip) * 100).toFixed(2) + '%'
        : 'N/A',
      overallPaid: stats.total > 0
        ? (((stats.byTier.lite + stats.byTier.vip + stats.byTier.vvip) / stats.total) * 100).toFixed(2) + '%'
        : 'N/A',
    };

    return {
      ...stats,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[營收統計] 會員分析失敗:', error);
    throw error;
  }
};

// ====================================
// 3. ARPU 和 LTV 估算
// ====================================

/**
 * 計算 ARPU (Average Revenue Per User)
 *
 * @param {Object} options - 選項
 * @returns {Promise<Object>} ARPU 數據
 */
export const getARPUMetrics = async (options = {}) => {
  const db = getFirestoreDb();

  try {
    const days = options.days || 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const end = new Date();

    // 獲取期間內有活動的用戶數
    const activeUsersSnapshot = await db
      .collection('users')
      .where('lastActiveAt', '>=', start)
      .get();

    const activeUsers = activeUsersSnapshot.size;

    // 獲取期間內的總營收
    const revenueSnapshot = await db
      .collection('transactions')
      .where('type', 'in', ['membership_upgrade', 'membership_renew', 'coin_purchase'])
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get();

    let totalRevenue = 0;
    const payingUsers = new Set();

    revenueSnapshot.forEach(doc => {
      const tx = doc.data();
      totalRevenue += tx.amount || tx.metadata?.price || 0;
      if (tx.userId) {
        payingUsers.add(tx.userId);
      }
    });

    const arpu = activeUsers > 0 ? (totalRevenue / activeUsers).toFixed(2) : 0;
    const arppu = payingUsers.size > 0 ? (totalRevenue / payingUsers.size).toFixed(2) : 0;

    return {
      period: {
        days,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      activeUsers,
      payingUsers: payingUsers.size,
      payingRate: activeUsers > 0
        ? ((payingUsers.size / activeUsers) * 100).toFixed(2) + '%'
        : 'N/A',
      totalRevenue,
      arpu: parseFloat(arpu),
      arppu: parseFloat(arppu),
      currency: 'TWD',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[營收統計] ARPU 計算失敗:', error);
    throw error;
  }
};

/**
 * 估算用戶 LTV (Lifetime Value)
 *
 * @returns {Promise<Object>} LTV 估算數據
 */
export const getLTVEstimate = async () => {
  const db = getFirestoreDb();

  try {
    // 獲取歷史數據
    const usersSnapshot = await db.collection('users').get();

    let totalLifetimeValue = 0;
    let userCount = 0;
    let avgLifespanDays = 0;

    const tierLTV = { free: 0, lite: 0, vip: 0, vvip: 0 };
    const tierCount = { free: 0, lite: 0, vip: 0, vvip: 0 };

    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      const userId = doc.id;

      // 計算用戶生命週期
      const createdAt = user.createdAt ? new Date(user.createdAt) : null;
      const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt) : new Date();

      if (createdAt) {
        const lifespanDays = Math.ceil((lastActiveAt - createdAt) / (1000 * 60 * 60 * 24));
        avgLifespanDays += lifespanDays;
        userCount++;
      }

      // 查詢用戶的總消費
      const txSnapshot = await db
        .collection('transactions')
        .where('userId', '==', userId)
        .where('type', 'in', ['membership_upgrade', 'membership_renew', 'coin_purchase'])
        .get();

      let userLTV = 0;
      txSnapshot.forEach(txDoc => {
        const tx = txDoc.data();
        userLTV += tx.amount || tx.metadata?.price || 0;
      });

      totalLifetimeValue += userLTV;

      // 按等級統計
      const tier = user.membershipTier || 'free';
      if (tierLTV[tier] !== undefined) {
        tierLTV[tier] += userLTV;
        tierCount[tier]++;
      }
    }

    // 計算平均 LTV
    const avgLTV = userCount > 0 ? (totalLifetimeValue / userCount).toFixed(2) : 0;
    avgLifespanDays = userCount > 0 ? Math.round(avgLifespanDays / userCount) : 0;

    // 計算各等級平均 LTV
    const avgLTVByTier = {};
    for (const tier of Object.keys(tierLTV)) {
      avgLTVByTier[tier] = tierCount[tier] > 0
        ? (tierLTV[tier] / tierCount[tier]).toFixed(2)
        : 0;
    }

    return {
      totalUsers: userCount,
      avgLTV: parseFloat(avgLTV),
      avgLifespanDays,
      avgLTVByTier: Object.fromEntries(
        Object.entries(avgLTVByTier).map(([k, v]) => [k, parseFloat(v)])
      ),
      tierDistribution: tierCount,
      currency: 'TWD',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[營收統計] LTV 估算失敗:', error);
    throw error;
  }
};

// ====================================
// 4. 每日營收趨勢
// ====================================

/**
 * 獲取每日營收趨勢
 *
 * @param {Object} options - 選項
 * @returns {Promise<Object>} 每日營收數據
 */
export const getDailyRevenueTrend = async (options = {}) => {
  const db = getFirestoreDb();

  try {
    const days = options.days || 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const end = new Date();

    const snapshot = await db
      .collection('transactions')
      .where('type', 'in', ['membership_upgrade', 'membership_renew', 'coin_purchase'])
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get();

    // 按日期分組
    const dailyData = {};

    snapshot.forEach(doc => {
      const tx = doc.data();
      const date = tx.createdAt?.toDate?.()?.toISOString()?.split('T')[0]
        || new Date(tx.createdAt).toISOString().split('T')[0];
      const amount = tx.amount || tx.metadata?.price || 0;

      if (!dailyData[date]) {
        dailyData[date] = {
          revenue: 0,
          transactions: 0,
          membership: 0,
          coinPurchase: 0,
        };
      }

      dailyData[date].revenue += amount;
      dailyData[date].transactions++;

      if (tx.type.includes('membership')) {
        dailyData[date].membership += amount;
      } else if (tx.type === 'coin_purchase') {
        dailyData[date].coinPurchase += amount;
      }
    });

    // 填充缺失的日期
    const trend = [];
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      trend.push({
        date: dateStr,
        ...dailyData[dateStr] || {
          revenue: 0,
          transactions: 0,
          membership: 0,
          coinPurchase: 0,
        },
      });
      current.setDate(current.getDate() + 1);
    }

    return {
      period: { days, start: start.toISOString(), end: end.toISOString() },
      trend,
      summary: {
        totalRevenue: trend.reduce((sum, d) => sum + d.revenue, 0),
        avgDailyRevenue: (trend.reduce((sum, d) => sum + d.revenue, 0) / trend.length).toFixed(2),
        peakDay: trend.reduce((max, d) => d.revenue > max.revenue ? d : max, { revenue: 0 }),
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[營收統計] 獲取每日趨勢失敗:', error);
    throw error;
  }
};

// ====================================
// 5. 統一營收儀表板
// ====================================

/**
 * 獲取完整的營收儀表板數據
 *
 * @param {Object} options - 選項
 * @returns {Promise<Object>} 營收儀表板
 */
export const getRevenueDashboard = async (options = {}) => {
  try {
    const days = options.days || 30;

    const [overview, membershipAnalytics, arpu, dailyTrend] = await Promise.all([
      getRevenueOverview({ days }),
      getMembershipAnalytics(),
      getARPUMetrics({ days }),
      getDailyRevenueTrend({ days }),
    ]);

    return {
      overview,
      membershipAnalytics,
      arpu,
      dailyTrend,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[營收統計] 獲取營收儀表板失敗:', error);
    throw error;
  }
};

export default {
  getRevenueOverview,
  getMembershipAnalytics,
  getARPUMetrics,
  getLTVEstimate,
  getDailyRevenueTrend,
  getRevenueDashboard,
};
