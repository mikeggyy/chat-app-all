import { db } from "../../firebase/index.js";

/**
 * 藥水工具函數模塊
 * 提供藥水相關的輔助功能
 */

/**
 * 獲取用戶的藥水數據（從 usage_limits 集合）
 * 使用兩階段庫存系統：potionInventory + activePotionEffects
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 藥水數據
 * @returns {Object} returns.inventory - 未使用的藥水庫存
 * @returns {Array} returns.activeEffects - 激活的藥水效果列表
 * @returns {Object} returns.totalActive - 激活效果的統計
 */
export const getUserPotions = async (userId) => {
  try {
    const usageLimitDoc = await db.collection("usage_limits").doc(userId).get();

    if (!usageLimitDoc.exists) {
      return {
        inventory: { memoryBoost: 0, brainBoost: 0 },
        activeEffects: [],
        totalActive: { memoryBoost: 0, brainBoost: 0 },
      };
    }

    const usageLimitData = usageLimitDoc.data();

    // 庫存數據（未使用的藥水）
    const potionInventory = usageLimitData.potionInventory || {};
    const inventory = {
      memoryBoost: potionInventory.memoryBoost || 0,
      brainBoost: potionInventory.brainBoost || 0,
    };

    // 激活的效果（已使用並生效中的藥水）
    const activePotionEffects = usageLimitData.activePotionEffects || {};
    const now = new Date();
    const activeEffects = [];
    let activeMemoryBoostCount = 0;
    let activeBrainBoostCount = 0;

    for (const [effectId, effectData] of Object.entries(activePotionEffects)) {
      const isActive = effectData.expiresAt && new Date(effectData.expiresAt) > now;

      if (isActive) {
        activeEffects.push({
          id: effectId,
          ...effectData,
        });

        if (effectData.potionType === "memory_boost") {
          activeMemoryBoostCount++;
        } else if (effectData.potionType === "brain_boost") {
          activeBrainBoostCount++;
        }
      }
    }

    return {
      inventory,
      activeEffects,
      totalActive: {
        memoryBoost: activeMemoryBoostCount,
        brainBoost: activeBrainBoostCount,
      },
    };
  } catch (error) {
    console.error("Error getting user potions:", error);
    return {
      inventory: { memoryBoost: 0, brainBoost: 0 },
      activeEffects: [],
      totalActive: { memoryBoost: 0, brainBoost: 0 },
    };
  }
};
