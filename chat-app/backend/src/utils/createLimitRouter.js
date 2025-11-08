/**
 * 限制路由工廠函數
 * 統一創建各種限制服務的標準路由
 */

import { Router } from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { requireAdmin } from "../middleware/adminAuth.middleware.js";
import {
  sendSuccess,
  sendError,
  asyncHandler,
  requireOwnership,
  requireParams,
  getLimitErrorStatus,
} from "./routeHelpers.js";

/**
 * 創建限制路由
 * @param {Object} config - 路由配置
 * @param {Object} config.service - 限制服務物件
 * @param {Function} config.service.canUse - 檢查是否可以使用
 * @param {Function} config.service.getStats - 獲取統計資訊
 * @param {Function} config.service.reset - 重置限制
 * @param {Object} config.options - 路由選項
 * @param {boolean} config.options.perCharacter - 是否按角色追蹤（預設 false）
 * @param {boolean} config.options.publicCheck - check 路由是否公開（不需要驗證，預設 true）
 * @param {boolean} config.options.publicStats - stats 路由是否公開（不需要驗證，預設 false）
 * @param {boolean} config.options.skipCheck - 跳過創建 check 路由（預設 false），用於自定義 check 邏輯
 * @param {boolean} config.options.skipStats - 跳過創建 stats 路由（預設 false），用於自定義 stats 邏輯
 * @param {string} config.options.resourceName - 資源名稱（用於日誌和錯誤訊息）
 * @returns {Router} Express Router 實例
 *
 * @example
 * // 按角色追蹤的服務（對話、語音）
 * const router = createLimitRouter({
 *   service: conversationLimitService,
 *   options: {
 *     perCharacter: true,
 *     publicCheck: true,
 *     resourceName: '對話'
 *   }
 * });
 *
 * @example
 * // 全局追蹤的服務（拍照），跳過 check 和 stats 路由以使用自定義邏輯
 * const router = createLimitRouter({
 *   service: photoLimitService,
 *   options: {
 *     perCharacter: false,
 *     publicCheck: false,
 *     skipCheck: true,  // 跳過默認 check 路由
 *     skipStats: true,  // 跳過默認 stats 路由
 *     resourceName: '拍照'
 *   }
 * });
 */
export function createLimitRouter({ service, options = {} }) {
  const {
    perCharacter = false,
    publicCheck = true,
    publicStats = false,
    skipCheck = false,
    skipStats = false,
    resourceName = "資源",
  } = options;

  const router = Router();

  // ==================== 檢查路由 ====================

  if (!skipCheck) {

  if (perCharacter) {
    if (publicCheck) {
      /**
       * 檢查用戶與特定角色的使用限制（公開）
       * GET /:userId/:characterId/check
       */
      router.get(
        "/:userId/:characterId/check",
        asyncHandler(async (req, res) => {
          const { userId, characterId } = req.params;
          const check = await service.canUse(userId, characterId);

          sendSuccess(res, {
            userId,
            characterId,
            ...check,
          });
        })
      );
    } else {
      /**
       * 檢查用戶與特定角色的使用限制（需認證）
       * GET /:characterId/check
       * 🔒 安全增強：從認證 token 獲取 userId
       */
      router.get(
        "/:characterId/check",
        requireFirebaseAuth,
        asyncHandler(async (req, res) => {
          const userId = req.firebaseUser.uid;
          const { characterId } = req.params;
          const check = await service.canUse(userId, characterId);

          sendSuccess(res, {
            userId,
            characterId,
            ...check,
          });
        })
      );
    }
  } else {
    if (publicCheck) {
      /**
       * 檢查用戶的使用限制（公開）
       * GET /check/:userId
       */
      router.get(
        "/check/:userId",
        asyncHandler(async (req, res) => {
          const { userId } = req.params;

          try {
            const result = await service.canUse(userId);
            sendSuccess(res, result);
          } catch (error) {
            const status = getLimitErrorStatus(error);
            sendError(res, error, status);
          }
        })
      );
    } else {
      /**
       * 檢查用戶的使用限制（需認證）
       * GET /check
       * 🔒 安全增強：從認證 token 獲取 userId，防止查詢他人限制
       */
      router.get(
        "/check",
        requireFirebaseAuth,
        asyncHandler(async (req, res) => {
          const userId = req.firebaseUser.uid;

          try {
            const result = await service.canUse(userId);
            sendSuccess(res, result);
          } catch (error) {
            const status = getLimitErrorStatus(error);
            sendError(res, error, status);
          }
        })
      );
    }
  }
  } // end if (!skipCheck)

  // ==================== 統計路由 ====================

  if (!skipStats) {
  if (publicStats) {
    /**
     * 獲取用戶的使用統計（公開）
     * GET /:userId/stats
     */
    router.get(
      "/:userId/stats",
      asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const stats = await service.getStats(userId);

        sendSuccess(res, {
          userId,
          ...stats,
        });
      })
    );
  } else {
    /**
     * 獲取用戶的使用統計（需認證）
     * GET /stats
     * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人統計
     */
    router.get(
      "/stats",
      requireFirebaseAuth,
      asyncHandler(async (req, res) => {
        const userId = req.firebaseUser.uid;
        const stats = await service.getStats(userId);

        sendSuccess(res, {
          userId,
          ...stats,
        });
      })
    );
  }
  } // end if (!skipStats)

  // ==================== 重置路由（管理員）====================

  if (perCharacter) {
    /**
     * 重置用戶限制（管理員功能）
     * POST /:userId/reset
     * Body: { characterId? }
     */
    router.post(
      "/:userId/reset",
      requireFirebaseAuth,
      requireAdmin,
      asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { characterId } = req.body;

        try {
          const result = await service.reset(userId, characterId);
          sendSuccess(res, {
            message: `已重置用戶 ${userId} 的${resourceName}限制`,
            ...result,
          });
        } catch (error) {
          sendError(res, error, 500);
        }
      })
    );
  } else {
    /**
     * 重置用戶限制（管理員功能）
     * POST /reset
     * Body: { userId }
     */
    router.post(
      "/reset",
      requireFirebaseAuth,
      requireAdmin,
      requireParams(["userId"], "body"),
      asyncHandler(async (req, res) => {
        const { userId } = req.body;

        try {
          const result = await service.reset(userId);
          sendSuccess(res, {
            message: `已重置用戶 ${userId} 的${resourceName}限制`,
            ...result,
          });
        } catch (error) {
          sendError(res, error, 500);
        }
      })
    );
  }

  return router;
}

export default createLimitRouter;
