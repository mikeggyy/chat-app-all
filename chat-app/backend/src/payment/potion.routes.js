/**
 * 道具系統路由
 * 處理道具購買和查詢請求
 */

import express from "express";
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

const router = express.Router();

/**
 * 獲取可購買的道具列表
 * GET /api/potions/available
 */
router.get("/available", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const potions = await getAvailablePotions(userId);

    res.json({
      success: true,
      potions,
    });
  } catch (error) {
    logger.error("獲取道具列表失敗:", error);
    res.status(500).json({
      success: false,
      message: error.message || "獲取道具列表失敗",
    });
  }
});

/**
 * 獲取用戶已購買的道具（活躍中）
 * GET /api/potions/active
 */
router.get("/active", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    // 清理過期道具
    await cleanupExpiredPotions(userId);

    const activePotions = await getUserActivePotions(userId);

    res.json({
      success: true,
      potions: activePotions,
    });
  } catch (error) {
    logger.error("獲取活躍道具失敗:", error);
    res.status(500).json({
      success: false,
      message: error.message || "獲取活躍道具失敗",
    });
  }
});

/**
 * 購買記憶增強藥水
 * POST /api/potions/purchase/memory-boost
 * Body: { idempotencyKey }
 * 購買後加入庫存，使用時才需要選擇角色
 * 🔒 冪等性保護：防止重複購買
 */
router.post("/purchase/memory-boost", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const { idempotencyKey } = req.body;

    // 冪等性保護
    if (idempotencyKey) {
      const requestId = `potion-memory:${userId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await purchaseMemoryBoost(userId),
        { ttl: 15 * 60 * 1000 } // 15 分鐘
      );

      return res.json(result);
    }

    // 向後兼容：沒有 idempotencyKey 的請求
    const result = await purchaseMemoryBoost(userId);
    res.json(result);
  } catch (error) {
    logger.error("購買記憶增強藥水失敗:", error);
    const status = error.message.includes("金幣不足") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "購買失敗",
    });
  }
});

/**
 * 購買腦力激盪藥水
 * POST /api/potions/purchase/brain-boost
 * Body: { idempotencyKey }
 * 🔒 冪等性保護：防止重複購買
 */
router.post("/purchase/brain-boost", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const { idempotencyKey } = req.body;

    // 冪等性保護
    if (idempotencyKey) {
      const requestId = `potion-brain:${userId}:${idempotencyKey}`;
      const result = await handleIdempotentRequest(
        requestId,
        async () => await purchaseBrainBoost(userId),
        { ttl: 15 * 60 * 1000 } // 15 分鐘
      );

      return res.json(result);
    }

    // 向後兼容：沒有 idempotencyKey 的請求
    const result = await purchaseBrainBoost(userId);
    res.json(result);
  } catch (error) {
    logger.error("購買腦力激盪藥水失敗:", error);
    const status = error.message.includes("金幣不足") || error.message.includes("已經是最高級") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "購買失敗",
    });
  }
});

/**
 * 使用記憶增強藥水
 * POST /api/potions/use/memory-boost
 * Body: { characterId: string }
 */
router.post("/use/memory-boost", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const { characterId } = req.body;
    if (!characterId) {
      return res.status(400).json({
        success: false,
        message: "需要提供角色ID",
      });
    }

    const result = await useMemoryBoost(userId, characterId);

    res.json(result);
  } catch (error) {
    logger.error("使用記憶增強藥水失敗:", error);
    const status = error.message.includes("庫存不足") || error.message.includes("已有") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "使用失敗",
    });
  }
});

/**
 * 使用腦力激盪藥水
 * POST /api/potions/use/brain-boost
 * Body: { characterId: string }
 */
router.post("/use/brain-boost", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const { characterId } = req.body;
    if (!characterId) {
      return res.status(400).json({
        success: false,
        message: "需要提供角色ID",
      });
    }

    const result = await useBrainBoost(userId, characterId);

    res.json(result);
  } catch (error) {
    logger.error("使用腦力激盪藥水失敗:", error);
    const status = error.message.includes("庫存不足") || error.message.includes("已有") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "使用失敗",
    });
  }
});

/**
 * 檢查特定角色是否有藥水效果
 * GET /api/potions/character/:characterId/effects
 * 用於前端判斷是否顯示「使用藥水」按鈕
 */
router.get("/character/:characterId/effects", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const { characterId } = req.params;
    if (!characterId) {
      return res.status(400).json({
        success: false,
        message: "需要提供角色ID",
      });
    }

    const hasMemory = await hasMemoryBoost(userId, characterId);
    const hasBrain = await hasBrainBoost(userId, characterId);

    res.json({
      success: true,
      characterId,
      effects: {
        memoryBoost: hasMemory,
        brainBoost: hasBrain,
      },
    });
  } catch (error) {
    logger.error("檢查角色藥水效果失敗:", error);
    res.status(500).json({
      success: false,
      message: error.message || "檢查失敗",
    });
  }
});

export default router;

