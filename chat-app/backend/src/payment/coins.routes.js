/**
 * 金幣系統 API 路由
 * ✅ 包含速率限制保護
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import { validateDevModeBypass } from "../utils/devModeHelper.js";
import {
  getCoinsBalance,
  purchaseUnlimitedChat,
  getFeaturePricing,
  getAllFeaturePrices,
  getTransactionHistory,
  getCoinPackages,
  purchaseCoinPackage,
  rechargeCoins,
  setCoinsBalance,
} from "./coins.service.js";
import { isTestAccount } from "../../shared/config/testAccounts.js";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { validateRequest, coinSchemas } from "../middleware/validation.middleware.js";
import { purchaseRateLimiter, relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js";

const router = express.Router();

/**
 * 獲取金幣餘額
 * GET /api/coins/balance
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人餘額
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/coins/balance",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(coinSchemas.getBalance),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const balance = await getCoinsBalance(userId);

    sendSuccess(res, balance);
  } catch (error) {
    next(error);
  }
});

/**
 * 購買角色無限對話解鎖（使用角色解鎖票或金幣）
 * POST /api/coins/purchase/unlimited-chat
 * Body: { characterId, useTicket, idempotencyKey }
 * 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人金幣
 * 🔒 冪等性保護：防止重複扣費（必須提供 idempotencyKey）
 * ✅ 速率限制：10次/分鐘（購買操作）
 */
router.post(
  "/api/coins/purchase/unlimited-chat",
  requireFirebaseAuth,
  purchaseRateLimiter,
  validateRequest(coinSchemas.purchaseUnlimitedChat),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId, idempotencyKey } = req.body;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "請提供 characterId", {
        field: "characterId",
      });
    }

    if (!idempotencyKey) {
      return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey（冪等性鍵）以防止重複購買", {
        field: "idempotencyKey",
      });
    }

    // 冪等性保護（必須）
    const requestId = `unlock-chat:${userId}:${characterId}:${idempotencyKey}`;
    const result = await handleIdempotentRequest(
      requestId,
      async () => await purchaseUnlimitedChat(userId, characterId),
      { ttl: IDEMPOTENCY_TTL.COIN_FEATURE_PURCHASE } // 15 分鐘
    );

    sendSuccess(res, {
      message: "購買成功，已解鎖無限對話",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 獲取特定功能的價格
 * GET /api/coins/pricing/:featureId
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人價格
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/coins/pricing/:featureId",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(coinSchemas.getFeaturePricing),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { featureId } = req.params;
    const pricing = await getFeaturePricing(userId, featureId);

    sendSuccess(res, pricing);
  } catch (error) {
    next(error);
  }
});

/**
 * 獲取所有功能的價格列表
 * GET /api/coins/pricing
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人價格
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/coins/pricing",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(coinSchemas.getAllPricing),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const prices = await getAllFeaturePrices(userId);

    sendSuccess(res, prices);
  } catch (error) {
    next(error);
  }
});

/**
 * 獲取交易記錄
 * GET /api/coins/transactions
 * Query: ?limit=50&offset=0
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人交易記錄
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/coins/transactions",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(coinSchemas.getTransactions),
  async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { limit, offset } = req.query;

    const history = await getTransactionHistory(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    res.json({
      success: true,
      ...history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 獲取金幣充值套餐列表
 * GET /api/coins/packages
 * ⚠️ 此端點無需身份驗證（公開套餐列表）
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/coins/packages",
  relaxedRateLimiter,
  validateRequest(coinSchemas.getPackages),
  async (req, res) => {
  try {
    const packages = await getCoinPackages();

    res.json(packages);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 購買金幣套餐（實際應整合支付系統）
 * POST /api/coins/purchase/package
 * Body: { packageId, paymentInfo, idempotencyKey }
 * 🔒 安全增強：從認證 token 獲取 userId，防止代他人購買金幣
 * 🔒 冪等性保護：防止重複扣款和發放
 * ✅ 速率限制：10次/分鐘（購買操作）
 */
router.post(
  "/api/coins/purchase/package",
  requireFirebaseAuth,
  purchaseRateLimiter,
  validateRequest(coinSchemas.purchasePackage),
  async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { packageId, paymentInfo, idempotencyKey } = req.body;

    if (!packageId) {
      return res.status(400).json({
        success: false,
        error: "請提供 packageId",
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: "請提供 idempotencyKey（冪等性鍵）以防止重複購買",
      });
    }

    // 檢查是否啟用開發模式繞過
    const isDevBypassEnabled = process.env.ENABLE_DEV_PURCHASE_BYPASS === "true";

    if (isDevBypassEnabled) {
      // ✅ 修復：添加安全驗證
      try {
        validateDevModeBypass(userId, {
          featureName: "金幣套餐購買",
          // 從環境變數讀取是否要求測試帳號
        });

        logger.warn(
          `[開發模式] 繞過支付購買金幣套餐：userId=${userId}, packageId=${packageId}`
        );

        // 開發模式：直接執行購買，不需要實際支付驗證
        const requestId = `coin-package:${userId}:${packageId}:${idempotencyKey}`;
        const result = await handleIdempotentRequest(
          requestId,
          async () => await purchaseCoinPackage(userId, packageId, paymentInfo || {
            method: "dev_bypass",
            timestamp: new Date().toISOString(),
          }),
          { ttl: IDEMPOTENCY_TTL.COIN_PACKAGE } // 15 分鐘
        );

        return res.json({
          success: true,
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

      return res.status(501).json({
        success: false,
        error: "支付系統尚未整合，請聯繫管理員",
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 充值金幣（測試用，實際應整合支付系統）
 * POST /api/coins/recharge
 * Body: { amount, idempotencyKey }
 * 🔒 安全增強：從認證 token 獲取 userId，防止代他人充值金幣
 * 🔒 冪等性保護：防止重複充值（必須提供 idempotencyKey）
 * ⚠️ 此端點僅供測試帳號使用
 * ✅ 速率限制：10次/分鐘（購買操作）
 */
router.post(
  "/api/coins/recharge",
  requireFirebaseAuth,
  purchaseRateLimiter,
  validateRequest(coinSchemas.rechargeCoins),
  async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { amount, idempotencyKey } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "請提供有效的 amount",
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: "請提供 idempotencyKey（冪等性鍵）以防止重複充值",
      });
    }

    // ✅ 修復：限制僅測試帳號可用
    try {
      validateDevModeBypass(userId, {
        featureName: "測試充值",
        // 從環境變數讀取是否要求測試帳號
      });

      logger.warn(`[測試充值] userId=${userId}, amount=${amount}`);

      // TODO: 實際應用應先驗證支付成功

      // 冪等性保護（必須）
      const requestId = `recharge:${userId}:${amount}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await rechargeCoins(userId, amount, {
          method: "test",
          timestamp: new Date().toISOString(),
        }),
        { ttl: IDEMPOTENCY_TTL.COIN_RECHARGE } // 15 分鐘
      );

      return res.json({
        success: true,
        message: `成功充值 ${amount} 金幣`,
        ...result,
      });
    } catch (error) {
      logger.error(`[安全] 測試充值權限驗證失敗: ${error.message}`);
      return sendError(res, "FORBIDDEN", error.message);
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 設定金幣餘額（測試帳號專用）
 * POST /api/coins/set-balance
 * Body: { balance }
 * 🔒 安全增強：從認證 token 獲取 userId，只能設置自己的餘額
 * ⚠️ 此端點僅供測試帳號使用，用於快速設定金幣數量進行測試
 * ✅ 速率限制：10次/分鐘（購買操作）
 */
router.post(
  "/api/coins/set-balance",
  requireFirebaseAuth,
  purchaseRateLimiter,
  validateRequest(coinSchemas.setBalance),
  async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { balance } = req.body;

    if (typeof balance !== "number" || balance < 0) {
      return res.status(400).json({
        success: false,
        error: "請提供有效的金幣數量（必須為非負整數）",
      });
    }

    // ✅ 加強：使用統一的驗證函數
    try {
      validateDevModeBypass(userId, {
        featureName: "設定金幣餘額",
        // 從環境變數讀取是否要求測試帳號
      });

      logger.warn(`[測試] 設定金幣餘額：userId=${userId}, balance=${balance}`);

      const result = await setCoinsBalance(userId, Math.floor(balance));

      return res.json({
        success: true,
        message: `成功設定金幣餘額為 ${result.newBalance}`,
        ...result,
      });
    } catch (error) {
      logger.error(`[安全] 設定餘額權限驗證失敗: ${error.message}`);
      return sendError(res, "FORBIDDEN", error.message);
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
