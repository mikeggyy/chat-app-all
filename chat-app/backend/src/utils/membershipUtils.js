/**
 * 會員相關工具函數
 * 統一管理會員等級檢查、驗證等共享邏輯
 */

import { getUserById } from "../user/user.service.js";
import { getUserProfileWithCache } from "../user/userProfileCache.service.js";
import { isDevUser, isGuestUser } from "../../../shared/config/testAccounts.js";
import { TEST_ACCOUNT_LIMITS } from "../config/limits.js";

/**
 * 獲取用戶的會員等級
 * 會自動檢查會員是否過期，過期則返回 "free"
 *
 * ⚡ 性能優化：使用緩存減少 Firestore 查詢（5 分鐘緩存）
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 選項
 * @param {boolean} options.useCache - 是否使用緩存（默認 true）
 * @returns {Promise<string>} 會員等級 ("guest" | "free" | "vip" | "vvip")
 */
export const getUserTier = async (userId, options = {}) => {
  const { useCache = true } = options;

  // 檢查是否為遊客（優先級最高）
  if (isGuestUser(userId)) {
    return "guest";
  }

  // 測試帳號使用配置中設定的會員等級
  if (isDevUser(userId)) {
    return TEST_ACCOUNT_LIMITS.MEMBERSHIP_TIER || "free";
  }

  // 使用緩存獲取用戶資料（默認啟用緩存）
  const user = useCache
    ? await getUserProfileWithCache(userId)
    : await getUserById(userId);

  if (!user) {
    return "free";
  }

  const tier = user.membershipTier || "free";

  // 檢查會員是否過期
  if (tier !== "free" && user.membershipExpiresAt) {
    if (new Date(user.membershipExpiresAt) < new Date()) {
      return "free"; // 會員已過期，降為免費會員
    }
  }

  return tier;
};

/**
 * 檢查用戶是否為付費會員（VIP 或 VVIP）
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<boolean>}
 */
export const isPaidMember = async (userId) => {
  const tier = await getUserTier(userId);
  return tier === "vip" || tier === "vvip";
};

/**
 * 檢查用戶是否為免費會員
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<boolean>}
 */
export const isFreeMember = async (userId) => {
  const tier = await getUserTier(userId);
  return tier === "free";
};

/**
 * 檢查用戶會員是否已過期
 *
 * ⚡ 性能優化：使用緩存
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 選項
 * @param {boolean} options.useCache - 是否使用緩存（默認 true）
 * @returns {Promise<boolean>}
 */
export const isMembershipExpired = async (userId, options = {}) => {
  const { useCache = true } = options;

  const user = useCache
    ? await getUserProfileWithCache(userId)
    : await getUserById(userId);

  if (!user || !user.membershipExpiresAt) {
    return false;
  }

  const tier = user.membershipTier || "free";
  if (tier === "free" || tier === "guest") {
    return false;
  }

  return new Date(user.membershipExpiresAt) < new Date();
};
