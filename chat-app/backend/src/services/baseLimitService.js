/**
 * 統一限制服務基礎模組 (Firestore 版本)
 * 提供所有限制服務的共用邏輯，使用 Firestore 進行數據持久化
 *
 * 此版本將原來的 in-memory Map 替換為 Firestore，同時保持模組化結構：
 * - constants.js - 常量定義
 * - limitConfig.js - 配置管理
 * - limitReset.js - 重置邏輯
 * - limitTracking.js - 追蹤邏輯
 */

import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import { RESET_PERIOD } from "./limitService/constants.js";
import { getLimitConfig } from "./limitService/limitConfig.js";
import { checkAndResetAll, checkAndResetAdUnlocks, createLimitData } from "./limitService/limitReset.js";
import {
  checkCanUse,
  recordUse as trackRecordUse,
  decrementUse as trackDecrementUse,
  unlockByAd as trackUnlockByAd,
  purchaseCards as trackPurchaseCards,
  unlockPermanently as trackUnlockPermanently,
} from "./limitService/limitTracking.js";
import { isGuestUser } from "../../../shared/config/testAccounts.js";

const USAGE_LIMITS_COLLECTION = "usage_limits";

/**
 * 創建基礎限制服務
 * @param {Object} config - 配置選項
 * @param {string} config.serviceName - 服務名稱（用於日誌）
 * @param {string} config.limitType - 限制類型（用於錯誤訊息）
 * @param {Function} config.getMembershipLimit - 取得會員等級限制的函數
 * @param {string} config.testAccountLimitKey - TEST_ACCOUNT_LIMITS 中的鍵名
 * @param {string} config.resetPeriod - 重置週期 (daily/weekly/monthly/none)
 * @param {boolean} config.perCharacter - 是否按角色追蹤（預設 false）
 * @param {boolean} config.allowGuest - 是否允許遊客使用（預設 false）
 * @param {string} config.fieldName - Firestore 中的欄位名稱 (photos/voice/conversation)
 */
export function createLimitService(config) {
  const {
    serviceName,
    limitType,
    getMembershipLimit,
    testAccountLimitKey,
    resetPeriod = RESET_PERIOD.MONTHLY,
    perCharacter = false,
    allowGuest = false,
    fieldName, // 例如: 'photos', 'voice', 'conversation'
  } = config;

  // ⚠️ 驗證必要參數
  if (!fieldName || typeof fieldName !== 'string') {
    throw new Error(`[createLimitService] fieldName 是必要參數，不能是 undefined。服務名稱: ${serviceName}`);
  }

  /**
   * 獲取用戶的使用限制文檔引用
   */
  const getUserLimitRef = (userId) => {
    const db = getFirestoreDb();
    return db.collection(USAGE_LIMITS_COLLECTION).doc(userId);
  };

  /**
   * 初始化用戶限制記錄
   */
  const initUserLimit = async (userId, characterId = null) => {
    const userLimitRef = getUserLimitRef(userId);
    const db = getFirestoreDb();

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userLimitRef);

      let userData = {};
      if (doc.exists) {
        userData = doc.data();
      }

      let limitData;

      if (perCharacter) {
        // 按角色追蹤（如 voice, conversation）
        if (!userData[fieldName]) {
          userData[fieldName] = {};
        }
        if (!userData[fieldName][characterId]) {
          userData[fieldName][characterId] = createLimitData(resetPeriod);
        }
        limitData = userData[fieldName][characterId];

        // 補充缺失的欄位（處理舊數據）
        const defaultData = createLimitData(resetPeriod);
        limitData = {
          ...defaultData,
          ...limitData,
        };
        userData[fieldName][characterId] = limitData;
      } else {
        // 不按角色追蹤（如 photos, character_creation）
        if (!userData[fieldName]) {
          userData[fieldName] = createLimitData(resetPeriod);
        }
        limitData = userData[fieldName];

        // 補充缺失的欄位（處理舊數據）
        const defaultData = createLimitData(resetPeriod);
        limitData = {
          ...defaultData,
          ...limitData,
        };
        userData[fieldName] = limitData;
      }

      // 更新到 Firestore
      if (!doc.exists) {
        userData.userId = userId;
        userData.createdAt = FieldValue.serverTimestamp();
      }
      userData.updatedAt = FieldValue.serverTimestamp();

      transaction.set(userLimitRef, userData, { merge: true });

      return limitData;
    });

    return result;
  };

  /**
   * 獲取限制數據
   */
  const getLimitData = async (userId, characterId = null) => {
    const userLimitRef = getUserLimitRef(userId);
    const doc = await userLimitRef.get();

    if (!doc.exists) {
      return null;
    }

    const userData = doc.data();

    if (perCharacter) {
      return userData[fieldName]?.[characterId] || null;
    }
    return userData[fieldName] || null;
  };

  /**
   * 更新限制數據
   */
  const updateLimitData = async (userId, characterId, limitData) => {
    const userLimitRef = getUserLimitRef(userId);
    const db = getFirestoreDb();

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userLimitRef);

      let userData = {};
      if (doc.exists) {
        userData = doc.data();
      } else {
        userData.userId = userId;
        userData.createdAt = FieldValue.serverTimestamp();
      }

      if (perCharacter) {
        if (!userData[fieldName]) {
          userData[fieldName] = {};
        }
        userData[fieldName][characterId] = limitData;
      } else {
        userData[fieldName] = limitData;
      }

      userData.updatedAt = FieldValue.serverTimestamp();

      transaction.set(userLimitRef, userData, { merge: true });
    });
  };

  /**
   * 檢查是否可以使用
   */
  const canUse = async (userId, characterId = null) => {
    // 檢查遊客權限
    if (!allowGuest && isGuestUser(userId)) {
      return {
        canUse: false,
        reason: "guest_not_allowed",
        message: `遊客無法使用${limitType}功能，請先登入`,
        tier: "guest",
        limit: 0,
      };
    }

    // 如果是 perCharacter 模式但沒有提供有效的 characterId，拋出錯誤
    if (perCharacter && (!characterId || characterId === 'null' || characterId === 'undefined')) {
      throw new Error(`${limitType}功能需要提供有效的角色 ID`);
    }

    const limitData = await initUserLimit(userId, characterId);
    const wasReset = checkAndResetAll(limitData, resetPeriod);

    // 如果發生了重置，更新到 Firestore
    if (wasReset) {
      await updateLimitData(userId, characterId, limitData);
    }

    const configData = await getLimitConfig(
      userId,
      getMembershipLimit,
      testAccountLimitKey,
      serviceName
    );

    const result = checkCanUse(limitData, configData.limit);

    return {
      ...result,
      tier: configData.tier,
      limit: configData.limit,
    };
  };

  /**
   * 記錄使用
   */
  const recordUse = async (userId, characterId = null, metadata = {}) => {
    // 檢查遊客權限
    if (!allowGuest && isGuestUser(userId)) {
      throw new Error(`遊客無法使用${limitType}功能，請先登入`);
    }

    // 當 perCharacter 為 true 時，必須提供有效的 characterId
    if (perCharacter && (!characterId || characterId === 'null' || characterId === 'undefined')) {
      throw new Error(`${limitType}功能需要提供有效的角色 ID`);
    }

    const db = getFirestoreDb();
    const userLimitRef = getUserLimitRef(userId);

    let result = null;

    // ✅ 修復：所有操作在 Transaction 內完成
    await db.runTransaction(async (transaction) => {
      // 1. 在 Transaction 內讀取限制數據
      const doc = await transaction.get(userLimitRef);

      let userData = doc.exists ? doc.data() : { userId };

      // 2. 初始化限制數據
      let limitData;
      if (perCharacter) {
        if (!userData[fieldName]) userData[fieldName] = {};
        if (!userData[fieldName][characterId]) {
          userData[fieldName][characterId] = createLimitData(resetPeriod);
        }
        limitData = userData[fieldName][characterId];
      } else {
        if (!userData[fieldName]) {
          userData[fieldName] = createLimitData(resetPeriod);
        }
        limitData = userData[fieldName];
      }

      // 3. 在 Transaction 內檢查並重置
      const wasReset = checkAndResetAll(limitData, resetPeriod);

      // 4. 檢查是否允許使用（在 Transaction 內）
      const configData = await getLimitConfig(
        userId,
        getMembershipLimit,
        testAccountLimitKey,
        serviceName
      );

      // ✅ 修復 P0-2 問題：使用 checkCanUse 計算正確的 totalAllowed（過濾過期的廣告解鎖）
      // 🧹 啟用即時清理：在 Transaction 內清理過期的解鎖記錄
      const canUseResult = checkCanUse(limitData, configData.limit, true);

      if (!canUseResult.allowed) {
        throw new Error(
          `${serviceName}次數已用完（${canUseResult.used}/${canUseResult.total}）`
        );
      }

      const totalAllowed = canUseResult.total;

      // 5. 記錄使用
      limitData.count += 1;
      limitData.lastUsedAt = new Date().toISOString();

      // 添加使用記錄（可選）
      if (metadata && Object.keys(metadata).length > 0) {
        if (!limitData.usageHistory) {
          limitData.usageHistory = [];
        }
        limitData.usageHistory.push({
          timestamp: new Date().toISOString(),
          ...metadata,
        });

        // 只保留最近 100 條記錄
        if (limitData.usageHistory.length > 100) {
          limitData.usageHistory = limitData.usageHistory.slice(-100);
        }
      }

      // 6. 在 Transaction 內更新數據
      if (perCharacter) {
        userData[fieldName][characterId] = limitData;
      } else {
        userData[fieldName] = limitData;
      }

      userData.updatedAt = FieldValue.serverTimestamp();

      transaction.set(userLimitRef, userData, { merge: true });

      // 7. 設置返回結果
      result = {
        success: true,
        count: limitData.count,
        limit: configData.limit,
        // ⚠️ unlocked 欄位已廢棄，但保留用於向後兼容（顯示舊的累計值）
        unlocked: limitData.unlocked,
        totalAllowed,
        remaining: canUseResult.remaining,
      };
    });

    return result;
  };

  /**
   * 回滾使用次數（用於失敗的操作）
   *
   * 用途：當操作記錄了使用次數但最終失敗時，可以回滾計數
   * 例如：記錄了角色創建次數，但角色創建失敗
   *
   * @param {string} userId - 用戶 ID
   * @param {string} characterId - 角色 ID（perCharacter 模式需要）
   * @param {Object} metadata - 回滾元數據（用於審計）
   * @returns {Object} 回滾結果
   */
  const decrementUse = async (userId, characterId = null, metadata = {}) => {
    // 當 perCharacter 為 true 時，必須提供有效的 characterId
    if (perCharacter && (!characterId || characterId === 'null' || characterId === 'undefined')) {
      throw new Error(`${limitType}功能需要提供有效的角色 ID`);
    }

    const limitData = await initUserLimit(userId, characterId);

    const result = trackDecrementUse(limitData, metadata);

    await updateLimitData(userId, characterId, limitData);

    return result;
  };

  /**
   * 透過廣告解鎖額外次數
   */
  const unlockByAd = async (userId, amount = 1, characterId = null) => {
    const limitData = await initUserLimit(userId, characterId);
    checkAndReset(limitData, resetPeriod);

    const result = trackUnlockByAd(limitData, amount);

    await updateLimitData(userId, characterId, limitData);

    return result;
  };

  /**
   * 購買使用卡
   *
   * @deprecated 此方法已廢棄，請使用 assets.service.js 的 addUserAsset() 管理卡片資產
   *
   * 遷移指南：
   * - 舊方法：`limitService.purchaseCards(userId, 5)`
   * - 新方法：`addUserAsset(userId, 'createCards', 5, '購買原因', metadata)`
   *
   * 優點：
   * - 統一的資產管理系統
   * - 完整的審計日誌
   * - 更好的查詢性能
   */
  const purchaseCards = async (userId, quantity = 1, paymentInfo = {}, characterId = null) => {
    const limitData = await initUserLimit(userId, characterId);

    const result = trackPurchaseCards(limitData, quantity);

    await updateLimitData(userId, characterId, limitData);

    return {
      ...result,
      paymentInfo,
    };
  };

  /**
   * 永久解鎖
   */
  const unlockPermanently = async (userId, characterId = null) => {
    const limitData = await initUserLimit(userId, characterId);

    const result = trackUnlockPermanently(limitData);

    await updateLimitData(userId, characterId, limitData);

    return result;
  };

  /**
   * 獲取統計資訊
   */
  const getStats = async (userId, characterId = null) => {
    // 如果是 perCharacter 模式且沒有提供 characterId，返回所有角色的統計
    if (perCharacter && !characterId) {
      return await getAllStats(userId);
    }

    const limitData = await initUserLimit(userId, characterId);

    const wasReset = checkAndReset(limitData, resetPeriod);

    // 如果發生了重置，更新到 Firestore
    if (wasReset) {
      await updateLimitData(userId, characterId, limitData);
    }

    const configData = await getLimitConfig(
      userId,
      getMembershipLimit,
      testAccountLimitKey,
      serviceName
    );

    // ✅ 修復 P0-2 問題：使用 checkCanUse 計算正確的 totalAllowed 和 remaining（過濾過期的廣告解鎖）
    const canUseResult = checkCanUse(limitData, configData.limit);

    const result = {
      tier: configData.tier,
      unlimited: configData.limit === -1,
      limit: configData.limit,
      standardLimit: configData.standardLimit,
      isTestAccount: configData.isTestAccount,
      used: canUseResult.used,
      remaining: canUseResult.remaining,
      total: canUseResult.total,
      permanentUnlock: limitData.permanentUnlock,
      // ⚠️ unlocked 欄位已廢棄，但保留用於向後兼容（顯示舊的累計值）
      unlocked: limitData.unlocked,
      // ⚠️ cards 欄位已廢棄，保留用於向後兼容
      cards: limitData.cards,
      adsWatchedToday: limitData.adsWatchedToday,
      lifetimeUsed: limitData.lifetimeCount,
      lastResetDate: limitData.lastResetDate,
    };

    return result;
  };

  /**
   * 重置用戶限制（管理員功能）
   */
  const reset = async (userId, characterId = null) => {
    const limitData = createLimitData(resetPeriod);
    await updateLimitData(userId, characterId, limitData);

    return {
      success: true,
      message: `${limitType}限制已重置`,
    };
  };

  /**
   * 清除所有限制記錄（測試用）
   */
  const clearAll = async () => {
    const db = getFirestoreDb();
    const snapshot = await db.collection(USAGE_LIMITS_COLLECTION).get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    if (snapshot.docs.length > 0) {
      await batch.commit();
    }

    return {
      success: true,
      deletedCount: snapshot.docs.length,
    };
  };

  /**
   * 獲取所有用戶的限制統計（管理員功能）
   */
  const getAllStats = async (userId = null) => {
    // 如果提供了 userId 且服務是 perCharacter 的，返回該用戶的所有角色統計
    if (userId && perCharacter) {
      const userLimitRef = getUserLimitRef(userId);
      const doc = await userLimitRef.get();

      if (!doc.exists) {
        return {
          tier: "free",
          unlimited: false,
          limitPerCharacter: 0,
          standardLimitPerCharacter: 0,
          isTestAccount: false,
          characters: {},
        };
      }

      const userData = doc.data();
      const characterData = userData[fieldName] || {};

      const configData = await getLimitConfig(
        userId,
        getMembershipLimit,
        testAccountLimitKey,
        serviceName
      );

      // 為每個角色計算 remaining 值
      const charactersWithRemaining = {};
      for (const [characterId, limitData] of Object.entries(characterData)) {
        // ✅ 修復 P0-2 問題：使用 checkCanUse 計算正確的統計數據（過濾過期的廣告解鎖）
        const canUseResult = checkCanUse(limitData, configData.limit);

        charactersWithRemaining[characterId] = {
          ...limitData,
          remaining: canUseResult.remaining,
          limit: configData.limit,
          total: canUseResult.total,
          used: canUseResult.used,
        };
      }

      return {
        tier: configData.tier,
        unlimited: configData.limit === -1,
        limitPerCharacter: configData.limit,
        standardLimitPerCharacter: configData.standardLimit,
        isTestAccount: configData.isTestAccount,
        characters: charactersWithRemaining,
      };
    }

    // 否則返回所有用戶的統計
    const db = getFirestoreDb();
    const snapshot = await db.collection(USAGE_LIMITS_COLLECTION).get();

    const stats = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      stats.push({
        userId: doc.id,
        [fieldName]: data[fieldName] || null,
      });
    });

    return stats;
  };

  // 返回服務接口
  return {
    canUse,
    recordUse,
    decrementUse,
    unlockByAd,
    purchaseCards,
    unlockPermanently,
    getStats,
    reset,
    clearAll,
    getAllStats,
  };
}

export { RESET_PERIOD };

export default {
  createLimitService,
  RESET_PERIOD,
};
