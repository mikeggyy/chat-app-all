<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  watch,
} from "vue";
import type { ComputedRef } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  fetchCharacterCreationFlow,
  readStoredCharacterCreationFlowId,
  generateCharacterPersonaWithAI,
  generateCharacterImages,
} from "../services/characterCreation.service.js";
import { useGenderPreference } from "../composables/useGenderPreference.js";
import { useCharacterCreationFlow } from "../composables/useCharacterCreationFlow.js";
import { useDraftFlow } from "../composables/character-creation/useDraftFlow.js";
import { useToast } from "../composables/useToast.js";
import { useConfirmDialog } from "../composables/useConfirmDialog.js";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import GeneratingHeader from "../components/character-creation/GeneratingHeader.vue";
import ProgressStep from "../components/character-creation/ProgressStep.vue";
import SelectionStep from "../components/character-creation/SelectionStep.vue";
import SettingsStep from "../components/character-creation/SettingsStep.vue";
import GeneratingFooter from "../components/character-creation/GeneratingFooter.vue";

// ==================== 使用新架構 ====================

// Pinia Store
import { useCharacterCreationStore } from "../stores/characterCreation.js";
const store = useCharacterCreationStore();

// Composables
import { useGenerationProgress } from "../composables/character-creation/useGenerationProgress.js";
import { usePersonaEditing } from "../composables/character-creation/usePersonaEditing.js";

const {
  progress,
  isAnimating: _isAnimating,
  isComplete,
  progressText,
  startProgressAnimation,
  stopProgressAnimation,
  completeProgress,
} = useGenerationProgress();

// ✅ 使用 store 中的狀態，不再使用 composable 的重複狀態
const generatedResults = computed(() =>
  store.generatedImages.map(img => ({
    id: img.id,
    image: img.url,  // 轉換 url → image (SelectionStep 期望的格式)
    label: img.label,
    alt: img.alt,
  }))
);
const selectedResultId = computed({
  get: () => store.selectedImageId,
  set: (value: string) => store.selectImage(value),
});
const selectedResult = computed(() =>
  store.generatedImages.find(img => img.id === store.selectedImageId)
);
const selectedResultImage = computed(() => selectedResult.value?.url || '');
const selectedResultAlt = computed(() => selectedResult.value?.alt || '生成角色預覽');
const hasGeneratedImages = computed(() => store.hasGeneratedImages);

// 🔥 Debug: 監聽 selectedResultId 變化
watch(() => store.selectedImageId, (newVal, oldVal) => {
  console.log('[GeneratingView] store.selectedImageId 變化:', {
    old: oldVal,
    new: newVal,
    timestamp: new Date().toISOString()
  });
}, { immediate: true });

const {
  personaForm,
  nameLength,
  taglineLength,
  hiddenProfileLength,
  promptLength,
  hasEditedContent,
  isFormComplete,
  MAX_NAME_LENGTH,
  MAX_TAGLINE_LENGTH,
  MAX_PROMPT_LENGTH,
  MAX_HIDDEN_PROFILE_LENGTH,
  setPersonaData,
} = usePersonaEditing();

// ==================== 基礎設置 ====================

const router = useRouter();
const route = useRoute();
const { error: showErrorToast } = useToast();
const { dialogState, confirm, handleConfirm: handleDialogConfirm, handleCancel: handleDialogCancel } = useConfirmDialog();

// 常量定義
const Step = Object.freeze({
  PROGRESS: "progress",
  SELECTION: "selection",
  SETTINGS: "settings",
} as const);

type StepType = typeof Step[keyof typeof Step];

// ==================== 本地狀態 ====================

// 當前步驟（進度 → 選擇 → 設定）
const currentStep = computed<StepType>({
  get: () => {
    // 根據 store 狀態決定當前步驟
    if (store.status === "generating") {
      return Step.PROGRESS;
    } else if (store.status === "selecting") {
      return Step.SELECTION;
    } else if (store.status === "editing") {
      return Step.SETTINGS;
    }
    return Step.PROGRESS;
  },
  set: (value: StepType) => {
    // 同步到 store
    if (value === Step.PROGRESS) {
      store.setStatus("generating");
    } else if (value === Step.SELECTION) {
      store.setStatus("selecting");
    } else if (value === Step.SETTINGS) {
      store.setStatus("editing");
    }
  },
});

// 生成相關狀態
const generatingEmblem = "/character-create/generating-emblem.png";
const isGeneratingImages = computed(() => store.isLoading);
const imageGenerationError = computed(() => store.error);

// Gender Preference Composable
const {
  genderPreference,
  normalizeGenderPreference,
  readStoredGenderPreference,
  ensureGenderPreference,
} = useGenderPreference();

// 草稿流程管理
const {
  hasDraft: _hasDraft,
  draftFlow: _draftFlow,
  checkDraft,
  saveDraft,
  clearDraft,
  updateDraftStep: _updateDraftStep,
} = useDraftFlow();

// ==================== Computed 屬性 ====================

const statusText: ComputedRef<string> = computed(() =>
  progress.value >= 100 ? "角色生成完成！" : "角色生成中"
);

const isSelectionStep: ComputedRef<boolean> = computed(
  () => currentStep.value === Step.SELECTION
);

const isSettingsStep: ComputedRef<boolean> = computed(
  () => currentStep.value === Step.SETTINGS
);

const headerTitle: ComputedRef<string> = computed(() => {
  if (currentStep.value === Step.SETTINGS) {
    return "角色設定";
  }
  return "";
});

const selectedResultLabel: ComputedRef<string> = computed(
  () => selectedResult.value?.label ?? ""
);

const confirmButtonLabel: ComputedRef<string> = computed(() => {
  if (currentStep.value === Step.SELECTION || currentStep.value === Step.SETTINGS) {
    return "下一步";
  }
  return "確認";
});

// 🔥 Debug: 監聽 currentStep 變化
watch(() => currentStep.value, (newVal, oldVal) => {
  console.log('[GeneratingView] currentStep 變化:', {
    old: oldVal,
    new: newVal,
    storeSelectedImageId: store.selectedImageId,
    generatedImagesLength: store.generatedImages.length
  });
});

const isConfirmDisabled: ComputedRef<boolean> = computed(() => {
  if (currentStep.value === Step.PROGRESS) {
    return true;
  }
  if (currentStep.value === Step.SELECTION) {
    return !selectedResultId.value;
  }
  if (currentStep.value === Step.SETTINGS) {
    return !isFormComplete.value;
  }
  return true;
});

// ==================== Character Creation Flow Composable ====================

const {
  flowId,
  buildSummaryPayload,
  persistSummaryToSession,
  applyFlowRecord,
  syncSummaryToBackend,
  scheduleBackendSync,
  initializeFlowState,
  cleanup: cleanupFlow,
  getSuppressSync,
  setSuppressSync,
} = useCharacterCreationFlow({
  personaForm,
  selectedResult: selectedResult as any,
  selectedResultId,
  selectedResultLabel,
  selectedResultImage,
  selectedResultAlt,
  genderPreference,
  normalizeGenderPreference: normalizeGenderPreference as any,
  readStoredGenderPreference: readStoredGenderPreference as any,
  ensureGenderPreference: ensureGenderPreference as any,
  currentStep,
});

// ==================== 工具函數 ====================

/**
 * beforeunload 處理函數
 */
const handleBeforeUnload = (event: BeforeUnloadEvent): string => {
  event.preventDefault();
  event.returnValue = "";
  return "";
};

/**
 * 觸發圖片生成
 */
const triggerImageGeneration = async (): Promise<void> => {
  // 確保 flowId 已經初始化
  if (!flowId.value) {
    const storedFlowId = readStoredCharacterCreationFlowId();
    if (storedFlowId) {
      flowId.value = storedFlowId;
      store.createFlow(storedFlowId);
    } else {
      const errorMessage = "找不到角色創建流程，請返回重新開始";
      store.setError(errorMessage);

      showErrorToast(errorMessage, {
        title: "創建流程錯誤",
        duration: 5000,
      });

      setTimeout(() => {
        router.push({ name: "character-create-appearance" }).catch(() => {});
      }, 1000);
      return;
    }
  }

  if (isGeneratingImages.value) {
    return;
  }

  try {
    store.setStatus("generating");
    store.setLoading(true);
    store.setError(null);

    // 加入 beforeunload 監聽
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    const { images, flow: updatedFlow } = (await generateCharacterImages(
      flowId.value,
      {
        quality: "standard",
        count: 4,
      }
    )) as any;

    if (images && images.length > 0) {
      // 將生成的圖片更新到本地狀態和 store
      const imageResults = images.map((img: any, index: number) => ({
        id: `generated-${index}`,
        label: `風格 ${index + 1}`,
        image: img.url,
        alt: `生成的角色形象 ${index + 1}`,
        name: "",
        tagline: "",
        prompt: "",
      }));

      // 設置圖片到 store（會自動選中第一張）
      console.log('[GeneratingView] 準備設置圖片結果:', {
        count: imageResults.length,
        firstId: imageResults[0]?.id
      });

      store.setGeneratedImages(
        imageResults.map((img: { id: string; image: string; label: string; alt: string }) => ({
          id: img.id,
          url: img.image,
          label: img.label,
          alt: img.alt,
        }))
      );

      console.log('[GeneratingView] 設置完成後 store.selectedImageId:', store.selectedImageId);

      // 同步到後端
      await nextTick();
      scheduleBackendSync();

      // 更新 flow 記錄
      if (updatedFlow) {
        applyFlowRecord(updatedFlow);
      }

      // 清除所有性別的 AI 魔法師使用次數
      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          ["male", "female", "non-binary"].forEach((gender: string): void => {
            window.sessionStorage.removeItem(`ai-magician-usage-${gender}`);
          });
          console.log(
            "[CharacterCreateGeneratingView] AI 魔法師使用次數已重置"
          );
        } catch (error) {
          console.error(
            "[CharacterCreateGeneratingView] 清除 AI 魔法師使用次數失敗",
            error
          );
        }
      }

      // 保存草稿
      if (flowId.value) {
        try {
          saveDraft({
            flowId: flowId.value,
            createdAt: new Date().toISOString(),
            step: "generating",
            hasGeneratedImages: true,
          });
          console.log("[CharacterCreateGeneratingView] 草稿已自動保存");
        } catch (error) {
          console.error("[CharacterCreateGeneratingView] 保存草稿失敗", error);
        }
      }
    } else {
      throw new Error("未能生成任何圖片");
    }
  } catch (error: any) {
    const errorMessage = error?.message || "圖片生成失敗，請稍後再試";
    store.setError(errorMessage);
    stopProgressAnimation();

    showErrorToast(errorMessage, {
      title: "圖片生成失敗",
      duration: 5000,
    });

    setTimeout(() => {
      router.push({ name: "character-create-appearance" }).catch(() => {});
    }, 1000);
  } finally {
    store.setLoading(false);
    // 移除 beforeunload 監聽
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }
};

/**
 * 應用選中的結果到 Persona 表單
 */
const applyResultToPersona = (result: any): void => {
  setSuppressSync(true);
  setPersonaData({
    name: result?.name || "",
    tagline: result?.tagline || "",
    hiddenProfile: "",
    prompt: result?.prompt || "",
  });
  setSuppressSync(false);
  scheduleBackendSync();
};

/**
 * 返回按鈕處理
 */
const handleBack = async (): Promise<void> => {
  console.log("[GeneratingView] handleBack 被調用", {
    currentStep: currentStep.value,
    timestamp: new Date().toISOString(),
  });

  if (currentStep.value === Step.SETTINGS) {
    console.log("[GeneratingView] 🔍 從 SETTINGS 步驟返回, hasEditedContent:", hasEditedContent.value);

    // 從設定步驟返回，詢問是否保存編輯
    if (hasEditedContent.value) {
      console.log("[GeneratingView] 🔍 顯示保存確認對話框");
      const shouldSave = await confirm(
        "您已經填寫了角色設定內容。是否要保留此次編輯進度？",
        {
          title: "保存編輯內容？",
          confirmText: "保存進度",
          cancelText: "放棄編輯",
        }
      );

      console.log("[GeneratingView] 🔍 用戶選擇:", shouldSave ? "保存" : "放棄");

      if (shouldSave) {
        if (flowId.value) {
          try {
            await syncSummaryToBackend({} as any);
            console.log("[CharacterCreateGeneratingView] 用戶選擇保存設定草稿");
          } catch (error) {
            console.error(
              "[CharacterCreateGeneratingView] 保存設定草稿失敗",
              error
            );
          }
        }
      }
    }

    // 返回到選擇步驟
    console.log("[GeneratingView] 🔍 準備切換到 SELECTION 步驟");
    console.log("[GeneratingView] 🔍 切換前 currentStep.value:", currentStep.value);
    console.log("[GeneratingView] 🔍 Step.SELECTION 的值:", Step.SELECTION);
    currentStep.value = Step.SELECTION;
    console.log("[GeneratingView] 🔍 切換後 currentStep.value:", currentStep.value);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  if (currentStep.value === Step.SELECTION) {
    console.log('[GeneratingView] 在 SELECTION 步驟，檢查條件:', {
      hasGeneratedImages: hasGeneratedImages.value,
      storeHasGeneratedImages: store.hasGeneratedImages,
      generatedImagesLength: store.generatedImages.length
    });

    // 如果已經生成圖片，詢問是否保存草稿
    if (hasGeneratedImages.value) {
      console.log('[GeneratingView] 準備顯示確認對話框...');
      const shouldSave = await confirm(
        "您已經生成了角色圖片並消耗了相應額度。是否要保留此次編輯進度，下次可以繼續編輯？",
        {
          title: "保存編輯進度？",
          confirmText: "保存進度",
          cancelText: "放棄進度",
        }
      );
      console.log('[GeneratingView] 用戶選擇:', shouldSave);

      if (shouldSave) {
        if (flowId.value) {
          try {
            saveDraft({
              flowId: flowId.value,
              createdAt: new Date().toISOString(),
              step: "generating",
              hasGeneratedImages: true,
            });
            console.log("[CharacterCreateGeneratingView] 用戶選擇保存草稿");
          } catch (error) {
            console.error("[CharacterCreateGeneratingView] 保存草稿失敗", error);
          }
        }
      } else {
        clearDraft();
        console.log("[CharacterCreateGeneratingView] 用戶選擇放棄草稿");
      }
    }

    console.log('[GeneratingView] 準備導航到配對頁...');
    router.push({ name: "match" }).catch((err) => {
      console.error('[GeneratingView] 導航失敗:', err);
    });
    console.log('[GeneratingView] 導航已觸發，返回');
    return;
  }

  // 其他情況返回到 profile 頁面
  router.push({ name: "profile" }).catch(() => {});
};

/**
 * 保存創建摘要
 */
const persistCreationSummary = async (): Promise<void> => {
  const summary = buildSummaryPayload();
  persistSummaryToSession(summary);

  try {
    await syncSummaryToBackend({
      summary,
      statusOverride: "voice",
    });
  } catch (error: any) {
    // ⚠️ 重要：如果同步失敗，必須拋出錯誤阻止跳轉
    console.error('[CharacterCreateGeneratingView] 保存角色設定失敗:', error);

    // 顯示錯誤提示
    showErrorToast(error?.message || "保存角色設定失敗，請檢查網絡連接後重試");

    // 重新拋出錯誤，阻止後續的頁面跳轉
    throw error;
  }
};

/**
 * 進入設定步驟
 */
const enterSettingsStep = (): void => {
  applyResultToPersona(selectedResult.value);
  currentStep.value = Step.SETTINGS;
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

/**
 * 確認按鈕處理
 */
const handleConfirm = async (): Promise<void> => {
  if (currentStep.value === Step.SELECTION) {
    if (!selectedResultId.value) {
      return;
    }

    try {
      // 在進入設定步驟前，先同步選擇的外觀到後端
      await syncSummaryToBackend({} as any);
      enterSettingsStep();
    } catch (error: any) {
      // 同步失敗，停留在當前頁面
      console.error('[CharacterCreateGeneratingView] 同步外觀數據失敗:', error);
      showErrorToast(error?.message || "保存外觀設定失敗，請檢查網絡連接後重試");
    }
    return;
  }

  if (currentStep.value === Step.SETTINGS) {
    if (isConfirmDisabled.value) {
      return;
    }

    try {
      await persistCreationSummary();
      // 只有在數據成功保存後才跳轉
      router.push({ name: "character-create-voice" }).catch(() => {});
    } catch (error) {
      // 保存失敗，停留在當前頁面，讓用戶重試
      console.error('[CharacterCreateGeneratingView] 無法進入語音選擇步驟:', error);
    }
    return;
  }
};

/**
 * 圖片選擇處理
 */
const handleResultSelect = (resultId: string): void => {
  if (currentStep.value !== Step.SELECTION || !resultId) {
    return;
  }
  store.selectImage(resultId);
  // 保存到本地 sessionStorage
  const summary = buildSummaryPayload();
  persistSummaryToSession(summary);
};

/**
 * 打開 AI 魔法師
 */
const openAIMagician = async (): Promise<void> => {
  if (store.isAIMagicianLoading) {
    return;
  }

  if (!flowId.value) {
    const errorMessage = "請先完成前面的步驟";
    store.setError(errorMessage);
    showErrorToast(errorMessage, {
      title: "AI魔法師",
      duration: 3000,
    });
    return;
  }

  if (!selectedResultId.value) {
    const errorMessage = "請先選擇角色外觀";
    store.setError(errorMessage);
    showErrorToast(errorMessage, {
      title: "AI魔法師",
      duration: 3000,
    });
    return;
  }

  try {
    store.setAIMagicianLoading(true);
    store.setError(null);

    const persona = (await generateCharacterPersonaWithAI(flowId.value)) as any;

    if (persona) {
      setSuppressSync(true);
      setPersonaData(persona);
      setSuppressSync(false);
      store.incrementAIMagicianUsage();
      scheduleBackendSync({} as any);
    }
  } catch (error: any) {
    const errorMessage = error?.message || "AI 魔法師生成失敗，請稍後再試";
    store.setError(errorMessage);
    showErrorToast(errorMessage, {
      title: "AI魔法師失敗",
      duration: 5000,
    });
  } finally {
    store.setAIMagicianLoading(false);
  }
};

// ==================== Watchers ====================

watch(
  () => route.query.step,
  (step) => {
    if (step === "settings") {
      currentStep.value = Step.SETTINGS;
      return;
    }
    if (step === "selection") {
      currentStep.value = Step.SELECTION;
    }
  },
  { immediate: true }
);

// 創建表單欄位 watcher 的工具函數
const createFieldWatcher = (
  fieldName: keyof typeof personaForm,
  maxLength: number
) => {
  return (value: string): void => {
    if (getSuppressSync()) return;

    if (typeof value !== "string") {
      setSuppressSync(true);
      personaForm[fieldName] = "";
      setSuppressSync(false);
      scheduleBackendSync();
      return;
    }

    if (value.length > maxLength) {
      setSuppressSync(true);
      personaForm[fieldName] = value.slice(0, maxLength);
      setSuppressSync(false);
      scheduleBackendSync();
      return;
    }

    scheduleBackendSync();
  };
};

// 為每個表單欄位創建 watcher
watch(() => personaForm.name, createFieldWatcher("name", MAX_NAME_LENGTH));
watch(
  () => personaForm.tagline,
  createFieldWatcher("tagline", MAX_TAGLINE_LENGTH)
);
watch(
  () => personaForm.hiddenProfile,
  createFieldWatcher("hiddenProfile", MAX_HIDDEN_PROFILE_LENGTH)
);
watch(() => personaForm.prompt, createFieldWatcher("prompt", MAX_PROMPT_LENGTH));

watch(
  () => isComplete.value,
  (complete) => {
    if (complete && currentStep.value === Step.PROGRESS) {
      currentStep.value = Step.SELECTION;
    }
  }
);

// ==================== 生命周期 ====================

onMounted(() => {
  initializeFlowState().finally(async () => {
    // 檢查是否有草稿需要恢復
    const draft = checkDraft();
    if (draft && draft.hasGeneratedImages) {
      flowId.value = draft.flowId;
      store.createFlow(draft.flowId);
      console.log("[CharacterCreateGeneratingView] 從草稿恢復 flowId:", draft.flowId);
    }

    // 確保 flowId 已初始化
    if (!flowId.value) {
      const storedFlowId = readStoredCharacterCreationFlowId();
      if (storedFlowId) {
        flowId.value = storedFlowId;
        store.createFlow(storedFlowId);
      } else {
        const errorMessage = "找不到角色創建流程，請返回重新開始";
        store.setError(errorMessage);

        showErrorToast(errorMessage, {
          title: "創建流程錯誤",
          duration: 5000,
        });

        setTimeout(() => {
          router.push({ name: "character-create-appearance" }).catch(() => {});
        }, 1000);
        return;
      }
    }

    // 檢查是否已有生成的圖片
    const currentFlow = (await fetchCharacterCreationFlow(flowId.value).catch(
      () => {
        return null;
      }
    )) as any;

    if (!currentFlow) {
      const errorMessage = "找不到角色創建流程，請返回重新開始";
      store.setError(errorMessage);

      showErrorToast(errorMessage, {
        title: "創建流程錯誤",
        duration: 5000,
      });

      setTimeout(() => {
        router.push({ name: "character-create-appearance" }).catch(() => {});
      }, 1000);
      return;
    }

    // 同步 AI 魔法師使用次數
    if (currentFlow?.metadata?.aiMagicianUsageCount !== undefined) {
      // 更新 store
      for (let i = 0; i < currentFlow.metadata.aiMagicianUsageCount; i++) {
        store.incrementAIMagicianUsage();
      }
    }

    const flowHasGeneratedImages =
      (currentFlow?.generation?.result?.images?.length ?? 0) > 0;

    if (flowHasGeneratedImages) {
      // 如果已有生成的圖片，直接使用
      const images = currentFlow.generation!.result!.images!;
      const imageResults = images.map((img: any, index: number) => ({
        id: `generated-${index}`,
        label: `風格 ${index + 1}`,
        image: img.url,
        alt: `生成的角色形象 ${index + 1}`,
        name: "",
        tagline: "",
        prompt: "",
      }));

      // 設置圖片到 store（會自動選中第一張）
      store.setGeneratedImages(
        imageResults.map((img: { id: string; image: string; label: string; alt: string }) => ({
          id: img.id,
          url: img.image,
          label: img.label,
          alt: img.alt,
        }))
      );

      scheduleBackendSync();

      // 立即完成進度
      completeProgress();
    } else {
      // 開始進度動畫
      startProgressAnimation();

      // 觸發圖像生成
      await triggerImageGeneration();

      // 生成完成後，停止動畫並跳到 100%
      completeProgress();
    }
  });
});

onBeforeUnmount(() => {
  stopProgressAnimation();
  cleanupFlow();
  // 確保移除 beforeunload 監聽
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  }
});
</script>

<template>
  <div
    class="generating"
    :class="{
      'generating--complete': isComplete,
      'generating--settings': isSettingsStep,
    }"
    role="dialog"
    aria-modal="true"
  >
    <GeneratingHeader
      :current-step="currentStep"
      :settings-step-value="Step.SETTINGS"
      :title="headerTitle"
      @back="handleBack"
    />

    <ProgressStep
      v-if="currentStep === Step.PROGRESS"
      :progress="progress"
      :progress-text="progressText"
      :status-text="statusText"
      :is-complete="isComplete"
      :is-generating-images="isGeneratingImages"
      :image-generation-error="imageGenerationError"
      :generating-emblem="generatingEmblem"
    />

    <SelectionStep
      v-else-if="currentStep === Step.SELECTION"
      :selected-result-image="selectedResultImage"
      :selected-result-alt="selectedResultAlt"
      :generated-results="generatedResults"
      :selected-result-id="selectedResultId"
      :is-selection-step="isSelectionStep"
      @select="handleResultSelect"
      :key="`selection-${selectedResultId}`"
    />

    <SettingsStep
      v-else
      :selected-result-image="selectedResultImage"
      :selected-result-alt="selectedResultAlt"
      :persona-form="personaForm"
      :name-length="nameLength"
      :tagline-length="taglineLength"
      :hidden-profile-length="hiddenProfileLength"
      :prompt-length="promptLength"
      :max-name-length="MAX_NAME_LENGTH"
      :max-tagline-length="MAX_TAGLINE_LENGTH"
      :max-hidden-profile-length="MAX_HIDDEN_PROFILE_LENGTH"
      :max-prompt-length="MAX_PROMPT_LENGTH"
      @open-ai-magician="openAIMagician"
      @update:name="personaForm.name = $event"
      @update:tagline="personaForm.tagline = $event"
      @update:hidden-profile="personaForm.hiddenProfile = $event"
      @update:prompt="personaForm.prompt = $event"
    />

    <GeneratingFooter
      v-if="currentStep !== Step.PROGRESS || isComplete"
      :confirm-button-label="confirmButtonLabel"
      :is-confirm-disabled="isConfirmDisabled"
      @confirm="handleConfirm"
    />

    <!-- 確認對話框 -->
    <ConfirmDialog
      v-if="dialogState.isOpen"
      :title="dialogState.title"
      :message="dialogState.message"
      :confirm-text="dialogState.confirmText"
      :cancel-text="dialogState.cancelText"
      @confirm="handleDialogConfirm"
      @cancel="handleDialogCancel"
    />
  </div>
</template>

<style scoped>
.generating {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 20px 18px 28px;
  background: radial-gradient(
      115% 115% at 50% 0%,
      rgba(255, 64, 146, 0.2),
      rgba(10, 10, 10, 0.92) 65%
    ),
    #070707;
  color: #ffffff;
}

.generating--complete {
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(7, 7, 7, 0.9) 65%
    ),
    #060606;
}

.generating--settings {
  padding-bottom: 48px;
  background: radial-gradient(
      150% 120% at 50% 0%,
      rgba(255, 84, 162, 0.18),
      rgba(5, 5, 5, 0.95) 80%
    ),
    #050505;
}

@media (min-width: 640px) {
  .generating {
    padding: 32px 24px 40px;
  }
}
</style>
