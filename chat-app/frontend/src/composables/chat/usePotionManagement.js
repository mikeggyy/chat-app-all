/**
 * 藥水管理 Composable
 *
 * 管理用戶的藥水系統，包括：
 * - 藥水數量查詢
 * - 活躍藥水效果管理
 * - 藥水使用邏輯
 * - 記憶增強和腦力激盪藥水
 */

import { ref, computed } from 'vue';
import { apiJson } from '../../utils/api';

/**
 * 創建藥水管理 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.getPartnerId - 獲取角色 ID
 * @param {Function} deps.getPotionType - 獲取當前選擇的藥水類型
 * @param {Function} deps.closePotionConfirm - 關閉藥水確認彈窗
 * @param {Function} deps.setLoading - 設置 loading 狀態
 * @param {Function} deps.showError - 顯示錯誤提示
 * @param {Function} deps.showSuccess - 顯示成功提示
 * @returns {Object} 藥水管理相關的狀態和方法
 */
export function usePotionManagement(deps) {
  const {
    getCurrentUserId,
    getPartnerId,
    getPotionType,
    closePotionConfirm,
    setLoading,
    showError,
    showSuccess,
  } = deps;

  // ==========================================
  // 狀態
  // ==========================================

  // 用戶擁有的藥水數量
  const userPotions = ref({
    memoryBoost: 0,
    brainBoost: 0,
  });

  // 活躍的藥水效果列表
  const activePotionEffects = ref([]);

  // ==========================================
  // Computed Properties
  // ==========================================

  /**
   * 當前角色的記憶增強藥水效果
   */
  const activeMemoryBoost = computed(() => {
    const partnerId = getPartnerId();
    return activePotionEffects.value.find(
      (effect) =>
        effect.potionType === 'memory_boost' &&
        effect.characterId === partnerId
    );
  });

  /**
   * 當前角色的腦力激盪藥水效果
   */
  const activeBrainBoost = computed(() => {
    const partnerId = getPartnerId();
    return activePotionEffects.value.find(
      (effect) =>
        effect.potionType === 'brain_boost' &&
        effect.characterId === partnerId
    );
  });

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 加載用戶擁有的藥水數量
   * @returns {Promise<void>}
   */
  const loadPotions = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      const data = await apiJson(
        `/api/users/${encodeURIComponent(userId)}/assets`,
        {
          skipGlobalLoading: true,
        }
      );

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
   * @returns {Promise<void>}
   */
  const loadActivePotions = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    // 先清空舊數據，避免閃爍
    activePotionEffects.value = [];

    try {
      const data = await apiJson(`/api/potions/active`, {
        skipGlobalLoading: true,
      });

      if (data && data.potions) {
        activePotionEffects.value = data.potions;
      }
    } catch (error) {
      // Silent fail - 不影響用戶體驗
    }
  };

  /**
   * 使用藥水（核心邏輯）
   * @param {string} potionType - 藥水類型 ('memoryBoost' 或 'brainBoost')
   * @returns {Promise<boolean>} - 是否成功使用
   */
  const usePotion = async (potionType) => {
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

      const result = await apiJson(apiEndpoint, {
        method: 'POST',
        body: {
          characterId: partnerId,
        },
      });

      if (result.success) {
        showSuccess(
          `${potionName}使用成功！效果將持續 ${result.duration} 天`
        );

        // 重新載入活躍藥水效果和藥水數量
        await Promise.all([loadActivePotions(), loadPotions()]);

        return true;
      }

      return false;
    } catch (error) {
      showError(error.message || '使用藥水失敗');
      return false;
    }
  };

  /**
   * 處理確認使用藥水（入口函數，與 Modal 集成）
   * @returns {Promise<void>}
   */
  const handleConfirmUsePotion = async () => {
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

  // ==========================================
  // 返回 API
  // ==========================================
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
