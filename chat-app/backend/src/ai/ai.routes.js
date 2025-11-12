import { Router } from "express";
import { requireFirebaseAuth } from "../auth/index.js";
import {
  createAiReplyForConversation,
  createAiSuggestionsForConversation,
  generateSpeech,
} from "./ai.service.js";
import {
  canPlayVoice,
  recordVoicePlay,
} from "./voiceLimit.service.js";
import {
  canSendMessage,
  recordMessage,
} from "../conversation/conversationLimit.service.js";
import { generateSelfieForCharacter } from "./imageGeneration.service.js";
import {
  canGenerateVideo,
  recordVideoGeneration,
  getVideoStats,
} from "./videoLimit.service.js";
import { generateVideoForCharacter } from "./videoGeneration.service.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { RATE_LIMITS, IDEMPOTENCY_TTL } from "../config/limits.js";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../shared/utils/errorFormatter.js";
import {
  withIdempotency,
  handleVoicePlayment,
  buildErrorResponse,
  setTTSHeaders,
  extractUserMessage,
  handleVideoPayment,
  logError,
} from "./ai.helpers.js";
import { validateRequest } from "../middleware/validation.middleware.js";
import { aiSchemas } from "./ai.schemas.js";
import { requireSameUser } from "../middleware/authorization.js";
import { baseKeyGenerator } from "../utils/rateLimiter.helpers.js";

import logger from "../utils/logger.js";
export const aiRouter = Router();

const replyRateLimiter = createRateLimiter({
  windowMs: RATE_LIMITS.AI_REPLY.windowMs,
  maxRequests: RATE_LIMITS.AI_REPLY.maxRequests,
  keyGenerator: baseKeyGenerator,
  onLimit: (_req, res) => {
    sendError(res, "RATE_LIMIT_EXCEEDED", "生成 AI 回覆的請求過於頻繁，請稍後再試。");
  },
});

const suggestionRateLimiter = createRateLimiter({
  windowMs: RATE_LIMITS.AI_SUGGESTIONS.windowMs,
  maxRequests: RATE_LIMITS.AI_SUGGESTIONS.maxRequests,
  keyGenerator: baseKeyGenerator,
  onLimit: (_req, res) => {
    sendError(res, "RATE_LIMIT_EXCEEDED", "取得建議過於頻繁，請稍後再試。");
  },
});

const ttsRateLimiter = createRateLimiter({
  windowMs: RATE_LIMITS.TTS.windowMs,
  maxRequests: RATE_LIMITS.TTS.maxRequests,
  keyGenerator: baseKeyGenerator,
  onLimit: (_req, res) => {
    sendError(res, "RATE_LIMIT_EXCEEDED", "語音生成請求過於頻繁，請稍後再試。");
  },
});

const imageGenerationRateLimiter = createRateLimiter({
  windowMs: RATE_LIMITS.IMAGE_GENERATION.windowMs,
  maxRequests: RATE_LIMITS.IMAGE_GENERATION.maxRequests,
  keyGenerator: baseKeyGenerator,
  onLimit: (_req, res) => {
    sendError(res, "RATE_LIMIT_EXCEEDED", "圖片生成請求過於頻繁，請稍後再試。");
  },
});

const videoGenerationRateLimiter = createRateLimiter({
  windowMs: RATE_LIMITS.VIDEO_GENERATION.windowMs,
  maxRequests: RATE_LIMITS.VIDEO_GENERATION.maxRequests,
  keyGenerator: baseKeyGenerator,
  onLimit: (_req, res) => {
    sendError(res, "RATE_LIMIT_EXCEEDED", "影片生成請求過於頻繁，請稍後再試。");
  },
});

aiRouter.post(
  "/conversations/:userId/:characterId/reply",
  requireFirebaseAuth,
  validateRequest(aiSchemas.aiReply),
  requireSameUser({ errorMessage: "無權限存取其他使用者的 AI 對話回覆" }),
  replyRateLimiter,
  async (req, res, next) => {
    const { userId, characterId } = req.params;
    const { requestId, skipLimitCheck } = req.body;

    // 支援跳過限制檢查（用於禮物等特殊場景）
    const shouldSkipLimit = skipLimitCheck === true;

    // 檢查對話次數限制（除非明確跳過）
    if (!shouldSkipLimit) {
      const limitCheck = await canSendMessage(userId, characterId);
      if (!limitCheck.allowed) {
        return sendError(res, "CONVERSATION_LIMIT_REACHED", "已達到對話次數限制", {
          limit: limitCheck,
        });
      }
    }

    try {
      // 🎯 使用冪等性包裝處理
      const result = await withIdempotency(
        requestId,
        async () => {
          const { message, history } = await createAiReplyForConversation(
            userId,
            characterId,
            {
              userMessage: extractUserMessage(req.body),
            }
          );

          // 記錄對話次數（除非明確跳過）
          if (!shouldSkipLimit) {
            try {
              await recordMessage(userId, characterId);
            } catch (recordError) {
              logger.error("[對話限制] 記錄對話次數失敗:", recordError);
            }
          }

          return { message, messages: history };
        },
        { ttl: IDEMPOTENCY_TTL.AI_REPLY }
      );

      sendSuccess(res, result, 201);
    } catch (error) {
      logger.error("生成 AI 回覆失敗:", error);
      next(error);
    }
  }
);

aiRouter.post(
  "/conversations/:userId/:characterId/suggestions",
  requireFirebaseAuth,
  validateRequest(aiSchemas.aiSuggestions),
  requireSameUser({ errorMessage: "無權限取得其他使用者的建議回覆" }),
  suggestionRateLimiter,
  async (req, res, next) => {
    const { userId, characterId } = req.params;

    try {
      const result = await createAiSuggestionsForConversation(
        userId,
        characterId
      );
      sendSuccess(res, result);
    } catch (error) {
      logger.error("生成建議回覆失敗:", error);
      next(error);
    }
  }
);

aiRouter.post(
  "/tts",
  requireFirebaseAuth,
  validateRequest(aiSchemas.tts),
  ttsRateLimiter,
  async (req, res, next) => {
    const { text, characterId, requestId, useVoiceUnlockCard } = req.body;
    const userId = req.firebaseUser?.uid;

    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "無法識別用戶身份");
    }

    try {
      // ✅ 如果使用語音解鎖卡，先驗證用戶有卡（但不扣除）
      if (useVoiceUnlockCard) {
        const { getVoiceUnlockCards } = await import("../membership/unlockTickets.service.js");
        const cardCount = await getVoiceUnlockCards(userId);

        if (cardCount < 1) {
          return sendError(res, "INSUFFICIENT_UNLOCK_CARDS", "語音解鎖卡不足", {
            voiceUnlockCards: 0,
          });
        }

        logger.info(`[TTS] 用戶 ${userId} 準備使用語音解鎖卡播放角色 ${characterId} 的語音（當前有 ${cardCount} 張卡）`);
      } else {
        // 檢查語音播放限制
        const limitCheck = await canPlayVoice(userId, characterId);

        if (!limitCheck.allowed) {
          // 遊客需要登入
          if (limitCheck.requireLogin) {
            return sendError(res, "UNAUTHORIZED", "遊客無法使用語音功能，請先登入", {
              requireLogin: true,
            });
          }

          // 超過限制
          return sendError(res, "VOICE_LIMIT_REACHED", "已達到語音播放次數限制", {
            used: limitCheck.used,
            total: limitCheck.total,
            requireAds: limitCheck.requireAds,
            unlockedVoicesPerAd: limitCheck.unlockedVoicesPerAd,
            adsWatchedToday: limitCheck.adsWatchedToday || 0,
            voiceUnlockCards: limitCheck.voiceUnlockCards || 0,
          });
        }
      }

      // 🎯 使用冪等性包裝處理
      const result = await withIdempotency(
        requestId,
        async () => {
          // 1. 生成語音（FIRST）
          const audioBuffer = await generateSpeech(text, characterId);

          // 2. 只在成功後才處理費用（AFTER success）
          const record = await handleVoicePlayment({
            userId,
            characterId,
            useVoiceUnlockCard,
            recordFn: recordVoicePlay,
          });

          return { audioBuffer, record };
        },
        { ttl: IDEMPOTENCY_TTL.TTS }
      );

      // 檢查結果是否包含 audioBuffer
      if (!result.audioBuffer || !Buffer.isBuffer(result.audioBuffer)) {
        logger.error(`TTS API 結果檢查失敗: audioBuffer 不存在或類型錯誤`, {
          hasAudioBuffer: !!result.audioBuffer,
          isBuffer: result.audioBuffer ? Buffer.isBuffer(result.audioBuffer) : false,
          audioBufferType: result.audioBuffer ? typeof result.audioBuffer : 'undefined',
          resultKeys: Object.keys(result),
        });
        throw new Error('語音生成結果無效');
      }

      // 檢查 record 是否存在
      if (!result.record) {
        logger.error(`TTS API 結果檢查失敗: record 不存在`, {
          hasRecord: !!result.record,
          resultKeys: Object.keys(result),
          result: JSON.stringify(result, null, 2),
        });
        throw new Error('語音使用記錄無效');
      }

      // 設定 MP3 音檔回應標頭
      setTTSHeaders(res, result.audioBuffer, result.record, result._cached);
      res.send(result.audioBuffer);
    } catch (error) {
      // 記錄錯誤（根據環境調整詳細程度）
      logError("TTS API", error, { userId, characterId });
      next(error);
    }
  }
);

aiRouter.post(
  "/generate-selfie",
  requireFirebaseAuth,
  validateRequest(aiSchemas.generateSelfie),
  imageGenerationRateLimiter,
  async (req, res, next) => {
    // 🔒 安全增強：從認證 token 獲取 userId，防止偽造
    const userId = req.firebaseUser.uid;
    const { characterId, requestId, usePhotoCard } = req.body;

    try {
      // 🎯 使用冪等性包裝處理
      const result = await withIdempotency(
        requestId,
        async () => {
          // 生成照片（內部會處理限制檢查和扣卡邏輯）
          return await generateSelfieForCharacter(userId, characterId, {
            usePhotoUnlockCard: usePhotoCard || false
          });
        },
        { ttl: IDEMPOTENCY_TTL.IMAGE_GENERATION }
      );

      sendSuccess(res, result);
    } catch (error) {
      logger.error("生成自拍失敗:", error);
      next(error);
    }
  }
);

/**
 * 檢查用戶影片生成權限
 * GET /api/ai/video/check/:userId
 */
aiRouter.get(
  "/video/check/:userId",
  requireFirebaseAuth,
  validateRequest(aiSchemas.videoCheck),
  requireSameUser({ errorMessage: "無權限查詢其他使用者的影片生成權限" }),
  async (req, res, next) => {
    const { userId } = req.params;

    try {
      const result = await canGenerateVideo(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error("檢查影片生成權限失敗:", error);
      next(error);
    }
  }
);

/**
 * 獲取用戶影片生成使用統計
 * GET /api/ai/video/stats/:userId
 */
aiRouter.get(
  "/video/stats/:userId",
  requireFirebaseAuth,
  validateRequest(aiSchemas.videoStats),
  requireSameUser({ errorMessage: "無權限查詢其他使用者的影片生成統計" }),
  async (req, res, next) => {
    const { userId } = req.params;

    try {
      const stats = await getVideoStats(userId);
      sendSuccess(res, stats);
    } catch (error) {
      logger.error("獲取影片生成統計失敗:", error);
      next(error);
    }
  }
);

/**
 * 生成角色影片
 * POST /api/ai/generate-video
 */
aiRouter.post(
  "/generate-video",
  requireFirebaseAuth,
  validateRequest(aiSchemas.generateVideo),
  videoGenerationRateLimiter,
  async (req, res, next) => {
    // 🔒 安全增強：從認證 token 獲取 userId，防止偽造
    const userId = req.firebaseUser.uid;
    const { characterId, requestId, duration, resolution, aspectRatio, useVideoCard, imageUrl } = req.body;

    logger.info(`[Video API] 收到請求，imageUrl: ${imageUrl}`);

    try {
      // 檢查影片生成權限
      const limitCheck = await canGenerateVideo(userId);

      // 🔍 前置檢查：如果要使用影片卡，先檢查是否有足夠的影片卡（但不扣除）
      if (useVideoCard === true) {
        // 檢查是否有影片卡
        if (!limitCheck.videoCards || limitCheck.videoCards < 1) {
          return sendError(res, "INSUFFICIENT_UNLOCK_CARDS", "影片卡數量不足", {
            videoCards: limitCheck.videoCards || 0,
          });
        }
        // ⚠️ 不在這裡扣除，等影片生成成功後再扣除
      } else {
        // 不使用影片卡，檢查基礎額度
        if (!limitCheck.allowed) {
          return sendError(res, "VIDEO_LIMIT_REACHED", "已達到影片生成次數限制", {
            used: limitCheck.used,
            total: limitCheck.total,
            videoCards: limitCheck.videoCards || 0,
          });
        }
      }

      // 🎯 使用冪等性包裝處理
      const result = await withIdempotency(
        requestId,
        async () => {
          // 生成影片（支持自定義圖片 URL）
          const videoResult = await generateVideoForCharacter(userId, characterId, {
            duration: duration || "4s",
            resolution: resolution || "720p",
            aspectRatio: aspectRatio || "9:16",
            imageUrl: imageUrl || null, // 🎨 自定義圖片 URL（從相簿選擇）
          });

          // ✅ 影片生成成功後才扣除影片卡或記錄使用次數
          await handleVideoPayment({
            userId,
            characterId,
            useVideoCard,
            recordFn: recordVideoGeneration,
          });

          return videoResult;
        },
        { ttl: IDEMPOTENCY_TTL.VIDEO_GENERATION }
      );

      sendSuccess(res, {
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error("生成影片失敗:", error);
      next(error);
    }
  }
);
