/**
 * 前端資產配置（引用共享配置 + UI 擴展）
 *
 * ⚠️ 重要：基礎配置來自 shared/config
 * - 名稱、價格、效果等從共享配置讀取
 * - 這裡只添加 UI 相關配置（圖標、顏色等）
 */

// 引用共享配置
import { ASSET_CARDS_BASE_CONFIG } from '../../../shared/config/assets.js';
import { POTIONS_BASE_CONFIG } from '../../../shared/config/potions.js';

/**
 * 圖標顏色配置（UI 專用）
 */
interface IconColorConfig {
  wrapper: string;
  border: string;
  icon: string;
}

interface IconColorMap {
  coins: IconColorConfig;
  character: IconColorConfig;
  photo: IconColorConfig;
  video: IconColorConfig;
  voice: IconColorConfig;
  create: IconColorConfig;
  memory: IconColorConfig;
  brain: IconColorConfig;
}

/**
 * 金幣圖標路徑（UI 專用）
 * ⚠️ 所有使用金幣圖片的地方都應該從這裡導入
 */
export const COIN_ICON_PATH: string = '/icons/wallet-coin.png';

/**
 * 圖標配置（UI 專用）
 * ⚠️ 使用 emoji 圖標以提供更豐富的視覺效果
 * 與後端的 CATEGORY_ICONS 保持一致
 */
const ICON_MAP: Record<string, string> = {
  'character-unlock': '🎭',
  'photo-unlock': '📸',
  'video-unlock': '🎬',
  'voice-unlock': '🔊',
  'create': '✨',
  'memory_boost': '🧠',
  'brain_boost': '⚡',
};

/**
 * 圖標顏色配置（UI 專用）
 */
export const ICON_COLORS: IconColorMap = {
  coins: {
    wrapper: 'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.15))',
    border: 'rgba(251, 191, 36, 0.3)',
    icon: '#fbbf24',
  },
  character: {
    wrapper: 'linear-gradient(135deg, rgba(167, 139, 250, 0.25), rgba(139, 92, 246, 0.15))',
    border: 'rgba(167, 139, 250, 0.3)',
    icon: '#a78bfa',
  },
  photo: {
    wrapper: 'linear-gradient(135deg, rgba(96, 165, 250, 0.25), rgba(59, 130, 246, 0.15))',
    border: 'rgba(96, 165, 250, 0.3)',
    icon: '#60a5fa',
  },
  video: {
    wrapper: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: '#f59e0b',
  },
  voice: {
    wrapper: 'linear-gradient(135deg, rgba(244, 114, 182, 0.25), rgba(236, 72, 153, 0.15))',
    border: 'rgba(244, 114, 182, 0.3)',
    icon: '#f472b6',
  },
  create: {
    wrapper: 'linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(22, 163, 74, 0.15))',
    border: 'rgba(34, 197, 94, 0.3)',
    icon: '#22c55e',
  },
  memory: {
    wrapper: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(124, 58, 237, 0.15))',
    border: 'rgba(139, 92, 246, 0.3)',
    icon: '#a78bfa',
  },
  brain: {
    wrapper: 'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.15))',
    border: 'rgba(251, 191, 36, 0.3)',
    icon: '#fbbf24',
  },
};

/**
 * 擴展資產卡片配置（添加 UI 組件）
 */
export const ASSET_CARDS: Record<string, any> = Object.fromEntries(
  Object.entries(ASSET_CARDS_BASE_CONFIG).map(([key, card]: [string, any]) => [
    key,
    {
      ...card,
      icon: ICON_MAP[card.id],
      iconColor: card.id.replace('-unlock', '').replace('create', 'create'),
      shopCategory: card.shopConfig.category,
    },
  ])
);

/**
 * 擴展道具配置（添加 UI 組件）
 */
export const ASSET_POTIONS: Record<string, any> = Object.fromEntries(
  Object.entries(POTIONS_BASE_CONFIG).map(([key, potion]: [string, any]) => [
    key,
    {
      ...potion,
      assetKey: key === 'MEMORY_BOOST' ? 'memoryBoost' : 'brainBoost',
      parentKey: 'potions',
      icon: ICON_MAP[potion.id],
      iconColor: potion.id === 'memory_boost' ? 'memory' : 'brain',
      unit: potion.displayConfig.unit,
      description: potion.displayConfig.shortDescription,
      effect: potion.effect.displayText,
      shopId: `potion-${potion.id.replace('_', '-')}`,
      shopCategory: potion.shopConfig.category,
    },
  ])
);

/**
 * 獲取所有資產卡片列表
 */
export const getAssetCardsList = (): any[] => {
  return Object.values(ASSET_CARDS);
};

/**
 * 獲取所有道具列表
 */
export const getPotionsList = (): any[] => {
  return Object.values(ASSET_POTIONS);
};

/**
 * 獲取所有資產項目（卡片+道具）
 */
export const getAllAssets = (): any[] => {
  return [...getAssetCardsList(), ...getPotionsList()];
};

/**
 * 根據 assetKey 獲取資產配置
 */
export const getAssetByKey = (assetKey: string): any | null => {
  // 查找卡片
  const card = Object.values(ASSET_CARDS).find((c: any) => c.assetKey === assetKey);
  if (card) return card;

  // 查找道具
  const potion = Object.values(ASSET_POTIONS).find((p: any) => p.assetKey === assetKey);
  if (potion) return potion;

  return null;
};

/**
 * 根據商城分類 ID 獲取資產配置
 */
export const getAssetByShopCategory = (categoryId: string): any | null => {
  // 查找卡片
  const card = Object.values(ASSET_CARDS).find((c: any) => c.shopCategory === categoryId);
  if (card) return card;

  // 查找道具
  const potion = Object.values(ASSET_POTIONS).find((p: any) => p.shopCategory === categoryId);
  if (potion) return potion;

  return null;
};

/**
 * 根據圖標顏色 ID 獲取樣式
 */
export const getIconColor = (colorId: string): IconColorConfig => {
  return ICON_COLORS[colorId as keyof IconColorMap] || ICON_COLORS.coins;
};
