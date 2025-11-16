// @ts-nocheck
import { ref, type Ref } from 'vue';
import {
  fetchCharacterCreationFlow,
  updateCharacterCreationFlow,
  readStoredCharacterCreationFlowId,
  storeCharacterCreationFlowId,
  clearStoredCharacterCreationFlowId,
  createCharacterCreationFlow,
} from '../../services/characterCreation.service.js';

const SUMMARY_STORAGE_KEY = 'character-create-summary';
const GENDER_STORAGE_KEY = 'characterCreation.gender';
const ALLOWED_GENDERS = new Set(['male', 'female', 'non-binary']);

// Type Definitions
type Gender = 'male' | 'female' | 'non-binary' | '';

type FlowStatus = 'draft' | 'voice' | 'generating' | 'completed' | 'failed';

interface PersonaData {
  name: string;
  tagline: string;
  hiddenProfile: string;
  prompt: string;
}

interface VoicePreset {
  id: string;
  label: string;
  description: string;
  gender: string;
  ageGroup: string;
}

interface VoicePayload {
  id: string;
  label: string;
  description: string;
  gender: string;
  ageGroup: string;
}

interface SummaryData {
  persona: PersonaData;
  appearance: unknown | null;
  voice: VoicePayload | null;
  gender: Gender;
  updatedAt: number;
}

interface FlowMetadata {
  gender?: Gender;
}

interface FlowRecord {
  id?: string;
  status?: FlowStatus;
  persona?: PersonaData;
  appearance?: unknown | null;
  voice?: VoicePayload | null;
  metadata?: FlowMetadata;
}

interface FlowPayload {
  status: FlowStatus;
  persona: PersonaData;
  appearance: unknown | null;
  voice: VoicePayload | null;
  metadata?: FlowMetadata;
}

interface UseFlowSyncReturn {
  // 狀態
  flowId: Ref<string>;
  flowStatus: Ref<FlowStatus>;
  isFlowInitializing: Ref<boolean>;
  isSyncingSummary: Ref<boolean>;
  lastFlowSyncError: Ref<Error | null>;
  isReadyForSync: Ref<boolean>;
  hasLoadedSummary: Ref<boolean>;
  summaryData: Ref<SummaryData>;
  suppressSync: boolean;

  // 方法
  normalizeGenderPreference: (value: unknown) => Gender;
  readStoredGenderPreference: () => Gender;
  persistSummaryToSession: (summary: SummaryData) => void;
  toVoicePayload: (preset: VoicePreset | null | undefined) => VoicePayload | null;
  buildSummaryPayload: (voiceOverride?: VoicePayload | null) => SummaryData;
  buildMetadataPayload: (summary?: SummaryData | null) => FlowMetadata | undefined;
  applyFlowRecord: (record: FlowRecord | null, onGenderChange?: (gender: Gender) => void) => SummaryData | undefined;
  ensureFlowInitialized: () => Promise<string>;
  syncSummaryToBackend: (payload?: Partial<FlowPayload>) => Promise<void>;
  scheduleVoiceSync: (nextSummary: SummaryData) => void;
  updateVoiceSelection: (voicePreset: VoicePreset | null | undefined) => void;
  loadSessionSummary: () => SummaryData | null;
  initializeFlowState: () => Promise<SummaryData | null>;
  clearStoredData: () => void;
  cleanupTimers: () => void;
}

/**
 * 角色創建流程同步管理
 * 負責與後端 API 同步、SessionStorage 管理
 */
export function useFlowSync(): UseFlowSyncReturn {
  const flowId = ref<string>('');
  const flowStatus = ref<FlowStatus>('draft');
  const isFlowInitializing = ref<boolean>(false);
  const isSyncingSummary = ref<boolean>(false);
  const lastFlowSyncError = ref<Error | null>(null);
  const isReadyForSync = ref<boolean>(false);
  const hasLoadedSummary = ref<boolean>(false);

  const summaryData = ref<SummaryData>({
    persona: {
      name: '',
      tagline: '',
      hiddenProfile: '',
      prompt: '',
    },
    appearance: null,
    voice: null,
    gender: '',
    updatedAt: Date.now(),
  });

  let voiceSyncTimer: number | null = null;
  let flowInitPromise: Promise<string> | null = null;
  let suppressSync = false;

  /**
   * 規範化性別值
   */
  const normalizeGenderPreference = (value: unknown): Gender => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    return ALLOWED_GENDERS.has(trimmed) ? (trimmed as Gender) : '';
  };

  /**
   * 從 SessionStorage 讀取性別偏好
   */
  const readStoredGenderPreference = (): Gender => {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return '';
    }
    try {
      return (window.sessionStorage.getItem(GENDER_STORAGE_KEY) ?? '') as Gender;
    } catch (error) {
      return '';
    }
  };

  /**
   * 持久化摘要到 SessionStorage
   */
  const persistSummaryToSession = (summary: SummaryData): void => {
    summaryData.value = summary;
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }
    try {
      window.sessionStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summary));
    } catch (error) {
      // 忽略：SessionStorage 可能已滿或被阻擋，不影響主功能
    }
  };

  /**
   * 構建語音 payload
   */
  const toVoicePayload = (preset: VoicePreset | null | undefined): VoicePayload | null => {
    if (!preset) {
      return null;
    }
    return {
      id: preset.id ?? '',
      label: preset.label ?? '',
      description: preset.description ?? '',
      gender: preset.gender ?? '',
      ageGroup: preset.ageGroup ?? '',
    };
  };

  /**
   * 構建摘要 payload
   */
  const buildSummaryPayload = (voiceOverride: VoicePayload | null = null): SummaryData => {
    const base = summaryData.value ?? {} as SummaryData;
    const voice =
      voiceOverride ??
      (base.voice && typeof base.voice === 'object' ? { ...base.voice } : null);
    return {
      persona: {
        name: base?.persona?.name ?? '',
        tagline: base?.persona?.tagline ?? '',
        hiddenProfile: base?.persona?.hiddenProfile ?? '',
        prompt: base?.persona?.prompt ?? '',
      },
      appearance: base?.appearance ?? null,
      voice,
      gender: base?.gender ?? '',
      updatedAt: Date.now(),
    };
  };

  /**
   * 構建 metadata payload
   */
  const buildMetadataPayload = (summary: SummaryData | null = null): FlowMetadata | undefined => {
    const source =
      summary && typeof summary === 'object' ? summary : summaryData.value;
    const normalized = normalizeGenderPreference(source?.gender ?? '');
    return normalized ? { gender: normalized } : undefined;
  };

  /**
   * 應用 Flow 記錄到本地狀態
   */
  const applyFlowRecord = (record: FlowRecord | null, onGenderChange?: (gender: Gender) => void): SummaryData | undefined => {
    if (!record || typeof record !== 'object') {
      return;
    }
    flowId.value = record.id ?? flowId.value;
    flowStatus.value = record.status ?? flowStatus.value;

    const normalizedGender = normalizeGenderPreference(
      record?.metadata?.gender ?? summaryData.value.gender ?? ''
    );

    const summary: SummaryData = {
      persona: {
        name: record?.persona?.name ?? '',
        tagline: record?.persona?.tagline ?? '',
        hiddenProfile: record?.persona?.hiddenProfile ?? '',
        prompt: record?.persona?.prompt ?? '',
      },
      appearance: record?.appearance ?? null,
      voice: record?.voice ?? null,
      gender: normalizedGender,
      updatedAt: Date.now(),
    };

    suppressSync = true;
    summaryData.value = summary;
    suppressSync = false;

    if (onGenderChange) {
      onGenderChange(normalizedGender);
    }

    persistSummaryToSession(summary);
    if (record?.id) {
      storeCharacterCreationFlowId(record.id);
    }

    return summary;
  };

  /**
   * 確保 Flow 已初始化
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
            applyFlowRecord(existing);
            flowId.value = existing?.id ?? '';
            return flowId.value;
          } catch (error: unknown) {
            const err = error as { status?: number };
            if (err?.status !== 404) {
              throw error;
            }
          }
        }

        const summary = buildSummaryPayload();
        const created = await createCharacterCreationFlow({
          status: 'voice',
          persona: summary.persona,
          appearance: summary.appearance,
          voice: summary.voice,
        });
        applyFlowRecord(created);
        flowId.value = created?.id ?? '';
        return flowId.value;
      } finally {
        isFlowInitializing.value = false;
      }
    })()
      .catch((error: unknown): string => {
        lastFlowSyncError.value = error as Error;
        return '';
      })
      .finally((): void => {
        flowInitPromise = null;
      });

    return flowInitPromise;
  };

  /**
   * 同步摘要到後端
   */
  const syncSummaryToBackend = async (payload: Partial<FlowPayload> = {}): Promise<void> => {
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
      const updated = await updateCharacterCreationFlow(flowId.value, payload);
      applyFlowRecord(updated);
      lastFlowSyncError.value = null;
    } catch (error: unknown) {
      lastFlowSyncError.value = error as Error;
    } finally {
      isSyncingSummary.value = false;
    }
  };

  /**
   * 排程語音同步
   */
  const scheduleVoiceSync = (nextSummary: SummaryData): void => {
    persistSummaryToSession(nextSummary);

    if (!isReadyForSync.value || typeof window === 'undefined') {
      return;
    }

    if (voiceSyncTimer) {
      window.clearTimeout(voiceSyncTimer);
      voiceSyncTimer = null;
    }

    voiceSyncTimer = window.setTimeout((): void => {
      voiceSyncTimer = null;
      const metadata = buildMetadataPayload(nextSummary);
      const payload: Partial<FlowPayload> = {
        persona: nextSummary.persona,
        appearance: nextSummary.appearance,
        voice: nextSummary.voice,
        status: 'voice',
      };
      if (metadata) {
        payload.metadata = metadata;
      }
      syncSummaryToBackend(payload).catch((): void => {});
    }, 400);
  };

  /**
   * 更新語音選擇
   */
  const updateVoiceSelection = (voicePreset: VoicePreset | null | undefined): void => {
    const summary = buildSummaryPayload(toVoicePayload(voicePreset));
    persistSummaryToSession(summary);
    scheduleVoiceSync(summary);
  };

  /**
   * 從 SessionStorage 載入摘要
   */
  const loadSessionSummary = (): SummaryData | null => {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }
    try {
      const raw = window.sessionStorage.getItem(SUMMARY_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      summaryData.value = {
        persona: {
          name: parsed?.persona?.name ?? '',
          tagline: parsed?.persona?.tagline ?? '',
          hiddenProfile: parsed?.persona?.hiddenProfile ?? '',
          prompt: parsed?.persona?.prompt ?? '',
        },
        appearance: parsed?.appearance ?? null,
        voice: parsed?.voice ?? null,
        gender: parsed?.gender ?? '',
        updatedAt: parsed?.updatedAt ?? Date.now(),
      };
      return summaryData.value;
    } catch (error) {
      // 忽略：SessionStorage 解析失敗，使用預設值
      return null;
    }
  };

  /**
   * 初始化流程狀態
   */
  const initializeFlowState = async (): Promise<SummaryData | null> => {
    const summary = loadSessionSummary();
    try {
      await ensureFlowInitialized();
    } catch (error) {
      // 靜默處理錯誤
    } finally {
      isReadyForSync.value = true;
      hasLoadedSummary.value = true;
    }
    return summary;
  };

  /**
   * 清理暫存資料
   */
  const clearStoredData = (): void => {
    clearStoredCharacterCreationFlowId();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(SUMMARY_STORAGE_KEY);
        window.sessionStorage.removeItem(GENDER_STORAGE_KEY);
        // 清除所有性別的 AI Magician 計數器
        ['male', 'female', 'non-binary'].forEach((gender: string): void => {
          window.sessionStorage.removeItem(`ai-magician-usage-${gender}`);
        });
      } catch {}
    }
  };

  /**
   * 清理定時器
   */
  const cleanupTimers = (): void => {
    if (typeof window !== 'undefined' && voiceSyncTimer) {
      window.clearTimeout(voiceSyncTimer);
      voiceSyncTimer = null;
    }
  };

  return {
    // 狀態
    flowId,
    flowStatus,
    isFlowInitializing,
    isSyncingSummary,
    lastFlowSyncError,
    isReadyForSync,
    hasLoadedSummary,
    summaryData,
    suppressSync,

    // 方法
    normalizeGenderPreference,
    readStoredGenderPreference,
    persistSummaryToSession,
    toVoicePayload,
    buildSummaryPayload,
    buildMetadataPayload,
    applyFlowRecord,
    ensureFlowInitialized,
    syncSummaryToBackend,
    scheduleVoiceSync,
    updateVoiceSelection,
    loadSessionSummary,
    initializeFlowState,
    clearStoredData,
    cleanupTimers,
  };
}
