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
import { isGuestUser } from "../../../../shared/config/testAccounts.js";

const router = express.Router();

/**
 * GET /api/transactions
 * 獲取當前用戶的交易記錄
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

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
router.get("/stats", async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

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
router.get("/:transactionId", async (req, res) => {
  try {
    const userId = req.userId;
    const { transactionId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

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
 * DELETE /api/transactions (管理員功能)
 * 清除所有交易記錄（測試用）
 */
router.delete("/", async (req, res) => {
  try {
    const userId = req.userId;

    // 只允許測試帳號使用
    if (!isGuestUser(userId) && userId !== "dev-user") {
      return res.status(403).json({
        success: false,
        message: "此功能僅供測試帳號使用",
      });
    }

    const result = await clearAllTransactions();

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/transactions/user/:userId (管理員功能)
 * 刪除指定用戶的所有交易記錄
 */
router.delete("/user/:targetUserId", async (req, res) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.params;

    // 只允許管理員或測試帳號使用
    if (!isGuestUser(userId) && userId !== "dev-user") {
      return res.status(403).json({
        success: false,
        message: "此功能僅供管理員使用",
      });
    }

    const result = await deleteUserTransactions(targetUserId);

    res.json({
      success: true,
      userId: targetUserId,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
