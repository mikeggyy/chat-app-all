/**
 * 禮物系統路由
 */

import express from "express";
import logger from "../utils/logger.js";
import { sendGift, getUserGiftHistory, getCharacterGiftStats, getGiftPricing } from "./gift.service.js";
import { processGiftResponse } from "./giftResponse.service.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";
import { requireFirebaseAuth } from "../auth/index.js";

const router = express.Router();

/**
 * POST /api/gifts/send
 * 送禮物給角色（支持冪等性）
 * ⚠️ 安全修復：userId 從認證 token 獲取，不從請求體讀取
 */
router.post("/send", requireFirebaseAuth, async (req, res) => {
  try {
    // 從認證信息獲取 userId，防止偽造
    const userId = req.firebaseUser.uid;
    const { characterId, giftId, requestId } = req.body;

    // userId 不再需要檢查，因為已從認證中獲取

    if (!characterId) {
      return res.status(400).json({
        error: "缺少必要參數：characterId",
      });
    }

    if (!giftId) {
      return res.status(400).json({
        error: "缺少必要參數：giftId",
      });
    }

    // 如果提供了請求ID，使用冪等性處理
    if (requestId) {
      const result = await handleIdempotentRequest(
        requestId,
        async () => {
          return await sendGift(userId, characterId, giftId);
        },
        { ttl: 15 * 60 * 1000 } // 15分鐘
      );

      return res.status(200).json(result);
    }

    // 沒有請求ID，直接執行（向後兼容）
    const result = await sendGift(userId, characterId, giftId);
    res.status(200).json(result);
  } catch (error) {
    logger.error("送禮物失敗:", error);
    res.status(400).json({
      error: error.message || "送禮物失敗",
    });
  }
});

/**
 * GET /api/gifts/history
 * 獲取用戶送禮記錄
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人送禮記錄
 */
router.get("/history", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId, limit, offset } = req.query;

    const options = {
      characterId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    const result = getUserGiftHistory(userId, options);

    res.status(200).json(result);
  } catch (error) {
    logger.error("獲取送禮記錄失敗:", error);
    res.status(400).json({
      error: error.message || "獲取送禮記錄失敗",
    });
  }
});

/**
 * GET /api/gifts/stats/:characterId
 * 獲取用戶送給角色的禮物統計
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人統計
 */
router.get("/stats/:characterId", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId } = req.params;

    const result = getCharacterGiftStats(userId, characterId);

    res.status(200).json(result);
  } catch (error) {
    logger.error("獲取禮物統計失敗:", error);
    res.status(400).json({
      error: error.message || "獲取禮物統計失敗",
    });
  }
});

/**
 * GET /api/gifts/pricing
 * 獲取禮物價格列表（考慮用戶會員等級）
 * 🔒 安全增強：從認證 token 獲取 userId，防止查詢他人價格
 */
router.get("/pricing", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;

    const result = await getGiftPricing(userId);

    res.status(200).json(result);
  } catch (error) {
    logger.error("獲取禮物價格失敗:", error);
    res.status(400).json({
      error: error.message || "獲取禮物價格失敗",
    });
  }
});

/**
 * POST /api/gifts/response
 * 生成AI角色收到禮物的回應（感謝訊息 + 自拍照）
 * 🔒 安全增強：從認證 token 獲取 userId，防止代他人生成禮物回應
 */
router.post("/response", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterData, giftId, generatePhoto } = req.body;

    if (!characterData) {
      return res.status(400).json({
        error: "缺少必要參數：characterData",
      });
    }

    if (!giftId) {
      return res.status(400).json({
        error: "缺少必要參數：giftId",
      });
    }

    const result = await processGiftResponse(
      characterData,
      giftId,
      userId,
      { generatePhoto }
    );

    logger.info(`[禮物回應 API] 準備返回結果給前端: hasPhoto=${!!result.photo}, hasImageUrl=${!!result.photo?.imageUrl}`);
    if (result.photo?.imageUrl) {
      logger.info(`[禮物回應 API] ✅ 照片 URL 將被發送: ${result.photo.imageUrl.substring(0, 100)}...`);
      logger.info(`[禮物回應 API] ✅ 照片 URL 長度: ${result.photo.imageUrl.length}`);
    } else {
      logger.error(`[禮物回應 API] ❌ 照片 URL 缺失，將發送給前端的結果不包含照片 URL！`);
    }

    res.status(200).json(result);
  } catch (error) {
    logger.error("生成禮物回應失敗:", error);
    res.status(500).json({
      error: error.message || "生成禮物回應失敗",
    });
  }
});

export default router;
