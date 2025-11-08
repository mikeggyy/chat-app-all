/**
 * 通用商品管理服務
 * 支持任意集合的商品管理
 */

import { db } from '../firebase/index.js';
import logger from '../utils/logger.js';

/**
 * 獲取指定集合的所有商品
 */
export const getProductsByCollection = async (collectionName) => {
  try {
    const snapshot = await db.collection(collectionName).get();
    const products = [];

    snapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    logger.info(`[商品管理] 獲取 ${collectionName} 商品，共 ${products.length} 個`);
    return products;
  } catch (error) {
    logger.error(`[商品管理] 獲取 ${collectionName} 商品失敗:`, error);
    throw new Error(`獲取商品失敗: ${error.message}`);
  }
};

/**
 * 新增商品到指定集合
 */
export const createProduct = async (collectionName, productData) => {
  try {
    const { id, ...data } = productData;

    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();

    await db.collection(collectionName).doc(id).set(data);

    logger.info(`[商品管理] 新增商品到 ${collectionName}: ${id}`);
    return { id, ...data };
  } catch (error) {
    logger.error(`[商品管理] 新增商品到 ${collectionName} 失敗:`, error);
    throw new Error(`新增商品失敗: ${error.message}`);
  }
};

/**
 * 更新指定集合的商品
 */
export const updateProduct = async (collectionName, id, productData) => {
  try {
    productData.updatedAt = new Date().toISOString();

    await db.collection(collectionName).doc(id).update(productData);

    logger.info(`[商品管理] 更新 ${collectionName} 商品: ${id}`);
    return { id, ...productData };
  } catch (error) {
    logger.error(`[商品管理] 更新 ${collectionName} 商品失敗:`, error);
    throw new Error(`更新商品失敗: ${error.message}`);
  }
};

/**
 * 刪除指定集合的商品
 */
export const deleteProduct = async (collectionName, id) => {
  try {
    await db.collection(collectionName).doc(id).delete();
    logger.info(`[商品管理] 刪除 ${collectionName} 商品: ${id}`);
  } catch (error) {
    logger.error(`[商品管理] 刪除 ${collectionName} 商品失敗:`, error);
    throw new Error(`刪除商品失敗: ${error.message}`);
  }
};

export default {
  getProductsByCollection,
  createProduct,
  updateProduct,
  deleteProduct,
};
