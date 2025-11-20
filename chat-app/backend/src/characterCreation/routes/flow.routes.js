import { Router } from "express";
import logger from "../../utils/logger.js";
import { requireFirebaseAuth } from "../../auth/firebaseAuth.middleware.js";
import { validateRequest } from "../../middleware/validation.middleware.js";
import { characterCreationSchemas } from "../characterCreation.schemas.js";
import {
  sendSuccess,
  sendError,
} from "../../../shared/utils/errorFormatter.js";
import {
  createCreationFlow,
  getCreationFlow,
  mergeCreationFlow,
  recordCreationCharge,
} from "../characterCreation.service.js";
import { trimString } from "../characterCreation.helpers.js";
import { standardRateLimiter, purchaseRateLimiter } from "../../middleware/rateLimiterConfig.js";

const flowRouter = Router();

// POST /flows - 創建流程
flowRouter.post(
  "/flows",
  requireFirebaseAuth,
  standardRateLimiter, // 創建操作，限制 30次/分鐘
  validateRequest(characterCreationSchemas.createFlow),
  async (req, res, next) => {
    try {
      // 🔒 從認證 token 獲取 userId，防止偽造
      const userId = req.firebaseUser.uid;

      // 添加調試日誌：檢查請求體
      if (process.env.NODE_ENV !== "test") {
        logger.info(`[Create Flow] Raw request body: ${JSON.stringify(req.body).substring(0, 500)}`);
        logger.info(`[Create Flow] Request body details:`, {
          bodyKeys: Object.keys(req.body || {}),
          hasAppearance: !!req.body?.appearance,
          appearanceType: typeof req.body?.appearance,
          appearanceKeys: req.body?.appearance ? Object.keys(req.body.appearance) : [],
          hasDescription: !!req.body?.appearance?.description,
          descriptionLength: req.body?.appearance?.description?.length || 0,
          descriptionPreview: req.body?.appearance?.description?.substring(0, 50) || '',
          hasStyles: !!req.body?.appearance?.styles,
          stylesCount: req.body?.appearance?.styles?.length || 0,
        });
      }

      const flow = await createCreationFlow({
        userId,
        persona: req.body?.persona,
        appearance: req.body?.appearance,
        voice: req.body?.voice,
        status: req.body?.status,
        metadata: req.body?.metadata,
      });

      // 添加調試日誌：檢查創建後的 flow
      if (process.env.NODE_ENV !== "test") {
        logger.info(`[Create Flow] Flow created:`, {
          flowId: flow.id,
          hasAppearance: !!flow.appearance,
          hasDescription: !!flow.appearance?.description,
          descriptionLength: flow.appearance?.description?.length || 0,
        });
      }

      sendSuccess(res, { flow }, 201);
    } catch (error) {
      logger.error("建立角色創建流程失敗:", error);
      next(error);
    }
  }
);

// GET /flows/:flowId - 獲取流程
flowRouter.get(
  "/flows/:flowId",
  requireFirebaseAuth,
  validateRequest(characterCreationSchemas.getFlow),
  async (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;
      const flow = await getCreationFlow(req.params.flowId);

      if (!flow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", {
          flowId: req.params.flowId,
        });
      }

      // 🔒 驗證用戶只能訪問自己的創建流程
      if (flow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權訪問此創建流程", {
          flowId: req.params.flowId,
        });
      }

      sendSuccess(res, { flow });
    } catch (error) {
      logger.error("查詢角色創建流程失敗:", error);
      next(error);
    }
  }
);

// PATCH /flows/:flowId - 更新流程
flowRouter.patch(
  "/flows/:flowId",
  requireFirebaseAuth,
  standardRateLimiter, // 更新操作，限制 30次/分鐘
  validateRequest(characterCreationSchemas.updateFlow),
  async (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;
      const existingFlow = await getCreationFlow(req.params.flowId);

      if (!existingFlow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", {
          flowId: req.params.flowId,
        });
      }

      // 🔒 驗證用戶只能更新自己的創建流程
      if (existingFlow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權更新此創建流程", {
          flowId: req.params.flowId,
        });
      }

      const flow = await mergeCreationFlow(req.params.flowId, req.body ?? {});
      sendSuccess(res, { flow });
    } catch (error) {
      logger.error("更新角色創建流程失敗:", error);
      next(error);
    }
  }
);

// POST /flows/:flowId/steps/:stepId - 更新步驟
flowRouter.post(
  "/flows/:flowId/steps/:stepId",
  requireFirebaseAuth,
  standardRateLimiter, // 更新操作，限制 30次/分鐘
  validateRequest(characterCreationSchemas.updateStep),
  async (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;
      const step = trimString(req.params.stepId).toLowerCase();
      const flowId = req.params.flowId;

      if (!step) {
        return sendError(res, "VALIDATION_ERROR", "缺少步驟識別碼", {
          field: "stepId",
        });
      }

      // 🔒 驗證權限
      const currentFlow = await getCreationFlow(flowId);
      if (!currentFlow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", { flowId });
      }

      if (currentFlow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權訪問此創建流程", { flowId });
      }

      let payload = null;

      if (step === "persona") {
        payload = { persona: req.body ?? {} };
      } else if (step === "appearance") {
        payload = { appearance: req.body ?? {} };

        // 添加調試日誌
        if (process.env.NODE_ENV !== "test") {
          logger.info(`[Update Step] Appearance data:`, {
            hasDescription: !!req.body?.description,
            descriptionLength: req.body?.description?.length || 0,
            hasStyles: !!req.body?.styles,
            stylesCount: req.body?.styles?.length || 0,
          });
        }
      } else if (step === "voice") {
        payload = { voice: req.body ?? {} };
      } else {
        return sendError(res, "RESOURCE_NOT_FOUND", "未知的角色創建步驟", {
          step,
          validSteps: ["persona", "appearance", "voice"],
        });
      }

      const flow = await mergeCreationFlow(flowId, payload);

      // 添加調試日誌：檢查保存後的 flow
      if (step === "appearance" && process.env.NODE_ENV !== "test") {
        logger.info(`[Update Step] Flow after merge:`, {
          hasAppearance: !!flow.appearance,
          hasDescription: !!flow.appearance?.description,
          descriptionLength: flow.appearance?.description?.length || 0,
        });
      }

      sendSuccess(res, { flow });
    } catch (error) {
      logger.error("更新創建步驟失敗:", error);
      next(error);
    }
  }
);

// POST /flows/:flowId/charges - 記錄收費
flowRouter.post(
  "/flows/:flowId/charges",
  requireFirebaseAuth,
  purchaseRateLimiter, // 收費操作，使用購買限制（10次/分鐘）
  validateRequest(characterCreationSchemas.recordCharge),
  async (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;
      const flowId = req.params.flowId;

      // 🔒 驗證權限
      const currentFlow = await getCreationFlow(flowId);
      if (!currentFlow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", { flowId });
      }

      if (currentFlow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權訪問此創建流程", { flowId });
      }

      const idempotencyKey =
        trimString(req.get("Idempotency-Key")) ||
        trimString(req.body?.idempotencyKey) ||
        null;

      const payload = {
        ...req.body,
        idempotencyKey,
      };

      const { flow, charge } = await recordCreationCharge(
        flowId,
        payload
      );

      sendSuccess(res, { flow, charge }, 201);
    } catch (error) {
      logger.error("記錄生成費用失敗:", error);
      next(error);
    }
  }
);

// POST /flows/:flowId/cleanup-images - 清理圖片
flowRouter.post(
  "/flows/:flowId/cleanup-images",
  requireFirebaseAuth,
  standardRateLimiter, // 清理操作，限制 30次/分鐘
  validateRequest(characterCreationSchemas.cleanupImages),
  async (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;
      const { flowId } = req.params;
      const { selectedImageUrl, allImages } = req.body;

      if (!flowId) {
        return sendError(res, "VALIDATION_ERROR", "缺少 flowId 參數", {
          field: "flowId",
        });
      }

      // 🔒 驗證權限
      const flow = await getCreationFlow(flowId);
      if (!flow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", { flowId });
      }

      if (flow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權操作此創建流程", { flowId });
      }

      if (!selectedImageUrl) {
        return sendError(res, "VALIDATION_ERROR", "缺少 selectedImageUrl 參數", {
          field: "selectedImageUrl",
        });
      }

      if (!Array.isArray(allImages) || allImages.length === 0) {
        return sendError(res, "VALIDATION_ERROR", "allImages 必須是非空陣列", {
          field: "allImages",
          providedType: Array.isArray(allImages) ? "empty array" : typeof allImages,
        });
      }

      logger.info(`[圖片清理] 開始清理 flowId=${flowId} 的未選中圖片`);
      logger.info(`[圖片清理] 選中的圖片: ${selectedImageUrl}`);
      logger.info(`[圖片清理] 所有圖片數量: ${allImages.length}`);

      // 找出未選中的圖片
      const unselectedImages = allImages.filter(url => url !== selectedImageUrl);

      logger.info(`[圖片清理] 需要刪除的圖片數量: ${unselectedImages.length}`);

      if (unselectedImages.length === 0) {
        return sendSuccess(res, {
          deleted: 0,
          message: "沒有需要刪除的圖片"
        });
      }

      // 動態導入 deleteImage 函數以避免循環依賴
      const { deleteImage } = await import("../../firebase/storage.service.js");

      // 刪除所有未選中的圖片
      const deleteResults = await Promise.allSettled(
        unselectedImages.map(async (url) => {
          try {
            await deleteImage(url);
            logger.info(`[圖片清理] 成功刪除: ${url}`);
            return { url, success: true };
          } catch (error) {
            logger.error(`[圖片清理] 刪除失敗: ${url}`, error);
            return { url, success: false, error: error.message };
          }
        })
      );

      // 統計刪除結果
      const successCount = deleteResults.filter(r => r.status === "fulfilled" && r.value.success).length;
      const failCount = deleteResults.length - successCount;

      logger.info(`[圖片清理] 刪除完成: 成功 ${successCount} 個，失敗 ${failCount} 個`);

      sendSuccess(res, {
        deleted: successCount,
        failed: failCount,
        total: unselectedImages.length,
        message: `成功刪除 ${successCount} 張未選中的圖片`
      });
    } catch (error) {
      logger.error("[圖片清理] 清理失敗:", error);
      next(error);
    }
  }
);

// POST /flows/:flowId/cancel - 取消流程
flowRouter.post(
  "/flows/:flowId/cancel",
  requireFirebaseAuth,
  standardRateLimiter, // 取消操作，限制 30次/分鐘
  validateRequest(characterCreationSchemas.cancelFlow),
  async (req, res, next) => {
    try {
      const userId = req.firebaseUser.uid;
      const { flowId } = req.params;

      if (!flowId) {
        return sendError(res, "VALIDATION_ERROR", "缺少 flowId 參數", {
          field: "flowId",
        });
      }

      // 獲取 flow 資料
      const flow = await getCreationFlow(flowId);
      if (!flow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", {
          flowId,
        });
      }

      // 🔒 驗證權限
      if (flow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權取消此創建流程", { flowId });
      }

      logger.info(`[取消創建] 開始處理 flowId=${flowId} 的取消請求`);

      // 獲取所有生成的圖片
      const generatedImages = flow.generation?.result?.images || [];

      if (generatedImages.length > 0) {
        logger.info(`[取消創建] 需要刪除 ${generatedImages.length} 張生成的圖片`);

        // 動態導入 deleteImage 函數
        const { deleteImage } = await import("../../firebase/storage.service.js");

        // 刪除所有生成的圖片
        const deleteResults = await Promise.allSettled(
          generatedImages.map(async (image) => {
            const url = typeof image === 'string' ? image : image.url;
            try {
              await deleteImage(url);
              logger.info(`[取消創建] 成功刪除圖片: ${url}`);
              return { url, success: true };
            } catch (error) {
              logger.error(`[取消創建] 刪除圖片失敗: ${url}`, error);
              return { url, success: false, error: error.message };
            }
          })
        );

        // 統計刪除結果
        const successCount = deleteResults.filter(r => r.status === "fulfilled" && r.value.success).length;
        const failCount = deleteResults.length - successCount;

        logger.info(`[取消創建] 圖片刪除完成: 成功 ${successCount} 個，失敗 ${failCount} 個`);
      } else {
        logger.info(`[取消創建] 沒有生成的圖片需要刪除`);
      }

      // 更新 flow 狀態為 cancelled
      const updatedFlow = await mergeCreationFlow(flowId, {
        status: "cancelled",
      });

      logger.info(`[取消創建] 流程已標記為已取消: ${flowId}`);

      sendSuccess(res, {
        flow: updatedFlow,
        deletedImages: generatedImages.length,
        message: "角色創建已取消，生成的圖片已清理",
      });
    } catch (error) {
      logger.error("[取消創建] 處理失敗:", error);
      next(error);
    }
  }
);

export { flowRouter };
