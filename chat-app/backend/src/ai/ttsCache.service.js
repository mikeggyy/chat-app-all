/**
 * TTS 音頻緩存服務
 * 緩存生成的 TTS 音頻以減少 API 調用次數和成本
 *
 * 💰 預期收益：
 * - API 調用減少 70-80%
 * - 成本節省 $35-55/月
 * - 響應速度提升 80-90%（命中緩存時）
 */

import NodeCache from 'node-cache';
import logger from '../utils/logger.js';
import crypto from 'crypto';

// 緩存配置
const TTS_CACHE_CONFIG = {
  stdTTL: 3600,           // 1 小時過期
  checkperiod: 600,       // 每 10 分鐘檢查過期項目
  useClones: false,       // 不克隆 Buffer（提升性能）
  maxKeys: 1000,          // 最多緩存 1000 個音頻
  deleteOnExpire: true,   // 過期自動刪除
};

// 創建緩存實例
const ttsCache = new NodeCache(TTS_CACHE_CONFIG);

// 緩存統計
let cacheStats = {
  hits: 0,              // 命中次數
  misses: 0,            // 未命中次數
  total: 0,             // 總請求數
  bytesServed: 0,       // 已服務的字節數（緩存）
  bytesGenerated: 0,    // 新生成的字節數
};

/**
 * 生成緩存 key
 * @param {string} text - 文字內容
 * @param {string} characterId - 角色 ID
 * @param {object} options - TTS 選項（voiceId, speakingRate, pitch）
 * @returns {string} 緩存 key
 */
const generateCacheKey = (text, characterId, options = {}) => {
  // 使用哈希確保 key 長度固定且唯一
  const content = JSON.stringify({
    text: text.trim(),
    characterId,
    voiceId: options.voiceId || 'default',
    speakingRate: options.speakingRate || 1.0,
    pitch: options.pitch || 0,
  });

  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * 從緩存獲取 TTS 音頻
 * @param {string} text - 文字內容
 * @param {string} characterId - 角色 ID
 * @param {object} options - TTS 選項
 * @returns {Buffer|null} 音頻 Buffer 或 null
 */
export const getCachedTTS = (text, characterId, options = {}) => {
  const cacheKey = generateCacheKey(text, characterId, options);
  const cached = ttsCache.get(cacheKey);

  cacheStats.total++;

  if (cached) {
    cacheStats.hits++;
    cacheStats.bytesServed += cached.length;

    logger.debug('[TTS Cache] 命中緩存:', {
      characterId,
      textLength: text.length,
      audioSize: cached.length,
      hitRate: `${((cacheStats.hits / cacheStats.total) * 100).toFixed(2)}%`,
    });

    return cached;
  }

  cacheStats.misses++;

  logger.debug('[TTS Cache] 未命中緩存:', {
    characterId,
    textLength: text.length,
  });

  return null;
};

/**
 * 保存 TTS 音頻到緩存
 * @param {string} text - 文字內容
 * @param {string} characterId - 角色 ID
 * @param {Buffer} audioBuffer - 音頻 Buffer
 * @param {object} options - TTS 選項
 * @returns {boolean} 是否成功保存
 */
export const cacheTTS = (text, characterId, audioBuffer, options = {}) => {
  if (!Buffer.isBuffer(audioBuffer)) {
    logger.warn('[TTS Cache] 無效的 audioBuffer，無法緩存');
    return false;
  }

  const cacheKey = generateCacheKey(text, characterId, options);
  const success = ttsCache.set(cacheKey, audioBuffer);

  if (success) {
    cacheStats.bytesGenerated += audioBuffer.length;

    logger.debug('[TTS Cache] 音頻已緩存:', {
      characterId,
      textLength: text.length,
      audioSize: audioBuffer.length,
      totalCached: ttsCache.keys().length,
    });
  } else {
    logger.warn('[TTS Cache] 緩存失敗:', {
      characterId,
      textLength: text.length,
    });
  }

  return success;
};

/**
 * 帶緩存的 TTS 生成包裝函數
 * @param {string} text - 文字內容
 * @param {string} characterId - 角色 ID
 * @param {Function} generatorFn - 實際的 TTS 生成函數
 * @param {object} options - TTS 選項
 * @returns {Promise<{audioBuffer: Buffer, cached: boolean}>} 音頻和緩存狀態
 */
export const generateWithCache = async (text, characterId, generatorFn, options = {}) => {
  // 1. 先嘗試從緩存讀取
  const cached = getCachedTTS(text, characterId, options);
  if (cached) {
    return {
      audioBuffer: cached,
      cached: true,
    };
  }

  // 2. 緩存未命中，調用實際生成函數
  const audioBuffer = await generatorFn(text, characterId, options);

  // 3. 保存到緩存
  cacheTTS(text, characterId, audioBuffer, options);

  return {
    audioBuffer,
    cached: false,
  };
};

/**
 * 清除特定角色的所有緩存
 * @param {string} characterId - 角色 ID
 * @returns {number} 刪除的項目數
 */
export const clearCacheForCharacter = (characterId) => {
  let deleted = 0;
  const allKeys = ttsCache.keys();

  // 遍歷所有 key，找出包含該角色的緩存
  // 注意：由於我們使用哈希作為 key，無法直接過濾
  // 實際應用中可能需要維護一個 characterId -> keys 的映射
  logger.info('[TTS Cache] 清除角色緩存:', { characterId, note: '當前實現清除所有緩存' });
  ttsCache.flushAll();
  deleted = allKeys.length;

  return deleted;
};

/**
 * 清除所有緩存
 * @returns {number} 刪除的項目數
 */
export const clearAllCache = () => {
  const count = ttsCache.keys().length;
  ttsCache.flushAll();

  logger.info('[TTS Cache] 已清除所有緩存:', { count });

  return count;
};

/**
 * 獲取緩存統計信息
 * @returns {object} 統計信息
 */
export const getCacheStats = () => {
  const currentSize = ttsCache.keys().length;
  const hitRate = cacheStats.total > 0
    ? ((cacheStats.hits / cacheStats.total) * 100).toFixed(2)
    : 0;

  return {
    ...cacheStats,
    currentSize,
    maxSize: TTS_CACHE_CONFIG.maxKeys,
    hitRate: `${hitRate}%`,
    savedRequests: cacheStats.hits,
    estimatedCostSavings: calculateCostSavings(),
  };
};

/**
 * 計算預估成本節省
 * 假設：每次 TTS 調用平均成本 $0.015/1000 字符
 * @returns {object} 成本節省信息
 */
const calculateCostSavings = () => {
  // 假設平均每次請求 100 字符
  const avgCharsPerRequest = 100;
  const costPerThousandChars = 0.015; // $0.015/1000 字符（Google TTS 定價）

  const savedChars = cacheStats.hits * avgCharsPerRequest;
  const savedCost = (savedChars / 1000) * costPerThousandChars;

  return {
    savedRequests: cacheStats.hits,
    estimatedSavedCost: `$${savedCost.toFixed(4)}`,
    estimatedMonthlySavings: `$${(savedCost * 30).toFixed(2)}`,
  };
};

/**
 * 重置統計信息
 */
export const resetStats = () => {
  cacheStats = {
    hits: 0,
    misses: 0,
    total: 0,
    bytesServed: 0,
    bytesGenerated: 0,
  };

  logger.info('[TTS Cache] 統計信息已重置');
};

/**
 * 定期記錄緩存統計（可選，用於監控）
 */
export const startStatsLogging = (intervalMinutes = 30) => {
  setInterval(() => {
    const stats = getCacheStats();
    logger.info('[TTS Cache] 定期統計報告:', stats);
  }, intervalMinutes * 60 * 1000);
};

// 監聽緩存事件
ttsCache.on('set', (key, value) => {
  logger.debug('[TTS Cache] 新增緩存:', {
    audioSize: value?.length || 0,
    totalCached: ttsCache.keys().length,
  });
});

ttsCache.on('expired', (key, value) => {
  logger.debug('[TTS Cache] 緩存過期:', {
    audioSize: value?.length || 0,
    remainingCached: ttsCache.keys().length,
  });
});

// 導出緩存實例（用於測試）
export { ttsCache };

export default {
  getCachedTTS,
  cacheTTS,
  generateWithCache,
  clearCacheForCharacter,
  clearAllCache,
  getCacheStats,
  resetStats,
  startStatsLogging,
};
