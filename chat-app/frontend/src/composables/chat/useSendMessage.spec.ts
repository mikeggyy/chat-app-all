/**
 * useSendMessage Composable 測試
 *
 * 測試範圍：
 * - 正常消息發送流程
 * - 訪客限制檢查
 * - 對話限制檢查
 * - 錯誤處理
 * - 副作用（清除建議、增加計數、聚焦輸入）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Ref } from 'vue';
import { ref, nextTick } from 'vue';
import { useSendMessage } from './useSendMessage.js';

interface MessageInputElement {
  focus: () => void;
}

interface LimitResult {
  allowed: boolean;
  remaining?: number;
  dailyAdLimit?: number;
  adsWatchedToday?: number;
  isUnlocked?: boolean;
}

interface MockDependencies {
  getCurrentUserId: () => string | null;
  getPartnerId: () => string | null;
  getPartnerDisplayName: () => string;
  getDraft: () => string;
  setDraft: (value: string) => void;
  getMessageInputRef: () => MessageInputElement | null;
  getCharacterTickets: () => number;
  isGuest: Ref<boolean>;
  canGuestSendMessage: Ref<boolean>;
  requireLogin: (options: { feature: string }) => void;
  incrementGuestMessageCount: () => void;
  checkLimit: (userId: string, characterId: string) => Promise<LimitResult>;
  showConversationLimit: (params: any) => void;
  sendMessageToApi: (message: string) => Promise<void>;
  invalidateSuggestions: () => void;
  showError: (message: string) => void;
}

describe('useSendMessage - 消息發送測試', () => {
  let mockDependencies: MockDependencies;
  let mockMessageInputRef: MessageInputElement;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // Mock input element
    mockMessageInputRef = {
      focus: vi.fn(),
    };

    // 創建標準的 mock 依賴項
    mockDependencies = {
      // Getters
      getCurrentUserId: vi.fn(() => 'user-123'),
      getPartnerId: vi.fn(() => 'char-001'),
      getPartnerDisplayName: vi.fn(() => '測試角色'),
      getDraft: vi.fn(() => ''),
      setDraft: vi.fn(),
      getMessageInputRef: vi.fn(() => mockMessageInputRef),
      getCharacterTickets: vi.fn(() => 0),

      // Guest checks
      isGuest: ref(false),
      canGuestSendMessage: ref(true),
      requireLogin: vi.fn(),
      incrementGuestMessageCount: vi.fn(),

      // Limit checks
      checkLimit: vi.fn(async () => ({ allowed: true })),
      showConversationLimit: vi.fn(),

      // Message actions
      sendMessageToApi: vi.fn(async () => {}),
      invalidateSuggestions: vi.fn(),

      // Toast
      showError: vi.fn(),
    };
  });

  describe('正常發送流程', () => {
    it('應該成功發送消息（完整流程）', async () => {
      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Hello!');

      // 驗證調用順序和參數
      expect(mockDependencies.getCurrentUserId).toHaveBeenCalled();
      expect(mockDependencies.getPartnerId).toHaveBeenCalled();
      expect(mockDependencies.checkLimit).toHaveBeenCalledWith('user-123', 'char-001');
      expect(mockDependencies.setDraft).toHaveBeenCalledWith('');
      expect(mockDependencies.sendMessageToApi).toHaveBeenCalledWith('Hello!');
      expect(mockDependencies.invalidateSuggestions).toHaveBeenCalled();
    });

    it('應該在發送後聚焦輸入框', async () => {
      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test message');
      await nextTick(); // 等待 nextTick 完成

      expect(mockDependencies.getMessageInputRef).toHaveBeenCalled();
      expect(mockMessageInputRef.focus).toHaveBeenCalled();
    });

    it('應該在發送消息後清除建議', async () => {
      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test');

      expect(mockDependencies.invalidateSuggestions).toHaveBeenCalled();
    });
  });

  describe('參數驗證', () => {
    it('應該在缺少 userId 時不發送消息', async () => {
      mockDependencies.getCurrentUserId = vi.fn(() => null);
      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Hello');

      expect(mockDependencies.sendMessageToApi).not.toHaveBeenCalled();
    });

    it('應該在缺少 matchId 時不發送消息', async () => {
      mockDependencies.getPartnerId = vi.fn(() => null);
      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Hello');

      expect(mockDependencies.sendMessageToApi).not.toHaveBeenCalled();
    });

    it('應該在消息為空時不發送', async () => {
      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('');

      expect(mockDependencies.sendMessageToApi).not.toHaveBeenCalled();
    });

    it('應該在消息為 null 時不發送', async () => {
      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage(null as any);

      expect(mockDependencies.sendMessageToApi).not.toHaveBeenCalled();
    });
  });

  describe('訪客限制檢查', () => {
    it('應該允許訪客在限制內發送消息', async () => {
      mockDependencies.isGuest.value = true;
      mockDependencies.canGuestSendMessage.value = true;

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Guest message');

      expect(mockDependencies.sendMessageToApi).toHaveBeenCalledWith('Guest message');
      expect(mockDependencies.incrementGuestMessageCount).toHaveBeenCalled();
      expect(mockDependencies.requireLogin).not.toHaveBeenCalled();
    });

    it('應該在訪客超過限制時要求登入', async () => {
      mockDependencies.isGuest.value = true;
      mockDependencies.canGuestSendMessage.value = false;

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Blocked message');

      expect(mockDependencies.requireLogin).toHaveBeenCalledWith({ feature: '發送訊息' });
      expect(mockDependencies.sendMessageToApi).not.toHaveBeenCalled();
    });

    it('應該在訪客發送成功後增加計數', async () => {
      mockDependencies.isGuest.value = true;
      mockDependencies.canGuestSendMessage.value = true;

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Counted message');

      expect(mockDependencies.incrementGuestMessageCount).toHaveBeenCalled();
    });

    it('應該在非訪客時不增加計數', async () => {
      mockDependencies.isGuest.value = false;

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('User message');

      expect(mockDependencies.incrementGuestMessageCount).not.toHaveBeenCalled();
    });
  });

  describe('對話限制檢查', () => {
    it('應該在達到對話限制時顯示限制提示', async () => {
      mockDependencies.checkLimit = vi.fn(async () => ({
        allowed: false,
        remaining: 0,
        dailyAdLimit: 10,
        adsWatchedToday: 5,
        isUnlocked: false,
      }));
      mockDependencies.getCharacterTickets = vi.fn(() => 2);

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Limited message');

      expect(mockDependencies.showConversationLimit).toHaveBeenCalledWith({
        characterName: '測試角色',
        remainingMessages: 0,
        dailyAdLimit: 10,
        adsWatchedToday: 5,
        isUnlocked: false,
        characterUnlockCards: 2,
      });
      expect(mockDependencies.sendMessageToApi).not.toHaveBeenCalled();
    });

    it('應該在限制允許時正常發送', async () => {
      mockDependencies.checkLimit = vi.fn(async () => ({
        allowed: true,
        remaining: 10,
      }));

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Allowed message');

      expect(mockDependencies.sendMessageToApi).toHaveBeenCalledWith('Allowed message');
      expect(mockDependencies.showConversationLimit).not.toHaveBeenCalled();
    });

    it('應該處理限制檢查返回的所有參數', async () => {
      mockDependencies.checkLimit = vi.fn(async () => ({
        allowed: false,
        remaining: 3,
        dailyAdLimit: 15,
        adsWatchedToday: 8,
        isUnlocked: true,
      }));
      mockDependencies.getCharacterTickets = vi.fn(() => 5);

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test');

      expect(mockDependencies.showConversationLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          remainingMessages: 3,
          dailyAdLimit: 15,
          adsWatchedToday: 8,
          isUnlocked: true,
          characterUnlockCards: 5,
        })
      );
    });

    it('應該處理限制檢查缺少字段的情況', async () => {
      // 缺少 remaining, dailyAdLimit 等字段
      mockDependencies.checkLimit = vi.fn(async () => ({
        allowed: false,
      }));

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test');

      expect(mockDependencies.showConversationLimit).toHaveBeenCalledWith({
        characterName: '測試角色',
        remainingMessages: 0,
        dailyAdLimit: 10,
        adsWatchedToday: 0,
        isUnlocked: false,
        characterUnlockCards: 0,
      });
    });
  });

  describe('錯誤處理', () => {
    it('應該捕獲並顯示發送消息錯誤', async () => {
      const errorMessage = '網絡錯誤';
      mockDependencies.sendMessageToApi = vi.fn(async () => {
        throw new Error(errorMessage);
      });

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Error message');

      expect(mockDependencies.showError).toHaveBeenCalledWith(errorMessage);
    });

    it('應該處理非 Error 對象的錯誤', async () => {
      mockDependencies.sendMessageToApi = vi.fn(async () => {
        throw '字符串錯誤';
      });

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test');

      expect(mockDependencies.showError).toHaveBeenCalledWith('發送消息失敗');
    });

    it('應該在錯誤後不執行副作用', async () => {
      mockDependencies.sendMessageToApi = vi.fn(async () => {
        throw new Error('Failed');
      });

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test');

      // 不應該清除建議和增加計數
      expect(mockDependencies.invalidateSuggestions).not.toHaveBeenCalled();
      expect(mockDependencies.incrementGuestMessageCount).not.toHaveBeenCalled();
    });

    it('應該在發送前就清除草稿（即使後續失敗）', async () => {
      mockDependencies.sendMessageToApi = vi.fn(async () => {
        throw new Error('Failed');
      });

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test');

      // 即使發送失敗，也應該清除草稿
      expect(mockDependencies.setDraft).toHaveBeenCalledWith('');
    });
  });

  describe('副作用執行順序', () => {
    it('應該按正確順序執行所有步驟', async () => {
      const callOrder: string[] = [];

      mockDependencies.checkLimit = vi.fn(async () => {
        callOrder.push('checkLimit');
        return { allowed: true };
      });
      mockDependencies.setDraft = vi.fn(() => {
        callOrder.push('setDraft');
      });
      mockDependencies.sendMessageToApi = vi.fn(async () => {
        callOrder.push('sendMessage');
      });
      mockDependencies.invalidateSuggestions = vi.fn(() => {
        callOrder.push('invalidateSuggestions');
      });

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Ordered message');

      expect(callOrder).toEqual([
        'checkLimit',
        'setDraft',
        'sendMessage',
        'invalidateSuggestions',
      ]);
    });
  });

  describe('邊界情況', () => {
    it('應該處理 getMessageInputRef 返回 null', async () => {
      mockDependencies.getMessageInputRef = vi.fn(() => null);

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test');

      // 不應該拋出錯誤
      expect(mockDependencies.sendMessageToApi).toHaveBeenCalled();
    });

    it('應該處理 getCharacterTickets 返回 null', async () => {
      mockDependencies.checkLimit = vi.fn(async () => ({ allowed: false }));
      mockDependencies.getCharacterTickets = vi.fn(() => null as any);

      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('Test');

      expect(mockDependencies.showConversationLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          characterUnlockCards: 0, // 應該使用默認值 0
        })
      );
    });

    it('應該處理空白字符消息', async () => {
      const { handleSendMessage } = useSendMessage(mockDependencies);

      await handleSendMessage('   ');

      // 空白字符視為有效消息（由上層處理 trim）
      expect(mockDependencies.sendMessageToApi).toHaveBeenCalledWith('   ');
    });

    it('應該處理長消息', async () => {
      const { handleSendMessage } = useSendMessage(mockDependencies);
      const longMessage = 'A'.repeat(1000);

      await handleSendMessage(longMessage);

      expect(mockDependencies.sendMessageToApi).toHaveBeenCalledWith(longMessage);
    });
  });
});
