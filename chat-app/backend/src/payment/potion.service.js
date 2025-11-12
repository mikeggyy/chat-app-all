/**
 * 道具系統服務 - 分離庫存和激活效果
 * 處理記憶增強藥水和腦力激盪藥水的購買與使用
 *
 * 流程：
 * 1. 購買 → 增加 potionInventory（庫存數量）
 * 2. 使用 → 扣除庫存 → 激活 activePotionEffects（綁定角色，30天有效期）
 */

import { getFirestoreDb } from "../firebase/index.js";
import { getUserById, upsertUser } from "../user/user.service.js";
import { getUserProfileWithCache } from "../user/userProfileCache.service.js";
import { POTION_CONFIG } from "../config/limits.js";
import { FieldValue } from "firebase-admin/firestore";

const db = getFirestoreDb();
const USAGE_LIMITS_COLLECTION = "usage_limits";

/**
 * 獲取用戶的 usage_limits 文檔引用
 */
const getUserLimitRef = (userId) => {
  return db.collection(USAGE_LIMITS_COLLECTION).doc(userId);
};

/**
 * 獲取用戶的藥水數據
 */
const getUserPotionData = async (userId) => {
  const userLimitRef = getUserLimitRef(userId);
  const doc = await userLimitRef.get();

  if (!doc.exists) {
    return {
      potionInventory: { memoryBoost: 0, brainBoost: 0 },
      activePotionEffects: {},
    };
  }

  const data = doc.data();
  return {
    potionInventory: data.potionInventory || { memoryBoost: 0, brainBoost: 0 },
    activePotionEffects: data.activePotionEffects || {},
  };
};

/**
 * 檢查藥水效果是否有效（未過期）
 */
const isPotionEffectActive = (effectData) => {
  if (!effectData || !effectData.expiresAt) {
    return false;
  }
  return new Date(effectData.expiresAt) > new Date();
};

/**
 * 獲取用戶的藥水庫存
 */
export const getPotionInventory = async (userId) => {
  const { potionInventory } = await getUserPotionData(userId);
  return potionInventory;
};

/**
 * 獲取用戶的活躍藥水效果列表
 */
export const getUserActivePotions = async (userId) => {
  try {
    const { activePotionEffects } = await getUserPotionData(userId);
    const activeEffects = [];

    for (const [effectId, effectData] of Object.entries(activePotionEffects)) {
      if (isPotionEffectActive(effectData)) {
        activeEffects.push({
          id: effectId,
          ...effectData,
        });
      }
    }

    return activeEffects;
  } catch (error) {
    return [];
  }
};

/**
 * 檢查特定角色是否有記憶增強藥水效果
 */
export const hasMemoryBoost = async (userId, characterId) => {
  try {
    const { activePotionEffects } = await getUserPotionData(userId);
    const effectId = `memory_boost_${characterId}`;
    const effectData = activePotionEffects[effectId];

    if (!effectData) {
      return false;
    }

    return isPotionEffectActive(effectData);
  } catch (error) {
    return false;
  }
};

/**
 * 檢查特定角色是否有腦力激盪藥水效果
 */
export const hasBrainBoost = async (userId, characterId) => {
  try {
    const { activePotionEffects } = await getUserPotionData(userId);
    const effectId = `brain_boost_${characterId}`;
    const effectData = activePotionEffects[effectId];

    if (!effectData) {
      return false;
    }

    return isPotionEffectActive(effectData);
  } catch (error) {
    return false;
  }
};

/**
 * 獲取特定角色的額外記憶token數量
 */
export const getExtraMemoryTokens = async (userId, characterId) => {
  const hasBoost = await hasMemoryBoost(userId, characterId);
  if (hasBoost) {
    return POTION_CONFIG.MEMORY_BOOST.effect.value;
  }
  return 0;
};

/**
 * 獲取用戶當前應使用的AI模型（針對特定角色）
 */
export const getEffectiveAIModel = async (userId, characterId, defaultModel) => {
  const hasBoost = await hasBrainBoost(userId, characterId);
  if (hasBoost) {
    return POTION_CONFIG.BRAIN_BOOST.effect.value;
  }
  return defaultModel;
};

/**
 * 購買記憶增強藥水（增加庫存）
 * @param {string} userId - 用戶ID
 * @param {object} options - 購買選項（支持 SKU 多數量）
 * @param {number} options.quantity - 購買數量（默認 1）
 * @param {number} options.unitPrice - 單價（默認使用配置價格）
 * @returns {Promise<object>} 購買結果
 */
export const purchaseMemoryBoost = async (userId, options = {}) => {
  const potion = POTION_CONFIG.MEMORY_BOOST;

  // 支持 SKU 多數量購買
  const quantity = options.quantity || 1;
  const unitPrice = options.unitPrice || potion.price;

  // ✅ 使用 Firestore Transaction 保證原子性
  // 確保金幣扣除和庫存增加在同一事務中完成
  const userRef = db.collection("users").doc(userId);
  const userLimitRef = getUserLimitRef(userId);

  let newBalance;
  let newInventoryCount;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = user.walletBalance || 0;

    // 2. 檢查金幣餘額
    if (currentBalance < unitPrice) {
      throw new Error(`金幣不足，當前餘額：${currentBalance}，需要：${unitPrice}`);
    }

    // 3. 讀取當前庫存
    const limitDoc = await transaction.get(userLimitRef);
    const limitData = limitDoc.exists ? limitDoc.data() : {};
    const currentInventory = limitData.potionInventory?.memoryBoost || 0;

    // 4. 計算新值
    newBalance = currentBalance - unitPrice;
    newInventoryCount = currentInventory + quantity;

    // 5. ✅ 在同一事務中：扣除金幣 + 增加庫存
    transaction.update(userRef, {
      walletBalance: newBalance,
      "wallet.balance": newBalance,
      "wallet.updatedAt": new Date().toISOString(),
      coins: newBalance,
      updatedAt: new Date().toISOString(),
    });

    transaction.set(
      userLimitRef,
      {
        potionInventory: {
          memoryBoost: FieldValue.increment(quantity),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return {
    success: true,
    potionId: potion.id,
    cost: unitPrice,
    quantity,
    balance: newBalance,
    newInventoryCount: newInventoryCount,
  };
};

/**
 * 購買腦力激盪藥水（增加庫存）
 * @param {string} userId - 用戶ID
 * @param {object} options - 購買選項（支持 SKU 多數量）
 * @param {number} options.quantity - 購買數量（默認 1）
 * @param {number} options.unitPrice - 單價（默認使用配置價格）
 * @returns {Promise<object>} 購買結果
 */
export const purchaseBrainBoost = async (userId, options = {}) => {
  const potion = POTION_CONFIG.BRAIN_BOOST;

  // 支持 SKU 多數量購買
  const quantity = options.quantity || 1;
  const unitPrice = options.unitPrice || potion.price;

  // ✅ 使用 Firestore Transaction 保證原子性
  // 確保金幣扣除和庫存增加在同一事務中完成
  const userRef = db.collection("users").doc(userId);
  const userLimitRef = getUserLimitRef(userId);

  let newBalance;
  let newInventoryCount;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();

    // 2. 檢查會員等級限制
    const userTier = user.membershipTier || "free";
    if (potion.restrictedTiers && potion.restrictedTiers.includes(userTier)) {
      throw new Error(potion.restrictedMessage || "您的會員等級不能購買此道具");
    }

    const currentBalance = user.walletBalance || 0;

    // 3. 檢查金幣餘額
    if (currentBalance < unitPrice) {
      throw new Error(`金幣不足，當前餘額：${currentBalance}，需要：${unitPrice}`);
    }

    // 4. 讀取當前庫存
    const limitDoc = await transaction.get(userLimitRef);
    const limitData = limitDoc.exists ? limitDoc.data() : {};
    const currentInventory = limitData.potionInventory?.brainBoost || 0;

    // 5. 計算新值
    newBalance = currentBalance - unitPrice;
    newInventoryCount = currentInventory + quantity;

    // 6. ✅ 在同一事務中：扣除金幣 + 增加庫存
    transaction.update(userRef, {
      walletBalance: newBalance,
      "wallet.balance": newBalance,
      "wallet.updatedAt": new Date().toISOString(),
      coins: newBalance,
      updatedAt: new Date().toISOString(),
    });

    transaction.set(
      userLimitRef,
      {
        potionInventory: {
          brainBoost: FieldValue.increment(quantity),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return {
    success: true,
    potionId: potion.id,
    cost: unitPrice,
    quantity,
    balance: newBalance,
    newInventoryCount: newInventoryCount,
  };
};

/**
 * 使用記憶增強藥水（扣除庫存，激活效果）
 * @param {string} userId - 用戶ID
 * @param {string} characterId - 角色ID
 * @returns {Promise<object>} 使用結果
 */
export const useMemoryBoost = async (userId, characterId) => {
  // ✅ 修復: 使用 Transaction 確保庫存檢查和扣除的原子性
  const userLimitRef = getUserLimitRef(userId);
  const effectId = `memory_boost_${characterId}`;
  let expiresAt;

  await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內讀取數據
    const doc = await transaction.get(userLimitRef);
    const data = doc.exists ? doc.data() : {};
    const potionInventory = data.potionInventory || { memoryBoost: 0 };
    const activePotionEffects = data.activePotionEffects || {};

    // 2. 在 Transaction 內檢查庫存
    if (potionInventory.memoryBoost < 1) {
      throw new Error("記憶增強藥水庫存不足");
    }

    // 3. 檢查該角色是否已有激活的效果
    const existingEffect = activePotionEffects[effectId];
    if (existingEffect && isPotionEffectActive(existingEffect)) {
      throw new Error("該角色已有記憶增強藥水效果，請等待過期後再使用");
    }

    // 4. 在 Transaction 內扣除庫存並激活效果
    const now = new Date();
    expiresAt = new Date(now.getTime() + POTION_CONFIG.MEMORY_BOOST.duration * 24 * 60 * 60 * 1000);

    transaction.set(
      userLimitRef,
      {
        potionInventory: {
          memoryBoost: FieldValue.increment(-1),
        },
        activePotionEffects: {
          [effectId]: {
            characterId,
            potionType: "memory_boost",
            activatedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return {
    success: true,
    characterId,
    effectId,
    expiresAt: expiresAt.toISOString(),
    duration: POTION_CONFIG.MEMORY_BOOST.duration,
  };
};

/**
 * 使用腦力激盪藥水（扣除庫存，激活效果）
 * @param {string} userId - 用戶ID
 * @param {string} characterId - 角色ID
 * @returns {Promise<object>} 使用結果
 */
export const useBrainBoost = async (userId, characterId) => {
  // ✅ 修復: 使用 Transaction 確保庫存檢查和扣除的原子性
  const userLimitRef = getUserLimitRef(userId);
  const effectId = `brain_boost_${characterId}`;
  let expiresAt;

  await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內讀取數據
    const doc = await transaction.get(userLimitRef);
    const data = doc.exists ? doc.data() : {};
    const potionInventory = data.potionInventory || { brainBoost: 0 };
    const activePotionEffects = data.activePotionEffects || {};

    // 2. 在 Transaction 內檢查庫存
    if (potionInventory.brainBoost < 1) {
      throw new Error("腦力激盪藥水庫存不足");
    }

    // 3. 檢查該角色是否已有激活的效果
    const existingEffect = activePotionEffects[effectId];
    if (existingEffect && isPotionEffectActive(existingEffect)) {
      throw new Error("該角色已有腦力激盪藥水效果，請等待過期後再使用");
    }

    // 4. 在 Transaction 內扣除庫存並激活效果
    const now = new Date();
    expiresAt = new Date(now.getTime() + POTION_CONFIG.BRAIN_BOOST.duration * 24 * 60 * 60 * 1000);

    transaction.set(
      userLimitRef,
      {
        potionInventory: {
          brainBoost: FieldValue.increment(-1),
        },
        activePotionEffects: {
          [effectId]: {
            characterId,
            potionType: "brain_boost",
            activatedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return {
    success: true,
    characterId,
    effectId,
    expiresAt: expiresAt.toISOString(),
    duration: POTION_CONFIG.BRAIN_BOOST.duration,
  };
};

/**
 * 獲取用戶可購買的道具列表（考慮限制）
 */
export const getAvailablePotions = async (userId) => {
  const user = await getUserProfileWithCache(userId);
  const userTier = user?.membershipTier || "free";
  const balance = user?.walletBalance || 0;

  const potions = [];

  // 記憶增強藥水（所有用戶都可購買）
  potions.push({
    ...POTION_CONFIG.MEMORY_BOOST,
    canPurchase: balance >= POTION_CONFIG.MEMORY_BOOST.price,
    requiresCharacter: true,
  });

  // 腦力激盪藥水（檢查限制）
  const brainBoost = POTION_CONFIG.BRAIN_BOOST;
  const isRestricted = brainBoost.restrictedTiers && brainBoost.restrictedTiers.includes(userTier);

  potions.push({
    ...brainBoost,
    canPurchase: !isRestricted && balance >= brainBoost.price,
    isRestricted,
    restrictionMessage: isRestricted ? "您的模型已經是最高級了" : null,
  });

  return potions;
};

/**
 * 清理過期的藥水效果（定期任務）
 * @param {string} userId - 用戶ID（可選，不提供則清理所有用戶）
 * @returns {Promise<number>} 清理的數量
 */
export const cleanupExpiredPotions = async (userId = null) => {
  let count = 0;

  try {
    if (userId) {
      // 清理特定用戶的過期效果
      const { activePotionEffects } = await getUserPotionData(userId);
      const activeEffects = {};

      for (const [effectId, effectData] of Object.entries(activePotionEffects)) {
        if (isPotionEffectActive(effectData)) {
          activeEffects[effectId] = effectData;
        } else {
          count++;
        }
      }

      // 只保留有效效果
      if (count > 0) {
        const userLimitRef = getUserLimitRef(userId);
        await userLimitRef.set(
          {
            activePotionEffects: activeEffects,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    } else {
      // 清理所有用戶的過期效果
      const usersSnapshot = await db.collection(USAGE_LIMITS_COLLECTION).get();

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const activePotionEffects = userData.activePotionEffects || {};
        const activeEffects = {};
        let userCount = 0;

        for (const [effectId, effectData] of Object.entries(activePotionEffects)) {
          if (isPotionEffectActive(effectData)) {
            activeEffects[effectId] = effectData;
          } else {
            userCount++;
          }
        }

        // 更新該用戶的效果數據
        if (userCount > 0) {
          await userDoc.ref.set(
            {
              activePotionEffects: activeEffects,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          count += userCount;
        }
      }
    }

    return count;
  } catch (error) {
    throw error;
  }
};

export default {
  getPotionInventory,
  getUserActivePotions,
  hasMemoryBoost,
  hasBrainBoost,
  getExtraMemoryTokens,
  getEffectiveAIModel,
  purchaseMemoryBoost,
  purchaseBrainBoost,
  useMemoryBoost,
  useBrainBoost,
  getAvailablePotions,
  cleanupExpiredPotions,
};
