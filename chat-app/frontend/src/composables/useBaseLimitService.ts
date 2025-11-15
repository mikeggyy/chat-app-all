/**
 * useBaseLimitService.ts
 * 前端統一限制服務 Composable（TypeScript 版本）
 * 提供所有限制類型的共用邏輯
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { apiJson } from '../utils/api.js';
import type { LimitCheckResult } from '../types';

// ==================== 類型定義 ====================

/**
 * 限制資料格式（按角色追蹤時）
 */
export interface PerCharacterLimitData {
  [key: string]: LimitCheckResult;
}

/**
 * API 端點配置
 */
export interface LimitServiceEndpoints {
  check?: ((userId?: string, characterId?: string) => string) | (() => string);
  stats?: ((userId?: string) => string) | (() => string);
  unlockByAd?: (userId: string, characterId?: string) => string;
  purchase?: (userId: string) => string;
}

/**
 * 限制服務配置
 */
export interface LimitServiceConfig {
  serviceName: string;
  apiBasePath: string;
  perCharacter?: boolean;
  publicCheck?: boolean;
  publicStats?: boolean;
  endpoints?: LimitServiceEndpoints;
  transformStats?: ((data: any) => any) | null;
}

/**
 * 限制服務選項
 */
export interface LimitServiceOptions {
  skipGlobalLoading?: boolean;
}

/**
 * 購買資訊
 */
export interface PaymentInfo {
  method?: string;
  paymentId?: string;
  [key: string]: any;
}

/**
 * 廣告解鎖結果
 */
export interface AdUnlockResult {
  success: boolean;
  adId: string;
  remainingMessages?: number;
  reward?: any;
  message?: string;
}

/**
 * 限制服務返回類型
 */
export interface LimitServiceReturn {
  // State
  limitData: Ref<PerCharacterLimitData | LimitCheckResult | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;

  // Methods
  checkLimit: (userId?: string, characterId?: string, options?: LimitServiceOptions) => Promise<LimitCheckResult | null>;
  getStats: (userId?: string, options?: LimitServiceOptions) => Promise<any>;
  unlockByAd: (userId: string, characterId?: string | null, adId?: string, options?: LimitServiceOptions) => Promise<any>;
  purchaseCards: (userId: string, quantity: number, paymentInfo: PaymentInfo, options?: LimitServiceOptions) => Promise<any>;
  clearState: (userId?: string | null, characterId?: string | null) => void;
  getLimitData: (userId?: string, characterId?: string | null) => LimitCheckResult | null;
  createLimitComputed: (userId?: string, characterId?: string | null) => ComputedRef<LimitCheckResult | null>;
}

// ==================== 主函數 ====================

/**
 * 創建限制服務 composable
 * @param config - 配置選項
 * @returns composable 函數返回值
 */
export function createLimitService(config: LimitServiceConfig): LimitServiceReturn {
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
  const defaultEndpoints: LimitServiceEndpoints = {
    check: perCharacter
      ? (publicCheck
          ? (userId?: string, characterId?: string) => `${apiBasePath}/${encodeURIComponent(userId || '')}/${encodeURIComponent(characterId || '')}/check`
          : (_userId?: string, characterId?: string) => `${apiBasePath}/${encodeURIComponent(characterId || '')}/check`)
      : (publicCheck
          ? (userId?: string) => `${apiBasePath}/check/${encodeURIComponent(userId || '')}`
          : () => `${apiBasePath}/check`),  // 私有路由，userId 從認證 token 獲取
    stats: publicStats
      ? (userId?: string) => `${apiBasePath}/${encodeURIComponent(userId || '')}/stats`
      : () => `${apiBasePath}/stats`,  // 私有路由，userId 從認證 token 獲取
    unlockByAd: perCharacter
      ? (_userId: string, characterId?: string) => `${apiBasePath}/${encodeURIComponent(characterId || '')}/unlock-by-ad`
      : (userId: string) => `${apiBasePath}/${encodeURIComponent(userId)}/unlock-by-ad`,
    purchase: (_userId: string) => `${apiBasePath}/purchase`,
  };

  const finalEndpoints: LimitServiceEndpoints = { ...defaultEndpoints, ...endpoints };

  // 全域狀態
  const limitData: Ref<PerCharacterLimitData | LimitCheckResult | null> = ref(perCharacter ? {} : null);
  const isLoading = ref(false);
  const error: Ref<string | null> = ref(null);

  /**
   * 生成儲存鍵
   */
  const getStorageKey = (userId?: string, characterId: string | null = null): string => {
    if (perCharacter && characterId) {
      return `${userId}::${characterId}`;
    }
    return userId || 'default';
  };

  /**
   * 獲取限制資料
   */
  const getLimitData = (userId?: string, characterId: string | null = null): LimitCheckResult | null => {
    if (perCharacter) {
      const key = getStorageKey(userId, characterId);
      const data = limitData.value as PerCharacterLimitData;
      return data[key] || null;
    }
    return limitData.value as LimitCheckResult | null;
  };

  /**
   * 設置限制資料
   */
  const setLimitData = (data: LimitCheckResult, userId?: string, characterId: string | null = null): void => {
    if (perCharacter) {
      const key = getStorageKey(userId, characterId);
      if (!limitData.value) {
        limitData.value = {};
      }
      (limitData.value as PerCharacterLimitData)[key] = data;
    } else {
      limitData.value = data;
    }
  };

  /**
   * 檢查限制
   */
  const checkLimit = async (
    userId?: string,
    characterId?: string,
    options: LimitServiceOptions = {}
  ): Promise<LimitCheckResult | null> => {
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
      let endpoint: string;
      if (perCharacter) {
        const checkFn = finalEndpoints.check as (userId?: string, characterId?: string) => string;
        endpoint = publicCheck
          ? checkFn(userId, characterId)
          : checkFn(userId, characterId);
      } else {
        const checkFn = finalEndpoints.check as ((userId?: string) => string) | (() => string);
        endpoint = publicCheck
          ? (checkFn as (userId?: string) => string)(userId)
          : (checkFn as () => string)();  // 私有路由不傳 userId
      }

      const data = await apiJson(endpoint, {
        skipGlobalLoading: options.skipGlobalLoading ?? true,
      });

      // 儲存到狀態（使用傳入的 userId 作為鍵，即使後端從 token 獲取）
      setLimitData(data, userId, characterId || null);

      return data;
    } catch (err: any) {
      error.value = err?.message || `檢查${serviceName}失敗`;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 獲取統計資料
   * @param userId - 用戶 ID（私有路由時已廢棄，保留是為了向後兼容）
   */
  const getStats = async (userId?: string, options: LimitServiceOptions = {}): Promise<any> => {
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
      const statsFn = finalEndpoints.stats as ((userId?: string) => string) | (() => string);
      const endpoint = publicStats
        ? (statsFn as (userId?: string) => string)(userId)
        : (statsFn as () => string)();
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
    } catch (err: any) {
      error.value = err?.message || `獲取${serviceName}統計失敗`;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 透過觀看廣告解鎖
   */
  const unlockByAd = async (
    userId: string,
    characterId: string | null = null,
    adId?: string,
    options: LimitServiceOptions = {}
  ): Promise<any> => {
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
      const unlockFn = finalEndpoints.unlockByAd as (userId: string, characterId?: string) => string;
      const endpoint = perCharacter
        ? unlockFn(userId, characterId || undefined)
        : unlockFn(userId);

      const data = await apiJson(endpoint, {
        method: 'POST',
        body: { adId },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 重新檢查限制以更新狀態
      await checkLimit(userId, characterId || undefined, { skipGlobalLoading: true });

      return data;
    } catch (err: any) {
      error.value = err?.message || `觀看廣告解鎖${serviceName}失敗`;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 購買卡片（僅用於拍照等支援購買的服務）
   */
  const purchaseCards = async (
    userId: string,
    quantity: number,
    paymentInfo: PaymentInfo,
    options: LimitServiceOptions = {}
  ): Promise<any> => {
    if (!userId) {
      error.value = '需要提供用戶 ID';
      throw new Error('需要提供用戶 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const purchaseFn = finalEndpoints.purchase as (userId: string) => string;
      const endpoint = purchaseFn(userId);
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
    } catch (err: any) {
      error.value = err?.message || `購買${serviceName}卡片失敗`;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 清除狀態
   */
  const clearState = (userId: string | null = null, characterId: string | null = null): void => {
    if (perCharacter) {
      if (userId && characterId) {
        const key = getStorageKey(userId, characterId);
        delete (limitData.value as PerCharacterLimitData)[key];
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
  const createLimitComputed = (userId?: string, characterId: string | null = null): ComputedRef<LimitCheckResult | null> => {
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
