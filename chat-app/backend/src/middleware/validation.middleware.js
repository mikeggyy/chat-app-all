/**
 * 通用輸入驗證中間件
 * 使用 Zod 進行請求資料驗證
 */

import { z } from "zod";
import logger from "../utils/logger.js";

/**
 * 創建驗證中間件
 * @param {Object} schemas - Zod schema 物件
 * @param {z.ZodSchema} [schemas.body] - 請求 body 的 schema
 * @param {z.ZodSchema} [schemas.params] - 路由參數的 schema
 * @param {z.ZodSchema} [schemas.query] - 查詢字串的 schema
 * @returns {Function} Express 中間件函數
 */
export const validateRequest = (schemas) => {
  return async (req, res, next) => {
    try {
      // 驗證 body
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      // 驗證路由參數
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }

      // 驗證查詢字串
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          message: "輸入驗證失敗",
          errors,
        });
        return;
      }

      // 其他錯誤
      logger.error("驗證中間件發生錯誤:", error);
      res.status(500).json({
        message: "伺服器內部錯誤",
      });
    }
  };
};

/**
 * 常用的驗證 schema 片段
 */
export const commonSchemas = {
  // MongoDB ObjectId 格式（也適用於自訂 ID）
  id: z.string().min(1, "ID 不得為空").trim(),

  // 用戶 ID
  userId: z.string().min(1, "用戶 ID 不得為空").trim(),

  // 角色 ID
  characterId: z.string().min(1, "角色 ID 不得為空").trim(),

  // 分頁參數
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),

  // 訊息文字
  messageText: z
    .string()
    .min(1, "訊息內容不得為空")
    .max(2000, "訊息內容不得超過 2000 字")
    .trim(),

  // 顯示名稱
  displayName: z
    .string()
    .min(1, "名稱不得為空")
    .max(50, "名稱不得超過 50 字")
    .trim(),

  // Email
  email: z.string().email("無效的 Email 格式").trim(),

  // URL
  url: z.string().url("無效的 URL 格式").trim(),

  // 圖片 URL (支援 base64)
  imageUrl: z
    .string()
    .refine(
      (val) => val.startsWith("http") || val.startsWith("data:image"),
      "無效的圖片 URL 格式"
    )
    .refine(
      (val) => {
        // HTTP URL 不檢查大小
        if (val.startsWith("http")) {
          return true;
        }

        // Base64 圖片大小限制為 5MB
        // data:image/png;base64,iVBORw0KG... 格式
        const base64Match = val.match(/^data:image\/\w+;base64,(.+)$/);
        if (base64Match) {
          const base64Data = base64Match[1];
          // Base64 編碼後的大小約為原始大小的 4/3
          // 5MB = 5 * 1024 * 1024 bytes
          const maxSizeInBytes = 5 * 1024 * 1024;
          const estimatedSize = (base64Data.length * 3) / 4;
          return estimatedSize <= maxSizeInBytes;
        }

        return true;
      },
      "Base64 圖片大小不得超過 5MB"
    ),
};

/**
 * 對話相關的驗證 schemas
 */
export const conversationSchemas = {
  // 獲取對話歷史的參數驗證
  getHistory: {
    params: z.object({
      userId: commonSchemas.userId,
      characterId: commonSchemas.characterId,
    }),
  },

  // 發送訊息的驗證（支援單一訊息和批量訊息兩種格式）
  sendMessage: {
    params: z.object({
      userId: commonSchemas.userId,
      characterId: commonSchemas.characterId,
    }),
    body: z.union([
      // 單一訊息格式
      z.object({
        text: commonSchemas.messageText,
        role: z.enum(["user", "partner", "ai"]).optional(), // 支援 "ai" 角色（等同於 "partner"）
        id: z.string().optional(),
        imageUrl: z.string().optional(),
        video: z.object({
          url: z.string(),
          duration: z.string().optional(),
          resolution: z.string().optional(),
        }).optional(), // 支援影片欄位
        createdAt: z.string().optional(),
      }),
      // 批量訊息格式
      z.object({
        messages: z
          .array(
            z.object({
              text: commonSchemas.messageText,
              role: z.enum(["user", "partner", "ai"]), // 支援 "ai" 角色
              id: z.string().optional(),
              imageUrl: z.string().optional(),
              video: z.object({
                url: z.string(),
                duration: z.string().optional(),
                resolution: z.string().optional(),
              }).optional(), // 支援影片欄位
              createdAt: z.string().optional(),
            })
          )
          .min(1, "至少需要一則訊息"),
      }),
    ]),
  },

  // 清除對話歷史的驗證
  clearHistory: {
    params: z.object({
      userId: commonSchemas.userId,
      characterId: commonSchemas.characterId,
    }),
  },

  // 取得 AI 回覆的驗證
  getAIReply: {
    params: z.object({
      userId: commonSchemas.userId,
      characterId: commonSchemas.characterId,
    }),
    body: z.object({
      message: commonSchemas.messageText,
    }),
  },
};

/**
 * 用戶相關的驗證 schemas
 */
export const userSchemas = {
  // 更新用戶資料的驗證
  updateProfile: {
    params: z.object({
      userId: commonSchemas.userId,
    }),
    body: z.object({
      displayName: commonSchemas.displayName.optional(),
      gender: z.enum(["male", "female", "other"]).optional(),
      defaultPrompt: z.string().max(200, "角色設定不得超過 200 字").optional(),
    }),
  },

  // 獲取用戶資料的驗證
  getProfile: {
    params: z.object({
      userId: commonSchemas.userId,
    }),
  },
};

export default {
  validateRequest,
  commonSchemas,
  conversationSchemas,
  userSchemas,
};
