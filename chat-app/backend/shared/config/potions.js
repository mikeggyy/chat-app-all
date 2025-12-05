/**
 * 共享道具配置 (前後端通用)
 *
 * ⚠️ 重要：這是唯一的道具配置來源
 * - 前端和後端都引用此配置
 * - 修改道具只需要改這一個文件
 * - 不包含 UI 相關配置（圖標、顏色等）
 */

/**
 * 道具基礎配置
 */
export const POTIONS_BASE_CONFIG = {
  // 記憶增強藥水
  MEMORY_BOOST: {
    id: "memory_boost",
    name: "記憶增強藥水",
    description: "增加單一角色10000 token上限",
    price: 200,
    duration: 30, // 天數
    effect: {
      type: "memory",
      value: 10000, // 增加的 token 數量
      displayText: "增加單一角色記憶上限",
    },
    // 前端顯示用
    displayConfig: {
      unit: "個",
      shortDescription: "效用30天",
    },
    // 商城配置
    shopConfig: {
      category: "potions",
      popular: false,
      requiresCharacter: true, // 使用時需要選擇角色，購買時不需要
      showInShop: true, // 在商城顯示
    },
  },

  // 腦力激盪藥水
  BRAIN_BOOST: {
    id: "brain_boost",
    name: "腦力激盪藥水",
    description: "模型升級為 GPT-4.1 mini",
    price: 200,
    duration: 30, // 天數
    effect: {
      type: "model",
      value: "gpt-4.1-mini", // 升級後的模型
      displayText: "使用更聰明的模型",
    },
    // 前端顯示用
    displayConfig: {
      unit: "個",
      shortDescription: "效用30天",
    },
    // 商城配置
    shopConfig: {
      category: "potions",
      popular: true,
      badge: "推薦",
      requiresCharacter: false, // 不需要選擇角色，全局升級
    },
    // VVIP 用戶不能購買
    restrictedTiers: ["vvip"],
    restrictedMessage: "您的模型已經是最高級了",
  },
};

/**
 * 獲取所有道具列表
 */
export const getPotionsList = () => {
  return Object.values(POTIONS_BASE_CONFIG);
};

/**
 * 根據 ID 獲取道具配置
 */
export const getPotionById = (id) => {
  return getPotionsList().find((potion) => potion.id === id);
};

/**
 * 獲取道具的實際效果值（後端使用）
 */
export const getPotionEffect = (id) => {
  const potion = getPotionById(id);
  return potion?.effect;
};
