/**
 * 角色創建次數限制服務
 * 使用統一的基礎限制服務模組
 */

import { createLimitService, RESET_PERIOD } from "../services/baseLimitService.js";
import { createModuleLogger } from "../utils/logger.js";

const logger = createModuleLogger('CharacterCreationLimit');

// 創建角色創建限制服務實例
const characterCreationLimitService = createLimitService({
  serviceName: "角色創建限制",
  limitType: "角色創建",
  getMembershipLimit: (membershipConfig, tier) => {
    // 從會員配置中取得角色創建上限
    return membershipConfig.features.maxCreatedCharacters;
  },
  testAccountLimitKey: "CHARACTER_CREATIONS",
  resetPeriod: RESET_PERIOD.MONTHLY, // 每月重置
  perCharacter: false, // 不按角色追蹤
  allowGuest: false, // 遊客不能創建角色
  fieldName: "character_creation", // Firestore 欄位名稱
});

/**
 * 檢查是否可以創建角色
 *
 * 檢查邏輯：
 * 1. 優先使用會員等級的免費次數（來自 usage_limits collection）
 * 2. 如果免費次數用完，檢查用戶的創建卡（來自 users/{userId}/assets）
 * 3. 返回統一的結果格式，包含可用資源信息
 */
export const canCreateCharacter = async (userId) => {
  // 第一步：檢查會員等級的免費次數
  const baseLimitCheck = await characterCreationLimitService.canUse(userId);
  const stats = await characterCreationLimitService.getStats(userId);

  // 第二步：如果免費次數已用完，檢查創建卡（新 assets 系統）
  if (!baseLimitCheck.allowed && baseLimitCheck.reason === "limit_exceeded") {
    try {
      const { getUserAssets } = await import("../user/assets.service.js");
      const assets = await getUserAssets(userId);

      // 如果用戶有創建卡，允許創建並返回創建卡信息
      if (assets && assets.createCards > 0) {
        return {
          allowed: true,
          reason: "create_card_available",
          remaining: 0, // 會員免費次數已用完
          createCards: assets.createCards,
          used: baseLimitCheck.used,
          total: baseLimitCheck.total,
          standardTotal: stats.standardLimit,
          isTestAccount: stats.isTestAccount || false,
        };
      }
    } catch (error) {
      logger.error("獲取用戶資產失敗:", error);
      // 如果 assets 系統失敗，繼續使用基礎檢查結果（安全降級）
    }
  }

  // 第三步：返回基礎檢查結果（允許創建或次數不足）
  return {
    ...baseLimitCheck,
    standardTotal: stats.standardLimit,
    isTestAccount: stats.isTestAccount || false,
  };
};

/**
 * 記錄一次角色創建
 */
export const recordCreation = (userId, characterId) => {
  return characterCreationLimitService.recordUse(userId, null, { characterId });
};

/**
 * 回滾一次角色創建（用於創建失敗的情況）
 *
 * 用途：當記錄了創建次數但角色創建失敗時，回滾計數
 * 注意：只減少本期計數，不減少終生計數
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} metadata - 回滾元數據（用於審計）
 * @returns {Promise<Object>} 回滾結果
 */
export const decrementCreation = (userId, metadata = {}) => {
  return characterCreationLimitService.decrementUse(userId, null, metadata);
};

/**
 * 獲取用戶的角色創建統計
 */
export const getCreationStats = async (userId) => {
  const stats = await characterCreationLimitService.getStats(userId);

  // 保持向後兼容的格式
  return {
    tier: stats.tier,
    total: stats.total,
    standardTotal: stats.standardLimit, // 用於顯示的標準限制
    isTestAccount: stats.isTestAccount || false,
    used: stats.used,
    remaining: stats.remaining,
    unlimited: stats.unlimited,
    canCreateCharacters: stats.total !== 0, // 如果 total 不是 0 就表示可以創建
    lastResetDate: stats.lastResetDate,
    history: [], // 歷史記錄從基礎服務中取得
  };
};

/**
 * 重置用戶的角色創建次數（管理員功能）
 */
export const resetCreationLimit = (userId) => {
  return characterCreationLimitService.reset(userId);
};

/**
 * 清除所有角色創建限制記錄（測試用）
 */
export const clearAllLimits = () => {
  return characterCreationLimitService.clearAll()
};

export default {
  canCreateCharacter,
  recordCreation,
  decrementCreation,
  getCreationStats,
  resetCreationLimit,
  clearAllLimits,
};
