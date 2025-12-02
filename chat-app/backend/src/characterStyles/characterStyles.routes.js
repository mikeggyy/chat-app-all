import { Router } from "express";
import { asyncHandler, sendSuccess, sendError, createAdminRouteHandler } from "../utils/routeHelpers.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
// ✅ 2025-12-02 修復：移除 requireAdmin，改用 createAdminRouteHandler（已包含認證和權限檢查）
import {
  listCharacterStyles,
  getCharacterStyle,
  upsertCharacterStyle,
  deleteCharacterStyle,
} from "./characterStyles.service.js";
import { ADMIN_AUDIT_TYPES } from "../services/adminAudit.service.js";

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
 * ✅ 2025-12-02 遷移：使用 createAdminRouteHandler 統一處理認證、權限和審計
 */
characterStylesRouter.post(
  "/:id",
  requireFirebaseAuth,
  createAdminRouteHandler(
    async (req, res, adminId) => {
      const { id } = req.params;
      const styleData = req.body;

      // 驗證必填欄位
      if (!styleData.label || !styleData.era) {
        throw new Error("label 和 era 為必填欄位");
      }

      const style = await upsertCharacterStyle(id, styleData);
      return style;
    },
    {
      auditAction: ADMIN_AUDIT_TYPES.CONFIG_UPDATE,
      targetType: "config",
      getTargetId: (req) => `character-style:${req.params.id}`,
      requireSuperAdmin: false,
    }
  )
);

/**
 * DELETE /api/character-styles/:id
 * 刪除角色風格（管理員功能）
 * ✅ 2025-12-02 遷移：使用 createAdminRouteHandler 統一處理認證、權限和審計
 */
characterStylesRouter.delete(
  "/:id",
  requireFirebaseAuth,
  createAdminRouteHandler(
    async (req, res, adminId) => {
      const { id } = req.params;
      await deleteCharacterStyle(id);
      return { message: "風格已刪除" };
    },
    {
      auditAction: ADMIN_AUDIT_TYPES.CONFIG_UPDATE,
      targetType: "config",
      getTargetId: (req) => `character-style:${req.params.id}`,
      requireSuperAdmin: false,
    }
  )
);
