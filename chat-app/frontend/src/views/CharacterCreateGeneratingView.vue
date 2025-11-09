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
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { SparklesIcon } from "@heroicons/vue/24/solid";
import {
  createCharacterCreationFlow,
  fetchCharacterCreationFlow,
  storeCharacterCreationFlowId,
  readStoredCharacterCreationFlowId,
  updateCharacterCreationFlow,
  generateCharacterPersonaWithAI,
  generateCharacterImages,
} from "../services/characterCreation.service.js";

const CREATION_SUMMARY_STORAGE_KEY = "character-create-summary";
const GENDER_STORAGE_KEY = "characterCreation.gender";
const ALLOWED_GENDERS = new Set(["male", "female", "non-binary"]);

const router = useRouter();
const route = useRoute();

const flowId = ref("");
const flowStatus = ref("draft");
const isFlowInitializing = ref(false);
const isSyncingSummary = ref(false);
const lastFlowSyncError = ref(null);
const isReadyForSync = ref(false);
let summarySyncTimer = null;
let flowInitPromise = null;
let suppressSync = false;
const genderPreference = ref("");
// 保存從後端獲取的完整 appearance 數據（包括 description 和 styles）
const savedAppearanceData = ref(null);

const Step = Object.freeze({
  PROGRESS: "progress",
  SELECTION: "selection",
  SETTINGS: "settings",
});

const MAX_NAME_LENGTH = 8;
const MAX_TAGLINE_LENGTH = 200;
const MAX_PROMPT_LENGTH = 50;
const MAX_HIDDEN_PROFILE_LENGTH = 200;

const progress = ref(18);
const isAnimating = ref(false);
let progressTimer = null;

const normalizeGenderPreference = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return ALLOWED_GENDERS.has(trimmed) ? trimmed : "";
};

const readStoredGenderPreference = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return "";
  }
  try {
    return window.sessionStorage.getItem(GENDER_STORAGE_KEY) ?? "";
  } catch (error) {
    return "";
  }
};

const ensureGenderPreference = (value) => {
  const normalized = normalizeGenderPreference(value);
  if (normalized) {
    genderPreference.value = normalized;
    return normalized;
  }
  const stored = normalizeGenderPreference(readStoredGenderPreference());
  if (stored) {
    genderPreference.value = stored;
    return stored;
  }
  genderPreference.value = "";
  return "";
};

const generatedResults = ref([]);
const selectedResultId = ref("");

const generatingEmblem = "/character-create/generating-emblem.png";

const currentStep = ref(Step.PROGRESS);

const personaForm = reactive({
  name: "",
  tagline: "",
  hiddenProfile: "",
  prompt: "",
});

const isSummaryVisible = ref(false);
const isFinalizing = ref(false);
const isAIMagicianLoading = ref(false);
const aiMagicianError = ref(null);
const isCancelConfirmVisible = ref(false);
const isGeneratingImages = ref(false);
const imageGenerationError = ref(null);

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

const previewName = computed(() => {
  if (personaForm.name.trim().length) {
    return personaForm.name.trim();
  }
  return selectedResult.value?.name ?? "";
});

const previewTagline = computed(() => {
  if (personaForm.tagline.trim().length) {
    return personaForm.tagline.trim();
  }
  return selectedResult.value?.tagline ?? "";
});

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

const restoreSummaryFromSession = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(CREATION_SUMMARY_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);

    // 優先從 characterCreation.gender 讀取性別，因為這是用戶在性別選擇頁面的選擇
    const storedGender = readStoredGenderPreference();
    const genderToUse = storedGender || parsed?.gender;

    suppressSync = true;
    personaForm.name = parsed?.persona?.name ?? "";
    personaForm.tagline = parsed?.persona?.tagline ?? "";
    personaForm.hiddenProfile = parsed?.persona?.hiddenProfile ?? "";
    personaForm.prompt = parsed?.persona?.prompt ?? "";
    if (parsed?.appearance?.id) {
      selectedResultId.value = parsed.appearance.id;
    }
    ensureGenderPreference(genderToUse);
    suppressSync = false;
    return parsed;
  } catch (error) {
    suppressSync = false;
    return null;
  }
};

const buildSummaryPayload = () => {
  const appearance = selectedResult.value
    ? {
        id: selectedResult.value.id,
        label: selectedResultLabel.value,
        image: selectedResultImage.value,
        alt: selectedResultAlt.value,
        // 合併保存的 description 和 styles（從後端獲取的原始數據）
        description: savedAppearanceData.value?.description || "",
        styles: savedAppearanceData.value?.styles || [],
        referenceInfo: savedAppearanceData.value?.referenceInfo || null,
      }
    : null;

  return {
    persona: {
      name: personaForm.name.trim(),
      tagline: personaForm.tagline.trim(),
      hiddenProfile: personaForm.hiddenProfile.trim(),
      prompt: personaForm.prompt.trim(),
    },
    appearance,
    gender: genderPreference.value,
    updatedAt: Date.now(),
  };
};

const buildMetadataPayload = (summary = null) => {
  const source = summary && typeof summary === "object" ? summary : null;
  const rawGender =
    source && typeof source.gender === "string"
      ? source.gender
      : genderPreference.value;
  const normalized = normalizeGenderPreference(rawGender);
  return normalized ? { gender: normalized } : undefined;
};

const persistSummaryToSession = (summary) => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  try {
    // 不要儲存大型 base64 圖片到 sessionStorage
    // 只儲存必要的元資料
    const sanitizedSummary = {
      ...summary,
      appearance: summary.appearance
        ? {
            id: summary.appearance.id,
            label: summary.appearance.label,
            // 不要儲存 image (可能是大型 base64 data URL)
            // 圖片會從後端 API 重新獲取
          }
        : null,
    };
    window.sessionStorage.setItem(
      CREATION_SUMMARY_STORAGE_KEY,
      JSON.stringify(sanitizedSummary)
    );
  } catch (error) {
    // Silent fail
  }
};

const applyFlowRecord = (record, options = {}) => {
  if (!record || typeof record !== "object") {
    return;
  }

  flowId.value = record.id ?? flowId.value;
  flowStatus.value = record.status ?? flowStatus.value;

  suppressSync = true;
  personaForm.name = record?.persona?.name ?? "";
  personaForm.tagline = record?.persona?.tagline ?? "";
  personaForm.hiddenProfile = record?.persona?.hiddenProfile ?? "";
  personaForm.prompt = record?.persona?.prompt ?? "";
  selectedResultId.value = record?.appearance?.id ?? "";

  // 保存完整的 appearance 數據（包括 description 和 styles）
  if (record?.appearance) {
    savedAppearanceData.value = {
      description: record.appearance.description || "",
      styles: Array.isArray(record.appearance.styles) ? [...record.appearance.styles] : [],
      referenceInfo: record.appearance.referenceInfo || null,
    };
  }

  suppressSync = false;

  // 優先使用本地已設定的 gender（來自 sessionStorage 的 characterCreation.gender）
  // 只有在本地沒有 gender 時，才使用後端回傳的 metadata.gender
  const normalizedGender = ensureGenderPreference(
    genderPreference.value || record?.metadata?.gender
  );

  const summary = {
    persona: {
      name: personaForm.name,
      tagline: personaForm.tagline,
      hiddenProfile: personaForm.hiddenProfile,
      prompt: personaForm.prompt,
    },
    appearance: record?.appearance ?? null,
    gender: normalizedGender,
    updatedAt: Date.now(),
  };

  if (!options.skipSession) {
    persistSummaryToSession(summary);
  }

  if (record?.id) {
    storeCharacterCreationFlowId(record.id);
  }
};

const ensureFlowInitialized = async () => {
  if (flowId.value) {
    return flowId.value;
  }

  if (flowInitPromise) {
    return flowInitPromise;
  }

  flowInitPromise = (async () => {
    isFlowInitializing.value = true;
    try {
      const storedId = readStoredCharacterCreationFlowId();
      if (storedId) {
        try {
          const existing = await fetchCharacterCreationFlow(storedId);
          applyFlowRecord(existing);
          flowId.value = existing?.id ?? "";
          return flowId.value;
        } catch (error) {
          if (error?.status !== 404) {
            throw error;
          }
        }
      }

      const summary = buildSummaryPayload();
      const metadata = buildMetadataPayload(summary);
      const status =
        selectedResultId.value && summary.appearance ? "appearance" : "pending";

      const creationPayload = {
        status,
        persona: summary.persona,
        appearance: summary.appearance,
      };
      if (metadata) {
        creationPayload.metadata = metadata;
      }
      const created = await createCharacterCreationFlow(creationPayload);
      applyFlowRecord(created);
      flowId.value = created?.id ?? "";
      return flowId.value;
    } finally {
      isFlowInitializing.value = false;
    }
  })()
    .catch((error) => {
      lastFlowSyncError.value = error;
      return "";
    })
    .finally(() => {
      flowInitPromise = null;
    });

  return flowInitPromise;
};

const syncSummaryToBackend = async (options = {}) => {
  const summary =
    options.summary && typeof options.summary === "object"
      ? options.summary
      : buildSummaryPayload();

  const statusOverride = options.statusOverride;
  const status =
    statusOverride ||
    (currentStep.value === Step.SETTINGS
      ? "persona"
      : selectedResultId.value
      ? "appearance"
      : "pending");

  try {
    await ensureFlowInitialized();
  } catch (error) {
    return;
  }

  if (!flowId.value) {
    return;
  }

  try {
    isSyncingSummary.value = true;
    const metadata = buildMetadataPayload(summary);
    const payload = {
      persona: summary.persona,
      appearance: summary.appearance,
      status,
    };
    if (metadata) {
      payload.metadata = metadata;
    }
    const updated = await updateCharacterCreationFlow(flowId.value, payload);
    applyFlowRecord(updated);
    lastFlowSyncError.value = null;
  } catch (error) {
    lastFlowSyncError.value = error;
  } finally {
    isSyncingSummary.value = false;
  }
};

const scheduleBackendSync = (options = {}) => {
  const summary =
    options.summary && typeof options.summary === "object"
      ? options.summary
      : buildSummaryPayload();

  persistSummaryToSession(summary);

  if (!isReadyForSync.value || typeof window === "undefined") {
    return;
  }

  if (summarySyncTimer) {
    window.clearTimeout(summarySyncTimer);
    summarySyncTimer = null;
  }

  const executeSync = () => {
    syncSummaryToBackend({
      summary,
      statusOverride: options.statusOverride,
    }).catch(() => {
      // 已在 syncSummaryToBackend 處理錯誤
    });
  };

  if (options.immediate) {
    executeSync();
    return;
  }

  summarySyncTimer = window.setTimeout(
    () => {
      summarySyncTimer = null;
      executeSync();
    },
    typeof options.delay === "number" ? options.delay : 600
  );
};

const initializeFlowState = async () => {
  restoreSummaryFromSession();
  ensureGenderPreference(genderPreference.value);
  try {
    await ensureFlowInitialized();
  } catch (error) {
    // Silent fail
  } finally {
    isReadyForSync.value = true;
  }
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
  suppressSync = true;
  const fallbackName = result?.name || "";
  personaForm.name = fallbackName.slice(0, MAX_NAME_LENGTH);

  const fallbackTagline = result?.tagline || "";
  personaForm.tagline = fallbackTagline.slice(0, MAX_TAGLINE_LENGTH);

  personaForm.hiddenProfile = "";

  const fallbackPrompt = result?.prompt || "";
  personaForm.prompt = fallbackPrompt.slice(0, MAX_PROMPT_LENGTH);
  suppressSync = false;
  scheduleBackendSync();
};

const handleBack = () => {
  // 直接返回到 profile 頁面
  router.push({ name: "profile" }).catch(() => {
    // Silent fail
  });
};

const confirmCancelCreation = () => {
  // 關閉對話框並返回首頁或個人檔案頁
  isCancelConfirmVisible.value = false;
  router.push({ name: "profile" }).catch(() => {
    // Silent fail
  });
};

const closeCancelConfirm = () => {
  isCancelConfirmVisible.value = false;
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

const finalizeCreation = () => {
  if (isFinalizing.value) {
    return;
  }
  isFinalizing.value = true;
  isSummaryVisible.value = false;
  router
    .replace({ name: "profile" })
    .catch(() => {
      // Silent fail
    })
    .finally(() => {
      isFinalizing.value = false;
    });
};

const closeSummary = () => {
  if (isFinalizing.value) {
    return;
  }
  isSummaryVisible.value = false;
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
      suppressSync = true;
      personaForm.name = persona.name || "";
      personaForm.tagline = persona.tagline || "";
      personaForm.hiddenProfile = persona.hiddenProfile || "";
      personaForm.prompt = persona.prompt || "";
      suppressSync = false;

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
      isSummaryVisible.value = false;
      return;
    }
    if (step === "selection") {
      currentStep.value = Step.SELECTION;
      isSummaryVisible.value = false;
    }
  },
  { immediate: true }
);

watch(
  () => personaForm.name,
  (value) => {
    if (suppressSync) {
      return;
    }
    if (typeof value !== "string") {
      suppressSync = true;
      personaForm.name = "";
      suppressSync = false;
      scheduleBackendSync();
      return;
    }
    if (value.length > MAX_NAME_LENGTH) {
      suppressSync = true;
      personaForm.name = value.slice(0, MAX_NAME_LENGTH);
      suppressSync = false;
      scheduleBackendSync();
      return;
    }
    scheduleBackendSync();
  }
);

watch(
  () => personaForm.tagline,
  (value) => {
    if (suppressSync) {
      return;
    }
    if (typeof value !== "string") {
      suppressSync = true;
      personaForm.tagline = "";
      suppressSync = false;
      scheduleBackendSync();
      return;
    }
    if (value.length > MAX_TAGLINE_LENGTH) {
      suppressSync = true;
      personaForm.tagline = value.slice(0, MAX_TAGLINE_LENGTH);
      suppressSync = false;
      scheduleBackendSync();
      return;
    }
    scheduleBackendSync();
  }
);

watch(
  () => personaForm.hiddenProfile,
  (value) => {
    if (suppressSync) {
      return;
    }
    if (typeof value !== "string") {
      suppressSync = true;
      personaForm.hiddenProfile = "";
      suppressSync = false;
      scheduleBackendSync();
      return;
    }
    if (value.length > MAX_HIDDEN_PROFILE_LENGTH) {
      suppressSync = true;
      personaForm.hiddenProfile = value.slice(0, MAX_HIDDEN_PROFILE_LENGTH);
      suppressSync = false;
      scheduleBackendSync();
      return;
    }
    scheduleBackendSync();
  }
);

watch(
  () => personaForm.prompt,
  (value) => {
    if (suppressSync) {
      return;
    }
    if (typeof value !== "string") {
      suppressSync = true;
      personaForm.prompt = "";
      suppressSync = false;
      scheduleBackendSync();
      return;
    }
    if (value.length > MAX_PROMPT_LENGTH) {
      suppressSync = true;
      personaForm.prompt = value.slice(0, MAX_PROMPT_LENGTH);
      suppressSync = false;
      scheduleBackendSync();
      return;
    }
    scheduleBackendSync();
  }
);

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
  if (summarySyncTimer) {
    window.clearTimeout(summarySyncTimer);
    summarySyncTimer = null;
  }
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
    <header class="generating__header">
      <button
        type="button"
        class="generating__back"
        :class="{ 'generating__back--close': currentStep !== Step.SETTINGS }"
        :aria-label="
          currentStep === Step.SETTINGS ? '返回上一個步驟' : '取消角色創建'
        "
        @click="handleBack"
      >
        <XMarkIcon
          v-if="currentStep !== Step.SETTINGS"
          class="generating__back-icon"
          aria-hidden="true"
        />
        <ArrowLeftIcon
          v-else
          class="generating__back-icon"
          aria-hidden="true"
        />
      </button>
      <div v-if="headerTitle" class="generating__step-title">
        {{ headerTitle }}
      </div>
    </header>

    <main v-if="currentStep === Step.PROGRESS" class="generating__body">
      <section class="generating__glow" aria-live="polite">
        <div class="generating__emblem">
          <span class="generating__emblem-ring" aria-hidden="true"></span>
          <span class="generating__emblem-heart" aria-hidden="true">
            <img
              :src="generatingEmblem"
              alt=""
              class="generating__emblem-image"
              aria-hidden="true"
            />
          </span>
        </div>
        <p class="generating__progress-value">{{ progressText }}</p>
        <p class="generating__progress-status">
          <span class="generating__progress-status-text">{{ statusText }}</span>
          <span
            v-if="!isComplete"
            class="generating__progress-dots"
            aria-hidden="true"
          >
            <span
              v-for="index in 3"
              :key="index"
              class="generating__progress-dot"
              :class="`generating__progress-dot--${index}`"
            ></span>
          </span>
        </p>
        <div v-if="imageGenerationError" class="generating__error" role="alert">
          {{ imageGenerationError }}
        </div>
        <div
          v-if="isGeneratingImages && !isComplete"
          class="generating__warning"
          role="status"
          aria-live="polite"
        >
          ⚠️ 生成進行中，請勿刷新或關閉頁面
        </div>
      </section>

      <section class="generating__card-preview" aria-hidden="true">
        <div class="generating__card">
          <div class="generating__card-emblem">
            <img
              :src="generatingEmblem"
              alt=""
              class="generating__card-emblem-image"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>
    </main>

    <main
      v-else-if="currentStep === Step.SELECTION"
      class="generating__body generating__body--complete"
      aria-live="polite"
    >
      <section class="generating__hero" aria-label="生成角色預覽">
        <div class="generating__hero-frame">
          <img
            v-if="selectedResultImage"
            :src="selectedResultImage"
            :alt="selectedResultAlt"
            class="generating__hero-image"
          />
          <div v-else class="generating__hero-empty" aria-hidden="true"></div>
        </div>
      </section>

      <section class="generating__results" aria-label="生成角色風格選擇">
        <div
          class="generating__result-scroll"
          role="listbox"
          aria-label="生成角色風格"
        >
          <button
            v-for="result in generatedResults"
            :key="result.id"
            type="button"
            class="generating__result-button"
            :class="{
              'generating__result-button--selected': isResultSelected(
                result.id
              ),
            }"
            role="option"
            :aria-selected="isResultSelected(result.id)"
            :tabindex="isSelectionStep ? 0 : -1"
            :disabled="!isSelectionStep"
            @click="handleResultSelect(result.id)"
          >
            <img
              :src="result.image"
              :alt="result.alt || result.label"
              class="generating__result-image"
            />
          </button>
        </div>
      </section>
    </main>

    <main
      v-else
      class="generating__settings"
      aria-live="polite"
      aria-label="角色設定"
    >
      <section class="generating__settings-hero">
        <div class="generating__settings-portrait">
          <img
            v-if="selectedResultImage"
            :src="selectedResultImage"
            :alt="selectedResultAlt"
          />
          <div v-else class="generating__settings-portrait-empty">
            預覽載入中
          </div>
        </div>
      </section>

      <section class="generating__settings-card">
        <div class="generating__field">
          <div class="generating__field-header">
            <label class="generating__field-label" for="generating-name">
              角色名
            </label>
            <button
              type="button"
              class="generating__magic-button"
              :class="{
                'generating__magic-button--loading': isAIMagicianLoading,
              }"
              :disabled="isAIMagicianLoading"
              aria-label="開啟 AI 魔法師"
              title="AI魔法師"
              @click="openAIMagician"
            >
              <SparklesIcon aria-hidden="true" />
              <span>{{ isAIMagicianLoading ? "生成中..." : "AI魔法師" }}</span>
            </button>
          </div>
          <div class="generating__field-control">
            <input
              id="generating-name"
              v-model="personaForm.name"
              type="text"
              class="generating__input"
              :maxlength="MAX_NAME_LENGTH"
              placeholder="請輸入角色名，例如：星野未來"
              required
              aria-required="true"
            />
          </div>
          <div class="generating__field-meta">
            <span>{{ nameLength }} / {{ MAX_NAME_LENGTH }}</span>
          </div>
          <!-- 移除本地 loading 提示，改用全域 loading -->
          <div
            v-if="aiMagicianError"
            class="generating__field-error"
            role="alert"
          >
            {{ aiMagicianError }}
          </div>
        </div>
        <div class="generating__field">
          <label class="generating__field-label" for="generating-tagline">
            角色設定
          </label>
          <textarea
            id="generating-tagline"
            v-model="personaForm.tagline"
            class="generating__textarea"
            :maxlength="MAX_TAGLINE_LENGTH"
            rows="4"
            placeholder="輸入角色設定，將對外展示"
            required
            aria-required="true"
          ></textarea>
          <div class="generating__field-meta generating__field-meta--end">
            <span>{{ taglineLength }} / {{ MAX_TAGLINE_LENGTH }}</span>
          </div>
        </div>
        <div class="generating__field">
          <label class="generating__field-label" for="generating-hidden">
            隱藏設定
          </label>
          <textarea
            id="generating-hidden"
            v-model="personaForm.hiddenProfile"
            class="generating__textarea"
            :maxlength="MAX_HIDDEN_PROFILE_LENGTH"
            rows="4"
            placeholder="輸入隱藏設定，僅內部查看，不對外展示"
            required
            aria-required="true"
          ></textarea>
          <div class="generating__field-meta generating__field-meta--end">
            <span
              >{{ hiddenProfileLength }} / {{ MAX_HIDDEN_PROFILE_LENGTH }}</span
            >
          </div>
        </div>
        <div class="generating__field">
          <label class="generating__field-label" for="generating-prompt">
            開場白
          </label>
          <textarea
            id="generating-prompt"
            v-model="personaForm.prompt"
            class="generating__textarea"
            :maxlength="MAX_PROMPT_LENGTH"
            rows="5"
            placeholder="輸入開場白，會成為角色對用戶說的第一句話"
            required
            aria-required="true"
          ></textarea>
          <div class="generating__field-meta generating__field-meta--end">
            <span>{{ promptLength }} / {{ MAX_PROMPT_LENGTH }}</span>
          </div>
        </div>
      </section>
    </main>

    <footer
      v-if="currentStep !== Step.PROGRESS || isComplete"
      class="generating__footer"
    >
      <button
        type="button"
        class="generating__confirm"
        :disabled="isConfirmDisabled"
        :aria-disabled="isConfirmDisabled"
        @click="handleConfirm"
      >
        {{ confirmButtonLabel }}
      </button>
    </footer>

    <Teleport to="body">
      <div
        v-if="isSummaryVisible"
        class="generating__summary"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generating-summary-title"
      >
        <div
          class="generating__summary-backdrop"
          aria-hidden="true"
          @click="closeSummary"
        ></div>
        <div class="generating__summary-panel">
          <header class="generating__summary-header">
            <h2 id="generating-summary-title">確認角色設定</h2>
            <p>建立後仍可在個人檔案中微調內容。</p>
            <button
              type="button"
              class="generating__summary-close"
              aria-label="關閉確認視窗"
              @click="closeSummary"
            >
              ×
            </button>
          </header>
          <div class="generating__summary-body">
            <div class="generating__summary-preview">
              <img
                v-if="selectedResultImage"
                :src="selectedResultImage"
                :alt="selectedResultAlt"
              />
              <div v-else class="generating__summary-placeholder">無預覽</div>
            </div>
            <dl class="generating__summary-list">
              <div class="generating__summary-item">
                <dt>角色名</dt>
                <dd>{{ previewName }}</dd>
              </div>
              <div class="generating__summary-item">
                <dt>角色設定</dt>
                <dd>{{ previewTagline }}</dd>
              </div>
              <div class="generating__summary-item">
                <dt>隱藏設定</dt>
                <dd>
                  {{ personaForm.hiddenProfile.trim() || "尚未填寫" }}
                </dd>
              </div>
              <div class="generating__summary-item">
                <dt>開場白</dt>
                <dd>
                  {{ personaForm.prompt.trim() || "尚未填寫" }}
                </dd>
              </div>
            </dl>
          </div>
          <footer class="generating__summary-actions">
            <button
              type="button"
              class="generating__summary-action generating__summary-action--ghost"
              @click="closeSummary"
            >
              返回編輯
            </button>
            <button
              type="button"
              class="generating__summary-action generating__summary-action--primary"
              :disabled="isFinalizing"
              @click="finalizeCreation"
            >
              {{ isFinalizing ? "建立中..." : "確認建立" }}
            </button>
          </footer>
        </div>
      </div>

      <!-- 取消創建確認對話框 -->
      <div
        v-if="isCancelConfirmVisible"
        class="generating__summary"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-confirm-title"
      >
        <div
          class="generating__summary-backdrop"
          aria-hidden="true"
          @click="closeCancelConfirm"
        ></div>
        <div class="generating__summary-panel">
          <header class="generating__summary-header">
            <h2 id="cancel-confirm-title">確認取消創建</h2>
            <p>關閉後將會取消角色創建，且不會返還創建角色次數。</p>
            <button
              type="button"
              class="generating__summary-close"
              aria-label="關閉確認視窗"
              @click="closeCancelConfirm"
            >
              ×
            </button>
          </header>
          <footer class="generating__summary-actions">
            <button
              type="button"
              class="generating__summary-action generating__summary-action--ghost"
              @click="closeCancelConfirm"
            >
              繼續編輯
            </button>
            <button
              type="button"
              class="generating__summary-action generating__summary-action--danger"
              @click="confirmCancelCreation"
            >
              確認取消
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.generating {
  min-height: 100vh;
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

.generating__header {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.generating__step-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.78);
}

.generating__back {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.generating__back:hover {
  border-color: rgba(255, 255, 255, 0.36);
  background-color: rgba(255, 255, 255, 0.08);
}

.generating__back-icon {
  width: 18px;
  height: 18px;
}

.generating__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  height: 176vw;
}

.generating__glow {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.generating__emblem {
  width: 176px;
  height: 176px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.generating__emblem-ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    rgba(255, 123, 189, 0.82) 0%,
    rgba(255, 50, 135, 0.6) 35%,
    rgba(0, 0, 0, 0) 80%
  );
  filter: blur(10px);
}

.generating__emblem-heart {
  width: 140px;
  height: 140px;
  border-radius: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.generating__emblem-heart::before,
.generating__emblem-heart::after {
  content: "";
  position: absolute;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle at 50% 50%, #ff9fd0 0%, #ff3b99 90%);
  border-radius: 50%;
  opacity: 0.72;
  filter: blur(18px);
}

.generating__emblem-heart::before {
  transform: translateX(-46px) translateY(-42px);
}

.generating__emblem-heart::after {
  transform: translateX(46px) translateY(-42px);
}

.generating__emblem-image {
  width: 12rem;
  object-fit: contain;
}

.generating__progress-value {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 0;
}

.generating__progress-status {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.03em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.generating__progress-status-text {
  display: inline-flex;
  align-items: center;
}

.generating__error {
  margin-top: 16px;
  padding: 12px 18px;
  border-radius: 12px;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
  font-size: 14px;
  letter-spacing: 0.04em;
  text-align: center;
}

.generating__warning {
  margin-top: 16px;
  padding: 12px 18px;
  border-radius: 12px;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: center;
}

.generating__progress-dots {
  display: inline-flex;
  align-items: flex-end;
  gap: 4px;
  height: 1em;
}

.generating__progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.68);
  opacity: 0.2;
  transform: translateY(0);
  animation: generatingDot 1.2s ease-in-out infinite;
}

.generating__progress-dot--2 {
  animation-delay: 0.2s;
}

.generating__progress-dot--3 {
  animation-delay: 0.4s;
}

@keyframes generatingDot {
  0%,
  80%,
  100% {
    opacity: 0.2;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

@keyframes cardFlip {
  0% {
    transform: rotateY(0deg) scale(1);
  }
  50% {
    transform: rotateY(180deg) scale(1.05);
  }
  100% {
    transform: rotateY(360deg) scale(1);
  }
}

@keyframes emblemFloat {
  0%,
  100% {
    transform: translateY(0px) scale(1);
  }
  50% {
    transform: translateY(-8px) scale(1.1);
  }
}

.generating__card-preview {
  display: flex;
  align-items: center;
  justify-content: center;
}

.generating__card {
  width: 116px;
  height: 168px;
  border-radius: 18px;
  background: linear-gradient(180deg, #621232 0%, #bd195f 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 12px 40px rgba(255, 35, 149, 0.35);
  animation: cardFlip 3s ease-in-out infinite;
  transform-style: preserve-3d;
}

.generating__card-emblem {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(19, 0, 8, 0.92);
  animation: emblemFloat 2s ease-in-out infinite;
}

.generating__card-emblem-image {
  width: 4rem;
  object-fit: contain;
}

.generating__body--complete {
  justify-content: flex-end;
  padding: 0;
}

.generating__hero {
  width: 100%;
  margin: 0 auto;
  overflow: hidden;
  position: absolute;
  top: 0;
}

.generating__hero-frame {
  position: relative;
  width: 100%;
}

.generating__hero-image {
  width: 100%;
  object-fit: cover;
  display: block;
}

.generating__hero-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  letter-spacing: 0.08em;
}

.generating__results {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.generating__results-heading {
  font-size: 18px;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
}

.generating__result-scroll {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  margin: 0;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  width: 17rem;
  margin-left: 7rem;
}

.generating__result-button {
  border: 2px solid transparent;
  border-radius: 18px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.08);
  transition: border-color 0.2s ease, transform 0.2s ease,
    background-color 0.2s ease;
  scroll-snap-align: center;
  flex: none;
  min-width: 92px;
}

.generating__result-button:focus-visible {
  outline: none;
  border-color: #ff5abc;
}

.generating__result-button--selected {
  border-color: #ff5abc;
  background: rgba(255, 90, 188, 0.18);
}

.generating__result-button:disabled {
  cursor: default;
  opacity: 0.7;
}

.generating__result-image {
  display: block;
  width: 88px;
  height: 120px;
  object-fit: cover;
  border-radius: 14px;
}

.generating__result-scroll::-webkit-scrollbar {
  height: 6px;
}

.generating__result-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
}

.generating__settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 12px;
  overflow-y: auto;
  height: 180vw;
}

.generating__settings-hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  height: 11rem;
  width: 8rem;
  margin: auto;
}

.generating__settings-portrait {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
}

.generating__settings-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.generating__settings-portrait-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.08em;
}

.generating__settings-step {
  font-size: 12px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.generating__settings-name {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0;
}

.generating__settings-tagline {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.75);
}

.generating__settings-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.generating__settings-tag {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.06);
}

.generating__settings-card {
  border-radius: 22px;
  padding: 20px 18px;
  background: rgba(14, 14, 20, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.04);
  box-shadow: 0 14px 40px rgba(6, 6, 12, 0.42);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.generating__settings-card-header h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.08em;
}

.generating__settings-card-header p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.65);
}

.generating__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.generating__field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.generating__field-control {
  display: block;
}

.generating__field-label {
  font-size: 14px;
  letter-spacing: 0.07em;
  color: rgba(255, 255, 255, 0.78);
}

.generating__magic-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.generating__magic-button svg {
  width: 16px;
  height: 16px;
}

.generating__magic-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.generating__magic-button--loading svg {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.generating__field-info {
  font-size: 13px;
  color: #7ec9ff;
  padding: 6px 12px;
  background: rgba(126, 201, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(126, 201, 255, 0.2);
}

.generating__field-error {
  font-size: 13px;
  color: #ff6b6b;
  padding: 6px 12px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 107, 107, 0.2);
}

.generating__input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(14, 14, 22, 0.9);
  color: #ffffff;
  font-size: 16px;
  letter-spacing: 0.04em;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.generating__input:focus-visible {
  border-color: rgba(255, 119, 195, 0.95);
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 119, 195, 0.24);
}

.generating__field-meta {
  display: flex;
  justify-content: flex-end;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.48);
}

.generating__field-meta--end {
  margin-top: -6px;
}

.generating__textarea {
  width: 100%;
  resize: vertical;
  min-height: 140px;
  border-radius: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 12, 18, 0.9);
  color: #ffffff;
  font-size: 15px;
  line-height: 1.6;
  letter-spacing: 0.05em;
}

.generating__textarea:focus-visible {
  border-color: rgba(255, 119, 195, 0.95);
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 119, 195, 0.24);
}

.generating__footer {
  display: flex;
  justify-content: center;
  padding-top: 5vw;
}

.generating__confirm {
  width: min(420px, 100%);
  padding: 14px 20px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.generating__confirm:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.generating__confirm:not(:disabled):hover {
  transform: translateY(-1px);
}

.generating__confirm:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}

.generating__summary {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.generating__summary-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(5, 5, 8, 0.82);
  backdrop-filter: blur(4px);
}

.generating__summary-panel {
  position: relative;
  width: min(480px, 100%);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(15, 15, 20, 0.96);
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 20px 50px rgba(4, 4, 10, 0.65);
}

.generating__summary-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.generating__summary-header h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.08em;
}

.generating__summary-header p {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.68);
}

.generating__summary-close {
  position: absolute;
  top: 0;
  right: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 22px;
  cursor: pointer;
}

.generating__summary-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.generating__summary-preview {
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(22, 22, 30, 0.9);
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.generating__summary-preview img {
  width: 100%;
  display: block;
  object-fit: cover;
}

.generating__summary-placeholder {
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.08em;
}

.generating__summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.generating__summary-item {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 12px;
  font-size: 14px;
  letter-spacing: 0.05em;
}

.generating__summary-item dt {
  color: rgba(255, 255, 255, 0.54);
}

.generating__summary-item dd {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
}

.generating__summary-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.generating__summary-action {
  border-radius: 999px;
  padding: 12px 16px;
  font-size: 15px;
  letter-spacing: 0.08em;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.generating__summary-action--ghost {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.88);
}

.generating__summary-action--primary {
  background: linear-gradient(90deg, #ff458f 0%, #ff7eca 100%);
  color: #ffffff;
}

.generating__summary-action--danger {
  background: linear-gradient(90deg, #ff4545 0%, #ff7070 100%);
  color: #ffffff;
}

.generating__summary-action:disabled {
  opacity: 0.52;
  cursor: not-allowed;
}

.generating__summary-action:not(:disabled):hover {
  transform: translateY(-1px);
}

@media (min-width: 640px) {
  .generating {
    padding: 32px 24px 40px;
  }

  .generating__body--complete {
    gap: 36px;
  }

  .generating__result-image {
    width: 96px;
    height: 132px;
  }

  .generating__result-button {
    min-width: 100px;
  }
}

@media (min-width: 768px) {
  .generating__settings {
    gap: 28px;
  }

  .generating__settings-hero {
    flex-direction: row;
    align-items: stretch;
  }

  .generating__settings-portrait {
    flex: 1 1 48%;
    min-height: 260px;
  }

  .generating__summary-panel {
    width: min(520px, 90%);
  }

  .generating__summary-actions {
    flex-direction: row;
    justify-content: space-between;
  }

  .generating__summary-action {
    flex: 1;
  }
}
</style>
