import express from "express";
import { db } from "../firebase/index.js";

const router = express.Router();

/**
 * GET /api/settings/system
 * 獲取系統設置
 */
router.get("/system", async (req, res) => {
  try {
    const configsSnapshot = await db.collection("system_configs").get();

    const configs = {};
    configsSnapshot.forEach((doc) => {
      configs[doc.id] = doc.data();
    });

    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: "獲取系統設置失敗" });
  }
});

/**
 * PUT /api/settings/system/:configId
 * 更新系統設置
 */
router.put("/system/:configId", async (req, res) => {
  try {
    // TODO: 實現設置更新邏輯
    res.status(501).json({ error: "功能尚未實現" });
  } catch (error) {
    res.status(500).json({ error: "更新系統設置失敗" });
  }
});

export default router;
