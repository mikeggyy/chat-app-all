/**
 * 邀請獎勵 API 路由
 *
 * 提供邀請碼管理、邀請處理、統計查詢等功能
 *
 * @module referral.routes
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
  REFERRAL_CONFIG,
  getOrCreateReferralCode,
  findReferrerByCode,
  processReferralSignup,
  activateReferral,
  processReferralFirstPurchase,
  getUserReferrals,
  getUserReferralStats,
  getReferralLeaderboard,
} from "./referral.service.js";

const router = express.Router();

// ============================================
// 邀請碼管理
// ============================================

/**
 * 獲取或創建用戶的邀請碼
 * GET /api/referral/code
 * 🔒 需要身份驗證
 */
router.get(
  "/code",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const result = await getOrCreateReferralCode(userId);

      sendSuccess(res, {
        code: result.code,
        createdAt: result.createdAt,
        totalReferrals: result.totalReferrals,
        totalRewardsEarned: result.totalRewardsEarned,
        shareUrl: `${process.env.FRONTEND_URL || "https://your-app.com"}/signup?ref=${result.code}`,
        config: {
          referrerRewards: REFERRAL_CONFIG.REFERRER_REWARDS,
          refereeRewards: REFERRAL_CONFIG.REFEREE_REWARDS,
          milestones: Object.entries(REFERRAL_CONFIG.MILESTONE_REWARDS).map(([count, rewards]) => ({
            count: parseInt(count),
            ...rewards,
          })),
        },
      });
    } catch (error) {
      logger.error(`[邀請獎勵] 獲取邀請碼失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取邀請碼失敗");
    }
  }
);

/**
 * 驗證邀請碼
 * GET /api/referral/validate/:code
 * 🔓 不需要身份驗證（供新用戶註冊時驗證）
 */
router.get(
  "/validate/:code",
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const { code } = req.params;

      if (!code || code.length !== REFERRAL_CONFIG.CODE_LENGTH) {
        return sendError(res, "VALIDATION_ERROR", "邀請碼格式不正確");
      }

      const referrer = await findReferrerByCode(code);

      if (!referrer) {
        return sendSuccess(res, {
          valid: false,
          message: "邀請碼無效或已過期",
        });
      }

      sendSuccess(res, {
        valid: true,
        referrerName: referrer.displayName,
        rewards: REFERRAL_CONFIG.REFEREE_REWARDS,
      });
    } catch (error) {
      logger.error(`[邀請獎勵] 驗證邀請碼失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "驗證邀請碼失敗");
    }
  }
);

// ============================================
// 邀請處理
// ============================================

/**
 * 使用邀請碼（新用戶註冊時調用）
 * POST /api/referral/apply
 * 🔒 需要身份驗證
 */
router.post(
  "/apply",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { code } = req.body;

      if (!code) {
        return sendError(res, "VALIDATION_ERROR", "請提供邀請碼");
      }

      const result = await processReferralSignup(userId, code.toUpperCase());

      if (!result.success) {
        const errorMessages = {
          INVALID_CODE: "邀請碼無效或已過期",
          SELF_REFERRAL: "不能使用自己的邀請碼",
          ALREADY_REFERRED: "您已經使用過邀請碼了",
          DAILY_LIMIT_REACHED: "該邀請碼今日邀請次數已達上限",
          NEW_USER_NOT_FOUND: "用戶資料不存在",
        };

        return sendError(
          res,
          "REFERRAL_FAILED",
          errorMessages[result.reason] || "邀請碼使用失敗"
        );
      }

      sendSuccess(res, {
        message: "邀請碼使用成功",
        referrerName: result.referrerName,
        rewards: result.refereeRewards,
      });
    } catch (error) {
      logger.error(`[邀請獎勵] 使用邀請碼失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "使用邀請碼失敗");
    }
  }
);

/**
 * 激活邀請（被邀請人達到活躍標準後調用）
 * POST /api/referral/activate
 * 🔒 需要身份驗證
 * ⚠️ 通常由系統自動調用
 */
router.post(
  "/activate",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const result = await activateReferral(userId);

      if (!result.success) {
        const errorMessages = {
          NO_PENDING_REFERRAL: "沒有待激活的邀請記錄",
        };

        return sendError(
          res,
          "ACTIVATION_FAILED",
          errorMessages[result.reason] || "激活失敗"
        );
      }

      sendSuccess(res, {
        message: "邀請激活成功",
        referrerRewards: result.rewards,
      });
    } catch (error) {
      logger.error(`[邀請獎勵] 激活邀請失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "激活邀請失敗");
    }
  }
);

// ============================================
// 統計和查詢
// ============================================

/**
 * 獲取用戶的邀請統計
 * GET /api/referral/stats
 * 🔒 需要身份驗證
 */
router.get(
  "/stats",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const stats = await getUserReferralStats(userId);
      sendSuccess(res, stats);
    } catch (error) {
      logger.error(`[邀請獎勵] 獲取邀請統計失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取邀請統計失敗");
    }
  }
);

/**
 * 獲取用戶的邀請列表
 * GET /api/referral/list
 * 🔒 需要身份驗證
 */
router.get(
  "/list",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { limit = 50, status } = req.query;

      const result = await getUserReferrals(userId, {
        limit: Math.min(parseInt(limit) || 50, 100),
        status,
      });

      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[邀請獎勵] 獲取邀請列表失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取邀請列表失敗");
    }
  }
);

/**
 * 獲取邀請排行榜
 * GET /api/referral/leaderboard
 * 🔒 需要身份驗證
 */
router.get(
  "/leaderboard",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const { limit = 20 } = req.query;

      const leaderboard = await getReferralLeaderboard({
        limit: Math.min(parseInt(limit) || 20, 50),
      });

      sendSuccess(res, { leaderboard });
    } catch (error) {
      logger.error(`[邀請獎勵] 獲取排行榜失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取排行榜失敗");
    }
  }
);

/**
 * 獲取邀請獎勵配置
 * GET /api/referral/config
 * 🔓 公開接口
 */
router.get(
  "/config",
  relaxedRateLimiter,
  async (req, res) => {
    try {
      sendSuccess(res, {
        referrerRewards: REFERRAL_CONFIG.REFERRER_REWARDS,
        refereeRewards: REFERRAL_CONFIG.REFEREE_REWARDS,
        firstPurchaseBonus: REFERRAL_CONFIG.FIRST_PURCHASE_BONUS,
        milestones: Object.entries(REFERRAL_CONFIG.MILESTONE_REWARDS).map(([count, rewards]) => ({
          count: parseInt(count),
          ...rewards,
        })),
        dailyLimit: REFERRAL_CONFIG.DAILY_INVITE_LIMIT,
      });
    } catch (error) {
      logger.error(`[邀請獎勵] 獲取配置失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取配置失敗");
    }
  }
);

export default router;
