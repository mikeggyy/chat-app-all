/**
 * 會員升級鎖定清理服務
 *
 * 功能：定時清理過期的升級鎖定標記
 * 目的：防止因服務器崩潰或異常導致的永久鎖定
 *
 * 使用方式：
 * 1. Cloud Scheduler: 每 5 分鐘執行一次
 * 2. 手動調用: 用於緊急清理
 */

import { getFirestoreDb } from "../firebase/index.js";
import logger from "../utils/logger.js";

/**
 * 清理過期的會員升級鎖定
 *
 * @param {number} maxAgeMinutes - 鎖定最大存在時間（分鐘），默認 5 分鐘
 * @returns {Object} 清理結果統計
 */
export const cleanupStaleUpgradeLocks = async (maxAgeMinutes = 5) => {
  const db = getFirestoreDb();
  const usageLimitsCollection = db.collection("usage_limits");

  logger.info(`[鎖定清理] 開始清理超過 ${maxAgeMinutes} 分鐘的升級鎖定...`);

  const stats = {
    scanned: 0,
    cleaned: 0,
    errors: 0,
    cleanedUsers: [],
  };

  try {
    // 1. 查詢所有有升級鎖定的文檔
    const snapshot = await usageLimitsCollection
      .where("photos.upgrading", "==", true)
      .get();

    stats.scanned = snapshot.size;

    if (snapshot.empty) {
      logger.info(`[鎖定清理] 沒有發現需要清理的鎖定`);
      return stats;
    }

    logger.info(`[鎖定清理] 發現 ${snapshot.size} 個用戶有升級鎖定`);

    // 2. 計算過期時間閾值
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    const now = Date.now();

    // 3. 檢查每個鎖定是否過期
    const cleanupPromises = [];

    snapshot.forEach((doc) => {
      const userId = doc.id;
      const data = doc.data();
      const photoData = data.photos || {};

      // 檢查鎖定時間
      const upgradingAt = photoData.upgradingAt;

      if (!upgradingAt) {
        // 沒有時間戳，視為異常，直接清理
        logger.warn(`[鎖定清理] 用戶 ${userId} 的鎖定缺少時間戳，將被清理`);
        cleanupPromises.push(
          cleanupSingleLock(usageLimitsCollection, userId, "missing_timestamp", stats)
        );
        return;
      }

      // 轉換 Firestore Timestamp 為毫秒
      let lockTimestamp;
      if (upgradingAt.toMillis) {
        lockTimestamp = upgradingAt.toMillis();
      } else if (upgradingAt._seconds) {
        lockTimestamp = upgradingAt._seconds * 1000;
      } else {
        lockTimestamp = new Date(upgradingAt).getTime();
      }

      const lockAge = now - lockTimestamp;

      if (lockAge > maxAgeMs) {
        const ageMinutes = Math.floor(lockAge / 60000);
        logger.warn(
          `[鎖定清理] 用戶 ${userId} 的鎖定已存在 ${ageMinutes} 分鐘，超過閾值 ${maxAgeMinutes} 分鐘`
        );
        cleanupPromises.push(
          cleanupSingleLock(usageLimitsCollection, userId, `expired_${ageMinutes}min`, stats)
        );
      }
    });

    // 4. 並行執行所有清理操作
    await Promise.allSettled(cleanupPromises);

    logger.info(
      `[鎖定清理] 完成 - 掃描: ${stats.scanned}, 清理: ${stats.cleaned}, 錯誤: ${stats.errors}`
    );

    return stats;
  } catch (error) {
    logger.error(`[鎖定清理] 清理過程發生錯誤:`, error);
    stats.errors++;
    throw error;
  }
};

/**
 * 清理單個用戶的升級鎖定
 *
 * @param {Object} collection - Firestore collection 引用
 * @param {string} userId - 用戶 ID
 * @param {string} reason - 清理原因
 * @param {Object} stats - 統計對象
 */
const cleanupSingleLock = async (collection, userId, reason, stats) => {
  try {
    await collection.doc(userId).update({
      "photos.upgrading": false,
      "photos.cleanedAt": new Date().toISOString(),
      "photos.cleanupReason": reason,
    });

    stats.cleaned++;
    stats.cleanedUsers.push({ userId, reason });

    logger.info(`[鎖定清理] ✅ 已清理用戶 ${userId} 的鎖定 (原因: ${reason})`);
  } catch (error) {
    stats.errors++;
    logger.error(`[鎖定清理] ❌ 清理用戶 ${userId} 的鎖定失敗:`, error);
  }
};

/**
 * 手動清理指定用戶的升級鎖定
 *
 * @param {string} userId - 用戶 ID
 * @returns {Object} 清理結果
 */
export const manualCleanupUserLock = async (userId) => {
  const db = getFirestoreDb();
  const usageLimitsRef = db.collection("usage_limits").doc(userId);

  try {
    const doc = await usageLimitsRef.get();

    if (!doc.exists) {
      return {
        success: false,
        message: "用戶的 usage_limits 文檔不存在",
      };
    }

    const data = doc.data();
    const photoData = data.photos || {};

    if (!photoData.upgrading) {
      return {
        success: false,
        message: "用戶沒有升級鎖定",
      };
    }

    await usageLimitsRef.update({
      "photos.upgrading": false,
      "photos.cleanedAt": new Date().toISOString(),
      "photos.cleanupReason": "manual_cleanup",
    });

    logger.info(`[鎖定清理] ✅ 手動清理用戶 ${userId} 的升級鎖定成功`);

    return {
      success: true,
      message: "鎖定已清理",
      userId,
    };
  } catch (error) {
    logger.error(`[鎖定清理] ❌ 手動清理用戶 ${userId} 的鎖定失敗:`, error);
    throw error;
  }
};

/**
 * 獲取當前所有有升級鎖定的用戶列表
 *
 * @returns {Array} 鎖定用戶列表
 */
export const getLockedUsers = async () => {
  const db = getFirestoreDb();
  const usageLimitsCollection = db.collection("usage_limits");

  try {
    const snapshot = await usageLimitsCollection
      .where("photos.upgrading", "==", true)
      .get();

    const lockedUsers = [];

    snapshot.forEach((doc) => {
      const userId = doc.id;
      const data = doc.data();
      const photoData = data.photos || {};

      let lockTimestamp = null;
      const upgradingAt = photoData.upgradingAt;

      if (upgradingAt) {
        if (upgradingAt.toMillis) {
          lockTimestamp = upgradingAt.toMillis();
        } else if (upgradingAt._seconds) {
          lockTimestamp = upgradingAt._seconds * 1000;
        } else {
          lockTimestamp = new Date(upgradingAt).getTime();
        }
      }

      const now = Date.now();
      const lockAgeMinutes = lockTimestamp ? Math.floor((now - lockTimestamp) / 60000) : null;

      lockedUsers.push({
        userId,
        upgradingAt: photoData.upgradingAt,
        lockAgeMinutes,
        isStale: lockAgeMinutes !== null && lockAgeMinutes > 5,
      });
    });

    logger.info(`[鎖定清理] 查詢到 ${lockedUsers.length} 個有升級鎖定的用戶`);

    return lockedUsers;
  } catch (error) {
    logger.error(`[鎖定清理] 查詢鎖定用戶失敗:`, error);
    throw error;
  }
};
