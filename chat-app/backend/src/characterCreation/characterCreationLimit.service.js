/**
 * 角色創建次數限制服務
 * 使用統一的基礎限制服務模組
 */

import { createLimitService, RESET_PERIOD } from "../services/baseLimitService.js";

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
 */
export const canCreateCharacter = async (userId) => {
  const result = await characterCreationLimitService.canUse(userId);

  // 獲取統計信息以取得標準限制
  const stats = await characterCreationLimitService.getStats(userId);

  return {
    ...result,
    standardTotal: stats.standardLimit, // 用於顯示的標準限制
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
  getCreationStats,
  resetCreationLimit,
  clearAllLimits,
};
