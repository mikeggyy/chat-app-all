/**
 * 會員管理 API 路由
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { requireOwnership } from "../utils/routeHelpers.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import {
  getUserMembership,
  upgradeMembership,
  cancelMembership,
  renewMembership,
  checkFeatureAccess,
  getUserFeatures,
} from "./membership.service.js";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../shared/utils/errorFormatter.js";

const router = express.Router();

/**
 * 獲取用戶會員資訊
 * GET /api/membership/:userId
 */
router.get("/api/membership/:userId", requireFirebaseAuth, requireOwnership("userId"), async (req, res, next) => {
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
router.post("/api/membership/:userId/upgrade", requireFirebaseAuth, requireOwnership("userId"), async (req, res, next) => {
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
      console.log(`[開發模式] 升級會員：userId=${userId}, tier=${tier}`);

      // 冪等性保護
      const requestId = `membership-upgrade:${userId}:${tier}:${idempotencyKey}`;
      const membership = await handleIdempotentRequest(
        requestId,
        async () => await upgradeMembership(userId, tier, {
          durationMonths,
          autoRenew,
        }),
        { ttl: 15 * 60 * 1000 } // 15 分鐘
      );

      sendSuccess(res, {
        message: `成功升級為 ${tier.toUpperCase()}（開發模式）`,
        devMode: true,
        membership,
      });
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
router.post("/api/membership/:userId/cancel", requireFirebaseAuth, requireOwnership("userId"), async (req, res, next) => {
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
router.post("/api/membership/:userId/renew", requireFirebaseAuth, requireOwnership("userId"), async (req, res, next) => {
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
router.get("/api/membership/:userId/features/:featureName", requireFirebaseAuth, requireOwnership("userId"), async (req, res, next) => {
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
router.get("/api/membership/:userId/features", requireFirebaseAuth, requireOwnership("userId"), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const features = await getUserFeatures(userId);

    sendSuccess(res, features);
  } catch (error) {
    next(error);
  }
});

export default router;
