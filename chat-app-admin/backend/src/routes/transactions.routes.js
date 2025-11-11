import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole } from "../middleware/admin.middleware.js";

const router = express.Router();

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

    // 日期範圍篩選
    if (startDate) {
      query = query.where("createdAt", ">=", new Date(startDate));
    }
    if (endDate) {
      query = query.where("createdAt", "<=", new Date(endDate));
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
        // 格式化時間戳
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
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
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
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
