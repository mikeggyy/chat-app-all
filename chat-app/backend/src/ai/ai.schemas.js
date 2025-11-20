/**
 * AI 路由的 Zod 驗證 schemas
 */

import { z } from "zod";
import { commonSchemas } from "../middleware/validation.middleware.js";

/**
 * AI 回覆生成驗證
 */
export const aiReplySchema = {
  params: z.object({
    userId: commonSchemas.userId,
    characterId: commonSchemas.characterId,
  }),
  body: z.object({
    requestId: z.string().optional(),
    skipLimitCheck: z.boolean().optional(),
    userMessage: z.string().optional(),
    text: z.string().optional(),
  }),
};

/**
 * AI 建議生成驗證
 */
export const aiSuggestionsSchema = {
  params: z.object({
    userId: commonSchemas.userId,
    characterId: commonSchemas.characterId,
  }),
};

/**
 * TTS 語音生成驗證
 */
export const ttsSchema = {
  body: z.object({
    text: z
      .string()
      .min(1, "需要提供要轉換的文字")
      .max(1000, "文字長度不得超過 1000 字")
      .trim(),
    characterId: commonSchemas.characterId,
    requestId: z.string().optional(),
    useVoiceUnlockCard: z.boolean().optional(),
  }),
};

/**
 * 拍照生成驗證
 */
export const generateSelfieSchema = {
  body: z.object({
    characterId: commonSchemas.characterId,
    requestId: z.string().optional(),
    usePhotoCard: z.boolean().optional(),
  }),
};

/**
 * 影片生成驗證
 */
export const generateVideoSchema = {
  body: z.object({
    characterId: commonSchemas.characterId,
    requestId: z.string().optional(),
    duration: z.enum(["4s", "8s"]).optional().default("4s"),
    resolution: z.enum(["720p", "1080p"]).optional().default("720p"),
    aspectRatio: z.enum(["9:16", "16:9", "1:1"]).optional().default("9:16"),
    useVideoCard: z.boolean().optional(),
    imageUrl: z
      .string()
      .trim()
      .optional(),
  }),
};

/**
 * 影片權限檢查驗證
 */
export const videoCheckSchema = {
  params: z.object({
    userId: commonSchemas.userId,
  }),
};

/**
 * 影片統計驗證
 */
export const videoStatsSchema = {
  params: z.object({
    userId: commonSchemas.userId,
  }),
};

/**
 * 統一導出所有 schemas
 */
export const aiSchemas = {
  aiReply: aiReplySchema,
  aiSuggestions: aiSuggestionsSchema,
  tts: ttsSchema,
  generateSelfie: generateSelfieSchema,
  generateVideo: generateVideoSchema,
  videoCheck: videoCheckSchema,
  videoStats: videoStatsSchema,
};
