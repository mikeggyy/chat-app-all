import { Router } from "express";
import { requireFirebaseAuth } from "../auth/index.js";
import { requireOwnership, asyncHandler } from "../utils/routeHelpers.js";
import { sendSuccess, sendError } from "../../../shared/utils/errorFormatter.js";
import {
  appendConversationMessages,
  getConversationHistory,
  getConversationPhotos,
  deleteConversationPhotos,
  deleteConversationMessages,
  clearConversationHistory,
} from "./conversation.service.js";
import { addConversationForUser } from "../user/user.service.js";
import { addOrUpdateConversation } from "../user/userConversations.service.js";
import {
  buildConversationMetadata,
  normalizeMetadataCharacterId,
  trimMetadataString,
} from "./conversation.helpers.js";
import { validateRequest, conversationSchemas } from "../middleware/validation.middleware.js";
import { getCharacterById } from "../services/character/characterCache.service.js";
import { getFirestoreDb, FieldValue } from "../firebase/index.js";

import logger from "../utils/logger.js";
import { standardRateLimiter, relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import { applySelector } from "../utils/responseOptimizer.js";

export const conversationRouter = Router();

// 獲取對話歷史 - 需要身份驗證且只能訪問自己的對話
conversationRouter.get(
  "/:userId/:characterId",
  requireFirebaseAuth,
  requireOwnership("userId"),
  relaxedRateLimiter,
  validateRequest(conversationSchemas.getHistory),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;
    const messages = await getConversationHistory(userId, characterId);

    // ✅ 響應優化：應用 message 選擇器
    // 只保留必要的消息字段（id, role, text, imageUrl, videoUrl, createdAt）
    // 移除元數據和不必要的字段
    const optimizedMessages = applySelector(messages, 'message');

    // ✅ 修復：使用統一的響應格式 { success: true, data: { messages } }
    sendSuccess(res, { messages: optimizedMessages });
  })
);

conversationRouter.post(
  "/:userId/:characterId",
  requireFirebaseAuth,
  requireOwnership("userId"),
  standardRateLimiter,
  validateRequest(conversationSchemas.sendMessage),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;

    const payload = req.body ?? {};
    const batchMessages = Array.isArray(payload.messages)
      ? payload.messages
      : [];

    const hasSingleMessage =
      typeof payload.text === "string" ||
      typeof payload.message === "string" ||
      typeof payload.content === "string";

    const candidateMessages = [...batchMessages];

    if (!batchMessages.length && hasSingleMessage) {
      candidateMessages.push(payload);
    }

    const inferredRole =
      typeof payload.role === "string" ? payload.role : payload.direction;

    if (!candidateMessages.length && typeof inferredRole === "string") {
      candidateMessages.push(payload);
    }

    if (!candidateMessages.length) {
      return sendError(res, "INVALID_REQUEST", "新增聊天紀錄時需要提供至少一則訊息");
    }

    const { appended, history } = await appendConversationMessages(
      userId,
      characterId,
      candidateMessages
    );

    try {
      const metadata = buildConversationMetadata(history);
      metadata.characterId = normalizeMetadataCharacterId(characterId);

      const latestAppended =
        Array.isArray(appended) && appended.length
          ? appended[appended.length - 1]
          : null;
      const latestAppendedRole = trimMetadataString(latestAppended?.role);
      if (latestAppendedRole === "partner") {
        const appendedTimestamp = trimMetadataString(latestAppended?.createdAt);
        if (appendedTimestamp) {
          metadata.partnerLastRepliedAt = appendedTimestamp;
          metadata.updatedAt = appendedTimestamp;
        }
        const appendedText = trimMetadataString(latestAppended?.text);
        if (appendedText) {
          metadata.partnerLastMessage = appendedText;
          metadata.lastMessage = appendedText;
        }
      } else if (
        !metadata.lastMessage &&
        trimMetadataString(latestAppended?.text)
      ) {
        metadata.lastMessage = trimMetadataString(latestAppended.text);
      }

      // 獲取角色信息並添加到 metadata
      // ✅ 性能優化：從內存緩存讀取，避免 N+1 Firestore 查詢
      const character = getCharacterById(characterId);
      if (character) {
        metadata.character = {
          id: character.id,
          display_name: character.display_name,
          portraitUrl: character.portraitUrl,
          background: character.background,
        };
      }

      // 更新舊的用戶文檔中的 conversations 數組（向後兼容）
      await addConversationForUser(userId, characterId, metadata);

      // 同時寫入到 Firestore 子集合（新的存儲方式）
      const conversationData = await addOrUpdateConversation(userId, characterId, metadata);

      // 檢查是否是首次對話，如果是則增加角色的 totalChatUsers
      if (conversationData?.isNewConversation) {
        try {
          const db = getFirestoreDb();
          const characterRef = db.collection("characters").doc(characterId);
          await characterRef.update({
            totalChatUsers: FieldValue.increment(1),
            updatedAt: new Date().toISOString()
          });

          if (process.env.NODE_ENV !== "test") {
            logger.info(`[聊天人數] 角色 ${characterId} 的 totalChatUsers +1（用戶 ${userId} 首次對話）`);
          }
        } catch (incrementError) {
          if (process.env.NODE_ENV !== "test") {
            logger.error(`[聊天人數] 更新失敗:`, incrementError);
          }
          // 增量失敗不影響對話創建
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        logger.warn(
          `同步使用者 ${userId} 聊天清單時發生錯誤:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    sendSuccess(res, {
      appended,
      messages: history,
    }, 201);
  })
);

// 獲取角色相簿（所有照片）
conversationRouter.get(
  "/:userId/:characterId/photos",
  requireFirebaseAuth,
  requireOwnership("userId"),
  relaxedRateLimiter,
  validateRequest(conversationSchemas.getPhotos),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;

    if (!userId || !characterId) {
      return sendError(res, "INVALID_REQUEST", "查詢相簿時需要提供 userId 與 characterId");
    }

    const photos = await getConversationPhotos(userId, characterId);
    sendSuccess(res, { photos });
  })
);

// 刪除照片
conversationRouter.delete(
  "/:userId/:characterId/photos",
  requireFirebaseAuth,
  requireOwnership("userId"),
  standardRateLimiter,
  validateRequest(conversationSchemas.deletePhotos),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;
    const { messageIds } = req.body;

    if (!userId || !characterId) {
      return sendError(res, "INVALID_REQUEST", "刪除照片時需要提供 userId 與 characterId");
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return sendError(res, "INVALID_REQUEST", "需提供至少一個照片訊息 ID");
    }

    const result = await deleteConversationPhotos(userId, characterId, messageIds);
    sendSuccess(res, {
      deleted: result.deleted.length,
      remaining: result.remaining,
    });
  })
);

// 刪除訊息（通用）
conversationRouter.delete(
  "/:userId/:characterId/messages",
  requireFirebaseAuth,
  requireOwnership("userId"),
  standardRateLimiter,
  validateRequest(conversationSchemas.deleteMessages),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;
    const { messageIds } = req.body;

    if (!userId || !characterId) {
      return sendError(res, "INVALID_REQUEST", "刪除訊息時需要提供 userId 與 characterId");
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return sendError(res, "INVALID_REQUEST", "需提供至少一個訊息 ID");
    }

    const result = await deleteConversationMessages(userId, characterId, messageIds);
    sendSuccess(res, {
      deleted: result.deleted.length,
      remaining: result.remaining,
    });
  })
);

// 清除對話歷史
conversationRouter.delete(
  "/:userId/:characterId",
  requireFirebaseAuth,
  requireOwnership("userId"),
  standardRateLimiter,
  validateRequest(conversationSchemas.clearHistory),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;

    if (!userId || !characterId) {
      return sendError(res, "INVALID_REQUEST", "清除對話時需要提供 userId 與 characterId");
    }

    await clearConversationHistory(userId, characterId);
    sendSuccess(res, {
      message: "對話歷史已清除",
    });
  })
);
