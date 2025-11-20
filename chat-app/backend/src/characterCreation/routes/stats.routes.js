import { Router } from "express";
import logger from "../../utils/logger.js";
import { requireFirebaseAuth } from "../../auth/firebaseAuth.middleware.js";
import { validateRequest } from "../../middleware/validation.middleware.js";
import { characterCreationSchemas } from "../characterCreation.schemas.js";
import {
  sendSuccess,
  sendError,
} from "../../../shared/utils/errorFormatter.js";
import { getGenerationStats } from "../generationLog.service.js";
import {
  canCreateCharacter,
  getCreationStats,
} from "../characterCreationLimit.service.js";
import { consumeUserAsset } from "../../user/assets.service.js";
import { trimString } from "../characterCreation.helpers.js";

const statsRouter = Router();

// GET /generation-stats - 查詢所有生成統計
// TODO: 後續需要添加管理員權限驗證
statsRouter.get(
  "/generation-stats",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.generationStats),
  (req, res, next) => {
    try {
      // 🔒 基礎認證：目前只要求登入，未來可添加管理員權限檢查
      const userId = req.firebaseUser.uid;

      const stats = getGenerationStats(null);
      sendSuccess(res, { stats });
    } catch (error) {
      logger.error("查詢生成統計失敗:", error);
      next(error);
    }
  }
);

// GET /generation-stats/user/:userId - 查詢指定用戶的生成統計
statsRouter.get(
  "/generation-stats/user/:userId",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.userGenerationStats),
  (req, res, next) => {
    try {
      const currentUserId = req.firebaseUser.uid;
      const requestedUserId = trimString(req.params.userId);
      if (!requestedUserId) {
        return sendError(res, "VALIDATION_ERROR", "缺少用戶ID", {
          field: "userId",
        });
      }

      // 🔒 驗證權限：用戶只能查看自己的統計
      if (requestedUserId !== currentUserId) {
        return sendError(res, "FORBIDDEN", "無權查看他人的生成統計", {
          requestedUserId,
        });
      }

      const stats = getGenerationStats(requestedUserId);
      sendSuccess(res, { stats });
    } catch (error) {
      logger.error("查詢生成統計失敗:", error);
      next(error);
    }
  }
);

// GET /limits/:userId - 查詢角色創建限制
statsRouter.get(
  "/limits/:userId",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.limits),
  async (req, res, next) => {
    try {
      const currentUserId = req.firebaseUser.uid;
      const requestedUserId = trimString(req.params.userId);
      if (!requestedUserId) {
        return sendError(res, "VALIDATION_ERROR", "缺少用戶ID", {
          field: "userId",
        });
      }

      // 🔒 驗證權限：用戶只能查看自己的限制
      if (requestedUserId !== currentUserId) {
        return sendError(res, "FORBIDDEN", "無權查看他人的創建限制", {
          requestedUserId,
        });
      }

      const limitCheck = await canCreateCharacter(requestedUserId);
      const creationStats = await getCreationStats(requestedUserId);

      if (process.env.NODE_ENV !== "test") {
        logger.info(`[創建角色限制] 用戶 ${requestedUserId} 查詢限制:`, {
          limitCheck,
          creationStats,
        });
      }

      sendSuccess(res, {
        limit: limitCheck,
        stats: creationStats,
        remainingFreeCreations: creationStats.remaining || 0,
      });
    } catch (error) {
      logger.error("查詢角色創建限制失敗:", error);
      next(error);
    }
  }
);

// POST /use-create-card - 使用創建角色卡
// 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人創建卡
statsRouter.post(
  "/use-create-card",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.useCreateCard),
  async (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;

      logger.info(`[創建角色卡] 用戶 ${userId} 請求使用創建卡`);

      // 扣除一張創建卡（會自動檢查數量）
      const result = await consumeUserAsset(userId, "createCards", 1);

      logger.info(`[創建角色卡] 用戶 ${userId} 成功使用了 1 張創建角色卡`);

      sendSuccess(res, {
        message: "成功使用創建角色卡",
        remainingCards: result.createCards || 0,
        deducted: 1,
      });
    } catch (error) {
      logger.error("使用創建角色卡失敗:", error);
      next(error);
    }
  }
);

export { statsRouter };
