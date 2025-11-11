/**
 * 語音管理 Composable
 *
 * 管理語音播放和解鎖功能，包括：
 * - 語音播放處理
 * - 語音解鎖卡使用
 * - 語音廣告觀看
 * - 語音限制檢查
 */

/**
 * 創建語音管理 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.playVoice - 播放語音的方法（來自 useChatActions）
 * @param {Function} deps.loadVoiceStats - 重新加載語音統計
 * @param {Function} deps.checkVoiceLimit - 檢查語音限制
 * @param {Function} deps.unlockVoiceByAd - 通過廣告解鎖語音
 * @param {Function} deps.loadTicketsBalance - 重新加載解鎖卡餘額
 * @param {Function} deps.showVoiceLimit - 顯示語音限制彈窗
 * @param {Function} deps.closeVoiceLimit - 關閉語音限制彈窗
 * @param {Function} deps.getVoiceLimitPendingMessage - 獲取待播放的語音消息
 * @param {Function} deps.showError - 顯示錯誤提示
 * @param {Function} deps.showSuccess - 顯示成功提示
 * @returns {Object} 語音管理相關的狀態和方法
 */
export function useVoiceManagement(deps) {
  const {
    getCurrentUserId,
    playVoice,
    loadVoiceStats,
    checkVoiceLimit,
    unlockVoiceByAd,
    loadTicketsBalance,
    showVoiceLimit,
    closeVoiceLimit,
    getVoiceLimitPendingMessage,
    showError,
    showSuccess,
  } = deps;

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 處理語音播放
   * @param {Object} message - 消息對象
   * @returns {Promise<void>}
   */
  const handlePlayVoice = async (message) => {
    if (!message) return;

    await playVoice(message, { loadVoiceStats, checkVoiceLimit }, (limitInfo) => {
      // On limit exceeded - 保存待播放的消息並顯示限制彈窗
      showVoiceLimit(limitInfo, message);
    });
  };

  /**
   * 處理觀看語音廣告
   * @param {string} userId - 用戶 ID
   * @param {string} matchId - 角色 ID
   * @returns {Promise<void>}
   */
  const handleWatchVoiceAd = async (userId, matchId) => {
    if (!userId || !matchId) return;

    try {
      await unlockVoiceByAd(userId, matchId);
      await loadVoiceStats(userId);
      closeVoiceLimit();
      showSuccess("已解鎖 5 次語音！");
    } catch (error) {
      showError(error instanceof Error ? error.message : "觀看廣告失敗");
    }
  };

  /**
   * 處理使用語音解鎖卡
   * @returns {Promise<void>}
   */
  const handleUseVoiceUnlockCard = async () => {
    const message = getVoiceLimitPendingMessage();

    if (!message) {
      showError("無法使用語音解鎖卡");
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      showError("請先登入");
      return;
    }

    try {
      // 1. 關閉模態框
      closeVoiceLimit();

      // 2. 使用解鎖卡選項播放語音
      // ✅ 正確做法：傳遞 useVoiceUnlockCard 選項給 TTS API
      // API 會先生成音頻，只在成功後才扣除解鎖卡
      const playSuccess = await playVoice(
        message,
        { loadVoiceStats, checkVoiceLimit },
        () => {
          // 如果仍然失敗（例如沒有解鎖卡），顯示錯誤
          showError("使用解鎖卡失敗，請重試");
        },
        undefined, // getVoiceRemaining
        { useVoiceUnlockCard: true } // ✅ 使用解鎖卡選項
      );

      if (playSuccess) {
        // 4. 重新加載語音統計和解鎖卡數據
        await Promise.all([loadVoiceStats(userId), loadTicketsBalance(userId)]);

        showSuccess("語音解鎖卡使用成功！");
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "使用語音解鎖卡失敗");
    }
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 方法
    handlePlayVoice,
    handleWatchVoiceAd,
    handleUseVoiceUnlockCard,
  };
}
