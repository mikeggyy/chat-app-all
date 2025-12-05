/**
 * 會員相關工具函數
 * 統一管理會員等級檢查、驗證等共享邏輯
 */

import { getUserById } from "../user/user.service.js";
import { getUserProfileWithCache } from "../user/userProfileCache.service.js";
import { isDevUser, isGuestUser } from "../../../../shared/config/testAccounts.js";
import { TEST_ACCOUNT_LIMITS } from "../config/limits.js";
import logger from "./logger.js";

/**
 * 從用戶對象中提取會員等級（純函數，不進行 DB 查詢）
 * ✅ 優化：避免重複查詢用戶數據
 *
 * @param {Object} user - 用戶對象
 * @param {string} userId - 用戶 ID（用於特殊帳號檢查）
 * @returns {string} 會員等級 ("guest" | "free" | "lite" | "vip" | "vvip")
 */
export const extractTierFromUser = (user, userId) => {
  // 檢查是否為遊客（優先級最高）
  if (isGuestUser(userId)) {
    return "guest";
  }

  // 測試帳號使用配置中設定的會員等級
  if (isDevUser(userId)) {
    return TEST_ACCOUNT_LIMITS.MEMBERSHIP_TIER || "free";
  }

  if (!user) {
    return "free";
  }

  const tier = user.membershipTier || "free";

  // 檢查會員是否過期
  if (tier !== "free" && tier !== "guest") {
    // ✅ 付費會員必須有有效的過期時間
    if (!user.membershipExpiresAt) {
      logger.warn('[會員檢查] 付費會員缺少過期時間，自動降級為免費會員', { userId });
      return "free";
    }

    const expiresAt = new Date(user.membershipExpiresAt);

    // ✅ 驗證過期時間格式
    if (isNaN(expiresAt.getTime())) {
      logger.warn('[會員檢查] 付費會員的過期時間格式無效，自動降級為免費會員', { userId });
      return "free";
    }

    // ✅ 檢查是否過期
    if (expiresAt < new Date()) {
      return "free"; // 會員已過期，降為免費會員
    }
  }

  return tier;
};

/**
 * 獲取用戶的會員等級
 * 會自動檢查會員是否過期，過期則返回 "free"
 *
 * ⚡ 性能優化：
 * - 支持傳入已有的用戶對象，避免重複查詢
 * - 使用緩存減少 Firestore 查詢（1 分鐘緩存）
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 選項
 * @param {boolean} options.useCache - 是否使用緩存（默認 true）
 * @param {Object} options.user - 已有的用戶對象（可選，傳入則跳過查詢）
 * @returns {Promise<string>} 會員等級 ("guest" | "free" | "lite" | "vip" | "vvip")
 */
export const getUserTier = async (userId, options = {}) => {
  const { useCache = true, user: providedUser = null } = options;

  // 檢查是否為遊客（優先級最高）
  if (isGuestUser(userId)) {
    return "guest";
  }

  // 測試帳號使用配置中設定的會員等級
  if (isDevUser(userId)) {
    return TEST_ACCOUNT_LIMITS.MEMBERSHIP_TIER || "free";
  }

  // ✅ 優化：如果已傳入用戶對象，直接使用，避免重複查詢
  const user = providedUser
    ? providedUser
    : useCache
      ? await getUserProfileWithCache(userId)
      : await getUserById(userId);

  return extractTierFromUser(user, userId);
};

/**
 * 檢查用戶是否為付費會員（Lite, VIP 或 VVIP）
 * ✅ 2025-11-30 更新：新增 Lite 等級支援
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<boolean>}
 */
export const isPaidMember = async (userId) => {
  const tier = await getUserTier(userId);
  return tier === "lite" || tier === "vip" || tier === "vvip";
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
