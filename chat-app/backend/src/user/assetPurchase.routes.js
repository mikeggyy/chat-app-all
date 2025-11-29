/**
 * 資產購買 API 路由
 */

import express from "express";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { purchaseAssetCard, purchaseAssetBundle } from "./assetPurchase.service.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import { purchaseRateLimiter } from "../middleware/rateLimiterConfig.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js";

const router = express.Router();

/**
 * 購買資產套餐
 * POST /api/assets/purchase
 * Body: { sku: string } 或 { assetId: string, quantity: number } (向後兼容)
 *
 * 新版 SKU 格式 (推薦):
 * - video-unlock-1: 1支影片卡
 * - video-unlock-5: 5支影片卡（9折）
 * - video-unlock-10: 10支影片卡（85折）
 *
 * 舊版格式 (向後兼容):
 * - assetId: character-unlock, photo-unlock, video-unlock, voice-unlock, create
 * - quantity: 1-100
 */
router.post("/api/assets/purchase", requireFirebaseAuth, purchaseRateLimiter, async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { sku, assetId, quantity } = req.body;

    // 調試日誌
    logger.info(`[資產購買API] 收到請求 - userId: ${userId}`);
    logger.info(`[資產購買API] req.body:`, JSON.stringify(req.body, null, 2));

    // 優先使用新版 SKU
    if (sku) {
      logger.info(`[資產購買API] 使用 SKU: ${sku}`);

      // 使用冪等性處理避免重複購買（1秒視窗，允許重複購買但防止快速重複點擊）
      const timestamp = Math.floor(Date.now() / 1000); // 1秒視窗
      const requestId = `purchase-package-${userId}-${sku}-${timestamp}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => {
          const { purchaseAssetPackage } = await import("./assetPurchase.service.js");
          return await purchaseAssetPackage(userId, sku);
        },
        { ttl: IDEMPOTENCY_TTL.ASSET_PURCHASE } // 2秒 TTL，僅防止快速重複點擊
      );

      return sendSuccess(res, result);
    }

    // 向後兼容：舊版 assetId + quantity
    if (assetId) {
      logger.warn(`[資產購買API] 使用舊版 API - assetId: ${assetId}, quantity: ${quantity || 1}`);

      if (quantity !== undefined && (quantity < 1 || quantity > 100)) {
        return sendError(res, "VALIDATION_ERROR", "購買數量必須在 1-100 之間", {
          quantity,
          validRange: "1-100",
        });
      }

      // 使用冪等性處理避免重複購買（1秒視窗，允許重複購買但防止快速重複點擊）
      const timestamp = Math.floor(Date.now() / 1000); // 1秒視窗
      const requestId = `purchase-asset-${userId}-${assetId}-${quantity || 1}-${timestamp}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => {
          return await purchaseAssetCard(userId, assetId, quantity || 1);
        },
        { ttl: IDEMPOTENCY_TTL.ASSET_PURCHASE } // 2秒 TTL，僅防止快速重複點擊
      );

      return sendSuccess(res, result);
    }

    // 缺少必要參數
    logger.warn(`[資產購買API] 缺少必要參數`);
    return sendError(res, "VALIDATION_ERROR", "缺少必要參數：sku 或 assetId", {
      providedFields: { sku: !!sku, assetId: !!assetId },
    });
  } catch (error) {
    logger.error("購買資產失敗:", error);
    next(error);
  }
});

/**
 * 批量購買資產卡（套餐）
 * POST /api/assets/purchase/bundle
 * Body: { items: Array<{assetId: string, quantity: number}> }
 */
router.post("/api/assets/purchase/bundle", requireFirebaseAuth, purchaseRateLimiter, async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：items", {
        field: "items",
        expected: "Array",
      });
    }

    // 驗證所有項目
    for (const item of items) {
      if (!item.assetId || item.quantity === undefined) {
        return sendError(res, "VALIDATION_ERROR", "每個項目必須包含 assetId 和 quantity", {
          invalidItem: item,
        });
      }

      if (item.quantity < 1 || item.quantity > 100) {
        return sendError(res, "VALIDATION_ERROR", "每個項目的購買數量必須在 1-100 之間", {
          assetId: item.assetId,
          quantity: item.quantity,
          validRange: "1-100",
        });
      }
    }

    // 使用冪等性處理避免重複購買（1秒視窗，允許重複購買但防止快速重複點擊）
    const bundleKey = items.map(i => `${i.assetId}x${i.quantity}`).join('-');
    const timestamp = Math.floor(Date.now() / 1000); // 1秒視窗
    const requestId = `purchase-bundle-${userId}-${bundleKey}-${timestamp}`;
    const result = await handleIdempotentRequest(
      requestId,
      async () => {
        return await purchaseAssetBundle(userId, items);
      },
      { ttl: IDEMPOTENCY_TTL.ASSET_PURCHASE } // 2秒 TTL，僅防止快速重複點擊
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error("批量購買資產卡失敗:", error);
    next(error);
  }
});

export default router;
