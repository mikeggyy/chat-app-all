/**
 * 交易記錄 API 路由
 */

import express from "express";
import {
  getUserTransactions,
  getTransaction,
  getUserTransactionStats,
  deleteUserTransactions,
  clearAllTransactions,
} from "./transaction.service.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
// ✅ 2025-12-02: 使用 createAdminRouteHandler 內建的權限檢查取代 requireAdmin/requireSuperAdmin
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { validateRequest, transactionSchemas } from "../middleware/validation.middleware.js";
import { createAdminRouteHandler } from "../utils/routeHelpers.js";
import { ADMIN_AUDIT_TYPES } from "../services/adminAudit.service.js";

const router = express.Router();

/**
 * GET /api/transactions
 * 獲取當前用戶的交易記錄
 */
router.get(
  "/",
  requireFirebaseAuth,
  validateRequest(transactionSchemas.getUserTransactions),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { limit, offset, type, status, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    if (type) options.type = type;
    if (status) options.status = status;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const transactions = await getUserTransactions(userId, options);

    sendSuccess(res, {
      userId,
      total: transactions.length,
      ...options,
      transactions,
    });
  } catch (error) {
    logger.error("獲取交易記錄失敗:", error);
    next(error);
  }
});

/**
 * GET /api/transactions/stats
 * 獲取當前用戶的交易統計
 */
router.get(
  "/stats",
  requireFirebaseAuth,
  validateRequest(transactionSchemas.getTransactionStats),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { startDate, endDate } = req.query;

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const stats = await getUserTransactionStats(userId, options);

    sendSuccess(res, {
      userId,
      ...stats,
    });
  } catch (error) {
    logger.error("獲取交易統計失敗:", error);
    next(error);
  }
});

/**
 * GET /api/transactions/:transactionId
 * 獲取單個交易記錄詳情
 */
router.get(
  "/:transactionId",
  requireFirebaseAuth,
  validateRequest(transactionSchemas.getTransaction),
  async (req, res, next) => {
  try {
    const userId = req.firebaseUser.uid;
    const { transactionId } = req.params;

    const transaction = await getTransaction(transactionId);

    if (!transaction) {
      return sendError(res, "RESOURCE_NOT_FOUND", "找不到該交易記錄", {
        transactionId,
      });
    }

    // 檢查權限（只能查看自己的交易）
    if (transaction.userId !== userId) {
      return sendError(res, "FORBIDDEN", "無權查看此交易記錄", {
        transactionId,
        userId,
      });
    }

    sendSuccess(res, { transaction });
  } catch (error) {
    logger.error("獲取交易詳情失敗:", error);
    next(error);
  }
});

/**
 * DELETE /api/transactions (超級管理員功能)
 * 清除所有交易記錄（測試用，極度危險）
 * ⚠️ 安全增強：只有超級管理員可執行此操作
 * ✅ 2025-12-02 遷移：使用 createAdminRouteHandler 統一處理審計日誌
 */
router.delete(
  "/",
  requireFirebaseAuth,
  validateRequest(transactionSchemas.clearAllTransactions),
  createAdminRouteHandler(
    async (req, res, adminId) => {
      const result = await clearAllTransactions();
      return result;
    },
    {
      auditAction: ADMIN_AUDIT_TYPES.DATA_DELETE,
      targetType: "system",
      getTargetId: () => "all_transactions",
      requireSuperAdmin: true,
    }
  )
);

/**
 * DELETE /api/transactions/user/:targetUserId (管理員功能)
 * 刪除指定用戶的所有交易記錄
 * 🔒 安全增強：使用 Firebase Custom Claims 驗證管理員權限
 * ✅ 2025-12-02 遷移：使用 createAdminRouteHandler 統一處理審計日誌
 */
router.delete(
  "/user/:targetUserId",
  requireFirebaseAuth,
  validateRequest(transactionSchemas.deleteUserTransactions),
  createAdminRouteHandler(
    async (req, res, adminId) => {
      const { targetUserId } = req.params;
      const result = await deleteUserTransactions(targetUserId);
      return {
        userId: targetUserId,
        ...result,
      };
    },
    {
      auditAction: ADMIN_AUDIT_TYPES.DATA_DELETE,
      targetType: "user",
      getTargetId: (req) => req.params.targetUserId,
      requireSuperAdmin: false,
    }
  )
);

export default router;
