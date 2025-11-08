/**
 * 限制配置管理模組
 * 負責獲取和管理用戶限制配置
 */

import { MEMBERSHIP_TIERS } from "../../membership/membership.config.js";
import { isDevUser } from "../../../../../shared/config/testAccounts.js";
import { TEST_ACCOUNT_LIMITS } from "../../config/limits.js";
import { getUserTier } from "../../utils/membershipUtils.js";
import { getFirestoreDb } from "../../firebase/index.js";
import logger from "../../utils/logger.js";

// 緩存會員配置（避免重複查詢 Firestore）
const membershipConfigCache = new Map();
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 分鐘緩存

/**
 * 從 Firestore 獲取會員配置
 * @param {string} tier - 會員等級
 * @returns {Promise<Object>} 會員配置
 */
async function getMembershipConfigFromFirestore(tier) {
  const now = Date.now();

  // 檢查緩存
  if (membershipConfigCache.has(tier) && now < cacheExpiry) {
    return membershipConfigCache.get(tier);
  }

  try {
    const db = getFirestoreDb();
    const doc = await db.collection("membership_tiers").doc(tier).get();

    if (doc.exists) {
      const config = doc.data();
      membershipConfigCache.set(tier, config);
      cacheExpiry = now + CACHE_TTL;
      return config;
    }
  } catch (error) {
    logger.warn(`[limitConfig] 從 Firestore 讀取會員配置失敗: ${error.message}`);
  }

  // 如果 Firestore 中沒有，使用代碼中的默認值
  return MEMBERSHIP_TIERS[tier];
}

/**
 * 取得限制配置
 * @param {string} userId - 用戶 ID
 * @param {Function} getMembershipLimit - 取得會員等級限制的函數
 * @param {string} testAccountLimitKey - TEST_ACCOUNT_LIMITS 中的鍵名
 * @param {string} serviceName - 服務名稱（用於日誌）
 * @returns {Promise<Object>} 限制配置
 */
export const getLimitConfig = async (
  userId,
  getMembershipLimit,
  testAccountLimitKey,
  serviceName
) => {
  const tier = await getUserTier(userId);

  const membershipConfig = await getMembershipConfigFromFirestore(tier);

  const standardLimit = getMembershipLimit(membershipConfig, tier);

  // 檢查是否為測試帳號
  const devUser = isDevUser(userId);
  const isTestAccount = devUser;

  let limit = standardLimit;

  // 如果是測試帳號，且有對應的限制配置，使用測試配置
  if (isTestAccount && testAccountLimitKey && TEST_ACCOUNT_LIMITS[testAccountLimitKey] !== undefined) {
    limit = TEST_ACCOUNT_LIMITS[testAccountLimitKey];
  }

  return {
    tier,
    limit,
    standardLimit, // 用於顯示的標準限制
    isTestAccount,
    membershipConfig,
  };
};

export default {
  getLimitConfig,
};
