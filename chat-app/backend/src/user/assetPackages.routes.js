/**
 * 資產套餐列表 API 路由
 * 從 Firestore 獲取商品列表
 */

import express from "express";
import { getFirestoreDb } from "../firebase/index.js";
import { relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * 獲取所有解鎖卡套餐
 * GET /api/assets/packages
 * ✅ 速率限制：60次/分鐘（讀取操作）
 *
 * ⚠️ 2025-01-20 更新：統一使用 asset_packages 集合
 * 原因：解決前端顯示價格與後端扣款價格不一致的問題
 * 廢棄：unlock_cards 集合（已不再使用）
 */
router.get("/api/assets/packages", relaxedRateLimiter, async (req, res) => {
  try {
    const db = getFirestoreDb();

    // 改為從 asset_packages 讀取（統一數據來源）
    const snapshot = await db
      .collection("asset_packages")
      .where("status", "==", "active")
      .get();

    // 類別圖標映射表（補充缺失的 icon）
    const CATEGORY_ICONS = {
      'character-unlock': '🎭',
      'photo-unlock': '📸',
      'video-unlock': '🎬',
      'voice-unlock': '🔊',
      'create': '✨',
    };

    const packages = [];
    snapshot.forEach((doc) => {
      const data = doc.data();

      // 獲取圖標：優先使用數據中的 icon，否則使用類別默認圖標
      const icon = data.icon || data.emoji || CATEGORY_ICONS[data.category] || null;

      // 轉換為前端期望的格式（與舊 unlock_cards 格式兼容）
      packages.push({
        id: doc.id,
        sku: data.sku || doc.id,
        category: data.category,
        baseId: data.baseId || data.category,
        displayName: data.displayName || data.name || `${data.quantity} 張`,
        name: data.name,
        description: data.description || "",
        icon: icon,
        iconColor: data.iconColor,
        unitPrice: data.finalPrice || data.unitPrice,  // 使用 finalPrice 作為前端顯示價格
        finalPrice: data.finalPrice,
        quantity: data.quantity || 1,
        quantityUnit: data.quantityUnit || "張",
        basePrice: data.basePrice,
        originalPrice: data.originalPrice || null,
        discount: data.discountRate || 1,
        badge: data.badge || null,
        popular: data.popular || false,
        status: data.status,
        order: data.order || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // ✅ 修復：按 order 欄位排序（與後台設定一致）
    packages.sort((a, b) => {
      const orderA = a.order || 0;
      const orderB = b.order || 0;

      // 優先按 order 排序
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // order 相同時，按分類排序
      if (a.category !== b.category) {
        return (a.category || "").localeCompare(b.category || "");
      }

      // 同分類內按數量排序
      return (a.quantity || 0) - (b.quantity || 0);
    });

    logger.info(`[資產套餐API] 獲取解鎖卡套餐成功: ${packages.length} 個 (來源: asset_packages)`);

    sendSuccess(res, { packages });
  } catch (error) {
    logger.error("[資產套餐API] 獲取解鎖卡套餐失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取套餐列表失敗");
  }
});

/**
 * 獲取所有藥水商品
 * GET /api/potions/packages
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get("/api/potions/packages", relaxedRateLimiter, async (req, res) => {
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

    sendSuccess(res, { potions });
  } catch (error) {
    logger.error("[藥水商品API] 獲取藥水商品失敗:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", "獲取藥水列表失敗");
  }
});

export default router;
