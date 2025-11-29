/**
 * 訂單管理 API 路由
 */

import express from "express";
import {
  createOrder,
  getOrder,
  getOrderByNumber,
  getUserOrders,
  updateOrderStatus,
  completeOrder,
  cancelOrder,
  refundOrder,
  getOrderStats,
  clearAllOrders,
  ORDER_TYPES,
  ORDER_STATUS,
} from "./order.service.js";
import { isGuestUser } from "../../../../shared/config/testAccounts.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { validateRequest, orderSchemas } from "../middleware/validation.middleware.js";
import { sendSuccess, sendError } from "../../../../shared/utils/errorFormatter.js";
import {
  purchaseRateLimiter,
  standardRateLimiter,
  relaxedRateLimiter,
  strictRateLimiter,
} from "../middleware/rateLimiterConfig.js";

const router = express.Router();

/**
 * GET /api/orders
 * 獲取當前用戶的訂單列表
 */
router.get(
  "/",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(orderSchemas.getUserOrders),
  async (req, res) => {
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

    const orders = await getUserOrders(userId, options);

    sendSuccess(res, {
      userId,
      total: orders.length,
      ...options,
      orders,
    });
  } catch (error) {
    sendError(res, "SERVER_ERROR", error.message);
  }
});

/**
 * GET /api/orders/stats
 * 獲取訂單統計
 */
router.get(
  "/stats",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(orderSchemas.getOrderStats),
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;

    const { startDate, endDate } = req.query;

    const options = { userId };
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const stats = await getOrderStats(options);

    sendSuccess(res, {
      userId,
      ...stats,
    });
  } catch (error) {
    sendError(res, "SERVER_ERROR", error.message);
  }
});

/**
 * POST /api/orders
 * 創建新訂單
 */
router.post(
  "/",
  requireFirebaseAuth,
  purchaseRateLimiter,
  validateRequest(orderSchemas.createOrder),
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const {
        type,
        productId,
        productName,
        quantity,
        amount,
        currency,
        paymentMethod,
        metadata,
      } = req.body;

    const order = await createOrder({
      userId,
      type,
      productId,
      productName,
      quantity,
      amount,
      currency,
      paymentMethod,
      metadata,
    });

    sendSuccess(res, { order }, 201);
  } catch (error) {
    sendError(res, "SERVER_ERROR", error.message);
  }
});

/**
 * GET /api/orders/:orderId
 * 獲取訂單詳情
 */
router.get(
  "/:orderId",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(orderSchemas.getOrder),
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { orderId } = req.params;

    const order = await getOrder(orderId);

    if (!order) {
      return sendError(res, "RESOURCE_NOT_FOUND", "找不到該訂單", { orderId }, 404);
    }

    // 檢查權限（只能查看自己的訂單）
    if (order.userId !== userId) {
      return sendError(res, "FORBIDDEN", "無權查看此訂單", { orderId }, 403);
    }

    sendSuccess(res, { order });
  } catch (error) {
    sendError(res, "SERVER_ERROR", error.message);
  }
});

/**
 * GET /api/orders/number/:orderNumber
 * 根據訂單編號獲取訂單
 */
router.get(
  "/number/:orderNumber",
  requireFirebaseAuth,
  relaxedRateLimiter,
  validateRequest(orderSchemas.getOrderByNumber),
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { orderNumber } = req.params;

    const order = await getOrderByNumber(orderNumber);

    if (!order) {
      return sendError(res, "RESOURCE_NOT_FOUND", "找不到該訂單", { orderNumber }, 404);
    }

    // 檢查權限
    if (order.userId !== userId) {
      return sendError(res, "FORBIDDEN", "無權查看此訂單", { orderNumber }, 403);
    }

    sendSuccess(res, { order });
  } catch (error) {
    sendError(res, "SERVER_ERROR", error.message);
  }
});

/**
 * PATCH /api/orders/:orderId/complete
 * 完成訂單（支付成功後調用）
 */
router.patch(
  "/:orderId/complete",
  requireFirebaseAuth,
  standardRateLimiter,
  validateRequest(orderSchemas.completeOrder),
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { orderId } = req.params;
      const { metadata } = req.body;

    const order = await getOrder(orderId);

    if (!order) {
      return sendError(res, "RESOURCE_NOT_FOUND", "找不到該訂單", { orderId }, 404);
    }

    // 檢查權限
    if (order.userId !== userId) {
      return sendError(res, "FORBIDDEN", "無權操作此訂單", { orderId }, 403);
    }

    const updatedOrder = await completeOrder(orderId, metadata);

    sendSuccess(res, { order: updatedOrder });
  } catch (error) {
    sendError(res, "SERVER_ERROR", error.message);
  }
});

/**
 * PATCH /api/orders/:orderId/cancel
 * 取消訂單
 */
router.patch(
  "/:orderId/cancel",
  requireFirebaseAuth,
  standardRateLimiter,
  validateRequest(orderSchemas.cancelOrder),
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { orderId } = req.params;
      const { reason } = req.body;

    const order = await getOrder(orderId);

    if (!order) {
      return sendError(res, "RESOURCE_NOT_FOUND", "找不到該訂單", { orderId }, 404);
    }

    // 檢查權限
    if (order.userId !== userId) {
      return sendError(res, "FORBIDDEN", "無權操作此訂單", { orderId }, 403);
    }

    const updatedOrder = await cancelOrder(orderId, reason);

    sendSuccess(res, { order: updatedOrder });
  } catch (error) {
    sendError(res, "SERVER_ERROR", error.message);
  }
});

/**
 * PATCH /api/orders/:orderId/refund (管理員功能)
 * 退款訂單
 */
router.patch(
  "/:orderId/refund",
  requireFirebaseAuth,
  standardRateLimiter,
  validateRequest(orderSchemas.refundOrder),
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { orderId } = req.params;
      const { refundReason, refundAmount, refundedBy } = req.body;

      // 只允許管理員使用
      if (!isGuestUser(userId) && userId !== "dev-user") {
        return sendError(res, "FORBIDDEN", "此功能僅供管理員使用", {}, 403);
      }

    const updatedOrder = await refundOrder(orderId, {
      refundReason,
      refundAmount,
      refundedBy,
    });

    sendSuccess(res, { order: updatedOrder });
  } catch (error) {
    sendError(res, "SERVER_ERROR", error.message);
  }
});

/**
 * DELETE /api/orders (管理員功能)
 * 清除所有訂單（測試用）
 */
router.delete(
  "/",
  requireFirebaseAuth,
  strictRateLimiter,
  validateRequest(orderSchemas.clearAllOrders),
  async (req, res) => {
    try {
      const userId = req.firebaseUser.uid;

      // 只允許測試帳號使用
      if (!isGuestUser(userId) && userId !== "dev-user") {
        return sendError(res, "FORBIDDEN", "此功能僅供測試帳號使用", {}, 403);
      }

      const result = await clearAllOrders();

      sendSuccess(res, result);
    } catch (error) {
      sendError(res, "SERVER_ERROR", error.message);
    }
  }
);

export default router;
