/**
 * 禮物系統配置（後端）
 * 引用共享配置
 */

import {
  GIFTS,
  RARITY_CONFIG,
  getGiftList,
  getGiftById,
  isValidGift,
} from "../../../../shared/config/gifts.js";

// 重新導出共享配置
export { GIFTS, RARITY_CONFIG, getGiftList, getGiftById, isValidGift };

export default {
  GIFTS,
  RARITY_CONFIG,
  getGiftList,
  getGiftById,
  isValidGift,
};
