/**
 * 廣告系統 API 路由
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
    const result = verifyAdWatched(userId, adId, verificationToken);
    sendSuccess(res, result);
  })
);

/**
 * 領取廣告獎勵
 * POST /api/ads/claim
 * Body: { adId }
 * 🔒 安全：userId 從認證 token 自動獲取
 */
router.post(
  "/api/ads/claim",
  requireFirebaseAuth,
  requireParams(["adId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { adId } = req.body;
    const result = await claimAdReward(userId, adId);
    sendSuccess(res, {
      message: "成功領取廣告獎勵",
      ...result,
    });
  })
);

/**
 * 檢查每日廣告觀看限制
 * GET /api/ads/limit/:userId
 */
router.get(
  "/api/ads/limit/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const limit = checkDailyAdLimit(userId);
    sendSuccess(res, limit);
  })
);

/**
 * 獲取用戶廣告統計
 * GET /api/ads/stats/:userId
 */
router.get(
  "/api/ads/stats/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const stats = getAdStats(userId);
    sendSuccess(res, {
      userId,
      ...stats,
    });
  })
);

export default router;
