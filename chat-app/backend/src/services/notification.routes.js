/**
 * 通知 API 路由
 * 處理用戶通知的獲取、標記已讀等操作
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import {
  getUserNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
} from "./notification.service.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";
import { relaxedRateLimiter, standardRateLimiter } from "../middleware/rateLimiterConfig.js";

const router = express.Router();

/**
 * 獲取用戶通知列表
 * GET /api/notifications
 * 🔒 需要身份驗證
 * ✅ 速率限制：60次/分鐘
 *
 * Query: { limit: number }
 *
 * 返回：
 * - 通知列表（系統通知 + 用戶通知）
 * - 未讀數量
 */
router.get(
  "/api/notifications",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);

      const result = await getUserNotifications(userId, { limit });
      sendSuccess(res, result);
    } catch (error) {
      logger.error(`[通知] 獲取通知列表失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取通知列表失敗");
    }
  }
);

/**
 * 獲取未讀通知數量
 * GET /api/notifications/unread-count
 * 🔒 需要身份驗證
 * ✅ 速率限制：60次/分鐘
 */
router.get(
  "/api/notifications/unread-count",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const count = await getUnreadCount(userId);
      sendSuccess(res, { unreadCount: count });
    } catch (error) {
      logger.error(`[通知] 獲取未讀數量失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取未讀數量失敗");
    }
  }
);

/**
 * 獲取單個通知詳情
 * GET /api/notifications/:id
 * 🔒 需要身份驗證
 * ✅ 速率限制：60次/分鐘
 */
router.get(
  "/api/notifications/:id",
  requireFirebaseAuth,
  relaxedRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;

      const notification = await getNotificationById(userId, id);

      if (!notification) {
        return sendError(res, "NOT_FOUND", "找不到該通知");
      }

      sendSuccess(res, { notification });
    } catch (error) {
      logger.error(`[通知] 獲取通知詳情失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "獲取通知詳情失敗");
    }
  }
);

/**
 * 標記通知為已讀
 * POST /api/notifications/:id/read
 * 🔒 需要身份驗證
 * ✅ 速率限制：30次/分鐘
 */
router.post(
  "/api/notifications/:id/read",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;

      await markNotificationAsRead(userId, id);
      sendSuccess(res, { success: true, message: "已標記為已讀" });
    } catch (error) {
      logger.error(`[通知] 標記已讀失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "標記已讀失敗");
    }
  }
);

/**
 * 標記所有通知為已讀
 * POST /api/notifications/read-all
 * 🔒 需要身份驗證
 * ✅ 速率限制：30次/分鐘
 */
router.post(
  "/api/notifications/read-all",
  requireFirebaseAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const count = await markAllNotificationsAsRead(userId);
      sendSuccess(res, { success: true, markedCount: count });
    } catch (error) {
      logger.error(`[通知] 標記全部已讀失敗: ${error.message}`);
      sendError(res, "INTERNAL_SERVER_ERROR", "標記全部已讀失敗");
    }
  }
);

export default router;
