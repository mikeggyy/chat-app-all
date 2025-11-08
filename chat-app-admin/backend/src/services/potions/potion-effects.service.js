import { db, auth, FieldValue } from "../../firebase/index.js";

/**
 * 藥水效果服務模塊
 * 處理用戶激活藥水效果的查詢、添加、更新和刪除
 */

/**
 * 獲取用戶所有角色的活躍藥水效果
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 藥水效果數據
 * @throws {Error} 操作失敗時拋出錯誤
 */
export const getEffects = async (userId) => {
  // 檢查用戶是否存在
  try {
    await auth.getUser(userId);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error("用戶不存在");
    }
    throw error;
  }

  const limitsDoc = await db.collection("usage_limits").doc(userId).get();

  if (!limitsDoc.exists) {
    return {
      userId,
      effects: [],
      summary: {
        total: 0,
        memoryBoost: 0,
        brainBoost: 0,
      },
    };
  }

  const limitsData = limitsDoc.data();
  const activePotionEffects = limitsData.activePotionEffects || {};
  const now = new Date();
  const effects = [];
  let memoryBoostCount = 0;
  let brainBoostCount = 0;

  // 獲取所有角色信息
  const charactersSnapshot = await db.collection("characters").get();
  const charactersMap = {};
  charactersSnapshot.docs.forEach((doc) => {
    charactersMap[doc.id] = {
      id: doc.id,
      name: doc.data().name || doc.id,
      avatar: doc.data().avatar || null,
    };
  });

  for (const [effectId, effectData] of Object.entries(activePotionEffects)) {
    const expiresAt = effectData.expiresAt ? new Date(effectData.expiresAt) : null;
    const isActive = expiresAt && expiresAt > now;

    const effect = {
      id: effectId,
      characterId: effectData.characterId,
      character: charactersMap[effectData.characterId] || { id: effectData.characterId, name: "未知角色" },
      potionType: effectData.potionType,
      activatedAt: effectData.activatedAt,
      expiresAt: effectData.expiresAt,
      isActive,
      daysRemaining: isActive ? Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)) : 0,
    };

    effects.push(effect);

    if (isActive) {
      if (effectData.potionType === "memory_boost") {
        memoryBoostCount++;
      } else if (effectData.potionType === "brain_boost") {
        brainBoostCount++;
      }
    }
  }

  // 按過期時間排序（最近過期的在前）
  effects.sort((a, b) => {
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;
    return new Date(a.expiresAt) - new Date(b.expiresAt);
  });

  return {
    userId,
    effects,
    summary: {
      total: effects.length,
      active: effects.filter((e) => e.isActive).length,
      expired: effects.filter((e) => !e.isActive).length,
      memoryBoost: memoryBoostCount,
      brainBoost: brainBoostCount,
    },
  };
};

/**
 * 為用戶的特定角色添加藥水效果
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 選項
 * @param {string} options.characterId - 角色 ID
 * @param {string} options.potionType - 藥水類型：'memory_boost' 或 'brain_boost'
 * @param {number} options.durationDays - 持續天數
 * @returns {Promise<Object>} 添加結果
 * @throws {Error} 操作失敗時拋出錯誤
 */
export const addEffect = async (userId, options) => {
  const { characterId, potionType, durationDays } = options;

  // 檢查參數
  if (!characterId || !potionType || !durationDays) {
    throw new Error("缺少必要參數：characterId, potionType, durationDays");
  }

  if (potionType !== "memory_boost" && potionType !== "brain_boost") {
    throw new Error("無效的藥水類型");
  }

  if (durationDays <= 0 || durationDays > 365) {
    throw new Error("持續天數必須在 1-365 之間");
  }

  // 檢查用戶是否存在
  try {
    await auth.getUser(userId);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error("用戶不存在");
    }
    throw error;
  }

  // 檢查角色是否存在
  const characterDoc = await db.collection("characters").doc(characterId).get();
  if (!characterDoc.exists) {
    throw new Error("角色不存在");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const effectId = `${potionType}_${characterId}`;

  // 添加藥水效果
  await db
    .collection("usage_limits")
    .doc(userId)
    .set(
      {
        activePotionEffects: {
          [effectId]: {
            characterId,
            potionType,
            activatedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  return {
    message: "藥水效果添加成功",
    effect: {
      id: effectId,
      characterId,
      potionType,
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationDays,
    },
  };
};

/**
 * 更新用戶的藥水效果（延長或縮短時間）
 *
 * @param {string} userId - 用戶 ID
 * @param {string} effectId - 效果 ID
 * @param {Object} options - 選項
 * @param {number} options.durationDays - 新的持續天數
 * @returns {Promise<Object>} 更新結果
 * @throws {Error} 操作失敗時拋出錯誤
 */
export const updateEffect = async (userId, effectId, options) => {
  const { durationDays } = options;

  if (!durationDays || durationDays <= 0 || durationDays > 365) {
    throw new Error("持續天數必須在 1-365 之間");
  }

  // 檢查用戶是否存在
  try {
    await auth.getUser(userId);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error("用戶不存在");
    }
    throw error;
  }

  const limitsDoc = await db.collection("usage_limits").doc(userId).get();

  if (!limitsDoc.exists) {
    throw new Error("找不到用戶的使用限制數據");
  }

  const limitsData = limitsDoc.data();
  const activePotionEffects = limitsData.activePotionEffects || {};

  if (!activePotionEffects[effectId]) {
    throw new Error("找不到該藥水效果");
  }

  const existingEffect = activePotionEffects[effectId];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // 更新藥水效果
  await db
    .collection("usage_limits")
    .doc(userId)
    .set(
      {
        activePotionEffects: {
          [effectId]: {
            ...existingEffect,
            activatedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  return {
    message: "藥水效果更新成功",
    effect: {
      id: effectId,
      ...existingEffect,
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationDays,
    },
  };
};

/**
 * 刪除用戶的藥水效果
 *
 * @param {string} userId - 用戶 ID
 * @param {string} effectId - 效果 ID
 * @returns {Promise<Object>} 刪除結果
 * @throws {Error} 操作失敗時拋出錯誤
 */
export const deleteEffect = async (userId, effectId) => {
  // 檢查用戶是否存在
  try {
    await auth.getUser(userId);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error("用戶不存在");
    }
    throw error;
  }

  const limitsDoc = await db.collection("usage_limits").doc(userId).get();

  if (!limitsDoc.exists) {
    throw new Error("找不到用戶的使用限制數據");
  }

  const limitsData = limitsDoc.data();
  const activePotionEffects = limitsData.activePotionEffects || {};

  if (!activePotionEffects[effectId]) {
    throw new Error("找不到該藥水效果");
  }

  // 使用 FieldValue.delete() 來刪除 Firestore 字段
  await db
    .collection("usage_limits")
    .doc(userId)
    .update({
      [`activePotionEffects.${effectId}`]: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });

  return {
    message: "藥水效果刪除成功",
    effectId,
  };
};
