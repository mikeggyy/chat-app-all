/**
 * useChatActions Composable 測試
 *
 * 測試範圍：
 * - 拍照功能（requestSelfie）
 * - 禮物功能（openGiftSelector, closeGiftSelector, sendGift）
 * - 語音播放功能（playVoice, stopVoice）
 * - 訪客限制檢查
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { ref, nextTick } from 'vue';
import { useChatActions } from './useChatActions.js';
import type { Message, Partner } from '../../types';

// Mock Vue lifecycle hooks to avoid warnings in test environment
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue');
  return {
    ...actual,
    onBeforeUnmount: vi.fn(), // Mock to avoid "no active component instance" warning
  };
});

// Mock dependencies
vi.mock('../../utils/api', () => ({
  apiJson: vi.fn(),
}));

vi.mock('../../utils/conversationCache', () => ({
  writeCachedHistory: vi.fn(),
}));

vi.mock('../../config/gifts', () => ({
  getGiftById: vi.fn((giftId: string) => {
    const gifts: Record<string, any> = {
      'gift-1': { id: 'gift-1', name: '玫瑰', emoji: '🌹', price: 10 },
      'gift-2': { id: 'gift-2', name: '鑽石', emoji: '💎', price: 100 },
    };
    return gifts[giftId] || null;
  }),
}));

vi.mock('../../utils/requestId', () => ({
  generateVoiceRequestId: vi.fn(() => 'voice-req-123'),
  generatePhotoRequestId: vi.fn(() => 'photo-req-123'),
  generateGiftRequestId: vi.fn(() => 'gift-req-123'),
}));

vi.mock('../../utils/requestQueue', () => ({
  giftQueue: {
    enqueue: vi.fn((fn) => fn()),
  },
}));

describe('useChatActions - 聊天操作測試', () => {
  let apiUtils: any;
  let mockParams: any;
  let mockPartner: Partner;
  let mockMessages: Message[];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // 獲取 mock modules
    const api = await import('../../utils/api');
    apiUtils = api;

    // 設置默認 mock 返回值
    (apiUtils.apiJson as Mock).mockResolvedValue({
      success: true,
      data: {},
    });

    // 創建 mock 夥伴
    mockPartner = {
      id: 'char-001',
      display_name: '測試角色',
      background: '測試背景',
      portraitUrl: 'https://example.com/portrait.jpg',
    } as Partner;

    // 創建 mock 消息列表
    mockMessages = [];

    // 創建標準的 mock 參數
    mockParams = {
      messages: ref(mockMessages),
      partner: ref(mockPartner),
      currentUserId: ref('user-123'),
      firebaseAuth: {
        getCurrentUserIdToken: vi.fn(async () => 'mock-token-123'),
      },
      toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
      requireLogin: vi.fn(() => false), // 默認不需要登入（非訪客）
      scrollToBottom: vi.fn(),
      appendCachedHistory: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== 拍照功能測試 ====================

  describe('requestSelfie', () => {
    let mockPhotoLimitChecker: any;

    beforeEach(() => {
      mockPhotoLimitChecker = {
        canGeneratePhoto: vi.fn(async () => ({
          allowed: true,
          used: 5,
          remaining: 15,
          total: 20,
        })),
        fetchPhotoStats: vi.fn(async () => {}),
      };
    });

    it('應該成功請求自拍（完整流程）', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'partner',
        text: '',
        imageUrl: 'https://example.com/selfie.jpg',
        createdAt: new Date().toISOString(),
      };

      (apiUtils.apiJson as Mock).mockResolvedValueOnce({
        success: true,
        data: { message: mockMessage },
      });

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.requestSelfie(mockPhotoLimitChecker);

      expect(result).toEqual(mockMessage);
      expect(mockPhotoLimitChecker.canGeneratePhoto).toHaveBeenCalled();
      expect(apiUtils.apiJson).toHaveBeenCalledWith(
        '/api/ai/generate-selfie',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            characterId: 'char-001',
            requestId: 'photo-req-123',
            usePhotoCard: false,
          }),
        })
      );
      expect(mockPhotoLimitChecker.fetchPhotoStats).toHaveBeenCalled();
      expect(mockParams.messages.value).toContainEqual(mockMessage);
    });

    it('應該在訪客模式下要求登入', async () => {
      mockParams.requireLogin = vi.fn(() => true); // 模擬訪客

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.requestSelfie(mockPhotoLimitChecker);

      expect(result).toBeNull();
      expect(mockParams.requireLogin).toHaveBeenCalledWith({ feature: '請求自拍照片' });
      expect(apiUtils.apiJson).not.toHaveBeenCalled();
    });

    it('應該在限制超出時調用回調', async () => {
      mockPhotoLimitChecker.canGeneratePhoto = vi.fn(async () => ({
        allowed: false,
        used: 20,
        remaining: 0,
        total: 20,
      }));

      const onLimitExceeded = vi.fn();

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.requestSelfie(mockPhotoLimitChecker, onLimitExceeded);

      expect(result).toBeNull();
      expect(onLimitExceeded).toHaveBeenCalledWith(
        expect.objectContaining({
          used: 20,
          remaining: 0,
          total: 20,
        })
      );
      expect(apiUtils.apiJson).not.toHaveBeenCalled();
    });

    it('應該使用照片卡時跳過限制檢查', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'partner',
        imageUrl: 'https://example.com/selfie.jpg',
      };

      (apiUtils.apiJson as Mock).mockResolvedValueOnce({
        success: true,
        data: { message: mockMessage },
      });

      const chatActions = useChatActions(mockParams);
      await chatActions.requestSelfie(mockPhotoLimitChecker, undefined, { usePhotoCard: true });

      expect(mockPhotoLimitChecker.canGeneratePhoto).not.toHaveBeenCalled();
      expect(apiUtils.apiJson).toHaveBeenCalledWith(
        '/api/ai/generate-selfie',
        expect.objectContaining({
          body: expect.objectContaining({
            usePhotoCard: true,
          }),
        })
      );
    });

    it('應該處理 API 錯誤', async () => {
      (apiUtils.apiJson as Mock).mockRejectedValueOnce(new Error('生成失敗'));

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.requestSelfie(mockPhotoLimitChecker);

      expect(result).toBeNull();
      expect(mockParams.toast.error).toHaveBeenCalledWith('生成失敗');
    });

    it('應該防止重複請求', async () => {
      (apiUtils.apiJson as Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: { message: {} } }), 100))
      );

      const chatActions = useChatActions(mockParams);

      // 先啟動第一個請求
      const promise1 = chatActions.requestSelfie(mockPhotoLimitChecker);

      // 等待一小段時間確保第一個請求已設置 isRequestingSelfie 標誌
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 第二個請求應該被阻止
      const promise2 = chatActions.requestSelfie(mockPhotoLimitChecker);

      await Promise.all([promise1, promise2]);

      // 應該只調用一次 API（第二個請求被防重複機制阻止）
      expect(apiUtils.apiJson).toHaveBeenCalledTimes(1);
    });

    it('應該在沒有用戶 ID 時返回 null', async () => {
      mockParams.currentUserId = ref('');

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.requestSelfie(mockPhotoLimitChecker);

      expect(result).toBeNull();
      expect(mockParams.toast.error).toHaveBeenCalledWith('無法請求自拍');
    });

    it('應該在沒有角色 ID 時返回 null', async () => {
      mockParams.partner = ref(null);

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.requestSelfie(mockPhotoLimitChecker);

      expect(result).toBeNull();
      expect(mockParams.toast.error).toHaveBeenCalledWith('無法請求自拍');
    });
  });

  // ==================== 禮物功能測試 ====================

  describe('openGiftSelector / closeGiftSelector', () => {
    it('應該成功打開禮物選擇器', async () => {
      const loadUserAssets = vi.fn(async () => {});

      const chatActions = useChatActions(mockParams);
      await chatActions.openGiftSelector(loadUserAssets);

      expect(chatActions.showGiftSelector.value).toBe(true);
      expect(loadUserAssets).toHaveBeenCalledWith('user-123');
    });

    it('應該在訪客模式下要求登入', async () => {
      mockParams.requireLogin = vi.fn(() => true);

      const chatActions = useChatActions(mockParams);
      await chatActions.openGiftSelector();

      expect(chatActions.showGiftSelector.value).toBe(false);
      expect(mockParams.requireLogin).toHaveBeenCalledWith({ feature: '送禮物' });
    });

    it('應該在沒有用戶 ID 時顯示錯誤', async () => {
      mockParams.currentUserId = ref('');

      const chatActions = useChatActions(mockParams);
      await chatActions.openGiftSelector();

      expect(chatActions.showGiftSelector.value).toBe(false);
      expect(mockParams.toast.error).toHaveBeenCalledWith('無法打開禮物選擇器');
    });

    it('應該成功關閉禮物選擇器', async () => {
      const chatActions = useChatActions(mockParams);
      await chatActions.openGiftSelector();
      expect(chatActions.showGiftSelector.value).toBe(true);

      chatActions.closeGiftSelector();
      expect(chatActions.showGiftSelector.value).toBe(false);
    });
  });

  describe('sendGift', () => {
    it('應該成功發送禮物（完整流程）', async () => {
      const giftData = { giftId: 'gift-1' };
      const mockGiftResponse = {
        success: true,
        thankYouMessage: {
          id: 'msg-thanks',
          role: 'partner',
          text: '謝謝你的禮物！',
        },
        photoMessage: {
          id: 'msg-photo',
          role: 'partner',
          imageUrl: 'https://example.com/gift-photo.jpg',
        },
      };

      // Mock 禮物發送 API
      (apiUtils.apiJson as Mock)
        .mockResolvedValueOnce({ success: true }) // 發送禮物
        .mockResolvedValueOnce({ messages: [] }) // 保存禮物消息
        .mockResolvedValueOnce({ data: mockGiftResponse }); // 禮物回應

      const onSuccess = vi.fn();

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.sendGift(giftData, onSuccess);

      expect(result).toBe(true);
      expect(chatActions.isSendingGift.value).toBe(false);
      expect(onSuccess).toHaveBeenCalled();
      expect(mockParams.messages.value.length).toBeGreaterThan(0);
    });

    it('應該在沒有用戶 ID 時返回 false', async () => {
      mockParams.currentUserId = ref('');

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.sendGift({ giftId: 'gift-1' });

      expect(result).toBe(false);
      expect(mockParams.toast.error).toHaveBeenCalledWith('無法送出禮物');
    });

    it('應該在沒有角色 ID 時返回 false', async () => {
      mockParams.partner = ref(null);

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.sendGift({ giftId: 'gift-1' });

      expect(result).toBe(false);
      expect(mockParams.toast.error).toHaveBeenCalledWith('無法送出禮物');
    });

    it('應該防止重複發送', async () => {
      (apiUtils.apiJson as Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      const chatActions = useChatActions(mockParams);

      const promise1 = chatActions.sendGift({ giftId: 'gift-1' });
      const promise2 = chatActions.sendGift({ giftId: 'gift-1' });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // 第一次調用應該成功，第二次調用應該返回 false（被隊列阻止）
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('應該處理找不到禮物的情況', async () => {
      const chatActions = useChatActions(mockParams);
      const result = await chatActions.sendGift({ giftId: 'invalid-gift' });

      expect(result).toBe(false);
      expect(mockParams.toast.error).toHaveBeenCalledWith('找不到禮物資料');
    });

    it('應該處理發送失敗的情況', async () => {
      (apiUtils.apiJson as Mock).mockResolvedValueOnce({ success: false, message: '金幣不足' });

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.sendGift({ giftId: 'gift-1' });

      expect(result).toBe(false);
      expect(mockParams.toast.error).toHaveBeenCalledWith('金幣不足');
    });
  });

  // ==================== 語音播放功能測試 ====================

  describe('playVoice / stopVoice', () => {
    let mockVoiceLimitChecker: any;
    let mockMessage: Message;
    let mockFetch: Mock;

    beforeEach(() => {
      mockVoiceLimitChecker = {
        checkVoiceLimit: vi.fn(async () => ({
          allowed: true,
          used: 5,
          total: 20,
        })),
        loadVoiceStats: vi.fn(async () => {}),
      };

      mockMessage = {
        id: 'msg-voice-123',
        role: 'partner',
        text: '你好，這是測試語音',
        createdAt: new Date().toISOString(),
      };

      // Mock environment variable
      vi.stubEnv('VITE_API_URL', 'http://localhost:4000');

      // Mock document.cookie for CSRF token
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '_csrf=mock-csrf-token-123',
      });

      // Mock fetch for TTS API
      mockFetch = vi.fn();
      global.fetch = mockFetch;

      // Mock Audio with proper function implementation (not arrow function)
      global.Audio = vi.fn(function (this: any, src?: string) {
        this.src = src || '';
        this.play = vi.fn(async () => Promise.resolve());
        this.pause = vi.fn();
        this.onended = null;
        this.onerror = null;
        this.currentTime = 0;
        return this;
      }) as any;

      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-audio-url');
      global.URL.revokeObjectURL = vi.fn();

      // Mock Blob
      mockFetch.mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['audio-data'], { type: 'audio/mp3' }),
      });
    });

    it('應該成功播放語音（完整流程）', async () => {
      const chatActions = useChatActions(mockParams);
      const result = await chatActions.playVoice(mockMessage, mockVoiceLimitChecker);

      expect(result).toBe(true);
      expect(chatActions.playingVoiceMessageId.value).toBe('msg-voice-123');
      expect(mockVoiceLimitChecker.checkVoiceLimit).toHaveBeenCalledWith('user-123', 'char-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/tts'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('你好，這是測試語音'),
        })
      );
      expect(mockVoiceLimitChecker.loadVoiceStats).toHaveBeenCalledWith('user-123');
    });

    it('應該在訪客模式下要求登入', async () => {
      mockParams.requireLogin = vi.fn(() => true);

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.playVoice(mockMessage, mockVoiceLimitChecker);

      expect(result).toBe(false);
      expect(mockParams.requireLogin).toHaveBeenCalledWith({ feature: '語音播放' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('應該在限制超出時調用回調', async () => {
      mockVoiceLimitChecker.checkVoiceLimit = vi.fn(async () => ({
        allowed: false,
        used: 20,
        total: 20,
      }));

      const onLimitExceeded = vi.fn();

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.playVoice(mockMessage, mockVoiceLimitChecker, onLimitExceeded);

      expect(result).toBe(false);
      expect(onLimitExceeded).toHaveBeenCalledWith(
        expect.objectContaining({
          characterName: '測試角色',
          usedVoices: 20,
          totalVoices: 20,
        })
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('應該使用語音解鎖卡時跳過限制檢查', async () => {
      const chatActions = useChatActions(mockParams);
      await chatActions.playVoice(mockMessage, mockVoiceLimitChecker, undefined, undefined, {
        useVoiceUnlockCard: true,
      });

      expect(mockVoiceLimitChecker.checkVoiceLimit).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('useVoiceUnlockCard'),
        })
      );
    });

    it('應該防止重複播放同一消息', async () => {
      const chatActions = useChatActions(mockParams);

      // 先啟動第一個播放
      const promise1 = chatActions.playVoice(mockMessage, mockVoiceLimitChecker);

      // 等待一小段時間確保第一個請求已設置 playingVoiceMessageId
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 第二個播放同一消息應該被阻止
      const promise2 = chatActions.playVoice(mockMessage, mockVoiceLimitChecker);

      await Promise.all([promise1, promise2]);

      // 應該只調用一次 fetch（第二個請求被防重複機制阻止）
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('應該在消息文本為空時返回 false', async () => {
      const emptyMessage = { ...mockMessage, text: '' };

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.playVoice(emptyMessage, mockVoiceLimitChecker);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('應該處理 API 錯誤', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const chatActions = useChatActions(mockParams);
      const result = await chatActions.playVoice(mockMessage, mockVoiceLimitChecker);

      expect(result).toBe(false);
      expect(mockParams.toast.error).toHaveBeenCalledWith('語音生成失敗');
    });

    it('應該成功停止語音播放', async () => {
      const chatActions = useChatActions(mockParams);
      await chatActions.playVoice(mockMessage, mockVoiceLimitChecker);

      expect(chatActions.playingVoiceMessageId.value).toBe('msg-voice-123');

      chatActions.stopVoice();

      expect(chatActions.playingVoiceMessageId.value).toBeNull();
    });
  });

  // ==================== API 暴露測試 ====================

  describe('返回的 API', () => {
    it('應該暴露所有必要的屬性和方法', () => {
      const chatActions = useChatActions(mockParams);

      // 拍照相關
      expect(chatActions.isRequestingSelfie).toBeDefined();
      expect(chatActions.requestSelfie).toBeDefined();

      // 禮物相關
      expect(chatActions.showGiftSelector).toBeDefined();
      expect(chatActions.isSendingGift).toBeDefined();
      expect(chatActions.openGiftSelector).toBeDefined();
      expect(chatActions.closeGiftSelector).toBeDefined();
      expect(chatActions.sendGift).toBeDefined();

      // 語音相關
      expect(chatActions.playingVoiceMessageId).toBeDefined();
      expect(chatActions.playVoice).toBeDefined();
      expect(chatActions.stopVoice).toBeDefined();
    });
  });
});
