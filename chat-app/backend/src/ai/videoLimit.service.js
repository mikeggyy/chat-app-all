/**
 * 影片生成次數限制服務
 * 使用統一的基礎限制服務模組（Firestore 版本）
 */

import { createLimitService, RESET_PERIOD } from "../services/baseLimitService.js";
import { VIDEO_LIMITS } from "../config/limits.js";
import { getUserById } from "../user/user.service.js";

// 創建影片限制服務實例
export const videoLimitService = createLimitService({
  serviceName: "影片限制",
  limitType: "影片生成",
  getMembershipLimit: (membershipConfig, tier) => {
    // 根據會員等級返回影片生成限制
    // ⚠️ VIP/VVIP 的實際次數來自開通時發放的卡片，這裡返回 0
    switch (tier) {
      case "guest":
        return 0; // 遊客不能生成影片
      case "vvip":
        return VIDEO_LIMITS.VVIP_MONTHLY; // 0（實際次數來自卡片）
      case "vip":
        return VIDEO_LIMITS.VIP_MONTHLY; // 0（實際次數來自卡片）
      case "free":
      default:
        return VIDEO_LIMITS.FREE_LIFETIME; // 0（免費用戶無權限）
    }
  },
  testAccountLimitKey: "VIDEOS",
  resetPeriod: RESET_PERIOD.NONE, // 不重置（VIP/VVIP 使用卡片）
  perCharacter: false, // 不按角色追蹤
  allowGuest: false, // 遊客不能使用影片生成功能
  fieldName: "videos", // Firestore 欄位名稱
});

/**
 * 獲取重置週期（根據會員等級）
 * ✅ 2025-11-30 更新：新增 Lite 等級支援
 */
const getResetPeriod = (tier) => {
  if (tier === "guest") {
    return "none"; // 遊客沒有影片生成權限
  } else if (tier === "free") {
    return VIDEO_LIMITS.RESET_PERIOD.FREE; // none (無權限)
  } else if (tier === "lite") {
    return VIDEO_LIMITS.RESET_PERIOD.LITE; // none (需金幣購買)
  } else if (tier === "vvip") {
    return VIDEO_LIMITS.RESET_PERIOD.VVIP; // none (使用卡片)
  } else if (tier === "vip") {
    return VIDEO_LIMITS.RESET_PERIOD.VIP; // none (使用卡片)
  }
  return "none";
};

/**
 * 獲取用戶的影片卡數量（支持多種資料結構，向後兼容）
 */
const getVideoUnlockCards = async (userId) => {
  try {
    const user = await getUserById(userId);

    // 優先順序：
    // ✅ 統一從 assets 讀取
    return user?.assets?.videoUnlockCards || 0;
  } catch (error) {
    return 0;
  }
};

/**
 * 檢查是否可以生成影片（整合 unlockTickets 影片卡）
 *
 * ✅ 安全性說明：
 * - allowed: 基於基礎會員額度（不包括卡片）
 * - allowedWithCard: 如果基礎額度用完，但有卡片可用
 * - 前端應該：
 *   1. 如果 allowed=true，可以直接生成（不傳 useVideoUnlockCard）
 *   2. 如果 allowed=false 但 allowedWithCard=true，提示用戶使用卡片
 *   3. 如果兩者都是 false，提示用戶購買卡片或升級會員
 */
export const canGenerateVideo = async (userId) => {
  // 1. 獲取基礎限制檢查結果
  const result = await videoLimitService.canUse(userId);

  // 2. 獲取 unlockTickets 中的影片卡數量
  const videoCards = await getVideoUnlockCards(userId);

  // 3. 獲取統計信息以取得標準限制（基礎會員額度，不包括卡片）
  const stats = await videoLimitService.getStats(userId);

  // 4. ⚠️ 重要：allowed 只基於基礎會員額度，不包括任何卡片
  // 基礎會員額度 = standardLimit（免費用戶 = 0，VIP = 0，VVIP = 0）
  // 影片卡需要用戶手動確認使用，所以 allowed 必須基於基礎額度判斷
  const baseQuota = stats.standardLimit; // 基礎會員額度
  const baseRemaining = Math.max(0, baseQuota - result.used);
  const isAllowedByBaseQuota = baseRemaining > 0;

  // ✅ 新增：明確告訴前端是否可以使用卡片生成
  const allowedWithCard = !isAllowedByBaseQuota && videoCards > 0;

  // 5. 添加 resetPeriod 到結果中
  const resetPeriod = getResetPeriod(result.tier);

  const finalResult = {
    ...result,
    // ⚠️ 覆蓋 allowed：只基於基礎會員額度，不包括任何卡片
    allowed: isAllowedByBaseQuota,
    allowedWithCard, // ✅ 新增：是否可以使用卡片生成
    remaining: baseRemaining, // 也要更新 remaining（只顯示基礎剩餘）
    videoCards, // 添加影片卡數量供前端判斷
    resetPeriod,
    standardVideosLimit: stats.standardLimit, // 用於顯示的標準限制
    isTestAccount: stats.isTestAccount || false,
    canGenerate: isAllowedByBaseQuota || allowedWithCard, // ✅ 改進：可以用基礎額度或卡片生成
    canPurchaseCard: !isAllowedByBaseQuota && videoCards === 0, // 沒有基礎額度且沒有卡時才提示購買
  };

  return finalResult;
};

/**
 * 記錄一次影片生成
 */
export const recordVideoGeneration = async (userId) => {
  return await videoLimitService.recordUse(userId);
};

/**
 * 購買影片生成卡
 */
export const purchaseVideoCards = async (userId, quantity = 1, paymentInfo = {}) => {
  return await videoLimitService.purchaseCards(userId, quantity, paymentInfo);
};

/**
 * 獲取用戶影片生成使用統計
 */
export const getVideoStats = async (userId) => {
  const stats = await videoLimitService.getStats(userId);

  // 獲取 unlockTickets 中的影片卡
  const videoCards = await getVideoUnlockCards(userId);

  // 整合計算：基礎次數 + unlockTickets 影片卡
  const totalWithCards = stats.total === -1 ? -1 : (stats.total + videoCards);
  const remainingWithCards = stats.total === -1 ? -1 : Math.max(0, totalWithCards - stats.used);

  const resetPeriod = getResetPeriod(stats.tier);

  // 保持向後兼容的格式
  const result = {
    tier: stats.tier,
    videosLimit: totalWithCards,
    standardVideosLimit: stats.standardLimit === -1 ? -1 : stats.standardLimit, // 用於顯示的標準限制
    isTestAccount: stats.isTestAccount || false,
    resetPeriod,
    used: stats.used,
    lifetimeUsed: stats.lifetimeUsed,
    remaining: remainingWithCards,
    cards: videoCards, // 返回 unlockTickets 的影片卡數量
    lastResetDate: stats.lastResetDate,
  };

  return result;
};

/**
 * 重置用戶影片生成次數（管理員功能）
 */
export const resetVideoLimit = async (userId) => {
  return await videoLimitService.reset(userId);
};

/**
 * 清除所有影片生成限制記錄（測試用）
 */
export const clearAllLimits = async () => {
  return await videoLimitService.clearAll();
};

export default {
  canGenerateVideo,
  recordVideoGeneration,
  purchaseVideoCards,
  getVideoStats,
  resetVideoLimit,
  clearAllLimits,
};
