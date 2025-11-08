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

const router = express.Router();

/**
 * GET /api/orders
 * 獲取當前用戶的訂單列表
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

    const orders = await getUserOrders(userId, options);

    res.json({
      success: true,
      userId,
      total: orders.length,
      ...options,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/stats
 * 獲取訂單統計
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

    const options = { userId };
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const stats = await getOrderStats(options);

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
 * POST /api/orders
 * 創建新訂單
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

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

    // 驗證必要欄位
    if (!type || !productId || amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: "缺少必要欄位：type, productId, amount",
      });
    }

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

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/:orderId
 * 獲取訂單詳情
 */
router.get("/:orderId", async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const order = await getOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "找不到該訂單",
      });
    }

    // 檢查權限（只能查看自己的訂單）
    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "無權查看此訂單",
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/number/:orderNumber
 * 根據訂單編號獲取訂單
 */
router.get("/number/:orderNumber", async (req, res) => {
  try {
    const userId = req.userId;
    const { orderNumber } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const order = await getOrderByNumber(orderNumber);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "找不到該訂單",
      });
    }

    // 檢查權限
    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "無權查看此訂單",
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * PATCH /api/orders/:orderId/complete
 * 完成訂單（支付成功後調用）
 */
router.patch("/:orderId/complete", async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const { metadata } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const order = await getOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "找不到該訂單",
      });
    }

    // 檢查權限
    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "無權操作此訂單",
      });
    }

    const updatedOrder = await completeOrder(orderId, metadata);

    res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * PATCH /api/orders/:orderId/cancel
 * 取消訂單
 */
router.patch("/:orderId/cancel", async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "請先登入",
      });
    }

    const order = await getOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "找不到該訂單",
      });
    }

    // 檢查權限
    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "無權操作此訂單",
      });
    }

    const updatedOrder = await cancelOrder(orderId, reason);

    res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * PATCH /api/orders/:orderId/refund (管理員功能)
 * 退款訂單
 */
router.patch("/:orderId/refund", async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const { refundReason, refundAmount, refundedBy } = req.body;

    // 只允許管理員使用
    if (!isGuestUser(userId) && userId !== "dev-user") {
      return res.status(403).json({
        success: false,
        message: "此功能僅供管理員使用",
      });
    }

    const updatedOrder = await refundOrder(orderId, {
      refundReason,
      refundAmount,
      refundedBy,
    });

    res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/orders (管理員功能)
 * 清除所有訂單（測試用）
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

    const result = await clearAllOrders();

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

export default router;
