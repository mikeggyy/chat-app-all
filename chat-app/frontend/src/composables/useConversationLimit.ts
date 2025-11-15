/**
 * useConversationLimit.ts
 * 對話限制系統 composable（TypeScript 版本）
 * 管理用戶與每個角色的對話次數限制
 * 使用統一的基礎限制服務模組
 */

import { type Ref } from 'vue';
import { createLimitService, type LimitServiceReturn, type LimitServiceOptions, type PerCharacterLimitData, type AdUnlockResult } from './useBaseLimitService.js';
import type { LimitCheckResult } from '../types';

// ==================== 類型定義 ====================

/**
 * 對話限制返回類型
 */
export interface UseConversationLimitReturn {
  // State
  limits: Ref<PerCharacterLimitData | LimitCheckResult | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;

  // Actions
  checkLimit: (userId?: string, characterId?: string, options?: LimitServiceOptions) => Promise<LimitCheckResult | null>;
  getStats: (userId?: string, options?: LimitServiceOptions) => Promise<any>;
  unlockByAd: (userId: string, characterId: string, adId?: string, options?: LimitServiceOptions) => Promise<AdUnlockResult>;
  getLimitState: (userId?: string, characterId?: string) => LimitCheckResult | null;
  clearLimitState: (userId?: string, characterId?: string) => void;
}

// ==================== Composable 主函數 ====================

// 創建對話限制服務實例
// 🔒 安全配置：publicStats=false 表示統計 API 需要認證，userId 從 token 獲取
const conversationLimitService: LimitServiceReturn = createLimitService({
  serviceName: '對話限制',
  apiBasePath: '/api/conversations/limit',
  perCharacter: true, // 按角色追蹤
  publicStats: false, // stats 路由需要認證
  endpoints: {
    // 自定義端點格式
    check: (userId?: string, characterId?: string) =>
      `/api/conversations/limit/${encodeURIComponent(userId || '')}/${encodeURIComponent(characterId || '')}/check`,
    stats: () => `/api/conversations/limit/stats`, // 🔒 安全更新：userId 從認證 token 獲取
    unlockByAd: () => '/api/ad/unlock', // 對話解鎖使用統一的廣告端點
  },
});

export function useConversationLimit(): UseConversationLimitReturn {
  const {
    limitData: limits,
    isLoading,
    error,
    checkLimit,
    getStats,
    // unlockByAd: baseUnlockByAd, // 未使用，改用自定義的 unlockByAd
    clearState,
    getLimitData,
  } = conversationLimitService;

  /**
   * 對話專用的廣告解鎖（完整三步驟流程）
   * ✅ 修復：使用後端的正確 API 端點
   *
   * 流程：
   * 1. POST /api/ads/watch - 請求觀看廣告
   * 2. POST /api/ads/verify - 驗證廣告已觀看
   * 3. POST /api/ads/claim - 領取廣告獎勵
   */
  const unlockByAd = async (
    userId: string,
    characterId: string,
    adId?: string,
    options: LimitServiceOptions = {}
  ): Promise<AdUnlockResult> => {
    if (!userId || !characterId) {
      error.value = '需要提供用戶 ID 和角色 ID';
      throw new Error('需要提供用戶 ID 和角色 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const { apiJson } = await import('../utils/api.js');
      let currentAdId = adId;

      // ✅ 步驟 1: 如果沒有提供 adId，先請求觀看廣告
      if (!currentAdId) {
        const watchResult = await apiJson('/api/ads/watch', {
          method: 'POST',
          body: {
            characterId,
            adType: 'rewarded_ad',
          },
          skipGlobalLoading: options.skipGlobalLoading ?? false,
        });

        currentAdId = watchResult.adId;

        if (!currentAdId) {
          throw new Error('無法獲取廣告 ID');
        }

        // ⚠️ 注意：這裡應該調用廣告 SDK 顯示廣告
        // 目前開發環境可能沒有實際廣告，所以直接跳過
        // TODO: 整合 Google AdMob SDK
        // await showAdSDK(currentAdId);
      }

      // ✅ 步驟 2: 驗證廣告已觀看
      await apiJson('/api/ads/verify', {
        method: 'POST',
        body: {
          adId: currentAdId,
          // verificationToken: ... // 如果使用嚴格驗證模式，需要從 AdMob 獲取
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // ✅ 步驟 3: 領取廣告獎勵
      const claimResult = await apiJson('/api/ads/claim', {
        method: 'POST',
        body: {
          adId: currentAdId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // ✅ 步驟 4: 刷新限制狀態
      await checkLimit(userId, characterId);

      // 更新本地狀態（可選，因為 checkLimit 已經會更新）
      const key = `${userId}::${characterId}`;
      const limitsData = limits.value as PerCharacterLimitData;
      if (limitsData && limitsData[key]) {
        // 從 checkLimit 的結果中獲取最新狀態
        const latestState = limitsData[key];
        return {
          success: true,
          adId: currentAdId,
          remainingMessages: latestState.remaining || 0,
          reward: claimResult.reward,
          message: claimResult.message,
        };
      }

      return {
        success: true,
        adId: currentAdId,
        reward: claimResult.reward,
        message: claimResult.message,
      };
    } catch (err: any) {
      error.value = err?.message || '觀看廣告解鎖失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 獲取指定角色的限制狀態
   */
  const getLimitState = (userId?: string, characterId?: string): LimitCheckResult | null => {
    return getLimitData(userId, characterId || null);
  };

  /**
   * 清除指定角色的限制狀態
   */
  const clearLimitState = (userId?: string, characterId?: string): void => {
    clearState(userId || null, characterId || null);
  };

  return {
    // State
    limits,
    isLoading,
    error,

    // Actions
    checkLimit,
    getStats,
    unlockByAd,
    getLimitState,
    clearLimitState,
  };
}
