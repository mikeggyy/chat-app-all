/**
 * 對話次數限制服務
 * 使用統一的基礎限制服務模組（Firestore 版本）
 */

import { createLimitService, RESET_PERIOD } from "../services/baseLimitService.js";
import { MEMBERSHIP_TIERS } from "../membership/membership.config.js";
import { getUserTier } from "../utils/membershipUtils.js";

// 創建對話限制服務實例
export const conversationLimitService = createLimitService({
  serviceName: "對話限制",
  limitType: "對話",
  getMembershipLimit: (membershipConfig, tier) => {
    // 從會員配置中取得對話限制
    return membershipConfig.features.unlimitedChats
      ? -1 // 無限對話
      : membershipConfig.features.messagesPerCharacter;
  },
  testAccountLimitKey: "CONVERSATIONS_PER_CHARACTER",
  resetPeriod: RESET_PERIOD.DAILY, // ✅ 改為每日重置（提升用戶體驗）
  perCharacter: true, // 按角色追蹤
  allowGuest: true, // 遊客可以對話（但不受限制）
  fieldName: "conversation", // Firestore 欄位名稱
});

/**
 * 檢查是否可以發送訊息
 */
export const canSendMessage = async (userId, characterId) => {
  const result = await conversationLimitService.canUse(userId, characterId);

  const finalResult = {
    ...result,
    canSend: result.allowed,
  };

  return finalResult;
};

/**
 * 記錄一次對話
 */
export const recordMessage = async (userId, characterId) => {
  return await conversationLimitService.recordUse(userId, characterId);
};

/**
 * 透過觀看廣告解鎖額外對話次數
 */
export const unlockByAd = async (userId, characterId, adId) => {
  // 從會員配置中獲取解鎖參數
  const tier = await getUserTier(userId);
  const membershipConfig = MEMBERSHIP_TIERS[tier];
  const unlockedAmount = membershipConfig?.features?.unlockedMessagesPerAd ?? 5;

  return await conversationLimitService.unlockByAd(userId, unlockedAmount, characterId);
};

/**
 * 使用金幣永久解鎖與角色的對話
 */
export const unlockPermanently = async (userId, characterId) => {
  return await conversationLimitService.unlockPermanently(userId, characterId);
};

/**
 * 獲取用戶與所有角色的對話統計
 */
export const getConversationStats = async (userId) => {
  const stats = await conversationLimitService.getAllStats(userId);

  // 從會員配置中獲取解鎖參數
  const tier = await getUserTier(userId);
  const membershipConfig = MEMBERSHIP_TIERS[tier];
  const unlockedMessagesPerAd = membershipConfig?.features?.unlockedMessagesPerAd ?? 5;

  // 保持向後兼容的格式
  const result = {
    tier: stats.tier,
    unlimitedChats: stats.unlimited,
    requireAds: stats.tier === "free" || stats.tier === "test", // 免費和測試用戶需要廣告
    messagesPerCharacter: stats.limitPerCharacter,
    standardMessagesPerCharacter: stats.standardLimitPerCharacter, // 用於顯示的標準限制
    isTestAccount: stats.isTestAccount || false,
    unlockedMessagesPerAd,
    characters: stats.characters,
  };

  return result;
};

/**
 * 重置用戶與特定角色的對話次數（管理員功能）
 */
export const resetConversationLimit = async (userId, characterId) => {
  return await conversationLimitService.reset(userId, characterId);
};

/**
 * 清除所有對話限制記錄（測試用）
 */
export const clearAllLimits = async () => {
  return await conversationLimitService.clearAll();
};

export default {
  canSendMessage,
  recordMessage,
  unlockByAd,
  unlockPermanently,
  getConversationStats,
  resetConversationLimit,
  clearAllLimits,
};
