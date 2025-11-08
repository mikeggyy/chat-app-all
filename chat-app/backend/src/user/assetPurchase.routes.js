/**
 * 資產購買 API 路由
 */

import express from "express";
import logger from "../utils/logger.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { purchaseAssetCard, purchaseAssetBundle } from "./assetPurchase.service.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";

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
router.post("/api/assets/purchase", requireFirebaseAuth, async (req, res) => {
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
        { ttl: 2 * 1000 } // 2秒 TTL，僅防止快速重複點擊
      );

      return res.json(result);
    }

    // 向後兼容：舊版 assetId + quantity
    if (assetId) {
      logger.warn(`[資產購買API] 使用舊版 API - assetId: ${assetId}, quantity: ${quantity || 1}`);

      if (quantity && (quantity < 1 || quantity > 100)) {
        return res.status(400).json({
          success: false,
          message: "購買數量必須在 1-100 之間",
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
        { ttl: 2 * 1000 } // 2秒 TTL，僅防止快速重複點擊
      );

      return res.json(result);
    }

    // 缺少必要參數
    logger.warn(`[資產購買API] 缺少必要參數`);
    return res.status(400).json({
      success: false,
      message: "缺少必要參數：sku 或 assetId",
    });
  } catch (error) {
    logger.error("購買資產失敗:", error);
    const status = error.message.includes("金幣不足") || error.message.includes("找不到") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "購買失敗",
    });
  }
});

/**
 * 批量購買資產卡（套餐）
 * POST /api/assets/purchase/bundle
 * Body: { items: Array<{assetId: string, quantity: number}> }
 */
router.post("/api/assets/purchase/bundle", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "缺少必要參數：items",
      });
    }

    // 驗證所有項目
    for (const item of items) {
      if (!item.assetId || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: "每個項目必須包含 assetId 和 quantity",
        });
      }

      if (item.quantity < 1 || item.quantity > 100) {
        return res.status(400).json({
          success: false,
          message: "每個項目的購買數量必須在 1-100 之間",
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
      { ttl: 2 * 1000 } // 2秒 TTL，僅防止快速重複點擊
    );

    res.json(result);
  } catch (error) {
    logger.error("批量購買資產卡失敗:", error);
    const status = error.message.includes("金幣不足") || error.message.includes("找不到") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "購買失敗",
    });
  }
});

export default router;
