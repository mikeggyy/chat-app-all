/**
 * 商品管理服務
 * 管理金幣套餐、禮物、道具
 */

import { db } from '../firebase/index.js';

/**
 * ========== 金幣套餐管理 ==========
 */

/**
 * 獲取所有金幣套餐
 */
export const getAllCoinPackages = async () => {
  try {
    const snapshot = await db.collection('coin_packages').get();
    const packages = [];

    snapshot.forEach((doc) => {
      packages.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`[商品管理] 獲取金幣套餐，共 ${packages.length} 個`);
    return packages;
  } catch (error) {
    console.error('[商品管理] 獲取金幣套餐失敗:', error);
    throw new Error('獲取金幣套餐失敗');
  }
};

/**
 * 新增金幣套餐
 */
export const createCoinPackage = async (packageData) => {
  try {
    const { id, ...data } = packageData;

    // 計算總金幣
    data.totalCoins = data.coins + (data.bonus || 0);
    data.currency = data.currency || 'TWD';
    data.status = data.status || 'active';
    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();

    await db.collection('coin_packages').doc(id).set(data);

    console.log(`[商品管理] 新增金幣套餐: ${id}`);
    return { id, ...data };
  } catch (error) {
    console.error('[商品管理] 新增金幣套餐失敗:', error);
    throw new Error('新增金幣套餐失敗');
  }
};

/**
 * 更新金幣套餐
 */
export const updateCoinPackage = async (id, packageData) => {
  try {
    // 計算總金幣
    if (packageData.coins !== undefined || packageData.bonus !== undefined) {
      packageData.totalCoins = (packageData.coins || 0) + (packageData.bonus || 0);
    }

    packageData.updatedAt = new Date().toISOString();

    await db.collection('coin_packages').doc(id).update(packageData);

    console.log(`[商品管理] 更新金幣套餐: ${id}`);
    return { id, ...packageData };
  } catch (error) {
    console.error('[商品管理] 更新金幣套餐失敗:', error);
    throw new Error('更新金幣套餐失敗');
  }
};

/**
 * 刪除金幣套餐
 */
export const deleteCoinPackage = async (id) => {
  try {
    await db.collection('coin_packages').doc(id).delete();
    console.log(`[商品管理] 刪除金幣套餐: ${id}`);
  } catch (error) {
    console.error('[商品管理] 刪除金幣套餐失敗:', error);
    throw new Error('刪除金幣套餐失敗');
  }
};

/**
 * ========== 禮物管理 ==========
 */

/**
 * 獲取所有禮物
 */
export const getAllGifts = async () => {
  try {
    const snapshot = await db.collection('gifts').get();
    const gifts = [];

    snapshot.forEach((doc) => {
      gifts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`[商品管理] 獲取禮物，共 ${gifts.length} 個`);
    return gifts;
  } catch (error) {
    console.error('[商品管理] 獲取禮物失敗:', error);
    throw new Error('獲取禮物失敗');
  }
};

/**
 * 新增禮物
 */
export const createGift = async (giftData) => {
  try {
    const { id, ...data } = giftData;

    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();

    await db.collection('gifts').doc(id).set(data);

    console.log(`[商品管理] 新增禮物: ${id}`);
    return { id, ...data };
  } catch (error) {
    console.error('[商品管理] 新增禮物失敗:', error);
    throw new Error('新增禮物失敗');
  }
};

/**
 * 更新禮物
 */
export const updateGift = async (id, giftData) => {
  try {
    giftData.updatedAt = new Date().toISOString();

    await db.collection('gifts').doc(id).update(giftData);

    console.log(`[商品管理] 更新禮物: ${id}`);
    return { id, ...giftData };
  } catch (error) {
    console.error('[商品管理] 更新禮物失敗:', error);
    throw new Error('更新禮物失敗');
  }
};

/**
 * 刪除禮物
 */
export const deleteGift = async (id) => {
  try {
    await db.collection('gifts').doc(id).delete();
    console.log(`[商品管理] 刪除禮物: ${id}`);
  } catch (error) {
    console.error('[商品管理] 刪除禮物失敗:', error);
    throw new Error('刪除禮物失敗');
  }
};

/**
 * ========== 道具管理 ==========
 */

/**
 * 獲取所有道具
 */
export const getAllPotions = async () => {
  try {
    const snapshot = await db.collection('potions').get();
    const potions = [];

    snapshot.forEach((doc) => {
      potions.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`[商品管理] 獲取道具，共 ${potions.length} 個`);
    return potions;
  } catch (error) {
    console.error('[商品管理] 獲取道具失敗:', error);
    throw new Error('獲取道具失敗');
  }
};

/**
 * 新增道具
 */
export const createPotion = async (potionData) => {
  try {
    const { id, ...data } = potionData;

    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();

    await db.collection('potions').doc(id).set(data);

    console.log(`[商品管理] 新增道具: ${id}`);
    return { id, ...data };
  } catch (error) {
    console.error('[商品管理] 新增道具失敗:', error);
    throw new Error('新增道具失敗');
  }
};

/**
 * 更新道具
 */
export const updatePotion = async (id, potionData) => {
  try {
    potionData.updatedAt = new Date().toISOString();

    await db.collection('potions').doc(id).update(potionData);

    console.log(`[商品管理] 更新道具: ${id}`);
    return { id, ...potionData };
  } catch (error) {
    console.error('[商品管理] 更新道具失敗:', error);
    throw new Error('更新道具失敗');
  }
};

/**
 * 刪除道具
 */
export const deletePotion = async (id) => {
  try {
    await db.collection('potions').doc(id).delete();
    console.log(`[商品管理] 刪除道具: ${id}`);
  } catch (error) {
    console.error('[商品管理] 刪除道具失敗:', error);
    throw new Error('刪除道具失敗');
  }
};

export default {
  // 金幣套餐
  getAllCoinPackages,
  createCoinPackage,
  updateCoinPackage,
  deleteCoinPackage,

  // 禮物
  getAllGifts,
  createGift,
  updateGift,
  deleteGift,

  // 道具
  getAllPotions,
  createPotion,
  updatePotion,
  deletePotion,
};
