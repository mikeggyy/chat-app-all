/**
 * 登入獎勵 API 路由
 * 處理每日登入獎勵領取、狀態查詢、里程碑查看
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import {
  getLoginRewardStatus,
  claimDailyReward,
  getRewardHistory,
  getMilestones,
} from "./loginReward.service.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { relaxedRateLimiter, standardRateLimiter } from "../middleware/rateLimiterConfig.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js";

const router = express.Router();

/**
 * 獲取登入獎勵狀態
 * GET /api/rewards/login/status
 * 🔒 需要身份驗證
 * ✅ 速率限制：60次/分鐘
 *
 * 返回：
 * - 當前連續登入天數
 * - 今日是否可領取
 * - 今日獎勵預覽
 * - 下一個里程碑
 * - 本週獎勵預覽
 */
router.get(
  "/api/rewards/login/status",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const result = await getLoginRewardStatus(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[登入獎勵] 獲取狀態失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取登入獎勵狀態失敗");
    }
  }
);

/**
 * 領取每日登入獎勵
 * POST /api/rewards/login/claim
 * 🔒 需要身份驗證
 * 🔒 冪等性保護
 * ✅ 速率限制：30次/分鐘
 *
 * Body: { idempotencyKey }
 *
 * 返回：
 * - 領取的獎勵詳情
 * - 是否達成里程碑
 * - 新的金幣餘額
 */
router.post(
  "/api/rewards/login/claim",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { idempotencyKey } = req.body;

      if (!idempotencyKey) {
        return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey", {
          field: "idempotencyKey",
        });
      }

      // 使用冪等性保護
      const requestId = `login_reward:${userId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await claimDailyReward(userId),
        { ttl: IDEMPOTENCY_TTL.DEFAULT || 900000 }
      );

      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[登入獎勵] 領取失敗: ${error.message}`);

      // 特殊錯誤處理
      if (error.message === "今日獎勵已領取") {
        return sendError(res, "ALREADY_CLAIMED", error.message);
      }

      sendError(res, "BAD_REQUEST", error.message);
    }
  }
);

/**
 * 獲取獎勵歷史記錄
 * GET /api/rewards/login/history
 * 🔒 需要身份驗證
 * ✅ 速率限制：60次/分鐘
 *
 * Query: { limit: number }
 */
router.get(
  "/api/rewards/login/history",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const limit = Math.min(parseInt(req.query.limit) || 30, 100);
      const result = await getRewardHistory(userId, limit);
      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[登入獎勵] 獲取歷史失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取獎勵歷史失敗");
    }
  }
);

/**
 * 獲取里程碑列表及進度
 * GET /api/rewards/login/milestones
 * 🔒 需要身份驗證
 * ✅ 速率限制：60次/分鐘
 */
router.get(
  "/api/rewards/login/milestones",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const result = await getMilestones(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[登入獎勵] 獲取里程碑失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取里程碑失敗");
    }
  }
);

export default router;
