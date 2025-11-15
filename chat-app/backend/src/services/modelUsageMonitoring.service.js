/**
 * 🔒 P2-3: 模型使用監控服務
 * 監控和限制升級模型（GPT-4o）的使用，防止成本爆炸
 *
 * 功能：
 * 1. 記錄每次高級模型調用的 token 使用
 * 2. 限制每日/每月使用次數
 * 3. 生成統計報告
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

const db = getFirestoreDb();
const MODEL_USAGE_COLLECTION = "model_usage_stats";

/**
 * Brain Boost 藥水的每日使用限制
 * 防止單個用戶過度使用導致成本爆炸
 */
const BRAIN_BOOST_DAILY_LIMIT = {
  free: 30, // 免費用戶：每天 30 次對話
  vip: 100, // VIP 用戶：每天 100 次對話
  vvip: 300, // VVIP 用戶：每天 300 次對話（他們本身就用 GPT-4o，這個藥水對他們無效）
};

/**
 * 記錄模型使用情況（每次 AI 對話後調用）
 * @param {Object} params - 使用參數
 * @param {string} params.userId - 用戶 ID
 * @param {string} params.characterId - 角色 ID
 * @param {string} params.model - 使用的模型名稱
 * @param {number} params.promptTokens - 提示 token 數量
 * @param {number} params.completionTokens - 完成 token 數量
 * @param {number} params.totalTokens - 總 token 數量
 * @param {boolean} params.usedBrainBoost - 是否使用了腦力激盪藥水
 * @returns {Promise<Object>} 記錄結果
 */
export const recordModelUsage = async ({
  userId,
  characterId,
  model,
  promptTokens,
  completionTokens,
  totalTokens,
  usedBrainBoost = false,
}) => {
  if (!usedBrainBoost) {
    // 如果沒有使用 Brain Boost，不記錄（節省資源）
    return { recorded: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateKey = today.toISOString().split("T")[0]; // YYYY-MM-DD

  const statsRef = db.collection(MODEL_USAGE_COLLECTION).doc(userId);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(statsRef);
      const data = doc.exists ? doc.data() : {};

      // 初始化今日數據
      if (!data.dailyStats) {
        data.dailyStats = {};
      }
      if (!data.dailyStats[dateKey]) {
        data.dailyStats[dateKey] = {
          count: 0,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          models: {},
        };
      }

      const todayStats = data.dailyStats[dateKey];

      // 更新統計
      todayStats.count++;
      todayStats.totalTokens += totalTokens || 0;
      todayStats.promptTokens += promptTokens || 0;
      todayStats.completionTokens += completionTokens || 0;

      // 按模型分類統計
      if (!todayStats.models[model]) {
        todayStats.models[model] = { count: 0, tokens: 0 };
      }
      todayStats.models[model].count++;
      todayStats.models[model].tokens += totalTokens || 0;

      // 記錄角色級別的統計
      if (!data.characterStats) {
        data.characterStats = {};
      }
      if (!data.characterStats[characterId]) {
        data.characterStats[characterId] = { count: 0, totalTokens: 0 };
      }
      data.characterStats[characterId].count++;
      data.characterStats[characterId].totalTokens += totalTokens || 0;

      // 寫回 Firestore
      transaction.set(
        statsRef,
        {
          dailyStats: data.dailyStats,
          characterStats: data.characterStats,
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    logger.info(
      `[模型監控] 記錄 Brain Boost 使用: userId=${userId}, model=${model}, tokens=${totalTokens}`
    );

    return { recorded: true };
  } catch (error) {
    logger.error(`[模型監控] 記錄失敗:`, error);
    return { recorded: false, error: error.message };
  }
};

/**
 * 檢查用戶今日是否還可以使用 Brain Boost
 *
 * ⚠️ 設計說明：這是一個只讀檢查，沒有使用 Transaction
 * - 優點：不影響對話生成性能
 * - 潛在問題：快速連續請求可能導致小幅超額（1-2 次）
 * - 緩解措施：
 *   1. recordModelUsage 使用 Transaction 確保記錄準確
 *   2. 速率限制器保護 API
 *   3. 下次檢查時會自動修正
 * - 結論：這種設計權衡是合理的（性能 vs 嚴格限制）
 *
 * @param {string} userId - 用戶 ID
 * @param {string} membershipTier - 會員等級
 * @returns {Promise<Object>} 檢查結果
 */
export const canUseBrainBoost = async (userId, membershipTier = "free") => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateKey = today.toISOString().split("T")[0];

  const limit = BRAIN_BOOST_DAILY_LIMIT[membershipTier] || BRAIN_BOOST_DAILY_LIMIT.free;

  try {
    const statsRef = db.collection(MODEL_USAGE_COLLECTION).doc(userId);
    const doc = await statsRef.get();

    if (!doc.exists) {
      return {
        allowed: true,
        used: 0,
        remaining: limit,
        limit,
      };
    }

    const data = doc.data();
    const todayStats = data.dailyStats?.[dateKey];

    if (!todayStats) {
      return {
        allowed: true,
        used: 0,
        remaining: limit,
        limit,
      };
    }

    const used = todayStats.count || 0;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: remaining > 0,
      used,
      remaining,
      limit,
    };
  } catch (error) {
    logger.error(`[模型監控] 檢查限制失敗:`, error);
    // 出錯時默認允許使用（但記錄日誌）
    return {
      allowed: true,
      used: 0,
      remaining: limit,
      limit,
      error: error.message,
    };
  }
};

/**
 * 獲取用戶的模型使用統計
 * @param {string} userId - 用戶 ID
 * @param {number} days - 統計天數（默認 7 天）
 * @returns {Promise<Object>} 統計結果
 */
export const getModelUsageStats = async (userId, days = 7) => {
  try {
    const statsRef = db.collection(MODEL_USAGE_COLLECTION).doc(userId);
    const doc = await statsRef.get();

    if (!doc.exists) {
      return {
        totalCalls: 0,
        totalTokens: 0,
        dailyStats: {},
        characterStats: {},
      };
    }

    const data = doc.data();
    const dailyStats = data.dailyStats || {};

    // 過濾最近 N 天的數據
    const now = new Date();
    const recentDates = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      recentDates.push(date.toISOString().split("T")[0]);
    }

    const recentStats = {};
    let totalCalls = 0;
    let totalTokens = 0;

    for (const dateKey of recentDates) {
      if (dailyStats[dateKey]) {
        recentStats[dateKey] = dailyStats[dateKey];
        totalCalls += dailyStats[dateKey].count || 0;
        totalTokens += dailyStats[dateKey].totalTokens || 0;
      }
    }

    return {
      totalCalls,
      totalTokens,
      dailyStats: recentStats,
      characterStats: data.characterStats || {},
      lastUpdated: data.lastUpdated,
    };
  } catch (error) {
    logger.error(`[模型監控] 獲取統計失敗:`, error);
    return {
      totalCalls: 0,
      totalTokens: 0,
      dailyStats: {},
      characterStats: {},
      error: error.message,
    };
  }
};

/**
 * 🔒 P2-3: 批量清理舊的統計數據（定時任務）
 * 清理超過 90 天的每日統計數據，節省存儲空間
 * @returns {Promise<Object>} 清理結果
 */
export const cleanupOldModelUsageStats = async () => {
  const startTime = Date.now();
  logger.info(`[模型監控] 開始清理舊統計數據...`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 保留 90 天
    const cutoffDateKey = cutoffDate.toISOString().split("T")[0];

    const statsSnapshot = await db.collection(MODEL_USAGE_COLLECTION).get();
    const totalUsers = statsSnapshot.size;

    if (totalUsers === 0) {
      return {
        success: true,
        totalUsers: 0,
        cleanedRecords: 0,
        duration: Date.now() - startTime,
      };
    }

    let cleanedRecords = 0;
    let batch = db.batch(); // ✅ 使用 let 而不是 const
    let batchCount = 0;
    const BATCH_LIMIT = 500;

    for (const userDoc of statsSnapshot.docs) {
      const data = userDoc.data();
      const dailyStats = data.dailyStats || {};
      const newDailyStats = {};
      let userCleaned = 0;

      // 過濾保留最近 90 天的數據
      for (const [dateKey, stats] of Object.entries(dailyStats)) {
        if (dateKey >= cutoffDateKey) {
          newDailyStats[dateKey] = stats;
        } else {
          userCleaned++;
        }
      }

      if (userCleaned > 0) {
        batch.update(userDoc.ref, {
          dailyStats: newDailyStats,
          lastCleaned: FieldValue.serverTimestamp(),
        });

        batchCount++;
        cleanedRecords += userCleaned;

        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          logger.info(`[模型監控] 已提交 ${batchCount} 筆清理操作`);
          batch = db.batch(); // ✅ 創建新的 batch 對象
          batchCount = 0;
        }
      }
    }

    // 提交剩餘的批次
    if (batchCount > 0) {
      await batch.commit();
      logger.info(`[模型監控] 已提交最後 ${batchCount} 筆清理操作`);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `[模型監控] ✅ 清理完成 - 用戶: ${totalUsers}, 清理記錄: ${cleanedRecords}, 耗時: ${duration}ms`
    );

    return {
      success: true,
      totalUsers,
      cleanedRecords,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[模型監控] ❌ 清理失敗:`, error);

    return {
      success: false,
      error: error.message,
      duration,
    };
  }
};

/**
 * 獲取全局模型使用統計（管理員功能）
 * @param {Object} options - 查詢選項
 * @param {string} options.dateKey - 日期鍵（YYYY-MM-DD）
 * @param {number} options.limit - 返回用戶數量限制
 * @returns {Promise<Object>} 全局統計
 */
export const getGlobalModelUsageStats = async (options = {}) => {
  const { dateKey, limit = 100 } = options;
  const today = dateKey || new Date().toISOString().split("T")[0];

  try {
    const statsSnapshot = await db
      .collection(MODEL_USAGE_COLLECTION)
      .limit(limit)
      .get();

    const globalStats = {
      date: today,
      totalUsers: 0,
      totalCalls: 0,
      totalTokens: 0,
      modelBreakdown: {},
    };

    for (const doc of statsSnapshot.docs) {
      const data = doc.data();
      const todayStats = data.dailyStats?.[today];

      if (todayStats) {
        globalStats.totalUsers++;
        globalStats.totalCalls += todayStats.count || 0;
        globalStats.totalTokens += todayStats.totalTokens || 0;

        // 模型分類統計
        for (const [model, modelStats] of Object.entries(todayStats.models || {})) {
          if (!globalStats.modelBreakdown[model]) {
            globalStats.modelBreakdown[model] = { count: 0, tokens: 0 };
          }
          globalStats.modelBreakdown[model].count += modelStats.count || 0;
          globalStats.modelBreakdown[model].tokens += modelStats.tokens || 0;
        }
      }
    }

    return globalStats;
  } catch (error) {
    logger.error(`[模型監控] 獲取全局統計失敗:`, error);
    return {
      date: today,
      totalUsers: 0,
      totalCalls: 0,
      totalTokens: 0,
      modelBreakdown: {},
      error: error.message,
    };
  }
};

export default {
  recordModelUsage,
  canUseBrainBoost,
  getModelUsageStats,
  cleanupOldModelUsageStats,
  getGlobalModelUsageStats,
};
