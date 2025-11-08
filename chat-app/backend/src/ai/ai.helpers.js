/**
 * AI 路由共用輔助函數
 * 用於減少代碼重複，提高可維護性
 */

import { handleIdempotentRequest } from "../utils/idempotency.js";
import logger from "../utils/logger.js";

/**
 * 包裝冪等性處理邏輯
 *
 * @param {string|undefined} requestId - 請求 ID（可選）
 * @param {Function} handler - 業務處理函數
 * @param {Object} options - 選項
 * @param {number} options.ttl - 冪等性 TTL（毫秒）
 * @returns {Promise<any>} 處理結果
 *
 * @example
 * const result = await withIdempotency(
 *   requestId,
 *   async () => {
 *     // 業務邏輯
 *     return { data: "..." };
 *   },
 *   { ttl: 15 * 60 * 1000 }
 * );
 */
export const withIdempotency = async (requestId, handler, options = {}) => {
  if (requestId) {
    return await handleIdempotentRequest(requestId, handler, options);
  }
  // 沒有請求ID，直接執行（向後兼容）
  return await handler();
};

/**
 * 從請求 body 中提取用戶訊息
 * 支援多種欄位名稱（userMessage, text）
 *
 * @param {Object} body - 請求 body
 * @returns {string|undefined} 用戶訊息
 */
export const extractUserMessage = (body) => {
  return typeof body?.userMessage === "string"
    ? body.userMessage
    : typeof body?.text === "string"
    ? body.text
    : undefined;
};

/**
 * 使用解鎖卡片的通用處理函數
 *
 * @param {Object} options - 選項
 * @param {string} options.userId - 用戶 ID
 * @param {string} options.characterId - 角色 ID
 * @param {string} options.cardType - 卡片類型（'語音' | '拍照' | '影片'）
 * @param {Function} options.useCardFn - 使用卡片的函數
 * @returns {Promise<Object>} 包含使用卡片後的記錄
 */
export const useUnlockCard = async ({ userId, characterId, cardType, useCardFn }) => {
  // 僅在開發環境記錄詳細日誌
  if (process.env.NODE_ENV !== "production") {
    logger.info(`[${cardType}卡片] 使用 ${cardType}解鎖卡: userId=${userId}, characterId=${characterId}`);
  }

  const cardResult = await useCardFn(userId, characterId);

  // 創建假的 record 用於回應（使用解鎖卡不計入次數）
  return {
    count: 0,
    remaining: 999,
    usedCard: true,
  };
};

/**
 * 處理語音播放（包含卡片邏輯）
 *
 * @param {Object} options - 選項
 * @param {string} options.userId - 用戶 ID
 * @param {string} options.characterId - 角色 ID
 * @param {boolean} options.useVoiceUnlockCard - 是否使用語音解鎖卡
 * @param {Function} options.recordFn - 記錄使用次數的函數
 * @returns {Promise<Object>} 使用記錄
 */
export const handleVoicePlayment = async ({
  userId,
  characterId,
  useVoiceUnlockCard,
  recordFn,
}) => {
  if (useVoiceUnlockCard) {
    // 動態導入以避免循環依賴
    const { useVoiceUnlockCard: useCardFn } = await import("../membership/unlockTickets.service.js");

    return await useUnlockCard({
      userId,
      characterId,
      cardType: '語音',
      useCardFn,
    });
  } else {
    // 正常記錄使用次數
    return await recordFn(userId, characterId);
  }
};

/**
 * 處理影片生成費用（包含卡片邏輯）
 *
 * @param {Object} options - 選項
 * @param {string} options.userId - 用戶 ID
 * @param {string} options.characterId - 角色 ID
 * @param {boolean} options.useVideoCard - 是否使用影片卡
 * @param {Function} options.recordFn - 記錄使用次數的函數
 * @returns {Promise<void>}
 */
export const handleVideoPayment = async ({
  userId,
  characterId,
  useVideoCard,
  recordFn,
}) => {
  if (useVideoCard === true) {
    // 動態導入以避免循環依賴
    const { useVideoUnlockCard } = await import("../membership/unlockTickets.service.js");

    // 扣除影片卡（只在生成成功後扣除）
    if (process.env.NODE_ENV !== "production") {
      logger.info(`[影片生成] 使用影片卡: userId=${userId}, characterId=${characterId}`);
    }
    await useVideoUnlockCard(userId, characterId);
  } else {
    // 不使用影片卡時才記錄使用次數
    await recordFn(userId);
  }
};

/**
 * 構建錯誤回應
 *
 * @param {Error|any} error - 錯誤對象
 * @param {string} defaultMessage - 預設錯誤訊息
 * @returns {Object} 錯誤回應對象
 */
export const buildErrorResponse = (error, defaultMessage) => {
  const status =
    typeof error?.status === "number" && error.status >= 100
      ? error.status
      : 500;

  const message =
    error instanceof Error && error.message
      ? error.message
      : defaultMessage;

  return { status, message };
};

/**
 * 設定 TTS 音頻回應標頭
 *
 * @param {Object} res - Express response 對象
 * @param {Buffer} audioBuffer - 音頻數據
 * @param {Object} record - 使用記錄
 * @param {boolean} isCached - 是否來自快取
 */
export const setTTSHeaders = (res, audioBuffer, record, isCached = false) => {
  res.set({
    "Content-Type": "audio/mpeg",
    "Content-Length": audioBuffer.length,
    "Cache-Control": "public, max-age=3600",
    "X-Voice-Usage-Count": (record.count || 0).toString(),
    "X-Voice-Usage-Remaining": (record.remaining || 0).toString(),
    "X-Idempotent": isCached ? "true" : "false",
    "X-Used-Unlock-Card": record.usedCard ? "true" : "false",
  });
};

/**
 * 記錄錯誤日誌（根據環境調整詳細程度）
 *
 * @param {string} context - 錯誤上下文（如 "TTS API"）
 * @param {Error|any} error - 錯誤對象
 * @param {Object} metadata - 額外的元數據
 */
export const logError = (context, error, metadata = {}) => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // 生產環境：僅記錄基本信息
  if (process.env.NODE_ENV === "production") {
    logger.error(`[${context}] ${errorMessage}`, metadata);
    return;
  }

  // 開發環境：記錄詳細信息
  logger.error(`[${context}] 錯誤訊息: ${errorMessage}`);
  logger.error(`[${context}] 錯誤類型: ${error ? error.constructor.name : 'unknown'}`);

  if (error instanceof Error && error.stack) {
    logger.error(`[${context}] 錯誤堆疊:\n${error.stack}`);
  }

  if (Object.keys(metadata).length > 0) {
    logger.error(`[${context}] 元數據:`, metadata);
  }
};
