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
import { requireAdmin, requireSuperAdmin } from "../middleware/authorization.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /api/transactions
 * 獲取當前用戶的交易記錄
 */
router.get("/", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { limit, offset, type, status, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    };

    if (type) options.type = type;
    if (status) options.status = status;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const transactions = await getUserTransactions(userId, options);

    res.json({
      success: true,
      userId,
      total: transactions.length,
      ...options,
      transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/transactions/stats
 * 獲取當前用戶的交易統計
 */
router.get("/stats", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { startDate, endDate } = req.query;

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const stats = await getUserTransactionStats(userId, options);

    res.json({
      success: true,
      userId,
      ...stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/transactions/:transactionId
 * 獲取單個交易記錄詳情
 */
router.get("/:transactionId", requireFirebaseAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser.uid;
    const { transactionId } = req.params;

    const transaction = await getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "找不到該交易記錄",
      });
    }

    // 檢查權限（只能查看自己的交易）
    if (transaction.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "無權查看此交易記錄",
      });
    }

    res.json({
      success: true,
      transaction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/transactions (超級管理員功能)
 * 清除所有交易記錄（測試用，極度危險）
 * ⚠️ 安全增強：只有超級管理員可執行此操作
 */
router.delete("/", requireFirebaseAuth, requireSuperAdmin(), async (req, res) => {
  try {
    const adminUserId = req.firebaseUser.uid;
    const adminEmail = req.firebaseUser.email || '未知';

    // 🚨 高危操作審計日誌
    logger.error(`[安全審計 - 高危操作] 超級管理員清除所有交易記錄`, {
      action: 'CLEAR_ALL_TRANSACTIONS',
      adminUserId,
      adminEmail,
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      warning: '⚠️ 這是一個極度危險的操作！',
    });

    const result = await clearAllTransactions();

    // 記錄結果
    logger.error(`[安全審計 - 高危操作] 所有交易記錄已清除`, {
      adminUserId,
      deletedCount: result.deletedCount,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error(`[安全審計] 清除所有交易記錄失敗`, {
      error: error.message,
      adminUserId: req.firebaseUser?.uid,
    });

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/transactions/user/:targetUserId (管理員功能)
 * 刪除指定用戶的所有交易記錄
 * 🔒 安全增強：使用 Firebase Custom Claims 驗證管理員權限
 */
router.delete("/user/:targetUserId", requireFirebaseAuth, requireAdmin(), async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const adminUserId = req.firebaseUser.uid;
    const adminEmail = req.firebaseUser.email || '未知';

    // 🔍 審計日誌：記錄管理員操作
    logger.warn(`[安全審計] 管理員刪除交易記錄`, {
      action: 'DELETE_USER_TRANSACTIONS',
      adminUserId,
      adminEmail,
      targetUserId,
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    const result = await deleteUserTransactions(targetUserId);

    // 記錄結果
    logger.info(`[安全審計] 交易記錄刪除完成`, {
      adminUserId,
      targetUserId,
      deletedCount: result.deletedCount,
    });

    res.json({
      success: true,
      userId: targetUserId,
      ...result,
    });
  } catch (error) {
    logger.error(`[安全審計] 刪除交易記錄失敗`, {
      error: error.message,
      targetUserId: req.params.targetUserId,
      adminUserId: req.firebaseUser?.uid,
    });

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
