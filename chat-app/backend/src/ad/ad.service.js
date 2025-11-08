/**
 * 廣告服務
 * 處理廣告觀看驗證和獎勵發放
 */

import { AD_CONFIG } from "../membership/membership.config.js";
import { unlockByAd } from "../conversation/conversationLimit.service.js";
import { getUserById } from "../user/user.service.js";
import { getFirestoreDb } from "../firebase/index.js";
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

/**
 * 儲存廣告觀看記錄
 * 格式：Map<userId, AdRecord[]>
 */
const adRecords = new Map();

/**
 * 廣告觀看記錄結構
 */
class AdRecord {
  constructor(adId, adType, characterId) {
    this.adId = adId;                    // 廣告唯一 ID
    this.adType = adType;                // 廣告類型（rewarded_ad / interstitial_ad）
    this.characterId = characterId;      // 為哪個角色解鎖
    this.timestamp = new Date().toISOString();
    this.reward = null;                  // 獎勵內容
    this.verified = false;               // 是否已驗證
    this.claimed = false;                // 是否已領取獎勵
  }
}

/**
 * 初始化用戶廣告記錄
 */
const initUserAdRecords = (userId) => {
  if (!adRecords.has(userId)) {
    adRecords.set(userId, []);
  }
  return adRecords.get(userId);
};

/**
 * 獲取今日觀看廣告次數
 */
const getTodayAdCount = (userId) => {
  const records = initUserAdRecords(userId);
  const today = new Date().toISOString().split('T')[0];

  return records.filter(record => {
    const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
    return recordDate === today && record.verified;
  }).length;
};

/**
 * 檢查是否超過每日廣告上限
 */
export const checkDailyAdLimit = async (userId) => {
  const todayCount = getTodayAdCount(userId);
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
 */
const checkAdCooldown = async (userId, adType) => {
  const records = initUserAdRecords(userId);
  const adConfig = await getAdConfigFromFirestore();
  const adTypeConfig = adConfig.types[adType];

  if (!adTypeConfig) {
    return { ready: false, reason: "invalid_ad_type" };
  }

  const cooldown = adTypeConfig.cooldown; // 秒
  const now = new Date();

  // 找到最近一次相同類型的廣告
  const lastAd = records
    .filter(r => r.adType === adType && r.verified)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  if (!lastAd) {
    return { ready: true, cooldown: 0 };
  }

  const lastTime = new Date(lastAd.timestamp);
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
  const dailyLimit = checkDailyAdLimit(userId);
  if (!dailyLimit.canWatch) {
    throw new Error(`今日廣告觀看次數已達上限（${dailyLimit.limit} 次）`);
  }

  // 檢查冷卻時間
  const cooldown = checkAdCooldown(userId, adType);
  if (!cooldown.ready) {
    if (cooldown.reason === "cooldown") {
      throw new Error(`請等待 ${cooldown.remaining} 秒後再觀看下一則廣告`);
    }
    throw new Error("廣告類型無效");
  }

  // 生成廣告 ID
  const adId = `ad_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 創建廣告記錄
  const record = new AdRecord(adId, adType, characterId);
  const records = initUserAdRecords(userId);
  records.push(record);

  const adConfig = await getAdConfigFromFirestore();
  const adTypeConfig = adConfig.types[adType];

  return {
    adId,
    adType,
    characterId,
    provider: "google", // TODO: 根據設定選擇廣告提供商
    reward: adTypeConfig.reward,
    expiresIn: 300, // 5 分鐘內必須完成觀看
  };
};

/**
 * 驗證廣告已觀看（由前端 SDK 回調）
 */
export const verifyAdWatched = async (userId, adId, verificationToken = null) => {
  const records = initUserAdRecords(userId);
  const record = records.find(r => r.adId === adId);

  if (!record) {
    throw new Error("找不到廣告記錄");
  }

  if (record.verified) {
    throw new Error("此廣告已經驗證過了");
  }

  // TODO: 實際應用應驗證來自廣告 SDK 的 token
  // 例如 Google AdMob 的伺服器端驗證
  // 目前簡化處理，信任前端回報

  // 檢查是否過期（5 分鐘）
  const now = new Date();
  const created = new Date(record.timestamp);
  const elapsed = (now - created) / 1000;

  if (elapsed > 300) {
    throw new Error("廣告驗證已過期，請重新觀看");
  }

  // 標記為已驗證
  record.verified = true;

  const adConfig = await getAdConfigFromFirestore();
  const adTypeConfig = adConfig.types[record.adType];
  record.reward = adTypeConfig.reward;

  return {
    adId: record.adId,
    verified: true,
    reward: record.reward,
  };
};

/**
 * 領取廣告獎勵
 */
export const claimAdReward = async (userId, adId) => {
  const records = initUserAdRecords(userId);
  const record = records.find(r => r.adId === adId);

  if (!record) {
    throw new Error("找不到廣告記錄");
  }

  if (!record.verified) {
    throw new Error("廣告尚未驗證");
  }

  if (record.claimed) {
    throw new Error("獎勵已經領取過了");
  }

  // 根據獎勵類型發放
  if (record.reward.type === "messages") {
    // 解鎖對話次數
    const result = await unlockByAd(userId, record.characterId, adId);

    record.claimed = true;

    return {
      success: true,
      reward: {
        type: "messages",
        amount: record.reward.amount,
        characterId: record.characterId,
      },
      result,
    };
  }

  throw new Error("未知的獎勵類型");
};

/**
 * 獲取用戶廣告觀看統計
 */
export const getAdStats = async (userId) => {
  const records = initUserAdRecords(userId);
  const today = new Date().toISOString().split('T')[0];

  const todayRecords = records.filter(r => {
    const recordDate = new Date(r.timestamp).toISOString().split('T')[0];
    return recordDate === today;
  });

  const adConfig = await getAdConfigFromFirestore();

  const stats = {
    total: records.length,
    today: todayRecords.length,
    todayVerified: todayRecords.filter(r => r.verified).length,
    todayClaimed: todayRecords.filter(r => r.claimed).length,
    limit: adConfig.dailyAdLimit,
    remaining: Math.max(0, adConfig.dailyAdLimit - todayRecords.filter(r => r.verified).length),
  };

  return stats;
};

/**
 * 清除過期的廣告記錄（定時清理）
 */
export const cleanupExpiredAdRecords = () => {
  const now = new Date();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 保留 7 天

  let cleanedCount = 0;

  for (const [userId, records] of adRecords.entries()) {
    const filtered = records.filter(record => {
      const age = now - new Date(record.timestamp);
      return age < maxAge;
    });

    if (filtered.length !== records.length) {
      adRecords.set(userId, filtered);
      cleanedCount += records.length - filtered.length;
    }
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
