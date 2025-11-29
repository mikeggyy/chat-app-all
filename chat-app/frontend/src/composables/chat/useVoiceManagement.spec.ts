/**
 * useVoiceManagement Composable 測試
 *
 * 測試範圍：
 * - 語音播放處理
 * - 觀看廣告解鎖語音
 * - 使用語音解鎖卡
 * - 限制檢查和彈窗顯示
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVoiceManagement } from './useVoiceManagement.js';
import type {
  UseVoiceManagementDeps,
  VoiceLimitInfo,
  VoiceLimitChecker,
} from './useVoiceManagement.js';
import type { Message } from '../../types';

describe('useVoiceManagement - 語音管理測試', () => {
  let mockDeps: UseVoiceManagementDeps;
  let mockMessage: Message;
  let mockLimitInfo: VoiceLimitInfo;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // Mock message
    mockMessage = {
      id: 'msg-001',
      text: 'Hello',
      role: 'partner',
      createdAt: '2025-11-26T10:00:00Z',
    } as Message;

    // Mock limit info
    mockLimitInfo = {
      allowed: false,
      remaining: 0,
      total: 10,
      dailyAdLimit: 5,
      adsWatchedToday: 3,
    };

    // 創建標準的 mock 依賴項
    mockDeps = {
      getCurrentUserId: vi.fn(() => 'user-123'),
      playVoice: vi.fn(async () => true),
      loadVoiceStats: vi.fn(async () => {}),
      checkVoiceLimit: vi.fn(async () => ({ allowed: true, remaining: 5, total: 10 })),
      unlockVoiceByAd: vi.fn(async () => {}),
      loadTicketsBalance: vi.fn(async () => {}),
      showVoiceLimit: vi.fn(),
      closeVoiceLimit: vi.fn(),
      getVoiceLimitPendingMessage: vi.fn(() => mockMessage),
      showError: vi.fn(),
      showSuccess: vi.fn(),
    };
  });

  describe('handlePlayVoice - 語音播放處理', () => {
    it('應該成功播放語音', async () => {
      const { handlePlayVoice } = useVoiceManagement(mockDeps);

      await handlePlayVoice(mockMessage);

      expect(mockDeps.playVoice).toHaveBeenCalledWith(
        mockMessage,
        expect.objectContaining({
          loadVoiceStats: mockDeps.loadVoiceStats,
          checkVoiceLimit: mockDeps.checkVoiceLimit,
        }),
        expect.any(Function)
      );
    });

    it('應該在 message 為空時不執行', async () => {
      const { handlePlayVoice } = useVoiceManagement(mockDeps);

      await handlePlayVoice(null as any);

      expect(mockDeps.playVoice).not.toHaveBeenCalled();
    });

    it('應該在 message 為 undefined 時不執行', async () => {
      const { handlePlayVoice } = useVoiceManagement(mockDeps);

      await handlePlayVoice(undefined as any);

      expect(mockDeps.playVoice).not.toHaveBeenCalled();
    });

    it('應該傳遞正確的 limit checker', async () => {
      const { handlePlayVoice } = useVoiceManagement(mockDeps);

      await handlePlayVoice(mockMessage);

      const callArgs = (mockDeps.playVoice as any).mock.calls[0];
      const checker: VoiceLimitChecker = callArgs[1];

      expect(checker).toHaveProperty('loadVoiceStats');
      expect(checker).toHaveProperty('checkVoiceLimit');
      expect(checker.loadVoiceStats).toBe(mockDeps.loadVoiceStats);
      expect(checker.checkVoiceLimit).toBe(mockDeps.checkVoiceLimit);
    });

    it('應該在超過限制時調用 onLimitExceeded 回調', async () => {
      // Mock playVoice 調用 onLimitExceeded
      mockDeps.playVoice = vi.fn(async (message, checker, onLimitExceeded) => {
        if (onLimitExceeded) {
          onLimitExceeded(mockLimitInfo);
        }
        return false;
      });

      const { handlePlayVoice } = useVoiceManagement(mockDeps);

      await handlePlayVoice(mockMessage);

      expect(mockDeps.showVoiceLimit).toHaveBeenCalledWith(mockLimitInfo, mockMessage);
    });

    it('應該傳遞消息給 showVoiceLimit', async () => {
      const customLimitInfo: VoiceLimitInfo = {
        allowed: false,
        remaining: 2,
        total: 15,
      };

      mockDeps.playVoice = vi.fn(async (message, checker, onLimitExceeded) => {
        if (onLimitExceeded) {
          onLimitExceeded(customLimitInfo);
        }
        return false;
      });

      const { handlePlayVoice } = useVoiceManagement(mockDeps);

      await handlePlayVoice(mockMessage);

      expect(mockDeps.showVoiceLimit).toHaveBeenCalledWith(customLimitInfo, mockMessage);
    });
  });

  describe('handleWatchVoiceAd - 觀看廣告解鎖', () => {
    it('應該成功觀看廣告並解鎖語音', async () => {
      const { handleWatchVoiceAd } = useVoiceManagement(mockDeps);

      await handleWatchVoiceAd('user-123', 'char-001');

      expect(mockDeps.unlockVoiceByAd).toHaveBeenCalledWith('user-123', 'char-001');
      expect(mockDeps.loadVoiceStats).toHaveBeenCalledWith('user-123');
      expect(mockDeps.closeVoiceLimit).toHaveBeenCalled();
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('已解鎖 5 次語音！');
    });

    it('應該在 userId 為空時不執行', async () => {
      const { handleWatchVoiceAd } = useVoiceManagement(mockDeps);

      await handleWatchVoiceAd('', 'char-001');

      expect(mockDeps.unlockVoiceByAd).not.toHaveBeenCalled();
    });

    it('應該在 matchId 為空時不執行', async () => {
      const { handleWatchVoiceAd } = useVoiceManagement(mockDeps);

      await handleWatchVoiceAd('user-123', '');

      expect(mockDeps.unlockVoiceByAd).not.toHaveBeenCalled();
    });

    it('應該在 userId 和 matchId 都為空時不執行', async () => {
      const { handleWatchVoiceAd } = useVoiceManagement(mockDeps);

      await handleWatchVoiceAd('', '');

      expect(mockDeps.unlockVoiceByAd).not.toHaveBeenCalled();
    });

    it('應該處理 Error 對象錯誤', async () => {
      const errorMessage = '廣告加載失敗';
      mockDeps.unlockVoiceByAd = vi.fn(async () => {
        throw new Error(errorMessage);
      });

      const { handleWatchVoiceAd } = useVoiceManagement(mockDeps);

      await handleWatchVoiceAd('user-123', 'char-001');

      expect(mockDeps.showError).toHaveBeenCalledWith(errorMessage);
      expect(mockDeps.closeVoiceLimit).not.toHaveBeenCalled();
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });

    it('應該處理非 Error 對象錯誤', async () => {
      mockDeps.unlockVoiceByAd = vi.fn(async () => {
        throw '字符串錯誤';
      });

      const { handleWatchVoiceAd } = useVoiceManagement(mockDeps);

      await handleWatchVoiceAd('user-123', 'char-001');

      expect(mockDeps.showError).toHaveBeenCalledWith('觀看廣告失敗');
    });

    it('應該按順序執行操作', async () => {
      const callOrder: string[] = [];

      mockDeps.unlockVoiceByAd = vi.fn(async () => {
        callOrder.push('unlockVoiceByAd');
      });
      mockDeps.loadVoiceStats = vi.fn(async () => {
        callOrder.push('loadVoiceStats');
      });
      mockDeps.closeVoiceLimit = vi.fn(() => {
        callOrder.push('closeVoiceLimit');
      });
      mockDeps.showSuccess = vi.fn(() => {
        callOrder.push('showSuccess');
      });

      const { handleWatchVoiceAd } = useVoiceManagement(mockDeps);

      await handleWatchVoiceAd('user-123', 'char-001');

      expect(callOrder).toEqual([
        'unlockVoiceByAd',
        'loadVoiceStats',
        'closeVoiceLimit',
        'showSuccess',
      ]);
    });

    it('應該在錯誤後不執行後續操作', async () => {
      mockDeps.unlockVoiceByAd = vi.fn(async () => {
        throw new Error('Failed');
      });

      const { handleWatchVoiceAd } = useVoiceManagement(mockDeps);

      await handleWatchVoiceAd('user-123', 'char-001');

      expect(mockDeps.loadVoiceStats).not.toHaveBeenCalled();
      expect(mockDeps.closeVoiceLimit).not.toHaveBeenCalled();
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });
  });

  describe('handleUseVoiceUnlockCard - 使用語音解鎖卡', () => {
    it('應該成功使用解鎖卡播放語音', async () => {
      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.getVoiceLimitPendingMessage).toHaveBeenCalled();
      expect(mockDeps.closeVoiceLimit).toHaveBeenCalled();
      expect(mockDeps.playVoice).toHaveBeenCalledWith(
        mockMessage,
        expect.any(Object),
        expect.any(Function),
        undefined,
        { useVoiceUnlockCard: true }
      );
      expect(mockDeps.loadVoiceStats).toHaveBeenCalledWith('user-123');
      expect(mockDeps.loadTicketsBalance).toHaveBeenCalledWith('user-123');
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('語音解鎖卡使用成功！');
    });

    it('應該在沒有待播放消息時顯示錯誤', async () => {
      mockDeps.getVoiceLimitPendingMessage = vi.fn(() => null);

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.showError).toHaveBeenCalledWith('無法使用語音解鎖卡');
      expect(mockDeps.playVoice).not.toHaveBeenCalled();
    });

    it('應該在未登入時顯示錯誤', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => '');

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.showError).toHaveBeenCalledWith('請先登入');
      expect(mockDeps.playVoice).not.toHaveBeenCalled();
    });

    it('應該在 userId 為 null 時顯示錯誤', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null as any);

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.showError).toHaveBeenCalledWith('請先登入');
      expect(mockDeps.playVoice).not.toHaveBeenCalled();
    });

    it('應該先關閉模態框再播放語音', async () => {
      const callOrder: string[] = [];

      mockDeps.closeVoiceLimit = vi.fn(() => {
        callOrder.push('closeVoiceLimit');
      });
      mockDeps.playVoice = vi.fn(async () => {
        callOrder.push('playVoice');
        return true;
      });

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(callOrder[0]).toBe('closeVoiceLimit');
      expect(callOrder[1]).toBe('playVoice');
    });

    it('應該傳遞 useVoiceUnlockCard 選項給 playVoice', async () => {
      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.playVoice).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Function),
        undefined,
        { useVoiceUnlockCard: true }
      );
    });

    it('應該在 playVoice 返回 true 時重新加載數據', async () => {
      mockDeps.playVoice = vi.fn(async () => true);

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.loadVoiceStats).toHaveBeenCalledWith('user-123');
      expect(mockDeps.loadTicketsBalance).toHaveBeenCalledWith('user-123');
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('語音解鎖卡使用成功！');
    });

    it('應該在 playVoice 返回 false 時不顯示成功消息', async () => {
      mockDeps.playVoice = vi.fn(async () => false);

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.loadVoiceStats).not.toHaveBeenCalled();
      expect(mockDeps.loadTicketsBalance).not.toHaveBeenCalled();
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });

    it('應該在 playVoice 失敗時調用 onLimitExceeded 回調', async () => {
      mockDeps.playVoice = vi.fn(async (message, checker, onLimitExceeded) => {
        if (onLimitExceeded) {
          onLimitExceeded();
        }
        return false;
      });

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.showError).toHaveBeenCalledWith('使用解鎖卡失敗，請重試');
    });

    it('應該處理 Error 對象錯誤', async () => {
      const errorMessage = '解鎖卡餘額不足';
      mockDeps.playVoice = vi.fn(async () => {
        throw new Error(errorMessage);
      });

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.showError).toHaveBeenCalledWith(errorMessage);
      expect(mockDeps.loadVoiceStats).not.toHaveBeenCalled();
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });

    it('應該處理非 Error 對象錯誤', async () => {
      mockDeps.playVoice = vi.fn(async () => {
        throw '未知錯誤';
      });

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(mockDeps.showError).toHaveBeenCalledWith('使用語音解鎖卡失敗');
    });

    it('應該按順序執行所有操作', async () => {
      const callOrder: string[] = [];

      mockDeps.getVoiceLimitPendingMessage = vi.fn(() => {
        callOrder.push('getVoiceLimitPendingMessage');
        return mockMessage;
      });
      mockDeps.getCurrentUserId = vi.fn(() => {
        callOrder.push('getCurrentUserId');
        return 'user-123';
      });
      mockDeps.closeVoiceLimit = vi.fn(() => {
        callOrder.push('closeVoiceLimit');
      });
      mockDeps.playVoice = vi.fn(async () => {
        callOrder.push('playVoice');
        return true;
      });
      mockDeps.loadVoiceStats = vi.fn(async () => {
        callOrder.push('loadVoiceStats');
      });
      mockDeps.loadTicketsBalance = vi.fn(async () => {
        callOrder.push('loadTicketsBalance');
      });
      mockDeps.showSuccess = vi.fn(() => {
        callOrder.push('showSuccess');
      });

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      expect(callOrder).toEqual([
        'getVoiceLimitPendingMessage',
        'getCurrentUserId',
        'closeVoiceLimit',
        'playVoice',
        'loadVoiceStats',
        'loadTicketsBalance',
        'showSuccess',
      ]);
    });

    it('應該並行加載 voiceStats 和 ticketsBalance', async () => {
      let loadVoiceStatsResolved = false;
      let loadTicketsBalanceResolved = false;
      const startTime = Date.now();

      mockDeps.loadVoiceStats = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        loadVoiceStatsResolved = true;
      });
      mockDeps.loadTicketsBalance = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        loadTicketsBalanceResolved = true;
      });

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      const duration = Date.now() - startTime;

      // 如果是順序執行，需要至少 100ms；並行執行只需約 50ms
      expect(duration).toBeLessThan(90);
      expect(loadVoiceStatsResolved).toBe(true);
      expect(loadTicketsBalanceResolved).toBe(true);
    });
  });

  describe('邊界情況測試', () => {
    it('應該處理 message.id 為空的情況', async () => {
      const messageWithoutId = {
        text: 'Hello',
        role: 'partner',
      } as Message;

      const { handlePlayVoice } = useVoiceManagement(mockDeps);

      await handlePlayVoice(messageWithoutId);

      expect(mockDeps.playVoice).toHaveBeenCalledWith(
        messageWithoutId,
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('應該處理空字符串 userId', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => '   ');

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      // 空白字符串視為有效（由上層處理 trim）
      expect(mockDeps.playVoice).toHaveBeenCalled();
    });

    it('應該處理 limitInfo 包含額外字段', async () => {
      const extendedLimitInfo = {
        ...mockLimitInfo,
        extraField: 'extra',
        anotherField: 123,
      };

      mockDeps.playVoice = vi.fn(async (message, checker, onLimitExceeded) => {
        if (onLimitExceeded) {
          onLimitExceeded(extendedLimitInfo);
        }
        return false;
      });

      const { handlePlayVoice } = useVoiceManagement(mockDeps);

      await handlePlayVoice(mockMessage);

      expect(mockDeps.showVoiceLimit).toHaveBeenCalledWith(extendedLimitInfo, mockMessage);
    });

    it('應該處理 playVoice 返回 undefined', async () => {
      mockDeps.playVoice = vi.fn(async () => undefined as any);

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      // undefined 視為 falsy，不應顯示成功消息
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });

    it('應該處理 playVoice 返回 null', async () => {
      mockDeps.playVoice = vi.fn(async () => null as any);

      const { handleUseVoiceUnlockCard } = useVoiceManagement(mockDeps);

      await handleUseVoiceUnlockCard();

      // null 視為 falsy，不應顯示成功消息
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });
  });

  describe('依賴注入測試', () => {
    it('應該使用注入的 getCurrentUserId', async () => {
      const customGetUserId = vi.fn(() => 'custom-user-id');
      const customDeps = { ...mockDeps, getCurrentUserId: customGetUserId };

      const { handleUseVoiceUnlockCard } = useVoiceManagement(customDeps);

      await handleUseVoiceUnlockCard();

      expect(customGetUserId).toHaveBeenCalled();
      expect(mockDeps.loadVoiceStats).toHaveBeenCalledWith('custom-user-id');
    });

    it('應該使用注入的 playVoice', async () => {
      const customPlayVoice = vi.fn(async () => true);
      const customDeps = { ...mockDeps, playVoice: customPlayVoice };

      const { handlePlayVoice } = useVoiceManagement(customDeps);

      await handlePlayVoice(mockMessage);

      expect(customPlayVoice).toHaveBeenCalled();
      expect(mockDeps.playVoice).not.toHaveBeenCalled();
    });

    it('應該使用注入的 showError', async () => {
      const customShowError = vi.fn();
      const customDeps = {
        ...mockDeps,
        showError: customShowError,
        getVoiceLimitPendingMessage: vi.fn(() => null),
      };

      const { handleUseVoiceUnlockCard } = useVoiceManagement(customDeps);

      await handleUseVoiceUnlockCard();

      expect(customShowError).toHaveBeenCalledWith('無法使用語音解鎖卡');
      expect(mockDeps.showError).not.toHaveBeenCalled();
    });

    it('應該使用注入的 showSuccess', async () => {
      const customShowSuccess = vi.fn();
      const customDeps = { ...mockDeps, showSuccess: customShowSuccess };

      const { handleWatchVoiceAd } = useVoiceManagement(customDeps);

      await handleWatchVoiceAd('user-123', 'char-001');

      expect(customShowSuccess).toHaveBeenCalledWith('已解鎖 5 次語音！');
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });
  });
});
