/**
 * 會員管理服務
 * 處理會員升級、降級、續訂等功能
 */

import { getUserById, upsertUser } from "../user/user.service.js";
import { getUserProfileWithCache, deleteCachedUserProfile } from "../user/userProfileCache.service.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import { MEMBERSHIP_TIERS, hasFeatureAccess } from "./membership.config.js";
import { grantTickets } from "./unlockTickets.service.js";
import { addCoins, TRANSACTION_TYPES } from "../payment/coins.service.js";
import { createTransactionInTx } from "../payment/transaction.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import { clearCache } from "../utils/firestoreCache.js";
import logger from "../utils/logger.js";

// ============================================
// 會員配置快取系統（優化版）
// ============================================
// 使用 Map 儲存各個 tier 的配置和獨立過期時間
const membershipConfigCache = new Map(); // tier -> { config, expiresAt }
const CACHE_TTL = 1 * 60 * 1000; // ✅ Quick Win #4: 1 分鐘緩存（降低配置更新延遲）

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
 *
 * ✅ P3-2 修復：明確定義付費會員的有效性檢查
 * - 免費會員：永遠有效
 * - 付費會員（VIP/VVIP）：必須有到期時間且未過期
 */
const checkMembershipActive = (user) => {
  // 1. 免費會員和訪客永遠有效
  if (!user.membershipTier || user.membershipTier === "free" || user.membershipTier === "guest") {
    return true;
  }

  // 2. 檢查狀態（已取消或已過期）
  if (user.membershipStatus === "cancelled" || user.membershipStatus === "expired") {
    return false;
  }

  // 3. ✅ P3-2 修復：付費會員必須有到期時間
  if (!user.membershipExpiresAt) {
    // ⚠️ 付費會員缺少到期時間 - 這是數據不一致的情況
    logger.warn(`[會員服務] 付費會員 ${user.userId || 'unknown'} (${user.membershipTier}) 缺少到期時間，視為無效`);
    return false;
  }

  // 4. 檢查到期日是否有效
  const expiresAt = new Date(user.membershipExpiresAt);

  // 驗證日期格式
  if (isNaN(expiresAt.getTime())) {
    logger.warn(`[會員服務] 付費會員 ${user.userId || 'unknown'} 的到期時間格式無效: ${user.membershipExpiresAt}`);
    return false;
  }

  // 檢查是否已過期
  const now = new Date();
  return expiresAt > now;
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

  // ✅ Quick Win #1: 防止重複升級導致多次獎勵發放
  // 檢查同一等級同一天內是否已經升級過
  if (targetTier === currentTier && user.membershipUpgradeTimestamp) {
    const lastUpgradeTime = new Date(user.membershipUpgradeTimestamp);
    const daysSinceLastUpgrade = (now.getTime() - lastUpgradeTime.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastUpgrade < 1) {
      logger.warn(`[會員服務] 用戶 ${userId} 嘗試在 24 小時內重複升級到 ${targetTier}，拒絕操作（防止重複獎勵）`);
      throw new Error("同一等級每天最多升級一次，請稍後再試");
    }
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

  // ✅ 使用 Transaction 確保所有操作原子性
  // 🔒 P0-1 修復：Firestore Transaction 提供樂觀鎖機制
  //    - 如果 usage_limits 在讀取後被其他操作（如拍照）修改，Transaction 會自動重試
  //    - 最多重試 5 次（Firestore 默認行為）
  //    - 這確保了拍照次數計算的準確性，即使用戶同時在拍照
  let result = null;
  let transactionAttempts = 0;
  const MAX_ATTEMPTS = 5;

  try {
    await db.runTransaction(async (transaction) => {
      transactionAttempts++;
      logger.debug(`[會員服務] Transaction 嘗試 ${transactionAttempts}/${MAX_ATTEMPTS}`);

      // 1. 在 Transaction 內重新讀取用戶（確保使用最新數據）
      const freshUserDoc = await transaction.get(userRef);
      if (!freshUserDoc.exists) {
        throw new Error("找不到用戶");
      }

      const freshUser = freshUserDoc.data();

      // 2. 🔒 在 Transaction 內計算免費用戶剩餘拍照次數（P1-1 修復：防止競態條件）
      // 📌 重要：添加升級鎖定標記，防止拍照操作與升級操作同時進行
      let bonusPhotoCards = 0;
      if (isNewActivation && currentTier === "free") {
        try {
          // 在 Transaction 內讀取拍照統計（鎖定此文檔）
          const usageLimitsRef = db.collection("usage_limits").doc(userId);
          const usageLimitsDoc = await transaction.get(usageLimitsRef);

          if (usageLimitsDoc.exists) {
            const usageLimitsData = usageLimitsDoc.data();
            const photoData = usageLimitsData.photos || {};

            // ✅ P1-1 修復：檢查是否已經在升級中
            if (photoData.upgrading) {
              logger.warn(`[會員服務] 用戶 ${userId} 正在升級中，拒絕重複升級操作`);
              throw new Error("會員升級處理中，請稍後再試");
            }

            // ✅ P1-1 修復：設置升級鎖定標記
            transaction.update(usageLimitsRef, {
              'photos.upgrading': true,
              'photos.upgradingAt': FieldValue.serverTimestamp()
            });

            // 免費用戶的基礎額度是 3 次終生
            const FREE_PHOTO_LIMIT = 3;
            const used = photoData.count || 0;
            const remaining = Math.max(0, FREE_PHOTO_LIMIT - used);

            if (remaining > 0) {
              bonusPhotoCards = remaining;
              logger.info(`[會員服務] 🔒 在 Transaction 內保留免費用戶剩餘拍照次數 - 用戶: ${userId}, 剩餘: ${remaining} 次，轉換為拍照卡`);
            }
          } else {
            // 如果沒有使用記錄，給予完整的 3 次
            bonusPhotoCards = 3;
            logger.info(`[會員服務] 🔒 免費用戶無使用記錄，給予完整額度 3 次拍照卡`);
          }
        } catch (error) {
          logger.error("在 Transaction 內獲取免費用戶剩餘拍照次數失敗:", error);
          // 發生錯誤時不給予獎勵卡，避免不一致
          bonusPhotoCards = 0;
          throw error; // ✅ P1-1 修復：拋出錯誤以中止 Transaction
        }
      }

    // 2. 準備會員狀態更新
    const membershipUpdate = {
      membershipTier: targetTier,
      membershipStatus: "active",
      membershipStartedAt: freshUser.membershipStartedAt || now.toISOString(),
      membershipExpiresAt: expiresAt.toISOString(),
      membershipAutoRenew: options.autoRenew || false,
      membershipUpgradeTimestamp: now.toISOString(), // ✅ Quick Win #1: 記錄升級時間戳（防重複）
      updatedAt: now.toISOString(),
    };

    // 3. 如果是新激活，在同一 Transaction 內發放獎勵
    if (isNewActivation) {
      const features = tierConfig.features;

      // 3.1 發放解鎖票（直接更新用戶文檔）
      const currentTickets = freshUser.unlockTickets || {};
      const photoCardsToGrant = (features.photoUnlockCards || 0) + bonusPhotoCards;

      // ✅ 保留現有的使用歷史記錄
      const existingHistory = currentTickets.usageHistory || [];
      const newGrantRecord = {
        type: "grant",
        amounts: {
          characterUnlockCards: features.characterUnlockCards || 0,
          photoUnlockCards: photoCardsToGrant,
          videoUnlockCards: features.videoUnlockCards || 0,
        },
        timestamp: now.toISOString(),
        reason: "membership_activation",
        tier: targetTier,
      };

      // ✅ 使用展開運算符保留所有現有字段（防止覆蓋未來新增的票券類型）
      membershipUpdate.unlockTickets = {
        ...currentTickets,
        characterUnlockCards: (currentTickets.characterUnlockCards || 0) + (features.characterUnlockCards || 0),
        photoUnlockCards: (currentTickets.photoUnlockCards || 0) + photoCardsToGrant,
        videoUnlockCards: (currentTickets.videoUnlockCards || 0) + (features.videoUnlockCards || 0),
        usageHistory: [...existingHistory, newGrantRecord],
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
        // ✅ 使用 walletHelpers 獲取當前餘額（向後兼容）
        const currentBalance = getWalletBalance(freshUser);
        const newBalance = currentBalance + features.monthlyCoinsBonus;

        // ✅ 使用標準的錢包格式（與 walletHelpers.createWalletUpdate 一致）
        const walletUpdate = createWalletUpdate(newBalance, freshUser.wallet?.currency || "TWD");
        Object.assign(membershipUpdate, walletUpdate);

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

      // 記錄獎勵日誌（記錄增量）
      const rewardLog = [];
      if (membershipUpdate.unlockTickets) {
        rewardLog.push(`解鎖票: 角色+${features.characterUnlockCards || 0}, 拍照+${photoCardsToGrant}, 視頻+${features.videoUnlockCards || 0}`);
      }
      if (membershipUpdate.assets?.createCards) {
        rewardLog.push(`創建卡: +${features.characterCreationCards}`);
      }
      if (membershipUpdate.wallet) {
        rewardLog.push(`金幣: +${features.monthlyCoinsBonus}`);
      }

      logger.info(`[會員服務-Transaction] 準備發放獎勵 - 用戶: ${userId}, ${rewardLog.join(', ')}`);
    }

    // 4. 在 Transaction 內更新用戶文檔
    transaction.update(userRef, membershipUpdate);

    // 5. ✅ P1-1 修復：清除升級鎖定標記（如果有設置）
    if (isNewActivation && currentTier === "free" && bonusPhotoCards >= 0) {
      const usageLimitsRef = db.collection("usage_limits").doc(userId);
      transaction.update(usageLimitsRef, {
        'photos.upgrading': false,
        'photos.upgradeCompletedAt': FieldValue.serverTimestamp()
      });
    }

    // 6. 記錄會員變更歷史（可選，用於審計）
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

    // ✅ Transaction 成功完成
    logger.info(`[會員服務] Transaction 成功完成（嘗試次數: ${transactionAttempts}）`);
  } catch (error) {
    // 🔒 P0-1: Transaction 失敗處理
    logger.error(`[會員服務] Transaction 失敗（嘗試次數: ${transactionAttempts}）:`, error);

    // ✅ P1-1 Critical 修復：Transaction 失敗後清除升級鎖定
    // 雖然 Transaction 會回滾，但為了絕對安全（防止極端邊緣情況），手動清除鎖定
    if (isNewActivation && currentTier === "free") {
      try {
        const usageLimitsRef = db.collection("usage_limits").doc(userId);
        await usageLimitsRef.update({
          'photos.upgrading': false,
          'photos.upgradingFailedAt': FieldValue.serverTimestamp(),
          'photos.lastUpgradeError': error.message || 'Unknown error'
        });
        logger.info(`[會員服務] ✅ 已清除 Transaction 失敗後的升級鎖定標記`);
      } catch (cleanupError) {
        // 清理失敗不應該影響原始錯誤的拋出
        logger.error(`[會員服務] ⚠️ 清除升級鎖定標記失敗:`, cleanupError);
      }
    }

    // 檢查是否為 Firestore 衝突錯誤（ABORTED）
    if (error.code === 10 || error.message.includes('ABORTED')) {
      logger.warn(`[會員服務] Transaction 因資料衝突而失敗，可能用戶正在同時進行其他操作（如拍照）`);
      throw new Error("升級失敗：系統繁忙，請稍後再試");
    }

    // 其他錯誤直接拋出
    throw error;
  }

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
 * 🔒 P2-2: 批量檢查並降級過期會員（定時任務）
 * 掃描所有付費會員，自動降級已過期的會員到 free tier
 * @returns {Promise<Object>} 處理統計結果
 */
export const checkAndDowngradeExpiredMemberships = async () => {
  const startTime = Date.now();
  const db = getFirestoreDb();

  logger.info(`[會員定時任務] 開始批量檢查過期會員...`);

  try {
    const now = new Date();

    // 🔍 查詢所有付費會員（vip 或 vvip），且狀態為 active
    const usersSnapshot = await db
      .collection("users")
      .where("membershipTier", "in", ["vip", "vvip"])
      .where("membershipStatus", "==", "active")
      .get();

    const totalUsers = usersSnapshot.size;
    logger.info(`[會員定時任務] 找到 ${totalUsers} 個活躍付費會員待檢查`);

    if (totalUsers === 0) {
      return {
        success: true,
        totalChecked: 0,
        expired: 0,
        downgraded: 0,
        errors: 0,
        duration: Date.now() - startTime,
      };
    }

    let expiredCount = 0;
    let downgradedCount = 0;
    let errorCount = 0;
    const errors = [];

    // 批量處理（每次最多 500 個，Firestore 限制）
    let batch = db.batch(); // ✅ 使用 let 而不是 const
    let batchCount = 0;
    const BATCH_LIMIT = 500;

    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      const userId = doc.id;

      try {
        // 檢查會員是否過期
        const isExpired = user.membershipExpiresAt && new Date(user.membershipExpiresAt) <= now;

        if (isExpired) {
          expiredCount++;

          // 降級到 free tier
          const userRef = db.collection("users").doc(userId);
          batch.update(userRef, {
            membershipTier: "free",
            membershipStatus: "expired",
            updatedAt: new Date().toISOString(),
          });

          batchCount++;
          downgradedCount++;

          logger.info(`[會員定時任務] 標記過期會員: ${userId} (${user.membershipTier} -> free, 過期時間: ${user.membershipExpiresAt})`);

          // 清除緩存（批量處理後再清除，避免過多操作）
          deleteCachedUserProfile(userId);
          clearCache(`user:${userId}:membership`);

          // 如果達到批次上限，提交批次
          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            logger.info(`[會員定時任務] 已提交 ${batchCount} 筆降級操作`);
            batch = db.batch(); // ✅ 創建新的 batch 對象
            batchCount = 0;
          }
        }
      } catch (error) {
        errorCount++;
        errors.push({ userId, error: error.message });
        logger.error(`[會員定時任務] 處理用戶 ${userId} 時發生錯誤:`, error);
      }
    }

    // 提交剩餘的批次
    if (batchCount > 0) {
      await batch.commit();
      logger.info(`[會員定時任務] 已提交最後 ${batchCount} 筆降級操作`);
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      totalChecked: totalUsers,
      expired: expiredCount,
      downgraded: downgradedCount,
      errors: errorCount,
      duration,
      errorDetails: errors.length > 0 ? errors : undefined,
    };

    logger.info(
      `[會員定時任務] ✅ 完成批量檢查 - 檢查: ${totalUsers}, 過期: ${expiredCount}, 降級: ${downgradedCount}, 錯誤: ${errorCount}, 耗時: ${duration}ms`
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[會員定時任務] ❌ 批量檢查失敗:`, error);

    return {
      success: false,
      error: error.message,
      duration,
    };
  }
};

/**
 * 發放每月會員獎勵（定時任務）
 * ✅ 使用 Firestore Transaction 確保原子性
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
    // ✅ 使用 Firestore Transaction 確保原子性
    const db = getFirestoreDb();
    const userRef = db.collection("users").doc(userId);
    let result = null;

    await db.runTransaction(async (transaction) => {
      // 1. 讀取用戶資料
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error(`找不到用戶: ${userId}`);
      }

      const userData = userDoc.data();
      const currentBalance = getWalletBalance(userData);
      const newBalance = currentBalance + monthlyBonus;

      // 2. 在同一事務中更新用戶餘額
      const walletUpdate = createWalletUpdate(newBalance);
      transaction.update(userRef, {
        ...walletUpdate,
        updatedAt: new Date().toISOString(),
      });

      // 3. 在同一事務中創建交易記錄
      createTransactionInTx(transaction, {
        userId,
        type: TRANSACTION_TYPES.REWARD,
        amount: monthlyBonus,
        description: `每月會員獎勵 - ${membership.tier.toUpperCase()}`,
        metadata: {
          tier: membership.tier,
          rewardType: "monthly_bonus",
        },
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
      });

      // 4. 設置返回結果
      result = {
        userId,
        tier: membership.tier,
        coinsAwarded: monthlyBonus,
        previousBalance: currentBalance,
        newBalance,
      };

      logger.info(
        `[會員服務] 發放每月獎勵成功 - 用戶: ${userId}, 等級: ${membership.tier}, 金幣: ${monthlyBonus}, 餘額 ${currentBalance} → ${newBalance}`
      );
    });

    // ✅ Transaction 成功後清除用戶資料緩存
    deleteCachedUserProfile(userId);

    return result;
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
  checkAndDowngradeExpiredMemberships, // 🔒 P2-2: 批量過期會員檢查
};
