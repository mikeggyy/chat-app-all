/**
 * 年訂閱獎勵 API 路由
 *
 * 提供年訂閱狀態查詢、獎勵領取等功能
 *
 * @module yearlyBonus.routes
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { relaxedRateLimiter, standardRateLimiter } from "../middleware/rateLimiterConfig.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js";
import {
  YEARLY_BONUS_CONFIG,
  getYearlySubscriptionStatus,
  grantMonthlyBonus,
  checkAndGrantAnniversaryBonus,
} from "./yearlyBonus.service.js";

const router = express.Router();

/**
 * 獲取年訂閱狀態和可用獎勵
 * GET /api/yearly-bonus/status
 * 🔒 需要身份驗證
 *
 * 返回：
 * - isYearlySubscriber: 是否是年訂閱用戶
 * - tier: 訂閱等級
 * - availableBonuses: 可領取的獎勵
 * - bonusHistory: 獎勵領取歷史
 * - yearlyBenefits: 年訂閱優惠預覽（非年訂閱用戶）
 */
router.get(
  "/status",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const status = await getYearlySubscriptionStatus(userId);
      sendSuccess(res, status);
    } catch (error) {
      logger.error(`[年訂閱獎勵] 獲取狀態失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取年訂閱狀態失敗");
    }
  }
);

/**
 * 領取每月獎勵
 * POST /api/yearly-bonus/claim/monthly
 * 🔒 需要身份驗證
 * 🔒 冪等性保護
 */
router.post(
  "/claim/monthly",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { idempotencyKey } = req.body;

      if (!idempotencyKey) {
        return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey");
      }

      const requestId = `yearly_monthly:${userId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await grantMonthlyBonus(userId),
        { ttl: IDEMPOTENCY_TTL.GENERAL || 900000 }
      );

      if (!result.success) {
        const errorMessages = {
          NOT_YEARLY_SUBSCRIBER: "您不是年訂閱用戶",
          MEMBERSHIP_INACTIVE: "會員資格已過期",
          NO_BONUS_CONFIG: "無可用獎勵配置",
          ALREADY_CLAIMED: "本月獎勵已領取",
        };

        return sendError(
          res,
          "CLAIM_FAILED",
          errorMessages[result.reason] || "領取失敗"
        );
      }

      sendSuccess(res, {
        message: "每月獎勵領取成功",
        month: result.month,
        rewards: result.rewards,
        newBalance: result.newBalance,
      });
    } catch (error) {
      logger.error(`[年訂閱獎勵] 領取每月獎勵失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "領取失敗");
    }
  }
);

/**
 * 領取週年獎勵
 * POST /api/yearly-bonus/claim/anniversary
 * 🔒 需要身份驗證
 * 🔒 冪等性保護
 */
router.post(
  "/claim/anniversary",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { idempotencyKey } = req.body;

      if (!idempotencyKey) {
        return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey");
      }

      const requestId = `yearly_anniversary:${userId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await checkAndGrantAnniversaryBonus(userId),
        { ttl: IDEMPOTENCY_TTL.GENERAL || 900000 }
      );

      if (!result.success) {
        const errorMessages = {
          USER_NOT_FOUND: "用戶不存在",
          NOT_YEARLY_SUBSCRIBER: "您不是年訂閱用戶",
          NOT_ANNIVERSARY_YET: "尚未到達週年日",
          NO_BONUS_FOR_YEAR: "該年份無週年獎勵",
          ALREADY_CLAIMED: "週年獎勵已領取",
        };

        return sendError(
          res,
          "CLAIM_FAILED",
          errorMessages[result.reason] || "領取失敗"
        );
      }

      sendSuccess(res, {
        message: `${result.anniversaryYear}週年獎勵領取成功`,
        anniversaryYear: result.anniversaryYear,
        rewards: result.rewards,
        newBalance: result.newBalance,
      });
    } catch (error) {
      logger.error(`[年訂閱獎勵] 領取週年獎勵失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "領取失敗");
    }
  }
);

/**
 * 獲取年訂閱配置（公開）
 * GET /api/yearly-bonus/config
 *
 * 返回各等級的年訂閱獎勵配置
 */
router.get(
  "/config",
  relaxedRateLimiter,
  async (req, res) => {
    try {
      sendSuccess(res, {
        signupBonus: YEARLY_BONUS_CONFIG.SIGNUP_BONUS,
        monthlyBonus: YEARLY_BONUS_CONFIG.MONTHLY_BONUS,
        renewalBonus: Object.fromEntries(
          Object.entries(YEARLY_BONUS_CONFIG.RENEWAL_BONUS).map(([tier, config]) => [
            tier,
            { ...config, discountPercent: config.discountPercent },
          ])
        ),
        anniversaryMilestones: Object.keys(YEARLY_BONUS_CONFIG.ANNIVERSARY_BONUS).map(Number),
        exclusiveEvents: YEARLY_BONUS_CONFIG.EXCLUSIVE_EVENTS,
      });
    } catch (error) {
      logger.error(`[年訂閱獎勵] 獲取配置失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取配置失敗");
    }
  }
);

/**
 * 獲取年訂閱優惠預覽
 * GET /api/yearly-bonus/preview/:tier
 *
 * 返回指定等級的年訂閱優惠詳情
 */
router.get(
  "/preview/:tier",
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const { tier } = req.params;
      const validTiers = ["lite", "vip", "vvip"];

      if (!validTiers.includes(tier)) {
        return sendError(res, "VALIDATION_ERROR", "無效的會員等級");
      }

      const signupBonus = YEARLY_BONUS_CONFIG.SIGNUP_BONUS[tier];
      const monthlyBonus = YEARLY_BONUS_CONFIG.MONTHLY_BONUS[tier];
      const renewalBonus = YEARLY_BONUS_CONFIG.RENEWAL_BONUS[tier];

      // 計算價值
      const calculateValue = (rewards) => {
        if (!rewards) return 0;
        return (rewards.coins || 0) +
          (rewards.photoCards || 0) * 50 +
          (rewards.unlockCards || 0) * 100;
      };

      const signupValue = calculateValue(signupBonus);
      const monthlyValue = calculateValue(monthlyBonus) * 12;
      const totalFirstYearValue = signupValue + monthlyValue;

      // 計算節省金額
      const prices = {
        lite: { monthly: 99, yearly: 990 },
        vip: { monthly: 299, yearly: 2990 },
        vvip: { monthly: 599, yearly: 5990 },
      };
      const tierPrice = prices[tier];
      const monthlyTotal = tierPrice.monthly * 12;
      const savings = monthlyTotal - tierPrice.yearly;

      sendSuccess(res, {
        tier,
        pricing: {
          monthly: tierPrice.monthly,
          yearly: tierPrice.yearly,
          monthlyTotal,
          savings,
          savingsPercent: Math.round((savings / monthlyTotal) * 100),
        },
        benefits: {
          signup: {
            rewards: signupBonus,
            value: signupValue,
          },
          monthly: {
            rewards: monthlyBonus,
            yearlyValue: monthlyValue,
          },
          renewal: {
            rewards: renewalBonus,
            discountPercent: renewalBonus.discountPercent,
          },
        },
        totalFirstYearValue,
        exclusiveEvents: YEARLY_BONUS_CONFIG.EXCLUSIVE_EVENTS[tier] || [],
        highlights: generateHighlights(tier),
      });
    } catch (error) {
      logger.error(`[年訂閱獎勵] 獲取預覽失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取預覽失敗");
    }
  }
);

/**
 * 生成亮點說明
 * @private
 */
const generateHighlights = (tier) => {
  const highlights = [
    { icon: "💰", text: "年繳省更多，最高省 17%" },
    { icon: "🎁", text: "註冊即送豪華禮包" },
    { icon: "📅", text: "每月額外獎勵自動發放" },
  ];

  if (tier === "vip" || tier === "vvip") {
    highlights.push({ icon: "🎫", text: "每月贈送解鎖券" });
    highlights.push({ icon: "🌟", text: "專屬活動參與資格" });
  }

  if (tier === "vvip") {
    highlights.push({ icon: "👑", text: "專屬頭像框和稱號" });
    highlights.push({ icon: "🎯", text: "優先客服支援" });
  }

  return highlights;
};

export default router;
