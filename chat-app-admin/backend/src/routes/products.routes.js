/**
 * 商品管理 API 路由
 */

import express from 'express';
import {
  getAllCoinPackages,
  createCoinPackage,
  updateCoinPackage,
  deleteCoinPackage,
  getAllGifts,
  createGift,
  updateGift,
  deleteGift,
  getAllPotions,
  createPotion,
  updatePotion,
  deletePotion,
} from './products.service.js';

const router = express.Router();

/**
 * ========== 金幣套餐路由 ==========
 */

// 獲取所有金幣套餐
router.get('/coins', async (req, res) => {
  try {
    const packages = await getAllCoinPackages();
    res.json({
      success: true,
      data: packages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 新增金幣套餐
router.post('/coins', async (req, res) => {
  try {
    const result = await createCoinPackage(req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 更新金幣套餐
router.put('/coins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateCoinPackage(id, req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 刪除金幣套餐
router.delete('/coins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCoinPackage(id);
    res.json({
      success: true,
      message: '刪除成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * ========== 禮物路由 ==========
 */

// 獲取所有禮物
router.get('/gifts', async (req, res) => {
  try {
    const gifts = await getAllGifts();
    res.json({
      success: true,
      data: gifts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 新增禮物
router.post('/gifts', async (req, res) => {
  try {
    const result = await createGift(req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 更新禮物
router.put('/gifts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateGift(id, req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 刪除禮物
router.delete('/gifts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteGift(id);
    res.json({
      success: true,
      message: '刪除成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * ========== 道具路由 ==========
 */

// 獲取所有道具
router.get('/potions', async (req, res) => {
  try {
    const potions = await getAllPotions();
    res.json({
      success: true,
      data: potions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 新增道具
router.post('/potions', async (req, res) => {
  try {
    const result = await createPotion(req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 更新道具
router.put('/potions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updatePotion(id, req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 刪除道具
router.delete('/potions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deletePotion(id);
    res.json({
      success: true,
      message: '刪除成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * ========== 通用商品管理路由 ==========
 */

import {
  getProductsByCollection,
  createProduct,
  updateProduct,
  deleteProduct,
} from './products-universal.service.js';

// 獲取指定集合的所有商品
router.get('/collection/:collectionName', async (req, res) => {
  try {
    const { collectionName } = req.params;
    const products = await getProductsByCollection(collectionName);
    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 新增商品到指定集合
router.post('/collection/:collectionName', async (req, res) => {
  try {
    const { collectionName } = req.params;
    const result = await createProduct(collectionName, req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 更新指定集合的商品
router.put('/collection/:collectionName/:id', async (req, res) => {
  try {
    const { collectionName, id } = req.params;
    const result = await updateProduct(collectionName, id, req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 刪除指定集合的商品
router.delete('/collection/:collectionName/:id', async (req, res) => {
  try {
    const { collectionName, id } = req.params;
    await deleteProduct(collectionName, id);
    res.json({
      success: true,
      message: '刪除成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
