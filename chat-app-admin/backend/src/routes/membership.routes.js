import express from "express";
import { db } from "../firebase/index.js";

const router = express.Router();

/**
 * GET /api/membership-tiers
 * 獲取所有會員等級配置
 */
router.get("/", async (req, res) => {
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
 */
router.get("/:tierId", async (req, res) => {
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
 */
router.patch("/:tierId", async (req, res) => {
  try {
    const { tierId } = req.params;
    const updates = req.body;

    // 檢查會員等級是否存在
    const tierDoc = await db.collection("membership_tiers").doc(tierId).get();
    if (!tierDoc.exists) {
      return res.status(404).json({ error: "會員等級不存在" });
    }

    // 允許更新的字段
    const allowedFields = [
      "name",
      "price",
      "currency",
      "billingCycle",
      "features",
      "status",
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

export default router;
