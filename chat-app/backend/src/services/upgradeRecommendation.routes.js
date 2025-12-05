/**
 * 智能升級推薦 API 路由
 *
 * 提供個性化升級推薦、行為分析、追蹤等功能
 *
 * @module upgradeRecommendation.routes
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { relaxedRateLimiter, standardRateLimiter } from "../middleware/rateLimiterConfig.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import {
  analyzeUserBehavior,
  generateUpgradeRecommendation,
  trackRecommendationShown,
  trackRecommendationClick,
  trackRecommendationConversion,
} from "./upgradeRecommendation.service.js";

const router = express.Router();

/**
 * 獲取智能升級推薦
 * GET /api/upgrade/recommendation
 * 🔒 需要身份驗證
 *
 * 返回：
 * - hasRecommendation: 是否有推薦
 * - recommendation: 主要推薦方案
 * - alternative: 備選方案
 * - behavior: 用戶行為分析
 * - promotions: 適用的促銷活動
 */
router.get(
  "/recommendation",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const recommendation = await generateUpgradeRecommendation(userId);

      // 記錄推薦展示
      if (recommendation.hasRecommendation) {
        await trackRecommendationShown(userId, recommendation).catch(err => {
          logger.warn(`[升級推薦] 記錄展示失敗: ${err.message}`);
        });
      }

      sendSuccess(res, recommendation);
    } catch (error) {
      logger.error(`[升級推薦] 生成推薦失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取升級推薦失敗");
    }
  }
);

/**
 * 獲取用戶行為分析
 * GET /api/upgrade/behavior
 * 🔒 需要身份驗證
 *
 * 返回詳細的用戶使用行為分析
 */
router.get(
  "/behavior",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const behavior = await analyzeUserBehavior(userId);
      sendSuccess(res, behavior);
    } catch (error) {
      logger.error(`[升級推薦] 行為分析失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取行為分析失敗");
    }
  }
);

/**
 * 記錄推薦點擊
 * POST /api/upgrade/track/click
 * 🔒 需要身份驗證
 *
 * Body: { tier: string }
 */
router.post(
  "/track/click",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { tier } = req.body;

      if (!tier) {
        return sendError(res, "VALIDATION_ERROR", "請提供方案類型");
      }

      await trackRecommendationClick(userId, tier);
      sendSuccess(res, { message: "已記錄" });
    } catch (error) {
      logger.error(`[升級推薦] 記錄點擊失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "記錄失敗");
    }
  }
);

/**
 * 記錄推薦轉化
 * POST /api/upgrade/track/conversion
 * 🔒 需要身份驗證
 * ⚠️ 通常由購買流程自動調用
 *
 * Body: { tier: string }
 */
router.post(
  "/track/conversion",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { tier } = req.body;

      if (!tier) {
        return sendError(res, "VALIDATION_ERROR", "請提供方案類型");
      }

      await trackRecommendationConversion(userId, tier);
      sendSuccess(res, { message: "已記錄" });
    } catch (error) {
      logger.error(`[升級推薦] 記錄轉化失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "記錄失敗");
    }
  }
);

export default router;
