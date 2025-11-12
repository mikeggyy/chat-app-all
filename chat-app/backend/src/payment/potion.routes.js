/**
 * 道具系統路由
 * 處理道具購買和查詢請求
 */

import express from "express";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../shared/utils/errorFormatter.js";
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

const router = express.Router();

/**
 * 獲取可購買的道具列表
 * GET /api/potions/available
 */
router.get(
  "/available",
  requireFirebaseAuth,
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
 */
router.post(
  "/purchase/memory-boost",
  requireFirebaseAuth,
  validateRequest(potionSchemas.purchaseMemoryBoost),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    const { idempotencyKey } = req.body;

    if (!idempotencyKey) {
      return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey（冪等性鍵）以防止重複購買", {
        field: "idempotencyKey",
      });
    }

    // 冪等性保護（必須）
    const requestId = `potion-memory:${userId}:${idempotencyKey}`;
    const result = await handleIdempotentRequest(
      requestId,
      async () => await purchaseMemoryBoost(userId),
      { ttl: IDEMPOTENCY_TTL.POTION_PURCHASE } // 15 分鐘
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error("購買記憶增強藥水失敗:", error);
    next(error);
  }
});

/**
 * 購買腦力激盪藥水
 * POST /api/potions/purchase/brain-boost
 * Body: { idempotencyKey }
 * 🔒 冪等性保護：防止重複購買（必須提供 idempotencyKey）
 */
router.post(
  "/purchase/brain-boost",
  requireFirebaseAuth,
  validateRequest(potionSchemas.purchaseBrainBoost),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    const { idempotencyKey } = req.body;

    if (!idempotencyKey) {
      return sendError(res, "VALIDATION_ERROR", "請提供 idempotencyKey（冪等性鍵）以防止重複購買", {
        field: "idempotencyKey",
      });
    }

    // 冪等性保護（必須）
    const requestId = `potion-brain:${userId}:${idempotencyKey}`;
    const result = await handleIdempotentRequest(
      requestId,
      async () => await purchaseBrainBoost(userId),
      { ttl: IDEMPOTENCY_TTL.POTION_PURCHASE } // 15 分鐘
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error("購買腦力激盪藥水失敗:", error);
    next(error);
  }
});

/**
 * 使用記憶增強藥水
 * POST /api/potions/use/memory-boost
 * Body: { characterId: string }
 */
router.post(
  "/use/memory-boost",
  requireFirebaseAuth,
  validateRequest(potionSchemas.useMemoryBoost),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    const { characterId } = req.body;
    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "需要提供角色ID", {
        field: "characterId",
      });
    }

    const result = await useMemoryBoost(userId, characterId);

    sendSuccess(res, result);
  } catch (error) {
    logger.error("使用記憶增強藥水失敗:", error);
    next(error);
  }
});

/**
 * 使用腦力激盪藥水
 * POST /api/potions/use/brain-boost
 * Body: { characterId: string }
 */
router.post(
  "/use/brain-boost",
  requireFirebaseAuth,
  validateRequest(potionSchemas.useBrainBoost),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "請先登入");
    }

    const { characterId } = req.body;
    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "需要提供角色ID", {
        field: "characterId",
      });
    }

    const result = await useBrainBoost(userId, characterId);

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

