import { ref, computed } from "vue";
import type { Ref, ComputedRef } from "vue";

/**
 * 生成的圖片結果
 */
export interface GeneratedResult {
  id: string;
  label: string;
  image: string;
  alt: string;
  name: string;
  tagline: string;
  prompt: string;
}

/**
 * useImageSelection
 *
 * 管理角色創建流程中的圖片選擇邏輯
 *
 * @returns 圖片選擇相關狀態和方法
 */
export function useImageSelection() {
  // ===== 狀態 =====

  /**
   * 生成的圖片結果列表
   */
  const generatedResults: Ref<GeneratedResult[]> = ref([]);

  /**
   * 當前選中的圖片 ID
   */
  const selectedResultId: Ref<string> = ref("");

  /**
   * 是否已生成圖片（用於判斷是否需要保存草稿）
   */
  const hasGeneratedImages: Ref<boolean> = ref(false);

  // ===== Computed =====

  /**
   * 當前選中的圖片結果
   */
  const selectedResult: ComputedRef<GeneratedResult | undefined> = computed(
    () => {
      if (!selectedResultId.value) {
        return undefined;
      }
      return generatedResults.value.find(
        (result) => result.id === selectedResultId.value
      );
    }
  );

  /**
   * 選中的圖片 URL
   */
  const selectedResultImage: ComputedRef<string> = computed(() => {
    return selectedResult.value?.image || "";
  });

  /**
   * 選中的圖片 alt 文字
   */
  const selectedResultAlt: ComputedRef<string> = computed(() => {
    return selectedResult.value?.alt || "生成角色預覽";
  });

  /**
   * 是否有可選擇的圖片
   */
  const hasResults: ComputedRef<boolean> = computed(() => {
    return generatedResults.value.length > 0;
  });

  /**
   * 是否已選擇圖片
   */
  const hasSelectedImage: ComputedRef<boolean> = computed(() => {
    return selectedResultId.value.length > 0;
  });

  // ===== 方法 =====

  /**
   * 選擇一張圖片
   *
   * @param resultId - 圖片結果 ID
   */
  const selectImage = (resultId: string): void => {
    if (!resultId) {
      console.warn("[useImageSelection] selectImage: resultId 為空");
      return;
    }

    const result = generatedResults.value.find((r) => r.id === resultId);
    if (!result) {
      console.warn(
        `[useImageSelection] selectImage: 找不到 ID 為 ${resultId} 的圖片`
      );
      return;
    }

    selectedResultId.value = resultId;
  };

  /**
   * 設置生成的圖片結果列表
   *
   * @param results - 圖片結果列表
   */
  const setGeneratedResults = (results: GeneratedResult[]): void => {
    generatedResults.value = results;
    hasGeneratedImages.value = results.length > 0;

    // 總是自動選中第一張圖片
    if (results.length > 0) {
      selectedResultId.value = results[0].id;
      console.log('[useImageSelection] 自動選中第一張:', {
        id: results[0].id,
        total: results.length
      });
    }
  };

  /**
   * 清空所有圖片和選擇狀態
   */
  const clearSelection = (): void => {
    generatedResults.value = [];
    selectedResultId.value = "";
    hasGeneratedImages.value = false;
  };

  /**
   * 重新生成（清空當前結果）
   */
  const resetForRegeneration = (): void => {
    clearSelection();
  };

  // ===== 返回 =====

  return {
    // 狀態
    generatedResults,
    selectedResultId,
    hasGeneratedImages,

    // Computed
    selectedResult,
    selectedResultImage,
    selectedResultAlt,
    hasResults,
    hasSelectedImage,

    // 方法
    selectImage,
    setGeneratedResults,
    clearSelection,
    resetForRegeneration,
  };
}

/**
 * useImageSelection 返回類型
 */
export type UseImageSelectionReturn = ReturnType<typeof useImageSelection>;
