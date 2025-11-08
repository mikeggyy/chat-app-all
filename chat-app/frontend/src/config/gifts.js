/**
 * 禮物系統配置（前端）
 * 引用共享配置並添加前端特定功能
 */

import {
  GIFTS,
  RARITY_CONFIG,
  getGiftList,
  getGiftById,
  isValidGift,
} from "../../../shared/config/gifts.js";

// 重新導出共享配置
export { GIFTS, RARITY_CONFIG, getGiftList, getGiftById, isValidGift };

/**
 * 獲取禮物價格（考慮會員折扣）
 * 前端特定功能：計算會員折扣後的價格
 */
export const getGiftPrice = (giftId, membershipTier = "free") => {
  const gift = getGiftById(giftId);
  if (!gift) return null;

  // 根據會員等級計算折扣
  const discountMap = {
    free: 0,
    vip: 0.1,    // 9折
    vvip: 0.2,   // 8折
  };

  const discount = discountMap[membershipTier] || 0;
  const finalPrice = Math.ceil(gift.price * (1 - discount));

  return {
    basePrice: gift.price,
    discount,
    finalPrice,
    saved: gift.price - finalPrice,
  };
};

export default {
  GIFTS,
  RARITY_CONFIG,
  getGiftList,
  getGiftById,
  isValidGift,
  getGiftPrice,
};
