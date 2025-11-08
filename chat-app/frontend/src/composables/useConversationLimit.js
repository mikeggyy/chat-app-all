/**
 * 對話限制系統 composable
 * 管理用戶與每個角色的對話次數限制
 * 使用統一的基礎限制服務模組
 */

import { createLimitService } from './useBaseLimitService.js';

// 創建對話限制服務實例
// 🔒 安全配置：publicStats=false 表示統計 API 需要認證，userId 從 token 獲取
const conversationLimitService = createLimitService({
  serviceName: '對話限制',
  apiBasePath: '/api/conversations/limit',
  perCharacter: true, // 按角色追蹤
  publicStats: false, // stats 路由需要認證
  endpoints: {
    // 自定義端點格式
    check: (userId, characterId) =>
      `/api/conversations/limit/${encodeURIComponent(userId)}/${encodeURIComponent(characterId)}/check`,
    stats: () => `/api/conversations/limit/stats`, // 🔒 安全更新：userId 從認證 token 獲取
    unlockByAd: () => '/api/ad/unlock', // 對話解鎖使用統一的廣告端點
  },
});

export function useConversationLimit() {
  const {
    limitData: limits,
    isLoading,
    error,
    checkLimit,
    getStats,
    unlockByAd: baseUnlockByAd,
    clearState,
    getLimitData,
  } = conversationLimitService;

  /**
   * 對話專用的廣告解鎖（使用不同的 API 格式）
   */
  const unlockByAd = async (userId, characterId, adId, options = {}) => {
    if (!userId || !characterId || !adId) {
      error.value = '需要提供用戶 ID、角色 ID 和廣告 ID';
      throw new Error('需要提供用戶 ID、角色 ID 和廣告 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const { apiJson } = await import('../utils/api.js');
      const data = await apiJson('/api/ad/unlock', {
        method: 'POST',
        body: {
          userId,
          characterId,
          adId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新狀態
      const key = `${userId}::${characterId}`;
      if (limits.value[key]) {
        limits.value[key].remainingMessages = data.remainingMessages;
        limits.value[key].isUnlocked = data.isUnlocked;
      }

      return data;
    } catch (err) {
      error.value = err?.message || '觀看廣告解鎖失敗';

      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 獲取指定角色的限制狀態
   */
  const getLimitState = (userId, characterId) => {
    return getLimitData(userId, characterId);
  };

  /**
   * 清除指定角色的限制狀態
   */
  const clearLimitState = (userId, characterId) => {
    clearState(userId, characterId);
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
