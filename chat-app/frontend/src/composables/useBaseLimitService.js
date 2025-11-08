/**
 * 前端統一限制服務 Composable
 * 提供所有限制類型的共用邏輯
 */

import { ref, computed } from 'vue';
import { apiJson } from '../utils/api.js';

/**
 * 創建限制服務 composable
 * @param {Object} config - 配置選項
 * @param {string} config.serviceName - 服務名稱（用於錯誤訊息）
 * @param {string} config.apiBasePath - API 基礎路徑（例如：'/api/voice-limit'）
 * @param {boolean} config.perCharacter - 是否按角色追蹤
 * @param {boolean} config.publicCheck - check 路由是否公開（預設 true）
 * @param {boolean} config.publicStats - stats 路由是否公開（預設 false）
 * @param {Object} config.endpoints - API 端點配置
 * @param {Function} config.transformStats - 轉換統計資料的函數（可選）
 * @returns {Object} composable 函數返回值
 */
export function createLimitService(config) {
  const {
    serviceName,
    apiBasePath,
    perCharacter = false,
    publicCheck = true,
    publicStats = false,
    endpoints = {},
    transformStats = null,
  } = config;

  // 預設端點
  // 🔒 安全更新：check 和 stats 端點根據 publicCheck/publicStats 配置決定是否在 URL 中包含 userId
  const defaultEndpoints = {
    check: perCharacter
      ? (publicCheck
          ? (userId, characterId) => `${apiBasePath}/${encodeURIComponent(userId)}/${encodeURIComponent(characterId)}/check`
          : (userId, characterId) => `${apiBasePath}/${encodeURIComponent(characterId)}/check`)
      : (publicCheck
          ? (userId) => `${apiBasePath}/check/${encodeURIComponent(userId)}`
          : () => `${apiBasePath}/check`),  // 私有路由，userId 從認證 token 獲取
    stats: publicStats
      ? (userId) => `${apiBasePath}/${encodeURIComponent(userId)}/stats`
      : () => `${apiBasePath}/stats`,  // 私有路由，userId 從認證 token 獲取
    unlockByAd: perCharacter
      ? (userId, characterId) => `${apiBasePath}/${encodeURIComponent(userId)}/${encodeURIComponent(characterId)}/unlock-by-ad`
      : (userId) => `${apiBasePath}/${encodeURIComponent(userId)}/unlock-by-ad`,
    purchase: (userId) => `${apiBasePath}/purchase`,
  };

  const finalEndpoints = { ...defaultEndpoints, ...endpoints };

  // 全域狀態
  const limitData = ref(perCharacter ? {} : null);
  const isLoading = ref(false);
  const error = ref(null);

  /**
   * 生成儲存鍵
   */
  const getStorageKey = (userId, characterId = null) => {
    if (perCharacter && characterId) {
      return `${userId}::${characterId}`;
    }
    return userId || 'default';
  };

  /**
   * 獲取限制資料
   */
  const getLimitData = (userId, characterId = null) => {
    if (perCharacter) {
      const key = getStorageKey(userId, characterId);
      return limitData.value[key] || null;
    }
    return limitData.value;
  };

  /**
   * 設置限制資料
   */
  const setLimitData = (data, userId, characterId = null) => {
    if (perCharacter) {
      const key = getStorageKey(userId, characterId);
      if (!limitData.value) {
        limitData.value = {};
      }
      limitData.value[key] = data;
    } else {
      limitData.value = data;
    }
  };

  /**
   * 檢查限制
   */
  const checkLimit = async (userId, characterId = null, options = {}) => {
    // 私有路由不需要 userId（從認證 token 獲取），但為了兼容性仍接受參數
    if (publicCheck && !userId) {
      error.value = '需要提供用戶 ID';
      return null;
    }

    if (perCharacter && !characterId) {
      error.value = '需要提供角色 ID';
      return null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      // 根據配置生成端點
      let endpoint;
      if (perCharacter) {
        endpoint = publicCheck
          ? finalEndpoints.check(userId, characterId)
          : finalEndpoints.check(userId, characterId);
      } else {
        endpoint = publicCheck
          ? finalEndpoints.check(userId)
          : finalEndpoints.check();  // 私有路由不傳 userId
      }

      const data = await apiJson(endpoint, {
        skipGlobalLoading: options.skipGlobalLoading ?? true,
      });

      // 儲存到狀態（使用傳入的 userId 作為鍵，即使後端從 token 獲取）
      setLimitData(data, userId, characterId);

      return data;
    } catch (err) {
      error.value = err?.message || `檢查${serviceName}失敗`;

      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 獲取統計資料
   * @param {string} userId - 用戶 ID（私有路由時已廢棄，保留是為了向後兼容）
   */
  const getStats = async (userId, options = {}) => {
    // userId 參數在 publicStats=false 時已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    if (!publicStats && !userId) {
      // 私有路由不需要 userId，但為了兼容性仍檢查（可以傳入任意值）
      // 實際 userId 由後端從 token 獲取
    } else if (publicStats && !userId) {
      error.value = '需要提供用戶 ID';
      return null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      // 私有路由不傳 userId 參數，公開路由傳 userId 參數
      const endpoint = publicStats ? finalEndpoints.stats(userId) : finalEndpoints.stats();
      const data = await apiJson(endpoint, {
        skipGlobalLoading: options.skipGlobalLoading ?? true,
      });

      // 如果有轉換函數，使用它
      const transformedData = transformStats ? transformStats(data) : data;

      // 更新狀態
      if (perCharacter && data.characters) {
        limitData.value = data.characters;
      } else if (!perCharacter) {
        limitData.value = transformedData;
      }

      return transformedData;
    } catch (err) {
      error.value = err?.message || `獲取${serviceName}統計失敗`;

      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 透過觀看廣告解鎖
   */
  const unlockByAd = async (userId, characterId = null, adId, options = {}) => {
    if (!userId) {
      error.value = '需要提供用戶 ID';
      throw new Error('需要提供用戶 ID');
    }

    if (perCharacter && !characterId) {
      error.value = '需要提供角色 ID';
      throw new Error('需要提供角色 ID');
    }

    if (!adId) {
      error.value = '需要提供廣告 ID';
      throw new Error('需要提供廣告 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const endpoint = perCharacter
        ? finalEndpoints.unlockByAd(userId, characterId)
        : finalEndpoints.unlockByAd(userId);

      const data = await apiJson(endpoint, {
        method: 'POST',
        body: { adId },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 重新檢查限制以更新狀態
      await checkLimit(userId, characterId, { skipGlobalLoading: true });

      return data;
    } catch (err) {
      error.value = err?.message || `觀看廣告解鎖${serviceName}失敗`;

      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 購買卡片（僅用於拍照等支援購買的服務）
   */
  const purchaseCards = async (userId, quantity, paymentInfo, options = {}) => {
    if (!userId) {
      error.value = '需要提供用戶 ID';
      throw new Error('需要提供用戶 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const endpoint = finalEndpoints.purchase(userId);
      const data = await apiJson(endpoint, {
        method: 'POST',
        body: {
          userId,
          quantity,
          paymentInfo,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 重新獲取統計以更新狀態
      await getStats(userId, { skipGlobalLoading: true });

      return data;
    } catch (err) {
      error.value = err?.message || `購買${serviceName}卡片失敗`;

      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 清除狀態
   */
  const clearState = (userId = null, characterId = null) => {
    if (perCharacter) {
      if (userId && characterId) {
        const key = getStorageKey(userId, characterId);
        delete limitData.value[key];
      } else {
        limitData.value = {};
      }
    } else {
      limitData.value = null;
    }
    error.value = null;
  };

  /**
   * 計算屬性：獲取特定限制資料
   */
  const createLimitComputed = (userId, characterId = null) => {
    return computed(() => getLimitData(userId, characterId));
  };

  return {
    // 狀態
    limitData,
    isLoading,
    error,

    // 方法
    checkLimit,
    getStats,
    unlockByAd,
    purchaseCards,
    clearState,
    getLimitData,

    // 工具函數
    createLimitComputed,
  };
}
