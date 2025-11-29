/**
 * usePartner 測試
 * 測試角色加載和數據管理功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { computed, nextTick } from 'vue';
import { usePartner } from './usePartner';
import type { Partner } from '../../types';

// Mock dependencies
vi.mock('../../utils/api', () => ({
  apiJson: vi.fn(),
}));

vi.mock('../../services/apiCache.service', () => ({
  apiCache: {
    fetch: vi.fn(),
  },
  cacheKeys: {
    character: (id: string) => `character:${id}`,
  },
  cacheTTL: {
    CHARACTER: 600000, // 10 minutes
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../utils/matchFallback', () => ({
  fallbackMatches: [
    {
      id: 'fallback-001',
      display_name: 'Fallback 角色',
      background: 'Fallback 背景',
      portraitUrl: 'https://example.com/fallback.jpg',
    },
  ],
}));

describe('usePartner', () => {
  let mockApiJson: any;
  let mockApiCache: any;

  beforeEach(async () => {
    const { apiJson } = await import('../../utils/api');
    const { apiCache } = await import('../../services/apiCache.service');

    mockApiJson = apiJson as any;
    mockApiCache = apiCache as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // loadPartner - 成功加載測試
  // ==========================================

  describe('loadPartner - 成功加載', () => {
    it('應該成功從 API 加載角色數據', async () => {
      const mockCharacter: Partner = {
        id: 'char-001',
        display_name: '測試角色',
        background: '這是測試角色的背景',
        portraitUrl: 'https://example.com/portrait.jpg',
      } as Partner;

      mockApiCache.fetch.mockResolvedValueOnce(mockCharacter);

      const partnerId = computed(() => 'char-001');
      const { partner, loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');

      expect(partner.value).toEqual(mockCharacter);
      expect(mockApiCache.fetch).toHaveBeenCalledWith(
        'character:char-001',
        expect.any(Function),
        600000
      );
    });

    it('應該使用緩存避免重複請求', async () => {
      const mockCharacter: Partner = {
        id: 'char-001',
        display_name: '測試角色',
      } as Partner;

      mockApiCache.fetch.mockResolvedValueOnce(mockCharacter);

      const partnerId = computed(() => 'char-001');
      const { loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');
      await loadPartner('char-001'); // 第二次調用

      // apiCache.fetch 應該被調用兩次（緩存邏輯在 apiCache.fetch 內部處理）
      expect(mockApiCache.fetch).toHaveBeenCalledTimes(2);
    });

    it('應該正確調用 API 端點', async () => {
      const mockCharacter: Partner = {
        id: 'char-001',
        display_name: '測試角色',
      } as Partner;

      mockApiJson.mockResolvedValueOnce({ character: mockCharacter });

      // 獲取緩存回調函數並執行
      mockApiCache.fetch.mockImplementation(async (_key: string, fetchFn: () => Promise<Partner>) => {
        return await fetchFn();
      });

      const partnerId = computed(() => 'char-001');
      const { loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');

      expect(mockApiJson).toHaveBeenCalledWith('/match/char-001', {
        skipGlobalLoading: true,
      });
    });

    it('應該處理特殊字符的 characterId', async () => {
      const mockCharacter: Partner = {
        id: 'char-001/special',
        display_name: '特殊角色',
      } as Partner;

      mockApiJson.mockResolvedValueOnce({ character: mockCharacter });

      mockApiCache.fetch.mockImplementation(async (_key: string, fetchFn: () => Promise<Partner>) => {
        return await fetchFn();
      });

      const partnerId = computed(() => 'char-001/special');
      const { loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001/special');

      expect(mockApiJson).toHaveBeenCalledWith('/match/char-001%2Fspecial', {
        skipGlobalLoading: true,
      });
    });
  });

  // ==========================================
  // loadPartner - 錯誤處理測試
  // ==========================================

  describe('loadPartner - 錯誤處理', () => {
    it('應該在 API 失敗時使用 fallback 數據', async () => {
      mockApiCache.fetch.mockRejectedValueOnce(new Error('API 錯誤'));

      const partnerId = computed(() => 'fallback-001');
      const { partner, loadPartner } = usePartner({ partnerId });

      await loadPartner('fallback-001');

      expect(partner.value).toEqual({
        id: 'fallback-001',
        display_name: 'Fallback 角色',
        background: 'Fallback 背景',
        portraitUrl: 'https://example.com/fallback.jpg',
      });
    });

    it('應該在找不到 fallback 時設置為 null', async () => {
      mockApiCache.fetch.mockRejectedValueOnce(new Error('API 錯誤'));

      const partnerId = computed(() => 'non-existent');
      const { partner, loadPartner } = usePartner({ partnerId });

      await loadPartner('non-existent');

      expect(partner.value).toBeNull();
    });

    it('應該記錄錯誤日誌', async () => {
      const { logger } = await import('../../utils/logger');
      const error = new Error('API 錯誤');

      mockApiCache.fetch.mockRejectedValueOnce(error);

      const partnerId = computed(() => 'char-001');
      const { loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');

      expect(logger.error).toHaveBeenCalledWith('載入角色失敗:', error);
    });
  });

  // ==========================================
  // loadPartner - 邊界情況測試
  // ==========================================

  describe('loadPartner - 邊界情況', () => {
    it('應該在 characterId 為空字符串時設置 partner 為 null', async () => {
      const partnerId = computed(() => '');
      const { partner, loadPartner } = usePartner({ partnerId });

      await loadPartner('');

      expect(partner.value).toBeNull();
      expect(mockApiCache.fetch).not.toHaveBeenCalled();
    });

    it('應該處理 API 返回 null', async () => {
      mockApiJson.mockResolvedValueOnce({ character: null });

      mockApiCache.fetch.mockImplementation(async (_key: string, fetchFn: () => Promise<Partner>) => {
        return await fetchFn();
      });

      const partnerId = computed(() => 'char-001');
      const { partner, loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');

      expect(partner.value).toBeNull();
    });

    it('應該處理 API 返回沒有 character 字段', async () => {
      mockApiJson.mockResolvedValueOnce({});

      mockApiCache.fetch.mockImplementation(async (_key: string, fetchFn: () => Promise<Partner>) => {
        return await fetchFn();
      });

      const partnerId = computed(() => 'char-001');
      const { partner, loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');

      expect(partner.value).toBeNull();
    });
  });

  // ==========================================
  // Computed Properties 測試
  // ==========================================

  describe('Computed Properties', () => {
    it('partnerDisplayName 應該返回角色名稱', async () => {
      const mockCharacter: Partner = {
        id: 'char-001',
        display_name: '測試角色',
      } as Partner;

      mockApiCache.fetch.mockResolvedValueOnce(mockCharacter);

      const partnerId = computed(() => 'char-001');
      const { partnerDisplayName, loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');
      await nextTick();

      expect(partnerDisplayName.value).toBe('測試角色');
    });

    it('partnerDisplayName 應該在沒有角色時返回 "未知角色"', () => {
      const partnerId = computed(() => 'char-001');
      const { partnerDisplayName } = usePartner({ partnerId });

      expect(partnerDisplayName.value).toBe('未知角色');
    });

    it('partnerBackground 應該返回角色背景', async () => {
      const mockCharacter: Partner = {
        id: 'char-001',
        display_name: '測試角色',
        background: '這是測試角色的背景故事',
      } as Partner;

      mockApiCache.fetch.mockResolvedValueOnce(mockCharacter);

      const partnerId = computed(() => 'char-001');
      const { partnerBackground, loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');
      await nextTick();

      expect(partnerBackground.value).toBe('這是測試角色的背景故事');
    });

    it('partnerBackground 應該在沒有背景時返回空字符串', () => {
      const partnerId = computed(() => 'char-001');
      const { partnerBackground } = usePartner({ partnerId });

      expect(partnerBackground.value).toBe('');
    });

    it('backgroundStyle 應該返回背景圖片樣式', async () => {
      const mockCharacter: Partner = {
        id: 'char-001',
        display_name: '測試角色',
        portraitUrl: 'https://example.com/portrait.jpg',
      } as Partner;

      mockApiCache.fetch.mockResolvedValueOnce(mockCharacter);

      const partnerId = computed(() => 'char-001');
      const { backgroundStyle, loadPartner } = usePartner({ partnerId });

      await loadPartner('char-001');
      await nextTick();

      expect(backgroundStyle.value).toEqual({
        backgroundImage: 'url(https://example.com/portrait.jpg)',
      });
    });

    it('backgroundStyle 應該在沒有 portraitUrl 時返回空對象', () => {
      const partnerId = computed(() => 'char-001');
      const { backgroundStyle } = usePartner({ partnerId });

      expect(backgroundStyle.value).toEqual({});
    });

    it('Computed properties 應該響應 partner 變化', async () => {
      const mockCharacter1: Partner = {
        id: 'char-001',
        display_name: '角色 1',
        background: '背景 1',
        portraitUrl: 'https://example.com/1.jpg',
      } as Partner;

      const mockCharacter2: Partner = {
        id: 'char-002',
        display_name: '角色 2',
        background: '背景 2',
        portraitUrl: 'https://example.com/2.jpg',
      } as Partner;

      mockApiCache.fetch
        .mockResolvedValueOnce(mockCharacter1)
        .mockResolvedValueOnce(mockCharacter2);

      const partnerId = computed(() => 'char-001');
      const { partnerDisplayName, partnerBackground, backgroundStyle, loadPartner } =
        usePartner({ partnerId });

      // 加載第一個角色
      await loadPartner('char-001');
      await nextTick();

      expect(partnerDisplayName.value).toBe('角色 1');
      expect(partnerBackground.value).toBe('背景 1');
      expect(backgroundStyle.value).toEqual({
        backgroundImage: 'url(https://example.com/1.jpg)',
      });

      // 加載第二個角色
      await loadPartner('char-002');
      await nextTick();

      expect(partnerDisplayName.value).toBe('角色 2');
      expect(partnerBackground.value).toBe('背景 2');
      expect(backgroundStyle.value).toEqual({
        backgroundImage: 'url(https://example.com/2.jpg)',
      });
    });
  });

  // ==========================================
  // API 暴露測試
  // ==========================================

  describe('API 暴露', () => {
    it('應該返回所有必需的屬性和方法', () => {
      const partnerId = computed(() => 'char-001');
      const result = usePartner({ partnerId });

      expect(result).toHaveProperty('partner');
      expect(result).toHaveProperty('partnerDisplayName');
      expect(result).toHaveProperty('partnerBackground');
      expect(result).toHaveProperty('backgroundStyle');
      expect(result).toHaveProperty('loadPartner');
      expect(typeof result.loadPartner).toBe('function');
    });

    it('應該正確暴露類型接口', () => {
      const partnerId = computed(() => 'char-001');
      const result = usePartner({ partnerId });

      // TypeScript 類型檢查（編譯時驗證）
      const _typeCheck: {
        partner: any;
        partnerDisplayName: any;
        partnerBackground: any;
        backgroundStyle: any;
        loadPartner: (characterId: string) => Promise<void>;
      } = result;

      expect(_typeCheck).toBeDefined();
    });
  });
});
