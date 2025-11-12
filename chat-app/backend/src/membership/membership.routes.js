/**
 * 會員管理 API 路由
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { requireOwnership } from "../utils/routeHelpers.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js"; // ✅ P2-2: 使用集中配置的 TTL
import {
  getUserMembership,
  upgradeMembership,
  cancelMembership,
  renewMembership,
  checkFeatureAccess,
  getUserFeatures,
} from "./membership.service.js";
import { getUserById } from "../user/user.service.js";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { purchaseRateLimiter, relaxedRateLimiter, standardRateLimiter } from "../middleware/rateLimiterConfig.js";

const router = express.Router();

/**
 * 獲取用戶會員資訊
 * GET /api/membership/:userId
 */
router.get("/api/membership/:userId", requireFirebaseAuth, requireOwnership("userId"), relaxedRateLimiter, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const membership = await getUserMembership(userId);

    if (!membership) {
      throw new ApiError("USER_NOT_FOUND", "找不到該用戶的會員資訊", { userId });
    }

    sendSuccess(res, { membership });
  } catch (error) {
    next(error);
  }
});

/**
 * 升級會員
 * POST /api/membership/:userId/upgrade
 * Body: { tier: "vip" | "vvip", durationMonths?: number, autoRenew?: boolean, idempotencyKey: string }
 * 🔒 冪等性保護：防止重複升級和發放獎勵
 */
router.post("/api/membership/:userId/upgrade", requireFirebaseAuth, requireOwnership("userId"), purchaseRateLimiter, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { tier, durationMonths, autoRenew, idempotencyKey } = req.body;

    // 驗證會員等級
    if (!tier || !["vip", "vvip"].includes(tier)) {
      return sendError(res, "VALIDATION_ERROR", "請提供有效的會員等級（vip 或 vvip）", {
        field: "tier",
        validValues: ["vip", "vvip"],
        received: tier,
      });
    }

    // 驗證冪等性鍵
    if (!idempotencyKey) {
      return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey（冪等性鍵）以防止重複升級", {
        field: "idempotencyKey",
      });
    }

    // 檢查是否啟用開發模式繞過
    const isDevBypassEnabled = process.env.ENABLE_DEV_PURCHASE_BYPASS === "true";

    if (isDevBypassEnabled) {
      // 開發模式：直接執行升級，不需要實際支付驗證
      logger.info(`[開發模式] 升級會員：userId=${userId}, tier=${tier}`);

      try {
        // 冪等性保護
        // ✅ P2-2 修復：使用集中配置的 TTL
        const requestId = `membership-upgrade:${userId}:${tier}:${idempotencyKey}`;
        const membership = await handleIdempotentRequest(
          requestId,
          async () => await upgradeMembership(userId, tier, {
            durationMonths,
            autoRenew,
          }),
          { ttl: IDEMPOTENCY_TTL.MEMBERSHIP_UPGRADE }
        );

        sendSuccess(res, {
          message: `成功升級為 ${tier.toUpperCase()}（開發模式）`,
          devMode: true,
          membership,
        });
      } catch (upgradeError) {
        // ✅ 詳細的錯誤處理：檢查是否為部分成功
        logger.error(`[會員服務] 升級失敗 - 用戶: ${userId}, 目標等級: ${tier}`, upgradeError);

        try {
          // 檢查用戶當前狀態
          const currentUser = await getUserById(userId);

          if (currentUser && currentUser.membershipTier === tier) {
            // ⚠️ 會員等級已更新，但 Transaction 報告失敗
            // 這種情況理論上不應該發生（Transaction 保證原子性）
            logger.error(`[會員服務] 異常狀態 - 用戶 ${userId} 的會員等級已是 ${tier}，但操作報告失敗`);

            // 返回當前會員資訊，並標記為可能不完整
            const membership = await getUserMembership(userId);
            return sendSuccess(res, {
              message: `會員等級已更新，但操作可能未完全完成。請刷新頁面查看最新狀態。`,
              warning: "PARTIAL_SUCCESS_DETECTED",
              devMode: true,
              membership,
            });
          }
        } catch (checkError) {
          logger.error(`[會員服務] 檢查用戶狀態失敗:`, checkError);
        }

        // 正常的失敗情況：Transaction 回滾，所有操作未生效
        throw upgradeError;
      }
    } else {
      // 正式環境：應整合支付系統
      return sendError(res, "NOT_IMPLEMENTED", "支付系統尚未整合，請聯繫管理員");
    }
  } catch (error) {
    next(error);
  }
});

/**
 * 取消訂閱
 * POST /api/membership/:userId/cancel
 * Body: { immediate?: boolean }
 */
router.post("/api/membership/:userId/cancel", requireFirebaseAuth, requireOwnership("userId"), standardRateLimiter, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { immediate } = req.body;

    const membership = await cancelMembership(userId, immediate);

    sendSuccess(res, {
      message: immediate ? "已立即取消訂閱" : "將在到期後取消訂閱",
      membership,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 續訂會員
 * POST /api/membership/:userId/renew
 * Body: { durationMonths?: number }
 */
router.post("/api/membership/:userId/renew", requireFirebaseAuth, requireOwnership("userId"), purchaseRateLimiter, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { durationMonths } = req.body;

    // TODO: 整合支付系統

    const membership = await renewMembership(userId, durationMonths);

    sendSuccess(res, {
      message: "續訂成功",
      membership,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 檢查功能權限
 * GET /api/membership/:userId/features/:featureName
 */
router.get("/api/membership/:userId/features/:featureName", requireFirebaseAuth, requireOwnership("userId"), relaxedRateLimiter, async (req, res, next) => {
  try {
    const { userId, featureName } = req.params;
    const hasAccess = await checkFeatureAccess(userId, featureName);

    sendSuccess(res, {
      userId,
      featureName,
      hasAccess,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 獲取用戶所有功能權限
 * GET /api/membership/:userId/features
 */
router.get("/api/membership/:userId/features", requireFirebaseAuth, requireOwnership("userId"), relaxedRateLimiter, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const features = await getUserFeatures(userId);

    sendSuccess(res, features);
  } catch (error) {
    next(error);
  }
});

export default router;
