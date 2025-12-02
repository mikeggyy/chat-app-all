/**
 * 特殊優惠 API 路由
 * 處理首購優惠、回歸用戶優惠等特殊促銷活動
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import { purchaseRateLimiter, relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import {
  getFirstPurchaseOfferStatus,
  getReturningUserOfferStatus,
  activateReturningUserOffer,
  purchaseSpecialOffer,
  getAllSpecialOffers,
} from "./specialOffer.service.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";

const router = express.Router();

// 所有路由都需要認證
router.use(requireFirebaseAuth);

/**
 * GET /api/offers
 * 獲取用戶所有可用的特殊優惠
 */
router.get("/", relaxedRateLimiter, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const result = await getAllSpecialOffers(userId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error("[特殊優惠] 獲取優惠列表失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取優惠列表失敗");
  }
});

/**
 * GET /api/offers/first-purchase
 * 獲取首購優惠狀態
 */
router.get("/first-purchase", relaxedRateLimiter, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const result = await getFirstPurchaseOfferStatus(userId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error("[特殊優惠] 獲取首購優惠狀態失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取首購優惠狀態失敗");
  }
});

/**
 * GET /api/offers/returning
 * 獲取回歸用戶優惠狀態
 */
router.get("/returning", relaxedRateLimiter, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const result = await getReturningUserOfferStatus(userId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error("[特殊優惠] 獲取回歸優惠狀態失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取回歸優惠狀態失敗");
  }
});

/**
 * POST /api/offers/activate-returning
 * 激活回歸用戶優惠（用戶登入時調用）
 */
router.post("/activate-returning", relaxedRateLimiter, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const result = await activateReturningUserOffer(userId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error("[特殊優惠] 激活回歸優惠失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "激活回歸優惠失敗");
  }
});

/**
 * POST /api/offers/purchase
 * 購買特殊優惠
 * @body {string} offerType - 優惠類型 ("first_purchase" | "returning_user")
 */
router.post("/purchase", purchaseRateLimiter, handleIdempotentRequest, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { offerType } = req.body;

    // 驗證參數
    if (!offerType || !["first_purchase", "returning_user"].includes(offerType)) {
      return sendError(res, "VALIDATION_ERROR", "無效的優惠類型", {
        validTypes: ["first_purchase", "returning_user"],
      });
    }

    const result = await purchaseSpecialOffer(userId, offerType);

    logger.info(`[特殊優惠] 用戶 ${userId} 成功購買 ${offerType} 優惠`);

    sendSuccess(res, result);
  } catch (error) {
    logger.error("[特殊優惠] 購買優惠失敗:", error);

    // 區分不同錯誤類型
    if (error.message.includes("無法購買")) {
      return sendError(res, "PURCHASE_FAILED", error.message);
    }

    sendError(res, "INTERNAL_SERVER_ERROR", "購買優惠失敗");
  }
});

export default router;
