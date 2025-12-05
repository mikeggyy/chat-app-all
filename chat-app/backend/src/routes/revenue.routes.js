/**
 * 營收統計 API 路由
 *
 * P1 優化：提供營收相關的數據分析 API
 * - 營收概覽
 * - 會員分析
 * - ARPU/LTV 指標
 * - 每日趨勢
 *
 * 🔒 安全說明：這些 API 應該只對管理員開放
 */

import express from "express";
import {
  getRevenueOverview,
  getMembershipAnalytics,
  getARPUMetrics,
  getLTVEstimate,
  getDailyRevenueTrend,
  getRevenueDashboard,
} from "../services/revenue.service.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";

const router = express.Router();

// ============================================
// 營收儀表板
// ============================================

/**
 * GET /api/revenue/dashboard
 * 獲取完整的營收儀表板數據
 *
 * Query Parameters:
 * - days: 統計天數（默認 30）
 */
router.get("/dashboard", async (req, res) => {
  try {
    const { days } = req.query;

    const dashboard = await getRevenueDashboard({
      days: days ? parseInt(days, 10) : 30,
    });

    sendSuccess(res, dashboard);
  } catch (error) {
    logger.error("[營收 API] 獲取營收儀表板失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取營收儀表板失敗");
  }
});

/**
 * GET /api/revenue/overview
 * 獲取營收概覽統計
 *
 * Query Parameters:
 * - startDate: 開始日期（ISO 8601 格式）
 * - endDate: 結束日期（ISO 8601 格式）
 */
router.get("/overview", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const overview = await getRevenueOverview({
      startDate,
      endDate,
    });

    sendSuccess(res, overview);
  } catch (error) {
    logger.error("[營收 API] 獲取營收概覽失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取營收概覽失敗");
  }
});

// ============================================
// 會員分析
// ============================================

/**
 * GET /api/revenue/membership/analytics
 * 獲取會員統計分析
 */
router.get("/membership/analytics", async (req, res) => {
  try {
    const analytics = await getMembershipAnalytics();
    sendSuccess(res, analytics);
  } catch (error) {
    logger.error("[營收 API] 獲取會員分析失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取會員分析失敗");
  }
});

// ============================================
// ARPU 和 LTV 指標
// ============================================

/**
 * GET /api/revenue/metrics/arpu
 * 計算 ARPU (Average Revenue Per User)
 *
 * Query Parameters:
 * - days: 統計天數（默認 30）
 */
router.get("/metrics/arpu", async (req, res) => {
  try {
    const { days } = req.query;

    const arpu = await getARPUMetrics({
      days: days ? parseInt(days, 10) : 30,
    });

    sendSuccess(res, arpu);
  } catch (error) {
    logger.error("[營收 API] 獲取 ARPU 失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取 ARPU 失敗");
  }
});

/**
 * GET /api/revenue/metrics/ltv
 * 估算用戶 LTV (Lifetime Value)
 *
 * ⚠️ 注意：此 API 較為耗時，可能需要幾秒鐘
 */
router.get("/metrics/ltv", async (req, res) => {
  try {
    const ltv = await getLTVEstimate();
    sendSuccess(res, ltv);
  } catch (error) {
    logger.error("[營收 API] 獲取 LTV 失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取 LTV 失敗");
  }
});

// ============================================
// 營收趨勢
// ============================================

/**
 * GET /api/revenue/trend/daily
 * 獲取每日營收趨勢
 *
 * Query Parameters:
 * - days: 統計天數（默認 30）
 */
router.get("/trend/daily", async (req, res) => {
  try {
    const { days } = req.query;

    const trend = await getDailyRevenueTrend({
      days: days ? parseInt(days, 10) : 30,
    });

    sendSuccess(res, trend);
  } catch (error) {
    logger.error("[營收 API] 獲取每日趨勢失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取每日趨勢失敗");
  }
});

export default router;
