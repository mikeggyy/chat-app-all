import { Router } from "express";
import logger from "../../utils/logger.js";
import { requireFirebaseAuth } from "../../auth/firebaseAuth.middleware.js";
import { validateRequest } from "../../middleware/validation.middleware.js";
import { characterCreationSchemas } from "../characterCreation.schemas.js";
import {
  sendSuccess,
  sendError,
} from "../../../shared/utils/errorFormatter.js";
import { getCreationFlow } from "../characterCreation.service.js";
import {
  getUserGenerationLogs,
  getGenerationLog,
  getFlowGenerationLog,
  getAllGenerationLogs,
} from "../generationLog.service.js";
import { trimString } from "../characterCreation.helpers.js";

const generationLogsRouter = Router();

// GET /generation-logs/user/:userId - 查詢用戶的生成記錄
generationLogsRouter.get(
  "/generation-logs/user/:userId",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.userGenerationLogs),
  (req, res, next) => {
    try {
      const currentUserId = req.firebaseUser.uid;
      const requestedUserId = trimString(req.params.userId);
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;

      if (!requestedUserId) {
        return sendError(res, "VALIDATION_ERROR", "缺少用戶ID", {
          field: "userId",
        });
      }

      // 🔒 驗證權限：用戶只能查看自己的記錄
      if (requestedUserId !== currentUserId) {
        return sendError(res, "FORBIDDEN", "無權查看他人的生成記錄", {
          requestedUserId,
        });
      }

      const logs = getUserGenerationLogs(requestedUserId, { limit, offset });
      sendSuccess(res, { logs, count: logs.length });
    } catch (error) {
      logger.error("查詢用戶生成記錄失敗:", error);
      next(error);
    }
  }
);

// GET /generation-logs/:logId - 查詢單個生成記錄
generationLogsRouter.get(
  "/generation-logs/:logId",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.generationLog),
  (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;
      const logId = trimString(req.params.logId);
      if (!logId) {
        return sendError(res, "VALIDATION_ERROR", "缺少記錄ID", {
          field: "logId",
        });
      }

      const log = getGenerationLog(logId);
      if (!log) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到生成記錄", {
          logId,
        });
      }

      // 🔒 驗證權限：用戶只能查看自己的記錄
      if (log.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權查看他人的生成記錄", { logId });
      }

      sendSuccess(res, { log });
    } catch (error) {
      logger.error("查詢生成記錄失敗:", error);
      next(error);
    }
  }
);

// GET /generation-logs/flow/:flowId - 查詢流程的生成記錄
generationLogsRouter.get(
  "/generation-logs/flow/:flowId",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.flowGenerationLog),
  async (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;
      const flowId = trimString(req.params.flowId);
      if (!flowId) {
        return sendError(res, "VALIDATION_ERROR", "缺少流程ID", {
          field: "flowId",
        });
      }

      // 🔒 驗證權限：檢查 flow 所有權
      const flow = await getCreationFlow(flowId);
      if (!flow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", { flowId });
      }

      if (flow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權查看此流程的生成記錄", { flowId });
      }

      const log = getFlowGenerationLog(flowId);
      if (!log) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到流程的生成記錄", {
          flowId,
        });
      }

      sendSuccess(res, { log });
    } catch (error) {
      logger.error("查詢流程生成記錄失敗:", error);
      next(error);
    }
  }
);

// GET /generation-logs - 查詢所有生成記錄（管理用）
// TODO: 後續需要添加管理員權限驗證
generationLogsRouter.get(
  "/generation-logs",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.allGenerationLogs),
  (req, res, next) => {
    try {
      // 🔒 基礎認證：目前只要求登入，未來可添加管理員權限檢查
      const userId = req.firebaseUser.uid;

      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      const status = trimString(req.query.status) || null;

      const result = getAllGenerationLogs({ limit, offset, status });
      sendSuccess(res, result);
    } catch (error) {
      logger.error("查詢生成記錄失敗:", error);
      next(error);
    }
  }
);

export { generationLogsRouter };
