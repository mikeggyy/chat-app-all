/**
 * 商品分類管理服務
 */

import { db } from '../firebase/index.js';
import logger from '../utils/logger.js';

/**
 * 獲取所有商品分類
 */
export const getAllCategories = async () => {
  try {
    const snapshot = await db.collection('product_categories').orderBy('order', 'asc').get();
    const categories = [];

    snapshot.forEach((doc) => {
      categories.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    logger.info(`[分類管理] 獲取商品分類，共 ${categories.length} 個`);
    return categories;
  } catch (error) {
    logger.error('[分類管理] 獲取商品分類失敗:', error);
    throw new Error('獲取商品分類失敗');
  }
};

/**
 * 新增商品分類
 */
export const createCategory = async (categoryData) => {
  try {
    const { id, ...data } = categoryData;

    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();

    await db.collection('product_categories').doc(id).set(data);

    logger.info(`[分類管理] 新增商品分類: ${id}`);
    return { id, ...data };
  } catch (error) {
    logger.error('[分類管理] 新增商品分類失敗:', error);
    throw new Error('新增商品分類失敗');
  }
};

/**
 * 更新商品分類
 */
export const updateCategory = async (id, categoryData) => {
  try {
    categoryData.updatedAt = new Date().toISOString();

    await db.collection('product_categories').doc(id).update(categoryData);

    logger.info(`[分類管理] 更新商品分類: ${id}`);
    return { id, ...categoryData };
  } catch (error) {
    logger.error('[分類管理] 更新商品分類失敗:', error);
    throw new Error('更新商品分類失敗');
  }
};

/**
 * 刪除商品分類
 */
export const deleteCategory = async (id) => {
  try {
    await db.collection('product_categories').doc(id).delete();
    logger.info(`[分類管理] 刪除商品分類: ${id}`);
  } catch (error) {
    logger.error('[分類管理] 刪除商品分類失敗:', error);
    throw new Error('刪除商品分類失敗');
  }
};

export default {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
