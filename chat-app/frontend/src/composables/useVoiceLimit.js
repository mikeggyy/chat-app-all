/**
 * 語音播放限制管理 composable
 * 處理語音播放次數限制、廣告解鎖等功能
 * 使用統一的基礎限制服務模組
 */

import { computed } from 'vue';
import { createLimitService } from './useBaseLimitService.js';

// 創建語音限制服務實例
// 🔒 安全配置：publicStats=false 表示統計 API 需要認證，userId 從 token 獲取
const voiceLimitService = createLimitService({
  serviceName: '語音限制',
  apiBasePath: '/api/voice-limit',
  perCharacter: true, // 按角色追蹤
  publicStats: false, // stats 路由需要認證
});

export function useVoiceLimit() {
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
   * @param {string} userId - 用戶 ID（保留用於 check 端點，該端點仍為公開）
   * @param {string} characterId - 角色 ID
   * @returns {Promise<Object>} 限制檢查結果
   */
  const checkVoiceLimit = async (userId, characterId, options = {}) => {
    return checkLimit(userId, characterId, options);
  };

  /**
   * 載入用戶的語音使用統計
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   */
  const loadVoiceStats = async (userId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId
    return getStats(userId, options);
  };

  /**
   * 獲取特定角色的語音使用狀態
   * @param {string} characterId - 角色 ID
   */
  const getCharacterVoiceStatus = (characterId) => {
    return computed(() => voiceStats.value[characterId] || null);
  };

  /**
   * 檢查是否可以播放語音（不發送請求，基於本地狀態）
   * @param {string} characterId - 角色 ID
   */
  const canPlayLocally = (characterId) => {
    return computed(() => {
      const stats = voiceStats.value[characterId];
      if (!stats) return true; // 尚未載入，預設允許（後端會驗證）
      return stats.canPlay === true && (stats.remaining > 0 || stats.remaining === -1);
    });
  };

  /**
   * 獲取剩餘次數（返回 computed）
   * @param {string} characterId - 角色 ID
   */
  const getRemaining = (characterId) => {
    return computed(() => {
      const stats = voiceStats.value[characterId];
      if (!stats) return null;
      return stats.remaining;
    });
  };

  /**
   * 獲取剩餘次數（返回值）
   * @param {string} userId - 用戶 ID（保留兼容性，實際不使用）
   * @param {string} characterId - 角色 ID
   */
  const getRemainingValue = async (userId, characterId) => {
    // 先載入統計數據（如果尚未載入）
    if (!voiceStats.value[characterId]) {
      await loadVoiceStats(userId);
    }

    const stats = voiceStats.value[characterId];
    if (!stats) return 0;
    return stats.remaining ?? 0;
  };

  /**
   * 清除統計資料
   */
  const clearStats = () => {
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
