/**
 * useVoiceManagement.ts
 * 語音管理 Composable（TypeScript 版本）
 * 管理語音播放和解鎖功能
 */

import type { Message } from '../../types';

// ==================== 類型定義 ====================

/**
 * 語音限制信息
 */
export interface VoiceLimitInfo {
  allowed: boolean;
  remaining: number;
  total: number;
  [key: string]: any;
}

/**
 * 語音限制檢查器
 */
export interface VoiceLimitChecker {
  loadVoiceStats: (userId: string) => Promise<void>;
  checkVoiceLimit: (userId: string, characterId: string) => Promise<VoiceLimitInfo>;
}

/**
 * 播放語音選項
 */
export interface PlayVoiceOptions {
  useVoiceUnlockCard?: boolean;
}

/**
 * useVoiceManagement 依賴項
 */
export interface UseVoiceManagementDeps {
  getCurrentUserId: () => string;
  playVoice: (
    message: Message,
    checker: VoiceLimitChecker,
    onLimitExceeded?: (info: VoiceLimitInfo) => void,
    getVoiceRemaining?: () => number,
    options?: PlayVoiceOptions
  ) => Promise<boolean>;
  loadVoiceStats: (userId: string) => Promise<void>;
  checkVoiceLimit: (userId: string, characterId: string) => Promise<VoiceLimitInfo>;
  unlockVoiceByAd: (userId: string, characterId: string) => Promise<void>;
  loadTicketsBalance: (userId: string) => Promise<void>;
  showVoiceLimit: (limitInfo: VoiceLimitInfo, message: Message) => void;
  closeVoiceLimit: () => void;
  getVoiceLimitPendingMessage: () => Message | null;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

/**
 * useVoiceManagement 返回類型
 */
export interface UseVoiceManagementReturn {
  handlePlayVoice: (message: Message) => Promise<void>;
  handleWatchVoiceAd: (userId: string, matchId: string) => Promise<void>;
  handleUseVoiceUnlockCard: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 創建語音管理 composable
 * @param deps - 依賴項
 * @returns 語音管理相關的狀態和方法
 */
export function useVoiceManagement(deps: UseVoiceManagementDeps): UseVoiceManagementReturn {
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

  // ====================
  // 核心方法
  // ====================

  /**
   * 處理語音播放
   * @param message - 消息對象
   */
  const handlePlayVoice = async (message: Message): Promise<void> => {
    if (!message) return;

    await playVoice(message, { loadVoiceStats, checkVoiceLimit }, (limitInfo) => {
      // On limit exceeded - 保存待播放的消息並顯示限制彈窗
      showVoiceLimit(limitInfo, message);
    });
  };

  /**
   * 處理觀看語音廣告
   * @param userId - 用戶 ID
   * @param matchId - 角色 ID
   */
  const handleWatchVoiceAd = async (userId: string, matchId: string): Promise<void> => {
    if (!userId || !matchId) return;

    try {
      await unlockVoiceByAd(userId, matchId);
      await loadVoiceStats(userId);
      closeVoiceLimit();
      showSuccess('已解鎖 5 次語音！');
    } catch (error: any) {
      showError(error instanceof Error ? error.message : '觀看廣告失敗');
    }
  };

  /**
   * 處理使用語音解鎖卡
   */
  const handleUseVoiceUnlockCard = async (): Promise<void> => {
    const message = getVoiceLimitPendingMessage();

    if (!message) {
      showError('無法使用語音解鎖卡');
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      showError('請先登入');
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
          showError('使用解鎖卡失敗，請重試');
        },
        undefined, // getVoiceRemaining
        { useVoiceUnlockCard: true } // ✅ 使用解鎖卡選項
      );

      if (playSuccess) {
        // 4. 重新加載語音統計和解鎖卡數據
        await Promise.all([loadVoiceStats(userId), loadTicketsBalance(userId)]);

        showSuccess('語音解鎖卡使用成功！');
      }
    } catch (error: any) {
      showError(error instanceof Error ? error.message : '使用語音解鎖卡失敗');
    }
  };

  // ====================
  // 返回 API
  // ====================
  return {
    // 方法
    handlePlayVoice,
    handleWatchVoiceAd,
    handleUseVoiceUnlockCard,
  };
}
