/**
 * Character Creation 路由的 Zod 驗證 schemas
 */

import { z } from "zod";

/**
 * 通用 schemas
 */
const flowIdSchema = z.string().min(1, "flowId 不能為空");
const userIdSchema = z.string().min(1, "userId 不能為空");

/**
 * 創建角色流程驗證
 * POST /flows
 */
export const createFlowSchema = {
  body: z.object({
    persona: z.object({}).optional(),
    appearance: z.object({}).optional(),
    voice: z.object({}).optional(),
    status: z.string().optional(),
    metadata: z.object({}).optional(),
  }),
};

/**
 * 獲取流程驗證
 * GET /flows/:flowId
 */
export const getFlowSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
};

/**
 * 更新流程驗證
 * PATCH /flows/:flowId
 */
export const updateFlowSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
  body: z.record(z.any()).optional(),
};

/**
 * 更新創建步驟驗證
 * POST /flows/:flowId/steps/:stepId
 */
export const updateStepSchema = {
  params: z.object({
    flowId: flowIdSchema,
    stepId: z.enum(["persona", "appearance", "voice"], {
      errorMap: () => ({ message: "stepId 必須是 persona、appearance 或 voice 之一" }),
    }),
  }),
  body: z.record(z.any()).optional(),
};

/**
 * AI 描述生成驗證（無需 flowId）
 * POST /ai-description
 */
export const aiDescriptionSchema = {
  body: z.object({
    gender: z.string().optional(),
    styles: z.array(z.string()).optional().default([]),
    referenceInfo: z.any().optional(),
  }),
};

/**
 * AI 描述生成驗證（有 flowId）
 * POST /flows/:flowId/ai-description
 */
export const aiDescriptionWithFlowSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
  body: z.object({
    gender: z.string().optional(),
    styles: z.array(z.string()).optional().default([]),
    referenceInfo: z.any().optional(),
  }),
};

/**
 * AI 魔法師生成驗證
 * POST /flows/:flowId/ai-magician
 */
export const aiMagicianSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
};

/**
 * 生成圖片驗證
 * POST /flows/:flowId/generate-images
 */
export const generateImagesSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
  body: z.object({
    idempotencyKey: z.string().optional(),
    quality: z.enum(["standard", "high", "premium"]).optional().default("high"),
    count: z.number().int().min(1).max(10).optional().default(4),
    chargeAmount: z.number().optional(),
    chargeCurrency: z.string().optional(),
    chargeMetadata: z.record(z.any()).optional(),
    statusOnSuccess: z.string().optional(),
    statusOnFailure: z.string().optional(),
  }),
};

/**
 * 生成語音驗證
 * POST /flows/:flowId/generate
 */
export const generateVoiceSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
  body: z.object({
    idempotencyKey: z.string().optional(),
    previewBaseUrl: z.string().url().optional(),
    chargeAmount: z.number().optional(),
    chargeCurrency: z.string().optional(),
    statusOnSuccess: z.string().optional(),
    statusOnFailure: z.string().optional(),
  }),
};

/**
 * 記錄生成費用驗證
 * POST /flows/:flowId/charges
 */
export const recordChargeSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
  body: z.object({
    idempotencyKey: z.string().optional(),
  }).passthrough(), // 允許其他字段
};

/**
 * 清理圖片驗證
 * POST /flows/:flowId/cleanup-images
 */
export const cleanupImagesSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
  body: z.object({
    selectedImageUrl: z.string().url("必須提供有效的圖片 URL"),
    allImages: z.array(z.string().url()).min(1, "allImages 必須是非空陣列"),
  }),
};

/**
 * 取消創建驗證
 * POST /flows/:flowId/cancel
 */
export const cancelFlowSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
};

/**
 * 查詢創建限制驗證
 * GET /limits/:userId
 */
export const limitsSchema = {
  params: z.object({
    userId: userIdSchema,
  }),
};

/**
 * 查詢用戶生成記錄驗證
 * GET /generation-logs/user/:userId
 */
export const userGenerationLogsSchema = {
  params: z.object({
    userId: userIdSchema,
  }),
  query: z.object({
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
    offset: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 0)),
  }),
};

/**
 * 查詢單個生成記錄驗證
 * GET /generation-logs/:logId
 */
export const generationLogSchema = {
  params: z.object({
    logId: z.string().min(1, "logId 不能為空"),
  }),
};

/**
 * 查詢流程生成記錄驗證
 * GET /generation-logs/flow/:flowId
 */
export const flowGenerationLogSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
};

/**
 * 查詢所有生成記錄驗證（管理用）
 * GET /generation-logs
 */
export const allGenerationLogsSchema = {
  query: z.object({
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
    offset: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 0)),
    status: z.string().optional(),
  }),
};

/**
 * 查詢所有生成統計驗證
 * GET /generation-stats
 */
export const generationStatsSchema = {
  // 無參數需要驗證
};

/**
 * 查詢用戶生成統計驗證
 * GET /generation-stats/user/:userId
 */
export const userGenerationStatsSchema = {
  params: z.object({
    userId: userIdSchema,
  }),
};

/**
 * 使用創建角色卡驗證
 * POST /use-create-card
 */
export const useCreateCardSchema = {
  // 無 body 參數需要驗證（userId 從 token 獲取）
};

/**
 * 統一導出所有 schemas
 */
export const characterCreationSchemas = {
  createFlow: createFlowSchema,
  getFlow: getFlowSchema,
  updateFlow: updateFlowSchema,
  updateStep: updateStepSchema,
  aiDescription: aiDescriptionSchema,
  aiDescriptionWithFlow: aiDescriptionWithFlowSchema,
  aiMagician: aiMagicianSchema,
  generateImages: generateImagesSchema,
  generateVoice: generateVoiceSchema,
  recordCharge: recordChargeSchema,
  cleanupImages: cleanupImagesSchema,
  cancelFlow: cancelFlowSchema,
  limits: limitsSchema,
  userGenerationLogs: userGenerationLogsSchema,
  generationLog: generationLogSchema,
  flowGenerationLog: flowGenerationLogSchema,
  allGenerationLogs: allGenerationLogsSchema,
  generationStats: generationStatsSchema,
  userGenerationStats: userGenerationStatsSchema,
  useCreateCard: useCreateCardSchema,
};
