import { Router } from "express";
import logger from "../../utils/logger.js";
import { requireFirebaseAuth } from "../../auth/firebaseAuth.middleware.js";
import { validateRequest } from "../../middleware/validation.middleware.js";
import { characterCreationSchemas } from "../characterCreation.schemas.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import {
  getCreationFlow,
  mergeCreationFlow,
  generateCreationResult,
} from "../characterCreation.service.js";
import { isoNow, trimString } from "../characterCreation.helpers.js";
import { veryStrictRateLimiter, standardRateLimiter } from "../../middleware/rateLimiterConfig.js";

const generationRouter = Router();

// POST /flows/:flowId/generate - 生成角色
generationRouter.post(
  "/flows/:flowId/generate",
  requireFirebaseAuth,
  veryStrictRateLimiter, // AI 生成操作，使用最嚴格限制（5次/分鐘）
  validateRequest(characterCreationSchemas.generateVoice),
  async (req, res, next) => {
    const userId = req.firebaseUser.uid;
    const flowId = req.params.flowId;

    try {
      const currentFlow = await getCreationFlow(flowId);
      if (!currentFlow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", {
          flowId,
        });
      }

      // 🔒 驗證權限
      if (currentFlow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權訪問此創建流程", { flowId });
      }

      if (!currentFlow.voice || !currentFlow.voice.id) {
        return sendError(res, "VALIDATION_ERROR", "尚未選擇角色語音，無法開始生成流程", {
          flowId,
          hasVoice: !!currentFlow.voice,
        });
      }

      const requestedKey =
        trimString(req.get("Idempotency-Key")) ||
        trimString(req.body?.idempotencyKey) ||
        null;

      const chargePayload =
        req.body?.charge && typeof req.body.charge === "object"
          ? { ...req.body.charge }
          : {
              type: "llm-generation",
              amount: Number.isFinite(req.body?.chargeAmount)
                ? Number(req.body.chargeAmount)
                : 0,
              currency:
                trimString(req.body?.chargeCurrency) ||
                "credits",
              metadata:
                req.body?.chargeMetadata &&
                typeof req.body.chargeMetadata === "object"
                  ? { ...req.body.chargeMetadata }
                  : undefined,
            };

      const previewBase =
        typeof req.body?.previewBaseUrl === "string"
          ? req.body.previewBaseUrl.replace(/\/+$/, "")
          : "";

      // 準備生成輸入參數（用於記錄）
      const generationInput = {
        gender: currentFlow.metadata?.gender || "",
        description: currentFlow.appearance?.description || "",
        styles: currentFlow.appearance?.styles || [],
        referenceInfo: currentFlow.appearance?.referenceInfo || null,
      };

      const { flow, reused } = await generateCreationResult(flowId, {
        idempotencyKey: requestedKey ?? flowId,
        charge: chargePayload,
        generationInput,
        generator: async ({ flow: flowSnapshot }) => {
          const voiceId = flowSnapshot.voice?.id ?? "";
          const previewUrl = voiceId
            ? previewBase
              ? `${previewBase}/${voiceId}.mp3`
              : null
            : null;

          return {
            flowId: flowSnapshot.id,
            voice: { ...flowSnapshot.voice },
            assets: {
              previewUrl,
            },
            placeholder: true,
            generatedAt: isoNow(),
          };
        },
        statusOnStart: "generating",
        statusOnSuccess:
          trimString(req.body?.statusOnSuccess) || "completed",
        statusOnFailure:
          trimString(req.body?.statusOnFailure) || "failed",
      });

      sendSuccess(res, { flow, reused }, reused ? 200 : 201);
    } catch (error) {
      logger.error("語音生成流程失敗:", error);
      next(error);
    }
  }
);

// POST /flows/:flowId/ai-magician - AI 魔法師
generationRouter.post(
  "/flows/:flowId/ai-magician",
  requireFirebaseAuth,
  veryStrictRateLimiter, // AI Vision 調用，使用最嚴格限制（5次/分鐘）
  validateRequest(characterCreationSchemas.aiMagician),
  async (req, res, next) => {
    const userId = req.firebaseUser.uid;
    const flowId = req.params.flowId;

    try {
      const currentFlow = await getCreationFlow(flowId);
      if (!currentFlow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", {
          flowId,
        });
      }

      // 🔒 驗證權限
      if (currentFlow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權訪問此創建流程", { flowId });
      }

      // 檢查是否有選擇角色外觀（圖片）
      if (!currentFlow.appearance || !currentFlow.appearance.image) {
        return sendError(res, "VALIDATION_ERROR", "尚未選擇角色外觀,無法使用 AI 魔法師", {
          flowId,
          hasAppearance: !!currentFlow.appearance,
          hasImage: !!currentFlow.appearance?.image,
        });
      }

      const { generateCharacterPersona } = await import("../characterCreation.ai.js");

      // 從 flow 中獲取選定的照片URL、性別和風格
      const selectedImageUrl = currentFlow.appearance.image; // 用戶選擇的照片URL
      const gender = currentFlow.metadata?.gender || "";
      const styles = Array.isArray(currentFlow.appearance.styles)
        ? currentFlow.appearance.styles
        : [];

      const persona = await generateCharacterPersona({
        appearance: currentFlow.appearance,
        gender,
        styles,
        selectedImageUrl, // 傳遞選定的照片URL給 Vision API
      });

      sendSuccess(res, { persona });
    } catch (error) {
      logger.error("AI 魔法師生成失敗:", error);
      next(error);
    }
  }
);

// POST /ai-description - 生成描述
// AI 描述生成（無需 flowId，用於付款前的 AI 魔術師）
// 使用次數追蹤由前端 sessionStorage 處理
generationRouter.post(
  "/ai-description",
  requireFirebaseAuth,
  veryStrictRateLimiter, // AI 調用，使用最嚴格限制（5次/分鐘）
  validateRequest(characterCreationSchemas.aiDescription),
  async (req, res, next) => {
    try {
      // 🔒 驗證用戶已登入（不需要額外權限檢查，任何登入用戶都可使用）
      const userId = req.firebaseUser.uid;

      const gender = trimString(req.body?.gender);
      const styles = Array.isArray(req.body?.styles)
        ? req.body.styles
        : [];
      const referenceInfo = req.body?.referenceInfo || null;

      const { generateAppearanceDescription } = await import("../characterCreation.ai.js");

      const description = await generateAppearanceDescription({
        gender,
        styles,
        referenceInfo,
      });

      sendSuccess(res, { description });
    } catch (error) {
      logger.error("AI 描述生成失敗:", error);
      next(error);
    }
  }
);

// POST /flows/:flowId/ai-description - 為流程生成描述
generationRouter.post(
  "/flows/:flowId/ai-description",
  requireFirebaseAuth,
  veryStrictRateLimiter, // AI 調用，使用最嚴格限制（5次/分鐘）
  validateRequest(characterCreationSchemas.aiDescriptionWithFlow),
  async (req, res, next) => {
    const userId = req.firebaseUser.uid;
    const flowId = req.params.flowId;

    try {
      // 獲取並檢查 flow
      const flow = await getCreationFlow(flowId);
      if (!flow) {
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到角色創建流程", {
          flowId,
        });
      }

      // 🔒 驗證權限
      if (flow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權訪問此創建流程", { flowId });
      }

      // 檢查 AI 魔法師使用次數限制（每個創建流程限3次）
      const AI_MAGICIAN_LIMIT = 3;
      const usageCount = flow.metadata?.aiMagicianUsageCount || 0;

      if (usageCount >= AI_MAGICIAN_LIMIT) {
        return sendError(res, "RATE_LIMIT_EXCEEDED", `AI 魔法師使用次數已達上限（${AI_MAGICIAN_LIMIT} 次）`, {
          usageCount,
          limit: AI_MAGICIAN_LIMIT,
          flowId,
        });
      }

      const gender = trimString(req.body?.gender);
      const styles = Array.isArray(req.body?.styles)
        ? req.body.styles
        : [];
      const referenceInfo = req.body?.referenceInfo || null;

      const { generateAppearanceDescription } = await import("../characterCreation.ai.js");

      const description = await generateAppearanceDescription({
        gender,
        styles,
        referenceInfo,
      });

      // 成功生成後增加使用次數
      await mergeCreationFlow(flowId, {
        metadata: {
          ...flow.metadata,
          aiMagicianUsageCount: usageCount + 1,
        },
      });

      const newUsageCount = usageCount + 1;
      const remainingUsage = AI_MAGICIAN_LIMIT - newUsageCount;

      sendSuccess(res, {
        description,
        usageCount: newUsageCount,
        remainingUsage,
        limit: AI_MAGICIAN_LIMIT,
      });
    } catch (error) {
      logger.error("AI 魔法師生成形象描述失敗:", error);
      next(error);
    }
  }
);

// POST /flows/:flowId/generate-images - 生成圖片
generationRouter.post(
  "/flows/:flowId/generate-images",
  requireFirebaseAuth,
  veryStrictRateLimiter,
  validateRequest(characterCreationSchemas.generateImages),
  async (req, res, next) => {
    const userId = req.firebaseUser.uid;
    const flowId = req.params.flowId;

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Image Generation API] Request received for flowId: ${flowId}`);
    }

    try {
      const currentFlow = await getCreationFlow(flowId);

      if (process.env.NODE_ENV !== "test") {
        logger.debug(`[Image Generation API] Flow found:`, {
          id: currentFlow?.id,
          status: currentFlow?.status,
          hasAppearance: !!currentFlow?.appearance,
          hasDescription: !!currentFlow?.appearance?.description,
        });
      }

      if (!currentFlow) {
        if (process.env.NODE_ENV !== "test") {
          logger.error(`[Image Generation API] Flow not found: ${flowId}`);
        }
        return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色創建流程", {
          flowId,
        });
      }

      // 🔒 驗證權限
      if (currentFlow.userId !== userId) {
        return sendError(res, "FORBIDDEN", "無權訪問此創建流程", { flowId });
      }

      // 🎯 自動生成描述：如果用戶沒有提供描述，根據性別和風格自動生成
      if (!currentFlow.appearance || !currentFlow.appearance.description || currentFlow.appearance.description.trim().length === 0) {
        if (process.env.NODE_ENV !== "test") {
          logger.info(`[Image Generation API] No description provided, generating random description`);
        }

        const gender = currentFlow.metadata?.gender || "";
        const styles = currentFlow.appearance?.styles || [];

        // 生成隨機描述
        const { generateAppearanceDescription } = await import("../characterCreation.ai.js");

        try {
          const generatedDescription = await generateAppearanceDescription({
            gender,
            styles,
            referenceInfo: null,
          });

          if (process.env.NODE_ENV !== "test") {
            logger.info(`[Image Generation API] Generated description: ${generatedDescription.substring(0, 50)}...`);
          }

          // 更新 flow 的 appearance
          await mergeCreationFlow(flowId, {
            appearance: {
              ...currentFlow.appearance,
              description: generatedDescription,
            },
          });

          // 更新當前 flow 物件（用於後續生成）
          currentFlow.appearance = {
            ...currentFlow.appearance,
            description: generatedDescription,
          };

          if (process.env.NODE_ENV !== "test") {
            logger.info(`[Image Generation API] Updated flow with generated description`);
          }
        } catch (descError) {
          logger.error(`[Image Generation API] Failed to generate description:`, descError);
          return sendError(res, "INTERNAL_SERVER_ERROR", "自動生成角色描述失敗，請稍後再試", {
            flowId,
            error: descError.message,
          });
        }
      }

      // ✅ 檢查是否已經生成過圖片（一個創建流程只能生成一次）
      if (
        currentFlow.generation.status === "completed" &&
        currentFlow.generation.result?.images &&
        currentFlow.generation.result.images.length > 0
      ) {
        logger.info(`[圖片生成] 用戶 ${currentFlow.userId} 已生成過圖片，直接返回之前的結果`);
        return sendSuccess(res, {
          flow: currentFlow,
          reused: true,
          images: currentFlow.generation.result.images,
        });
      }

      // 獲取用戶 ID 並檢查創建資源
      let shouldRecordCreation = false;
      let needsCreateCard = false;

      if (userId) {
        const { canCreateCharacter, getCreationStats } = await import("../characterCreationLimit.service.js");
        const { consumeUserAsset } = await import("../../user/assets.service.js");

        const limitCheck = await canCreateCharacter(userId);
        if (!limitCheck.allowed) {
          return sendError(res, "PERMISSION_DENIED", limitCheck.message || "已達到角色創建次數限制", {
            userId,
            limit: limitCheck,
          });
        }

        // 檢查是否需要使用創建卡
        try {
          const stats = await getCreationStats(userId);

          if (stats.remaining <= 0) {
            // 免費次數用完，需要使用創建卡
            logger.info(`[圖片生成] 用戶 ${userId} 免費次數已用完（剩餘 ${stats.remaining}），將在生成成功後扣除創建卡`);
            needsCreateCard = true;
            shouldRecordCreation = true;
          } else {
            // 有免費次數
            logger.info(`[圖片生成] 用戶 ${userId} 使用免費次數（剩餘 ${stats.remaining} 次）`);
            shouldRecordCreation = true;
          }
        } catch (error) {
          logger.error(`[圖片生成] 檢查創建資源失敗: ${error.message}`);
          return sendError(res, "INTERNAL_SERVER_ERROR", "檢查創建資源失敗", {
            userId,
            error: error.message,
          });
        }
      }

      const requestedKey =
        trimString(req.get("Idempotency-Key")) ||
        trimString(req.body?.idempotencyKey) ||
        null;

      const quality = trimString(req.body?.quality) || "high";
      const count = Number(req.body?.count) || 4;

      const chargePayload =
        req.body?.charge && typeof req.body.charge === "object"
          ? { ...req.body.charge }
          : {
              type: "image-generation",
              amount: Number.isFinite(req.body?.chargeAmount)
                ? Number(req.body.chargeAmount)
                : 0,
              currency:
                trimString(req.body?.chargeCurrency) ||
                "credits",
              metadata:
                req.body?.chargeMetadata &&
                typeof req.body.chargeMetadata === "object"
                  ? { ...req.body.chargeMetadata }
                  : undefined,
            };

      // 準備生成輸入參數（用於記錄）
      const generationInput = {
        gender: currentFlow.metadata?.gender || "",
        description: currentFlow.appearance?.description || "",
        styles: currentFlow.appearance?.styles || [],
        referenceInfo: currentFlow.appearance?.referenceInfo || null,
      };

      const { flow, reused } = await generateCreationResult(flowId, {
        idempotencyKey: requestedKey ?? `${flowId}-images`,
        charge: chargePayload,
        generationInput,
        generator: async ({ flow: flowSnapshot }) => {
          const { generateCharacterImages } = await import("../characterCreation.ai.js");

          const result = await generateCharacterImages({
            gender: flowSnapshot.metadata?.gender || "",
            description: flowSnapshot.appearance?.description || "",
            styles: flowSnapshot.appearance?.styles || [],
            referenceInfo: flowSnapshot.appearance?.referenceInfo || null,
            quality,
            count,
            flowId: flowSnapshot.id,
            userId: flowSnapshot.userId,
          });

          return {
            flowId: flowSnapshot.id,
            images: result.images,
            prompt: result.prompt,
            metadata: result.metadata,
            generatedAt: isoNow(),
          };
        },
        statusOnStart: "generating",
        statusOnSuccess:
          trimString(req.body?.statusOnSuccess) || "appearance",
        statusOnFailure:
          trimString(req.body?.statusOnFailure) || "failed",
      });

      // 生成成功後扣除創建卡並重置 AI 魔術師使用次數
      if (!reused && userId && shouldRecordCreation) {
        const { consumeUserAsset } = await import("../../user/assets.service.js");
        const { getFirestoreDb } = await import("../../firebase/index.js");

        // 步驟 1: 使用 Transaction 原子性地設置標記（防止並發覆蓋）
        const db = getFirestoreDb();
        const flowRef = db.collection("character_creation_flows").doc(flowId);

        let latestFlowMetadata;
        try {
          await db.runTransaction(async (transaction) => {
            const flowDoc = await transaction.get(flowRef);

            if (!flowDoc.exists) {
              throw new Error('創建流程不存在');
            }

            const flowData = flowDoc.data();
            const currentMetadata = flowData.metadata || {};

            // ⚠️ 檢查是否已經標記為已扣除
            if (currentMetadata.deductedOnImageGeneration === true) {
              throw new Error('此流程已經扣除過創建卡，請勿重複提交');
            }

            // 原子性地設置標記
            const newMetadata = {
              ...currentMetadata,
              aiMagicianUsageCount: 0,
              deductedOnImageGeneration: needsCreateCard,
            };

            transaction.update(flowRef, {
              metadata: newMetadata,
              updatedAt: new Date().toISOString(),
            });

            latestFlowMetadata = newMetadata;
          });

          logger.info(`[圖片生成] 成功設置扣除標記，needsCreateCard: ${needsCreateCard}`);
        } catch (transactionError) {
          logger.error("[圖片生成] 設置扣除標記失敗:", transactionError);
          throw new Error(transactionError.message || "設置扣除標記失敗，請重試");
        }

        // 步驟 2: 扣除資源（免費次數或創建卡）
        try {
          if (needsCreateCard) {
            // 2.1 免費次數用完，扣除創建卡
            await consumeUserAsset(userId, "createCards", 1);
            logger.info(`[圖片生成] 用戶 ${userId} 成功扣除 1 張創建卡`);
          } else {
            // 2.2 有免費次數，扣除免費次數
            const { recordCreation } = await import("../characterCreationLimit.service.js");
            await recordCreation(userId, flowId);
            logger.info(`[圖片生成] 用戶 ${userId} 成功扣除免費創建次數`);
          }
          logger.info(`[圖片生成] 用戶 ${userId} 圖片生成成功，AI 魔術師次數已重置${needsCreateCard ? '，創建卡已扣除' : '，免費次數已扣除'}`);
        } catch (error) {
          // 步驟 3: 如果扣除失敗，使用 Transaction 回滾標記並重置 AI 魔法師次數
          logger.error("[圖片生成] 扣除創建卡失敗，回滾標記:", error);

          try {
            await db.runTransaction(async (transaction) => {
              const flowDoc = await transaction.get(flowRef);

              if (flowDoc.exists) {
                const flowData = flowDoc.data();
                transaction.update(flowRef, {
                  metadata: {
                    ...(flowData.metadata || {}),
                    deductedOnImageGeneration: false,
                    aiMagicianUsageCount: 0, // 🔥 回滾時也重置 AI 魔法師次數
                  },
                  updatedAt: new Date().toISOString(),
                });
              }
            });
            logger.info("[圖片生成] 成功回滾扣除標記並重置 AI 魔法師次數");
          } catch (rollbackError) {
            logger.error("[圖片生成] 回滾標記失敗:", rollbackError);
          }

          throw new Error("創建卡扣除失敗，請重試");
        }
      }

      sendSuccess(res, {
        flow,
        reused,
        images: flow.generation?.result?.images || [],
      }, reused ? 200 : 201);
    } catch (error) {
      logger.error("圖像生成流程失敗:", error);
      next(error);
    }
  }
);

export { generationRouter };
