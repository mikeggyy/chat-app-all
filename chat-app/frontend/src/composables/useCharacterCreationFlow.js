import { ref } from "vue";
import {
  createCharacterCreationFlow,
  fetchCharacterCreationFlow,
  storeCharacterCreationFlowId,
  readStoredCharacterCreationFlowId,
  updateCharacterCreationFlow,
} from "../services/characterCreation.service.js";

const CREATION_SUMMARY_STORAGE_KEY = "character-create-summary";

/**
 * Character Creation Flow Composable
 * 管理角色創建流程的狀態和後端同步
 */
export function useCharacterCreationFlow(options = {}) {
  const {
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
  } = options;

  // 狀態管理
  const flowId = ref("");
  const flowStatus = ref("draft");
  const isFlowInitializing = ref(false);
  const isSyncingSummary = ref(false);
  const lastFlowSyncError = ref(null);
  const isReadyForSync = ref(false);
  const savedAppearanceData = ref(null);

  let summarySyncTimer = null;
  let flowInitPromise = null;
  let suppressSync = false;

  /**
   * 構建摘要數據
   */
  const buildSummaryPayload = () => {
    const appearance = selectedResult?.value
      ? {
          id: selectedResult.value.id,
          label: selectedResultLabel?.value ?? "",
          image: selectedResultImage?.value ?? "",
          alt: selectedResultAlt?.value ?? "",
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

  /**
   * 構建元數據
   */
  const buildMetadataPayload = (summary = null) => {
    const source = summary && typeof summary === "object" ? summary : null;
    const rawGender =
      source && typeof source.gender === "string"
        ? source.gender
        : genderPreference.value;
    const normalized = normalizeGenderPreference(rawGender);
    return normalized ? { gender: normalized } : undefined;
  };

  /**
   * 將摘要保存到 sessionStorage
   */
  const persistSummaryToSession = (summary) => {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }
    try {
      // 不儲存大型 base64 圖片，僅儲存必要元數據
      const sanitizedSummary = {
        ...summary,
        appearance: summary.appearance
          ? {
              id: summary.appearance.id,
              label: summary.appearance.label,
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

  /**
   * 從 sessionStorage 恢復摘要
   */
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

  /**
   * 應用流程記錄到本地狀態
   */
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

    // 保存完整的 appearance 數據
    if (record?.appearance) {
      savedAppearanceData.value = {
        description: record.appearance.description || "",
        styles: Array.isArray(record.appearance.styles)
          ? [...record.appearance.styles]
          : [],
        referenceInfo: record.appearance.referenceInfo || null,
      };
    }

    suppressSync = false;

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

  /**
   * 確保流程已初始化
   */
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

  /**
   * 同步摘要到後端
   */
  const syncSummaryToBackend = async (options = {}) => {
    const summary =
      options.summary && typeof options.summary === "object"
        ? options.summary
        : buildSummaryPayload();

    const statusOverride = options.statusOverride;
    const status =
      statusOverride ||
      (currentStep?.value === "settings"
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

  /**
   * 排程後端同步（帶防抖）
   */
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

  /**
   * 初始化流程狀態
   */
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

  /**
   * 清理定時器
   */
  const cleanup = () => {
    if (summarySyncTimer) {
      window.clearTimeout(summarySyncTimer);
      summarySyncTimer = null;
    }
  };

  /**
   * 獲取 suppressSync 狀態（供外部使用）
   */
  const getSuppressSync = () => suppressSync;

  /**
   * 設置 suppressSync 狀態（供外部使用）
   */
  const setSuppressSync = (value) => {
    suppressSync = value;
  };

  return {
    // 狀態
    flowId,
    flowStatus,
    isFlowInitializing,
    isSyncingSummary,
    lastFlowSyncError,
    isReadyForSync,
    savedAppearanceData,

    // 方法
    buildSummaryPayload,
    buildMetadataPayload,
    persistSummaryToSession,
    restoreSummaryFromSession,
    applyFlowRecord,
    ensureFlowInitialized,
    syncSummaryToBackend,
    scheduleBackendSync,
    initializeFlowState,
    cleanup,
    getSuppressSync,
    setSuppressSync,
  };
}
