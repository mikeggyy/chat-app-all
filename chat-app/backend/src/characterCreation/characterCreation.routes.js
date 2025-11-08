import { Router } from "express";
import logger from "../utils/logger.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import {
  createCreationFlow,
  getCreationFlow,
  mergeCreationFlow,
  recordCreationCharge,
  generateCreationResult,
} from "./characterCreation.service.js";
import {
  getUserGenerationLogs,
  getGenerationLog,
  getFlowGenerationLog,
  getAllGenerationLogs,
  getGenerationStats,
} from "./generationLog.service.js";
import {
  canCreateCharacter,
  recordCreation,
  getCreationStats,
} from "./characterCreationLimit.service.js";
import { consumeUserAsset } from "../user/assets.service.js";

const characterCreationRouter = Router();

const isoNow = () => new Date().toISOString();

const trimString = (value) =>
  typeof value === "string" ? value.trim() : "";

const respondWithError = (res, error, fallbackMessage) => {
  const status =
    typeof error?.status === "number" && error.status >= 400
      ? error.status
      : 500;
  const message =
    error instanceof Error && error.message
      ? error.message
      : fallbackMessage;
  res.status(status).json({ message });
};

characterCreationRouter.post("/flows", (req, res) => {
  try {
    const flow = createCreationFlow({
      userId: req.body?.userId,
      persona: req.body?.persona,
      appearance: req.body?.appearance,
      voice: req.body?.voice,
      status: req.body?.status,
      metadata: req.body?.metadata,
    });
    res.status(201).json({ flow });
  } catch (error) {
    respondWithError(
      res,
      error,
      "無法建立角色創建流程"
    );
  }
});

characterCreationRouter.get("/flows/:flowId", (req, res) => {
  try {
    const flow = getCreationFlow(req.params.flowId);
    if (!flow) {
      res
        .status(404)
        .json({ message: "找不到指定的角色創建流程" });
      return;
    }
    res.json({ flow });
  } catch (error) {
    respondWithError(
      res,
      error,
      "無法查詢角色創建流程"
    );
  }
});

characterCreationRouter.patch("/flows/:flowId", (req, res) => {
  try {
    const flow = mergeCreationFlow(req.params.flowId, req.body ?? {});
    res.json({ flow });
  } catch (error) {
    respondWithError(
      res,
      error,
      "無法更新角色創建流程"
    );
  }
});

characterCreationRouter.post(
  "/flows/:flowId/steps/:stepId",
  (req, res) => {
    const step = trimString(req.params.stepId).toLowerCase();
    const flowId = req.params.flowId;

    if (!step) {
      res.status(400).json({ message: "缺少步驟識別碼" });
      return;
    }

    let payload = null;

    if (step === "persona") {
      payload = { persona: req.body ?? {} };
    } else if (step === "appearance") {
      payload = { appearance: req.body ?? {} };
    } else if (step === "voice") {
      payload = { voice: req.body ?? {} };
    } else {
      res.status(404).json({ message: "未知的角色創建步驟" });
      return;
    }

    try {
      const flow = mergeCreationFlow(flowId, payload);
      res.json({ flow });
    } catch (error) {
      respondWithError(
        res,
        error,
        "無法更新該創建步驟"
      );
    }
  }
);

characterCreationRouter.post("/flows/:flowId/charges", (req, res) => {
  try {
    const idempotencyKey =
      trimString(req.get("Idempotency-Key")) ||
      trimString(req.body?.idempotencyKey) ||
      null;

    const payload = {
      ...req.body,
      idempotencyKey,
    };

    const { flow, charge } = recordCreationCharge(
      req.params.flowId,
      payload
    );

    res.status(201).json({ flow, charge });
  } catch (error) {
    respondWithError(
      res,
      error,
      "無法記錄生成費用資訊"
    );
  }
});

characterCreationRouter.post(
  "/flows/:flowId/generate",
  async (req, res) => {
    const flowId = req.params.flowId;

    try {
      const currentFlow = getCreationFlow(flowId);
      if (!currentFlow) {
        res
          .status(404)
          .json({ message: "找不到指定的角色創建流程" });
        return;
      }

      if (!currentFlow.voice || !currentFlow.voice.id) {
        res.status(400).json({
          message: "尚未選擇角色語音，無法開始生成流程",
        });
        return;
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

      res.status(reused ? 200 : 201).json({
        flow,
        reused,
      });
    } catch (error) {
      respondWithError(
        res,
        error,
        "語音生成流程發生錯誤"
      );
    }
  }
);

characterCreationRouter.post(
  "/flows/:flowId/ai-magician",
  async (req, res) => {
    const flowId = req.params.flowId;

    try {
      const currentFlow = getCreationFlow(flowId);
      if (!currentFlow) {
        res
          .status(404)
          .json({ message: "找不到指定的角色創建流程" });
        return;
      }

      // 檢查是否有選擇角色外觀（圖片）
      if (!currentFlow.appearance || !currentFlow.appearance.image) {
        res.status(400).json({
          message: "尚未選擇角色外觀,無法使用 AI 魔法師",
        });
        return;
      }

      const { generateCharacterPersona } = await import("./characterCreation.ai.js");

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

      res.json({ persona });
    } catch (error) {
      respondWithError(
        res,
        error,
        "AI 魔法師生成失敗"
      );
    }
  }
);

// AI 描述生成（無需 flowId，用於付款前的 AI 魔術師）
// 使用次數追蹤由前端 sessionStorage 處理
characterCreationRouter.post(
  "/ai-description",
  async (req, res) => {
    try {
      const gender = trimString(req.body?.gender);
      const styles = Array.isArray(req.body?.styles)
        ? req.body.styles
        : [];
      const referenceInfo = req.body?.referenceInfo || null;

      const { generateAppearanceDescription } = await import("./characterCreation.ai.js");

      const description = await generateAppearanceDescription({
        gender,
        styles,
        referenceInfo,
      });

      res.json({ description });
    } catch (error) {
      respondWithError(res, error, "AI 描述生成失敗");
    }
  }
);

characterCreationRouter.post(
  "/flows/:flowId/ai-description",
  async (req, res) => {
    const flowId = req.params.flowId;

    try {
      // 獲取並檢查 flow
      const flow = getCreationFlow(flowId);
      if (!flow) {
        return res.status(404).json({ message: "找不到角色創建流程" });
      }

      // 檢查 AI 魔法師使用次數限制（每個創建流程限3次）
      const AI_MAGICIAN_LIMIT = 3;
      const usageCount = flow.metadata?.aiMagicianUsageCount || 0;

      if (usageCount >= AI_MAGICIAN_LIMIT) {
        return res.status(429).json({
          message: `AI 魔法師使用次數已達上限（${AI_MAGICIAN_LIMIT} 次）`,
          usageCount,
          limit: AI_MAGICIAN_LIMIT,
        });
      }

      const gender = trimString(req.body?.gender);
      const styles = Array.isArray(req.body?.styles)
        ? req.body.styles
        : [];
      const referenceInfo = req.body?.referenceInfo || null;

      const { generateAppearanceDescription } = await import("./characterCreation.ai.js");

      const description = await generateAppearanceDescription({
        gender,
        styles,
        referenceInfo,
      });

      // 成功生成後增加使用次數
      mergeCreationFlow(flowId, {
        metadata: {
          ...flow.metadata,
          aiMagicianUsageCount: usageCount + 1,
        },
      });

      const newUsageCount = usageCount + 1;
      const remainingUsage = AI_MAGICIAN_LIMIT - newUsageCount;

      res.json({
        description,
        usageCount: newUsageCount,
        remainingUsage,
        limit: AI_MAGICIAN_LIMIT,
      });
    } catch (error) {
      respondWithError(
        res,
        error,
        "AI 魔法師生成形象描述失敗"
      );
    }
  }
);

characterCreationRouter.post(
  "/flows/:flowId/generate-images",
  async (req, res) => {
    const flowId = req.params.flowId;

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Image Generation API] Request received for flowId: ${flowId}`);
    }

    try {
      const currentFlow = getCreationFlow(flowId);

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
        res
          .status(404)
          .json({ message: "找不到指定的角色創建流程" });
        return;
      }

      if (!currentFlow.appearance || !currentFlow.appearance.description) {
        if (process.env.NODE_ENV !== "test") {
          logger.error(`[Image Generation API] Missing appearance data:`, {
            hasAppearance: !!currentFlow.appearance,
            hasDescription: !!currentFlow?.appearance?.description,
          });
        }
        res.status(400).json({
          message: "尚未填寫角色形象描述，無法開始生成圖片",
        });
        return;
      }

      // 檢查角色創建次數限制
      const userId = currentFlow.userId;
      if (userId) {
        const limitCheck = canCreateCharacter(userId);
        if (!limitCheck.allowed) {
          res.status(403).json({
            message: limitCheck.message || "已達到角色創建次數限制",
            limit: limitCheck,
          });
          return;
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
          const { generateCharacterImages } = await import("./characterCreation.ai.js");

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

      // 記錄角色創建次數（僅在首次創建時記錄）
      if (!reused && userId) {
        try {
          // 檢查剩餘次數
          const stats = await getCreationStats(userId);

          if (stats.remaining <= 0) {
            // 免費次數用完，嘗試使用創建卡
            logger.info(`[角色創建] 用戶 ${userId} 免費次數已用完，嘗試使用創建卡`);
            await consumeUserAsset(userId, "createCards", 1);
            logger.info(`[角色創建] 用戶 ${userId} 成功使用創建卡`);
          } else {
            // 有免費次數，記錄使用
            logger.info(`[角色創建] 用戶 ${userId} 使用免費次數（剩餘 ${stats.remaining} 次）`);
          }

          // 記錄創建次數
          recordCreation(userId, flowId);
        } catch (recordError) {
          logger.error("[角色創建限制] 記錄創建次數或扣除創建卡失敗:", recordError);
          // 如果扣除失敗，應該回滾生成？但這裡已經生成成功了
          // 這是一個需要考慮的邊界情況
        }
      }

      res.status(reused ? 200 : 201).json({
        flow,
        reused,
        images: flow.generation?.result?.images || [],
      });
    } catch (error) {
      respondWithError(
        res,
        error,
        "圖像生成流程發生錯誤"
      );
    }
  }
);

// 查詢用戶的生成記錄
characterCreationRouter.get(
  "/generation-logs/user/:userId",
  (req, res) => {
    try {
      const userId = trimString(req.params.userId);
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;

      if (!userId) {
        res.status(400).json({ message: "缺少用戶ID" });
        return;
      }

      const logs = getUserGenerationLogs(userId, { limit, offset });
      res.json({ logs, count: logs.length });
    } catch (error) {
      respondWithError(res, error, "查詢用戶生成記錄失敗");
    }
  }
);

// 查詢單個生成記錄
characterCreationRouter.get(
  "/generation-logs/:logId",
  (req, res) => {
    try {
      const logId = trimString(req.params.logId);
      if (!logId) {
        res.status(400).json({ message: "缺少記錄ID" });
        return;
      }

      const log = getGenerationLog(logId);
      if (!log) {
        res.status(404).json({ message: "找不到生成記錄" });
        return;
      }

      res.json({ log });
    } catch (error) {
      respondWithError(res, error, "查詢生成記錄失敗");
    }
  }
);

// 查詢流程的生成記錄
characterCreationRouter.get(
  "/generation-logs/flow/:flowId",
  (req, res) => {
    try {
      const flowId = trimString(req.params.flowId);
      if (!flowId) {
        res.status(400).json({ message: "缺少流程ID" });
        return;
      }

      const log = getFlowGenerationLog(flowId);
      if (!log) {
        res.status(404).json({ message: "找不到流程的生成記錄" });
        return;
      }

      res.json({ log });
    } catch (error) {
      respondWithError(res, error, "查詢流程生成記錄失敗");
    }
  }
);

// 查詢所有生成記錄（管理用）
characterCreationRouter.get(
  "/generation-logs",
  (req, res) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      const status = trimString(req.query.status) || null;

      const result = getAllGenerationLogs({ limit, offset, status });
      res.json(result);
    } catch (error) {
      respondWithError(res, error, "查詢生成記錄失敗");
    }
  }
);

// 查詢所有生成統計
characterCreationRouter.get(
  "/generation-stats",
  (req, res) => {
    try {
      const stats = getGenerationStats(null);
      res.json({ stats });
    } catch (error) {
      respondWithError(res, error, "查詢生成統計失敗");
    }
  }
);

// 查詢指定用戶的生成統計
characterCreationRouter.get(
  "/generation-stats/user/:userId",
  (req, res) => {
    try {
      const userId = trimString(req.params.userId);
      if (!userId) {
        res.status(400).json({ message: "缺少用戶ID" });
        return;
      }
      const stats = getGenerationStats(userId);
      res.json({ stats });
    } catch (error) {
      respondWithError(res, error, "查詢生成統計失敗");
    }
  }
);

// 查詢角色創建限制
characterCreationRouter.get(
  "/limits/:userId",
  async (req, res) => {
    try {
      const userId = trimString(req.params.userId);
      if (!userId) {
        res.status(400).json({ message: "缺少用戶ID" });
        return;
      }

      const limitCheck = await canCreateCharacter(userId);
      const creationStats = await getCreationStats(userId);

      if (process.env.NODE_ENV !== "test") {
        logger.info(`[創建角色限制] 用戶 ${userId} 查詢限制:`, {
          limitCheck,
          creationStats,
        });
      }

      res.json({
        limit: limitCheck,
        stats: creationStats,
        remainingFreeCreations: creationStats.remaining || 0,
      });
    } catch (error) {
      respondWithError(res, error, "查詢角色創建限制失敗");
    }
  }
);

// 使用創建角色卡
// POST /api/character-creation/use-create-card
// 🔒 安全增強：從認證 token 獲取 userId，防止盜用他人創建卡
characterCreationRouter.post(
  "/use-create-card",
  requireFirebaseAuth,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;

      logger.info(`[創建角色卡] 用戶 ${userId} 請求使用創建卡`);

      // 扣除一張創建卡（會自動檢查數量）
      const result = await consumeUserAsset(userId, "createCards", 1);

      logger.info(`[創建角色卡] 用戶 ${userId} 成功使用了 1 張創建角色卡`);

      res.json({
        success: true,
        message: "成功使用創建角色卡",
        remainingCards: result.createCards || 0,
        deducted: 1,
      });
    } catch (error) {
      logger.error("使用創建角色卡失敗:", error);
      res.status(400).json({
        success: false,
        error: error.message || "使用創建角色卡失敗",
      });
    }
  }
);

// 清理未選中的角色圖片
// POST /api/character-creation/flows/:flowId/cleanup-images
// 用於刪除角色創建過程中未被選中的圖片，節省儲存空間
characterCreationRouter.post(
  "/flows/:flowId/cleanup-images",
  async (req, res) => {
    try {
      const { flowId } = req.params;
      const { selectedImageUrl, allImages } = req.body;

      if (!flowId) {
        return res.status(400).json({ message: "缺少 flowId 參數" });
      }

      if (!selectedImageUrl) {
        return res.status(400).json({ message: "缺少 selectedImageUrl 參數" });
      }

      if (!Array.isArray(allImages) || allImages.length === 0) {
        return res.status(400).json({ message: "allImages 必須是非空陣列" });
      }

      logger.info(`[圖片清理] 開始清理 flowId=${flowId} 的未選中圖片`);
      logger.info(`[圖片清理] 選中的圖片: ${selectedImageUrl}`);
      logger.info(`[圖片清理] 所有圖片數量: ${allImages.length}`);

      // 找出未選中的圖片
      const unselectedImages = allImages.filter(url => url !== selectedImageUrl);

      logger.info(`[圖片清理] 需要刪除的圖片數量: ${unselectedImages.length}`);

      if (unselectedImages.length === 0) {
        return res.json({
          success: true,
          deleted: 0,
          message: "沒有需要刪除的圖片"
        });
      }

      // 動態導入 deleteImage 函數以避免循環依賴
      const { deleteImage } = await import("../firebase/storage.service.js");

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

      res.json({
        success: true,
        deleted: successCount,
        failed: failCount,
        total: unselectedImages.length,
        message: `成功刪除 ${successCount} 張未選中的圖片`
      });
    } catch (error) {
      logger.error("[圖片清理] 清理失敗:", error);
      respondWithError(res, error, "清理未選中圖片失敗");
    }
  }
);

export { characterCreationRouter };
