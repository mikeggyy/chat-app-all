import { getUserById, upsertUser } from './user.service.js';
import { getPotionInventory } from '../payment/potion.service.js';
import { logAssetChange } from './assetAuditLog.service.js';
import { getWalletBalance } from './walletHelpers.js';
import logger from '../utils/logger.js';
import { getFirestoreDb, FieldValue } from "../firebase/index.js";

/**
 * 獲取用戶的資產信息
 * 卡片類資產統一從主文檔讀取，禮物從子集合讀取
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

  // ✅ 統一從 assets 讀取卡片類資產
  const getCardCount = (cardType) => {
    return user?.assets?.[cardType] || 0;
  };

  // ✅ 合併：統一返回所有資產，包含金幣餘額
  return {
    balance: getWalletBalance(user), // 金幣餘額（統一使用 balance 欄位名）
    characterUnlockCards: getCardCount('characterUnlockCards'),
    photoUnlockCards: getCardCount('photoUnlockCards'),
    videoUnlockCards: getCardCount('videoUnlockCards'),
    voiceUnlockCards: getCardCount('voiceUnlockCards'),
    createCards: getCardCount('createCards'),
    potions: {
      memoryBoost: memoryBoostCount,
      brainBoost: brainBoostCount,
    },
  };
};

/**
 * 增加用戶的資產數量
 *
 * ⚠️ 使用 Firestore Transaction 確保原子性，防止競態條件
 *
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {number} amount - 數量
 * @param {string} reason - 增加原因（用於審計日誌）
 * @param {Object} metadata - 額外元數據（用於審計日誌）
 * @returns {Object} 更新結果，包含 previousQuantity 和 newQuantity
 */
export const addUserAsset = async (userId, assetType, amount = 1, reason = '', metadata = {}) => {
  // 參數驗證
  if (!userId) {
    throw new Error('需要提供用戶 ID');
  }

  if (!assetType) {
    throw new Error('需要提供資產類型');
  }

  const validAssetTypes = ['characterUnlockCards', 'photoUnlockCards', 'videoUnlockCards', 'voiceUnlockCards', 'createCards'];
  if (!validAssetTypes.includes(assetType)) {
    throw new Error(`無效的資產類型: ${assetType}`);
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount < 0) {
    throw new Error('數量必須是非負數');
  }

  // 使用 Firestore Transaction 確保原子性
  const db = getFirestoreDb();
  const userRef = db.collection('users').doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    // 在 Transaction 內讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error('找不到指定的使用者');
    }

    const user = userDoc.data();
    const currentAssets = user.assets || {
      characterUnlockCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,
      voiceUnlockCards: 0,
      createCards: 0,
    };

    const previousQuantity = currentAssets[assetType] || 0;
    const newQuantity = previousQuantity + numAmount;
    const newAssets = {
      ...currentAssets,
      [assetType]: newQuantity,
    };

    // 在 Transaction 內更新
    transaction.update(userRef, {
      assets: newAssets,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      previousQuantity,
      newQuantity,
      assetType,
      assets: newAssets, // 返回完整的資產對象（向後兼容）
    };
  });

  // 記錄資產變更（Transaction 外，不阻塞主流程）
  logAssetChange({
    userId,
    assetType,
    action: 'add',
    amount: numAmount,
    previousQuantity: result.previousQuantity,
    newQuantity: result.newQuantity,
    reason,
    metadata,
  }).catch(err => logger.error('[資產審計] 記錄失敗:', err));

  logger.info(`[資產增加] 用戶 ${userId} ${assetType} 增加 ${numAmount}，餘額: ${result.previousQuantity} → ${result.newQuantity}`);

  return result;
};

/**
 * 減少用戶的資產數量
 *
 * ⚠️ 使用 Firestore Transaction 確保原子性，防止競態條件
 *
 * @param {string} userId - 用戶 ID
 * @param {string} assetType - 資產類型
 * @param {number} amount - 數量
 * @param {string} reason - 消耗原因（用於審計日誌）
 * @param {Object} metadata - 額外元數據（用於審計日誌）
 * @returns {Object} 更新結果，包含 previousQuantity 和 newQuantity
 */
export const consumeUserAsset = async (userId, assetType, amount = 1, reason = '', metadata = {}) => {
  // 參數驗證
  if (!userId) {
    throw new Error('需要提供用戶 ID');
  }

  if (!assetType) {
    throw new Error('需要提供資產類型');
  }

  const validAssetTypes = ['characterUnlockCards', 'photoUnlockCards', 'videoUnlockCards', 'voiceUnlockCards', 'createCards'];
  if (!validAssetTypes.includes(assetType)) {
    throw new Error(`無效的資產類型: ${assetType}`);
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount < 0) {
    throw new Error('數量必須是非負數');
  }

  // 使用 Firestore Transaction 確保原子性
  const db = getFirestoreDb();
  const userRef = db.collection('users').doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    // 在 Transaction 內讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error('找不到指定的使用者');
    }

    const user = userDoc.data();
    const currentAssets = user.assets || {
      characterUnlockCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,
      voiceUnlockCards: 0,
      createCards: 0,
    };

    const previousQuantity = currentAssets[assetType] || 0;

    // 在 Transaction 內檢查餘額
    if (previousQuantity < numAmount) {
      throw new Error(`${assetType} 數量不足，當前: ${previousQuantity}，需要: ${numAmount}`);
    }

    const newQuantity = previousQuantity - numAmount;
    const newAssets = {
      ...currentAssets,
      [assetType]: newQuantity,
    };

    // 在 Transaction 內更新
    transaction.update(userRef, {
      assets: newAssets,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      previousQuantity,
      newQuantity,
      assetType,
      assets: newAssets, // 返回完整的資產對象（向後兼容）
    };
  });

  // 記錄資產變更（Transaction 外，不阻塞主流程）
  logAssetChange({
    userId,
    assetType,
    action: 'consume',
    amount: numAmount,
    previousQuantity: result.previousQuantity,
    newQuantity: result.newQuantity,
    reason,
    metadata,
  }).catch(err => logger.error('[資產審計] 記錄失敗:', err));

  logger.info(`[資產扣除] 用戶 ${userId} ${assetType} 扣除 ${numAmount}，餘額: ${result.previousQuantity} → ${result.newQuantity}`);

  return result;
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
