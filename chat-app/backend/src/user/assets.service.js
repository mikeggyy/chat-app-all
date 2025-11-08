import { getUserById, upsertUser } from './user.service.js';
import { getPotionInventory } from '../payment/potion.service.js';
import {
  ASSET_TYPES,
  getUserAsset,
  addAsset as addAssetToSubcollection,
  deductAsset as deductAssetFromSubcollection,
  setAssetQuantity,
  getUnlockCardsBalance,
} from './userAssets.service.js';
import logger from '../utils/logger.js';

/**
 * 獲取用戶的資產信息
 * 優先從子集合讀取，如果子集合沒有則從主文檔讀取（向後兼容）
 * @param {string} userId - 用戶 ID
 * @returns {Object} 資產對象
 */
export const getUserAssets = async (userId) => {
  if (!userId) {
    throw new Error('需要提供用戶 ID');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('找不到指定的使用者');
  }

  // 獲取藥水庫存
  const potionInventory = await getPotionInventory(userId);
  const memoryBoostCount = potionInventory.memoryBoost || 0;
  const brainBoostCount = potionInventory.brainBoost || 0;

  // 從子集合獲取解鎖卡餘額
  const unlockCardsFromSubcollection = await getUnlockCardsBalance(userId);

  // 向後兼容：如果子集合沒有資料，從主文檔讀取
  const getCardCount = (cardType, subcollectionValue) => {
    // 優先使用子集合的值
    if (subcollectionValue > 0) {
      logger.debug(`[getUserAssets] ${cardType} 從子集合讀取: ${subcollectionValue}`);
      return subcollectionValue;
    }

    // 向後兼容：從主文檔的多個位置查找
    // 優先順序：unlockTickets > assets > 頂層
    if (user?.unlockTickets?.[cardType] !== undefined && user.unlockTickets[cardType] > 0) {
      logger.debug(`[getUserAssets] ${cardType} 從 unlockTickets 讀取: ${user.unlockTickets[cardType]}`);
      return user.unlockTickets[cardType];
    }

    if (user?.assets?.[cardType] !== undefined && user.assets[cardType] > 0) {
      logger.debug(`[getUserAssets] ${cardType} 從 assets 讀取: ${user.assets[cardType]}`);
      return user.assets[cardType];
    }

    if (user?.[cardType] !== undefined && user[cardType] > 0) {
      logger.debug(`[getUserAssets] ${cardType} 從頂層讀取: ${user[cardType]}`);
      return user[cardType];
    }

    return 0;
  };

  return {
    characterUnlockCards: getCardCount('characterUnlockCards', unlockCardsFromSubcollection.characterUnlockCards),
    photoUnlockCards: getCardCount('photoUnlockCards', unlockCardsFromSubcollection.photoUnlockCards),
    videoUnlockCards: getCardCount('videoUnlockCards', unlockCardsFromSubcollection.videoUnlockCards),
    voiceUnlockCards: getCardCount('voiceUnlockCards', unlockCardsFromSubcollection.voiceUnlockCards),
    createCards: getCardCount('createCards', unlockCardsFromSubcollection.createCards),
    potions: {
      memoryBoost: memoryBoostCount,
      brainBoost: brainBoostCount,
    },
    walletBalance: user.walletBalance || user.coins || 0,
  };
};

/**
 * 增加用戶的資產數量
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {number} amount - 數量
 * @returns {Object} 更新後的用戶資產
 */
export const addUserAsset = async (userId, assetType, amount = 1) => {
  if (!userId) {
    throw new Error('需要提供用戶 ID');
  }

  if (!assetType) {
    throw new Error('需要提供資產類型');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('找不到指定的使用者');
  }

  const currentAssets = user.assets || {
    characterUnlockCards: 0,
    photoUnlockCards: 0,
    videoUnlockCards: 0,
    voiceUnlockCards: 0,
    createCards: 0,
  };

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount < 0) {
    throw new Error('數量必須是非負數');
  }

  const newAssets = { ...currentAssets };

  // 處理卡片類型
  const validAssetTypes = ['characterUnlockCards', 'photoUnlockCards', 'videoUnlockCards', 'voiceUnlockCards', 'createCards'];
  if (!validAssetTypes.includes(assetType)) {
    throw new Error(`無效的資產類型: ${assetType}`);
  }
  newAssets[assetType] = (currentAssets[assetType] || 0) + numAmount;

  const updatedUser = await upsertUser({
    ...user,
    assets: newAssets,
    updatedAt: new Date().toISOString(),
  });

  return updatedUser.assets;
};

/**
 * 減少用戶的資產數量
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {number} amount - 數量
 * @returns {Object} 更新後的用戶資產
 */
export const consumeUserAsset = async (userId, assetType, amount = 1) => {
  if (!userId) {
    throw new Error('需要提供用戶 ID');
  }

  if (!assetType) {
    throw new Error('需要提供資產類型');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('找不到指定的使用者');
  }

  const currentAssets = user.assets || {
    characterUnlockCards: 0,
    photoUnlockCards: 0,
    videoUnlockCards: 0,
    voiceUnlockCards: 0,
    createCards: 0,
  };

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount < 0) {
    throw new Error('數量必須是非負數');
  }

  const newAssets = { ...currentAssets };

  // 處理卡片類型
  const validAssetTypes = ['characterUnlockCards', 'photoUnlockCards', 'videoUnlockCards', 'voiceUnlockCards', 'createCards'];
  if (!validAssetTypes.includes(assetType)) {
    throw new Error(`無效的資產類型: ${assetType}`);
  }
  const currentAmount = currentAssets[assetType] || 0;
  if (currentAmount < numAmount) {
    throw new Error(`${assetType} 數量不足`);
  }
  newAssets[assetType] = currentAmount - numAmount;

  const updatedUser = await upsertUser({
    ...user,
    assets: newAssets,
    updatedAt: new Date().toISOString(),
  });

  return updatedUser.assets;
};

/**
 * 設置用戶的資產數量（用於測試或管理）
 * @param {string} userId - 用戶 ID
 * @param {Object} assets - 資產對象
 * @returns {Object} 更新後的用戶資產
 */
export const setUserAssets = async (userId, assets) => {
  if (!userId) {
    throw new Error('需要提供用戶 ID');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('找不到指定的使用者');
  }

  const updatedUser = await upsertUser({
    ...user,
    assets: assets || {
      characterUnlockCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,
      voiceUnlockCards: 0,
      createCards: 0,
    },
    updatedAt: new Date().toISOString(),
  });

  return updatedUser.assets;
};
