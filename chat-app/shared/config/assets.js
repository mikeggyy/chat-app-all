/**
 * 共享資產配置 (前後端通用)
 *
 * ⚠️ 重要：這是唯一的資產配置來源
 * - 前端和後端都引用此配置
 * - 修改資產只需要改這一個文件
 * - 不包含 UI 相關配置（圖標、顏色等）
 */

/**
 * 資產卡片基礎配置
 */
export const ASSET_CARDS_BASE_CONFIG = {
  CHARACTER_UNLOCK: {
    id: 'character-unlock',
    assetKey: 'characterUnlockCards',
    name: '角色解鎖卡',
    description: '永久解鎖與特定角色的無限對話',
    basePrice: 300, // 單價
    displayConfig: {
      unit: '張',
    },
    shopConfig: {
      category: 'character-unlock',
    },
  },
  PHOTO_UNLOCK: {
    id: 'photo-unlock',
    assetKey: 'photoUnlockCards',
    name: '拍照卡',
    description: '用於生成角色AI照片',
    basePrice: 50,
    displayConfig: {
      unit: '張',
    },
    shopConfig: {
      category: 'photo-unlock',
    },
    hasLimit: true, // 有使用上限
  },
  VIDEO_UNLOCK: {
    id: 'video-unlock',
    assetKey: 'videoUnlockCards',
    name: '影片卡',
    description: '用於生成角色AI短影片',
    basePrice: 200,
    displayConfig: {
      unit: '支',
    },
    shopConfig: {
      category: 'video-unlock',
    },
  },
  VOICE_UNLOCK: {
    id: 'voice-unlock',
    assetKey: 'voiceUnlockCards',
    name: '語音解鎖卡',
    description: '解鎖角色語音播放功能',
    basePrice: 30,
    displayConfig: {
      unit: '張',
    },
    shopConfig: {
      category: 'voice-unlock',
    },
  },
  CREATE_CHARACTER: {
    id: 'create',
    assetKey: 'createCards',
    name: '創建角色卡',
    description: '獲得創建專屬角色的機會',
    basePrice: 200,
    displayConfig: {
      unit: '張',
    },
    shopConfig: {
      category: 'create',
    },
    hasLimit: true, // 有使用上限
  },
};

/**
 * 獲取所有資產卡片列表
 */
export const getAssetCardsList = () => {
  return Object.values(ASSET_CARDS_BASE_CONFIG);
};

/**
 * 根據 ID 獲取資產卡片配置
 */
export const getAssetCardById = (id) => {
  return getAssetCardsList().find((card) => card.id === id);
};

/**
 * 根據 assetKey 獲取資產卡片配置
 */
export const getAssetCardByKey = (assetKey) => {
  return getAssetCardsList().find((card) => card.assetKey === assetKey);
};
