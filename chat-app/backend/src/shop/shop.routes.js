/**
 * 商城路由
 * 提供商品列表、價格資訊等
 */

import express from "express";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../../shared/utils/errorFormatter.js";
import { getFirestoreDb } from "../firebase/index.js";
import { relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import { createModuleLogger } from "../utils/logger.js";

const router = express.Router();
const db = getFirestoreDb();
const logger = createModuleLogger('Shop');

/**
 * GET /api/shop/products
 * 獲取所有商品（解鎖卡、道具）
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get("/api/shop/products", relaxedRateLimiter, async (req, res, next) => {
  try {
    const { category } = req.query;

    const products = {
      unlock_cards: [],
      potions: [],
      coin_packages: [],
    };

    // 如果指定了分類，只返回該分類
    const categoriesToFetch = category
      ? [category]
      : ['unlock_cards', 'potions', 'coin_packages'];

    // 獲取各類商品
    for (const cat of categoriesToFetch) {
      const snapshot = await db
        .collection(cat)
        .where('status', '==', 'active')
        .orderBy('order', 'asc')
        .get();

      products[cat] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    }

    sendSuccess(res, {
      products,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('獲取商品失敗:', error);
    next(error);
  }
});

/**
 * GET /api/shop/products/:collection/:id
 * 獲取單一商品詳情
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get("/api/shop/products/:collection/:id", relaxedRateLimiter, async (req, res, next) => {
  try {
    const { collection, id } = req.params;

    // 驗證集合名稱
    const validCollections = ['unlock_cards', 'potions', 'coin_packages'];
    if (!validCollections.includes(collection)) {
      return sendError(res, "VALIDATION_ERROR", "無效的商品分類", {
        collection,
        validCollections,
      });
    }

    const doc = await db.collection(collection).doc(id).get();

    if (!doc.exists) {
      return sendError(res, "RESOURCE_NOT_FOUND", "商品不存在", {
        collection,
        id,
      });
    }

    sendSuccess(res, {
      product: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    logger.error('獲取商品詳情失敗:', error);
    next(error);
  }
});

/**
 * GET /api/shop/categories
 * 獲取商城分類資訊
 * ✅ 速率限制：60次/分鐘（讀取操作）
 */
router.get("/api/shop/categories", relaxedRateLimiter, async (req, res, next) => {
  try {
    const categories = [
      {
        id: 'coins',
        name: '金幣',
        description: '購買金幣用於各種功能',
        icon: '💰',
        order: 1,
      },
      {
        id: 'character-unlock',
        name: '角色解鎖',
        description: '解鎖與特定角色 7 天無限對話',
        icon: '🎭',
        order: 2,
      },
      {
        id: 'photo-unlock',
        name: '拍照功能',
        description: '解鎖 AI 生成角色照片功能',
        icon: '📸',
        order: 3,
      },
      {
        id: 'video-unlock',
        name: '影片功能',
        description: '解鎖 AI 生成角色影片功能',
        icon: '🎬',
        order: 4,
      },
      {
        id: 'voice-unlock',
        name: '語音功能',
        description: '解鎖角色語音對話功能',
        icon: '🔊',
        order: 5,
      },
      {
        id: 'potions',
        name: '道具',
        description: '增強對話體驗的特殊道具',
        icon: '🧪',
        order: 6,
      },
    ];

    sendSuccess(res, { categories });
  } catch (error) {
    logger.error('獲取分類失敗:', error);
    next(error);
  }
});

export default router;
