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
 *
 * ✅ 安全性增強 - 添加基本防護機制（2025-01-13）
 *
 * 已實現的防護：
 * - ✅ 每日廣告次數限制檢查（10 次/天）
 * - ✅ 冷卻時間檢查（60 秒）
 * - ✅ adId 格式驗證
 * - ✅ 防止重放攻擊（adId 去重）
 * - ✅ 記錄廣告觀看歷史
 *
 * 待 Google AdMob 整合後增強：
 * - ⏳ 真實廣告驗證（需 AdMob SDK）
 * - ⏳ 觀看時長驗證（通過 AdMob 回調）
 */
export const unlockByAd = async (userId, characterId, adId) => {
  const { getFirestoreDb } = await import("../firebase/index.js");
  const { FieldValue } = await import("firebase-admin/firestore");
  const loggerModule = await import("../utils/logger.js");
  const logger = loggerModule.default;
  const db = getFirestoreDb();

  // ✅ P0-1 High 修復：使用 Transaction 確保原子性
  // 防止併發請求導致計數錯誤
  let unlockResult;

  // ✅ 在 transaction 外先獲取用戶等級，避免 transaction 內讀取
  const tier = await getUserTier(userId);
  const membershipConfig = MEMBERSHIP_TIERS[tier];
  const unlockedAmount = membershipConfig?.features?.unlockedMessagesPerAd ?? 5;

  await db.runTransaction(async (transaction) => {
    const adStatsRef = db.collection("ad_watch_stats").doc(userId);
    const limitRef = db.collection("usage_limits").doc(userId);

    // ✅ 1. 先執行所有讀取操作（Firestore transaction 要求）
    const statsDoc = await transaction.get(adStatsRef);
    const statsData = statsDoc.exists ? statsDoc.data() : {};

    const limitDoc = await transaction.get(limitRef);
    const limitData = limitDoc.exists ? limitDoc.data() : {};

    // 2. 檢查每日廣告次數限制（10 次/天）
    const today = new Date().toISOString().split("T")[0];
    const todayCount = statsData[today] || 0;
    const DAILY_AD_LIMIT = 10;

    if (todayCount >= DAILY_AD_LIMIT) {
      throw new Error(`今日廣告觀看次數已達上限（${DAILY_AD_LIMIT} 次），請明天再來`);
    }

    // 3. 檢查冷卻時間（60 秒）
    const lastWatchTime = statsData.lastWatchTime || 0;
    const COOLDOWN_SECONDS = 60;
    const cooldownRemaining = Math.ceil((lastWatchTime + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);

    if (cooldownRemaining > 0) {
      throw new Error(`請等待 ${cooldownRemaining} 秒後再觀看下一個廣告`);
    }

    // 4. 簡單的 adId 格式驗證
    // 預期格式：ad-{timestamp}-{random8}，例如 ad-1705123456789-a1b2c3d4
    if (!adId || !adId.match(/^ad-\d{13}-[a-z0-9]{8}$/)) {
      throw new Error("無效的廣告 ID 格式");
    }

    // 5. ✅ 驗證 adId 時間戳（防止使用過期或未來的廣告ID）
    const adTimestamp = parseInt(adId.split('-')[1], 10);
    const now = Date.now();
    const AD_VALID_WINDOW = 5 * 60 * 1000; // 廣告ID有效期：5分鐘
    const timeDiff = now - adTimestamp;

    // ✅ Critical Fix: 明確拒絕未來時間戳和過期時間戳
    if (isNaN(adTimestamp) || timeDiff < 0 || timeDiff > AD_VALID_WINDOW) {
      if (timeDiff < 0) {
        logger.warn(`[廣告解鎖] ⚠️ 檢測到未來時間戳: ${adId}, timestamp: ${adTimestamp}, now: ${now}`);
        throw new Error("無效的廣告 ID（時間異常），請重新觀看廣告");
      }
      logger.warn(`[廣告解鎖] ⚠️ 廣告時間戳已過期: ${adId}, timestamp: ${adTimestamp}, now: ${now}`);
      throw new Error("廣告 ID 已過期，請重新觀看廣告");
    }

    // 6. ✅ 檢查 adId 重複使用（防止重放攻擊）
    // ⚠️ 注意：Transaction 提供樂觀鎖定和自動衝突檢測，無需手動二次讀取
    const usedAdIds = statsData.usedAdIds || [];
    if (usedAdIds.includes(adId)) {
      logger.warn(`[廣告解鎖] ⚠️ 檢測到重複 adId: ${adId.substring(0, 20)}...`);
      throw new Error("該廣告獎勵已領取，請勿重複領取");
    }

    logger.info(`[廣告解鎖] Transaction 內驗證通過 - 用戶 ${userId} 觀看廣告解鎖對話`, {
      characterId,
      adId: adId.substring(0, 20) + "...", // 只記錄部分 adId
      todayCount: todayCount + 1,
      unlockedAmount,
    });

    // ✅ 7. 執行所有寫入操作（在所有讀取之後）
    // 7.1 記錄廣告觀看
    transaction.set(
      adStatsRef,
      {
        [today]: todayCount + 1,
        lastWatchTime: Date.now(),
        usedAdIds: [...usedAdIds.slice(-100), adId], // ✅ 使用 statsData 的 usedAdIds
        lastAdId: adId,
        lastCharacterId: characterId,
        totalAdsWatched: (statsData.totalAdsWatched || 0) + 1,
        updatedAt: new Date().toISOString(), // ✅ 使用 ISO 字串避免 ServerTimestampTransform 序列化問題
      },
      { merge: true }
    );

    // 7.2 解鎖對話
    const conversationLimit = limitData.conversation?.[characterId] || {
      count: 0,
      lastReset: new Date().toISOString().split("T")[0],
      unlockHistory: [],
    };

    // ✅ 正確的解鎖邏輯：添加到 unlockHistory，而不是修改 count
    // count 是已使用次數，unlockHistory 記錄廣告解鎖的額外額度
    const currentTime = new Date();
    const utc8Offset = 8 * 60 * 60 * 1000;
    const nowUTC8 = new Date(currentTime.getTime() + currentTime.getTimezoneOffset() * 60000 + utc8Offset);
    const expiresAt = new Date(nowUTC8.getTime() + 24 * 60 * 60 * 1000);

    if (!Array.isArray(conversationLimit.unlockHistory)) {
      conversationLimit.unlockHistory = [];
    }

    conversationLimit.unlockHistory.push({
      amount: unlockedAmount,
      unlockedAt: nowUTC8.toISOString(),
      expiresAt: expiresAt.toISOString(),
      unlockType: 'ad',
    });

    transaction.set(
      limitRef,
      {
        conversation: {
          [characterId]: conversationLimit,
        },
      },
      { merge: true }
    );

    unlockResult = {
      success: true,
      unlockedAmount,
      usedCount: conversationLimit.count,  // 已使用次數
      unlockCount: conversationLimit.unlockHistory.length,  // 解鎖次數
      characterId,
    };

    logger.info(`[廣告解鎖] ✅ Transaction 完成 - 用戶 ${userId} 解鎖 ${unlockedAmount} 次對話`);
  });

  // Transaction 完成後，異步記錄監控事件（不阻塞響應）
  // ✅ P0-1 監控：記錄廣告觀看事件並檢測異常
  try {
    const { recordAdWatchEvent } = await import("../services/adWatchMonitor.service.js");
    await recordAdWatchEvent(userId, characterId, adId, {
      // 可選：從 request 中獲取 IP 和 User-Agent
      // ip: req.ip,
      // userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    // 監控失敗不應影響主流程
    logger.error(`[廣告監控] 記錄廣告觀看事件失敗:`, error);
  }

  return unlockResult;
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
