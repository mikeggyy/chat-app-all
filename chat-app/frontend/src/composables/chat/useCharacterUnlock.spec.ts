/**
 * useCharacterUnlock Composable 測試
 *
 * 測試範圍：
 * - 加載活躍解鎖效果
 * - 使用解鎖卡解鎖角色
 * - 解鎖狀態計算
 * - 數據加載狀態管理
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { useCharacterUnlock } from './useCharacterUnlock.js';
import type { UseCharacterUnlockDeps, UnlockEffect } from './useCharacterUnlock.js';
import type { FirebaseAuthService } from '../../types';

// Mock dependencies
vi.mock('../../utils/api', () => ({
  apiJson: vi.fn(),
}));

vi.mock('../../utils/requestId', () => ({
  generateUnlockCharacterRequestId: vi.fn((userId, matchId) => `unlock-${userId}-${matchId}-${Date.now()}`),
}));

import { apiJson } from '../../utils/api.js';

describe('useCharacterUnlock - 角色解鎖測試', () => {
  let mockDeps: UseCharacterUnlockDeps;
  let mockFirebaseAuth: FirebaseAuthService;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // Mock Firebase Auth
    mockFirebaseAuth = {
      getCurrentUserIdToken: vi.fn(async () => 'mock-token-123'),
    } as any;

    // 創建標準的 mock 依賴項
    mockDeps = {
      getCurrentUserId: vi.fn(() => 'user-123'),
      getPartnerId: vi.fn(() => 'char-001'),
      getFirebaseAuth: vi.fn(() => mockFirebaseAuth),
      getPartnerDisplayName: vi.fn(() => '測試角色'),
      closeUnlockConfirm: vi.fn(),
      loadTicketsBalance: vi.fn(async () => {}),
      setLoading: vi.fn(),
      showError: vi.fn(),
      showSuccess: vi.fn(),
    };
  });

  describe('loadActiveUnlocks - 加載活躍解鎖效果', () => {
    it('應該成功加載解鎖效果（response.data.unlocks）', async () => {
      const mockUnlocks: UnlockEffect[] = [
        {
          unlockType: 'character',
          characterId: 'char-001',
          activatedAt: '2025-11-26T00:00:00Z',
          expiresAt: '2025-12-03T00:00:00Z',
          unlockDays: 7,
        },
        {
          unlockType: 'character',
          characterId: 'char-002',
          activatedAt: '2025-11-25T00:00:00Z',
          expiresAt: '2025-12-02T00:00:00Z',
          unlockDays: 7,
        },
      ];

      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: mockUnlocks } });

      const { loadActiveUnlocks, activeUnlockEffects, isUnlockDataLoaded } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();

      expect(apiJson).toHaveBeenCalledWith('/api/unlock-tickets/active', {
        skipGlobalLoading: true,
      });
      expect(activeUnlockEffects.value).toEqual(mockUnlocks);
      expect(isUnlockDataLoaded.value).toBe(true);
    });

    it('應該成功加載解鎖效果（response.unlocks）', async () => {
      const mockUnlocks: UnlockEffect[] = [
        {
          unlockType: 'character',
          characterId: 'char-003',
          expiresAt: '2025-12-10T00:00:00Z',
        },
      ];

      (apiJson as any).mockResolvedValueOnce({ unlocks: mockUnlocks });

      const { loadActiveUnlocks, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();

      expect(activeUnlockEffects.value).toEqual(mockUnlocks);
    });

    it('應該在 userId 為空時直接返回', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null);

      const { loadActiveUnlocks, isUnlockDataLoaded } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();

      expect(apiJson).not.toHaveBeenCalled();
      expect(isUnlockDataLoaded.value).toBe(true);
    });

    it('應該在 userId 為空字符串時直接返回', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => '');

      const { loadActiveUnlocks, isUnlockDataLoaded } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();

      expect(apiJson).not.toHaveBeenCalled();
      expect(isUnlockDataLoaded.value).toBe(true);
    });

    it('應該在加載前清空舊數據', async () => {
      const mockUnlocks: UnlockEffect[] = [{ unlockType: 'character', characterId: 'char-001' }];
      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: mockUnlocks } });

      const { loadActiveUnlocks, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      // 設置初始數據
      activeUnlockEffects.value = [{ unlockType: 'character', characterId: 'old-char' }];

      await loadActiveUnlocks();

      // 驗證舊數據被清空
      expect(activeUnlockEffects.value).toEqual(mockUnlocks);
    });

    it('應該處理 API 錯誤（靜默失敗）', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (apiJson as any).mockRejectedValueOnce(new Error('網絡錯誤'));

      const { loadActiveUnlocks, activeUnlockEffects, isUnlockDataLoaded } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();

      // 不應該拋出錯誤
      expect(activeUnlockEffects.value).toEqual([]);
      expect(isUnlockDataLoaded.value).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('應該在 finally 確保設置 isUnlockDataLoaded', async () => {
      (apiJson as any).mockRejectedValueOnce(new Error('失敗'));

      const { loadActiveUnlocks, isUnlockDataLoaded } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();

      // 即使錯誤，也應該設置為 true
      expect(isUnlockDataLoaded.value).toBe(true);
    });

    it('應該處理空的 unlocks 數組', async () => {
      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: [] } });

      const { loadActiveUnlocks, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();

      expect(activeUnlockEffects.value).toEqual([]);
    });

    it('應該處理沒有 unlocks 字段的響應', async () => {
      (apiJson as any).mockResolvedValueOnce({ data: {} });

      const { loadActiveUnlocks, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();

      expect(activeUnlockEffects.value).toEqual([]);
    });
  });

  describe('handleConfirmUnlockCharacter - 使用解鎖卡', () => {
    it('應該成功使用解鎖卡（完整流程）', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          unlockDays: 7,
          expiresAt: '2025-12-03T00:00:00Z',
        },
      };
      (apiJson as any).mockResolvedValueOnce(mockResponse);

      const { handleConfirmUnlockCharacter, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      // 驗證 setLoading 被調用
      expect(mockDeps.setLoading).toHaveBeenCalledWith('unlockConfirm', true);
      expect(mockDeps.setLoading).toHaveBeenCalledWith('unlockConfirm', false);

      // 驗證 API 調用
      expect(apiJson).toHaveBeenCalledWith(
        '/api/unlock-tickets/use/character',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
          body: expect.objectContaining({
            characterId: 'char-001',
            requestId: expect.stringContaining('unlock-user-123-char-001'),
          }),
          skipGlobalLoading: true,
        })
      );

      // 驗證解鎖效果被添加
      expect(activeUnlockEffects.value).toHaveLength(1);
      expect(activeUnlockEffects.value[0]).toMatchObject({
        unlockType: 'character',
        characterId: 'char-001',
        unlockDays: 7,
      });

      // 驗證關閉模態框
      expect(mockDeps.closeUnlockConfirm).toHaveBeenCalled();

      // 驗證重新加載解鎖卡餘額
      expect(mockDeps.loadTicketsBalance).toHaveBeenCalledWith('user-123');

      // 驗證顯示成功消息
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('解鎖成功！與「測試角色」可暢聊 7 天 🎉');
    });

    it('應該在 userId 為空時不執行', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null);

      const { handleConfirmUnlockCharacter } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      expect(apiJson).not.toHaveBeenCalled();
      expect(mockDeps.setLoading).not.toHaveBeenCalled();
    });

    it('應該在 matchId 為空時不執行', async () => {
      mockDeps.getPartnerId = vi.fn(() => null);

      const { handleConfirmUnlockCharacter } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      expect(apiJson).not.toHaveBeenCalled();
      expect(mockDeps.setLoading).not.toHaveBeenCalled();
    });

    it('應該更新現有的解鎖效果', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          unlockDays: 14,
          expiresAt: '2025-12-10T00:00:00Z',
        },
      };
      (apiJson as any).mockResolvedValueOnce(mockResponse);

      const { handleConfirmUnlockCharacter, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      // 預先設置一個解鎖效果
      activeUnlockEffects.value = [
        {
          unlockType: 'character',
          characterId: 'char-001',
          unlockDays: 7,
        },
      ];

      await handleConfirmUnlockCharacter();

      // 驗證解鎖效果被更新（而非添加新的）
      expect(activeUnlockEffects.value).toHaveLength(1);
      expect(activeUnlockEffects.value[0].unlockDays).toBe(14);
    });

    it('應該添加新的解鎖效果（當不存在時）', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          unlockDays: 7,
        },
      };
      (apiJson as any).mockResolvedValueOnce(mockResponse);

      const { handleConfirmUnlockCharacter, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      // 預先設置其他角色的解鎖效果
      activeUnlockEffects.value = [
        {
          unlockType: 'character',
          characterId: 'char-002',
          unlockDays: 7,
        },
      ];

      await handleConfirmUnlockCharacter();

      // 驗證新的解鎖效果被添加
      expect(activeUnlockEffects.value).toHaveLength(2);
      expect(activeUnlockEffects.value[1].characterId).toBe('char-001');
    });

    it('應該使用默認的 7 天解鎖期限', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
        },
      };
      (apiJson as any).mockResolvedValueOnce(mockResponse);

      const { handleConfirmUnlockCharacter, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      // 驗證使用默認的 7 天
      expect(activeUnlockEffects.value[0].unlockDays).toBe(7);
      expect(mockDeps.showSuccess).toHaveBeenCalledWith(expect.stringContaining('7 天'));
    });

    it('應該使用後端返回的 expiresAt', async () => {
      const mockExpiresAt = '2025-12-15T00:00:00Z';
      const mockResponse = {
        success: true,
        data: {
          success: true,
          unlockDays: 10,
          expiresAt: mockExpiresAt,
        },
      };
      (apiJson as any).mockResolvedValueOnce(mockResponse);

      const { handleConfirmUnlockCharacter, activeUnlockEffects } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      // 驗證使用後端返回的 expiresAt
      expect(activeUnlockEffects.value[0].expiresAt).toBe(mockExpiresAt);
    });

    it('應該在沒有角色名稱時顯示默認消息', async () => {
      mockDeps.getPartnerDisplayName = vi.fn(() => '');
      const mockResponse = {
        success: true,
        data: {
          success: true,
          unlockDays: 7,
        },
      };
      (apiJson as any).mockResolvedValueOnce(mockResponse);

      const { handleConfirmUnlockCharacter } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      expect(mockDeps.showSuccess).toHaveBeenCalledWith('解鎖成功！與「角色」可暢聊 7 天 🎉');
    });

    it('應該處理 API 錯誤（Error 對象）', async () => {
      const errorMessage = '解鎖卡餘額不足';
      (apiJson as any).mockRejectedValueOnce(new Error(errorMessage));

      const { handleConfirmUnlockCharacter } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      expect(mockDeps.showError).toHaveBeenCalledWith(errorMessage);
      expect(mockDeps.closeUnlockConfirm).not.toHaveBeenCalled();
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });

    it('應該處理非 Error 對象錯誤', async () => {
      (apiJson as any).mockRejectedValueOnce('字符串錯誤');

      const { handleConfirmUnlockCharacter } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      expect(mockDeps.showError).toHaveBeenCalledWith('使用解鎖卡失敗');
    });

    it('應該在 finally 確保清除 loading 狀態', async () => {
      (apiJson as any).mockRejectedValueOnce(new Error('失敗'));

      const { handleConfirmUnlockCharacter } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      // 即使錯誤，loading 狀態也應該被清除
      expect(mockDeps.setLoading).toHaveBeenCalledWith('unlockConfirm', false);
    });

    it('應該處理 loadTicketsBalance 錯誤（不影響主流程）', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          unlockDays: 7,
        },
      };
      (apiJson as any).mockResolvedValueOnce(mockResponse);
      mockDeps.loadTicketsBalance = vi.fn(async () => {
        throw new Error('加載餘額失敗');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { handleConfirmUnlockCharacter } = useCharacterUnlock(mockDeps);

      await handleConfirmUnlockCharacter();

      // 主流程應該成功
      expect(mockDeps.showSuccess).toHaveBeenCalled();
      // 錯誤應該被捕獲
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('activeCharacterUnlock - Computed Property', () => {
    it('應該返回當前角色的解鎖效果', async () => {
      const mockUnlocks: UnlockEffect[] = [
        {
          unlockType: 'character',
          characterId: 'char-001',
          unlockDays: 7,
        },
        {
          unlockType: 'character',
          characterId: 'char-002',
          unlockDays: 7,
        },
      ];

      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: mockUnlocks } });

      const { loadActiveUnlocks, activeCharacterUnlock } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();
      await nextTick();

      expect(activeCharacterUnlock.value).toEqual(mockUnlocks[0]);
    });

    it('應該在 isUnlockDataLoaded 為 false 時返回 null', () => {
      const { activeCharacterUnlock } = useCharacterUnlock(mockDeps);

      // 數據未加載
      expect(activeCharacterUnlock.value).toBeNull();
    });

    it('應該在沒有匹配效果時返回 null', async () => {
      const mockUnlocks: UnlockEffect[] = [
        {
          unlockType: 'character',
          characterId: 'char-002',
          unlockDays: 7,
        },
      ];

      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: mockUnlocks } });

      const { loadActiveUnlocks, activeCharacterUnlock } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();
      await nextTick();

      // char-001 沒有解鎖效果
      expect(activeCharacterUnlock.value).toBeNull();
    });

    it('應該正確匹配不同角色的解鎖效果', async () => {
      const mockUnlocks: UnlockEffect[] = [
        {
          unlockType: 'character',
          characterId: 'char-001',
          unlockDays: 7,
        },
        {
          unlockType: 'character',
          characterId: 'char-002',
          unlockDays: 14,
        },
      ];

      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: mockUnlocks } });

      // 先測試 char-001
      mockDeps.getPartnerId = vi.fn(() => 'char-001');
      const result1 = useCharacterUnlock(mockDeps);
      await result1.loadActiveUnlocks();
      await nextTick();

      expect(result1.activeCharacterUnlock.value?.characterId).toBe('char-001');
      expect(result1.activeCharacterUnlock.value?.unlockDays).toBe(7);

      // 再測試 char-002（重新創建 composable）
      mockDeps.getPartnerId = vi.fn(() => 'char-002');
      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: mockUnlocks } });
      const result2 = useCharacterUnlock(mockDeps);
      await result2.loadActiveUnlocks();
      await nextTick();

      expect(result2.activeCharacterUnlock.value?.characterId).toBe('char-002');
      expect(result2.activeCharacterUnlock.value?.unlockDays).toBe(14);
    });
  });

  describe('isCharacterUnlocked - Computed Property', () => {
    it('應該在 isUnlockDataLoaded 為 false 時返回 true（避免閃爍）', () => {
      const { isCharacterUnlocked } = useCharacterUnlock(mockDeps);

      // 數據未加載，應返回 true 以隱藏解鎖按鈕
      expect(isCharacterUnlocked.value).toBe(true);
    });

    it('應該在有解鎖效果時返回 true', async () => {
      const mockUnlocks: UnlockEffect[] = [
        {
          unlockType: 'character',
          characterId: 'char-001',
          unlockDays: 7,
        },
      ];

      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: mockUnlocks } });

      const { loadActiveUnlocks, isCharacterUnlocked } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();
      await nextTick();

      expect(isCharacterUnlocked.value).toBe(true);
    });

    it('應該在沒有解鎖效果時返回 false', async () => {
      const mockUnlocks: UnlockEffect[] = [
        {
          unlockType: 'character',
          characterId: 'char-002',
          unlockDays: 7,
        },
      ];

      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: mockUnlocks } });

      const { loadActiveUnlocks, isCharacterUnlocked } = useCharacterUnlock(mockDeps);

      await loadActiveUnlocks();
      await nextTick();

      // char-001 沒有解鎖效果
      expect(isCharacterUnlocked.value).toBe(false);
    });
  });

  describe('resetUnlockDataLoadedState - 重置狀態', () => {
    it('應該重置 isUnlockDataLoaded 為 false', async () => {
      (apiJson as any).mockResolvedValueOnce({ data: { unlocks: [] } });

      const { loadActiveUnlocks, isUnlockDataLoaded, resetUnlockDataLoadedState } =
        useCharacterUnlock(mockDeps);

      // 加載數據
      await loadActiveUnlocks();
      expect(isUnlockDataLoaded.value).toBe(true);

      // 重置狀態
      resetUnlockDataLoadedState();
      expect(isUnlockDataLoaded.value).toBe(false);
    });
  });

  describe('API 暴露', () => {
    it('應該暴露所有必要的 API', () => {
      const result = useCharacterUnlock(mockDeps);

      expect(result).toHaveProperty('activeUnlockEffects');
      expect(result).toHaveProperty('isUnlockDataLoaded');
      expect(result).toHaveProperty('activeCharacterUnlock');
      expect(result).toHaveProperty('isCharacterUnlocked');
      expect(result).toHaveProperty('loadActiveUnlocks');
      expect(result).toHaveProperty('handleConfirmUnlockCharacter');
      expect(result).toHaveProperty('resetUnlockDataLoadedState');

      expect(typeof result.loadActiveUnlocks).toBe('function');
      expect(typeof result.handleConfirmUnlockCharacter).toBe('function');
      expect(typeof result.resetUnlockDataLoadedState).toBe('function');
    });
  });
});
