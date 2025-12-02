/**
 * AI 設定管理路由
 * 提供手動刷新 AI 設定緩存的 API
 */

import express from "express";
import { refreshAiSettings, getAiSettings } from "../services/aiSettings.service.js";
import { standardRateLimiter } from "../middleware/rateLimiterConfig.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /api/ai-settings
 * 獲取當前的 AI 設定（從緩存或 Firestore）
 */
router.get("/", async (req, res) => {
  try {
    const settings = await getAiSettings();
    sendSuccess(res, { settings, cached: true });
  } catch (error) {
    logger.error("[AI Settings API] 獲取 AI 設定失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取 AI 設定失敗");
  }
});

/**
 * POST /api/ai-settings/refresh
 * 手動刷新 AI 設定緩存
 *
 * 使用場景：
 * - 管理員在管理後台更新 AI 設定後
 * - 需要立即生效而不等待緩存過期（5 分鐘）
 * ✅ 速率限制：30次/分鐘（管理操作）
 */
router.post("/refresh", standardRateLimiter, async (req, res) => {
  try {
    logger.info("[AI Settings API] 收到手動刷新緩存請求");

    const settings = await refreshAiSettings();

    logger.info("[AI Settings API] ✅ AI 設定緩存已刷新");

    sendSuccess(res, {
      message: "AI 設定緩存已成功刷新",
      settings,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[AI Settings API] 刷新 AI 設定緩存失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "刷新 AI 設定緩存失敗");
  }
});

/**
 * GET /api/ai-settings/:serviceName
 * 獲取特定 AI 服務的設定
 *
 * @param serviceName - 服務名稱（chat, tts, imageGeneration, videoGeneration, etc.）
 */
router.get("/:serviceName", async (req, res) => {
  try {
    const { serviceName } = req.params;

    const allSettings = await getAiSettings();
    const serviceSettings = allSettings[serviceName];

    if (!serviceSettings) {
      return sendError(res, "RESOURCE_NOT_FOUND", `找不到服務 "${serviceName}" 的設定`);
    }

    sendSuccess(res, { serviceName, settings: serviceSettings });
  } catch (error) {
    logger.error(`[AI Settings API] 獲取服務 "${req.params.serviceName}" 設定失敗:`, error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取 AI 服務設定失敗");
  }
});

export default router;
