/**
 * useChatCore 集成測試
 * 測試所有 composables 的正確組合和參數傳遞
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { ref } from 'vue';

// Mock all dependencies
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: 'test-char-001' }
  })
}));

vi.mock('../../useUserProfile', () => ({
  useUserProfile: () => ({
    user: ref({ id: 'test-user', favorites: [] }),
    setUserProfile: vi.fn(),
    addConversationHistory: vi.fn(),
  })
}));

vi.mock('../../useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({
    getCurrentUserIdToken: vi.fn(async () => 'mock-token'),
  })
}));

vi.mock('../../useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  })
}));

vi.mock('../usePartner', () => ({
  usePartner: vi.fn(({ partnerId }: any) => ({
    partner: ref({ id: 'char-001', display_name: '測試角色' }),
    partnerDisplayName: ref('測試角色'),
    partnerBackground: ref('測試背景'),
    backgroundStyle: ref({}),
    loadPartner: vi.fn(),
  }))
}));

vi.mock('../useChatMessages', () => ({
  useChatMessages: vi.fn((partnerId: any) => ({
    messages: ref([]),
    isReplying: ref(false),
    isLoadingHistory: ref(false),
    loadHistory: vi.fn(),
    sendMessageToApi: vi.fn(),
    resetConversationApi: vi.fn(),
    cleanupMessages: vi.fn(),
  }))
}));

vi.mock('../useSuggestions', () => ({
  useSuggestions: vi.fn((messages: any, partner: any, firebaseAuth: any, currentUserId: any) => ({
    suggestionOptions: ref([]),
    isLoadingSuggestions: ref(false),
    suggestionError: ref(null),
    loadSuggestions: vi.fn(),
    invalidateSuggestions: vi.fn(),
    hasCachedSuggestions: ref(false),
  }))
}));

describe('useChatCore - 集成測試', () => {
  let useChatCore: any;
  let useSuggestionsMock: Mock;
  let usePartnerMock: Mock;
  let useChatMessagesMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 獲取 mocks
    const { useSuggestions } = await import('../useSuggestions');
    const { usePartner } = await import('../usePartner');
    const { useChatMessages } = await import('../useChatMessages');

    useSuggestionsMock = useSuggestions as Mock;
    usePartnerMock = usePartner as Mock;
    useChatMessagesMock = useChatMessages as Mock;

    // 導入測試目標
    const module = await import('./useChatCore');
    useChatCore = module.useChatCore;
  });

  describe('Composable 參數傳遞', () => {
    it('應該正確傳遞參數給 usePartner', () => {
      useChatCore();

      expect(usePartnerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          partnerId: expect.any(Object) // computed ref
        })
      );
    });

    it('應該正確傳遞參數給 useChatMessages', () => {
      useChatCore();

      expect(useChatMessagesMock).toHaveBeenCalledWith(
        expect.any(Object) // partnerId computed ref
      );
    });

    it('應該正確傳遞 4 個參數給 useSuggestions', () => {
      useChatCore();

      // 這是關鍵測試！驗證 useSuggestions 收到了所有必要參數
      expect(useSuggestionsMock).toHaveBeenCalledWith(
        expect.any(Object), // messages ref
        expect.any(Object), // partner ref
        expect.any(Object), // firebaseAuth
        expect.any(Object)  // currentUserId computed
      );

      // 驗證沒有 undefined 參數
      const callArgs = useSuggestionsMock.mock.calls[0];
      expect(callArgs).toHaveLength(4);
      expect(callArgs[0]).toBeDefined(); // messages
      expect(callArgs[1]).toBeDefined(); // partner
      expect(callArgs[2]).toBeDefined(); // firebaseAuth
      expect(callArgs[3]).toBeDefined(); // currentUserId
    });
  });

  describe('返回值完整性', () => {
    it('應該返回所有核心狀態', () => {
      const result = useChatCore();

      // Core
      expect(result.user).toBeDefined();
      expect(result.firebaseAuth).toBeDefined();
      expect(result.currentUserId).toBeDefined();

      // Partner
      expect(result.partner).toBeDefined();
      expect(result.partnerId).toBeDefined();

      // Messages
      expect(result.messages).toBeDefined();
      expect(result.isReplying).toBeDefined();

      // Suggestions
      expect(result.suggestionOptions).toBeDefined();
      expect(result.isLoadingSuggestions).toBeDefined();
      expect(result.loadSuggestions).toBeDefined();
      expect(result.invalidateSuggestions).toBeDefined();
    });
  });

  describe('邊界情況', () => {
    it('應該處理空用戶 ID', () => {
      const { useSuggestions } = require('../useSuggestions');
      const { useUserProfile } = require('../../useUserProfile');

      // Mock 空用戶
      (useUserProfile as Mock).mockReturnValueOnce({
        user: ref(null),
        setUserProfile: vi.fn(),
        addConversationHistory: vi.fn(),
      });

      const result = useChatCore();

      // currentUserId 應該是空字符串
      expect(result.currentUserId.value).toBe('');
    });
  });
});
