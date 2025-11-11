/**
 * 商城路由
 * 提供商品列表、價格資訊等
 */

import express from "express";
import { getFirestoreDb } from "../firebase/index.js";
import { createModuleLogger } from "../utils/logger.js";

const router = express.Router();
const db = getFirestoreDb();
const logger = createModuleLogger('Shop');

/**
 * GET /api/shop/products
 * 獲取所有商品（解鎖卡、道具）
 */
router.get("/api/shop/products", async (req, res) => {
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

    res.json({
      success: true,
      products,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('獲取商品失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取商品失敗',
    });
  }
});

/**
 * GET /api/shop/products/:collection/:id
 * 獲取單一商品詳情
 */
router.get("/api/shop/products/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params;

    // 驗證集合名稱
    const validCollections = ['unlock_cards', 'potions', 'coin_packages'];
    if (!validCollections.includes(collection)) {
      return res.status(400).json({
        success: false,
        error: '無效的商品分類',
      });
    }

    const doc = await db.collection(collection).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: '商品不存在',
      });
    }

    res.json({
      success: true,
      product: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    logger.error('獲取商品詳情失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取商品詳情失敗',
    });
  }
});

/**
 * GET /api/shop/categories
 * 獲取商城分類資訊
 */
router.get("/api/shop/categories", async (req, res) => {
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

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    logger.error('獲取分類失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取分類失敗',
    });
  }
});

export default router;
