/**
 * 廣告服務 - 修復版本
 * 修復內容：
 * 1. ✅ 使用 Firestore 持久化廣告記錄（不再只存內存）
 * 2. ✅ 添加廣告驗證邏輯（可選整合 AdMob Server-Side Verification）
 * 3. ✅ 使用 Transaction 確保獎勵領取的原子性
 * 4. ✅ 檢查所有未驗證的廣告（防止繞過冷卻時間）
 */

import { AD_CONFIG } from "../membership/membership.config.js";
import { unlockByAd } from "../conversation/conversationLimit.service.js";
import { getUserById } from "../user/user.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../utils/logger.js";

// 緩存廣告配置（避免重複查詢 Firestore）
let adConfigCache = null;
let adConfigCacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 分鐘緩存

/**
 * 從 Firestore 獲取廣告配置
 * @returns {Promise<Object>} 廣告配置
 */
const getAdConfigFromFirestore = async () => {
  const now = Date.now();

  // 檢查緩存
  if (adConfigCache && now < adConfigCacheExpiry) {
    return adConfigCache;
  }

  try {
    const db = getFirestoreDb();
    const doc = await db.collection("system_configs").doc("ad_config").get();

    if (doc.exists) {
      adConfigCache = doc.data();
      adConfigCacheExpiry = now + CACHE_TTL;
      logger.debug(`[廣告服務] 從 Firestore 讀取廣告配置`);
      return adConfigCache;
    }
  } catch (error) {
    logger.warn(`[廣告服務] 從 Firestore 讀取廣告配置失敗: ${error.message}`);
  }

  // 如果 Firestore 中沒有，使用代碼中的默認值
  logger.debug(`[廣告服務] 使用代碼中的廣告配置`);
  return AD_CONFIG;
};

// ==================== 持久化廣告記錄到 Firestore ====================

/**
 * 獲取今日觀看廣告次數（從 Firestore）
 * ✅ 修復：使用 Firestore 而非內存
 */
const getTodayAdCount = async (userId) => {
  const db = getFirestoreDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshot = await db
    .collection("ad_records")
    .where("userId", "==", userId)
    .where("timestamp", ">=", today)
    .where("verified", "==", true)
    .get();

  return snapshot.size;
};

/**
 * 檢查是否超過每日廣告上限
 * ✅ 修復：使用持久化的廣告記錄
 */
export const checkDailyAdLimit = async (userId) => {
  const todayCount = await getTodayAdCount(userId);
  const adConfig = await getAdConfigFromFirestore();
  const limit = adConfig.dailyAdLimit;

  return {
    count: todayCount,
    limit,
    canWatch: todayCount < limit,
    remaining: Math.max(0, limit - todayCount),
  };
};

/**
 * 檢查廣告冷卻時間
 * ✅ 修復：檢查所有廣告（包括未驗證的），防止繞過冷卻時間
 */
const checkAdCooldown = async (userId, adType) => {
  const db = getFirestoreDb();
  const adConfig = await getAdConfigFromFirestore();
  const adTypeConfig = adConfig.types[adType];

  if (!adTypeConfig) {
    return { ready: false, reason: "invalid_ad_type" };
  }

  const cooldown = adTypeConfig.cooldown; // 秒
  const now = new Date();

  // ✅ 修復：檢查所有廣告（不只是已驗證的）
  const snapshot = await db
    .collection("ad_records")
    .where("userId", "==", userId)
    .where("adType", "==", adType)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { ready: true, cooldown: 0 };
  }

  const lastAd = snapshot.docs[0].data();
  const lastTime = lastAd.timestamp.toDate();
  const elapsed = (now - lastTime) / 1000; // 秒

  if (elapsed < cooldown) {
    return {
      ready: false,
      reason: "cooldown",
      remaining: Math.ceil(cooldown - elapsed),
      cooldown,
    };
  }

  return { ready: true, cooldown: 0 };
};

/**
 * 請求觀看廣告（前置檢查）
 * ✅ 修復：儲存到 Firestore
 */
export const requestAdWatch = async (userId, characterId, adType = "rewarded_ad") => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 檢查會員等級是否需要看廣告
  const tier = user.membershipTier || "free";
  if (tier !== "free") {
    throw new Error("您的會員等級不需要觀看廣告");
  }

  // 檢查每日上限
  const dailyLimit = await checkDailyAdLimit(userId);
  if (!dailyLimit.canWatch) {
    throw new Error(`今日廣告觀看次數已達上限（${dailyLimit.limit} 次）`);
  }

  // 檢查冷卻時間
  const cooldown = await checkAdCooldown(userId, adType);
  if (!cooldown.ready) {
    if (cooldown.reason === "cooldown") {
      throw new Error(`請等待 ${cooldown.remaining} 秒後再觀看下一則廣告`);
    }
    throw new Error("廣告類型無效");
  }

  // 生成廣告 ID
  const adId = `ad_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const adConfig = await getAdConfigFromFirestore();
  const adTypeConfig = adConfig.types[adType];

  // ✅ 修復：儲存到 Firestore
  const db = getFirestoreDb();
  await db.collection("ad_records").doc(adId).set({
    adId,
    userId,
    adType,
    characterId,
    timestamp: FieldValue.serverTimestamp(),
    reward: adTypeConfig.reward,
    verified: false,
    claimed: false,
    verificationToken: null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 分鐘過期
  });

  logger.info(`[廣告服務] 創建廣告記錄: adId=${adId}, userId=${userId}, characterId=${characterId}`);

  return {
    adId,
    adType,
    characterId,
    provider: "google", // TODO: 根據設定選擇廣告提供商
    reward: adTypeConfig.reward,
    expiresIn: 300, // 5 分鐘內必須完成觀看
  };
};

// ==================== 廣告驗證（可選整合 AdMob）====================

/**
 * 驗證 Google AdMob 伺服器端回執（Server-Side Verification）
 * 文檔：https://developers.google.com/admob/android/ssv
 *
 * AdMob SSV 工作原理：
 * 1. 用戶觀看廣告後，AdMob SDK 生成一個 SSV 回調
 * 2. 回調包含一個 JWT token 和查詢參數
 * 3. 後端驗證 JWT 簽名（使用 Google 公鑰）
 * 4. 驗證 token 的 payload（reward_amount, user_id, timestamp 等）
 *
 * @param {string} verificationToken - AdMob 提供的 SSV token (JWT)
 * @param {Object} queryParams - SSV 回調的查詢參數
 * @returns {Promise<boolean>} 是否驗證成功
 */
const verifyWithAdMobSSV = async (verificationToken, queryParams = {}) => {
  const ENABLE_STRICT_AD_VERIFICATION = process.env.ENABLE_STRICT_AD_VERIFICATION === "true";

  // 寬鬆模式：開發/測試環境，信任前端
  if (!ENABLE_STRICT_AD_VERIFICATION) {
    logger.debug("[廣告服務] 寬鬆驗證模式，接受驗證");
    return true;
  }

  // ====== 嚴格模式：生產環境，實際驗證 AdMob SSV ======

  if (!verificationToken) {
    logger.warn("[廣告服務] 嚴格驗證模式：缺少 verificationToken");
    return false;
  }

  try {
    // 方法 1：使用 jsonwebtoken 庫驗證 JWT（推薦）
    // 需要安裝：npm install jsonwebtoken

    const jwt = await import("jsonwebtoken");

    // Google 的公鑰 URL（AdMob SSV 使用）
    const GOOGLE_PUBLIC_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";

    // 1. 獲取 Google 公鑰
    const keysResponse = await fetch(GOOGLE_PUBLIC_KEYS_URL);
    if (!keysResponse.ok) {
      logger.error("[廣告服務] 無法獲取 Google 公鑰");
      return false;
    }

    const keys = await keysResponse.json();

    // 2. 解析 JWT header 獲取 key_id
    const decoded = jwt.decode(verificationToken, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      logger.warn("[廣告服務] 無效的 JWT token");
      return false;
    }

    const keyId = decoded.header.kid;
    const publicKey = keys.keys.find(k => k.keyId === keyId);

    if (!publicKey) {
      logger.warn(`[廣告服務] 找不到對應的公鑰: ${keyId}`);
      return false;
    }

    // 3. 驗證 JWT 簽名
    const verified = jwt.verify(verificationToken, publicKey.pem, {
      algorithms: ['ES256'],
    });

    // 4. 驗證 payload
    const now = Math.floor(Date.now() / 1000);

    // 檢查過期時間
    if (verified.exp && verified.exp < now) {
      logger.warn("[廣告服務] SSV token 已過期");
      return false;
    }

    // 檢查簽發時間（不能是未來時間）
    if (verified.iat && verified.iat > now + 300) { // 允許 5 分鐘時鐘偏移
      logger.warn("[廣告服務] SSV token 簽發時間異常");
      return false;
    }

    // 檢查必要欄位
    if (!verified.ad_network || !verified.ad_unit) {
      logger.warn("[廣告服務] SSV token 缺少必要欄位");
      return false;
    }

    // 5. 驗證 reward_amount（如果有提供）
    if (queryParams.reward_amount && verified.reward_amount) {
      if (parseInt(queryParams.reward_amount) !== verified.reward_amount) {
        logger.warn("[廣告服務] 獎勵金額不匹配");
        return false;
      }
    }

    // 6. 驗證 user_id（如果有提供）
    if (queryParams.user_id && verified.user_id) {
      if (queryParams.user_id !== verified.user_id) {
        logger.warn("[廣告服務] 用戶 ID 不匹配");
        return false;
      }
    }

    logger.info("[廣告服務] AdMob SSV 驗證成功", {
      adNetwork: verified.ad_network,
      adUnit: verified.ad_unit,
      rewardAmount: verified.reward_amount,
    });

    return true;

  } catch (error) {
    // 如果是 JWT 驗證錯誤
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      logger.error(`[廣告服務] JWT 驗證失敗: ${error.message}`);
      return false;
    }

    // 如果 jsonwebtoken 模塊不存在，提供降級方案
    if (error.code === "ERR_MODULE_NOT_FOUND") {
      logger.error("[廣告服務] jsonwebtoken 模塊未安裝，無法執行嚴格驗證");
      logger.error("[廣告服務] 請執行: npm install jsonwebtoken");
      logger.error("[廣告服務] 或暫時關閉嚴格驗證模式: ENABLE_STRICT_AD_VERIFICATION=false");
      return false;
    }

    logger.error(`[廣告服務] AdMob 驗證異常: ${error.message}`, error);
    return false;
  }
};

/**
 * 驗證廣告已觀看（由前端 SDK 回調）
 * ✅ 修復：添加驗證邏輯
 */
export const verifyAdWatched = async (userId, adId, verificationToken = null) => {
  const db = getFirestoreDb();
  const adRef = db.collection("ad_records").doc(adId);

  const adDoc = await adRef.get();
  if (!adDoc.exists) {
    throw new Error("找不到廣告記錄");
  }

  const record = adDoc.data();

  // 檢查廣告是否屬於此用戶
  if (record.userId !== userId) {
    logger.warn(`[廣告服務] 用戶 ${userId} 嘗試驗證不屬於自己的廣告 ${adId}`);
    throw new Error("廣告記錄不屬於您");
  }

  if (record.verified) {
    throw new Error("此廣告已經驗證過了");
  }

  // ✅ 修復：檢查是否過期（5 分鐘）
  const now = new Date();
  const expiresAt = record.expiresAt.toDate();

  if (now > expiresAt) {
    throw new Error("廣告驗證已過期，請重新觀看");
  }

  // ✅ 修復：添加廣告驗證邏輯
  const isValid = await verifyWithAdMobSSV(verificationToken);
  if (!isValid) {
    logger.warn(`[廣告服務] 廣告驗證失敗: adId=${adId}, userId=${userId}`);
    throw new Error("廣告驗證失敗，請重新觀看");
  }

  // 標記為已驗證
  await adRef.update({
    verified: true,
    verifiedAt: FieldValue.serverTimestamp(),
    verificationToken,
  });

  logger.info(`[廣告服務] 廣告驗證成功: adId=${adId}, userId=${userId}`);

  return {
    adId: record.adId,
    verified: true,
    reward: record.reward,
  };
};

// ==================== 獎勵領取（原子性保護）====================

/**
 * 領取廣告獎勵
 * ✅ 修復：使用 Transaction 確保原子性
 */
export const claimAdReward = async (userId, adId) => {
  const db = getFirestoreDb();
  const adRef = db.collection("ad_records").doc(adId);

  let result = null;

  // ✅ 修復：使用 Transaction 確保原子性
  await db.runTransaction(async (transaction) => {
    const adDoc = await transaction.get(adRef);

    if (!adDoc.exists) {
      throw new Error("找不到廣告記錄");
    }

    const record = adDoc.data();

    // 檢查廣告是否屬於此用戶
    if (record.userId !== userId) {
      throw new Error("廣告記錄不屬於您");
    }

    if (!record.verified) {
      throw new Error("廣告尚未驗證");
    }

    if (record.claimed) {
      // ✅ 冪等性：已領取，直接返回成功（不拋錯）
      logger.info(`[廣告服務] 廣告獎勵已領取過: adId=${adId}, userId=${userId}`);
      result = {
        success: true,
        alreadyClaimed: true,
        reward: {
          type: record.reward.type,
          amount: record.reward.amount,
          characterId: record.characterId,
        },
      };
      return; // 提前退出事務
    }

    // 標記為已領取（防止重複）
    transaction.update(adRef, {
      claimed: true,
      claimedAt: FieldValue.serverTimestamp(),
    });

    // 設置結果（稍後在事務外執行實際的獎勵發放）
    result = {
      record,
      needToGrant: true,
    };
  });

  // ✅ 事務已提交，現在發放獎勵
  if (result.needToGrant) {
    const record = result.record;

    // 根據獎勵類型發放
    if (record.reward.type === "messages") {
      // 解鎖對話次數
      const unlockResult = await unlockByAd(userId, record.characterId, adId);

      logger.info(`[廣告服務] 發放廣告獎勵成功: adId=${adId}, userId=${userId}, reward=${record.reward.amount} messages`);

      return {
        success: true,
        alreadyClaimed: false,
        reward: {
          type: "messages",
          amount: record.reward.amount,
          characterId: record.characterId,
        },
        result: unlockResult,
      };
    }

    throw new Error("未知的獎勵類型");
  }

  // 已經領取過
  return result;
};

// ==================== 統計和清理 ====================

/**
 * 獲取用戶廣告觀看統計
 * ✅ 修復：從 Firestore 讀取
 */
export const getAdStats = async (userId) => {
  const db = getFirestoreDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [allSnapshot, todaySnapshot, todayVerifiedSnapshot, todayClaimedSnapshot] = await Promise.all([
    db.collection("ad_records").where("userId", "==", userId).get(),
    db.collection("ad_records").where("userId", "==", userId).where("timestamp", ">=", today).get(),
    db.collection("ad_records").where("userId", "==", userId).where("timestamp", ">=", today).where("verified", "==", true).get(),
    db.collection("ad_records").where("userId", "==", userId).where("timestamp", ">=", today).where("claimed", "==", true).get(),
  ]);

  const adConfig = await getAdConfigFromFirestore();

  const stats = {
    total: allSnapshot.size,
    today: todaySnapshot.size,
    todayVerified: todayVerifiedSnapshot.size,
    todayClaimed: todayClaimedSnapshot.size,
    limit: adConfig.dailyAdLimit,
    remaining: Math.max(0, adConfig.dailyAdLimit - todayVerifiedSnapshot.size),
  };

  return stats;
};

/**
 * 清除過期的廣告記錄（定時清理）
 * ✅ 修復：清理 Firestore 中的過期記錄
 */
export const cleanupExpiredAdRecords = async () => {
  const db = getFirestoreDb();
  const now = new Date();
  const maxAge = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 保留 7 天

  const snapshot = await db.collection("ad_records").where("timestamp", "<", maxAge).get();

  let cleanedCount = 0;
  const batch = db.batch();

  snapshot.forEach((doc) => {
    batch.delete(doc.ref);
    cleanedCount++;
  });

  if (cleanedCount > 0) {
    await batch.commit();
    logger.info(`[廣告服務] 已清理 ${cleanedCount} 筆過期廣告記錄`);
  }

  return {
    success: true,
    cleanedCount,
    message: `已清理 ${cleanedCount} 筆過期廣告記錄`,
  };
};

export default {
  requestAdWatch,
  verifyAdWatched,
  claimAdReward,
  checkDailyAdLimit,
  getAdStats,
  cleanupExpiredAdRecords,
};
