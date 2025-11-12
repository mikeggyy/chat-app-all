import { ref, computed, watchEffect } from "vue";
import { apiJson } from "../../utils/api.js";

const AI_MAGICIAN_LIMIT = 3;

export function useAIMagician(savedGender) {
  const aiMagicianUsageCount = ref(0);
  const isGeneratingDescription = ref(false);
  const referenceError = ref("");

  const aiMagicianRemainingUsage = computed(() => {
    return Math.max(0, AI_MAGICIAN_LIMIT - aiMagicianUsageCount.value);
  });

  const isAIMagicianDisabled = computed(() => {
    return (
      isGeneratingDescription.value || aiMagicianRemainingUsage.value <= 0
    );
  });

  const aiMagicianUsage = computed(() => ({
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
      const storedUsage = window.sessionStorage.getItem(sessionKey);
      if (storedUsage) {
        aiMagicianUsageCount.value = parseInt(storedUsage, 10);
      } else {
        aiMagicianUsageCount.value = 0;
      }
    }
  });

  const handleAIMagician = async (
    appearanceStyles,
    referencePreview,
    referenceFocus
  ) => {
    if (isGeneratingDescription.value) {
      return null;
    }

    try {
      isGeneratingDescription.value = true;
      referenceError.value = ""; // 清除之前的錯誤

      // 使用 sessionStorage 追蹤 AI 魔法師使用次數
      const sessionKey = `ai-magician-usage-${savedGender.value}`;
      const currentUsage = parseInt(
        sessionStorage.getItem(sessionKey) || "0",
        10
      );

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

      const description = response?.description ?? "";

      // 更新使用次數（保存到 sessionStorage）
      const newUsageCount = currentUsage + 1;
      sessionStorage.setItem(sessionKey, newUsageCount.toString());
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
