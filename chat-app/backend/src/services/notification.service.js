/**
 * 通知服務
 * 處理系統通知和用戶通知的 CRUD 操作
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

// 通知類型
export const NOTIFICATION_TYPES = {
  SYSTEM: "system",           // 系統公告（全局）
  CHARACTER: "character",     // 角色相關（收藏、評論等）
  MESSAGE: "message",         // 訊息通知
  REWARD: "reward",           // 獎勵通知
  PROMOTION: "promotion",     // 促銷活動
};

// 通知優先級
export const NOTIFICATION_PRIORITY = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

/**
 * 獲取系統通知列表（全局通知）
 * @param {Object} options - 查詢選項
 * @param {number} options.limit - 返回數量限制
 * @param {boolean} options.activeOnly - 只返回啟用的通知
 * @returns {Promise<Array>} 通知列表
 */
export const getSystemNotifications = async ({ limit = 50, activeOnly = true } = {}) => {
  const db = getFirestoreDb();
  let query = db.collection("notifications")
    .orderBy("priority", "desc")
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (activeOnly) {
    query = query.where("isActive", "==", true);
  }

  const snapshot = await query.get();
  const notifications = [];

  const now = new Date();

  snapshot.forEach((doc) => {
    const data = doc.data();
    // 檢查是否在有效期內
    const startDate = data.startDate?.toDate?.() || new Date(0);
    const endDate = data.endDate?.toDate?.() || new Date("2099-12-31");

    if (now >= startDate && now <= endDate) {
      notifications.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    }
  });

  return notifications;
};

/**
 * 獲取用戶的通知列表（系統通知 + 用戶專屬通知）
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 查詢選項
 * @param {number} options.limit - 返回數量限制
 * @returns {Promise<Object>} 通知列表和未讀數量
 */
export const getUserNotifications = async (userId, { limit = 50 } = {}) => {
  const db = getFirestoreDb();

  // 並行獲取系統通知和用戶通知
  const [systemNotifications, userNotificationsSnapshot, userReadStatusSnapshot] = await Promise.all([
    getSystemNotifications({ limit, activeOnly: true }),
    db.collection("users").doc(userId).collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get(),
    db.collection("users").doc(userId).collection("notification_read_status").get(),
  ]);

  // 解析用戶通知
  const userNotifications = [];
  userNotificationsSnapshot.forEach((doc) => {
    const data = doc.data();
    userNotifications.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      isUserNotification: true,
    });
  });

  // 解析已讀狀態
  const readStatus = {};
  userReadStatusSnapshot.forEach((doc) => {
    readStatus[doc.id] = doc.data().readAt;
  });

  // 合併通知並標記已讀狀態
  const allNotifications = [
    ...systemNotifications.map((n) => ({
      ...n,
      isRead: !!readStatus[n.id],
      isSystemNotification: true,
    })),
    ...userNotifications.map((n) => ({
      ...n,
      isRead: n.isRead || !!readStatus[n.id],
    })),
  ];

  // 按時間排序
  allNotifications.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });

  // 計算未讀數量
  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  return {
    notifications: allNotifications.slice(0, limit),
    unreadCount,
    total: allNotifications.length,
  };
};

/**
 * 獲取單個通知詳情
 * @param {string} userId - 用戶 ID
 * @param {string} notificationId - 通知 ID
 * @returns {Promise<Object|null>} 通知詳情
 */
export const getNotificationById = async (userId, notificationId) => {
  const db = getFirestoreDb();

  // 先嘗試從系統通知獲取
  const systemDoc = await db.collection("notifications").doc(notificationId).get();
  if (systemDoc.exists) {
    const data = systemDoc.data();
    // 獲取用戶的已讀狀態
    const readStatusDoc = await db
      .collection("users").doc(userId)
      .collection("notification_read_status").doc(notificationId)
      .get();

    return {
      id: systemDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      isRead: readStatusDoc.exists,
      isSystemNotification: true,
    };
  }

  // 再從用戶通知獲取
  const userDoc = await db
    .collection("users").doc(userId)
    .collection("notifications").doc(notificationId)
    .get();

  if (userDoc.exists) {
    const data = userDoc.data();
    return {
      id: userDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      isUserNotification: true,
    };
  }

  return null;
};

/**
 * 標記通知為已讀
 * @param {string} userId - 用戶 ID
 * @param {string} notificationId - 通知 ID
 * @returns {Promise<boolean>} 是否成功
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  const db = getFirestoreDb();

  // 記錄已讀狀態
  await db
    .collection("users").doc(userId)
    .collection("notification_read_status").doc(notificationId)
    .set({
      readAt: FieldValue.serverTimestamp(),
    });

  // 如果是用戶通知，也更新通知本身
  const userNotificationRef = db
    .collection("users").doc(userId)
    .collection("notifications").doc(notificationId);

  const userDoc = await userNotificationRef.get();
  if (userDoc.exists) {
    await userNotificationRef.update({
      isRead: true,
      readAt: FieldValue.serverTimestamp(),
    });
  }

  return true;
};

/**
 * 標記所有通知為已讀
 * @param {string} userId - 用戶 ID
 * @returns {Promise<number>} 標記的數量
 */
export const markAllNotificationsAsRead = async (userId) => {
  const db = getFirestoreDb();
  const BATCH_LIMIT = 450; // Firestore 限制 500，保留一些餘量
  let count = 0;
  let operations = [];

  // 獲取所有系統通知
  const systemNotifications = await getSystemNotifications({ activeOnly: true });
  for (const notification of systemNotifications) {
    operations.push({
      type: "set",
      ref: db.collection("users").doc(userId)
        .collection("notification_read_status").doc(notification.id),
      data: { readAt: FieldValue.serverTimestamp() },
    });
  }

  // 獲取用戶通知
  const userNotificationsSnapshot = await db
    .collection("users").doc(userId)
    .collection("notifications")
    .where("isRead", "==", false)
    .get();

  userNotificationsSnapshot.forEach((doc) => {
    operations.push({
      type: "update",
      ref: doc.ref,
      data: { isRead: true, readAt: FieldValue.serverTimestamp() },
    });
  });

  // 分批處理，每批最多 BATCH_LIMIT 個操作
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const batchOps = operations.slice(i, i + BATCH_LIMIT);

    for (const op of batchOps) {
      if (op.type === "set") {
        batch.set(op.ref, op.data);
      } else {
        batch.update(op.ref, op.data);
      }
      count++;
    }

    await batch.commit();
  }

  logger.info(`[通知] 用戶 ${userId} 標記了 ${count} 條通知為已讀`);

  return count;
};

/**
 * 發送用戶通知
 * @param {string} userId - 用戶 ID
 * @param {Object} notification - 通知內容
 * @returns {Promise<string>} 通知 ID
 */
export const sendUserNotification = async (userId, notification) => {
  const db = getFirestoreDb();

  const notificationData = {
    title: notification.title,
    message: notification.message,
    fullContent: notification.fullContent || notification.message,
    type: notification.type || NOTIFICATION_TYPES.SYSTEM,
    category: notification.category || "一般通知",
    actions: notification.actions || [],
    metadata: notification.metadata || {},
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  };

  const docRef = await db
    .collection("users").doc(userId)
    .collection("notifications")
    .add(notificationData);

  logger.info(`[通知] 發送用戶通知: userId=${userId}, notificationId=${docRef.id}`);

  return docRef.id;
};

/**
 * 創建系統通知（全局）
 * @param {Object} notification - 通知內容
 * @returns {Promise<string>} 通知 ID
 */
export const createSystemNotification = async (notification) => {
  const db = getFirestoreDb();

  const notificationData = {
    title: notification.title,
    message: notification.message,
    fullContent: notification.fullContent || notification.message,
    type: NOTIFICATION_TYPES.SYSTEM,
    category: notification.category || "系統公告",
    priority: notification.priority ?? NOTIFICATION_PRIORITY.NORMAL,
    actions: notification.actions || [],
    isActive: notification.isActive !== false,
    startDate: notification.startDate ? new Date(notification.startDate) : FieldValue.serverTimestamp(),
    endDate: notification.endDate ? new Date(notification.endDate) : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("notifications").add(notificationData);
  logger.info(`[通知] 創建系統通知: notificationId=${docRef.id}`);

  return docRef.id;
};

/**
 * 更新系統通知
 * @param {string} notificationId - 通知 ID
 * @param {Object} updates - 更新內容
 * @returns {Promise<boolean>} 是否成功
 */
export const updateSystemNotification = async (notificationId, updates) => {
  const db = getFirestoreDb();

  const updateData = {
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // 處理日期字段
  if (updates.startDate) {
    updateData.startDate = new Date(updates.startDate);
  }
  if (updates.endDate) {
    updateData.endDate = new Date(updates.endDate);
  }

  await db.collection("notifications").doc(notificationId).update(updateData);
  logger.info(`[通知] 更新系統通知: notificationId=${notificationId}`);

  return true;
};

/**
 * 刪除系統通知
 * @param {string} notificationId - 通知 ID
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteSystemNotification = async (notificationId) => {
  const db = getFirestoreDb();
  await db.collection("notifications").doc(notificationId).delete();
  logger.info(`[通知] 刪除系統通知: notificationId=${notificationId}`);
  return true;
};

/**
 * 獲取未讀通知數量
 * @param {string} userId - 用戶 ID
 * @returns {Promise<number>} 未讀數量
 */
export const getUnreadCount = async (userId) => {
  const { unreadCount } = await getUserNotifications(userId, { limit: 100 });
  return unreadCount;
};

export default {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  getSystemNotifications,
  getUserNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  sendUserNotification,
  createSystemNotification,
  updateSystemNotification,
  deleteSystemNotification,
  getUnreadCount,
};
