/**
 * baseLimitService 的關鍵修復補丁
 *
 * 這個文件包含需要應用到 baseLimitService.js 的關鍵修改
 *
 * 修復內容：
 * 1. 使用新的 checkAndResetAll() 函數（同時檢查基礎重置和廣告重置）
 * 2. 在 recordUse() 中使用 Transaction 包裝所有操作
 */

// ==================== 修改 1: 導入新的重置函數 ====================
// 在文件頂部，修改導入語句：

// ❌ 舊的導入
// import { checkAndReset, RESET_PERIOD } from './limitReset.js';

// ✅ 新的導入
import {
  checkAndResetAll,
  checkAndResetAdUnlocks,
  RESET_PERIOD,
} from "./limitReset.FIXED.js";

// ==================== 修改 2: 更新 canUse() 函數 ====================
// 在 canUse() 函數中，使用新的重置邏輯：

export const canUse = async (userId, characterId = null) => {
  const limitData = await initUserLimit(userId, characterId);

  // ✅ 修復：使用 checkAndResetAll() 同時檢查兩種重置
  const wasReset = checkAndResetAll(limitData, resetPeriod);

  if (wasReset) {
    await updateLimitData(userId, characterId, limitData);
  }

  // 檢查臨時解鎖（解鎖券）
  if (limitData.temporaryUnlockUntil) {
    const unlockUntil = new Date(limitData.temporaryUnlockUntil);
    if (new Date() < unlockUntil) {
      return {
        allowed: true,
        reason: "temporary_unlock",
        remaining: -1,
        unlockUntil: limitData.temporaryUnlockUntil,
      };
    } else {
      // 已過期，清除臨時解鎖
      limitData.temporaryUnlockUntil = null;
      await updateLimitData(userId, characterId, limitData);
    }
  }

  // 檢查永久解鎖
  if (limitData.permanentUnlock) {
    return {
      allowed: true,
      reason: "permanent_unlock",
      remaining: -1,
    };
  }

  // 獲取限制配置
  const configData = await getLimitConfig(userId, characterId);

  // 計算總允許次數（基礎 + 廣告解鎖）
  const totalAllowed =
    configData.limit === -1
      ? -1
      : configData.limit + limitData.unlocked;

  // 檢查是否允許
  const totalUsed = limitData.count;
  const allowed = totalAllowed === -1 || totalUsed < totalAllowed;

  return {
    allowed,
    remaining: totalAllowed === -1 ? -1 : Math.max(0, totalAllowed - totalUsed),
    limit: configData.limit,
    unlocked: limitData.unlocked,
    totalAllowed,
    count: totalUsed,
    reason: allowed ? "ok" : "limit_exceeded",
  };
};

// ==================== 修改 3: 修復 recordUse() 的 Transaction 邏輯 ====================
// recordUse() 函數需要完全重寫，確保所有操作在 Transaction 內完成：

export const recordUse = async (userId, characterId = null, metadata = {}) => {
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
    const configData = await getLimitConfig(userId, characterId);
    const totalAllowed =
      configData.limit === -1
        ? -1
        : configData.limit + limitData.unlocked;

    if (
      totalAllowed !== -1 &&
      limitData.count >= totalAllowed &&
      !limitData.permanentUnlock &&
      !limitData.temporaryUnlockUntil
    ) {
      throw new Error(
        `${serviceName}次數已用完（${limitData.count}/${totalAllowed}）`
      );
    }

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
      unlocked: limitData.unlocked,
      totalAllowed,
      remaining:
        totalAllowed === -1 ? -1 : Math.max(0, totalAllowed - limitData.count),
    };
  });

  return result;
};

// ==================== 使用說明 ====================
/*
 * 如何應用這些修復：
 *
 * 1. 將 limitReset.FIXED.js 部署到 src/services/limitService/
 * 2. 在 baseLimitService.js 中應用上述修改
 * 3. 更新對話、語音、照片限制服務，使用新的重置邏輯
 *
 * 修復後的行為：
 * - 對話/語音限制：基礎次數永不重置，廣告解鎖次數每日重置
 * - 照片限制：終生限制（免費用戶），VIP/VVIP 使用卡片
 * - 所有限制的並發操作都在 Transaction 內保護
 */
