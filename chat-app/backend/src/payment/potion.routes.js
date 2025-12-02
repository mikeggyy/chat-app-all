/**
 * 道具系統路由
 * 處理道具購買和查詢請求
 */

import express from "express";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import {
  getAvailablePotions,
  getUserActivePotions,
  purchaseMemoryBoost,
  purchaseBrainBoost,
  useMemoryBoost,
  useBrainBoost,
  cleanupExpiredPotions,
  hasMemoryBoost,
  hasBrainBoost,
} from "./potion.service.js";
import { validateRequest, potionSchemas } from "../middleware/validation.middleware.js";
import { IDEMPOTENCY_TTL } from "../config/limits.js";
import { createFinancialRouteHandler } from "../utils/routeHelpers.js";
import {
  purchaseRateLimiter,
  standardRateLimiter,
  relaxedRateLimiter,
} from "../middleware/rateLimiterConfig.js";
import { canUseBrainBoost, getModelUsageStats } from "../services/modelUsageMonitoring.service.js";
import { getUserProfileWithCache } from "../user/userProfileCache.service.js";

const router = express.Router();

/**
 * 獲取可購買的道具列表
 * GET /api/potions/available
 */
router.get(
  "/available",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(potionSchemas.getAvailablePotions),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    const potions = await getAvailablePotions(userId);

    sendSuccess(res, { potions });
  } catch (error) {
    logger.error("獲取道具列表失敗:", error);
    next(error);
  }
});

/**
 * 獲取用戶已購買的道具（活躍中）
 * GET /api/potions/active
 */
router.get(
  "/active",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(potionSchemas.getActivePotions),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    // 清理過期道具
    await cleanupExpiredPotions(userId);

    const activePotions = await getUserActivePotions(userId);

    sendSuccess(res, { potions: activePotions });
  } catch (error) {
    logger.error("獲取活躍道具失敗:", error);
    next(error);
  }
});

/**
 * 購買記憶增強藥水
 * POST /api/potions/purchase/memory-boost
 * Body: { idempotencyKey }
 * 購買後加入庫存，使用時才需要選擇角色
 * 🔒 冪等性保護：防止重複購買（必須提供 idempotencyKey）
 * ✅ 2025-12-02 遷移：使用 createFinancialRouteHandler 統一處理
 */
router.post(
  "/purchase/memory-boost",
  requireFirebaseAuth,
  purchaseRateLimiter,
  validateRequest(potionSchemas.purchaseMemoryBoost),
  createFinancialRouteHandler(
    async (req, res, userId) => {
      return await purchaseMemoryBoost(userId);
    },
    {
      operationType: "購買記憶增強藥水",
      idempotencyPrefix: "potion-memory",
      idempotencyTTL: IDEMPOTENCY_TTL.POTION_PURCHASE,
    }
  )
);

/**
 * 購買腦力激盪藥水
 * POST /api/potions/purchase/brain-boost
 * Body: { idempotencyKey }
 * 🔒 冪等性保護：防止重複購買（必須提供 idempotencyKey）
 * ✅ 2025-12-02 遷移：使用 createFinancialRouteHandler 統一處理
 */
router.post(
  "/purchase/brain-boost",
  requireFirebaseAuth,
  purchaseRateLimiter,
  validateRequest(potionSchemas.purchaseBrainBoost),
  createFinancialRouteHandler(
    async (req, res, userId) => {
      return await purchaseBrainBoost(userId);
    },
    {
      operationType: "購買腦力激盪藥水",
      idempotencyPrefix: "potion-brain",
      idempotencyTTL: IDEMPOTENCY_TTL.POTION_PURCHASE,
    }
  )
);

/**
 * 使用記憶增強藥水
 * POST /api/potions/use/memory-boost
 * Body: { characterId: string, idempotencyKey: string }
 * 🔒 冪等性保護（2025-01）：防止重複消耗道具
 */
router.post(
  "/use/memory-boost",
  requireFirebaseAuth,
  standardRateLimiter,
  validateRequest(potionSchemas.useMemoryBoost),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    const { characterId, idempotencyKey } = req.body;
    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "需要提供角色ID", {
        field: "characterId",
      });
    }

    // 🔒 冪等性保護：必須提供 idempotencyKey
    if (!idempotencyKey) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：idempotencyKey（道具使用必須提供請求ID以防止重複消耗）", 400);
    }

    const requestId = `potion-use-memory:${userId}:${characterId}:${idempotencyKey}`;
    const result = await handleIdempotentRequest(
      requestId,
      async () => await useMemoryBoost(userId, characterId),
      { ttl: 5 * 60 * 1000 } // 5分鐘
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error("使用記憶增強藥水失敗:", error);
    next(error);
  }
});

/**
 * 使用腦力激盪藥水
 * POST /api/potions/use/brain-boost
 * Body: { characterId: string, idempotencyKey: string }
 * 🔒 冪等性保護（2025-01）：防止重複消耗道具
 */
router.post(
  "/use/brain-boost",
  requireFirebaseAuth,
  standardRateLimiter,
  validateRequest(potionSchemas.useBrainBoost),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    const { characterId, idempotencyKey } = req.body;
    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "需要提供角色ID", {
        field: "characterId",
      });
    }

    // 🔒 冪等性保護：必須提供 idempotencyKey
    if (!idempotencyKey) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：idempotencyKey（道具使用必須提供請求ID以防止重複消耗）", 400);
    }

    const requestId = `potion-use-brain:${userId}:${characterId}:${idempotencyKey}`;
    const result = await handleIdempotentRequest(
      requestId,
      async () => await useBrainBoost(userId, characterId),
      { ttl: 5 * 60 * 1000 } // 5分鐘
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error("使用腦力激盪藥水失敗:", error);
    next(error);
  }
});

/**
 * 檢查特定角色是否有藥水效果
 * GET /api/potions/character/:characterId/effects
 * 用於前端判斷是否顯示「使用藥水」按鈕
 */
router.get(
  "/character/:characterId/effects",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(potionSchemas.getCharacterEffects),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    const { characterId } = req.params;
    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "需要提供角色ID", {
        field: "characterId",
      });
    }

    const hasMemory = await hasMemoryBoost(userId, characterId);
    const hasBrain = await hasBrainBoost(userId, characterId);

    sendSuccess(res, {
      characterId,
      effects: {
        memoryBoost: hasMemory,
        brainBoost: hasBrain,
      },
    });
  } catch (error) {
    logger.error("檢查角色藥水效果失敗:", error);
    next(error);
  }
});

export default router;

