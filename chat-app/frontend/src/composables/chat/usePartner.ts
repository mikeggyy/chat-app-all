/**
 * usePartner.ts
 * Partner (角色) 相關邏輯 Composable（TypeScript 版本）
 * 處理 AI 角色的加載、數據管理和顯示邏輯
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { apiJson } from '../../utils/api';
import { apiCache, cacheKeys, cacheTTL } from '../../services/apiCache.service';
import { logger } from '../../utils/logger';
import { fallbackMatches } from '../../utils/matchFallback';
import type { Partner } from '../../types';

// ==================== 類型定義 ====================

export interface UsePartnerParams {
  partnerId: ComputedRef<string>;
}

export interface UsePartnerReturn {
  // State
  partner: Ref<Partner | null>;

  // Computed
  partnerDisplayName: ComputedRef<string>;
  partnerBackground: ComputedRef<string>;
  backgroundStyle: ComputedRef<Record<string, string> | {}>;

  // Methods
  loadPartner: (characterId: string) => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * Partner 管理邏輯
 * @param params - 參數對象
 */
export const usePartner = ({ partnerId }: UsePartnerParams): UsePartnerReturn => {
  // partnerId 參數保留用於未來可能的響應式監聽需求
  void partnerId; // 標記參數已被認知

  // ====================
  // State
  // ====================
  const partner: Ref<Partner | null> = ref(null);

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
   * @param characterId - 角色 ID
   */
  const loadPartner = async (characterId: string): Promise<void> => {
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
