/**
 * useEventHandlers 測試
 * 測試事件處理器包裝函數
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEventHandlers } from './useEventHandlers';
import type { UseEventHandlersParams } from './useEventHandlers';

describe('useEventHandlers', () => {
  let mockParams: UseEventHandlersParams;

  beforeEach(() => {
    mockParams = {
      // Modal functions
      showImageViewer: vi.fn(),
      showBuffDetails: vi.fn(),

      // Navigation
      router: {
        back: vi.fn(),
      } as any,

      // Voice
      watchVoiceAd: vi.fn(async () => {}),
      getCurrentUserId: vi.fn(() => 'user-123'),
      getPartnerId: vi.fn(() => 'char-001'),

      // Suggestions
      loadSuggestions: vi.fn(async () => {}),
      handleSendMessage: vi.fn(async () => {}),
    };

    vi.clearAllMocks();
  });

  // ==========================================
  // handleImageClick 測試
  // ==========================================

  describe('handleImageClick', () => {
    it('應該調用 showImageViewer 並傳遞正確的參數', () => {
      const { handleImageClick } = useEventHandlers(mockParams);

      handleImageClick({ url: 'https://example.com/image.jpg', alt: '測試圖片' });

      expect(mockParams.showImageViewer).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        '測試圖片'
      );
    });

    it('應該處理沒有 alt 參數的情況', () => {
      const { handleImageClick } = useEventHandlers(mockParams);

      handleImageClick({ url: 'https://example.com/image.jpg' });

      expect(mockParams.showImageViewer).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        undefined
      );
    });

    it('應該處理空字符串 URL', () => {
      const { handleImageClick } = useEventHandlers(mockParams);

      handleImageClick({ url: '' });

      expect(mockParams.showImageViewer).toHaveBeenCalledWith('', undefined);
    });

    it('應該處理特殊字符的 URL', () => {
      const { handleImageClick } = useEventHandlers(mockParams);

      handleImageClick({
        url: 'https://example.com/image?id=123&token=abc',
        alt: '特殊 URL',
      });

      expect(mockParams.showImageViewer).toHaveBeenCalledWith(
        'https://example.com/image?id=123&token=abc',
        '特殊 URL'
      );
    });
  });

  // ==========================================
  // handleViewBuffDetails 測試
  // ==========================================

  describe('handleViewBuffDetails', () => {
    it('應該調用 showBuffDetails 並傳遞正確的 buffType', () => {
      const { handleViewBuffDetails } = useEventHandlers(mockParams);

      handleViewBuffDetails('memory_boost');

      expect(mockParams.showBuffDetails).toHaveBeenCalledWith('memory_boost');
    });

    it('應該處理不同的 buffType', () => {
      const { handleViewBuffDetails } = useEventHandlers(mockParams);

      handleViewBuffDetails('brain_boost');

      expect(mockParams.showBuffDetails).toHaveBeenCalledWith('brain_boost');
    });

    it('應該處理空字符串 buffType', () => {
      const { handleViewBuffDetails } = useEventHandlers(mockParams);

      handleViewBuffDetails('');

      expect(mockParams.showBuffDetails).toHaveBeenCalledWith('');
    });
  });

  // ==========================================
  // handleBack 測試
  // ==========================================

  describe('handleBack', () => {
    it('應該調用 router.back()', () => {
      const { handleBack } = useEventHandlers(mockParams);

      handleBack();

      expect(mockParams.router.back).toHaveBeenCalled();
    });

    it('應該只調用一次 router.back()', () => {
      const { handleBack } = useEventHandlers(mockParams);

      handleBack();

      expect(mockParams.router.back).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // handleWatchVoiceAd 測試
  // ==========================================

  describe('handleWatchVoiceAd', () => {
    it('應該調用 watchVoiceAd 並傳遞正確的參數', async () => {
      const { handleWatchVoiceAd } = useEventHandlers(mockParams);

      await handleWatchVoiceAd();

      expect(mockParams.watchVoiceAd).toHaveBeenCalledWith('user-123', 'char-001');
    });

    it('應該從 getCurrentUserId 和 getPartnerId 獲取參數', async () => {
      const { handleWatchVoiceAd } = useEventHandlers(mockParams);

      await handleWatchVoiceAd();

      expect(mockParams.getCurrentUserId).toHaveBeenCalled();
      expect(mockParams.getPartnerId).toHaveBeenCalled();
    });

    it('應該等待 watchVoiceAd 完成', async () => {
      let resolved = false;
      mockParams.watchVoiceAd = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      });

      const { handleWatchVoiceAd } = useEventHandlers(mockParams);

      await handleWatchVoiceAd();

      expect(resolved).toBe(true);
    });

    it('應該處理 watchVoiceAd 拋出的錯誤', async () => {
      mockParams.watchVoiceAd = vi.fn(async () => {
        throw new Error('廣告加載失敗');
      });

      const { handleWatchVoiceAd } = useEventHandlers(mockParams);

      await expect(handleWatchVoiceAd()).rejects.toThrow('廣告加載失敗');
    });
  });

  // ==========================================
  // handleSuggestionClick 測試
  // ==========================================

  describe('handleSuggestionClick', () => {
    it('應該調用 handleSendMessage 並傳遞建議文本', async () => {
      const { handleSuggestionClick } = useEventHandlers(mockParams);

      await handleSuggestionClick('你好嗎？');

      expect(mockParams.handleSendMessage).toHaveBeenCalledWith('你好嗎？');
    });

    it('應該修剪建議文本的空白字符', async () => {
      const { handleSuggestionClick } = useEventHandlers(mockParams);

      await handleSuggestionClick('  你好嗎？  ');

      expect(mockParams.handleSendMessage).toHaveBeenCalledWith('你好嗎？');
    });

    it('應該在建議為空字符串時不調用 handleSendMessage', async () => {
      const { handleSuggestionClick } = useEventHandlers(mockParams);

      await handleSuggestionClick('');

      expect(mockParams.handleSendMessage).not.toHaveBeenCalled();
    });

    it('應該在建議只包含空白字符時不調用 handleSendMessage', async () => {
      const { handleSuggestionClick } = useEventHandlers(mockParams);

      await handleSuggestionClick('   ');

      expect(mockParams.handleSendMessage).not.toHaveBeenCalled();
    });

    it('應該等待 handleSendMessage 完成', async () => {
      let resolved = false;
      mockParams.handleSendMessage = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      });

      const { handleSuggestionClick } = useEventHandlers(mockParams);

      await handleSuggestionClick('測試消息');

      expect(resolved).toBe(true);
    });

    it('應該處理 handleSendMessage 拋出的錯誤', async () => {
      mockParams.handleSendMessage = vi.fn(async () => {
        throw new Error('發送失敗');
      });

      const { handleSuggestionClick } = useEventHandlers(mockParams);

      await expect(handleSuggestionClick('測試消息')).rejects.toThrow('發送失敗');
    });

    it('應該處理包含特殊字符的建議', async () => {
      const { handleSuggestionClick } = useEventHandlers(mockParams);

      await handleSuggestionClick('你好！😊');

      expect(mockParams.handleSendMessage).toHaveBeenCalledWith('你好！😊');
    });
  });

  // ==========================================
  // handleRequestSuggestions 測試
  // ==========================================

  describe('handleRequestSuggestions', () => {
    it('應該調用 loadSuggestions', async () => {
      const { handleRequestSuggestions } = useEventHandlers(mockParams);

      await handleRequestSuggestions();

      expect(mockParams.loadSuggestions).toHaveBeenCalled();
    });

    it('應該等待 loadSuggestions 完成', async () => {
      let resolved = false;
      mockParams.loadSuggestions = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      });

      const { handleRequestSuggestions } = useEventHandlers(mockParams);

      await handleRequestSuggestions();

      expect(resolved).toBe(true);
    });

    it('應該處理 loadSuggestions 拋出的錯誤', async () => {
      mockParams.loadSuggestions = vi.fn(async () => {
        throw new Error('加載建議失敗');
      });

      const { handleRequestSuggestions } = useEventHandlers(mockParams);

      await expect(handleRequestSuggestions()).rejects.toThrow('加載建議失敗');
    });
  });

  // ==========================================
  // API 暴露測試
  // ==========================================

  describe('API 暴露', () => {
    it('應該返回所有事件處理函數', () => {
      const result = useEventHandlers(mockParams);

      expect(result).toHaveProperty('handleImageClick');
      expect(result).toHaveProperty('handleViewBuffDetails');
      expect(result).toHaveProperty('handleBack');
      expect(result).toHaveProperty('handleWatchVoiceAd');
      expect(result).toHaveProperty('handleSuggestionClick');
      expect(result).toHaveProperty('handleRequestSuggestions');

      expect(typeof result.handleImageClick).toBe('function');
      expect(typeof result.handleViewBuffDetails).toBe('function');
      expect(typeof result.handleBack).toBe('function');
      expect(typeof result.handleWatchVoiceAd).toBe('function');
      expect(typeof result.handleSuggestionClick).toBe('function');
      expect(typeof result.handleRequestSuggestions).toBe('function');
    });

    it('應該正確暴露類型接口', () => {
      const result = useEventHandlers(mockParams);

      // TypeScript 類型檢查（編譯時驗證）
      const _typeCheck: {
        handleImageClick: (params: { url: string; alt?: string }) => void;
        handleViewBuffDetails: (buffType: string) => void;
        handleBack: () => void;
        handleWatchVoiceAd: () => Promise<void>;
        handleSuggestionClick: (suggestion: string) => Promise<void>;
        handleRequestSuggestions: () => Promise<void>;
      } = result;

      expect(_typeCheck).toBeDefined();
    });
  });

  // ==========================================
  // 集成測試
  // ==========================================

  describe('集成測試', () => {
    it('應該正確處理完整的建議點擊流程', async () => {
      const { handleSuggestionClick } = useEventHandlers(mockParams);

      await handleSuggestionClick('  這是一個建議  ');

      expect(mockParams.handleSendMessage).toHaveBeenCalledWith('這是一個建議');
      expect(mockParams.handleSendMessage).toHaveBeenCalledTimes(1);
    });

    it('應該正確處理完整的語音廣告流程', async () => {
      const { handleWatchVoiceAd } = useEventHandlers(mockParams);

      await handleWatchVoiceAd();

      expect(mockParams.getCurrentUserId).toHaveBeenCalled();
      expect(mockParams.getPartnerId).toHaveBeenCalled();
      expect(mockParams.watchVoiceAd).toHaveBeenCalledWith('user-123', 'char-001');
    });

    it('應該正確處理完整的圖片點擊流程', () => {
      const { handleImageClick } = useEventHandlers(mockParams);

      handleImageClick({ url: 'https://example.com/photo.jpg', alt: '照片' });

      expect(mockParams.showImageViewer).toHaveBeenCalledWith(
        'https://example.com/photo.jpg',
        '照片'
      );
    });
  });
});
