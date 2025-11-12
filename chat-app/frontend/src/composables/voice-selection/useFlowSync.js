import { ref } from 'vue';
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

/**
 * 角色創建流程同步管理
 * 負責與後端 API 同步、SessionStorage 管理
 */
export function useFlowSync() {
  const flowId = ref('');
  const flowStatus = ref('draft');
  const isFlowInitializing = ref(false);
  const isSyncingSummary = ref(false);
  const lastFlowSyncError = ref(null);
  const isReadyForSync = ref(false);
  const hasLoadedSummary = ref(false);

  const summaryData = ref({
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

  let voiceSyncTimer = null;
  let flowInitPromise = null;
  let suppressSync = false;

  /**
   * 規範化性別值
   */
  const normalizeGenderPreference = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    return ALLOWED_GENDERS.has(trimmed) ? trimmed : '';
  };

  /**
   * 從 SessionStorage 讀取性別偏好
   */
  const readStoredGenderPreference = () => {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return '';
    }
    try {
      return window.sessionStorage.getItem(GENDER_STORAGE_KEY) ?? '';
    } catch (error) {
      return '';
    }
  };

  /**
   * 持久化摘要到 SessionStorage
   */
  const persistSummaryToSession = (summary) => {
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
  const toVoicePayload = (preset) => {
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
  const buildSummaryPayload = (voiceOverride = null) => {
    const base = summaryData.value ?? {};
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
  const buildMetadataPayload = (summary = null) => {
    const source =
      summary && typeof summary === 'object' ? summary : summaryData.value;
    const normalized = normalizeGenderPreference(source?.gender ?? '');
    return normalized ? { gender: normalized } : undefined;
  };

  /**
   * 應用 Flow 記錄到本地狀態
   */
  const applyFlowRecord = (record, onGenderChange) => {
    if (!record || typeof record !== 'object') {
      return;
    }
    flowId.value = record.id ?? flowId.value;
    flowStatus.value = record.status ?? flowStatus.value;

    const normalizedGender = normalizeGenderPreference(
      record?.metadata?.gender ?? summaryData.value.gender ?? ''
    );

    const summary = {
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
            flowId.value = existing?.id ?? '';
            return flowId.value;
          } catch (error) {
            if (error?.status !== 404) {
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
      .catch((error) => {
        lastFlowSyncError.value = error;
        return '';
      })
      .finally(() => {
        flowInitPromise = null;
      });

    return flowInitPromise;
  };

  /**
   * 同步摘要到後端
   */
  const syncSummaryToBackend = async (payload = {}) => {
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
    } catch (error) {
      lastFlowSyncError.value = error;
    } finally {
      isSyncingSummary.value = false;
    }
  };

  /**
   * 排程語音同步
   */
  const scheduleVoiceSync = (nextSummary) => {
    persistSummaryToSession(nextSummary);

    if (!isReadyForSync.value || typeof window === 'undefined') {
      return;
    }

    if (voiceSyncTimer) {
      window.clearTimeout(voiceSyncTimer);
      voiceSyncTimer = null;
    }

    voiceSyncTimer = window.setTimeout(() => {
      voiceSyncTimer = null;
      const metadata = buildMetadataPayload(nextSummary);
      const payload = {
        persona: nextSummary.persona,
        appearance: nextSummary.appearance,
        voice: nextSummary.voice,
        status: 'voice',
      };
      if (metadata) {
        payload.metadata = metadata;
      }
      syncSummaryToBackend(payload).catch(() => {});
    }, 400);
  };

  /**
   * 更新語音選擇
   */
  const updateVoiceSelection = (voicePreset) => {
    const summary = buildSummaryPayload(toVoicePayload(voicePreset));
    persistSummaryToSession(summary);
    scheduleVoiceSync(summary);
  };

  /**
   * 從 SessionStorage 載入摘要
   */
  const loadSessionSummary = () => {
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
  const initializeFlowState = async () => {
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
  const clearStoredData = () => {
    clearStoredCharacterCreationFlowId();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(SUMMARY_STORAGE_KEY);
        window.sessionStorage.removeItem(GENDER_STORAGE_KEY);
        // 清除所有性別的 AI Magician 計數器
        ['male', 'female', 'non-binary'].forEach((gender) => {
          window.sessionStorage.removeItem(`ai-magician-usage-${gender}`);
        });
      } catch {}
    }
  };

  /**
   * 清理定時器
   */
  const cleanupTimers = () => {
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
