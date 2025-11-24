/**
 * 禮物系統路由
 * ✅ 包含速率限制保護
 */

import express from "express";
import logger from "../utils/logger.js";
import { asyncHandler } from "../utils/routeHelpers.js";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../shared/utils/errorFormatter.js";
import { sendGift, getUserGiftHistory, getCharacterGiftStats, getGiftPricing } from "./gift.service.js";
import { refundCoins } from "../payment/coins.service.js";
import { processGiftResponse } from "./giftResponse.service.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import { requireFirebaseAuth } from "../auth/index.js";
import { giftRateLimiter, standardRateLimiter, relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js"; // ✅ P2-2: 使用集中配置的 TTL
import { validateRequest, giftSchemas } from "../middleware/validation.middleware.js";

const router = express.Router();

/**
 * POST /api/gifts/send
 * 送禮物給角色（支持冪等性）
 * ⚠️ 安全修復：userId 從認證 token 獲取，不從請求體讀取
 * ✅ 速率限制：15 次/分鐘，防止刷禮物
 * ✅ 輸入驗證：使用統一的驗證中間件
 */
router.post("/send", requireFirebaseAuth, validateRequest(giftSchemas.sendGift), giftRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    // 從認證信息獲取 userId，防止偽造
    const userId = req.firebaseUser.uid;
    const { characterId, giftId, requestId } = req.body;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：characterId", {
        field: "characterId",
      });
    }

    if (!giftId) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：giftId", {
        field: "giftId",
      });
    }

    // ⚠️ 財務操作必須提供 requestId 實現冪等性保護
    if (!requestId) {
      return sendError(
        res,
        "VALIDATION_ERROR",
        "缺少必要參數：requestId（財務操作必須提供請求ID以防止重複扣款）",
        { field: "requestId" }
      );
    }

    // 使用冪等性處理防止重複扣款
    // ✅ P2-2 修復：使用集中配置的 TTL
    const result = await handleIdempotentRequest(
      requestId,
      async () => {
        return await sendGift(userId, characterId, giftId);
      },
      { ttl: IDEMPOTENCY_TTL.GIFT }
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error("送禮物失敗:", error);
    next(error);
  }
}));

/**
 * GET /api/gifts/history
 * 獲取用戶送禮記錄
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人送禮記錄
 */
router.get("/history", requireFirebaseAuth, relaxedRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId, limit, offset } = req.query;

    const options = {
      characterId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    const result = getUserGiftHistory(userId, options);

    sendSuccess(res, result);
  } catch (error) {
    logger.error("獲取送禮記錄失敗:", error);
    next(error);
  }
}));

/**
 * GET /api/gifts/stats/:characterId
 * 獲取用戶送給角色的禮物統計
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人統計
 */
router.get("/stats/:characterId", requireFirebaseAuth, relaxedRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId } = req.params;

    const result = getCharacterGiftStats(userId, characterId);

    sendSuccess(res, result);
  } catch (error) {
    logger.error("獲取禮物統計失敗:", error);
    next(error);
  }
}));

/**
 * GET /api/gifts/pricing
 * 獲取禮物價格列表（考慮用戶會員等級）
 * 🔒 安全增強：從認證 token 獲取 userId，防止查詢他人價格
 */
router.get("/pricing", requireFirebaseAuth, relaxedRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;

    const result = await getGiftPricing(userId);

    sendSuccess(res, result);
  } catch (error) {
    logger.error("獲取禮物價格失敗:", error);
    next(error);
  }
}));

/**
 * POST /api/gifts/response
 * 生成AI角色收到禮物的回應（感謝訊息 + 自拍照）
 * 🔒 安全增強：從認證 token 獲取 userId，防止代他人生成禮物回應
 * ✅ 支援選擇現有照片：可傳入 selectedPhotoUrl 使用現有照片而非生成新照片
 * ✅ 2025-11-24：如果生成失敗，返回 success: false 和 needsRefund: true
 */
router.post("/response", requireFirebaseAuth, standardRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterData, giftId, generatePhoto, selectedPhotoUrl } = req.body;

    if (!characterData) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：characterData", {
        field: "characterData",
      });
    }

    if (!giftId) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：giftId", {
        field: "giftId",
      });
    }

    const result = await processGiftResponse(
      characterData,
      giftId,
      userId,
      {
        generatePhoto,
        selectedPhotoUrl // ✅ 傳遞選擇的照片 URL
      }
    );

    // ✅ 2025-11-24 修復：處理失敗情況
    if (!result.success) {
      logger.error(`[禮物回應 API] ❌ 處理失敗: error=${result.error}, needsRefund=${result.needsRefund}`);
      // 返回失敗狀態給前端，讓前端處理退款
      return sendSuccess(res, result);
    }

    // ✅ 修復：使用正確的字段名稱 photoMessage（與 processGiftResponse 返回的字段一致）
    logger.info(`[禮物回應 API] ✅ 處理成功: hasPhotoMessage=${!!result.photoMessage}, hasImageUrl=${!!result.photoMessage?.imageUrl}`);
    if (result.photoMessage?.imageUrl) {
      logger.info(`[禮物回應 API] ✅ 照片 URL 將被發送: ${result.photoMessage.imageUrl.substring(0, 100)}...`);
    }

    sendSuccess(res, result);
  } catch (error) {
    logger.error("生成禮物回應失敗:", error);
    next(error);
  }
}));

/**
 * POST /api/gifts/refund
 * 退款禮物（當禮物回應生成失敗時使用）
 * 🔒 安全增強：從認證 token 獲取 userId，只能退款自己的禮物
 * ✅ 2025-11-24：新增 API，用於處理禮物回應生成失敗時的退款
 */
router.post("/refund", requireFirebaseAuth, standardRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { giftId, amount, reason, characterId, requestId } = req.body;

    if (!giftId) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：giftId", {
        field: "giftId",
      });
    }

    if (!amount || amount <= 0) {
      return sendError(res, "VALIDATION_ERROR", "退款金額無效", {
        field: "amount",
      });
    }

    // 使用冪等性處理防止重複退款
    const idempotencyKey = `gift_refund_${requestId || `${userId}_${giftId}_${Date.now()}`}`;

    const result = await handleIdempotentRequest(
      idempotencyKey,
      async () => {
        logger.info(`[禮物退款] 開始退款: userId=${userId}, giftId=${giftId}, amount=${amount}, reason=${reason || '禮物回應生成失敗'}`);

        const refundResult = await refundCoins(
          userId,
          amount,
          reason || `禮物回應生成失敗（禮物ID：${giftId}，角色：${characterId || '未知'}）`
        );

        logger.info(`[禮物退款] ✅ 退款成功: userId=${userId}, amount=${amount}, newBalance=${refundResult.newBalance}`);

        return {
          success: true,
          refundedAmount: amount,
          newBalance: refundResult.newBalance,
          giftId,
        };
      },
      { ttl: IDEMPOTENCY_TTL.GIFT }
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error("禮物退款失敗:", error);
    next(error);
  }
}));

export default router;
