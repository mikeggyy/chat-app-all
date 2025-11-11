/**
 * 金幣系統 API 路由
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import {
  getCoinsBalance,
  purchaseAiPhoto,
  purchaseAiVideo,
  purchaseUnlimitedChat,
  getFeaturePricing,
  getAllFeaturePrices,
  getTransactionHistory,
  getCoinPackages,
  purchaseCoinPackage,
  rechargeCoins,
  setCoinsBalance,
} from "./coins.service.js";
import { isTestAccount } from "../../../../shared/config/testAccounts.js";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../../shared/utils/errorFormatter.js";

const router = express.Router();

/**
 * 獲取金幣餘額
 * GET /api/coins/balance
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人餘額
 */
router.get("/api/coins/balance", requireFirebaseAuth, async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const balance = await getCoinsBalance(userId);

    sendSuccess(res, balance);
  } catch (error) {
    next(error);
  }
});

/**
 * 購買 AI 拍照功能
 * POST /api/coins/purchase/ai-photo
 * Body: { characterId, idempotencyKey }
 * 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人金幣
 * 🔒 冪等性保護：防止重複扣費
 */
router.post("/api/coins/purchase/ai-photo", requireFirebaseAuth, async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId, idempotencyKey } = req.body;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "請提供 characterId", {
        field: "characterId",
      });
    }

    // 冪等性保護
    if (idempotencyKey) {
      const requestId = `ai-photo:${userId}:${characterId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await purchaseAiPhoto(userId, characterId),
        { ttl: 15 * 60 * 1000 } // 15 分鐘
      );

      return sendSuccess(res, {
        message: "購買成功，正在生成照片",
        ...result,
      });
    }

    // 向後兼容：沒有 idempotencyKey 的請求
    const result = await purchaseAiPhoto(userId, characterId);

    sendSuccess(res, {
      message: "購買成功，正在生成照片",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 購買 AI 影片功能
 * POST /api/coins/purchase/ai-video
 * Body: { characterId, idempotencyKey }
 * 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人金幣
 * 🔒 冪等性保護：防止重複扣費
 */
router.post("/api/coins/purchase/ai-video", requireFirebaseAuth, async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId, idempotencyKey } = req.body;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "請提供 characterId", {
        field: "characterId",
      });
    }

    // 冪等性保護
    if (idempotencyKey) {
      const requestId = `ai-video:${userId}:${characterId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await purchaseAiVideo(userId, characterId),
        { ttl: 30 * 60 * 1000 } // 30 分鐘（影片生成時間較長）
      );

      return sendSuccess(res, {
        message: "購買成功，正在生成影片",
        ...result,
      });
    }

    // 向後兼容：沒有 idempotencyKey 的請求
    const result = await purchaseAiVideo(userId, characterId);

    sendSuccess(res, {
      message: "購買成功，正在生成影片",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 購買角色無限對話解鎖（使用角色解鎖票或金幣）
 * POST /api/coins/purchase/unlimited-chat
 * Body: { characterId, useTicket, idempotencyKey }
 * 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人金幣
 * 🔒 冪等性保護：防止重複扣費
 */
router.post("/api/coins/purchase/unlimited-chat", requireFirebaseAuth, async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId, idempotencyKey } = req.body;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "請提供 characterId", {
        field: "characterId",
      });
    }

    // 冪等性保護
    if (idempotencyKey) {
      const requestId = `unlock-chat:${userId}:${characterId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await purchaseUnlimitedChat(userId, characterId),
        { ttl: 15 * 60 * 1000 } // 15 分鐘
      );

      return sendSuccess(res, {
        message: "購買成功，已解鎖無限對話",
        ...result,
      });
    }

    // 向後兼容：沒有 idempotencyKey 的請求
    const result = await purchaseUnlimitedChat(userId, characterId);

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
 */
router.get("/api/coins/pricing/:featureId", requireFirebaseAuth, async (req, res, next) => {
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
 */
router.get("/api/coins/pricing", requireFirebaseAuth, async (req, res, next) => {
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
 */
router.get("/api/coins/transactions", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { limit, offset } = req.query;

    const history = await getTransactionHistory(userId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
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
 */
router.get("/api/coins/packages", async (req, res) => {
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
 */
router.post("/api/coins/purchase/package", requireFirebaseAuth, async (req, res) => {
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
      // 開發模式：直接執行購買，不需要實際支付驗證
      console.log(`[開發模式] 購買金幣套餐：userId=${userId}, packageId=${packageId}`);

      // 冪等性保護
      const requestId = `coin-package:${userId}:${packageId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await purchaseCoinPackage(userId, packageId, paymentInfo || {
          method: "dev_bypass",
          timestamp: new Date().toISOString(),
        }),
        { ttl: 15 * 60 * 1000 } // 15 分鐘
      );

      res.json({
        success: true,
        message: "購買成功（開發模式）",
        devMode: true,
        ...result,
      });
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
 * 🔒 冪等性保護：防止重複充值
 */
router.post("/api/coins/recharge", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { amount, idempotencyKey } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "請提供有效的 amount",
      });
    }

    // TODO: 實際應用應先驗證支付成功

    // 冪等性保護
    if (idempotencyKey) {
      const requestId = `recharge:${userId}:${amount}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await rechargeCoins(userId, amount, {
          method: "test",
          timestamp: new Date().toISOString(),
        }),
        { ttl: 15 * 60 * 1000 } // 15 分鐘
      );

      return res.json({
        success: true,
        message: `成功充值 ${amount} 金幣`,
        ...result,
      });
    }

    // 向後兼容：沒有 idempotencyKey 的請求
    const result = await rechargeCoins(userId, amount, {
      method: "test",
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `成功充值 ${amount} 金幣`,
      ...result,
    });
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
 */
router.post("/api/coins/set-balance", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { balance } = req.body;

    if (typeof balance !== "number" || balance < 0) {
      return res.status(400).json({
        success: false,
        error: "請提供有效的金幣數量（必須為非負整數）",
      });
    }

    // 驗證是否為測試帳號
    if (!isTestAccount(userId)) {
      return res.status(403).json({
        success: false,
        error: "此功能僅供測試帳號使用",
      });
    }

    const result = await setCoinsBalance(userId, Math.floor(balance));

    res.json({
      success: true,
      message: `成功設定金幣餘額為 ${result.newBalance}`,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
