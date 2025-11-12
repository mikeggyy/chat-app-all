/**
 * 解鎖券 API 路由 - 修復版本
 * 修復內容：
 * ✅ 添加冪等性保護（使用 requestId）
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import {
  sendSuccess,
  sendError,
  asyncHandler,
  requireParams,
} from "../utils/routeHelpers.js";
import {
  useCharacterUnlockTicket,
  usePhotoUnlockCard,
  useVideoUnlockCard,
  getTicketBalance,
  getAllTicketBalances,
  TICKET_TYPES,
} from "./unlockTickets.service.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";

const router = express.Router();

/**
 * 使用角色解鎖票
 * POST /api/unlock-tickets/use/character
 * Body: { characterId, requestId }
 * ✅ 修復：添加冪等性保護
 */
router.post(
  "/api/unlock-tickets/use/character",
  requireFirebaseAuth,
  requireParams(["characterId", "requestId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { characterId, requestId } = req.body;

    // ✅ 修復：使用冪等性保護
    const idempotencyKey = requestId || `unlock-character:${userId}:${characterId}:${Date.now()}`;

    const result = await handleIdempotentRequest(
      idempotencyKey,
      async () => {
        return await useCharacterUnlockTicket(userId, characterId);
      },
      {
        ttl: 5 * 60 * 1000, // 5 分鐘 TTL
      }
    );

    sendSuccess(res, {
      message: "成功使用角色解鎖票",
      ...result,
    });
  })
);

/**
 * 使用拍照解鎖卡
 * POST /api/unlock-tickets/use/photo
 * Body: { requestId }
 * ✅ 修復：添加冪等性保護
 */
router.post(
  "/api/unlock-tickets/use/photo",
  requireFirebaseAuth,
  requireParams(["requestId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { requestId } = req.body;

    const idempotencyKey = requestId || `unlock-photo:${userId}:${Date.now()}`;

    const result = await handleIdempotentRequest(
      idempotencyKey,
      async () => {
        return await usePhotoUnlockCard(userId);
      },
      {
        ttl: 5 * 60 * 1000,
      }
    );

    sendSuccess(res, result);
  })
);

/**
 * 使用影片解鎖卡
 * POST /api/unlock-tickets/use/video
 * Body: { requestId }
 * ✅ 修復：添加冪等性保護
 */
router.post(
  "/api/unlock-tickets/use/video",
  requireFirebaseAuth,
  requireParams(["requestId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { requestId } = req.body;

    const idempotencyKey = requestId || `unlock-video:${userId}:${Date.now()}`;

    const result = await handleIdempotentRequest(
      idempotencyKey,
      async () => {
        return await useVideoUnlockCard(userId);
      },
      {
        ttl: 5 * 60 * 1000,
      }
    );

    sendSuccess(res, result);
  })
);

/**
 * 獲取解鎖券餘額
 * GET /api/unlock-tickets/balance/:ticketType
 */
router.get(
  "/api/unlock-tickets/balance/:ticketType",
  requireFirebaseAuth,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { ticketType } = req.params;

    // 驗證券類型
    if (!Object.values(TICKET_TYPES).includes(ticketType)) {
      return sendError(res, "VALIDATION_ERROR", `無效的券類型：${ticketType}`);
    }

    const balance = await getTicketBalance(userId, ticketType);
    sendSuccess(res, balance);
  })
);

/**
 * 獲取所有解鎖券餘額
 * GET /api/unlock-tickets/balances
 */
router.get(
  "/api/unlock-tickets/balances",
  requireFirebaseAuth,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const balances = await getAllTicketBalances(userId);
    sendSuccess(res, balances);
  })
);

export default router;
