/**
 * 解鎖票系統 API 路由
 */

import express from "express";
import logger from "../utils/logger.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import {
  getTicketBalance,
  useCharacterUnlockTicket,
  usePhotoUnlockCard,
  useVideoUnlockCard,
  hasEnoughTickets,
  getUsageHistory,
  TICKET_TYPES,
} from "./unlockTickets.service.js";

const router = express.Router();

/**
 * 獲取用戶的解鎖票餘額
 * GET /api/unlock-tickets/balance
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人餘額
 */
router.get("/api/unlock-tickets/balance", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const balance = await getTicketBalance(userId);

    res.json({
      success: true,
      ...balance,
    });
  } catch (error) {
    logger.error("獲取解鎖票餘額失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 使用角色解鎖票
 * POST /api/unlock-tickets/use/character
 * Body: { characterId }
 * 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人解鎖票
 */
router.post("/api/unlock-tickets/use/character", requireFirebaseAuth, (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId } = req.body;

    if (!characterId) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數：characterId",
      });
    }

    const result = useCharacterUnlockTicket(userId, characterId);

    res.json({
      success: true,
      message: "成功使用角色解鎖票",
      ...result,
    });
  } catch (error) {
    logger.error("使用角色解鎖票失敗:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 使用拍照解鎖卡
 * POST /api/unlock-tickets/use/photo
 * Body: { characterId }
 * 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人照片卡
 */
router.post("/api/unlock-tickets/use/photo", requireFirebaseAuth, (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId } = req.body;

    if (!characterId) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數：characterId",
      });
    }

    const result = usePhotoUnlockCard(userId, characterId);

    res.json({
      success: true,
      message: "成功使用拍照解鎖卡",
      ...result,
    });
  } catch (error) {
    logger.error("使用拍照解鎖卡失敗:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 使用影片解鎖卡
 * POST /api/unlock-tickets/use/video
 * Body: { characterId }
 * 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人影片卡
 */
router.post("/api/unlock-tickets/use/video", requireFirebaseAuth, (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { characterId } = req.body;

    if (!characterId) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數：characterId",
      });
    }

    const result = useVideoUnlockCard(userId, characterId);

    res.json({
      success: true,
      message: "成功使用影片解鎖卡",
      ...result,
    });
  } catch (error) {
    logger.error("使用影片解鎖卡失敗:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 檢查是否有足夠的解鎖票
 * GET /api/unlock-tickets/check/:ticketType
 * Query: ?amount=1
 * 🔒 安全增強：從認證 token 獲取 userId，防止查詢他人餘額
 */
router.get("/api/unlock-tickets/check/:ticketType", requireFirebaseAuth, (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { ticketType } = req.params;
    const amount = parseInt(req.query.amount) || 1;

    const hasEnough = hasEnoughTickets(userId, ticketType, amount);

    res.json({
      success: true,
      userId,
      ticketType,
      amount,
      hasEnough,
    });
  } catch (error) {
    logger.error("檢查解鎖票失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 獲取使用歷史
 * GET /api/unlock-tickets/history
 * Query: ?limit=50&offset=0
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人歷史
 */
router.get("/api/unlock-tickets/history", requireFirebaseAuth, (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const history = getUsageHistory(userId, { limit, offset });

    res.json({
      success: true,
      ...history,
    });
  } catch (error) {
    logger.error("獲取使用歷史失敗:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
