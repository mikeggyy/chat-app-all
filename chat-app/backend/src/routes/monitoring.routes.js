/**
 * 監控 API 路由
 *
 * ✅ 優化目標（2025-01-13）：
 * - 提供監控數據查詢 API
 * - 支援廣告異常檢測、退款統計、緩存監控
 */

import express from "express";
import {
  detectAdWatchAnomalies,
  getAbnormalAdWatchUsers,
  getRefundStatistics,
  getHighRefundUsers,
  getCacheStatistics,
  resetCacheFailureStats,
  getMonitoringDashboard,
} from "../services/monitoring.service.js";
import logger from "../utils/logger.js";

const router = express.Router();

// ============================================
// 監控儀表板
// ============================================

/**
 * GET /api/monitoring/dashboard
 * 獲取完整的監控儀表板數據
 *
 * 包含：
 * - 廣告觀看異常統計
 * - 退款統計
 * - 緩存失敗率
 * - 整體健康狀態
 */
router.get("/dashboard", async (req, res) => {
  try {
    const dashboard = await getMonitoringDashboard();

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    logger.error("[監控 API] 獲取監控儀表板失敗", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// 廣告觀看監控
// ============================================

/**
 * GET /api/monitoring/ad-watch/anomalies
 * 獲取廣告觀看異常用戶列表
 *
 * Query Parameters:
 * - limit: 返回數量上限（默認 100）
 * - minTodayCount: 最小今日觀看次數（默認 8）
 */
router.get("/ad-watch/anomalies", async (req, res) => {
  try {
    const { limit, minTodayCount } = req.query;

    const result = await getAbnormalAdWatchUsers({
      limit: limit ? parseInt(limit) : 100,
      minTodayCount: minTodayCount ? parseInt(minTodayCount) : 8,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("[監控 API] 獲取廣告異常用戶失敗", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/ad-watch/user/:userId
 * 檢測特定用戶的廣告觀看異常
 */
router.get("/ad-watch/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { days } = req.query;

    const result = await detectAdWatchAnomalies(userId, {
      days: days ? parseInt(days) : 7,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("[監控 API] 檢測用戶廣告異常失敗", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// 退款監控
// ============================================

/**
 * GET /api/monitoring/refunds/statistics
 * 獲取退款統計數據
 *
 * Query Parameters:
 * - startDate: 開始日期（ISO 8601 格式）
 * - endDate: 結束日期（ISO 8601 格式）
 * - groupBy: 分組方式（'day', 'week', 'month'）
 */
router.get("/refunds/statistics", async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const result = await getRefundStatistics({
      startDate,
      endDate,
      groupBy: groupBy || 'day',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("[監控 API] 獲取退款統計失敗", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/refunds/high-frequency-users
 * 獲取高頻退款用戶列表
 *
 * Query Parameters:
 * - minRefunds: 最小退款次數（默認 3）
 * - days: 統計天數（默認 30）
 */
router.get("/refunds/high-frequency-users", async (req, res) => {
  try {
    const { minRefunds, days } = req.query;

    const result = await getHighRefundUsers({
      minRefunds: minRefunds ? parseInt(minRefunds) : 3,
      days: days ? parseInt(days) : 30,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("[監控 API] 獲取高頻退款用戶失敗", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// 緩存監控
// ============================================

/**
 * GET /api/monitoring/cache/statistics
 * 獲取緩存統計數據
 */
router.get("/cache/statistics", async (req, res) => {
  try {
    const result = await getCacheStatistics();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("[監控 API] 獲取緩存統計失敗", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/monitoring/cache/reset
 * 重置緩存失敗計數
 *
 * Body:
 * - cacheType: 緩存類型（'membership', 'all'）
 */
router.post("/cache/reset", async (req, res) => {
  try {
    const { cacheType } = req.body;

    const result = await resetCacheFailureStats(cacheType || 'all');

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("[監控 API] 重置緩存失敗計數失敗", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
