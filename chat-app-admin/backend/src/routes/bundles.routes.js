import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole } from "../middleware/admin.middleware.js";
import { relaxedAdminRateLimiter } from "../middleware/rateLimiterConfig.js";

const router = express.Router();

/**
 * GET /api/bundles
 * 獲取所有禮包配置（用於管理購買狀態時選擇）
 * 🔒 權限：moderator 以上
 * 🛡️ 速率限制：200 次/15 分鐘
 */
router.get("/", requireMinRole("moderator"), relaxedAdminRateLimiter, async (req, res) => {
  try {
    const bundlesRef = db.collection("bundle_packages");
    const snapshot = await bundlesRef.get();

    const packages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      packages.push({
        id: doc.id,
        name: data.name || doc.id,
        price: data.price,
        currency: data.currency || "TWD",
        purchaseLimit: data.purchaseLimit || "none",
        status: data.status || "active",
        contents: data.contents || {},
        order: data.order || 0,
      });
    });

    // 按 order 排序
    packages.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.json({
      success: true,
      packages,
    });
  } catch (error) {
    res.status(500).json({ error: "獲取禮包列表失敗", message: error.message });
  }
});

export default router;
