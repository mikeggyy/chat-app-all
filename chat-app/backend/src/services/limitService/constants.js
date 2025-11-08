/**
 * 限制服務常量
 */

/**
 * 重置週期類型
 */
export const RESET_PERIOD = {
  NONE: "none", // 不重置
  DAILY: "daily", // 每日重置
  WEEKLY: "weekly", // 每週重置
  MONTHLY: "monthly", // 每月重置
  LIFETIME: "lifetime", // 終生限制（不重置）
};

export default {
  RESET_PERIOD,
};
