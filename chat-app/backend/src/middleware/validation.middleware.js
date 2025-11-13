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

  // 訂單 ID
  orderId: z.string().min(1, "訂單 ID 不得為空").trim(),

  // 訂單編號
  orderNumber: z.string().min(1, "訂單編號不得為空").trim(),

  // 交易 ID
  transactionId: z.string().min(1, "交易 ID 不得為空").trim(),

  // 套餐 ID
  packageId: z.string().min(1, "套餐 ID 不得為空").trim(),

  // 功能 ID
  featureId: z.string().min(1, "功能 ID 不得為空").trim(),

  // 金額（正數）
  amount: z.coerce.number().positive("金額必須為正數"),

  // 金額（非負數，允許 0）
  nonNegativeAmount: z.coerce.number().nonnegative("金額不得為負數"),

  // 數量
  quantity: z.coerce.number().int().positive("數量必須為正整數").default(1),

  // 冪等性鍵
  idempotencyKey: z.string().min(1, "冪等性鍵不得為空").trim().optional(),

  // 日期字串（ISO 8601 格式）
  dateString: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "無效的日期格式"
  ).optional(),

  // 分頁查詢參數（擴展版）
  paginationQuery: z.object({
    limit: z.coerce.number().int().positive().max(100).default(50).optional(),
    offset: z.coerce.number().int().nonnegative().default(0).optional(),
  }).optional(),
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

  // 獲取對話照片的驗證
  getPhotos: {
    params: z.object({
      userId: commonSchemas.userId,
      characterId: commonSchemas.characterId,
    }),
  },

  // 刪除對話照片的驗證
  deletePhotos: {
    params: z.object({
      userId: commonSchemas.userId,
      characterId: commonSchemas.characterId,
    }),
    body: z.object({
      messageIds: z.array(z.string().min(1)).min(1, "至少需要一個訊息 ID"),
    }),
  },

  // 刪除對話訊息的驗證
  deleteMessages: {
    params: z.object({
      userId: commonSchemas.userId,
      characterId: commonSchemas.characterId,
    }),
    body: z.object({
      messageIds: z.array(z.string().min(1)).min(1, "至少需要一個訊息 ID"),
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
      age: z.coerce.number()
        .int("年齡必須為整數")
        .min(0, "年齡不得小於 0")
        .max(150, "年齡不得超過 150")
        .optional(),
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

/**
 * 訂單相關的驗證 schemas
 */
export const orderSchemas = {
  // 獲取訂單列表
  getUserOrders: {
    query: z.object({
      limit: z.coerce.number().int().positive().max(100).optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
      type: z.enum(["coin", "membership", "potion", "asset", "unlock"]).optional(),
      status: z.enum(["pending", "processing", "completed", "failed", "cancelled", "refunded"]).optional(),
      startDate: commonSchemas.dateString,
      endDate: commonSchemas.dateString,
    }),
  },

  // 獲取訂單統計
  getOrderStats: {
    query: z.object({
      startDate: commonSchemas.dateString,
      endDate: commonSchemas.dateString,
    }),
  },

  // 創建訂單
  createOrder: {
    body: z.object({
      type: z.enum(["coin", "membership", "potion", "asset", "unlock"], {
        required_error: "需提供訂單類型",
      }),
      productId: z.string().min(1, "需提供商品 ID").trim(),
      productName: z.string().trim().optional(),
      quantity: commonSchemas.quantity,
      amount: commonSchemas.amount,
      currency: z.string().default("TWD").optional(),
      paymentMethod: z.enum(["credit_card", "paypal", "stripe", "test"]).optional(),
      metadata: z.record(z.any()).optional(),
    }),
  },

  // 獲取訂單詳情
  getOrder: {
    params: z.object({
      orderId: commonSchemas.orderId,
    }),
  },

  // 根據訂單編號獲取
  getOrderByNumber: {
    params: z.object({
      orderNumber: commonSchemas.orderNumber,
    }),
  },

  // 完成訂單
  completeOrder: {
    params: z.object({
      orderId: commonSchemas.orderId,
    }),
    body: z.object({
      metadata: z.record(z.any()).optional(),
    }),
  },

  // 取消訂單
  cancelOrder: {
    params: z.object({
      orderId: commonSchemas.orderId,
    }),
    body: z.object({
      reason: z.string().max(500, "取消原因不得超過 500 字").optional(),
    }),
  },

  // 退款訂單（管理員）
  refundOrder: {
    params: z.object({
      orderId: commonSchemas.orderId,
    }),
    body: z.object({
      refundReason: z.string().min(1, "需提供退款原因").max(500, "退款原因不得超過 500 字"),
      refundAmount: commonSchemas.nonNegativeAmount.optional(),
      refundedBy: z.string().optional(),
    }),
  },

  // 清除所有訂單（測試）
  clearAllOrders: {
    // 無參數
  },
};

/**
 * 金幣相關的驗證 schemas
 */
export const coinSchemas = {
  // 獲取金幣餘額 - 無參數（從 token 獲取 userId）
  getBalance: {
    // 無參數
  },

  // 購買無限對話
  purchaseUnlimitedChat: {
    body: z.object({
      characterId: commonSchemas.characterId,
      idempotencyKey: commonSchemas.idempotencyKey,
    }),
  },

  // 獲取功能價格
  getFeaturePricing: {
    params: z.object({
      featureId: commonSchemas.featureId,
    }),
  },

  // 獲取所有功能價格 - 無參數
  getAllPricing: {
    // 無參數
  },

  // 獲取交易記錄
  getTransactions: {
    query: z.object({
      limit: z.coerce.number().int().positive().max(100).optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
    }),
  },

  // 獲取金幣套餐 - 無需身份驗證
  getPackages: {
    // 無參數
  },

  // 購買金幣套餐
  purchasePackage: {
    body: z.object({
      packageId: commonSchemas.packageId,
      paymentInfo: z.record(z.any()).optional(),
      idempotencyKey: z.string().min(1, "請提供冪等性鍵以防止重複購買"),
    }),
  },

  // 充值金幣（測試）
  rechargeCoins: {
    body: z.object({
      amount: z.coerce.number()
        .positive("金額必須為正數")
        .int("金額必須為整數")
        .max(100000, "單次充值金額不得超過 100,000"),
      idempotencyKey: commonSchemas.idempotencyKey,
    }),
  },

  // 設定金幣餘額（測試帳號）
  setBalance: {
    body: z.object({
      balance: z.coerce.number()
        .int("金幣數量必須為整數")
        .nonnegative("金幣數量不得為負數")
        .max(1000000, "金幣數量不得超過 1,000,000"),
    }),
  },
};

/**
 * 交易記錄相關的驗證 schemas
 */
export const transactionSchemas = {
  // 獲取交易記錄
  getUserTransactions: {
    query: z.object({
      limit: z.coerce.number().int().positive().max(100).optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
      type: z.enum(["recharge", "purchase", "refund", "reward", "deduct"]).optional(),
      status: z.enum(["pending", "completed", "failed", "cancelled"]).optional(),
      startDate: commonSchemas.dateString,
      endDate: commonSchemas.dateString,
    }),
  },

  // 獲取交易統計
  getTransactionStats: {
    query: z.object({
      startDate: commonSchemas.dateString,
      endDate: commonSchemas.dateString,
    }),
  },

  // 獲取交易詳情
  getTransaction: {
    params: z.object({
      transactionId: commonSchemas.transactionId,
    }),
  },

  // 清除所有交易（超級管理員）
  clearAllTransactions: {
    // 無參數
  },

  // 刪除指定用戶交易（管理員）
  deleteUserTransactions: {
    params: z.object({
      targetUserId: commonSchemas.userId,
    }),
  },
};

/**
 * 道具相關的驗證 schemas
 */
export const potionSchemas = {
  // 獲取可購買道具 - 無參數
  getAvailablePotions: {
    // 無參數
  },

  // 獲取活躍道具 - 無參數
  getActivePotions: {
    // 無參數
  },

  // 購買記憶增強
  purchaseMemoryBoost: {
    body: z.object({
      idempotencyKey: commonSchemas.idempotencyKey,
    }),
  },

  // 購買腦力激盪
  purchaseBrainBoost: {
    body: z.object({
      idempotencyKey: commonSchemas.idempotencyKey,
    }),
  },

  // 使用記憶增強
  useMemoryBoost: {
    body: z.object({
      characterId: commonSchemas.characterId,
    }),
  },

  // 使用腦力激盪
  useBrainBoost: {
    body: z.object({
      characterId: commonSchemas.characterId,
    }),
  },

  // 檢查角色藥水效果
  getCharacterEffects: {
    params: z.object({
      characterId: commonSchemas.characterId,
    }),
  },
};

/**
 * 禮物相關的驗證 schemas
 */
export const giftSchemas = {
  // 禮物 ID 格式（只允許字母、數字、底線、連字號）
  giftId: z.string()
    .min(1, "禮物 ID 不得為空")
    .regex(/^[a-z0-9_-]+$/i, "禮物 ID 只能包含字母、數字、底線、連字號")
    .trim(),

  // 送禮物
  sendGift: {
    body: z.object({
      characterId: commonSchemas.characterId,
      giftId: z.string()
        .min(1, "禮物 ID 不得為空")
        .regex(/^[a-z0-9_-]+$/i, "禮物 ID 只能包含字母、數字、底線、連字號")
        .trim(),
      requestId: z.string().min(1, "請提供請求ID以防止重複扣款").trim(),
    }),
  },

  // 獲取送禮記錄
  getGiftHistory: {
    query: z.object({
      characterId: commonSchemas.characterId.optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
    }),
  },

  // 獲取禮物統計
  getCharacterStats: {
    params: z.object({
      characterId: commonSchemas.characterId,
    }),
  },

  // 獲取禮物價格 - 無參數
  getPricing: {
    // 無參數
  },

  // 生成禮物回應
  giftResponse: {
    body: z.object({
      characterData: z.object({
        id: z.string(),
        name: z.string(),
        // 其他角色資料欄位可選
      }).passthrough(), // 允許額外欄位
      giftId: z.string()
        .min(1, "禮物 ID 不得為空")
        .regex(/^[a-z0-9_-]+$/i, "禮物 ID 只能包含字母、數字、底線、連字號")
        .trim(),
      generatePhoto: z.boolean().optional(),
    }),
  },
};

/**
 * 會員相關的驗證 schemas
 */
export const membershipSchemas = {
  // 會員等級枚舉
  tier: z.enum(["free", "vip", "vvip"], {
    required_error: "需提供會員等級",
    invalid_type_error: "無效的會員等級",
  }),

  // 獲取會員方案 - 無參數
  getPlans: {
    // 無參數
  },

  // 升級會員
  upgradeMembership: {
    body: z.object({
      tier: z.enum(["vip", "vvip"], {
        required_error: "需提供目標會員等級",
        invalid_type_error: "只能升級到 VIP 或 VVIP",
      }),
      paymentInfo: z.record(z.any()).optional(),
      idempotencyKey: z.string().min(1, "請提供冪等性鍵以防止重複購買").trim(),
    }),
  },

  // 取消會員
  cancelMembership: {
    body: z.object({
      reason: z.string().max(500, "取消原因不得超過 500 字").optional(),
    }),
  },
};

/**
 * 資產相關的驗證 schemas
 */
export const assetSchemas = {
  // SKU 格式驗證
  sku: z.string()
    .min(1, "SKU 不得為空")
    .regex(/^[a-z0-9_-]+$/i, "SKU 只能包含字母、數字、底線、連字號")
    .trim(),

  // 購買資產套餐
  purchasePackage: {
    body: z.object({
      sku: z.string()
        .min(1, "SKU 不得為空")
        .regex(/^[a-z0-9_-]+$/i, "SKU 只能包含字母、數字、底線、連字號")
        .trim(),
      idempotencyKey: z.string().min(1, "請提供冪等性鍵以防止重複購買").trim(),
    }),
  },

  // 獲取用戶資產 - 無參數
  getUserAssets: {
    // 無參數
  },

  // 使用解鎖券
  useUnlockTicket: {
    body: z.object({
      characterId: commonSchemas.characterId,
      ticketType: z.enum(["characterUnlockCards", "photoUnlockCards", "videoUnlockCards", "voiceUnlockCards"], {
        required_error: "需提供解鎖券類型",
      }),
    }),
  },
};

/**
 * 特殊驗證 schemas（補充）
 */
export const extraValidations = {
  // 年齡驗證（0-150 歲）
  age: z.coerce.number()
    .int("年齡必須為整數")
    .min(0, "年齡不得小於 0")
    .max(150, "年齡不得超過 150")
    .optional(),

  // 金額驗證（1-1,000,000）
  largeAmount: z.coerce.number()
    .int("金額必須為整數")
    .positive("金額必須為正數")
    .max(1000000, "金額不得超過 1,000,000"),

  // 字串長度限制
  shortString: z.string().min(1).max(50).trim(),
  mediumString: z.string().min(1).max(200).trim(),
  longString: z.string().min(1).max(500).trim(),
  veryLongString: z.string().min(1).max(2000).trim(),
};

export default {
  validateRequest,
  commonSchemas,
  conversationSchemas,
  userSchemas,
  orderSchemas,
  coinSchemas,
  transactionSchemas,
  potionSchemas,
  giftSchemas,
  membershipSchemas,
  assetSchemas,
  extraValidations,
};
