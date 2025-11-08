/**
 * 資產套餐列表 API 路由
 * 從 Firestore 獲取商品列表
 */

import express from "express";
import { getFirestoreDb } from "../firebase/index.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * 獲取所有解鎖卡套餐
 * GET /api/assets/packages
 */
router.get("/api/assets/packages", async (req, res) => {
  try {
    const db = getFirestoreDb();
    const snapshot = await db
      .collection("unlock_cards")
      .where("status", "==", "active")
      .get();

    const packages = [];
    snapshot.forEach((doc) => {
      packages.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // 在記憶體中排序（避免需要 Firestore 複合索引）
    packages.sort((a, b) => (a.order || 0) - (b.order || 0));

    logger.info(`[資產套餐API] 獲取解鎖卡套餐成功: ${packages.length} 個`);

    res.json({
      success: true,
      packages,
    });
  } catch (error) {
    logger.error("[資產套餐API] 獲取解鎖卡套餐失敗:", error);
    res.status(500).json({
      success: false,
      message: "獲取套餐列表失敗",
    });
  }
});

/**
 * 獲取所有藥水商品
 * GET /api/potions/packages
 */
router.get("/api/potions/packages", async (req, res) => {
  try {
    const db = getFirestoreDb();
    const snapshot = await db
      .collection("potions")
      .where("status", "==", "active")
      .get();

    const potions = [];
    snapshot.forEach((doc) => {
      potions.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // 在記憶體中排序（避免需要 Firestore 複合索引）
    potions.sort((a, b) => (a.order || 0) - (b.order || 0));

    logger.info(`[藥水商品API] 獲取藥水商品成功: ${potions.length} 個`);

    res.json({
      success: true,
      potions,
    });
  } catch (error) {
    logger.error("[藥水商品API] 獲取藥水商品失敗:", error);
    res.status(500).json({
      success: false,
      message: "獲取藥水列表失敗",
    });
  }
});

export default router;
