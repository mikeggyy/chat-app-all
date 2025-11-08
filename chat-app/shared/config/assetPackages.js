/**
 * 資產套餐配置（前後端通用）
 *
 * 架構說明：
 * - 每個套餐是獨立的 SKU，有唯一 ID 和固定價格
 * - 前端根據 SKU 顯示商品
 * - 後端根據 SKU 查詢價格並扣款
 */

/**
 * 資產套餐 SKU 配置
 */
export const ASSET_PACKAGES = [
  // ========== 角色解鎖卡 ==========
  {
    sku: 'character-unlock-1',
    assetType: 'characterUnlockCard',
    category: 'character-unlock',
    name: '1 張',
    quantity: 1,
    basePrice: 300,
    discountRate: 1.0,
    finalPrice: 300,
    popular: false,
    badge: null,
  },
  {
    sku: 'character-unlock-5',
    assetType: 'characterUnlockCard',
    category: 'character-unlock',
    name: '5 張',
    quantity: 5,
    basePrice: 1500,
    discountRate: 0.9,
    finalPrice: 1350,
    popular: true,
    badge: '9折',
  },
  {
    sku: 'character-unlock-10',
    assetType: 'characterUnlockCard',
    category: 'character-unlock',
    name: '10 張',
    quantity: 10,
    basePrice: 3000,
    discountRate: 0.85,
    finalPrice: 2550,
    popular: false,
    badge: '85折',
  },

  // ========== 拍照卡 ==========
  {
    sku: 'photo-unlock-1',
    assetType: 'photoUnlockCard',
    category: 'photo-unlock',
    name: '1 張',
    quantity: 1,
    basePrice: 50,
    discountRate: 1.0,
    finalPrice: 50,
    popular: false,
    badge: null,
  },
  {
    sku: 'photo-unlock-10',
    assetType: 'photoUnlockCard',
    category: 'photo-unlock',
    name: '10 張',
    quantity: 10,
    basePrice: 500,
    discountRate: 0.9,
    finalPrice: 450,
    popular: true,
    badge: '9折',
  },
  {
    sku: 'photo-unlock-30',
    assetType: 'photoUnlockCard',
    category: 'photo-unlock',
    name: '30 張',
    quantity: 30,
    basePrice: 1500,
    discountRate: 0.85,
    finalPrice: 1275,
    popular: false,
    badge: '85折',
  },

  // ========== 影片卡 ==========
  {
    sku: 'video-unlock-1',
    assetType: 'videoUnlockCard',
    category: 'video-unlock',
    name: '1 支',
    quantity: 1,
    basePrice: 200,
    discountRate: 1.0,
    finalPrice: 200,
    popular: false,
    badge: null,
  },
  {
    sku: 'video-unlock-5',
    assetType: 'videoUnlockCard',
    category: 'video-unlock',
    name: '5 支',
    quantity: 5,
    basePrice: 1000,
    discountRate: 0.9,
    finalPrice: 900,
    popular: true,
    badge: '9折',
  },
  {
    sku: 'video-unlock-10',
    assetType: 'videoUnlockCard',
    category: 'video-unlock',
    name: '10 支',
    quantity: 10,
    basePrice: 2000,
    discountRate: 0.85,
    finalPrice: 1700,
    popular: false,
    badge: '85折',
  },

  // ========== 語音解鎖卡 ==========
  {
    sku: 'voice-unlock-1',
    assetType: 'voiceUnlockCard',
    category: 'voice-unlock',
    name: '1 張',
    quantity: 1,
    basePrice: 30,
    discountRate: 1.0,
    finalPrice: 30,
    popular: false,
    badge: null,
  },
  {
    sku: 'voice-unlock-20',
    assetType: 'voiceUnlockCard',
    category: 'voice-unlock',
    name: '20 張',
    quantity: 20,
    basePrice: 600,
    discountRate: 0.9,
    finalPrice: 540,
    popular: true,
    badge: '9折',
  },
  {
    sku: 'voice-unlock-50',
    assetType: 'voiceUnlockCard',
    category: 'voice-unlock',
    name: '50 張',
    quantity: 50,
    basePrice: 1500,
    discountRate: 0.85,
    finalPrice: 1275,
    popular: false,
    badge: '85折',
  },

  // ========== 創建角色卡 ==========
  {
    sku: 'create-1',
    assetType: 'createCards',
    category: 'create',
    name: '1 張',
    quantity: 1,
    basePrice: 200,
    discountRate: 1.0,
    finalPrice: 200,
    popular: true,
    badge: '推薦',
  },
  {
    sku: 'create-5',
    assetType: 'createCards',
    category: 'create',
    name: '5 張',
    quantity: 5,
    basePrice: 1000,
    discountRate: 0.9,
    finalPrice: 900,
    popular: false,
    badge: '9折',
  },
  {
    sku: 'create-10',
    assetType: 'createCards',
    category: 'create',
    name: '10 張',
    quantity: 10,
    basePrice: 2000,
    discountRate: 0.85,
    finalPrice: 1700,
    popular: false,
    badge: '85折',
  },
];

/**
 * 根據 SKU 查詢套餐
 */
export const getPackageBySku = (sku) => {
  return ASSET_PACKAGES.find((pkg) => pkg.sku === sku);
};

/**
 * 根據分類查詢所有套餐
 */
export const getPackagesByCategory = (category) => {
  return ASSET_PACKAGES.filter((pkg) => pkg.category === category);
};

/**
 * 獲取所有套餐列表
 */
export const getAllPackages = () => {
  return ASSET_PACKAGES;
};
