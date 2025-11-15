/**
 * API 成本監控服務
 * 記錄和監控所有 AI API 的調用和成本
 *
 * ✅ 功能：
 * - 記錄 API 調用（OpenAI、Gemini、Replicate、Veo 等）
 * - 計算實時成本
 * - 每日/每月成本統計
 * - 成本預警（超過閾值時發送通知）
 * - 支持按服務、用戶、時間範圍查詢
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

/**
 * API 服務價格配置（美元）
 * 定期更新以反映最新的 API 定價
 */
const API_PRICING = {
  // OpenAI
  "gpt-4o-mini": {
    inputTokens: 0.15 / 1_000_000,  // $0.15 per 1M tokens
    outputTokens: 0.60 / 1_000_000, // $0.60 per 1M tokens
  },
  "gpt-4o": {
    inputTokens: 2.50 / 1_000_000,
    outputTokens: 10.00 / 1_000_000,
  },
  "tts-1": {
    perCharacter: 0.015 / 1_000, // $0.015 per 1K characters
  },
  "tts-1-hd": {
    perCharacter: 0.030 / 1_000,
  },

  // Gemini
  "gemini-2.0-flash-exp": {
    inputTokens: 0.075 / 1_000_000,  // 免費階段
    outputTokens: 0.30 / 1_000_000,
  },
  "gemini-2.5-flash": {
    inputTokens: 0.075 / 1_000_000,
    outputTokens: 0.30 / 1_000_000,
  },

  // Replicate / Hailuo (按次計費)
  "hailuo-video": {
    perGeneration: 0.05, // 預估每次生成成本
  },

  // Veo (按次計費)
  "veo-video": {
    perGeneration: 0.10, // 預估每次生成成本
  },
};

/**
 * 成本預警閾值配置（美元）
 */
const COST_THRESHOLDS = {
  DAILY_WARNING: parseFloat(process.env.DAILY_COST_WARNING || "10"),   // 每日 $10
  DAILY_CRITICAL: parseFloat(process.env.DAILY_COST_CRITICAL || "50"), // 每日 $50
  MONTHLY_WARNING: parseFloat(process.env.MONTHLY_COST_WARNING || "100"),   // 每月 $100
  MONTHLY_CRITICAL: parseFloat(process.env.MONTHLY_COST_CRITICAL || "500"), // 每月 $500
};

/**
 * 記錄 API 調用
 *
 * @param {Object} callData - API 調用數據
 * @param {string} callData.service - 服務名稱（openai、gemini、replicate、veo）
 * @param {string} callData.model - 模型名稱
 * @param {string} callData.operation - 操作類型（chat、tts、image、video）
 * @param {string} callData.userId - 用戶 ID
 * @param {Object} callData.usage - 使用量信息
 * @param {number} callData.usage.inputTokens - 輸入 tokens（可選）
 * @param {number} callData.usage.outputTokens - 輸出 tokens（可選）
 * @param {number} callData.usage.characters - 字符數（TTS，可選）
 * @param {number} callData.usage.generations - 生成次數（圖片/影片，可選）
 * @param {Object} callData.metadata - 額外元數據
 * @returns {Promise<Object>} 包含成本信息的結果
 */
export const recordApiCall = async (callData) => {
  const db = getFirestoreDb();
  const { service, model, operation, userId, usage = {}, metadata = {} } = callData;

  try {
    // 計算成本
    const cost = calculateCost(model, usage);

    // 創建 API 調用記錄
    const callRecord = {
      service,
      model,
      operation,
      userId,
      usage,
      cost,
      metadata,
      timestamp: FieldValue.serverTimestamp(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      month: new Date().toISOString().substring(0, 7), // YYYY-MM
    };

    // 寫入 Firestore
    await db.collection("api_calls").add(callRecord);

    // 更新每日聚合統計
    await updateDailyStats(service, model, cost);

    // 檢查是否需要發送成本預警
    await checkCostThresholds(cost);

    logger.info(`[API 成本監控] 已記錄 ${service}/${model} 調用，成本: $${cost.toFixed(4)}`);

    return {
      success: true,
      cost,
      callRecord,
    };
  } catch (error) {
    logger.error("[API 成本監控] 記錄失敗:", error);
    // 不阻塞主流程，只記錄錯誤
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * 計算 API 調用成本
 *
 * @param {string} model - 模型名稱
 * @param {Object} usage - 使用量
 * @returns {number} 成本（美元）
 */
function calculateCost(model, usage) {
  const pricing = API_PRICING[model];

  if (!pricing) {
    logger.warn(`[API 成本監控] 未找到模型 "${model}" 的定價信息`);
    return 0;
  }

  let cost = 0;

  // Token 計費（GPT、Gemini）
  if (pricing.inputTokens && usage.inputTokens) {
    cost += usage.inputTokens * pricing.inputTokens;
  }
  if (pricing.outputTokens && usage.outputTokens) {
    cost += usage.outputTokens * pricing.outputTokens;
  }

  // 字符計費（TTS）
  if (pricing.perCharacter && usage.characters) {
    cost += usage.characters * pricing.perCharacter;
  }

  // 次數計費（圖片、影片）
  if (pricing.perGeneration && usage.generations) {
    cost += usage.generations * pricing.perGeneration;
  }

  return cost;
}

/**
 * 更新每日統計
 */
async function updateDailyStats(service, model, cost) {
  const db = getFirestoreDb();
  const today = new Date().toISOString().split('T')[0];
  const statsRef = db.collection("api_cost_stats").doc(`daily_${today}`);

  await db.runTransaction(async (transaction) => {
    const statsDoc = await transaction.get(statsRef);

    if (!statsDoc.exists) {
      // 創建新的統計文檔
      transaction.set(statsRef, {
        date: today,
        totalCost: cost,
        callCount: 1,
        services: {
          [service]: {
            cost,
            callCount: 1,
            models: {
              [model]: { cost, callCount: 1 },
            },
          },
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // 更新現有統計
      const stats = statsDoc.data();
      const serviceStats = stats.services?.[service] || { cost: 0, callCount: 0, models: {} };
      const modelStats = serviceStats.models?.[model] || { cost: 0, callCount: 0 };

      transaction.update(statsRef, {
        totalCost: FieldValue.increment(cost),
        callCount: FieldValue.increment(1),
        [`services.${service}.cost`]: FieldValue.increment(cost),
        [`services.${service}.callCount`]: FieldValue.increment(1),
        [`services.${service}.models.${model}.cost`]: FieldValue.increment(cost),
        [`services.${service}.models.${model}.callCount`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}

/**
 * 檢查成本閾值並發送預警
 */
async function checkCostThresholds(newCost) {
  try {
    const db = getFirestoreDb();
    const today = new Date().toISOString().split('T')[0];
    const statsRef = db.collection("api_cost_stats").doc(`daily_${today}`);
    const statsDoc = await statsRef.get();

    if (!statsDoc.exists) return;

    const totalCost = statsDoc.data().totalCost || 0;

    // 每日預警
    if (totalCost >= COST_THRESHOLDS.DAILY_CRITICAL) {
      await sendCostAlert('DAILY_CRITICAL', totalCost, COST_THRESHOLDS.DAILY_CRITICAL);
    } else if (totalCost >= COST_THRESHOLDS.DAILY_WARNING) {
      await sendCostAlert('DAILY_WARNING', totalCost, COST_THRESHOLDS.DAILY_WARNING);
    }

    // 每月預警（簡化版：只檢查當月累計）
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthlyStatsQuery = await db.collection("api_cost_stats")
      .where("date", ">=", `${currentMonth}-01`)
      .where("date", "<=", `${currentMonth}-31`)
      .get();

    let monthlyCost = 0;
    monthlyStatsQuery.forEach(doc => {
      monthlyCost += doc.data().totalCost || 0;
    });

    if (monthlyCost >= COST_THRESHOLDS.MONTHLY_CRITICAL) {
      await sendCostAlert('MONTHLY_CRITICAL', monthlyCost, COST_THRESHOLDS.MONTHLY_CRITICAL);
    } else if (monthlyCost >= COST_THRESHOLDS.MONTHLY_WARNING) {
      await sendCostAlert('MONTHLY_WARNING', monthlyCost, COST_THRESHOLDS.MONTHLY_WARNING);
    }
  } catch (error) {
    logger.error("[API 成本監控] 檢查閾值失敗:", error);
  }
}

/**
 * 發送成本預警
 */
async function sendCostAlert(level, currentCost, threshold) {
  const message = `🚨 API 成本預警 [${level}]\n當前成本: $${currentCost.toFixed(2)}\n閾值: $${threshold.toFixed(2)}`;

  logger.warn(message);

  // TODO: 發送郵件或推送通知
  // 可以整合 SendGrid、Twilio 或其他通知服務

  // 記錄到 Firestore（供管理後臺查看）
  const db = getFirestoreDb();
  await db.collection("cost_alerts").add({
    level,
    currentCost,
    threshold,
    message,
    timestamp: FieldValue.serverTimestamp(),
    acknowledged: false,
  });
}

/**
 * 獲取成本統計
 *
 * @param {Object} options - 查詢選項
 * @param {string} options.period - 時間範圍（daily、monthly）
 * @param {string} options.startDate - 開始日期（YYYY-MM-DD）
 * @param {string} options.endDate - 結束日期（YYYY-MM-DD）
 * @param {string} options.service - 服務名稱（可選）
 * @returns {Promise<Object>} 成本統計
 */
export const getCostStats = async (options = {}) => {
  const { period = 'daily', startDate, endDate, service } = options;
  const db = getFirestoreDb();

  let query = db.collection("api_cost_stats");

  if (startDate) {
    query = query.where("date", ">=", startDate);
  }
  if (endDate) {
    query = query.where("date", "<=", endDate);
  }

  const snapshot = await query.get();
  let totalCost = 0;
  let totalCalls = 0;
  const serviceBreakdown = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    totalCost += data.totalCost || 0;
    totalCalls += data.callCount || 0;

    // 按服務統計
    if (data.services) {
      Object.entries(data.services).forEach(([svc, svcData]) => {
        if (!service || service === svc) {
          if (!serviceBreakdown[svc]) {
            serviceBreakdown[svc] = { cost: 0, callCount: 0, models: {} };
          }
          serviceBreakdown[svc].cost += svcData.cost || 0;
          serviceBreakdown[svc].callCount += svcData.callCount || 0;

          // 模型統計
          if (svcData.models) {
            Object.entries(svcData.models).forEach(([mdl, mdlData]) => {
              if (!serviceBreakdown[svc].models[mdl]) {
                serviceBreakdown[svc].models[mdl] = { cost: 0, callCount: 0 };
              }
              serviceBreakdown[svc].models[mdl].cost += mdlData.cost || 0;
              serviceBreakdown[svc].models[mdl].callCount += mdlData.callCount || 0;
            });
          }
        }
      });
    }
  });

  return {
    period,
    startDate,
    endDate,
    totalCost,
    totalCalls,
    serviceBreakdown,
    averageCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
  };
};

/**
 * 獲取今日成本
 */
export const getTodayCost = async () => {
  const today = new Date().toISOString().split('T')[0];
  return await getCostStats({ period: 'daily', startDate: today, endDate: today });
};

/**
 * 獲取本月成本
 */
export const getMonthCost = async () => {
  const currentMonth = new Date().toISOString().substring(0, 7);
  return await getCostStats({
    period: 'monthly',
    startDate: `${currentMonth}-01`,
    endDate: `${currentMonth}-31`,
  });
};

export default {
  recordApiCall,
  getCostStats,
  getTodayCost,
  getMonthCost,
};
