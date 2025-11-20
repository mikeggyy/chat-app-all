import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Ref, ComputedRef } from "vue";

/**
 * 角色外觀數據
 */
export interface CharacterAppearance {
  styles: Array<{ category: string; value: string }>;
  description: string;
  referenceImage: string | null;
  referenceFocus: "face" | "body" | "outfit" | "overall" | null;
}

/**
 * 角色 Persona 數據
 */
export interface CharacterPersona {
  name: string;
  tagline: string;
  hiddenProfile: string;
  prompt: string;
}

/**
 * 生成的圖片結果
 */
export interface GeneratedImage {
  id: string;
  url: string;
  label: string;
  alt: string;
}

/**
 * 角色創建流程狀態
 */
export type FlowStatus =
  | "draft"           // 草稿
  | "generating"      // 正在生成圖片
  | "selecting"       // 選擇圖片
  | "editing"         // 編輯設定
  | "selecting-voice" // 選擇語音
  | "completed";      // 完成

/**
 * 角色創建 Store
 *
 * 統一管理整個角色創建流程的狀態
 */
export const useCharacterCreationStore = defineStore("characterCreation", () => {
  // ==================== 狀態 ====================

  /**
   * 當前流程 ID
   */
  const flowId: Ref<string> = ref("");

  /**
   * 流程狀態
   */
  const status: Ref<FlowStatus> = ref("draft");

  /**
   * 性別偏好
   */
  const gender: Ref<"male" | "female" | ""> = ref("");

  /**
   * 外觀數據
   */
  const appearance: Ref<CharacterAppearance | null> = ref(null);

  /**
   * 生成的圖片列表
   */
  const generatedImages: Ref<GeneratedImage[]> = ref([]);

  /**
   * 選中的圖片 ID
   */
  const selectedImageId: Ref<string> = ref("");

  /**
   * Persona 數據
   */
  const persona: Ref<CharacterPersona | null> = ref(null);

  /**
   * 語音 ID
   */
  const voiceId: Ref<string> = ref("");

  /**
   * 是否正在加載（圖片生成）
   */
  const isLoading: Ref<boolean> = ref(false);

  /**
   * AI 魔法師是否正在生成
   */
  const isAIMagicianLoading: Ref<boolean> = ref(false);

  /**
   * 錯誤訊息
   */
  const error: Ref<string | null> = ref(null);

  /**
   * AI 魔法師使用次數
   */
  const aiMagicianUsageCount: Ref<number> = ref(0);

  // ==================== Computed ====================

  /**
   * 是否有流程 ID
   */
  const hasFlow: ComputedRef<boolean> = computed(() => flowId.value.length > 0);

  /**
   * 是否已選擇性別
   */
  const hasGender: ComputedRef<boolean> = computed(() => gender.value.length > 0);

  /**
   * 是否已設置外觀
   */
  const hasAppearance: ComputedRef<boolean> = computed(() => appearance.value !== null);

  /**
   * 是否已生成圖片
   */
  const hasGeneratedImages: ComputedRef<boolean> = computed(() =>
    generatedImages.value.length > 0
  );

  /**
   * 是否已選擇圖片
   */
  const hasSelectedImage: ComputedRef<boolean> = computed(() =>
    selectedImageId.value.length > 0
  );

  /**
   * 當前選中的圖片
   */
  const selectedImage: ComputedRef<GeneratedImage | undefined> = computed(() =>
    generatedImages.value.find((img) => img.id === selectedImageId.value)
  );

  /**
   * 是否已設置 Persona
   */
  const hasPersona: ComputedRef<boolean> = computed(() => persona.value !== null);

  /**
   * 是否已選擇語音
   */
  const hasVoice: ComputedRef<boolean> = computed(() => voiceId.value.length > 0);

  /**
   * 流程是否可以繼續到下一步
   */
  const canProceed: ComputedRef<boolean> = computed(() => {
    switch (status.value) {
      case "draft":
        return hasGender.value && hasAppearance.value;
      case "generating":
        return hasGeneratedImages.value;
      case "selecting":
        return hasSelectedImage.value;
      case "editing":
        return hasPersona.value;
      case "selecting-voice":
        return hasVoice.value;
      default:
        return false;
    }
  });

  /**
   * AI 魔法師剩餘使用次數
   */
  const aiMagicianRemainingUsage: ComputedRef<number> = computed(() => {
    return Math.max(0, 3 - aiMagicianUsageCount.value);
  });

  // ==================== Actions ====================

  /**
   * 創建新流程
   */
  const createFlow = (id: string): void => {
    flowId.value = id;
    status.value = "draft";
    error.value = null;
  };

  /**
   * 設置性別
   */
  const setGender = (value: "male" | "female"): void => {
    gender.value = value;
  };

  /**
   * 設置外觀
   */
  const setAppearance = (value: CharacterAppearance): void => {
    appearance.value = value;
  };

  /**
   * 設置生成的圖片
   */
  const setGeneratedImages = (images: GeneratedImage[]): void => {
    generatedImages.value = images;
    status.value = "selecting";

    // 自動選擇第一張圖片
    if (images.length > 0) {
      selectedImageId.value = images[0].id;
    }
  };

  /**
   * 選擇圖片
   */
  const selectImage = (imageId: string): void => {
    selectedImageId.value = imageId;
  };

  /**
   * 設置 Persona
   */
  const setPersona = (value: CharacterPersona): void => {
    persona.value = value;
  };

  /**
   * 設置語音
   */
  const setVoice = (id: string): void => {
    voiceId.value = id;
  };

  /**
   * 設置加載狀態（圖片生成）
   */
  const setLoading = (loading: boolean): void => {
    isLoading.value = loading;
  };

  /**
   * 設置 AI 魔法師加載狀態
   */
  const setAIMagicianLoading = (loading: boolean): void => {
    isAIMagicianLoading.value = loading;
  };

  /**
   * 設置錯誤
   */
  const setError = (err: string | null): void => {
    error.value = err;
  };

  /**
   * 切換流程狀態
   */
  const setStatus = (newStatus: FlowStatus): void => {
    status.value = newStatus;
  };

  /**
   * 增加 AI 魔法師使用次數
   */
  const incrementAIMagicianUsage = (): void => {
    aiMagicianUsageCount.value++;
  };

  /**
   * 重置流程
   */
  const resetFlow = (): void => {
    flowId.value = "";
    status.value = "draft";
    gender.value = "";
    appearance.value = null;
    generatedImages.value = [];
    selectedImageId.value = "";
    persona.value = null;
    voiceId.value = "";
    error.value = null;
    aiMagicianUsageCount.value = 0;
  };

  /**
   * 清除錯誤
   */
  const clearError = (): void => {
    error.value = null;
  };

  // ==================== 持久化 ====================

  /**
   * 從 sessionStorage 加載狀態
   */
  const loadFromSession = (): void => {
    try {
      const stored = sessionStorage.getItem("character-creation-state");
      if (stored) {
        const state = JSON.parse(stored);
        flowId.value = state.flowId || "";
        status.value = state.status || "draft";
        gender.value = state.gender || "";
        appearance.value = state.appearance || null;
        generatedImages.value = state.generatedImages || [];
        selectedImageId.value = state.selectedImageId || "";
        persona.value = state.persona || null;
        voiceId.value = state.voiceId || "";
        aiMagicianUsageCount.value = state.aiMagicianUsageCount || 0;
      }
    } catch (error) {
      console.error("[CharacterCreationStore] 從 sessionStorage 加載失敗:", error);
    }
  };

  /**
   * 保存到 sessionStorage
   */
  const saveToSession = (): void => {
    try {
      const state = {
        flowId: flowId.value,
        status: status.value,
        gender: gender.value,
        appearance: appearance.value,
        generatedImages: generatedImages.value,
        selectedImageId: selectedImageId.value,
        persona: persona.value,
        voiceId: voiceId.value,
        aiMagicianUsageCount: aiMagicianUsageCount.value,
      };
      sessionStorage.setItem("character-creation-state", JSON.stringify(state));
    } catch (error) {
      console.error("[CharacterCreationStore] 保存到 sessionStorage 失敗:", error);
    }
  };

  /**
   * 清除 sessionStorage
   */
  const clearSession = (): void => {
    sessionStorage.removeItem("character-creation-state");
  };

  // ==================== 返回 ====================

  return {
    // 狀態
    flowId,
    status,
    gender,
    appearance,
    generatedImages,
    selectedImageId,
    persona,
    voiceId,
    isLoading,
    isAIMagicianLoading,
    error,
    aiMagicianUsageCount,

    // Computed
    hasFlow,
    hasGender,
    hasAppearance,
    hasGeneratedImages,
    hasSelectedImage,
    selectedImage,
    hasPersona,
    hasVoice,
    canProceed,
    aiMagicianRemainingUsage,

    // Actions
    createFlow,
    setGender,
    setAppearance,
    setGeneratedImages,
    selectImage,
    setPersona,
    setVoice,
    setLoading,
    setAIMagicianLoading,
    setError,
    setStatus,
    incrementAIMagicianUsage,
    resetFlow,
    clearError,

    // 持久化
    loadFromSession,
    saveToSession,
    clearSession,
  };
});
