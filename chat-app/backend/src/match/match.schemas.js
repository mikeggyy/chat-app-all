/**
 * Match 路由的 Zod 驗證 schemas
 */

import { z } from "zod";
import { commonSchemas } from "../middleware/validation.middleware.js";

/**
 * GET /match/all - 查詢參數驗證
 */
export const getAllMatchesSchema = {
  query: z.object({
    userId: commonSchemas.userId.optional(),
  }),
};

/**
 * GET /match/popular - 查詢參數驗證
 * 支持兩種分頁模式：
 * 1. offset-based（向後兼容，性能較差）
 * 2. cursor-based（推薦，性能優異）
 */
export const getPopularMatchesSchema = {
  query: z.object({
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .default(10)
      .optional(),
    // offset-based 分頁（向後兼容，但性能較差）
    offset: z.coerce
      .number()
      .int()
      .min(0)
      .default(0)
      .optional(),
    // cursor-based 分頁（推薦，性能優異）
    cursor: z.string().optional(),
    sync: z
      .enum(["true", "false", "1", "0"])
      .transform((val) => val === "true" || val === "1")
      .optional()
      .default("false"),
  }),
};

/**
 * GET /match/:id - 路徑參數驗證
 */
export const getMatchByIdSchema = {
  params: z.object({
    id: commonSchemas.characterId,
  }),
};

/**
 * POST /match/create - 請求 body 驗證
 */
export const createMatchSchema = {
  body: z.object({
    // 基本資訊
    name: z.string().min(1, "角色名稱不得為空").max(50, "角色名稱不得超過50字").trim(),
    age: z.coerce.number().int().min(18, "角色年齡必須大於等於18").max(120, "無效的年齡"),
    gender: z.enum(["male", "female", "其他"], { message: "無效的性別" }),

    // 選填資訊
    personality: z.string().max(500, "個性描述不得超過500字").trim().optional(),
    hobbies: z.array(z.string()).max(10, "興趣不得超過10個").optional(),
    occupation: z.string().max(100, "職業描述不得超過100字").trim().optional(),
    description: z.string().max(1000, "描述不得超過1000字").trim().optional(),
    avatar: z.string().url("無效的圖片URL").optional(),

    // 系統資訊
    creatorUid: commonSchemas.userId.optional(),
    flowId: z.string().min(1).trim().optional(),
    category: z.string().max(50).trim().optional(),
    isPublic: z.boolean().default(true).optional(),
    tags: z.array(z.string()).max(20, "標籤不得超過20個").optional(),
  }),
};
