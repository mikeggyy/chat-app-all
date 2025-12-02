import { ref, computed, watchEffect, type Ref, type ComputedRef } from "vue";
import { apiJson } from "../../utils/api.js";
import { logger } from "../../utils/logger.js";

const AI_MAGICIAN_LIMIT = 3;

/**
 * 外觀樣式類型
 */
export interface AppearanceStyle {
  category: string;
  value: string;
  [key: string]: unknown;
}

/**
 * 外觀樣式輸入 - 可以是樣式物件或樣式 ID 字串
 */
export type AppearanceStyleInput = AppearanceStyle | string;

/**
 * 參考圖片焦點類型
 */
export type ReferenceFocus = 'face' | 'body' | 'outfit' | 'overall';

/**
 * AI 魔法師使用次數統計
 */
export interface AIMagicianUsage {
  remaining: number;
  total: number;
}

/**
 * useAIMagician 組合式函數的返回類型
 */
export interface UseAIMagicianReturn {
  aiMagicianUsageCount: Ref<number>;
  aiMagicianRemainingUsage: ComputedRef<number>;
  isAIMagicianDisabled: ComputedRef<boolean>;
  aiMagicianUsage: ComputedRef<AIMagicianUsage>;
  isGeneratingDescription: Ref<boolean>;
  referenceError: Ref<string>;
  handleAIMagician: (
    appearanceStyles: AppearanceStyleInput[],
    referencePreview: string | null,
    referenceFocus: ReferenceFocus | string | null
  ) => Promise<string | null>;
}

/**
 * AI 魔法師組合式函數
 * 用於角色創建流程中生成角色描述
 *
 * @param savedGender - 保存的性別選擇（Ref）
 * @returns AI 魔法師相關的狀態和方法
 */
export function useAIMagician(savedGender: Ref<string | null>): UseAIMagicianReturn {
  const aiMagicianUsageCount = ref<number>(0);
  const isGeneratingDescription = ref<boolean>(false);
  const referenceError = ref<string>("");

  const aiMagicianRemainingUsage = computed<number>(() => {
    return Math.max(0, AI_MAGICIAN_LIMIT - aiMagicianUsageCount.value);
  });

  const isAIMagicianDisabled = computed<boolean>(() => {
    return (
      isGeneratingDescription.value || aiMagicianRemainingUsage.value <= 0
    );
  });

  const aiMagicianUsage = computed<AIMagicianUsage>(() => ({
    remaining: aiMagicianRemainingUsage.value,
    total: AI_MAGICIAN_LIMIT,
  }));

  // 從 sessionStorage 讀取 AI 魔法師使用次數
  watchEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (savedGender.value) {
      const sessionKey = `ai-magician-usage-${savedGender.value}`;
      // ✅ 修復：添加 try-catch 處理隱私模式等情況
      try {
        const storedUsage = window.sessionStorage.getItem(sessionKey);
        if (storedUsage) {
          const parsed = parseInt(storedUsage, 10);
          aiMagicianUsageCount.value = isNaN(parsed) ? 0 : parsed;
        } else {
          aiMagicianUsageCount.value = 0;
        }
      } catch {
        // sessionStorage 不可用（隱私模式等）
        aiMagicianUsageCount.value = 0;
      }
    }
  });

  const handleAIMagician = async (
    appearanceStyles: AppearanceStyleInput[],
    referencePreview: string | null,
    referenceFocus: ReferenceFocus | string | null
  ): Promise<string | null> => {
    if (isGeneratingDescription.value) {
      return null;
    }

    try {
      isGeneratingDescription.value = true;
      referenceError.value = ""; // 清除之前的錯誤

      // 使用 sessionStorage 追蹤 AI 魔法師使用次數
      const sessionKey = `ai-magician-usage-${savedGender.value}`;
      // ✅ 修復：添加 try-catch 處理 sessionStorage 錯誤
      let currentUsage = 0;
      try {
        const stored = sessionStorage.getItem(sessionKey);
        if (stored) {
          const parsed = parseInt(stored, 10);
          currentUsage = isNaN(parsed) ? 0 : parsed;
        }
      } catch {
        // sessionStorage 不可用，使用記憶體中的計數
        currentUsage = aiMagicianUsageCount.value;
      }

      // 檢查是否超過使用限制
      if (currentUsage >= AI_MAGICIAN_LIMIT) {
        referenceError.value = "AI 魔法師使用次數已達上限（3次）";
        return null;
      }

      const referenceInfo = referencePreview
        ? {
            image: referencePreview, // 傳遞 base64 圖片數據
            focus: referenceFocus,
          }
        : null;

      // 直接調用 AI 描述生成 API（不需要 flowId）
      const requestBody = {
        gender: savedGender.value,
        styles: appearanceStyles,
        referenceInfo,
      };

      const response = await apiJson("/api/character-creation/ai-description", {
        method: "POST",
        body: requestBody,
        skipGlobalLoading: true,
      });

      const description = response?.data?.description ?? "";

      // 更新使用次數（保存到 sessionStorage）
      const newUsageCount = currentUsage + 1;
      // ✅ 修復：添加 try-catch 處理 sessionStorage 錯誤
      try {
        sessionStorage.setItem(sessionKey, newUsageCount.toString());
      } catch {
        // sessionStorage 不可用，僅更新記憶體
        logger.warn('[useAIMagician] 無法保存使用次數到 sessionStorage');
      }
      aiMagicianUsageCount.value = newUsageCount;

      // 檢測拒絕訊息（同時包含 "抱歉" 和 "無法" 關鍵詞）
      if (
        description &&
        description.includes("抱歉") &&
        description.includes("無法")
      ) {
        referenceError.value = description;
        return null; // 不要填入 input
      }

      return description || null;
    } catch (error) {
      // 錯誤也顯示在 referenceError 而非 alert
      referenceError.value =
        error instanceof Error && error.message
          ? error.message
          : "AI 魔法師生成失敗，請稍後再試";
      return null;
    } finally {
      isGeneratingDescription.value = false;
    }
  };

  return {
    aiMagicianUsageCount,
    aiMagicianRemainingUsage,
    isAIMagicianDisabled,
    aiMagicianUsage,
    isGeneratingDescription,
    referenceError,
    handleAIMagician,
  };
}
