import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole, requireRole } from "../middleware/admin.middleware.js";

const router = express.Router();

/**
 * GET /api/membership-tiers
 * 獲取所有會員等級配置
 * 🔒 權限：moderator 以上
 */
router.get("/", requireMinRole("moderator"), async (req, res) => {
  try {
    const tiersSnapshot = await db.collection("membership_tiers").get();

    const tiers = [];
    tiersSnapshot.forEach((doc) => {
      tiers.push({ id: doc.id, ...doc.data() });
    });

    res.json({ tiers, total: tiers.length });
  } catch (error) {
    res.status(500).json({ error: "獲取會員等級配置失敗" });
  }
});

/**
 * GET /api/membership-tiers/:tierId
 * 獲取單個會員等級詳情
 * 🔒 權限：moderator 以上
 */
router.get("/:tierId", requireMinRole("moderator"), async (req, res) => {
  try {
    const { tierId } = req.params;
    const tierDoc = await db.collection("membership_tiers").doc(tierId).get();

    if (!tierDoc.exists) {
      return res.status(404).json({ error: "會員等級不存在" });
    }

    res.json({ id: tierDoc.id, ...tierDoc.data() });
  } catch (error) {
    res.status(500).json({ error: "獲取會員等級詳情失敗" });
  }
});

/**
 * PATCH /api/membership-tiers/:tierId
 * 更新會員等級配置
 * 🔒 權限：僅限 super_admin（定價策略影響營收，極度敏感）
 */
router.patch("/:tierId", requireRole("super_admin"), async (req, res) => {
  try {
    const { tierId } = req.params;
    const updates = req.body;

    // 檢查會員等級是否存在
    const tierDoc = await db.collection("membership_tiers").doc(tierId).get();
    if (!tierDoc.exists) {
      return res.status(404).json({ error: "會員等級不存在" });
    }

    // ✅ 2025-12-03 更新：允許更新更多字段（訂閱週期價格、年訂閱獎勵、前端顯示配置）
    const allowedFields = [
      "name",
      "price",
      "currency",
      "billingCycle",
      "features",
      "status",
      // 訂閱週期價格
      "prices",
      // 年訂閱獎勵
      "yearlyBonus",
      // 前端顯示配置
      "label",
      "headline",
      "description",
      "highlight",
      "highlightColor",
      "cardGradient",
      "order",
      // 限制配置
      "limits",
    ];

    // 過濾只允許更新的字段
    const updateData = {};
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    // 如果沒有任何更新，返回錯誤
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "沒有提供任何更新數據" });
    }

    // 添加更新時間
    updateData.updatedAt = new Date().toISOString();

    // 更新會員等級
    await db.collection("membership_tiers").doc(tierId).update(updateData);

    // 獲取更新後的數據
    const updatedDoc = await db.collection("membership_tiers").doc(tierId).get();

    res.json({
      message: "會員等級配置更新成功",
      tier: { id: updatedDoc.id, ...updatedDoc.data() },
    });
  } catch (error) {
    res.status(500).json({ error: "更新會員等級配置失敗", message: error.message });
  }
});

// ==================== 功能對比表配置 ====================

/**
 * GET /api/membership-tiers/comparison/features
 * 獲取功能對比表配置
 * 🔒 權限：moderator 以上
 */
router.get("/comparison/features", requireMinRole("moderator"), async (req, res) => {
  try {
    const snapshot = await db.collection("comparison_features").orderBy("order").get();

    const features = [];
    snapshot.forEach((doc) => {
      features.push({ id: doc.id, ...doc.data() });
    });

    res.json({ features, total: features.length });
  } catch (error) {
    res.status(500).json({ error: "獲取功能對比表失敗" });
  }
});

/**
 * PATCH /api/membership-tiers/comparison/features/:categoryId
 * 更新功能對比表配置
 * 🔒 權限：僅限 super_admin
 */
router.patch("/comparison/features/:categoryId", requireRole("super_admin"), async (req, res) => {
  try {
    const { categoryId } = req.params;
    const updates = req.body;

    const docRef = db.collection("comparison_features").doc(categoryId);
    const doc = await docRef.get();

    if (!doc.exists) {
      // 如果不存在，創建新的
      await docRef.set({
        ...updates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await docRef.update({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }

    const updatedDoc = await docRef.get();

    res.json({
      message: "功能對比表更新成功",
      feature: { id: updatedDoc.id, ...updatedDoc.data() },
    });
  } catch (error) {
    res.status(500).json({ error: "更新功能對比表失敗", message: error.message });
  }
});

// ==================== 廣告限制配置 ====================

/**
 * GET /api/membership-tiers/ad-limits
 * 獲取廣告限制配置
 * 🔒 權限：moderator 以上
 */
router.get("/ad-limits", requireMinRole("moderator"), async (req, res) => {
  try {
    const doc = await db.collection("ad_limits").doc("config").get();

    if (!doc.exists) {
      return res.json({ adLimits: null });
    }

    res.json({ adLimits: doc.data() });
  } catch (error) {
    res.status(500).json({ error: "獲取廣告限制配置失敗" });
  }
});

/**
 * PATCH /api/membership-tiers/ad-limits
 * 更新廣告限制配置
 * 🔒 權限：僅限 super_admin
 */
router.patch("/ad-limits", requireRole("super_admin"), async (req, res) => {
  try {
    const updates = req.body;

    const docRef = db.collection("ad_limits").doc("config");

    await docRef.set(
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const updatedDoc = await docRef.get();

    res.json({
      message: "廣告限制配置更新成功",
      adLimits: updatedDoc.data(),
    });
  } catch (error) {
    res.status(500).json({ error: "更新廣告限制配置失敗", message: error.message });
  }
});

// ==================== 初始化配置 ====================

/**
 * POST /api/membership-tiers/initialize
 * 初始化資料庫配置（將預設值寫入 Firestore）
 * 🔒 權限：僅限 super_admin
 */
router.post("/initialize", requireRole("super_admin"), async (req, res) => {
  try {
    // 檢查是否已有資料
    const tiersSnapshot = await db.collection("membership_tiers").limit(1).get();

    if (!tiersSnapshot.empty) {
      return res.json({ initialized: false, message: "資料庫已有配置" });
    }

    // 這裡可以呼叫主應用的初始化服務
    // 或者直接在管理後台實現初始化邏輯
    res.json({
      initialized: false,
      message: "請使用主應用的 POST /api/config/initialize 端點初始化資料庫",
    });
  } catch (error) {
    res.status(500).json({ error: "初始化失敗", message: error.message });
  }
});

export default router;
