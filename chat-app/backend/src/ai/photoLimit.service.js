/**
 * 拍照次數限制服務
 * 使用統一的基礎限制服務模組（Firestore 版本）
 */

import { createLimitService, RESET_PERIOD } from "../services/baseLimitService.js";
import { PHOTO_LIMITS } from "../config/limits.js";
import { getUserById } from "../user/user.service.js";

// 創建拍照限制服務實例
export const photoLimitService = createLimitService({
  serviceName: "拍照限制",
  limitType: "拍照",
  getMembershipLimit: (membershipConfig, tier) => {
    // 根據會員等級返回拍照限制
    // ⚠️ VIP/VVIP 的實際次數來自開通時發放的卡片，這裡返回 0
    switch (tier) {
      case "guest":
        return 0; // 遊客不能拍照
      case "vvip":
        return PHOTO_LIMITS.VVIP_MONTHLY; // 0（實際次數來自卡片）
      case "vip":
        return PHOTO_LIMITS.VIP_MONTHLY; // 0（實際次數來自卡片）
      case "free":
      default:
        return PHOTO_LIMITS.FREE_LIFETIME; // 3 次終生
    }
  },
  testAccountLimitKey: "PHOTOS",
  resetPeriod: RESET_PERIOD.NONE, // 不重置（VIP/VVIP 使用卡片，免費用戶終生限制）
  perCharacter: false, // 不按角色追蹤
  allowGuest: false, // 遊客不能使用拍照功能
  fieldName: "photos", // Firestore 欄位名稱
});

/**
 * 獲取重置週期（根據會員等級）
 */
const getResetPeriod = (tier) => {
  if (tier === "guest") {
    return "none"; // 遊客沒有拍照權限
  } else if (tier === "free") {
    return PHOTO_LIMITS.RESET_PERIOD.FREE; // lifetime
  } else if (tier === "vvip") {
    return PHOTO_LIMITS.RESET_PERIOD.VVIP; // monthly
  } else if (tier === "vip") {
    return PHOTO_LIMITS.RESET_PERIOD.VIP; // monthly
  }
  return "monthly";
};

/**
 * 獲取用戶的照片卡數量（支持多種資料結構，向後兼容）
 */
const getPhotoUnlockCards = async (userId) => {
  try {
    const user = await getUserById(userId);

    // 優先順序：
    // ✅ 統一從 assets 讀取
    return user?.assets?.photoUnlockCards || 0;
  } catch (error) {
    return 0;
  }
};

/**
 * 檢查是否可以生成拍照（整合 unlockTickets 照片卡）
 *
 * ✅ 安全性說明：
 * - allowed: 基於基礎會員額度（不包括卡片）
 * - allowedWithCard: 如果基礎額度用完，但有卡片可用
 * - 前端應該：
 *   1. 如果 allowed=true，可以直接生成（不傳 usePhotoUnlockCard）
 *   2. 如果 allowed=false 但 allowedWithCard=true，提示用戶使用卡片
 *   3. 如果兩者都是 false，提示用戶購買卡片或升級會員
 */
export const canGeneratePhoto = async (userId) => {
  // 1. 獲取基礎限制檢查結果
  const result = await photoLimitService.canUse(userId);

  // 2. 獲取 unlockTickets 中的照片卡數量
  const photoCards = await getPhotoUnlockCards(userId);

  // 3. 獲取統計信息以取得標準限制（基礎會員額度，不包括卡片）
  const stats = await photoLimitService.getStats(userId);

  // 4. ⚠️ 重要：allowed 只基於基礎會員額度，不包括任何卡片
  // 基礎會員額度 = standardLimit（免費用戶 = 3 次終生，VIP/VVIP = 0）
  // 照片卡需要用戶手動確認使用（通過 modal），所以 allowed 必須基於基礎額度判斷
  const baseQuota = stats.standardLimit === -1 ? Infinity : stats.standardLimit; // 基礎會員額度
  const baseRemaining = baseQuota === Infinity ? Infinity : Math.max(0, baseQuota - result.used);
  const isAllowedByBaseQuota = baseRemaining > 0;

  // ✅ 新增：明確告訴前端是否可以使用卡片生成
  const allowedWithCard = !isAllowedByBaseQuota && photoCards > 0;

  // 5. 添加 resetPeriod 到結果中
  const resetPeriod = getResetPeriod(result.tier);

  const finalResult = {
    ...result,
    // ⚠️ 覆蓋 allowed：只基於基礎會員額度，不包括任何卡片
    allowed: isAllowedByBaseQuota,
    allowedWithCard, // ✅ 新增：是否可以使用卡片生成
    remaining: baseRemaining === Infinity ? -1 : baseRemaining, // 也要更新 remaining（只顯示基礎剩餘）
    photoCards, // 添加照片卡數量供前端判斷
    resetPeriod,
    standardPhotosLimit: stats.standardLimit, // 用於顯示的標準限制
    isTestAccount: stats.isTestAccount || false,
    canGenerate: isAllowedByBaseQuota || allowedWithCard, // ✅ 改進：可以用基礎額度或卡片生成
    canPurchaseCard: !isAllowedByBaseQuota && photoCards === 0, // 沒有基礎額度且沒有卡時才提示購買
  };

  return finalResult;
};

/**
 * 記錄一次拍照生成
 */
export const recordPhotoGeneration = async (userId) => {
  return await photoLimitService.recordUse(userId);
};

/**
 * 購買拍照卡
 */
export const purchasePhotoCards = async (userId, quantity = 1, paymentInfo = {}) => {
  return await photoLimitService.purchaseCards(userId, quantity, paymentInfo);
};

/**
 * 獲取用戶拍照使用統計
 */
export const getPhotoStats = async (userId) => {
  const stats = await photoLimitService.getStats(userId);

  // 獲取 unlockTickets 中的照片卡
  const photoCards = await getPhotoUnlockCards(userId);

  // 整合計算：基礎次數 + unlockTickets 照片卡
  const totalWithCards = stats.total === -1 ? -1 : (stats.total + photoCards);
  const remainingWithCards = stats.total === -1 ? -1 : Math.max(0, totalWithCards - stats.used);

  const resetPeriod = getResetPeriod(stats.tier);

  // 保持向後兼容的格式
  const result = {
    tier: stats.tier,
    photosLimit: totalWithCards,
    standardPhotosLimit: stats.standardLimit === -1 ? -1 : stats.standardLimit, // 用於顯示的標準限制
    isTestAccount: stats.isTestAccount || false,
    resetPeriod,
    used: stats.used,
    lifetimeUsed: stats.lifetimeUsed,
    remaining: remainingWithCards,
    photoCards, // ✅ 修復：與 canGeneratePhoto 保持一致，使用 photoCards 而不是 cards
    lastResetDate: stats.lastResetDate,
  };

  return result;
};

/**
 * 重置用戶拍照次數（管理員功能）
 */
export const resetPhotoLimit = async (userId) => {
  return await photoLimitService.reset(userId);
};

/**
 * 清除所有拍照限制記錄（測試用）
 */
export const clearAllLimits = async () => {
  return await photoLimitService.clearAll();
};

export default {
  canGeneratePhoto,
  recordPhotoGeneration,
  purchasePhotoCards,
  getPhotoStats,
  resetPhotoLimit,
  clearAllLimits,
};
