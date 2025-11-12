/**
 * 廣告系統 API 路由 - 修復版本
 * 修復內容：
 * ✅ 領取廣告獎勵添加冪等性保護
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import {
  sendSuccess,
  sendError,
  asyncHandler,
  requireOwnership,
  requireParams,
} from "../utils/routeHelpers.js";
import {
  requestAdWatch,
  verifyAdWatched,
  claimAdReward,
  checkDailyAdLimit,
  getAdStats,
} from "./ad.service.js";
import { handleIdempotentRequest } from "../utils/idempotency.js";

const router = express.Router();

/**
 * 請求觀看廣告
 * POST /api/ads/watch
 * Body: { characterId, adType?: "rewarded_ad" | "interstitial_ad" }
 * 🔒 安全：userId 從認證 token 自動獲取
 */
router.post(
  "/api/ads/watch",
  requireFirebaseAuth,
  requireParams(["characterId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { characterId, adType } = req.body;
    const adRequest = await requestAdWatch(userId, characterId, adType);
    sendSuccess(res, adRequest);
  })
);

/**
 * 驗證廣告已觀看
 * POST /api/ads/verify
 * Body: { adId, verificationToken? }
 * 🔒 安全：userId 從認證 token 自動獲取
 */
router.post(
  "/api/ads/verify",
  requireFirebaseAuth,
  requireParams(["adId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { adId, verificationToken } = req.body;
    const result = await verifyAdWatched(userId, adId, verificationToken);
    sendSuccess(res, result);
  })
);

/**
 * 領取廣告獎勵
 * POST /api/ads/claim
 * Body: { adId }
 * 🔒 安全：userId 從認證 token 自動獲取
 * ✅ 修復：添加冪等性保護
 */
router.post(
  "/api/ads/claim",
  requireFirebaseAuth,
  requireParams(["adId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { adId } = req.body;

    // ✅ 修復：使用 adId 作為冪等性 key（因為每個廣告只能領取一次）
    const requestId = `ad-reward:${userId}:${adId}`;

    const result = await handleIdempotentRequest(
      requestId,
      async () => {
        return await claimAdReward(userId, adId);
      },
      {
        ttl: 10 * 60 * 1000, // 10 分鐘 TTL
      }
    );

    sendSuccess(res, {
      message: result.alreadyClaimed ? "廣告獎勵已經領取過" : "成功領取廣告獎勵",
      ...result,
    });
  })
);

/**
 * 檢查每日廣告觀看限制
 * GET /api/ads/limit
 * 🔒 安全：userId 從認證 token 自動獲取
 */
router.get(
  "/api/ads/limit",
  requireFirebaseAuth,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const limit = await checkDailyAdLimit(userId);
    sendSuccess(res, limit);
  })
);

/**
 * 獲取用戶廣告統計
 * GET /api/ads/stats
 * 🔒 安全：userId 從認證 token 自動獲取
 */
router.get(
  "/api/ads/stats",
  requireFirebaseAuth,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const stats = await getAdStats(userId);
    sendSuccess(res, {
      userId,
      ...stats,
    });
  })
);

export default router;
