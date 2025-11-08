/**
 * 商品分類管理 API 路由
 */

import express from 'express';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categories.service.js';

const router = express.Router();

// 獲取所有分類
router.get('/', async (req, res) => {
  try {
    const categories = await getAllCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 新增分類
router.post('/', async (req, res) => {
  try {
    const result = await createCategory(req.body);
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

// 更新分類
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateCategory(id, req.body);
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

// 刪除分類
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCategory(id);
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
