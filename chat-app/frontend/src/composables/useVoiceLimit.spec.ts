/**
 * useVoiceLimit Composable 測試
 *
 * 測試範圍：
 * - 語音限制檢查
 * - 語音使用統計載入
 * - 廣告解鎖功能
 * - 本地狀態檢查
 * - Computed 屬性
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { nextTick } from 'vue';

// Mock dependencies
vi.mock('../utils/api', () => ({
  apiJson: vi.fn(),
}));

vi.mock('./useBaseLimitService.js', () => ({
  createLimitService: vi.fn((config: any) => {
    const limitData = { value: {} as Record<string, any> };
    const isLoading = { value: false };
    const error = { value: null };

    return {
      limitData,
      isLoading,
      error,
      checkLimit: vi.fn(async (userId: string, characterId: string) => {
        const key = characterId;
        limitData.value[key] = {
          allowed: true,  // 修復：使用 allowed 而非 canPlay
          remaining: 10,
          limit: 20,
        };
        return limitData.value[key];
      }),
      getStats: vi.fn(async () => {
        limitData.value['char-001'] = {
          allowed: true,  // 修復：使用 allowed 而非 canPlay
          remaining: 5,
          limit: 20,
        };
        limitData.value['char-002'] = {
          allowed: false,  // 修復：使用 allowed 而非 canPlay
          remaining: 0,
          limit: 20,
        };
      }),
      unlockByAd: vi.fn(async () => ({ success: true })),
      clearState: vi.fn(() => {
        limitData.value = {};
      }),
    };
  }),
}));

describe('useVoiceLimit - 語音限制測試', () => {
  let useVoiceLimit: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const { useVoiceLimit: composable } = await import('./useVoiceLimit.js');
    useVoiceLimit = composable;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始狀態', () => {
    it('應該初始化為空狀態', () => {
      const voiceLimit = useVoiceLimit();

      expect(voiceLimit.voiceStats.value).toEqual({});
      expect(voiceLimit.isLoading.value).toBe(false);
      expect(voiceLimit.error.value).toBeNull();
    });
  });

  describe('checkVoiceLimit', () => {
    it('應該成功檢查語音限制', async () => {
      const voiceLimit = useVoiceLimit();

      const result = await voiceLimit.checkVoiceLimit('user-123', 'char-001');

      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);  // 修復：使用 allowed 而非 canPlay
      expect(result.remaining).toBe(10);
      expect(result.limit).toBe(20);
    });

    it('應該按角色儲存語音限制狀態', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.checkVoiceLimit('user-123', 'char-001');
      await voiceLimit.checkVoiceLimit('user-123', 'char-002');

      expect(voiceLimit.voiceStats.value['char-001']).toBeDefined();
      expect(voiceLimit.voiceStats.value['char-002']).toBeDefined();
    });

    it('應該支持傳遞選項參數', async () => {
      const voiceLimit = useVoiceLimit();
      const options = { skipGlobalLoading: true };

      const result = await voiceLimit.checkVoiceLimit('user-123', 'char-001', options);

      expect(result).toBeDefined();
    });
  });

  describe('loadVoiceStats', () => {
    it('應該成功載入語音使用統計', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');

      expect(voiceLimit.voiceStats.value['char-001']).toBeDefined();
      expect(voiceLimit.voiceStats.value['char-001'].allowed).toBe(true);  // 修復：使用 allowed 而非 canPlay
      expect(voiceLimit.voiceStats.value['char-001'].remaining).toBe(5);
    });

    it('應該載入多個角色的統計數據', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');

      expect(voiceLimit.voiceStats.value['char-001']).toBeDefined();
      expect(voiceLimit.voiceStats.value['char-002']).toBeDefined();
      expect(voiceLimit.voiceStats.value['char-002'].allowed).toBe(false);  // 修復：使用 allowed 而非 canPlay
    });

    it('應該支持選項參數', async () => {
      const voiceLimit = useVoiceLimit();
      const options = { skipGlobalLoading: true };

      await voiceLimit.loadVoiceStats('user-123', options);

      expect(voiceLimit.voiceStats.value['char-001']).toBeDefined();
    });

    it('應該允許不傳入 userId（向後兼容）', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats();

      expect(voiceLimit.voiceStats.value['char-001']).toBeDefined();
    });
  });

  describe('unlockByAd', () => {
    it('應該成功通過廣告解鎖語音', async () => {
      const voiceLimit = useVoiceLimit();

      const result = await voiceLimit.unlockByAd('user-123', 'char-001');

      expect(result.success).toBe(true);
    });
  });

  describe('getCharacterVoiceStatus', () => {
    it('應該返回特定角色的語音狀態（computed）', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');
      const status = voiceLimit.getCharacterVoiceStatus('char-001');

      await nextTick();
      expect(status.value).toBeDefined();
      expect(status.value.allowed).toBe(true);  // 修復：使用 allowed 而非 canPlay
      expect(status.value.remaining).toBe(5);
    });

    it('應該在沒有狀態時返回 null', () => {
      const voiceLimit = useVoiceLimit();

      const status = voiceLimit.getCharacterVoiceStatus('char-999');

      expect(status.value).toBeNull();
    });

    it('應該響應狀態變化', async () => {
      const voiceLimit = useVoiceLimit();

      const status = voiceLimit.getCharacterVoiceStatus('char-001');
      expect(status.value).toBeNull();

      await voiceLimit.loadVoiceStats('user-123');
      await nextTick();

      // 重新獲取 computed，因為狀態已更新
      const updatedStatus = voiceLimit.getCharacterVoiceStatus('char-001');
      expect(updatedStatus.value).toBeDefined();
      expect(updatedStatus.value.remaining).toBe(5);
    });
  });

  describe('canPlayLocally', () => {
    it('應該在有剩餘次數時返回 true', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');
      const canPlay = voiceLimit.canPlayLocally('char-001');

      await nextTick();
      expect(canPlay.value).toBe(true);
    });

    it('應該在無剩餘次數時返回 false', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');
      const canPlay = voiceLimit.canPlayLocally('char-002');

      await nextTick();
      expect(canPlay.value).toBe(false);
    });

    it('應該在尚未載入時返回 true（預設允許，後端會驗證）', () => {
      const voiceLimit = useVoiceLimit();

      const canPlay = voiceLimit.canPlayLocally('char-999');

      expect(canPlay.value).toBe(true);
    });

    it('應該在 remaining 為 -1 時返回 true（無限次數）', async () => {
      const voiceLimit = useVoiceLimit();

      // 手動設置無限次數狀態
      voiceLimit.voiceStats.value['char-vip'] = {
        allowed: true,  // 修復：使用 allowed 而非 canPlay
        remaining: -1,
        limit: -1,
      };

      const canPlay = voiceLimit.canPlayLocally('char-vip');

      await nextTick();
      expect(canPlay.value).toBe(true);
    });

    it('應該響應狀態變化', async () => {
      const voiceLimit = useVoiceLimit();

      const canPlay = voiceLimit.canPlayLocally('char-001');
      expect(canPlay.value).toBe(true); // 尚未載入，預設允許

      await voiceLimit.loadVoiceStats('user-123');
      await nextTick();

      expect(canPlay.value).toBe(true); // 載入後仍然允許（有剩餘次數）
    });
  });

  describe('getRemaining', () => {
    it('應該返回剩餘次數（computed）', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');
      const remaining = voiceLimit.getRemaining('char-001');

      await nextTick();
      expect(remaining.value).toBe(5);
    });

    it('應該在沒有狀態時返回 null', () => {
      const voiceLimit = useVoiceLimit();

      const remaining = voiceLimit.getRemaining('char-999');

      expect(remaining.value).toBeNull();
    });

    it('應該響應狀態變化', async () => {
      const voiceLimit = useVoiceLimit();

      const remaining = voiceLimit.getRemaining('char-001');
      expect(remaining.value).toBeNull();

      await voiceLimit.loadVoiceStats('user-123');
      await nextTick();

      // 重新獲取 computed，因為狀態已更新
      const updatedRemaining = voiceLimit.getRemaining('char-001');
      expect(updatedRemaining.value).toBe(5);
    });
  });

  describe('getRemainingValue', () => {
    it('應該返回剩餘次數值', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');
      const remaining = await voiceLimit.getRemainingValue('user-123', 'char-001');

      expect(remaining).toBe(5);
    });

    it('應該在沒有狀態時自動載入並返回', async () => {
      const voiceLimit = useVoiceLimit();

      const remaining = await voiceLimit.getRemainingValue('user-123', 'char-001');

      expect(remaining).toBeDefined();
      expect(typeof remaining).toBe('number');
    });

    it('應該在沒有數據時返回 0', async () => {
      const voiceLimit = useVoiceLimit();

      // 確保 stats 中沒有該角色
      voiceLimit.voiceStats.value = {};

      const remaining = await voiceLimit.getRemainingValue('user-123', 'char-999');

      expect(remaining).toBe(0);
    });

    it('應該處理 remaining 為 null 的情況', async () => {
      const voiceLimit = useVoiceLimit();

      voiceLimit.voiceStats.value['char-test'] = {
        allowed: true,  // 修復：使用 allowed 而非 canPlay
        remaining: null,
        limit: 20,
      };

      const remaining = await voiceLimit.getRemainingValue('user-123', 'char-test');

      expect(remaining).toBe(0);
    });
  });

  describe('clearStats', () => {
    it('應該清除所有語音統計數據', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');
      expect(Object.keys(voiceLimit.voiceStats.value).length).toBeGreaterThan(0);

      voiceLimit.clearStats();

      expect(voiceLimit.voiceStats.value).toEqual({});
    });
  });

  describe('複雜場景', () => {
    it('應該正確處理多個角色的語音限制狀態', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');

      const status1 = voiceLimit.getCharacterVoiceStatus('char-001');
      const status2 = voiceLimit.getCharacterVoiceStatus('char-002');
      const canPlay1 = voiceLimit.canPlayLocally('char-001');
      const canPlay2 = voiceLimit.canPlayLocally('char-002');

      await nextTick();

      expect(status1.value.allowed).toBe(true);  // 修復：使用 allowed 而非 canPlay
      expect(status2.value.allowed).toBe(false);  // 修復：使用 allowed 而非 canPlay
      expect(canPlay1.value).toBe(true);
      expect(canPlay2.value).toBe(false);
    });

    it('應該支持檢查後更新本地狀態', async () => {
      const voiceLimit = useVoiceLimit();

      const canPlayBefore = voiceLimit.canPlayLocally('char-001');
      expect(canPlayBefore.value).toBe(true); // 未載入，預設允許

      await voiceLimit.checkVoiceLimit('user-123', 'char-001');
      await nextTick();

      const canPlayAfter = voiceLimit.canPlayLocally('char-001');
      expect(canPlayAfter.value).toBe(true); // 檢查後有剩餘次數
    });

    it('應該在清除後重置所有 computed', async () => {
      const voiceLimit = useVoiceLimit();

      await voiceLimit.loadVoiceStats('user-123');
      let status = voiceLimit.getCharacterVoiceStatus('char-001');
      let remaining = voiceLimit.getRemaining('char-001');

      await nextTick();
      expect(status.value).toBeDefined();
      expect(remaining.value).toBe(5);

      voiceLimit.clearStats();
      await nextTick();

      // 重新獲取 computed 以檢查清除後的狀態
      status = voiceLimit.getCharacterVoiceStatus('char-001');
      remaining = voiceLimit.getRemaining('char-001');

      expect(status.value).toBeNull();
      expect(remaining.value).toBeNull();
    });
  });

  describe('邊界情況', () => {
    it('應該處理空的角色 ID', async () => {
      const voiceLimit = useVoiceLimit();

      const status = voiceLimit.getCharacterVoiceStatus('');
      const canPlay = voiceLimit.canPlayLocally('');
      const remaining = voiceLimit.getRemaining('');

      expect(status.value).toBeNull();
      expect(canPlay.value).toBe(true); // 未載入，預設允許
      expect(remaining.value).toBeNull();
    });

    it('應該處理 null 角色 ID', async () => {
      const voiceLimit = useVoiceLimit();

      const status = voiceLimit.getCharacterVoiceStatus(null);
      const canPlay = voiceLimit.canPlayLocally(null);
      const remaining = voiceLimit.getRemaining(null);

      expect(status.value).toBeNull();
      expect(canPlay.value).toBe(true);
      expect(remaining.value).toBeNull();
    });

    it('應該處理 remaining 為 0 的情況', async () => {
      const voiceLimit = useVoiceLimit();

      voiceLimit.voiceStats.value['char-empty'] = {
        allowed: false,  // 修復：使用 allowed 而非 canPlay
        remaining: 0,
        limit: 20,
      };

      const canPlay = voiceLimit.canPlayLocally('char-empty');
      const remaining = voiceLimit.getRemaining('char-empty');

      await nextTick();
      expect(canPlay.value).toBe(false);
      expect(remaining.value).toBe(0);
    });

    it('應該處理部分欄位缺失的狀態', async () => {
      const voiceLimit = useVoiceLimit();

      voiceLimit.voiceStats.value['char-partial'] = {
        allowed: true,  // 修復：使用 allowed 而非 canPlay
        // 缺少 remaining 和 limit
      };

      const canPlay = voiceLimit.canPlayLocally('char-partial');
      const remaining = voiceLimit.getRemaining('char-partial');

      await nextTick();
      expect(canPlay.value).toBe(false); // 沒有 remaining 視為無法播放
      expect(remaining.value).toBeUndefined();
    });
  });
});
