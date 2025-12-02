/**
 * 限時閃購 API 路由
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import {
  relaxedRateLimiter,
  purchaseRateLimiter,
} from "../middleware/rateLimiterConfig.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import {
  getActiveFlashSales,
  getFlashSaleById,
  checkFlashSalePurchaseEligibility,
  purchaseFlashSale,
  getUserFlashSalePurchases,
} from "./flashSale.service.js";

const router = express.Router();

// 所有路由都需要認證
router.use(requireFirebaseAuth);

/**
 * GET /api/flash-sales
 * 獲取所有進行中的閃購活動
 */
router.get("/", relaxedRateLimiter, async (req, res) => {
  try {
    const sales = await getActiveFlashSales();
    sendSuccess(res, { sales, count: sales.length });
  } catch (error) {
    logger.error("[閃購] 獲取活動列表失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取閃購活動失敗");
  }
});

/**
 * GET /api/flash-sales/purchases
 * 獲取用戶的閃購購買記錄
 */
router.get("/purchases", relaxedRateLimiter, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const purchases = await getUserFlashSalePurchases(userId);
    sendSuccess(res, { purchases });
  } catch (error) {
    logger.error("[閃購] 獲取購買記錄失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取購買記錄失敗");
  }
});

/**
 * GET /api/flash-sales/:saleId
 * 獲取特定閃購活動詳情
 */
router.get("/:saleId", relaxedRateLimiter, async (req, res) => {
  try {
    const { saleId } = req.params;
    const sale = await getFlashSaleById(saleId);

    if (!sale) {
      return sendError(res, "RESOURCE_NOT_FOUND", "閃購活動不存在", { saleId });
    }

    sendSuccess(res, { sale });
  } catch (error) {
    logger.error("[閃購] 獲取活動詳情失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取閃購活動失敗");
  }
});

/**
 * GET /api/flash-sales/:saleId/eligibility
 * 檢查用戶是否可以購買特定閃購
 */
router.get("/:saleId/eligibility", relaxedRateLimiter, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { saleId } = req.params;

    const eligibility = await checkFlashSalePurchaseEligibility(userId, saleId);
    sendSuccess(res, eligibility);
  } catch (error) {
    logger.error("[閃購] 檢查購買資格失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "檢查購買資格失敗");
  }
});

/**
 * POST /api/flash-sales/purchase
 * 購買閃購商品
 */
router.post("/purchase", purchaseRateLimiter, handleIdempotentRequest, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { saleId } = req.body;

    if (!saleId) {
      return sendError(res, "VALIDATION_MISSING_PARAMETER", "缺少 saleId 參數", { field: "saleId" });
    }

    const result = await purchaseFlashSale(userId, saleId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error("[閃購] 購買失敗:", error);
    sendError(res, "PURCHASE_FAILED", error.message || "購買閃購失敗");
  }
});

export default router;
