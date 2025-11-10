import { Router } from "express";
import { asyncHandler, sendSuccess, sendError } from "../utils/routeHelpers.js";
import { requireAdmin } from "../middleware/adminAuth.middleware.js";
import {
  listCharacterStyles,
  getCharacterStyle,
  upsertCharacterStyle,
  deleteCharacterStyle,
} from "./characterStyles.service.js";

export const characterStylesRouter = Router();

/**
 * GET /api/character-styles
 * 獲取所有啟用的角色風格
 */
characterStylesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const styles = await listCharacterStyles();
    sendSuccess(res, { styles });
  })
);

/**
 * GET /api/character-styles/:id
 * 獲取單個角色風格
 */
characterStylesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const style = await getCharacterStyle(id);

    if (!style) {
      return sendError(res, "找不到指定的風格", 404);
    }

    sendSuccess(res, style);
  })
);

/**
 * POST /api/character-styles/:id
 * 創建或更新角色風格（管理員功能）
 */
characterStylesRouter.post(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const styleData = req.body;

    // 驗證必填欄位
    if (!styleData.label || !styleData.era) {
      return sendError(res, "label 和 era 為必填欄位", 400);
    }

    const style = await upsertCharacterStyle(id, styleData);
    sendSuccess(res, style);
  })
);

/**
 * DELETE /api/character-styles/:id
 * 刪除角色風格（管理員功能）
 */
characterStylesRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await deleteCharacterStyle(id);
    sendSuccess(res, { message: "風格已刪除" });
  })
);
