/**
 * 語音限制 API 路由
 * 掛載路徑：/api/voice-limit
 */

import { requireFirebaseAuth } from "../auth/index.js";
import {
  voiceLimitService,
  unlockByAd,
  canPlayVoice,
} from "./voiceLimit.service.js";
import createLimitRouter from "../utils/createLimitRouter.js";
import {
  sendSuccess,
  sendError,
  asyncHandler,
  requireOwnership,
  requireParams,
  getLimitErrorStatus,
} from "../utils/routeHelpers.js";

// 使用工廠函數創建標準路由（stats, reset）
// ⚠️ 跳過 check 路由的創建，使用下面的自定義邏輯
export const voiceLimitRouter = createLimitRouter({
  service: voiceLimitService,
  options: {
    perCharacter: true,
    publicCheck: true,
    publicStats: false,
    skipCheck: true,  // ✅ 跳過默認 check 路由
    resourceName: "語音",
  },
});

// ==================== 自定義路由 ====================

/**
 * 檢查語音播放權限（自定義邏輯）
 * GET /api/voice-limit/:userId/:characterId/check
 * 使用 canPlayVoice 以包含語音解鎖卡邏輯
 */
voiceLimitRouter.get(
  "/:userId/:characterId/check",
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;

    try {
      const result = await canPlayVoice(userId, characterId);
      sendSuccess(res, result);
    } catch (error) {
      const status = getLimitErrorStatus(error);
      sendError(res, error, status);
    }
  })
);

// ==================== 特定路由（保留） ====================

/**
 * 使用語音解鎖卡
 * POST /api/voice-limit/:userId/:characterId/use-unlock-card
 * 🔒 安全增強：需要認證，並驗證 userId 所有權
 */
voiceLimitRouter.post(
  "/:userId/:characterId/use-unlock-card",
  requireFirebaseAuth,
  requireOwnership("userId"),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;

    try {
      // 導入 useVoiceUnlockCard 函數
      const { useVoiceUnlockCard } = await import("../membership/unlockTickets.service.js");

      const result = await useVoiceUnlockCard(userId, characterId);
      sendSuccess(res, {
        message: "語音解鎖卡使用成功",
        userId,
        characterId,
        ...result,
      });
    } catch (error) {
      const status = getLimitErrorStatus(error);
      sendError(res, error, status);
    }
  })
);

/**
 * 透過觀看廣告解鎖語音次數
 * POST /api/voice-limit/:userId/:characterId/unlock-by-ad
 * Body: { adId }
 */
voiceLimitRouter.post(
  "/:userId/:characterId/unlock-by-ad",
  requireFirebaseAuth,
  requireOwnership("userId"),
  requireParams(["adId"], "body"),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;
    const { adId } = req.body;

    try {
      const result = await unlockByAd(userId, characterId, adId);
      sendSuccess(res, {
        userId,
        characterId,
        ...result,
      });
    } catch (error) {
      const status = getLimitErrorStatus(error);
      sendError(res, error, status);
    }
  })
);

export default voiceLimitRouter;
