/**
 * 語音播放次數限制服務
 * 使用統一的基礎限制服務模組（Firestore 版本）
 */

import { createLimitService, RESET_PERIOD } from "../services/baseLimitService.js";
import { MEMBERSHIP_TIERS } from "../membership/membership.config.js";
import { getUserTier } from "../utils/membershipUtils.js";
import { getVoiceUnlockCards } from "../membership/unlockTickets.service.js";

// 創建語音限制服務實例
export const voiceLimitService = createLimitService({
  serviceName: "語音限制",
  limitType: "語音",
  getMembershipLimit: (membershipConfig, tier) => {
    // 從會員配置中取得語音限制
    return membershipConfig.features.unlimitedVoice
      ? -1 // 無限語音
      : membershipConfig.features.voicesPerCharacter;
  },
  testAccountLimitKey: "VOICE_PER_CHARACTER",
  resetPeriod: RESET_PERIOD.NONE, // 不自動重置（按角色終生限制）
  perCharacter: true, // 按角色追蹤
  allowGuest: false, // 遊客不能使用語音功能
  fieldName: "voice", // Firestore 欄位名稱
});

/**
 * 檢查是否可以播放語音
 */
export const canPlayVoice = async (userId, characterId) => {
  const result = await voiceLimitService.canUse(userId, characterId);

  // ✅ 獲取語音解鎖卡數量
  const voiceUnlockCards = await getVoiceUnlockCards(userId);

  const finalResult = {
    ...result,
    canPlay: result.allowed,
    voiceUnlockCards, // ✅ 添加語音解鎖卡數量
  };

  return finalResult;
};

/**
 * 記錄一次語音播放
 */
export const recordVoicePlay = async (userId, characterId) => {
  return await voiceLimitService.recordUse(userId, characterId);
};

/**
 * 透過觀看廣告解鎖額外語音次數
 */
export const unlockByAd = async (userId, characterId, adId) => {
  // 從會員配置中獲取解鎖參數
  const tier = await getUserTier(userId);
  const membershipConfig = MEMBERSHIP_TIERS[tier];
  const unlockedAmount = membershipConfig?.features?.unlockedMessagesPerAd ?? 5;

  return await voiceLimitService.unlockByAd(userId, unlockedAmount, characterId);
};

/**
 * 獲取用戶與所有角色的語音使用統計
 */
export const getVoiceStats = async (userId) => {
  const stats = await voiceLimitService.getAllStats(userId);

  // 從會員配置中獲取解鎖參數
  const tier = await getUserTier(userId);
  const membershipConfig = MEMBERSHIP_TIERS[tier];
  const unlockedVoicesPerAd = membershipConfig?.features?.unlockedMessagesPerAd ?? 5;

  // 保持向後兼容的格式
  const result = {
    tier: stats.tier,
    unlimitedVoice: stats.unlimited,
    requireAds: stats.tier === "free", // 免費用戶需要廣告
    voicesPerCharacter: stats.limitPerCharacter,
    standardVoicesPerCharacter: stats.standardLimitPerCharacter, // 用於顯示的標準限制
    isTestAccount: stats.isTestAccount || false,
    unlockedVoicesPerAd,
    characters: stats.characters,
  };

  return result;
};

/**
 * 重置用戶與特定角色的語音次數（管理員功能）
 */
export const resetVoiceLimit = async (userId, characterId) => {
  return await voiceLimitService.reset(userId, characterId);
};

/**
 * 清除所有語音限制記錄（測試用）
 */
export const clearAllLimits = async () => {
  return await voiceLimitService.clearAll();
};

export default {
  canPlayVoice,
  recordVoicePlay,
  unlockByAd,
  getVoiceStats,
  resetVoiceLimit,
  clearAllLimits,
};
