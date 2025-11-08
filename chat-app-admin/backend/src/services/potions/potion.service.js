import { db, auth } from "../../firebase/index.js";

/**
 * 藥水服務模塊
 * 處理藥水的添加、刪除和管理
 */

/**
 * 添加或刪除用戶的藥水
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 操作選項
 * @param {string} options.action - 操作類型：'add'（添加）、'delete'（刪除）、'deleteAll'（刪除所有）
 * @param {string} [options.potionType] - 藥水類型：'memory_boost' 或 'brain_boost'
 * @param {string} [options.characterId] - 角色 ID（記憶增強藥水需要）
 * @param {number} [options.durationDays=30] - 藥水持續天數
 * @returns {Promise<Object>} 操作結果
 * @throws {Error} 操作失敗時拋出錯誤
 */
export const addOrRemovePotions = async (userId, options) => {
  const { action, potionType, characterId, durationDays = 30 } = options;

  // 檢查用戶是否存在
  try {
    await auth.getUser(userId);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error("用戶不存在");
    }
    throw error;
  }

  if (action === "add") {
    // 添加藥水到 usage_limits
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    let potionId;
    let potionData;

    if (potionType === "memory_boost") {
      if (!characterId) {
        throw new Error("記憶增強藥水需要指定角色ID");
      }
      potionId = `memory_boost_${characterId}`;
      potionData = {
        characterId,
        potionType: "memory_boost",
        expiresAt: expiresAt.toISOString(),
        purchasedAt: now.toISOString(),
        manuallyAdded: true,
        addedBy: "admin",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    } else if (potionType === "brain_boost") {
      potionId = "brain_boost";
      potionData = {
        potionType: "brain_boost",
        expiresAt: expiresAt.toISOString(),
        purchasedAt: now.toISOString(),
        manuallyAdded: true,
        addedBy: "admin",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    } else {
      throw new Error("無效的藥水類型");
    }

    await db
      .collection("usage_limits")
      .doc(userId)
      .set(
        {
          potions: {
            [potionId]: potionData,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    return {
      message: `成功添加${potionType === "memory_boost" ? "記憶增強" : "腦力激盪"}藥水`,
      potion: potionData,
    };

  } else if (action === "delete") {
    // 從 usage_limits 刪除藥水
    if (!potionType) {
      throw new Error("需要指定藥水類型");
    }

    let potionId;
    if (potionType === "memory_boost") {
      if (!characterId) {
        throw new Error("記憶增強藥水需要指定角色ID");
      }
      potionId = `memory_boost_${characterId}`;
    } else if (potionType === "brain_boost") {
      potionId = "brain_boost";
    } else {
      throw new Error("無效的藥水類型");
    }

    // 獲取現有的 potions 對象
    const limitsRef = db.collection("usage_limits").doc(userId);
    const limitsDoc = await limitsRef.get();

    if (limitsDoc.exists) {
      const limitsData = limitsDoc.data();
      const potions = limitsData.potions || {};

      // 刪除指定的藥水
      delete potions[potionId];

      // 更新整個 potions 對象
      await limitsRef.set(
        {
          potions,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return {
      message: `成功刪除${potionType === "memory_boost" ? "記憶增強" : "腦力激盪"}藥水`,
    };

  } else if (action === "deleteAll") {
    // 從 usage_limits 刪除所有藥水
    const limitsRef = db.collection("usage_limits").doc(userId);
    const limitsDoc = await limitsRef.get();

    let deletedCount = 0;
    if (limitsDoc.exists) {
      const limitsData = limitsDoc.data();
      const potions = limitsData.potions || {};
      deletedCount = Object.keys(potions).length;

      // 清空 potions 對象
      await limitsRef.set(
        {
          potions: {},
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return {
      message: `成功刪除所有藥水`,
      deletedCount,
    };

  } else {
    throw new Error("無效的操作類型");
  }
};
