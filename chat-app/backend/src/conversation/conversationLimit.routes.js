/**
 * 對話次數限制 API 路由
 * 掛載路徑：/api/conversations/limit
 */

import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { conversationLimitService, recordMessage } from "./conversationLimit.service.js";
import createLimitRouter from "../utils/createLimitRouter.js";
import {
  sendSuccess,
  sendError,
  asyncHandler,
  requireOwnership,
  getLimitErrorStatus,
} from "../utils/routeHelpers.js";

// 使用工廠函數創建標準路由（check, stats, reset）
const router = createLimitRouter({
  service: conversationLimitService,
  options: {
    perCharacter: true,
    publicCheck: true,
    publicStats: false,
    resourceName: "對話",
  },
});

// ==================== 特定路由（保留） ====================

/**
 * 記錄一次對話（內部使用，由對話 API 調用）
 * POST /api/conversations/limit/:userId/:characterId/record
 */
router.post(
  "/:userId/:characterId/record",
  requireFirebaseAuth,
  requireOwnership("userId"),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;

    try {
      const result = await recordMessage(userId, characterId);
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

/**
 * 透過觀看廣告解鎖對話次數
 * POST /api/conversations/limit/:userId/:characterId/unlock-by-ad
 * Body: { adId }
 *
 * ✅ 新增：統一前後端廣告解鎖 API
 *
 * ⚠️ 注意：此端點為兼容性端點，建議前端改用完整的三步驟流程：
 * 1. POST /api/ads/watch
 * 2. POST /api/ads/verify
 * 3. POST /api/ads/claim
 */
router.post(
  "/:userId/:characterId/unlock-by-ad",
  requireFirebaseAuth,
  requireOwnership("userId"),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;
    const { adId } = req.body;

    if (!adId) {
      return sendError(res, { message: "缺少 adId 參數" }, 400);
    }

    try {
      // 直接調用廣告服務的 claimAdReward
      const { claimAdReward } = await import("../ad/ad.service.js");
      const result = await claimAdReward(userId, adId);

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

export default router;
