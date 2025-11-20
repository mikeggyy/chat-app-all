/**
 * 解鎖券 API 路由 - 修復版本
 * 修復內容：
 * ✅ 添加冪等性保護（使用 requestId）
 * ✅ 添加速率限制保護
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
import { IDEMPOTENCY_TTL } from "../config/limits.js"; // ✅ P2-2: 使用集中配置的 TTL
import { purchaseRateLimiter, relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";

const router = express.Router();

/**
 * 使用角色解鎖票
 * POST /api/unlock-tickets/use/character
 * Body: { characterId, requestId }
 * ✅ 修復：添加冪等性保護
 * ✅ 速率限制：10次/分鐘
 */
router.post(
  "/api/unlock-tickets/use/character",
  requireFirebaseAuth,
  purchaseRateLimiter, // 解鎖券使用操作，限制 10次/分鐘
  requireParams(["characterId", "requestId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { characterId, requestId } = req.body;

    // ✅ 修復：使用冪等性保護
    const idempotencyKey = requestId || `unlock-character:${userId}:${characterId}:${Date.now()}`;

    // ✅ P2-2 修復：使用集中配置的 TTL
    const result = await handleIdempotentRequest(
      idempotencyKey,
      async () => {
        return await useCharacterUnlockTicket(userId, characterId);
      },
      {
        ttl: IDEMPOTENCY_TTL.UNLOCK_TICKET,
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
 * ✅ 速率限制：10次/分鐘
 */
router.post(
  "/api/unlock-tickets/use/photo",
  requireFirebaseAuth,
  purchaseRateLimiter, // 解鎖卡使用操作，限制 10次/分鐘
  requireParams(["requestId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { requestId } = req.body;

    const idempotencyKey = requestId || `unlock-photo:${userId}:${Date.now()}`;

    // ✅ P2-2 修復：使用集中配置的 TTL
    const result = await handleIdempotentRequest(
      idempotencyKey,
      async () => {
        return await usePhotoUnlockCard(userId);
      },
      {
        ttl: IDEMPOTENCY_TTL.UNLOCK_TICKET,
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
 * ✅ 速率限制：10次/分鐘
 */
router.post(
  "/api/unlock-tickets/use/video",
  requireFirebaseAuth,
  purchaseRateLimiter, // 解鎖卡使用操作，限制 10次/分鐘
  requireParams(["requestId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { requestId } = req.body;

    const idempotencyKey = requestId || `unlock-video:${userId}:${Date.now()}`;

    // ✅ P2-2 修復：使用集中配置的 TTL
    const result = await handleIdempotentRequest(
      idempotencyKey,
      async () => {
        return await useVideoUnlockCard(userId);
      },
      {
        ttl: IDEMPOTENCY_TTL.UNLOCK_TICKET,
      }
    );

    sendSuccess(res, result);
  })
);

/**
 * 獲取解鎖券餘額
 * GET /api/unlock-tickets/balance/:ticketType
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/unlock-tickets/balance/:ticketType",
  requireFirebaseAuth,
  relaxedRateLimiter, // 讀取操作，限制 60次/分鐘
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
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get(
  "/api/unlock-tickets/balances",
  requireFirebaseAuth,
  relaxedRateLimiter, // 讀取操作，限制 60次/分鐘
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const balances = await getAllTicketBalances(userId);
    sendSuccess(res, balances);
  })
);

/**
 * 獲取活躍的解鎖效果（未過期的解鎖）
 * GET /api/unlock-tickets/active
 * ✅ 速率限制：60次/分鐘（讀取操作）
 *
 * 返回格式：
 * {
 *   unlocks: [
 *     {
 *       unlockType: 'character',
 *       characterId: 'match-001',
 *       activatedAt: '2025-11-20T10:00:00.000Z', // 生效時間
 *       expiresAt: '2025-11-27T10:00:00.000Z',   // 到期時間
 *       unlockDays: 7,                            // 解鎖天數
 *       unlockedBy: 'ticket' | 'vvip' | 'purchase',
 *       permanent: false,
 *       remainingDays: 5                          // 剩餘天數
 *     }
 *   ]
 * }
 */
router.get(
  "/api/unlock-tickets/active",
  requireFirebaseAuth,
  relaxedRateLimiter, // 讀取操作，限制 60次/分鐘
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;

    // 動態導入服務函數（避免循環依賴）
    const { getUserUnlockedCharacters } = await import("./unlockTickets.service.js");

    // 獲取用戶已解鎖的角色列表（自動過濾過期的）
    const unlockedCharacters = await getUserUnlockedCharacters(userId);

    // 轉換為前端期望的格式
    const unlocks = unlockedCharacters.map((unlock) => ({
      unlockType: 'character',
      characterId: unlock.characterId,
      activatedAt: unlock.unlockedAt, // ✅ 生效時間（用於前端顯示）
      expiresAt: unlock.expiresAt,
      unlockDays: unlock.unlockDays,
      unlockedBy: unlock.unlockedBy || 'ticket',
      permanent: unlock.permanent || false,
      remainingDays: unlock.remainingDays,
    }));

    sendSuccess(res, { unlocks });
  })
);

export default router;
