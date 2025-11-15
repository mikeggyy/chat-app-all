/**
 * useVoiceLimit.ts
 * 語音播放限制管理 composable（TypeScript 版本）
 * 處理語音播放次數限制、廣告解鎖等功能
 * 使用統一的基礎限制服務模組
 */

import { computed, type ComputedRef, type Ref } from 'vue';
import { createLimitService, type LimitServiceReturn, type LimitServiceOptions, type PerCharacterLimitData } from './useBaseLimitService.js';
import type { LimitCheckResult } from '../types';

// ==================== 類型定義 ====================

/**
 * 語音限制返回類型
 */
export interface UseVoiceLimitReturn {
  // State
  voiceStats: Ref<PerCharacterLimitData | LimitCheckResult | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;

  // Actions
  checkVoiceLimit: (userId?: string, characterId?: string, options?: LimitServiceOptions) => Promise<LimitCheckResult | null>;
  loadVoiceStats: (userId?: string, options?: LimitServiceOptions) => Promise<any>;
  unlockByAd: (userId: string, characterId?: string | null, adId?: string, options?: LimitServiceOptions) => Promise<any>;
  clearStats: () => void;

  // Computed helpers
  getCharacterVoiceStatus: (characterId: string) => ComputedRef<LimitCheckResult | null>;
  canPlayLocally: (characterId: string) => ComputedRef<boolean>;
  getRemaining: (characterId: string) => ComputedRef<number | null>;
  getRemainingValue: (userId?: string, characterId?: string) => Promise<number>;
}

// ==================== Composable 主函數 ====================

// 創建語音限制服務實例
// 🔒 安全配置：publicStats=false 表示統計 API 需要認證，userId 從 token 獲取
const voiceLimitService: LimitServiceReturn = createLimitService({
  serviceName: '語音限制',
  apiBasePath: '/api/voice-limit',
  perCharacter: true, // 按角色追蹤
  publicStats: false, // stats 路由需要認證
});

export function useVoiceLimit(): UseVoiceLimitReturn {
  const {
    limitData: voiceStats,
    isLoading,
    error,
    checkLimit,
    getStats,
    unlockByAd,
    clearState,
  } = voiceLimitService;

  /**
   * 檢查是否可以播放語音
   * @param userId - 用戶 ID（保留用於 check 端點，該端點仍為公開）
   * @param characterId - 角色 ID
   * @returns 限制檢查結果
   */
  const checkVoiceLimit = async (
    userId?: string,
    characterId?: string,
    options: LimitServiceOptions = {}
  ): Promise<LimitCheckResult | null> => {
    return checkLimit(userId, characterId, options);
  };

  /**
   * 載入用戶的語音使用統計
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   */
  const loadVoiceStats = async (userId?: string, options: LimitServiceOptions = {}): Promise<any> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId
    return getStats(userId, options);
  };

  /**
   * 獲取特定角色的語音使用狀態
   * @param characterId - 角色 ID
   */
  const getCharacterVoiceStatus = (characterId: string): ComputedRef<LimitCheckResult | null> => {
    return computed(() => {
      const stats = voiceStats.value as PerCharacterLimitData;
      return stats?.[characterId] || null;
    });
  };

  /**
   * 檢查是否可以播放語音（不發送請求，基於本地狀態）
   * @param characterId - 角色 ID
   */
  const canPlayLocally = (characterId: string): ComputedRef<boolean> => {
    return computed(() => {
      const stats = voiceStats.value as PerCharacterLimitData;
      const charStats = stats?.[characterId];
      if (!charStats) return true; // 尚未載入，預設允許（後端會驗證）
      return charStats.allowed === true && (charStats.remaining > 0 || charStats.remaining === -1);
    });
  };

  /**
   * 獲取剩餘次數（返回 computed）
   * @param characterId - 角色 ID
   */
  const getRemaining = (characterId: string): ComputedRef<number | null> => {
    return computed(() => {
      const stats = voiceStats.value as PerCharacterLimitData;
      const charStats = stats?.[characterId];
      if (!charStats) return null;
      return charStats.remaining;
    });
  };

  /**
   * 獲取剩餘次數（返回值）
   * @param userId - 用戶 ID（保留兼容性，實際不使用）
   * @param characterId - 角色 ID
   */
  const getRemainingValue = async (userId?: string, characterId?: string): Promise<number> => {
    // 先載入統計數據（如果尚未載入）
    const stats = voiceStats.value as PerCharacterLimitData;
    if (!stats || !characterId || !stats[characterId]) {
      await loadVoiceStats(userId);
    }

    const updatedStats = voiceStats.value as PerCharacterLimitData;
    const charStats = characterId ? updatedStats?.[characterId] : null;
    if (!charStats) return 0;
    return charStats.remaining ?? 0;
  };

  /**
   * 清除統計資料
   */
  const clearStats = (): void => {
    clearState();
  };

  return {
    // State
    voiceStats,
    isLoading,
    error,

    // Actions
    checkVoiceLimit,
    loadVoiceStats,
    unlockByAd,
    clearStats,

    // Computed helpers
    getCharacterVoiceStatus,
    canPlayLocally,
    getRemaining,
    getRemainingValue,
  };
}
