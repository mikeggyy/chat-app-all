/**
 * Character Creation Router - Route Aggregator
 * 角色創建路由聚合器
 *
 * 此文件將所有角色創建相關的路由整合在一起
 * 各路由模塊按功能分類為：
 * - flow.routes.js: Flow 流程管理
 * - generation.routes.js: AI 生成操作
 * - generationLogs.routes.js: 生成日誌查詢
 * - stats.routes.js: 統計和限制
 */

import { Router } from "express";
import { flowRouter } from "./routes/flow.routes.js";
import { generationRouter } from "./routes/generation.routes.js";
import { generationLogsRouter } from "./routes/generationLogs.routes.js";
import { statsRouter } from "./routes/stats.routes.js";

const characterCreationRouter = Router();

// 掛載子路由
characterCreationRouter.use("/", flowRouter);
characterCreationRouter.use("/", generationRouter);
characterCreationRouter.use("/", generationLogsRouter);
characterCreationRouter.use("/", statsRouter);

export { characterCreationRouter };
