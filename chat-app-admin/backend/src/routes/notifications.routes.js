/**
 * 通知管理 API 路由
 * 管理後台用於管理系統通知
 */

import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole, requireRole } from "../middleware/admin.middleware.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

// 通知類型
const NOTIFICATION_TYPES = {
  SYSTEM: "system",
  CHARACTER: "character",
  MESSAGE: "message",
  REWARD: "reward",
  PROMOTION: "promotion",
};

// 通知優先級
const NOTIFICATION_PRIORITY = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

/**
 * GET /api/notifications
 * 獲取所有系統通知列表
 * 🔒 權限：moderator 以上
 */
router.get("/", requireMinRole("moderator"), async (req, res) => {
  try {
    const { limit = 50, activeOnly = false } = req.query;

    let query = db.collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(parseInt(limit));

    if (activeOnly === "true") {
      query = query.where("isActive", "==", true);
    }

    const snapshot = await query.get();
    const notifications = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        startDate: data.startDate?.toDate?.()?.toISOString() || null,
        endDate: data.endDate?.toDate?.()?.toISOString() || null,
      });
    });

    res.json({
      notifications,
      total: notifications.length,
    });
  } catch (error) {
    console.error("獲取通知列表失敗:", error);
    res.status(500).json({ error: "獲取通知列表失敗" });
  }
});

/**
 * GET /api/notifications/stats/summary
 * 獲取通知統計摘要
 * 🔒 權限：moderator 以上
 * ⚠️ 注意：此路由必須在 /:id 之前定義，否則 "stats" 會被當作 ID 參數
 */
router.get("/stats/summary", requireMinRole("moderator"), async (req, res) => {
  try {
    const snapshot = await db.collection("notifications").get();

    let total = 0;
    let active = 0;
    let inactive = 0;
    const byCategory = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      total++;

      if (data.isActive) {
        active++;
      } else {
        inactive++;
      }

      const category = data.category || "未分類";
      byCategory[category] = (byCategory[category] || 0) + 1;
    });

    res.json({
      total,
      active,
      inactive,
      byCategory,
    });
  } catch (error) {
    console.error("獲取通知統計失敗:", error);
    res.status(500).json({ error: "獲取通知統計失敗" });
  }
});

/**
 * GET /api/notifications/:id
 * 獲取單個通知詳情
 * 🔒 權限：moderator 以上
 */
router.get("/:id", requireMinRole("moderator"), async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("notifications").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該通知" });
    }

    const data = doc.data();
    res.json({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      startDate: data.startDate?.toDate?.()?.toISOString() || null,
      endDate: data.endDate?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    console.error("獲取通知詳情失敗:", error);
    res.status(500).json({ error: "獲取通知詳情失敗" });
  }
});

/**
 * POST /api/notifications
 * 創建新的系統通知
 * 🔒 權限：admin 以上
 */
router.post("/", requireMinRole("admin"), async (req, res) => {
  try {
    const {
      title,
      message,
      fullContent,
      category,
      priority,
      actions,
      isActive,
      startDate,
      endDate,
    } = req.body;

    // 驗證必要字段
    if (!title || !message) {
      return res.status(400).json({
        error: "標題和內容為必填",
      });
    }

    const notificationData = {
      title,
      message,
      fullContent: fullContent || message,
      type: NOTIFICATION_TYPES.SYSTEM,
      category: category || "系統公告",
      priority: priority ?? NOTIFICATION_PRIORITY.NORMAL,
      actions: actions || [],
      isActive: isActive !== false,
      startDate: startDate ? new Date(startDate) : FieldValue.serverTimestamp(),
      endDate: endDate ? new Date(endDate) : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: req.user.uid,
    };

    const docRef = await db.collection("notifications").add(notificationData);

    res.status(201).json({
      message: "通知創建成功",
      id: docRef.id,
      notification: {
        id: docRef.id,
        ...notificationData,
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error("創建通知失敗:", error);
    res.status(500).json({ error: "創建通知失敗" });
  }
});

/**
 * PUT /api/notifications/:id
 * 更新系統通知
 * 🔒 權限：admin 以上
 */
router.put("/:id", requireMinRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      message,
      fullContent,
      category,
      priority,
      actions,
      isActive,
      startDate,
      endDate,
    } = req.body;

    const docRef = db.collection("notifications").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該通知" });
    }

    const updateData = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    };

    if (title !== undefined) updateData.title = title;
    if (message !== undefined) updateData.message = message;
    if (fullContent !== undefined) updateData.fullContent = fullContent;
    if (category !== undefined) updateData.category = category;
    if (priority !== undefined) updateData.priority = priority;
    if (actions !== undefined) updateData.actions = actions;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    await docRef.update(updateData);

    res.json({
      message: "通知更新成功",
      id,
    });
  } catch (error) {
    console.error("更新通知失敗:", error);
    res.status(500).json({ error: "更新通知失敗" });
  }
});

/**
 * DELETE /api/notifications/:id
 * 刪除系統通知
 * 🔒 權限：super_admin
 */
router.delete("/:id", requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("notifications").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該通知" });
    }

    await docRef.delete();

    res.json({
      message: "通知刪除成功",
      id,
    });
  } catch (error) {
    console.error("刪除通知失敗:", error);
    res.status(500).json({ error: "刪除通知失敗" });
  }
});

/**
 * POST /api/notifications/:id/toggle
 * 切換通知的啟用/停用狀態
 * 🔒 權限：admin 以上
 */
router.post("/:id/toggle", requireMinRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("notifications").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該通知" });
    }

    const currentStatus = doc.data().isActive;
    const newStatus = !currentStatus;

    await docRef.update({
      isActive: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    });

    res.json({
      message: `通知已${newStatus ? "啟用" : "停用"}`,
      id,
      isActive: newStatus,
    });
  } catch (error) {
    console.error("切換通知狀態失敗:", error);
    res.status(500).json({ error: "切換通知狀態失敗" });
  }
});

export default router;
