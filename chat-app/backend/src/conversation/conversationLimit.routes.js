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

export default router;
