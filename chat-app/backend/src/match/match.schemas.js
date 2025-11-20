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
    // 基本資訊 - 向後兼容：同時接受 name 和 display_name
    name: z.string().min(1, "角色名稱不得為空").max(50, "角色名稱不得超過50字").trim().optional(),
    display_name: z.string().min(1, "角色名稱不得為空").max(50, "角色名稱不得超過50字").trim().optional(),
    // age 字段已移除：後端不會保存此字段，且創建流程中沒有輸入步驟
    gender: z.enum(["male", "female", "其他"], { message: "無效的性別" }),

    // 🔥 角色創建流程必要字段（修復：這些字段之前被驗證中間件過濾掉了）
    background: z.string().max(1000, "角色設定不得超過1000字").trim().optional(),
    secret_background: z.string().max(1000, "隱藏設定不得超過1000字").trim().optional(),
    first_message: z.string().max(500, "開場白不得超過500字").trim().optional(),
    portraitUrl: z.string().optional(), // 接受任何 URL（包括 data: URI 和 https://）
    appearanceDescription: z.string().max(1000, "外觀描述不得超過1000字").trim().optional(),
    styles: z.array(z.string()).max(10, "風格不得超過10個").optional(),
    voice: z.union([
      z.string(), // 字串形式
      z.object({
        id: z.string(),
        label: z.string().optional(),
        description: z.string().optional(),
        gender: z.string().optional(),
        ageGroup: z.string().optional(),
      }) // 物件形式
    ]).optional(),

    // 選填資訊
    personality: z.string().max(500, "個性描述不得超過500字").trim().optional(),
    hobbies: z.array(z.string()).max(10, "興趣不得超過10個").optional(),
    occupation: z.string().max(100, "職業描述不得超過100字").trim().optional(),
    description: z.string().max(1000, "描述不得超過1000字").trim().optional(),
    avatar: z.string().url("無效的圖片URL").optional(),

    // 系統資訊
    creatorUid: commonSchemas.userId.optional(),
    creatorDisplayName: z.string().max(100).trim().optional(),
    flowId: z.string().min(1).trim().optional(),
    category: z.string().max(50).trim().optional(),
    isPublic: z.boolean().default(true).optional(),
    tags: z.array(z.string()).max(20, "標籤不得超過20個").optional(),
    plot_hooks: z.array(z.string()).max(20, "劇情鉤子不得超過20個").optional(),
    totalChatUsers: z.number().int().min(0).optional(),
    totalFavorites: z.number().int().min(0).optional(),
    locale: z.string().max(10).optional(),
  }).refine(
    (data) => data.name || data.display_name,
    {
      message: "必須提供 name 或 display_name 其中之一",
      path: ["name"],
    }
  ),
};
