/**
 * 訂單管理服務
 * 處理會員訂閱、金幣購買等訂單
 */

import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../utils/logger.js";

const ORDERS_COLLECTION = "orders";

/**
 * 訂單類型
 */
export const ORDER_TYPES = {
  MEMBERSHIP: "membership",       // 會員訂閱
  COINS: "coins",                 // 金幣購買
  FEATURE: "feature",             // 功能購買（拍照、影片等）
};

/**
 * 訂單狀態
 */
export const ORDER_STATUS = {
  PENDING: "pending",             // 待支付
  PROCESSING: "processing",       // 處理中
  COMPLETED: "completed",         // 已完成
  FAILED: "failed",               // 失敗
  REFUNDED: "refunded",           // 已退款
  CANCELLED: "cancelled",         // 已取消
};

/**
 * 支付方式
 */
export const PAYMENT_METHODS = {
  CREDIT_CARD: "credit_card",     // 信用卡
  LINE_PAY: "line_pay",           // LINE Pay
  APPLE_PAY: "apple_pay",         // Apple Pay
  GOOGLE_PAY: "google_pay",       // Google Pay
  COINS: "coins",                 // 金幣支付（內部交易）
};

/**
 * 生成訂單編號
 * 格式：ORD-YYYYMMDD-XXXXXX
 */
const generateOrderNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `ORD-${dateStr}-${random}`;
};

/**
 * 創建訂單
 * @param {Object} data - 訂單數據
 * @returns {Promise<Object>} 訂單記錄
 */
export const createOrder = async (data) => {
  const {
    userId,
    type,
    productId,
    productName,
    quantity = 1,
    amount,
    currency = "TWD",
    paymentMethod = PAYMENT_METHODS.CREDIT_CARD,
    metadata = {},
  } = data;

  // 驗證必要欄位
  if (!userId || !type || !productId || amount === undefined || amount === null) {
    throw new Error("訂單缺少必要欄位：userId, type, productId, amount");
  }

  if (!Object.values(ORDER_TYPES).includes(type)) {
    throw new Error(`無效的訂單類型：${type}`);
  }

  const db = getFirestoreDb();
  const orderRef = db.collection(ORDERS_COLLECTION).doc();

  const order = {
    id: orderRef.id,
    orderNumber: generateOrderNumber(),
    userId,
    type,
    productId,
    productName: productName || "",
    quantity,
    amount,
    currency,
    status: ORDER_STATUS.PENDING,
    paymentMethod,
    paymentProvider: null,
    paymentIntentId: null,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    completedAt: null,
    refundedAt: null,
  };

  await orderRef.set(order);

  logger.info(`[訂單服務] 創建訂單: ${order.orderNumber}, 用戶: ${userId}, 類型: ${type}, 金額: ${amount}`);

  return {
    ...order,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * 獲取訂單詳情
 * @param {string} orderId - 訂單 ID
 * @returns {Promise<Object|null>} 訂單記錄
 */
export const getOrder = async (orderId) => {
  const db = getFirestoreDb();
  const doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  };
};

/**
 * 根據訂單編號獲取訂單
 * @param {string} orderNumber - 訂單編號
 * @returns {Promise<Object|null>} 訂單記錄
 */
export const getOrderByNumber = async (orderNumber) => {
  const db = getFirestoreDb();
  const snapshot = await db
    .collection(ORDERS_COLLECTION)
    .where("orderNumber", "==", orderNumber)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  };
};

/**
 * 獲取用戶的訂單列表
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Array>} 訂單列表
 */
export const getUserOrders = async (userId, options = {}) => {
  const {
    limit = 50,
    offset = 0,
    type = null,
    status = null,
    startDate = null,
    endDate = null,
  } = options;

  const db = getFirestoreDb();
  let query = db
    .collection(ORDERS_COLLECTION)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc");

  // 添加類型過濾
  if (type) {
    query = query.where("type", "==", type);
  }

  // 添加狀態過濾
  if (status) {
    query = query.where("status", "==", status);
  }

  // 添加日期範圍過濾
  if (startDate) {
    query = query.where("createdAt", ">=", new Date(startDate));
  }
  if (endDate) {
    query = query.where("createdAt", "<=", new Date(endDate));
  }

  // 分頁
  if (offset > 0) {
    query = query.offset(offset);
  }
  query = query.limit(limit);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * 更新訂單狀態
 * @param {string} orderId - 訂單 ID
 * @param {string} status - 新狀態
 * @param {Object} metadata - 額外資訊
 * @returns {Promise<Object>} 更新後的訂單
 */
export const updateOrderStatus = async (orderId, status, metadata = {}) => {
  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw new Error(`無效的訂單狀態：${status}`);
  }

  const db = getFirestoreDb();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);

  const updateData = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // 根據狀態更新相應的時間戳
  if (status === ORDER_STATUS.COMPLETED) {
    updateData.completedAt = FieldValue.serverTimestamp();
  } else if (status === ORDER_STATUS.REFUNDED) {
    updateData.refundedAt = FieldValue.serverTimestamp();
  }

  // 如果有額外資訊，更新 metadata
  if (Object.keys(metadata).length > 0) {
    const doc = await orderRef.get();
    if (doc.exists) {
      const currentMetadata = doc.data().metadata || {};
      updateData.metadata = {
        ...currentMetadata,
        ...metadata,
      };
    }
  }

  await orderRef.update(updateData);

  logger.info(`[訂單服務] 更新訂單狀態: ${orderId}, 新狀態: ${status}`);

  return await getOrder(orderId);
};

/**
 * 更新訂單支付資訊
 * @param {string} orderId - 訂單 ID
 * @param {Object} paymentInfo - 支付資訊
 * @returns {Promise<Object>} 更新後的訂單
 */
export const updateOrderPaymentInfo = async (orderId, paymentInfo) => {
  const {
    paymentProvider,
    paymentIntentId,
    paymentMethod,
  } = paymentInfo;

  const db = getFirestoreDb();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);

  const updateData = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (paymentProvider) {
    updateData.paymentProvider = paymentProvider;
  }
  if (paymentIntentId) {
    updateData.paymentIntentId = paymentIntentId;
  }
  if (paymentMethod) {
    updateData.paymentMethod = paymentMethod;
  }

  await orderRef.update(updateData);

  logger.info(`[訂單服務] 更新訂單支付資訊: ${orderId}`);

  return await getOrder(orderId);
};

/**
 * 完成訂單（標記為已完成）
 * @param {string} orderId - 訂單 ID
 * @param {Object} metadata - 額外資訊
 * @returns {Promise<Object>} 更新後的訂單
 */
export const completeOrder = async (orderId, metadata = {}) => {
  return await updateOrderStatus(orderId, ORDER_STATUS.COMPLETED, metadata);
};

/**
 * 取消訂單
 * @param {string} orderId - 訂單 ID
 * @param {string} reason - 取消原因
 * @returns {Promise<Object>} 更新後的訂單
 */
export const cancelOrder = async (orderId, reason = "") => {
  const order = await getOrder(orderId);

  if (!order) {
    throw new Error("訂單不存在");
  }

  if (order.status === ORDER_STATUS.COMPLETED) {
    throw new Error("已完成的訂單無法取消，請使用退款功能");
  }

  if (order.status === ORDER_STATUS.REFUNDED) {
    throw new Error("已退款的訂單無法取消");
  }

  return await updateOrderStatus(orderId, ORDER_STATUS.CANCELLED, {
    cancelReason: reason,
    cancelledAt: new Date().toISOString(),
  });
};

/**
 * 退款訂單
 * @param {string} orderId - 訂單 ID
 * @param {Object} refundInfo - 退款資訊
 * @returns {Promise<Object>} 更新後的訂單
 */
export const refundOrder = async (orderId, refundInfo = {}) => {
  const order = await getOrder(orderId);

  if (!order) {
    throw new Error("訂單不存在");
  }

  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw new Error("只能退款已完成的訂單");
  }

  if (order.status === ORDER_STATUS.REFUNDED) {
    throw new Error("訂單已經退款");
  }

  const {
    refundReason = "",
    refundAmount = order.amount,
    refundedBy = "system",
  } = refundInfo;

  return await updateOrderStatus(orderId, ORDER_STATUS.REFUNDED, {
    refundReason,
    refundAmount,
    refundedBy,
    refundedAt: new Date().toISOString(),
  });
};

/**
 * 獲取訂單統計
 * @param {Object} options - 統計選項
 * @returns {Promise<Object>} 統計數據
 */
export const getOrderStats = async (options = {}) => {
  const {
    userId = null,
    startDate = null,
    endDate = null,
  } = options;

  const db = getFirestoreDb();
  let query = db.collection(ORDERS_COLLECTION);

  // 用戶過濾
  if (userId) {
    query = query.where("userId", "==", userId);
  }

  // 日期範圍過濾
  if (startDate) {
    query = query.where("createdAt", ">=", new Date(startDate));
  }
  if (endDate) {
    query = query.where("createdAt", "<=", new Date(endDate));
  }

  const snapshot = await query.get();

  const stats = {
    totalOrders: snapshot.size,
    totalRevenue: 0,
    totalRefunded: 0,
    byStatus: {},
    byType: {},
    byPaymentMethod: {},
  };

  snapshot.docs.forEach((doc) => {
    const order = doc.data();
    const status = order.status;
    const type = order.type;
    const paymentMethod = order.paymentMethod;

    // 按狀態統計
    if (!stats.byStatus[status]) {
      stats.byStatus[status] = {
        count: 0,
        totalAmount: 0,
      };
    }
    stats.byStatus[status].count++;
    stats.byStatus[status].totalAmount += order.amount || 0;

    // 按類型統計
    if (!stats.byType[type]) {
      stats.byType[type] = {
        count: 0,
        totalAmount: 0,
      };
    }
    stats.byType[type].count++;
    stats.byType[type].totalAmount += order.amount || 0;

    // 按支付方式統計
    if (paymentMethod) {
      if (!stats.byPaymentMethod[paymentMethod]) {
        stats.byPaymentMethod[paymentMethod] = {
          count: 0,
          totalAmount: 0,
        };
      }
      stats.byPaymentMethod[paymentMethod].count++;
      stats.byPaymentMethod[paymentMethod].totalAmount += order.amount || 0;
    }

    // 計算總營收（已完成的訂單）
    if (status === ORDER_STATUS.COMPLETED) {
      stats.totalRevenue += order.amount || 0;
    }

    // 計算總退款
    if (status === ORDER_STATUS.REFUNDED) {
      stats.totalRefunded += order.metadata?.refundAmount || order.amount || 0;
    }
  });

  return stats;
};

/**
 * 刪除用戶的所有訂單（管理員功能，謹慎使用）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 刪除結果
 */
export const deleteUserOrders = async (userId) => {
  const db = getFirestoreDb();
  const snapshot = await db
    .collection(ORDERS_COLLECTION)
    .where("userId", "==", userId)
    .get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }

  logger.warn(`[訂單服務] 刪除用戶所有訂單: ${userId}, 數量: ${snapshot.size}`);

  return {
    success: true,
    deletedCount: snapshot.size,
  };
};

/**
 * 清除所有訂單（測試用）
 * @returns {Promise<Object>} 刪除結果
 */
export const clearAllOrders = async () => {
  const db = getFirestoreDb();
  const snapshot = await db.collection(ORDERS_COLLECTION).get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }

  logger.warn(`[訂單服務] 清除所有訂單, 數量: ${snapshot.size}`);

  return {
    success: true,
    deletedCount: snapshot.size,
  };
};

export default {
  ORDER_TYPES,
  ORDER_STATUS,
  PAYMENT_METHODS,
  createOrder,
  getOrder,
  getOrderByNumber,
  getUserOrders,
  updateOrderStatus,
  updateOrderPaymentInfo,
  completeOrder,
  cancelOrder,
  refundOrder,
  getOrderStats,
  deleteUserOrders,
  clearAllOrders,
};
