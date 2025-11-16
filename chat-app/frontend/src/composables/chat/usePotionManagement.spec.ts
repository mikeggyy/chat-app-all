/**
 * usePotionManagement Composable 測試
 *
 * 測試範圍：
 * - 載入藥水數量
 * - 載入活躍藥水效果
 * - 使用藥水（記憶增強、腦力激盪）
 * - 確認使用藥水流程
 * - Computed 屬性（activeMemoryBoost, activeBrainBoost）
 * - 錯誤處理
 * - 無用戶/角色處理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { nextTick } from 'vue';

// Types
interface PotionEffect {
  potionType: string;
  characterId: string;
  expiresAt?: string;
}

interface MockDependencies {
  getCurrentUserId: () => string | null;
  getPartnerId: () => string | null;
  getPotionType: () => string | null;
  closePotionConfirm: () => void;
  setLoading: (key: string, value: boolean) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

// Mock dependencies
vi.mock('../../utils/api', () => ({
  apiJson: vi.fn(),
}));

describe('usePotionManagement - 藥水管理測試', () => {
  let usePotionManagement: any;
  let apiUtils: any;
  let mockDeps: MockDependencies;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // 獲取 mock modules
    const api = await import('../../utils/api');
    apiUtils = api;

    // 設置默認 mock 返回值
    (apiUtils.apiJson as Mock).mockResolvedValue({
      success: true,
      potions: {
        memoryBoost: 5,
        brainBoost: 3,
      },
    });

    // 創建標準的 mock 依賴項
    mockDeps = {
      getCurrentUserId: vi.fn(() => 'user-123'),
      getPartnerId: vi.fn(() => 'char-001'),
      getPotionType: vi.fn(() => 'memoryBoost'),
      closePotionConfirm: vi.fn(),
      setLoading: vi.fn(),
      showError: vi.fn(),
      showSuccess: vi.fn(),
    };

    // 導入 composable
    const { usePotionManagement: composable } = await import('./usePotionManagement.js');
    usePotionManagement = composable;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始狀態', () => {
    it('應該初始化為空狀態', () => {
      const potionMgmt = usePotionManagement(mockDeps);

      expect(potionMgmt.userPotions.value).toEqual({
        memoryBoost: 0,
        brainBoost: 0,
      });
      expect(potionMgmt.activePotionEffects.value).toEqual([]);
    });

    it('應該暴露所有必要的屬性和方法', () => {
      const potionMgmt = usePotionManagement(mockDeps);

      // 狀態
      expect(potionMgmt.userPotions).toBeDefined();
      expect(potionMgmt.activePotionEffects).toBeDefined();

      // Computed
      expect(potionMgmt.activeMemoryBoost).toBeDefined();
      expect(potionMgmt.activeBrainBoost).toBeDefined();

      // 方法
      expect(potionMgmt.loadPotions).toBeDefined();
      expect(potionMgmt.loadActivePotions).toBeDefined();
      expect(potionMgmt.usePotion).toBeDefined();
      expect(potionMgmt.handleConfirmUsePotion).toBeDefined();
    });
  });

  describe('loadPotions', () => {
    it('應該成功載入用戶藥水數量', async () => {
      (apiUtils.apiJson as Mock).mockResolvedValueOnce({
        potions: {
          memoryBoost: 10,
          brainBoost: 5,
        },
      });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadPotions();

      expect(apiUtils.apiJson).toHaveBeenCalledWith(
        '/api/users/user-123/assets',
        { skipGlobalLoading: true }
      );
      expect(potionMgmt.userPotions.value).toEqual({
        memoryBoost: 10,
        brainBoost: 5,
      });
    });

    it('應該處理缺少某個藥水類型的情況', async () => {
      (apiUtils.apiJson as Mock).mockResolvedValueOnce({
        potions: {
          memoryBoost: 3,
          // 缺少 brainBoost
        },
      });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadPotions();

      expect(potionMgmt.userPotions.value).toEqual({
        memoryBoost: 3,
        brainBoost: 0,
      });
    });

    it('應該在沒有用戶 ID 時不載入', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null);

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadPotions();

      expect(apiUtils.apiJson).not.toHaveBeenCalled();
    });

    it('應該靜默處理載入錯誤', async () => {
      (apiUtils.apiJson as Mock).mockRejectedValueOnce(new Error('API error'));

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadPotions();

      // 不應該拋出錯誤，保持默認值
      expect(potionMgmt.userPotions.value).toEqual({
        memoryBoost: 0,
        brainBoost: 0,
      });
    });

    it('應該處理 API 返回 null', async () => {
      (apiUtils.apiJson as Mock).mockResolvedValueOnce(null);

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadPotions();

      expect(potionMgmt.userPotions.value).toEqual({
        memoryBoost: 0,
        brainBoost: 0,
      });
    });
  });

  describe('loadActivePotions', () => {
    it('應該成功載入活躍藥水效果', async () => {
      const mockActivePotions: PotionEffect[] = [
        {
          potionType: 'memory_boost',
          characterId: 'char-001',
          expiresAt: '2025-01-20',
        },
        {
          potionType: 'brain_boost',
          characterId: 'char-002',
          expiresAt: '2025-01-22',
        },
      ];

      (apiUtils.apiJson as Mock).mockResolvedValueOnce({
        potions: mockActivePotions,
      });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadActivePotions();

      expect(apiUtils.apiJson).toHaveBeenCalledWith('/api/potions/active', {
        skipGlobalLoading: true,
      });
      expect(potionMgmt.activePotionEffects.value).toEqual(mockActivePotions);
    });

    it('應該在載入前清空舊數據', async () => {
      const potionMgmt = usePotionManagement(mockDeps);

      // 設置舊數據
      potionMgmt.activePotionEffects.value = [
        { potionType: 'memory_boost', characterId: 'old-char' },
      ];

      // 模擬延遲的 API 調用
      let resolveApi: (value: any) => void;
      (apiUtils.apiJson as Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveApi = resolve;
        })
      );

      const loadPromise = potionMgmt.loadActivePotions();

      // 立即檢查，應該已經清空
      await nextTick();
      expect(potionMgmt.activePotionEffects.value).toEqual([]);

      // 完成 API 調用
      resolveApi!({ potions: [{ potionType: 'brain_boost', characterId: 'new-char' }] });
      await loadPromise;

      expect(potionMgmt.activePotionEffects.value).toEqual([
        { potionType: 'brain_boost', characterId: 'new-char' },
      ]);
    });

    it('應該在沒有用戶 ID 時不載入', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null);

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadActivePotions();

      expect(apiUtils.apiJson).not.toHaveBeenCalled();
    });

    it('應該靜默處理載入錯誤', async () => {
      (apiUtils.apiJson as Mock).mockRejectedValueOnce(new Error('API error'));

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadActivePotions();

      // 應該清空為空陣列
      expect(potionMgmt.activePotionEffects.value).toEqual([]);
    });
  });

  describe('usePotion', () => {
    it('應該成功使用記憶增強藥水', async () => {
      (apiUtils.apiJson as Mock)
        .mockResolvedValueOnce({
          success: true,
          duration: 7,
        })
        .mockResolvedValueOnce({ potions: [] }) // loadActivePotions
        .mockResolvedValueOnce({ potions: { memoryBoost: 4, brainBoost: 3 } }); // loadPotions

      const potionMgmt = usePotionManagement(mockDeps);
      const result = await potionMgmt.usePotion('memoryBoost');

      expect(result).toBe(true);
      expect(apiUtils.apiJson).toHaveBeenCalledWith(
        '/api/potions/use/memory-boost',
        {
          method: 'POST',
          body: {
            characterId: 'char-001',
          },
        }
      );
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('記憶增強藥水使用成功！效果將持續 7 天');
    });

    it('應該成功使用腦力激盪藥水', async () => {
      (apiUtils.apiJson as Mock)
        .mockResolvedValueOnce({
          success: true,
          duration: 3,
        })
        .mockResolvedValueOnce({ potions: [] })
        .mockResolvedValueOnce({ potions: { memoryBoost: 5, brainBoost: 2 } });

      const potionMgmt = usePotionManagement(mockDeps);
      const result = await potionMgmt.usePotion('brainBoost');

      expect(result).toBe(true);
      expect(apiUtils.apiJson).toHaveBeenCalledWith(
        '/api/potions/use/brain-boost',
        {
          method: 'POST',
          body: {
            characterId: 'char-001',
          },
        }
      );
      expect(mockDeps.showSuccess).toHaveBeenCalledWith('腦力激盪藥水使用成功！效果將持續 3 天');
    });

    it('應該在沒有用戶 ID 時拒絕使用', async () => {
      mockDeps.getCurrentUserId = vi.fn(() => null);

      const potionMgmt = usePotionManagement(mockDeps);
      const result = await potionMgmt.usePotion('memoryBoost');

      expect(result).toBe(false);
      expect(mockDeps.showError).toHaveBeenCalledWith('請先登入');
      expect(apiUtils.apiJson).not.toHaveBeenCalled();
    });

    it('應該在沒有角色 ID 時拒絕使用', async () => {
      mockDeps.getPartnerId = vi.fn(() => null);

      const potionMgmt = usePotionManagement(mockDeps);
      const result = await potionMgmt.usePotion('memoryBoost');

      expect(result).toBe(false);
      expect(mockDeps.showError).toHaveBeenCalledWith('請選擇角色');
      expect(apiUtils.apiJson).not.toHaveBeenCalled();
    });

    it('應該拒絕無效的藥水類型', async () => {
      const potionMgmt = usePotionManagement(mockDeps);
      const result = await potionMgmt.usePotion('invalidPotion');

      expect(result).toBe(false);
      expect(mockDeps.showError).toHaveBeenCalledWith('無效的藥水類型');
      expect(apiUtils.apiJson).not.toHaveBeenCalled();
    });

    it('應該處理 API 錯誤', async () => {
      (apiUtils.apiJson as Mock).mockRejectedValueOnce(new Error('使用失敗'));

      const potionMgmt = usePotionManagement(mockDeps);
      const result = await potionMgmt.usePotion('memoryBoost');

      expect(result).toBe(false);
      expect(mockDeps.showError).toHaveBeenCalledWith('使用失敗');
    });

    it('應該在使用成功後重新載入藥水和效果', async () => {
      (apiUtils.apiJson as Mock)
        .mockResolvedValueOnce({ success: true, duration: 7 })
        .mockResolvedValueOnce({ potions: [] })
        .mockResolvedValueOnce({ potions: { memoryBoost: 4, brainBoost: 3 } });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.usePotion('memoryBoost');

      // 應該調用 3 次 API：使用藥水 + 載入活躍效果 + 載入藥水數量
      expect(apiUtils.apiJson).toHaveBeenCalledTimes(3);
    });

    it('應該處理 API 返回 success: false', async () => {
      (apiUtils.apiJson as Mock).mockResolvedValueOnce({
        success: false,
        message: '藥水不足',
      });

      const potionMgmt = usePotionManagement(mockDeps);
      const result = await potionMgmt.usePotion('memoryBoost');

      expect(result).toBe(false);
      expect(mockDeps.showSuccess).not.toHaveBeenCalled();
    });
  });

  describe('handleConfirmUsePotion', () => {
    it('應該成功確認並使用藥水', async () => {
      (apiUtils.apiJson as Mock)
        .mockResolvedValueOnce({ success: true, duration: 7 })
        .mockResolvedValueOnce({ potions: [] })
        .mockResolvedValueOnce({ potions: { memoryBoost: 4, brainBoost: 3 } });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.handleConfirmUsePotion();

      expect(mockDeps.setLoading).toHaveBeenCalledWith('potionConfirm', true);
      expect(mockDeps.closePotionConfirm).toHaveBeenCalled();
      expect(mockDeps.setLoading).toHaveBeenCalledWith('potionConfirm', false);
    });

    it('應該在沒有藥水類型時顯示錯誤', async () => {
      mockDeps.getPotionType = vi.fn(() => null);

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.handleConfirmUsePotion();

      expect(mockDeps.showError).toHaveBeenCalledWith('請選擇藥水類型');
      expect(apiUtils.apiJson).not.toHaveBeenCalled();
    });

    it('應該在使用失敗時不關閉彈窗', async () => {
      (apiUtils.apiJson as Mock).mockRejectedValueOnce(new Error('使用失敗'));

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.handleConfirmUsePotion();

      expect(mockDeps.closePotionConfirm).not.toHaveBeenCalled();
    });

    it('應該確保 finally 清除 loading 狀態', async () => {
      (apiUtils.apiJson as Mock).mockRejectedValueOnce(new Error('使用失敗'));

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.handleConfirmUsePotion();

      expect(mockDeps.setLoading).toHaveBeenCalledWith('potionConfirm', true);
      expect(mockDeps.setLoading).toHaveBeenCalledWith('potionConfirm', false);
    });
  });

  describe('Computed 屬性', () => {
    it('activeMemoryBoost 應該返回當前角色的記憶增強效果', async () => {
      const mockEffects: PotionEffect[] = [
        {
          potionType: 'memory_boost',
          characterId: 'char-001',
          expiresAt: '2025-01-20',
        },
        {
          potionType: 'brain_boost',
          characterId: 'char-001',
          expiresAt: '2025-01-22',
        },
        {
          potionType: 'memory_boost',
          characterId: 'char-002',
          expiresAt: '2025-01-21',
        },
      ];

      (apiUtils.apiJson as Mock).mockResolvedValueOnce({ potions: mockEffects });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadActivePotions();
      await nextTick();

      expect(potionMgmt.activeMemoryBoost.value).toEqual({
        potionType: 'memory_boost',
        characterId: 'char-001',
        expiresAt: '2025-01-20',
      });
    });

    it('activeBrainBoost 應該返回當前角色的腦力激盪效果', async () => {
      const mockEffects: PotionEffect[] = [
        {
          potionType: 'brain_boost',
          characterId: 'char-001',
          expiresAt: '2025-01-22',
        },
        {
          potionType: 'memory_boost',
          characterId: 'char-001',
          expiresAt: '2025-01-20',
        },
      ];

      (apiUtils.apiJson as Mock).mockResolvedValueOnce({ potions: mockEffects });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadActivePotions();
      await nextTick();

      expect(potionMgmt.activeBrainBoost.value).toEqual({
        potionType: 'brain_boost',
        characterId: 'char-001',
        expiresAt: '2025-01-22',
      });
    });

    it('應該在沒有匹配效果時返回 undefined', async () => {
      const mockEffects: PotionEffect[] = [
        {
          potionType: 'memory_boost',
          characterId: 'char-002', // 不同角色
          expiresAt: '2025-01-20',
        },
      ];

      (apiUtils.apiJson as Mock).mockResolvedValueOnce({ potions: mockEffects });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadActivePotions();
      await nextTick();

      expect(potionMgmt.activeMemoryBoost.value).toBeUndefined();
      expect(potionMgmt.activeBrainBoost.value).toBeUndefined();
    });

    it('應該在活躍效果列表更新時重新計算 computed', async () => {
      // 初始載入 char-001 的效果
      const initialEffects: PotionEffect[] = [
        {
          potionType: 'memory_boost',
          characterId: 'char-001',
          expiresAt: '2025-01-20',
        },
      ];

      (apiUtils.apiJson as Mock).mockResolvedValueOnce({ potions: initialEffects });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadActivePotions();
      await nextTick();

      expect(potionMgmt.activeMemoryBoost.value.characterId).toBe('char-001');

      // 模擬重新載入效果列表（包含不同角色的效果）
      const updatedEffects: PotionEffect[] = [
        {
          potionType: 'memory_boost',
          characterId: 'char-001',
          expiresAt: '2025-01-20',
        },
        {
          potionType: 'memory_boost',
          characterId: 'char-002',
          expiresAt: '2025-01-21',
        },
      ];

      (apiUtils.apiJson as Mock).mockResolvedValueOnce({ potions: updatedEffects });
      await potionMgmt.loadActivePotions();
      await nextTick();

      // computed 應該仍然返回當前角色（char-001）的效果
      expect(potionMgmt.activeMemoryBoost.value.characterId).toBe('char-001');
    });
  });

  describe('邊界情況', () => {
    it('應該處理空的藥水數量響應', async () => {
      (apiUtils.apiJson as Mock).mockResolvedValueOnce({});

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadPotions();

      expect(potionMgmt.userPotions.value).toEqual({
        memoryBoost: 0,
        brainBoost: 0,
      });
    });

    it('應該處理空的活躍效果響應', async () => {
      (apiUtils.apiJson as Mock).mockResolvedValueOnce({ potions: [] });

      const potionMgmt = usePotionManagement(mockDeps);
      await potionMgmt.loadActivePotions();

      expect(potionMgmt.activePotionEffects.value).toEqual([]);
    });

    it('應該處理非標準錯誤對象', async () => {
      (apiUtils.apiJson as Mock).mockRejectedValueOnce('字符串錯誤');

      const potionMgmt = usePotionManagement(mockDeps);
      const result = await potionMgmt.usePotion('memoryBoost');

      expect(result).toBe(false);
      expect(mockDeps.showError).toHaveBeenCalledWith('使用藥水失敗');
    });
  });
});
