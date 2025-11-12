<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  fetchCharacterCreationFlow,
  readStoredCharacterCreationFlowId,
  generateCharacterPersonaWithAI,
  generateCharacterImages,
} from "../services/characterCreation.service.js";
import { useGenderPreference } from "../composables/useGenderPreference.js";
import { useCharacterCreationFlow } from "../composables/useCharacterCreationFlow.js";
import { CHARACTER_CREATION_LIMITS } from "../config/characterCreation.js";
import GeneratingHeader from "../components/character-creation/GeneratingHeader.vue";
import ProgressStep from "../components/character-creation/ProgressStep.vue";
import SelectionStep from "../components/character-creation/SelectionStep.vue";
import SettingsStep from "../components/character-creation/SettingsStep.vue";
import GeneratingFooter from "../components/character-creation/GeneratingFooter.vue";

const router = useRouter();
const route = useRoute();

// 常量定義
const Step = Object.freeze({
  PROGRESS: "progress",
  SELECTION: "selection",
  SETTINGS: "settings",
});

// ✅ 使用集中化配置（從 config/characterCreation.js 導入）
const MAX_NAME_LENGTH = CHARACTER_CREATION_LIMITS.MAX_NAME_LENGTH;
const MAX_TAGLINE_LENGTH = CHARACTER_CREATION_LIMITS.MAX_TAGLINE_LENGTH;
const MAX_PROMPT_LENGTH = CHARACTER_CREATION_LIMITS.MAX_PROMPT_LENGTH;
const MAX_HIDDEN_PROFILE_LENGTH = CHARACTER_CREATION_LIMITS.MAX_HIDDEN_PROFILE_LENGTH;

// 進度條狀態
const progress = ref(18);
const isAnimating = ref(false);
let progressTimer = null;

// 生成結果
const generatedResults = ref([]);
const selectedResultId = ref("");
const generatingEmblem = "/character-create/generating-emblem.png";

// 當前步驟
const currentStep = ref(Step.PROGRESS);

// 表單數據
const personaForm = reactive({
  name: "",
  tagline: "",
  hiddenProfile: "",
  prompt: "",
});

// 使用 Gender Preference Composable
const {
  genderPreference,
  normalizeGenderPreference,
  readStoredGenderPreference,
  ensureGenderPreference,
} = useGenderPreference();

// AI 相關狀態
const isAIMagicianLoading = ref(false);
const aiMagicianError = ref(null);
const isGeneratingImages = ref(false);
const imageGenerationError = ref(null);

// Computed 屬性
const isComplete = computed(() => progress.value >= 100);
const progressText = computed(() => `${progress.value}%`);
const statusText = computed(() =>
  progress.value >= 100 ? "角色生成完成！" : "角色生成中"
);

const isSelectionStep = computed(() => currentStep.value === Step.SELECTION);
const isSettingsStep = computed(() => currentStep.value === Step.SETTINGS);

const headerTitle = computed(() => {
  if (currentStep.value === Step.SETTINGS) {
    return "角色設定";
  }
  if (currentStep.value === Step.SELECTION) {
    return "";
  }
  return "";
});

const selectedResult = computed(() => {
  return (
    generatedResults.value.find(
      (result) => result.id === selectedResultId.value
    ) ??
    generatedResults.value[0] ??
    null
  );
});

const selectedResultImage = computed(() => selectedResult.value?.image ?? "");
const selectedResultAlt = computed(
  () =>
    selectedResult.value?.alt ?? selectedResult.value?.label ?? "生成角色預覽"
);
const selectedResultLabel = computed(() => selectedResult.value?.label ?? "");

const nameLength = computed(() => personaForm.name.length);
const taglineLength = computed(() => personaForm.tagline.length);
const hiddenProfileLength = computed(() => personaForm.hiddenProfile.length);
const promptLength = computed(() => personaForm.prompt.length);

const confirmButtonLabel = computed(() => {
  if (currentStep.value === Step.SELECTION) {
    return "下一步";
  }
  if (currentStep.value === Step.SETTINGS) {
    return "下一步";
  }
  return "確認";
});

const isConfirmDisabled = computed(() => {
  if (currentStep.value === Step.PROGRESS) {
    return true;
  }
  if (currentStep.value === Step.SELECTION) {
    return !selectedResultId.value;
  }
  if (currentStep.value === Step.SETTINGS) {
    return (
      personaForm.name.trim().length === 0 ||
      personaForm.tagline.trim().length === 0 ||
      personaForm.hiddenProfile.trim().length === 0 ||
      personaForm.prompt.trim().length === 0
    );
  }
  return true;
});

// 使用 Character Creation Flow Composable
const {
  flowId,
  flowStatus,
  isFlowInitializing,
  isSyncingSummary,
  lastFlowSyncError,
  isReadyForSync,
  savedAppearanceData,
  buildSummaryPayload,
  buildMetadataPayload,
  persistSummaryToSession,
  restoreSummaryFromSession,
  applyFlowRecord,
  ensureFlowInitialized,
  syncSummaryToBackend,
  scheduleBackendSync,
  initializeFlowState,
  cleanup: cleanupFlow,
  getSuppressSync,
  setSuppressSync,
} = useCharacterCreationFlow({
  personaForm,
  selectedResult,
  selectedResultId,
  selectedResultLabel,
  selectedResultImage,
  selectedResultAlt,
  genderPreference,
  normalizeGenderPreference,
  readStoredGenderPreference,
  ensureGenderPreference,
  currentStep,
});

// 工具函數
const stopTimer = () => {
  if (progressTimer) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
};

const beginProgressAnimation = () => {
  if (typeof window === "undefined" || isAnimating.value) {
    return;
  }
  isAnimating.value = true;
  progressTimer = window.setInterval(() => {
    // 圖片生成需要較長時間，進度條要慢一些
    // 並且不要超過 90%，最後 10% 等實際完成
    const increment =
      progress.value < 50
        ? Math.ceil(Math.random() * 3) // 前半段稍快 (1-3%)
        : Math.ceil(Math.random() * 2); // 後半段很慢 (1-2%)

    progress.value = Math.min(90, progress.value + increment);

    // 不再自動完成，等待實際 API 完成
  }, 1500); // 改為 1.5 秒一次，讓動畫更慢更真實
};

// beforeunload 處理函數
const handleBeforeUnload = (event) => {
  event.preventDefault();
  event.returnValue = ""; // Chrome 需要設置 returnValue
  return ""; // 部分瀏覽器需要返回字串
};

const triggerImageGeneration = async () => {
  // 確保 flowId 已經初始化
  if (!flowId.value) {
    // 嘗試從 localStorage 讀取
    const storedFlowId = readStoredCharacterCreationFlowId();
    if (storedFlowId) {
      flowId.value = storedFlowId;
    } else {
      imageGenerationError.value = "找不到角色創建流程，請返回重新開始";
      return;
    }
  }

  if (isGeneratingImages.value) {
    return;
  }

  try {
    isGeneratingImages.value = true;
    imageGenerationError.value = null;

    // 加入 beforeunload 監聽，警告用戶不要刷新或關閉頁面
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    const { images, flow: updatedFlow } = await generateCharacterImages(
      flowId.value,
      {
        quality: "low",
        count: 4,
      }
    );

    if (images && images.length > 0) {
      // 將生成的圖片更新到 generatedResults
      generatedResults.value = images.map((img, index) => ({
        id: `generated-${index}`,
        label: `風格 ${index + 1}`,
        image: img.url,
        alt: `生成的角色形象 ${index + 1}`,
        name: "",
        tagline: "",
        prompt: "",
      }));

      // 自動選擇第一張圖片
      if (!selectedResultId.value && generatedResults.value.length > 0) {
        selectedResultId.value = generatedResults.value[0].id;
      }

      // 更新 flow 記錄
      if (updatedFlow) {
        applyFlowRecord(updatedFlow);
      }
    } else {
      throw new Error("未能生成任何圖片");
    }
  } catch (error) {
    imageGenerationError.value = error?.message || "圖片生成失敗，請稍後再試";
    // 生成失敗時停止進度動畫
    stopTimer();
  } finally {
    isGeneratingImages.value = false;
    // 移除 beforeunload 監聽
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }
};

const applyResultToPersona = (result) => {
  setSuppressSync(true);
  const fallbackName = result?.name || "";
  personaForm.name = fallbackName.slice(0, MAX_NAME_LENGTH);

  const fallbackTagline = result?.tagline || "";
  personaForm.tagline = fallbackTagline.slice(0, MAX_TAGLINE_LENGTH);

  personaForm.hiddenProfile = "";

  const fallbackPrompt = result?.prompt || "";
  personaForm.prompt = fallbackPrompt.slice(0, MAX_PROMPT_LENGTH);
  setSuppressSync(false);
  scheduleBackendSync();
};

const handleBack = () => {
  // 直接返回到 profile 頁面
  router.push({ name: "profile" }).catch(() => {
    // Silent fail
  });
};

const persistCreationSummary = async () => {
  const summary = buildSummaryPayload();
  persistSummaryToSession(summary);

  try {
    await syncSummaryToBackend({
      summary,
      statusOverride: "voice",
    });
  } catch {
    // 同步時已在函式內處理錯誤
  }
};

const enterSettingsStep = () => {
  applyResultToPersona(selectedResult.value);
  currentStep.value = Step.SETTINGS;
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

const handleConfirm = async () => {
  if (currentStep.value === Step.SELECTION) {
    if (!selectedResultId.value) {
      return;
    }
    // 在進入設定步驟前，先同步選擇的外觀到後端
    await syncSummaryToBackend({ immediate: true });
    enterSettingsStep();
    return;
  }

  if (currentStep.value === Step.SETTINGS) {
    if (isConfirmDisabled.value) {
      return;
    }
    await persistCreationSummary();
    router.push({ name: "character-create-voice" }).catch(() => {
      // Silent fail
    });
    return;
  }
};

const isResultSelected = (resultId) =>
  selectedResultId.value === resultId && currentStep.value === Step.SELECTION;

const handleResultSelect = (resultId) => {
  if (currentStep.value !== Step.SELECTION || !resultId) {
    return;
  }
  selectedResultId.value = resultId;
  // 只保存到本地 sessionStorage，不發送 API 請求
  const summary = buildSummaryPayload();
  persistSummaryToSession(summary);
};

const openAIMagician = async () => {
  if (isAIMagicianLoading.value) {
    return;
  }

  if (!flowId.value) {
    aiMagicianError.value = "請先完成前面的步驟";
    return;
  }

  if (!selectedResultId.value) {
    aiMagicianError.value = "請先選擇角色外觀";
    return;
  }

  try {
    isAIMagicianLoading.value = true;
    aiMagicianError.value = null;

    const persona = await generateCharacterPersonaWithAI(flowId.value);

    if (persona) {
      setSuppressSync(true);
      personaForm.name = persona.name || "";
      personaForm.tagline = persona.tagline || "";
      personaForm.hiddenProfile = persona.hiddenProfile || "";
      personaForm.prompt = persona.prompt || "";
      setSuppressSync(false);

      scheduleBackendSync({ immediate: true });
    }
  } catch (error) {
    aiMagicianError.value = error?.message || "AI 魔法師生成失敗，請稍後再試";
  } finally {
    isAIMagicianLoading.value = false;
  }
};

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

// 創建表單欄位 watcher 的工具函數（避免重複代碼）
const createFieldWatcher = (fieldName, maxLength) => {
  return (value) => {
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
watch(() => personaForm.tagline, createFieldWatcher("tagline", MAX_TAGLINE_LENGTH));
watch(() => personaForm.hiddenProfile, createFieldWatcher("hiddenProfile", MAX_HIDDEN_PROFILE_LENGTH));
watch(() => personaForm.prompt, createFieldWatcher("prompt", MAX_PROMPT_LENGTH));

watch(
  () => isComplete.value,
  (complete) => {
    if (complete && currentStep.value === Step.PROGRESS) {
      currentStep.value = Step.SELECTION;
    }
  }
);

onMounted(() => {
  initializeFlowState().finally(async () => {
    // 確保 flowId 已初始化
    if (!flowId.value) {
      const storedFlowId = readStoredCharacterCreationFlowId();
      if (storedFlowId) {
        flowId.value = storedFlowId;
      } else {
        imageGenerationError.value = "找不到角色創建流程，請返回重新開始";
        return;
      }
    }

    // 檢查是否已有生成的圖片
    const currentFlow = await fetchCharacterCreationFlow(flowId.value).catch(
      () => {
        return null;
      }
    );

    if (!currentFlow) {
      imageGenerationError.value = "找不到角色創建流程，請返回重新開始";
      return;
    }

    const hasGeneratedImages =
      currentFlow?.generation?.result?.images?.length > 0;

    if (hasGeneratedImages) {
      // 如果已有生成的圖片，直接使用
      const images = currentFlow.generation.result.images;
      generatedResults.value = images.map((img, index) => ({
        id: `generated-${index}`,
        label: `風格 ${index + 1}`,
        image: img.url,
        alt: `生成的角色形象 ${index + 1}`,
        name: "",
        tagline: "",
        prompt: "",
      }));

      if (!selectedResultId.value && generatedResults.value.length) {
        selectedResultId.value = generatedResults.value[0].id;
        scheduleBackendSync();
      }

      // 立即完成進度
      progress.value = 100;
    } else {
      // 開始進度動畫（會慢慢到 90%）
      beginProgressAnimation();

      // 觸發圖像生成
      await triggerImageGeneration();

      // 生成完成後，停止動畫並跳到 100%
      stopTimer();
      progress.value = 100;
    }
  });
});

onBeforeUnmount(() => {
  stopTimer();
  cleanupFlow(); // 清理 composable 中的定時器
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
      :is-ai-magician-loading="isAIMagicianLoading"
      :ai-magician-error="aiMagicianError"
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
