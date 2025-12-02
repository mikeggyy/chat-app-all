import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole } from "../middleware/admin.middleware.js";

const router = express.Router();

/**
 * 安全地將各種日期格式轉換為 ISO 字符串
 * 支援 Firestore Timestamp、Date 對象、ISO 字符串、數字時間戳
 */
function safeToISOString(dateValue) {
  if (!dateValue) return null;

  // Firestore Timestamp (有 toDate 方法)
  if (typeof dateValue.toDate === 'function') {
    return dateValue.toDate().toISOString();
  }

  // 已經是 Date 對象
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }

  // ISO 字符串
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  // 數字時間戳（毫秒或秒）
  if (typeof dateValue === 'number') {
    // 如果是秒級時間戳，轉換為毫秒
    const timestamp = dateValue < 1e12 ? dateValue * 1000 : dateValue;
    return new Date(timestamp).toISOString();
  }

  // Firestore Timestamp 的 _seconds 格式
  if (dateValue._seconds !== undefined) {
    return new Date(dateValue._seconds * 1000).toISOString();
  }

  return null;
}

/**
 * GET /api/transactions
 * 獲取所有交易記錄（支援分頁和篩選）
 * 🔒 權限：admin 以上（財務數據敏感）
 */
router.get("/", requireMinRole("admin"), async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      userId = null,
      type = null,
      status = null,
      startDate = null,
      endDate = null,
    } = req.query;

    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;

    // 建立查詢
    let query = db.collection("transactions").orderBy("createdAt", "desc");

    // 篩選條件
    if (userId) {
      query = query.where("userId", "==", userId);
    }
    if (type) {
      query = query.where("type", "==", type);
    }
    if (status) {
      query = query.where("status", "==", status);
    }

    // ✅ 2025-12-01 修復：日期範圍驗證和邊界檢查
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      // 驗證日期格式
      if (start && isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          error: "startDate 格式無效",
        });
      }
      if (end && isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: "endDate 格式無效",
        });
      }

      // 檢查日期範圍不超過 90 天（防止查詢過大數據集）
      if (start && end) {
        const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 90) {
          return res.status(400).json({
            success: false,
            error: "日期範圍不能超過 90 天",
          });
        }
        if (daysDiff < 0) {
          return res.status(400).json({
            success: false,
            error: "startDate 不能晚於 endDate",
          });
        }
      }

      if (start) {
        query = query.where("createdAt", ">=", start);
      }
      if (end) {
        query = query.where("createdAt", "<=", end);
      }
    }

    // 獲取總數（先執行一次查詢）
    const countSnapshot = await query.get();
    const total = countSnapshot.size;

    // 分頁
    query = query.limit(limit).offset(offset);

    const snapshot = await query.get();
    const transactions = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // 獲取用戶資訊
      let userName = "未知用戶";
      let userEmail = "";
      if (data.userId) {
        try {
          const userDoc = await db.collection("users").doc(data.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userName = userData.displayName || userData.name || "未知用戶";
            userEmail = userData.email || "";
          }
        } catch (error) {
          console.error("獲取用戶資訊失敗:", error);
        }
      }

      transactions.push({
        id: doc.id,
        ...data,
        userName,
        userEmail,
        // 格式化時間戳（使用安全轉換函數）
        createdAt: safeToISOString(data.createdAt),
        updatedAt: safeToISOString(data.updatedAt),
      });
    }

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("獲取交易記錄失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取交易記錄失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/transactions/stats
 * 獲取交易統計資訊
 * 🔒 權限：admin 以上（財務統計敏感）
 */
router.get("/stats", requireMinRole("admin"), async (req, res) => {
  try {
    const snapshot = await db
      .collection("transactions")
      .where("status", "==", "completed")
      .get();

    const stats = {
      totalTransactions: snapshot.size,
      totalPurchased: 0,
      totalSpent: 0,
      totalRewarded: 0,
      totalRefunded: 0,
      byType: {},
      byStatus: {},
    };

    snapshot.docs.forEach((doc) => {
      const transaction = doc.data();
      const type = transaction.type;
      const status = transaction.status;
      const amount = transaction.amount || 0;

      // 按類型統計
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, totalAmount: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].totalAmount += amount;

      // 按狀態統計
      if (!stats.byStatus[status]) {
        stats.byStatus[status] = 0;
      }
      stats.byStatus[status]++;

      // 累計總額
      switch (type) {
        case "purchase":
          stats.totalPurchased += amount;
          break;
        case "spend":
          stats.totalSpent += Math.abs(amount);
          break;
        case "reward":
          stats.totalRewarded += amount;
          break;
        case "refund":
          stats.totalRefunded += amount;
          break;
      }
    });

    res.json({ success: true, stats });
  } catch (error) {
    console.error("獲取交易統計失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取交易統計失敗",
    });
  }
});

/**
 * GET /api/transactions/:id
 * 獲取單一交易記錄詳情
 * 🔒 權限：admin 以上（財務數據敏感）
 */
router.get("/:id", requireMinRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("transactions").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "交易記錄不存在",
      });
    }

    const data = doc.data();

    // 獲取用戶資訊
    let userName = "未知用戶";
    let userEmail = "";
    if (data.userId) {
      try {
        const userDoc = await db.collection("users").doc(data.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userName = userData.displayName || userData.name || "未知用戶";
          userEmail = userData.email || "";
        }
      } catch (error) {
        console.error("獲取用戶資訊失敗:", error);
      }
    }

    res.json({
      success: true,
      transaction: {
        id: doc.id,
        ...data,
        userName,
        userEmail,
        createdAt: safeToISOString(data.createdAt),
        updatedAt: safeToISOString(data.updatedAt),
      },
    });
  } catch (error) {
    console.error("獲取交易詳情失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取交易詳情失敗",
    });
  }
});

export default router;
