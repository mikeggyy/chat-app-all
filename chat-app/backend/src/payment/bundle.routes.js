/**
 * 組合禮包 API 路由
 * ✅ 包含速率限制保護
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import { validateDevModeBypass } from "../utils/devModeHelper.js";
import {
  getBundlePackages,
  getBundlePackagesWithStatus,
  getBundlePackageById,
  purchaseBundlePackage,
} from "./bundle.service.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { purchaseRateLimiter, relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js";

const router = express.Router();

/**
 * 獲取組合禮包列表
 * GET /api/bundles
 * ⚠️ 此端點無需身份驗證（公開套餐列表）
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/bundles",
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const result = await getBundlePackages();
      sendSuccess(res, result);
    } catch (error) {
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取禮包列表失敗");
    }
  }
);

/**
 * 獲取組合禮包列表（含用戶購買狀態）
 * GET /api/bundles/me
 * 🔒 需要身份驗證
 * ✅ 速率限制：60次/分鐘（讀取操作）
 *
 * 返回結構：
 * {
 *   success: true,
 *   packages: [{
 *     ...bundleData,
 *     purchaseStatus: {
 *       canPurchase: boolean,
 *       reason: string | null,
 *       nextAvailableAt: Date | null,
 *       purchaseCount: number,
 *       lastPurchaseAt: Date | null
 *     }
 *   }]
 * }
 */
router.get(
  "/api/bundles/me",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const result = await getBundlePackagesWithStatus(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[禮包服務] 獲取用戶禮包狀態失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取用戶禮包狀態失敗");
    }
  }
);

/**
 * 獲取單個組合禮包詳情
 * GET /api/bundles/:bundleId
 * ⚠️ 此端點無需身份驗證（公開套餐詳情）
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/bundles/:bundleId",
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const { bundleId } = req.params;

      if (!bundleId) {
        return sendError(res, "VALIDATION_ERROR", "請提供 bundleId", {
          field: "bundleId",
        });
      }

      const result = await getBundlePackageById(bundleId);

      if (!result.success) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的禮包");
      }

      sendSuccess(res, result);
    } catch (error) {
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取禮包詳情失敗");
    }
  }
);

/**
 * 購買組合禮包（需要整合支付系統）
 * POST /api/bundles/purchase
 * Body: { bundleId, paymentInfo, idempotencyKey }
 * 🔒 安全增強：從認證 token 獲取 userId，防止代他人購買
 * 🔒 冪等性保護：防止重複扣款和發放
 * ✅ 速率限制：10次/分鐘（購買操作）
 */
router.post(
  "/api/bundles/purchase",
  requireFirebaseAuth,
  purchaseRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { bundleId, paymentInfo, idempotencyKey } = req.body;

      if (!bundleId) {
        return sendError(res, "VALIDATION_ERROR", "請提供 bundleId", {
          field: "bundleId",
        });
      }

      if (!idempotencyKey) {
        return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey（冪等性鍵）以防止重複購買", {
          field: "idempotencyKey",
        });
      }

      // 檢查是否啟用開發模式繞過
      const isDevBypassEnabled = process.env.ENABLE_DEV_PURCHASE_BYPASS === "true";

      if (isDevBypassEnabled) {
        // 開發模式：需要驗證測試帳號
        try {
          validateDevModeBypass(userId, {
            featureName: "組合禮包購買",
          });

          logger.warn(
            `[開發模式] 繞過支付購買組合禮包：userId=${userId}, bundleId=${bundleId}`
          );

          // 開發模式：直接執行購買，不需要實際支付驗證
          const requestId = `bundle:${userId}:${bundleId}:${idempotencyKey}`;
          const result = await handleIdempotentRequest(
            requestId,
            async () => await purchaseBundlePackage(userId, bundleId, paymentInfo || {
              method: "dev_bypass",
              timestamp: new Date().toISOString(),
            }),
            { ttl: IDEMPOTENCY_TTL.COIN_PACKAGE || 900000 } // 15 分鐘
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
        // TODO: 實際應用應先驗證支付成功
        // 1. 創建支付訂單
        // 2. 等待支付完成
        // 3. 驗證支付成功後才執行購買

        return sendError(res, "NOT_IMPLEMENTED", "支付系統尚未整合，請聯繫管理員");
      }
    } catch (error) {
      sendError(res, "PURCHASE_FAILED", error.message);
    }
  }
);

export default router;
