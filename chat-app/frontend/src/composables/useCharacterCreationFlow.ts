import { ref, Ref, onBeforeUnmount } from "vue";
import {
  createCharacterCreationFlow,
  fetchCharacterCreationFlow,
  storeCharacterCreationFlowId,
  readStoredCharacterCreationFlowId,
  updateCharacterCreationFlow,
} from "../services/characterCreation.service.js";
import { logger } from "../utils/logger.js";

const CREATION_SUMMARY_STORAGE_KEY = "character-create-summary";

/**
 * Character appearance data structure
 */
interface CharacterAppearance {
  id: string;
  label: string;
  image: string;
  alt: string;
  description: string;
  styles: string[];
  referenceInfo: Record<string, any> | null;
}

/**
 * Character persona data structure
 */
interface CharacterPersona {
  name: string;
  tagline: string;
  hiddenProfile: string;
  prompt: string;
}

/**
 * Summary payload structure
 */
interface SummaryPayload {
  persona: CharacterPersona;
  appearance: CharacterAppearance | null;
  gender: string;
  updatedAt: number;
}

/**
 * Metadata payload structure
 */
interface MetadataPayload {
  gender: string;
}

/**
 * Flow record structure
 */
interface FlowRecord {
  id?: string;
  status?: string;
  persona?: CharacterPersona;
  appearance?: CharacterAppearance;
  metadata?: {
    gender?: string;
  };
}

// API 返回的資料可能有可選欄位，使用這個類型進行轉換
type ApiFlowRecord = {
  id?: string;
  status?: string;
  persona?: Partial<CharacterPersona>;
  appearance?: Partial<CharacterAppearance>;
  metadata?: {
    gender?: string;
  };
};

/**
 * Saved appearance data structure
 */
interface SavedAppearanceData {
  description: string;
  styles: string[];
  referenceInfo: Record<string, any> | null;
}

/**
 * Options for applyFlowRecord
 */
interface ApplyFlowRecordOptions {
  skipSession?: boolean;
}

/**
 * Options for syncSummaryToBackend
 */
interface SyncSummaryOptions {
  summary?: SummaryPayload | null;
  statusOverride?: string;
}

/**
 * Options for scheduleBackendSync
 */
interface ScheduleBackendSyncOptions {
  summary?: SummaryPayload | null;
  statusOverride?: string;
  immediate?: boolean;
  delay?: number;
}

/**
 * Persona form data structure
 */
interface PersonaForm {
  name: string;
  tagline: string;
  hiddenProfile: string;
  prompt: string;
}

/**
 * Composable options structure
 */
interface UseCharacterCreationFlowOptions {
  personaForm?: PersonaForm;
  selectedResult?: Ref<CharacterAppearance | null>;
  selectedResultId?: Ref<string>;
  selectedResultLabel?: Ref<string>;
  selectedResultImage?: Ref<string>;
  selectedResultAlt?: Ref<string>;
  genderPreference?: Ref<string>;
  normalizeGenderPreference?: (gender: string) => string;
  readStoredGenderPreference?: () => string | null;
  ensureGenderPreference?: (gender?: string) => string;
  currentStep?: Ref<string>;
}

/**
 * Return type for the composable
 */
interface UseCharacterCreationFlowReturn {
  // Reactive state
  flowId: Ref<string>;
  flowStatus: Ref<string>;
  isFlowInitializing: Ref<boolean>;
  isSyncingSummary: Ref<boolean>;
  lastFlowSyncError: Ref<Error | null>;
  isReadyForSync: Ref<boolean>;
  savedAppearanceData: Ref<SavedAppearanceData | null>;

  // Methods
  buildSummaryPayload: () => SummaryPayload;
  buildMetadataPayload: (summary?: SummaryPayload | null) => MetadataPayload | undefined;
  persistSummaryToSession: (summary: SummaryPayload) => void;
  restoreSummaryFromSession: () => SummaryPayload | null;
  applyFlowRecord: (record: FlowRecord, options?: ApplyFlowRecordOptions) => void;
  ensureFlowInitialized: () => Promise<string>;
  syncSummaryToBackend: (options?: SyncSummaryOptions) => Promise<void>;
  scheduleBackendSync: (options?: ScheduleBackendSyncOptions) => void;
  initializeFlowState: () => Promise<void>;
  cleanup: () => void;
  getSuppressSync: () => boolean;
  setSuppressSync: (value: boolean) => void;
}

/**
 * Character Creation Flow Composable
 * 管理角色創建流程的狀態和後端同步
 */
export function useCharacterCreationFlow(
  options: UseCharacterCreationFlowOptions = {}
): UseCharacterCreationFlowReturn {
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
  const flowId: Ref<string> = ref("");
  const flowStatus: Ref<string> = ref("draft");
  const isFlowInitializing: Ref<boolean> = ref(false);
  const isSyncingSummary: Ref<boolean> = ref(false);
  const lastFlowSyncError: Ref<Error | null> = ref(null);
  const isReadyForSync: Ref<boolean> = ref(false);
  const savedAppearanceData: Ref<SavedAppearanceData | null> = ref(null);

  let summarySyncTimer: ReturnType<typeof setTimeout> | null = null;
  let flowInitPromise: Promise<string> | null = null;
  let suppressSync: boolean = false;

  /**
   * 構建摘要數據
   */
  const buildSummaryPayload = (): SummaryPayload => {
    const appearance: CharacterAppearance | null = selectedResult?.value
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

    // 防禦性檢查：確保必要參數存在
    const persona: CharacterPersona = personaForm
      ? {
          name: personaForm.name?.trim() ?? "",
          tagline: personaForm.tagline?.trim() ?? "",
          hiddenProfile: personaForm.hiddenProfile?.trim() ?? "",
          prompt: personaForm.prompt?.trim() ?? "",
        }
      : { name: "", tagline: "", hiddenProfile: "", prompt: "" };

    return {
      persona,
      appearance,
      gender: genderPreference?.value ?? "",
      updatedAt: Date.now(),
    };
  };

  /**
   * 構建元數據
   */
  const buildMetadataPayload = (summary: SummaryPayload | null = null): MetadataPayload | undefined => {
    const source = summary && typeof summary === "object" ? summary : null;
    const rawGender: string =
      source && typeof source.gender === "string"
        ? source.gender
        : genderPreference?.value ?? "";

    // 如果沒有提供 normalizeGenderPreference，直接返回原始值
    const normalized = normalizeGenderPreference
      ? normalizeGenderPreference(rawGender)
      : rawGender;
    return normalized ? { gender: normalized } : undefined;
  };

  /**
   * 將摘要保存到 sessionStorage
   */
  const persistSummaryToSession = (summary: SummaryPayload): void => {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }
    try {
      // 不儲存大型 base64 圖片，僅儲存必要元數據
      const sanitizedSummary: Omit<SummaryPayload, 'appearance'> & { appearance: Omit<CharacterAppearance, 'image' | 'alt' | 'description' | 'styles' | 'referenceInfo'> | null } = {
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
      // ✅ 修復：記錄 sessionStorage 錯誤，便於調試
      logger.warn('[useCharacterCreationFlow] 保存摘要到 sessionStorage 失敗:', error);
    }
  };

  /**
   * 從 sessionStorage 恢復摘要
   */
  const restoreSummaryFromSession = (): SummaryPayload | null => {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return null;
    }
    try {
      const raw = window.sessionStorage.getItem(CREATION_SUMMARY_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed: Partial<SummaryPayload> = JSON.parse(raw);

      // ✅ 修復：驗證解析後的數據結構
      if (!parsed || typeof parsed !== 'object') {
        logger.warn('[useCharacterCreationFlow] sessionStorage 數據格式無效');
        return null;
      }

      const storedGender = readStoredGenderPreference ? readStoredGenderPreference() : null;
      const genderToUse = storedGender || parsed?.gender;

      suppressSync = true;
      if (personaForm) {
        personaForm.name = parsed?.persona?.name ?? "";
        personaForm.tagline = parsed?.persona?.tagline ?? "";
        personaForm.hiddenProfile = parsed?.persona?.hiddenProfile ?? "";
        personaForm.prompt = parsed?.persona?.prompt ?? "";
      }
      if (parsed?.appearance?.id && selectedResultId) {
        selectedResultId.value = parsed.appearance.id;
      }
      if (ensureGenderPreference) {
        ensureGenderPreference(genderToUse);
      }
      suppressSync = false;
      return parsed as SummaryPayload;
    } catch (error) {
      // ✅ 修復：記錄解析錯誤，便於調試
      logger.warn('[useCharacterCreationFlow] 從 sessionStorage 恢復摘要失敗:', error);
      suppressSync = false;
      return null;
    }
  };

  /**
   * 應用流程記錄到本地狀態
   * @param record - 流程記錄（可以是完整的 FlowRecord 或來自 API 的部分資料）
   */
  const applyFlowRecord = (record: FlowRecord | ApiFlowRecord, options: ApplyFlowRecordOptions = {}): void => {
    if (!record || typeof record !== "object") {
      return;
    }

    flowId.value = record.id ?? flowId.value;
    flowStatus.value = record.status ?? flowStatus.value;

    suppressSync = true;
    if (personaForm) {
      personaForm.name = record?.persona?.name ?? "";
      personaForm.tagline = record?.persona?.tagline ?? "";
      personaForm.hiddenProfile = record?.persona?.hiddenProfile ?? "";
      personaForm.prompt = record?.persona?.prompt ?? "";
    }
    if (selectedResultId) {
      selectedResultId.value = record?.appearance?.id ?? "";
    }

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

    const rawGender = genderPreference?.value || record?.metadata?.gender || "";
    const normalizedGender = ensureGenderPreference
      ? ensureGenderPreference(rawGender)
      : rawGender;

    // 將部分 appearance 資料轉換為完整格式
    const fullAppearance: CharacterAppearance | null = record?.appearance
      ? {
          id: record.appearance.id ?? "",
          label: record.appearance.label ?? "",
          image: record.appearance.image ?? "",
          alt: record.appearance.alt ?? "",
          description: record.appearance.description ?? "",
          styles: record.appearance.styles ?? [],
          referenceInfo: record.appearance.referenceInfo ?? null,
        }
      : null;

    const summary: SummaryPayload = {
      persona: personaForm
        ? {
            name: personaForm.name ?? "",
            tagline: personaForm.tagline ?? "",
            hiddenProfile: personaForm.hiddenProfile ?? "",
            prompt: personaForm.prompt ?? "",
          }
        : { name: "", tagline: "", hiddenProfile: "", prompt: "" },
      appearance: fullAppearance,
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
  const ensureFlowInitialized = async (): Promise<string> => {
    if (flowId.value) {
      return flowId.value;
    }

    if (flowInitPromise) {
      return flowInitPromise;
    }

    flowInitPromise = (async (): Promise<string> => {
      isFlowInitializing.value = true;
      try {
        const storedId = readStoredCharacterCreationFlowId();
        if (storedId) {
          try {
            const existing = await fetchCharacterCreationFlow(storedId);
            if (existing) {
              applyFlowRecord(existing);
              flowId.value = existing.id ?? "";
              return flowId.value;
            }
          } catch (error: any) {
            if (error?.status !== 404) {
              throw error;
            }
          }
        }

        const summary = buildSummaryPayload();
        const metadata = buildMetadataPayload(summary);
        const status: string =
          selectedResultId?.value && summary.appearance ? "appearance" : "pending";

        const creationPayload: any = {
          status,
          persona: summary.persona,
          appearance: summary.appearance,
        };
        if (metadata) {
          creationPayload.metadata = metadata;
        }
        const created = await createCharacterCreationFlow(creationPayload);
        if (created) {
          applyFlowRecord(created);
          flowId.value = created.id ?? "";
        }
        return flowId.value;
      } finally {
        isFlowInitializing.value = false;
      }
    })()
      .catch((error: Error) => {
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
  const syncSummaryToBackend = async (options: SyncSummaryOptions = {}): Promise<void> => {
    const summary: SummaryPayload =
      options.summary && typeof options.summary === "object"
        ? options.summary
        : buildSummaryPayload();

    const statusOverride = options.statusOverride;
    const status: string =
      statusOverride ||
      (currentStep?.value === "settings"
        ? "persona"
        : selectedResultId?.value
        ? "appearance"
        : "pending");

    try {
      await ensureFlowInitialized();
    } catch (error) {
      // 🔥 修復：重新拋出初始化錯誤，讓調用者知道失敗了
      logger.error('[useCharacterCreationFlow] Flow 初始化失敗:', error);
      throw new Error('無法初始化角色創建流程，請檢查網絡連接');
    }

    if (!flowId.value) {
      // 🔥 修復：沒有 flowId 時拋出錯誤
      throw new Error('缺少角色創建流程 ID，請重新開始創建流程');
    }

    try {
      isSyncingSummary.value = true;
      const metadata = buildMetadataPayload(summary);
      const payload: any = {
        persona: summary.persona,
        appearance: summary.appearance,
        status,
      };
      if (metadata) {
        payload.metadata = metadata;
      }
      const updated = await updateCharacterCreationFlow(flowId.value, payload);
      if (updated) {
        applyFlowRecord(updated);
      }
      lastFlowSyncError.value = null;
    } catch (error: any) {
      lastFlowSyncError.value = error;
      // 🔥 修復：重新拋出同步錯誤，讓調用者知道失敗了
      logger.error('[useCharacterCreationFlow] 同步摘要到後端失敗:', error);
      throw new Error(error?.message || '保存角色資料失敗，請檢查網絡連接後重試');
    } finally {
      isSyncingSummary.value = false;
    }
  };

  /**
   * 排程後端同步（帶防抖）
   */
  const scheduleBackendSync = (options: ScheduleBackendSyncOptions = {}): void => {
    const summary: SummaryPayload =
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

    const executeSync = (): void => {
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
  const initializeFlowState = async (): Promise<void> => {
    restoreSummaryFromSession();
    if (ensureGenderPreference && genderPreference) {
      ensureGenderPreference(genderPreference.value);
    }
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
  const cleanup = (): void => {
    if (summarySyncTimer) {
      window.clearTimeout(summarySyncTimer);
      summarySyncTimer = null;
    }
  };

  /**
   * 獲取 suppressSync 狀態（供外部使用）
   */
  const getSuppressSync = (): boolean => suppressSync;

  /**
   * 設置 suppressSync 狀態（供外部使用）
   */
  const setSuppressSync = (value: boolean): void => {
    suppressSync = value;
  };

  // ✅ 修復：自動清理定時器，防止記憶體洩漏
  onBeforeUnmount(() => {
    cleanup();
  });

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
