import express from "express";
import { db } from "../firebase/index.js";
import { getCached, CACHE_TTL } from "../utils/firestoreCache.js";

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * 獲取儀表板統計數據
 */
router.get("/stats", async (req, res) => {
  try {
    // 使用快取（10 分鐘 TTL）以減少 Firestore 讀取成本
    const stats = await getCached(
      'admin:dashboard:stats',
      async () => {
        // ✅ 使用 count() 查詢大幅降低成本（60-80% 節省）
        const [usersCount, conversationsCount, charactersCount, transactionsSnapshot] =
          await Promise.all([
            db.collection("users").count().get(),
            db.collection("conversations").count().get(),
            db.collection("characters").where("status", "==", "active").count().get(),
            db.collection("transactions").where("status", "==", "completed").get(),
          ]);

        // 計算總營收（從已完成的交易中計算）
        let totalRevenue = 0;
        transactionsSnapshot.forEach((doc) => {
          const transaction = doc.data();
          if (transaction.type === "purchase" && transaction.amount > 0) {
            // 假設 1 金幣 = 1 元（根據實際情況調整）
            totalRevenue += Math.abs(transaction.amount);
          }
        });

        return {
          totalUsers: usersCount.data().count,
          totalConversations: conversationsCount.data().count,
          activeCharacters: charactersCount.data().count,
          totalRevenue: totalRevenue,
        };
      },
      CACHE_TTL.DASHBOARD  // 10 分鐘快取
    );

    res.json({ success: true, stats });
  } catch (error) {
    console.error("獲取儀表板統計失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取儀表板統計失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/dashboard/user-trends
 * 獲取用戶增長趨勢（過去30天）
 */
router.get("/user-trends", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    // 使用快取（15 分鐘 TTL），快取鍵包含天數參數
    const trend = await getCached(
      `admin:dashboard:user-trends:${days}`,
      async () => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // ✅ 使用日期範圍查詢，只讀取需要的用戶（節省 90% 成本）
        // Firestore 會自動為單字段範圍查詢創建索引
        const usersSnapshot = await db.collection("users")
          .where("createdAt", ">=", startDate)
          .where("createdAt", "<=", endDate)
          .get();

        // 按日期分組統計
        const trendData = {};
        for (let i = 0; i < days; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split("T")[0];
          trendData[dateStr] = 0;
        }

        // 統計每天的新增用戶
        usersSnapshot.forEach((doc) => {
          const user = doc.data();
          if (user.createdAt) {
            let createdDate;
            if (user.createdAt.toDate) {
              createdDate = user.createdAt.toDate();
            } else {
              createdDate = new Date(user.createdAt);
            }

            const dateStr = createdDate.toISOString().split("T")[0];
            if (trendData[dateStr] !== undefined) {
              trendData[dateStr]++;
            }
          }
        });

        // 轉換為數組格式
        const dates = Object.keys(trendData).sort();
        const values = dates.map((date) => trendData[date]);

        return {
          dates,
          values,
        };
      },
      CACHE_TTL.TRENDS  // 15 分鐘快取
    );

    res.json({
      success: true,
      trend,
    });
  } catch (error) {
    console.error("獲取用戶趨勢失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取用戶趨勢失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/dashboard/conversation-trends
 * 獲取對話活躍度趨勢（過去30天）
 */
router.get("/conversation-trends", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    // 使用快取（15 分鐘 TTL），快取鍵包含天數參數
    const trend = await getCached(
      `admin:dashboard:conversation-trends:${days}`,
      async () => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // ✅ 使用日期範圍查詢，只讀取需要的對話（節省 90% 成本）
        // Firestore 會自動為單字段範圍查詢創建索引
        const conversationsSnapshot = await db.collection("conversations")
          .where("updatedAt", ">=", startDate)
          .where("updatedAt", "<=", endDate)
          .get();

        // 按日期分組統計
        const trendData = {};
        for (let i = 0; i < days; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split("T")[0];
          trendData[dateStr] = 0;
        }

        // 統計每天的活躍對話數（根據 updatedAt）
        conversationsSnapshot.forEach((doc) => {
          const conversation = doc.data();
          if (conversation.updatedAt) {
            let updatedDate;
            if (conversation.updatedAt.toDate) {
              updatedDate = conversation.updatedAt.toDate();
            } else {
              updatedDate = new Date(conversation.updatedAt);
            }

            const dateStr = updatedDate.toISOString().split("T")[0];
            if (trendData[dateStr] !== undefined) {
              trendData[dateStr]++;
            }
          }
        });

        // 轉換為數組格式
        const dates = Object.keys(trendData).sort();
        const values = dates.map((date) => trendData[date]);

        return {
          dates,
          values,
        };
      },
      CACHE_TTL.TRENDS  // 15 分鐘快取
    );

    res.json({
      success: true,
      trend,
    });
  } catch (error) {
    console.error("獲取對話趨勢失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取對話趨勢失敗",
      message: error.message,
    });
  }
});

export default router;
