/**
 * 首購優惠 API 路由
 * 處理首購禮包的查詢和購買
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import {
  getFirstPurchaseOffer,
  purchaseFirstPurchaseOffer,
} from "./firstPurchase.service.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { relaxedRateLimiter, purchaseRateLimiter } from "../middleware/rateLimiterConfig.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js";
import { validateDevModeBypass } from "../utils/devModeHelper.js";

const router = express.Router();

/**
 * 獲取首購優惠信息
 * GET /api/offers/first-purchase
 * 🔒 需要身份驗證
 * ✅ 速率限制：60次/分鐘
 *
 * 返回：
 * - available: 是否可購買
 * - offer: 首購禮包詳情（如果可購買）
 * - reason: 不可購買的原因（如果不可購買）
 */
router.get(
  "/api/offers/first-purchase",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const result = await getFirstPurchaseOffer(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[首購優惠] 獲取信息失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取首購優惠信息失敗");
    }
  }
);

/**
 * 購買首購禮包
 * POST /api/offers/first-purchase/purchase
 * 🔒 需要身份驗證
 * 🔒 冪等性保護
 * ✅ 速率限制：10次/分鐘
 *
 * Body: { paymentInfo, idempotencyKey }
 */
router.post(
  "/api/offers/first-purchase/purchase",
  requireFirebaseAuth,
  purchaseRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { paymentInfo, idempotencyKey } = req.body;

      if (!idempotencyKey) {
        return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey", {
          field: "idempotencyKey",
        });
      }

      // 檢查是否啟用開發模式繞過
      const isDevBypassEnabled = process.env.ENABLE_DEV_PURCHASE_BYPASS === "true";

      if (isDevBypassEnabled) {
        // 開發模式：需要驗證測試帳號
        try {
          validateDevModeBypass(userId, {
            featureName: "首購禮包購買",
          });

          logger.warn(
            `[開發模式] 繞過支付購買首購禮包：userId=${userId}`
          );

          // 開發模式：直接執行購買，不需要實際支付驗證
          const requestId = `first_purchase:${userId}:${idempotencyKey}`;
          const result = await handleIdempotentRequest(
            requestId,
            async () => await purchaseFirstPurchaseOffer(userId, paymentInfo || {
              method: "dev_bypass",
              timestamp: new Date().toISOString(),
            }),
            { ttl: IDEMPOTENCY_TTL.COIN_PACKAGE || 900000 }
          );

          return sendSuccess(res, {
            message: "購買成功（開發模式）",
            devMode: true,
            ...result,
          });
        } catch (error) {
          // 驗證失敗，拒絕請求
          logger.error(`[安全] 開發模式繞過驗證失敗: ${error.message}`);
          return sendError(res, "FORBIDDEN", error.message);
        }
      } else {
        // 正式環境：應整合支付系統
        return sendError(res, "NOT_IMPLEMENTED", "支付系統尚未整合，請聯繫管理員");
      }
    } catch (error) {
      logger.error(`[首購優惠] 購買失敗: ${error.message}`);
      sendError(res, "PURCHASE_FAILED", error.message);
    }
  }
);

export default router;
