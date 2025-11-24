/**
 * usePotionManagement.ts
 * 藥水管理 Composable（TypeScript 版本）
 * 管理用戶的藥水系統，包括藥水數量查詢、活躍效果管理、使用邏輯
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { apiJson } from '../../utils/api.js';

// ==================== 類型定義 ====================

/**
 * 藥水類型
 */
export type PotionType = 'memoryBoost' | 'brainBoost';

/**
 * 用戶藥水數量
 */
export interface UserPotions {
  memoryBoost: number;
  brainBoost: number;
}

/**
 * 藥水效果
 */
export interface PotionEffect {
  potionType: 'memory_boost' | 'brain_boost';
  characterId: string;
  expiresAt?: string;
  [key: string]: any;
}

/**
 * usePotionManagement 依賴項
 */
export interface UsePotionManagementDeps {
  getCurrentUserId: () => string;
  getPartnerId: () => string;
  getPotionType: () => PotionType | null;
  closePotionConfirm: () => void;
  setLoading: (key: string, loading: boolean) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

/**
 * usePotionManagement 返回類型
 */
export interface UsePotionManagementReturn {
  // 狀態
  userPotions: Ref<UserPotions>;
  activePotionEffects: Ref<PotionEffect[]>;

  // Computed
  activeMemoryBoost: ComputedRef<PotionEffect | undefined>;
  activeBrainBoost: ComputedRef<PotionEffect | undefined>;

  // 方法
  loadPotions: () => Promise<void>;
  loadActivePotions: () => Promise<void>;
  usePotion: (potionType: PotionType) => Promise<boolean>;
  handleConfirmUsePotion: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 創建藥水管理 composable
 * @param deps - 依賴項
 * @returns 藥水管理相關的狀態和方法
 */
export function usePotionManagement(deps: UsePotionManagementDeps): UsePotionManagementReturn {
  const {
    getCurrentUserId,
    getPartnerId,
    getPotionType,
    closePotionConfirm,
    setLoading,
    showError,
    showSuccess,
  } = deps;

  // ====================
  // 狀態
  // ====================

  // 用戶擁有的藥水數量
  const userPotions: Ref<UserPotions> = ref({
    memoryBoost: 0,
    brainBoost: 0,
  });

  // 活躍的藥水效果列表
  const activePotionEffects: Ref<PotionEffect[]> = ref([]);

  // ====================
  // Computed Properties
  // ====================

  /**
   * 當前角色的記憶增強藥水效果
   */
  const activeMemoryBoost = computed(() => {
    const partnerId = getPartnerId();
    console.log('[activeMemoryBoost] partnerId:', partnerId);
    console.log('[activeMemoryBoost] activePotionEffects:', activePotionEffects.value);

    const result = activePotionEffects.value.find(
      (effect) =>
        effect.potionType === 'memory_boost' &&
        effect.characterId === partnerId
    );

    console.log('[activeMemoryBoost] 找到的效果:', result);
    return result;
  });

  /**
   * 當前角色的腦力激盪藥水效果
   */
  const activeBrainBoost = computed(() => {
    const partnerId = getPartnerId();
    console.log('[activeBrainBoost] partnerId:', partnerId);
    console.log('[activeBrainBoost] activePotionEffects:', activePotionEffects.value);

    // ✅ 2025-11-25 調試：詳細記錄每個效果的字段
    activePotionEffects.value.forEach((effect, index) => {
      console.log(`[activeBrainBoost] Effect ${index}:`, {
        potionType: effect.potionType,
        characterId: effect.characterId,
        id: effect.id,
        matches: effect.potionType === 'brain_boost' && effect.characterId === partnerId
      });
    });

    const result = activePotionEffects.value.find(
      (effect) =>
        effect.potionType === 'brain_boost' &&
        effect.characterId === partnerId
    );

    console.log('[activeBrainBoost] 找到的效果:', result);
    return result;
  });

  // ====================
  // 核心方法
  // ====================

  /**
   * 加載用戶擁有的藥水數量
   */
  const loadPotions = async (): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(userId)}/assets`,
        {
          skipGlobalLoading: true,
        }
      );

      // ✅ 修復：後端使用 sendSuccess 包裝響應，數據在 response.data 中
      const data = response?.data || response;

      if (data?.potions) {
        userPotions.value = {
          memoryBoost: data.potions.memoryBoost || 0,
          brainBoost: data.potions.brainBoost || 0,
        };
      }
    } catch (error) {
      // Silent fail - 不影響用戶體驗
    }
  };

  /**
   * 加載活躍的藥水效果
   */
  const loadActivePotions = async (): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) return;

    // 先清空舊數據，避免閃爍
    activePotionEffects.value = [];

    try {
      const data = await apiJson(`/api/potions/active`, {
        skipGlobalLoading: true,
      });

      console.log('[loadActivePotions] API 返回數據:', data);

      // ✅ 修復：後端使用 sendSuccess 包裝響應，數據在 data.data 中
      const potions = data?.data?.potions || data?.potions || [];
      activePotionEffects.value = potions;
      console.log('[loadActivePotions] 設置 activePotionEffects:', activePotionEffects.value);
    } catch (error) {
      console.error('[loadActivePotions] 加載失敗:', error);
      // Silent fail - 不影響用戶體驗
    }
  };

  /**
   * 使用藥水（核心邏輯）
   * @param potionType - 藥水類型
   * @returns 是否成功使用
   */
  const usePotion = async (potionType: PotionType): Promise<boolean> => {
    const userId = getCurrentUserId();
    const partnerId = getPartnerId();

    if (!userId) {
      showError('請先登入');
      return false;
    }

    if (!partnerId) {
      showError('請選擇角色');
      return false;
    }

    try {
      let apiEndpoint = '';
      let potionName = '';

      if (potionType === 'memoryBoost') {
        apiEndpoint = '/api/potions/use/memory-boost';
        potionName = '記憶增強藥水';
      } else if (potionType === 'brainBoost') {
        apiEndpoint = '/api/potions/use/brain-boost';
        potionName = '腦力激盪藥水';
      } else {
        showError('無效的藥水類型');
        return false;
      }

      // ✅ 生成 idempotencyKey 防止重複消耗
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const result = await apiJson(apiEndpoint, {
        method: 'POST',
        body: {
          characterId: partnerId,
          idempotencyKey, // ✅ 添加冪等性 key
        },
      });

      // ✅ 2025-11-25 修復：後端使用 sendSuccess 包裝回應為 { success: true, data: { ... } }
      // 需要訪問 result.data 來獲取實際數據
      const responseData = result.data || result;

      if (responseData.success || result.success) {
        const duration = responseData.duration || 7; // 預設 7 天
        showSuccess(
          `${potionName}使用成功！效果將持續 ${duration} 天`
        );

        // 重新載入活躍藥水效果和藥水數量
        await Promise.all([loadActivePotions(), loadPotions()]);

        return true;
      }

      return false;
    } catch (error: any) {
      // ✅ 改善錯誤訊息處理
      let errorMessage = '使用藥水失敗';
      if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error?.error && typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      console.error('[使用藥水錯誤]', error); // 詳細日誌供調試
      showError(errorMessage);
      return false;
    }
  };

  /**
   * 處理確認使用藥水（入口函數，與 Modal 集成）
   */
  const handleConfirmUsePotion = async (): Promise<void> => {
    const potionType = getPotionType();

    if (!potionType) {
      showError('請選擇藥水類型');
      return;
    }

    setLoading('potionConfirm', true);

    try {
      const success = await usePotion(potionType);

      // 無論成功與否，都關閉確認彈窗
      if (success) {
        closePotionConfirm();
      }
    } finally {
      setLoading('potionConfirm', false);
    }
  };

  // ====================
  // 返回 API
  // ====================
  return {
    // 狀態
    userPotions,
    activePotionEffects,

    // Computed
    activeMemoryBoost,
    activeBrainBoost,

    // 方法
    loadPotions,
    loadActivePotions,
    usePotion,
    handleConfirmUsePotion,
  };
}
