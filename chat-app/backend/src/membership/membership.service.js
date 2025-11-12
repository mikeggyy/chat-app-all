/**
 * 會員管理服務
 * 處理會員升級、降級、續訂等功能
 */

import { getUserById, upsertUser } from "../user/user.service.js";
import { getUserProfileWithCache, deleteCachedUserProfile } from "../user/userProfileCache.service.js";
import { MEMBERSHIP_TIERS, hasFeatureAccess } from "./membership.config.js";
import { grantTickets } from "./unlockTickets.service.js";
import { addCoins, TRANSACTION_TYPES } from "../payment/coins.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import { clearCache } from "../utils/firestoreCache.js";
import logger from "../utils/logger.js";

// ============================================
// 會員配置快取系統（優化版）
// ============================================
// 使用 Map 儲存各個 tier 的配置和獨立過期時間
const membershipConfigCache = new Map(); // tier -> { config, expiresAt }
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘緩存（會員配置很少變動，延長緩存時間以提升效能）

/**
 * 清除會員配置快取
 * @param {string} [tier] - 可選，指定要清除的會員等級。不提供則清除所有快取
 */
export const clearMembershipConfigCache = (tier = null) => {
  if (tier) {
    const deleted = membershipConfigCache.delete(tier);
    if (deleted) {
      logger.info(`[會員服務] 已清除會員配置快取: ${tier}`);
    }
  } else {
    membershipConfigCache.clear();
    logger.info(`[會員服務] 已清除所有會員配置快取`);
  }
};

/**
 * 從 Firestore 獲取會員配置（帶快取）
 * @param {string} tier - 會員等級 (free, vip, vvip)
 * @returns {Promise<Object>} 會員配置
 */
const getMembershipConfigFromFirestore = async (tier) => {
  const now = Date.now();

  // 檢查快取
  const cached = membershipConfigCache.get(tier);
  if (cached && now < cached.expiresAt) {
    logger.debug(`[會員服務] 使用快取的會員配置: ${tier} (剩餘 ${Math.round((cached.expiresAt - now) / 1000)}秒)`);
    return cached.config;
  }

  try {
    const db = getFirestoreDb();
    const doc = await db.collection("membership_tiers").doc(tier).get();

    if (doc.exists) {
      const config = doc.data();

      // 更新快取（每個 tier 獨立的過期時間）
      membershipConfigCache.set(tier, {
        config,
        expiresAt: now + CACHE_TTL,
      });

      logger.debug(`[會員服務] 從 Firestore 讀取會員配置: ${tier}，已更新快取`);
      return config;
    }
  } catch (error) {
    logger.warn(`[會員服務] 從 Firestore 讀取會員配置失敗: ${error.message}`);
  }

  // 如果 Firestore 中沒有，使用代碼中的默認值
  const fallbackConfig = MEMBERSHIP_TIERS[tier];

  // 也將 fallback 放入快取，但使用較短的 TTL（1 分鐘）
  membershipConfigCache.set(tier, {
    config: fallbackConfig,
    expiresAt: now + 60 * 1000,
  });

  logger.debug(`[會員服務] 使用代碼中的會員配置: ${tier}（fallback）`);
  return fallbackConfig;
};
/**
 * 獲取用戶的完整會員資訊
 */
export const getUserMembership = async (userId) => {
  const user = await getUserProfileWithCache(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const tier = user.membershipTier || "free";
  const tierConfig = await getMembershipConfigFromFirestore(tier);

  // 檢查會員是否有效
  const isActive = checkMembershipActive(user);

  // 如果會員過期但狀態還是 active，自動降級
  if (!isActive && tier !== "free") {
    return await autoDowngradeExpiredMembership(userId);
  }

  return {
    userId,
    tier,
    tierName: tierConfig.name,
    status: user.membershipStatus || "active",
    isActive,
    features: tierConfig.features,
    price: tierConfig.price,
    currency: tierConfig.currency,
    startedAt: user.membershipStartedAt,
    expiresAt: user.membershipExpiresAt,
    autoRenew: user.membershipAutoRenew || false,
    daysRemaining: calculateDaysRemaining(user.membershipExpiresAt),
  };
};

/**
 * 檢查會員是否有效
 */
const checkMembershipActive = (user) => {
  if (!user.membershipTier || user.membershipTier === "free") {
    return true; // 免費會員永遠有效
  }

  // 檢查狀態
  if (user.membershipStatus === "cancelled" || user.membershipStatus === "expired") {
    return false;
  }

  // 檢查到期日
  if (user.membershipExpiresAt) {
    const expiresAt = new Date(user.membershipExpiresAt);
    const now = new Date();
    return expiresAt > now;
  }

  // 如果沒有到期日，視為永久會員
  return true;
};

/**
 * 計算剩餘天數
 */
const calculateDaysRemaining = (expiresAt) => {
  if (!expiresAt) {
    return -1; // 無限制
  }

  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires - now;

  if (diff < 0) {
    return 0;
  }

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * 自動降級過期會員
 */
const autoDowngradeExpiredMembership = async (userId) => {
  const user = await getUserById(userId);

  const updated = await upsertUser({
    ...user,
    membershipTier: "free",
    membershipStatus: "expired",
    updatedAt: new Date().toISOString(),
  });

  // ✅ 清除用戶資料緩存，確保下次讀取時獲取最新狀態
  deleteCachedUserProfile(userId);
  clearCache(`user:${userId}:membership`); // 舊緩存系統（向後兼容）
  logger.info(`[會員服務] 已清除過期用戶 ${userId} 的緩存`);

  return await getUserMembership(userId);
};

/**
 * 升級會員
 */
export const upgradeMembership = async (userId, targetTier, options = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const tierConfig = await getMembershipConfigFromFirestore(targetTier);
  if (!tierConfig) {
    throw new Error(`無效的會員等級：${targetTier}`);
  }

  if (targetTier === "free") {
    throw new Error("無法升級為免費會員，請使用取消訂閱功能");
  }

  const currentTier = user.membershipTier || "free";

  // 檢查是否為降級操作
  const tierOrder = { free: 0, vip: 1, vvip: 2 };
  if (tierOrder[targetTier] < tierOrder[currentTier]) {
    throw new Error("不支援降級操作，請取消當前訂閱");
  }

  const now = new Date();
  const durationMonths = options.durationMonths || 1;

  // 計算到期日
  let expiresAt;
  if (currentTier !== "free" && user.membershipExpiresAt) {
    // 如果已經是付費會員，從當前到期日延長
    expiresAt = new Date(user.membershipExpiresAt);
    if (expiresAt < now) {
      expiresAt = now; // 如果已過期，從現在開始算
    }
  } else {
    expiresAt = new Date(now);
  }

  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  // TODO: 這裡應該整合支付系統
  // 目前直接升級，實際應用應先驗證付款成功

  // ✅ 修復: 將所有操作合併到一個 Firestore Transaction 中，確保原子性
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  // 發放開通獎勵（解鎖票和金幣）- 只在新開通或升級時發放
  const isNewActivation = currentTier === "free" || tierOrder[targetTier] > tierOrder[currentTier];

  // 如果是從免費升級，保留剩餘的拍照次數（轉換成拍照卡）- 在 Transaction 外計算
  let bonusPhotoCards = 0;
  if (isNewActivation && currentTier === "free") {
    try {
      const { getPhotoStats } = await import("../ai/photoLimit.service.js");
      const photoStats = await getPhotoStats(userId);

      // 計算剩餘次數（基礎額度 - 已使用）
      const remaining = Math.max(0, (photoStats.standardPhotosLimit || 0) - (photoStats.used || 0));

      if (remaining > 0) {
        bonusPhotoCards = remaining;
        logger.info(`[會員服務] 保留免費用戶剩餘拍照次數 - 用戶: ${userId}, 剩餘: ${remaining} 次，轉換為拍照卡`);
      }
    } catch (error) {
      logger.error("獲取免費用戶剩餘拍照次數失敗:", error);
    }
  }

  // ✅ 使用 Transaction 確保所有操作原子性
  let result = null;
  await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內重新讀取用戶（確保使用最新數據）
    const freshUserDoc = await transaction.get(userRef);
    if (!freshUserDoc.exists) {
      throw new Error("找不到用戶");
    }

    const freshUser = freshUserDoc.data();

    // 2. 準備會員狀態更新
    const membershipUpdate = {
      membershipTier: targetTier,
      membershipStatus: "active",
      membershipStartedAt: freshUser.membershipStartedAt || now.toISOString(),
      membershipExpiresAt: expiresAt.toISOString(),
      membershipAutoRenew: options.autoRenew || false,
      updatedAt: now.toISOString(),
    };

    // 3. 如果是新激活，在同一 Transaction 內發放獎勵
    if (isNewActivation) {
      const features = tierConfig.features;

      // 3.1 發放解鎖票（直接更新用戶文檔）
      const currentTickets = freshUser.unlockTickets || {};
      const photoCardsToGrant = (features.photoUnlockCards || 0) + bonusPhotoCards;

      membershipUpdate.unlockTickets = {
        characterUnlockCards: (currentTickets.characterUnlockCards || 0) + (features.characterUnlockCards || 0),
        photoUnlockCards: (currentTickets.photoUnlockCards || 0) + photoCardsToGrant,
        videoUnlockCards: (currentTickets.videoUnlockCards || 0) + (features.videoUnlockCards || 0),
        // 保留其他票券
        voiceUnlockCards: currentTickets.voiceUnlockCards || 0,
      };

      // 3.2 發放創建角色卡（直接更新用戶 assets）
      if (features.characterCreationCards > 0) {
        const currentAssets = freshUser.assets || {};
        membershipUpdate.assets = {
          ...currentAssets,
          createCards: (currentAssets.createCards || 0) + features.characterCreationCards,
        };
      }

      // 3.3 發放金幣（直接更新用戶金幣餘額）
      if (features.monthlyCoinsBonus > 0) {
        const currentBalance = freshUser.coins?.balance || freshUser.coins || 0;
        const newBalance = currentBalance + features.monthlyCoinsBonus;

        membershipUpdate.coins = {
          balance: newBalance,
          lastUpdated: now.toISOString(),
        };

        // 創建交易記錄（在同一 Transaction 內）
        const transactionRef = db.collection("transactions").doc();
        transaction.set(transactionRef, {
          userId,
          type: TRANSACTION_TYPES.REWARD,
          amount: features.monthlyCoinsBonus,
          description: `會員開通獎勵 - ${tierConfig.name}`,
          metadata: {
            tier: targetTier,
            reason: "membership_activation",
          },
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          status: "completed",
          createdAt: new Date().toISOString(),
        });
      }

      // 記錄獎勵日誌
      const rewardLog = [];
      if (membershipUpdate.unlockTickets) {
        rewardLog.push(`解鎖票: 角色${membershipUpdate.unlockTickets.characterUnlockCards - currentTickets.characterUnlockCards}, 拍照${photoCardsToGrant}, 視頻${membershipUpdate.unlockTickets.videoUnlockCards - currentTickets.videoUnlockCards}`);
      }
      if (membershipUpdate.assets?.createCards) {
        rewardLog.push(`創建卡: ${features.characterCreationCards}`);
      }
      if (membershipUpdate.coins) {
        rewardLog.push(`金幣: ${features.monthlyCoinsBonus}`);
      }

      logger.info(`[會員服務-Transaction] 準備發放獎勵 - 用戶: ${userId}, ${rewardLog.join(', ')}`);
    }

    // 4. 在 Transaction 內更新用戶文檔
    transaction.update(userRef, membershipUpdate);

    // 5. 記錄會員變更歷史（可選，用於審計）
    const membershipHistoryRef = db.collection("membership_history").doc();
    transaction.set(membershipHistoryRef, {
      userId,
      fromTier: currentTier,
      toTier: targetTier,
      operation: "upgrade",
      expiresAt: expiresAt.toISOString(),
      isNewActivation,
      rewards: membershipUpdate.unlockTickets || {},
      timestamp: now.toISOString(),
    });

    result = { success: true, tier: targetTier };
  });

  // ✅ Transaction 完成後清除緩存
  deleteCachedUserProfile(userId);
  clearCache(`user:${userId}:membership`); // 舊緩存系統（向後兼容）
  logger.info(`[會員服務] 用戶 ${userId} 升級至 ${targetTier} 完成（原子性操作）`);

  return await getUserMembership(userId);
};

/**
 * 取消訂閱
 */
export const cancelMembership = async (userId, immediate = false) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const currentTier = user.membershipTier || "free";
  if (currentTier === "free") {
    throw new Error("您目前是免費會員，無需取消");
  }

  const now = new Date();

  if (immediate) {
    // 立即取消，降級為免費會員
    const updated = await upsertUser({
      ...user,
      membershipTier: "free",
      membershipStatus: "cancelled",
      membershipAutoRenew: false,
      updatedAt: now.toISOString(),
    });
  } else {
    // 到期後自動降級，目前保持會員身份
    const updated = await upsertUser({
      ...user,
      membershipStatus: "cancelled",
      membershipAutoRenew: false,
      updatedAt: now.toISOString(),
    });
  }

  // ✅ 清除用戶資料緩存，確保下次讀取時獲取最新狀態
  deleteCachedUserProfile(userId);
  clearCache(`user:${userId}:membership`); // 舊緩存系統（向後兼容）
  logger.info(`[會員服務] 用戶 ${userId} 取消會員（${immediate ? '立即' : '到期後'}），已清除緩存`);

  return await getUserMembership(userId);
};

/**
 * 續訂會員
 */
export const renewMembership = async (userId, durationMonths = 1) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const currentTier = user.membershipTier || "free";
  if (currentTier === "free") {
    throw new Error("免費會員無法續訂，請使用升級功能");
  }

  // TODO: 驗證付款

  const now = new Date();
  let expiresAt = new Date(user.membershipExpiresAt || now);

  // 從當前到期日延長
  if (expiresAt < now) {
    expiresAt = new Date(now);
  }

  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  const updated = await upsertUser({
    ...user,
    membershipStatus: "active",
    membershipExpiresAt: expiresAt.toISOString(),
    updatedAt: now.toISOString(),
  });

  // ✅ 清除用戶資料緩存，確保下次讀取時獲取最新狀態
  deleteCachedUserProfile(userId);
  clearCache(`user:${userId}:membership`); // 舊緩存系統（向後兼容）
  logger.info(`[會員服務] 用戶 ${userId} 續訂會員 ${durationMonths} 個月，已清除緩存`);

  return await getUserMembership(userId);
};

/**
 * 檢查用戶是否有特定功能的權限
 */
export const checkFeatureAccess = async (userId, featureName) => {
  const membership = await getUserMembership(userId);

  if (!membership.isActive) {
    // 會員已過期，使用免費會員的權限
    return hasFeatureAccess("free", featureName);
  }

  return hasFeatureAccess(membership.tier, featureName);
};

/**
 * 獲取用戶可用的功能列表
 */
export const getUserFeatures = async (userId) => {
  const membership = await getUserMembership(userId);
  const tier = membership.isActive ? membership.tier : "free";
  const tierConfig = await getMembershipConfigFromFirestore(tier);

  return {
    tier,
    isActive: membership.isActive,
    features: tierConfig.features,
  };
};

/**
 * 檢查即將過期的會員（用於發送提醒）
 */
export const getExpiringMemberships = (daysThreshold = 7) => {
  // TODO: 如果有數據庫，應該查詢所有用戶
  // 目前這個功能需要遍歷所有用戶，暫時返回空陣列
  return [];
};

/**
 * 發放每月會員獎勵（定時任務）
 */
export const distributeMonthlyRewards = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    return null;
  }

  const membership = await getUserMembership(userId);
  if (!membership.isActive || membership.tier === "free") {
    return null;
  }

  const tierConfig = await getMembershipConfigFromFirestore(membership.tier);
  const monthlyBonus = tierConfig.features.monthlyCoinsBonus || 0;

  if (monthlyBonus > 0) {
    // 發放金幣獎勵
    const currentBalance = user.walletBalance || 0;
    const newBalance = currentBalance + monthlyBonus;

    await upsertUser({
      ...user,
      walletBalance: newBalance,
      wallet: {
        ...user.wallet,
        balance: newBalance,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    // ✅ 清除用戶資料緩存（錢包餘額已更新）
    deleteCachedUserProfile(userId);

    logger.info(`[會員服務] 發放每月獎勵成功 - 用戶: ${userId}, 金幣: ${monthlyBonus}`);

    return {
      userId,
      tier: membership.tier,
      coinsAwarded: monthlyBonus,
      newBalance,
    };
  }

  return null;
};

export default {
  getUserMembership,
  upgradeMembership,
  cancelMembership,
  renewMembership,
  checkFeatureAccess,
  getUserFeatures,
  getExpiringMemberships,
  distributeMonthlyRewards,
  clearMembershipConfigCache, // 新增：清除會員配置快取
};
