/**
 * 禮物套餐配置
 * 定義禮物的購買套餐，支持批量折扣
 */

import { GIFTS } from "./gifts.js";

/**
 * 套餐折扣配置
 */
export const GIFT_PACKAGE_TIERS = [
  { quantity: 1, discount: 1, popular: false },      // 無折扣
  { quantity: 5, discount: 0.9, popular: true, badge: "9折" },  // 9折
  { quantity: 10, discount: 0.85, popular: false, badge: "85折" }, // 85折
];

/**
 * 生成禮物套餐
 */
const generateGiftPackages = () => {
  const packages = [];

  Object.values(GIFTS).forEach((gift) => {
    GIFT_PACKAGE_TIERS.forEach((tier) => {
      const basePrice = gift.price * tier.quantity;
      const finalPrice = Math.round(basePrice * tier.discount);

      packages.push({
        // SKU 格式: gift-{giftId}-{quantity}
        // 例如: gift-rose-5, gift-coffee-10
        sku: `gift-${gift.id}-${tier.quantity}`,

        // 資產類型
        assetType: "gift",
        itemId: gift.id,  // 區分不同禮物

        // 分類
        category: "gifts",

        // 顯示信息
        name: `${tier.quantity} 個`,
        giftName: gift.name,
        emoji: gift.emoji,
        description: gift.description,

        // 價格信息
        quantity: tier.quantity,
        basePrice: basePrice,
        discountRate: tier.discount,
        finalPrice: finalPrice,

        // 標記
        popular: tier.popular,
        badge: tier.badge || null,
        rarity: gift.rarity,
      });
    });
  });

  return packages;
};

/**
 * 所有禮物套餐
 */
export const GIFT_PACKAGES = generateGiftPackages();

/**
 * 獲取所有禮物套餐
 */
export const getAllGiftPackages = () => {
  return GIFT_PACKAGES;
};

/**
 * 根據 SKU 獲取禮物套餐
 */
export const getGiftPackageBySku = (sku) => {
  return GIFT_PACKAGES.find((pkg) => pkg.sku === sku) || null;
};

/**
 * 根據禮物 ID 獲取該禮物的所有套餐
 */
export const getGiftPackagesByGiftId = (giftId) => {
  return GIFT_PACKAGES.filter((pkg) => pkg.itemId === giftId);
};

export default {
  GIFT_PACKAGES,
  GIFT_PACKAGE_TIERS,
  getAllGiftPackages,
  getGiftPackageBySku,
  getGiftPackagesByGiftId,
};
