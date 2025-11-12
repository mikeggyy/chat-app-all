/**
 * Partner (角色) 相關邏輯 Composable
 * 處理 AI 角色的加載、數據管理和顯示邏輯
 * 從 ChatView.vue 提取為獨立 composable
 */

import { ref, computed } from 'vue';
import { apiJson } from '../../utils/api';
import { apiCache, cacheKeys, cacheTTL } from '../../services/apiCache.service';
import { logger } from '../../utils/logger';
import { fallbackMatches } from '../../utils/matchFallback';

/**
 * Partner 管理邏輯
 * @param {Object} params - 參數對象
 * @param {import('vue').ComputedRef<string>} params.partnerId - 角色 ID（從 route.params.id）
 * @returns {Object} Partner 相關數據和方法
 */
export const usePartner = ({ partnerId }) => {
  // ====================
  // State
  // ====================
  const partner = ref(null);

  // ====================
  // Computed
  // ====================

  /**
   * 角色顯示名稱
   */
  const partnerDisplayName = computed(() => {
    return partner.value?.display_name || "未知角色";
  });

  /**
   * 角色背景描述
   */
  const partnerBackground = computed(() => {
    return partner.value?.background || "";
  });

  /**
   * 背景圖片樣式
   */
  const backgroundStyle = computed(() => {
    if (!partner.value?.portraitUrl) return {};
    return {
      backgroundImage: `url(${partner.value.portraitUrl})`,
    };
  });

  // ====================
  // Methods
  // ====================

  /**
   * 從 API 加載角色數據（使用緩存）
   * @param {string} characterId - 角色 ID
   */
  const loadPartner = async (characterId) => {
    if (!characterId) {
      partner.value = null;
      return;
    }

    try {
      // 使用 API 緩存服務，10 分鐘緩存
      const character = await apiCache.fetch(
        cacheKeys.character(characterId),
        async () => {
          const response = await apiJson(
            `/match/${encodeURIComponent(characterId)}`,
            {
              skipGlobalLoading: true,
            }
          );
          return response?.character || null;
        },
        cacheTTL.CHARACTER
      );

      partner.value = character;
    } catch (error) {
      logger.error('載入角色失敗:', error);
      // Fallback 到內存數組
      partner.value = fallbackMatches.find((m) => m.id === characterId) || null;
    }
  };

  return {
    // State
    partner,

    // Computed
    partnerDisplayName,
    partnerBackground,
    backgroundStyle,

    // Methods
    loadPartner,
  };
};
