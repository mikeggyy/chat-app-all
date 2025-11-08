<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeftIcon, PlayIcon, PauseIcon } from "@heroicons/vue/24/outline";
import {
  fetchCharacterCreationFlow,
  updateCharacterCreationFlow,
  readStoredCharacterCreationFlowId,
  storeCharacterCreationFlowId,
  clearStoredCharacterCreationFlowId,
  createCharacterCreationFlow,
  finalizeCharacterCreation,
} from "../services/characterCreation.service.js";
import { useUserProfile } from "../composables/useUserProfile.js";
import { useToast } from "../composables/useToast.js";
import CharacterCreatedModal from "../components/CharacterCreatedModal.vue";

const SUMMARY_STORAGE_KEY = "character-create-summary";
const GENDER_STORAGE_KEY = "characterCreation.gender";
const ALLOWED_GENDERS = new Set(["male", "female", "non-binary"]);

const router = useRouter();
const { user } = useUserProfile();
const { success: showSuccess, error: showError } = useToast();

const selectedVoiceId = ref("");
const isPlayingId = ref("");

const flowId = ref("");
const flowStatus = ref("draft");
const isFlowInitializing = ref(false);
const isSyncingSummary = ref(false);
const lastFlowSyncError = ref(null);
const isReadyForSync = ref(false);
const hasLoadedSummary = ref(false);

const summaryData = ref({
  persona: {
    name: "",
    tagline: "",
    hiddenProfile: "",
    prompt: "",
  },
  appearance: null,
  voice: null,
  gender: "",
  updatedAt: Date.now(),
});

const selectedGender = ref("all");
const selectedAge = ref("all");
let suppressGenderWatcher = false;
const hasUserAdjustedGenderFilter = ref(false);

// 角色創建成功彈窗
const isCharacterCreatedModalVisible = ref(false);
const createdCharacter = ref(null);

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

const mapGenderToFilter = (gender) => {
  if (gender === "male" || gender === "female") {
    return gender;
  }
  return "all";
};

const applyGenderDefault = (rawGender) => {
  const normalized =
    normalizeGenderPreference(rawGender) ||
    normalizeGenderPreference(readStoredGenderPreference()) ||
    "";

  summaryData.value.gender = normalized;

  if (!normalized) {
    return;
  }

  const targetFilter = mapGenderToFilter(normalized);

  if (
    hasUserAdjustedGenderFilter.value &&
    selectedGender.value !== targetFilter
  ) {
    return;
  }
  if (selectedGender.value !== targetFilter) {
    suppressGenderWatcher = true;
    selectedGender.value = targetFilter;
  }
};

const buildMetadataPayload = (summary = null) => {
  const source =
    summary && typeof summary === "object" ? summary : summaryData.value;
  const normalized = normalizeGenderPreference(source?.gender ?? "");
  return normalized ? { gender: normalized } : undefined;
};

let voiceSyncTimer = null;
let flowInitPromise = null;
let suppressSync = false;
const audioPlayers = new Map();

const voicePresets = [
  {
    id: "alloy",
    label: "沉穩中性",
    description: "沉穩偏中性的聲音，語調俐落，適合可靠型角色或系統語音。",
    gender: "male",
    ageGroup: "adult",
    previewUrl: "/voices/alloy.mp3",
  },
  {
    id: "ash",
    label: "理性沉著",
    description: "冷靜溫和的男聲，語速平穩，給人理性、沉著的感受。",
    gender: "male",
    ageGroup: "adult",
    previewUrl: "/voices/ash.mp3",
  },
  {
    id: "ballad",
    label: "柔和抒情",
    description: "柔和抒情的男聲，語氣帶有故事感，適合敘事或情感場景。",
    gender: "male",
    ageGroup: "adult",
    previewUrl: "/voices/ballad.mp3",
  },
  {
    id: "coral",
    label: "活力清爽",
    description: "充滿活力的女聲，語氣清爽有精神，能營造親切友善氛圍。",
    gender: "female",
    ageGroup: "teen",
    previewUrl: "/voices/coral.mp3",
  },
  {
    id: "echo",
    label: "低沉磁性",
    description: "低沈厚實的男聲，聲線帶有磁性，適合作為敘述者或權威角色。",
    gender: "male",
    ageGroup: "mature",
    previewUrl: "/voices/echo.mp3",
  },
  {
    id: "fable",
    label: "溫暖柔和",
    description: "溫暖的男聲，語調自然柔和，帶有陪伴與照顧的感受。",
    gender: "male",
    ageGroup: "adult",
    previewUrl: "/voices/fable.mp3",
  },
  {
    id: "onyx",
    label: "堅定專業",
    description: "堅定有力的男聲，語氣清晰，適合專業與指令型角色。",
    gender: "male",
    ageGroup: "adult",
    previewUrl: "/voices/onyx.mp3",
  },
  {
    id: "nova",
    label: "輕快親切",
    description: "輕快親切的女聲，語氣充滿好奇心，適合歡迎或導覽場景。",
    gender: "female",
    ageGroup: "teen",
    previewUrl: "/voices/nova.mp3",
  },
  {
    id: "sage",
    label: "成熟知性",
    description: "穩重睿智的女聲，語調柔和而有深度，帶來安心感。",
    gender: "female",
    ageGroup: "mature",
    previewUrl: "/voices/sage.mp3",
  },
  {
    id: "shimmer",
    label: "明亮靈動",
    description: "明亮靈動的女聲，節奏輕盈，適合活潑或創意型角色。",
    gender: "female",
    ageGroup: "teen",
    previewUrl: "/voices/shimmer.mp3",
  },
  {
    id: "verse",
    label: "詩意感性",
    description: "帶有詩意的男聲，語調富有層次，適合敘事與感性表達。",
    gender: "male",
    ageGroup: "adult",
    previewUrl: "/voices/verse.mp3",
  },
];

const genderOptions = [
  { id: "all", label: "不限性別" },
  { id: "female", label: "女性" },
  { id: "male", label: "男性" },
];

const ageOptions = [
  { id: "all", label: "不限年齡" },
  { id: "teen", label: "少年" },
  { id: "adult", label: "成人" },
  { id: "mature", label: "成熟" },
];

const filteredVoicePresets = computed(() => {
  const gender = selectedGender.value === "all" ? "" : selectedGender.value;
  const age = selectedAge.value === "all" ? "" : selectedAge.value;
  return voicePresets.filter((preset) => {
    const genderMatch = gender ? preset.gender === gender : true;
    const ageMatch = age ? preset.ageGroup === age : true;
    return genderMatch && ageMatch;
  });
});

const personaSummary = computed(
  () =>
    summaryData.value?.persona ?? {
      name: "",
      tagline: "",
      hiddenProfile: "",
      prompt: "",
    }
);

const appearanceSummary = computed(() => summaryData.value?.appearance ?? null);

const voiceSummary = computed(() => {
  if (summaryData.value?.voice) {
    return summaryData.value.voice;
  }
  if (!selectedVoiceId.value) {
    return null;
  }
  return (
    filteredVoicePresets.value.find(
      (preset) => preset.id === selectedVoiceId.value
    ) ?? null
  );
});

const formatGender = (gender) => {
  if (gender === "female") {
    return "女性";
  }
  if (gender === "male") {
    return "男性";
  }
  return "不限";
};

const formatAgeGroup = (ageGroup) => {
  if (ageGroup === "teen") {
    return "少年感";
  }
  if (ageGroup === "adult") {
    return "成人感";
  }
  if (ageGroup === "mature") {
    return "成熟感";
  }
  return "適用所有年齡";
};

const persistSummaryToSession = (summary) => {
  summaryData.value = summary;
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  try {
    window.sessionStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summary));
  } catch (error) {
  }
};

const toVoicePayload = (preset) => {
  if (!preset) {
    return null;
  }
  return {
    id: preset.id ?? "",
    label: preset.label ?? "",
    description: preset.description ?? "",
    gender: preset.gender ?? "",
    ageGroup: preset.ageGroup ?? "",
  };
};

const buildSummaryPayload = (voiceOverride = null) => {
  const base = summaryData.value ?? {};
  const voice =
    voiceOverride ??
    (base.voice && typeof base.voice === "object" ? { ...base.voice } : null);
  return {
    persona: {
      name: base?.persona?.name ?? "",
      tagline: base?.persona?.tagline ?? "",
      hiddenProfile: base?.persona?.hiddenProfile ?? "",
      prompt: base?.persona?.prompt ?? "",
    },
    appearance: base?.appearance ?? null,
    voice,
    gender: base?.gender ?? "",
    updatedAt: Date.now(),
  };
};

const applyFlowRecord = (record) => {
  if (!record || typeof record !== "object") {
    return;
  }
  flowId.value = record.id ?? flowId.value;
  flowStatus.value = record.status ?? flowStatus.value;

  const normalizedGender = normalizeGenderPreference(
    record?.metadata?.gender ?? summaryData.value.gender ?? ""
  );

  const summary = {
    persona: {
      name: record?.persona?.name ?? "",
      tagline: record?.persona?.tagline ?? "",
      hiddenProfile: record?.persona?.hiddenProfile ?? "",
      prompt: record?.persona?.prompt ?? "",
    },
    appearance: record?.appearance ?? null,
    voice: record?.voice ?? null,
    gender: normalizedGender,
    updatedAt: Date.now(),
  };

  suppressSync = true;
  summaryData.value = summary;
  if (record?.voice?.id) {
    selectedVoiceId.value = record.voice.id;
  }
  suppressSync = false;

  applyGenderDefault(normalizedGender);

  persistSummaryToSession(summary);
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
      const created = await createCharacterCreationFlow({
        status: "voice",
        persona: summary.persona,
        appearance: summary.appearance,
        voice: summary.voice,
      });
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

const scheduleVoiceSync = (nextSummary) => {
  persistSummaryToSession(nextSummary);

  if (!isReadyForSync.value || typeof window === "undefined") {
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
      status: "voice",
    };
    if (metadata) {
      payload.metadata = metadata;
    }
    syncSummaryToBackend(payload).catch(() => {});
  }, 400);
};

const updateVoiceSelection = (voiceId) => {
  const preset = voicePresets.find((item) => item.id === voiceId) ?? null;
  const summary = buildSummaryPayload(toVoicePayload(preset));
  persistSummaryToSession(summary);
  scheduleVoiceSync(summary);
};

const loadSessionSummary = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  try {
    const raw = window.sessionStorage.getItem(SUMMARY_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    summaryData.value = {
      persona: {
        name: parsed?.persona?.name ?? "",
        tagline: parsed?.persona?.tagline ?? "",
        hiddenProfile: parsed?.persona?.hiddenProfile ?? "",
        prompt: parsed?.persona?.prompt ?? "",
      },
      appearance: parsed?.appearance ?? null,
      voice: parsed?.voice ?? null,
      gender: parsed?.gender ?? "",
      updatedAt: parsed?.updatedAt ?? Date.now(),
    };
    if (parsed?.voice?.id) {
      selectedVoiceId.value = parsed.voice.id;
    }
    applyGenderDefault(parsed?.gender);
  } catch (error) {
  }
};

const initializeFlowState = async () => {
  loadSessionSummary();
  applyGenderDefault(summaryData.value.gender);
  try {
    await ensureFlowInitialized();
  } catch (error) {
  } finally {
    isReadyForSync.value = true;
    hasLoadedSummary.value = true;
  }
};

const resolvePreviewUrl = (voiceId) => {
  if (!voiceId) {
    return "";
  }
  const preset = voicePresets.find((item) => item.id === voiceId);
  return preset?.previewUrl ?? "";
};

const toggleVoicePreview = (voiceId) => {
  const url = resolvePreviewUrl(voiceId);
  if (!url) {
    return;
  }
  if (isPlayingId.value === voiceId) {
    const existing = audioPlayers.get(voiceId);
    if (existing) {
      existing.pause();
    }
    isPlayingId.value = "";
    return;
  }

  if (typeof Audio === "undefined") {
    return;
  }

  audioPlayers.forEach((player) => {
    try {
      player.pause();
    } catch {}
  });
  audioPlayers.clear();

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.addEventListener("ended", () => {
    if (isPlayingId.value === voiceId) {
      isPlayingId.value = "";
    }
    audioPlayers.delete(voiceId);
  });
  audio
    .play()
    .then(() => {
      audioPlayers.set(voiceId, audio);
      isPlayingId.value = voiceId;
    })
    .catch((error) => {
      isPlayingId.value = "";
    });
};

// 語音生成功能已移除，用戶直接選擇預設語音即可完成

const finalizeCreation = async () => {
  try {
    // 確保有 flowId
    if (!flowId.value) {
      throw new Error("找不到角色創建流程");
    }

    // 獲取用戶選擇的圖片 URL
    const selectedImageUrl = summaryData.value?.appearance?.image || null;

    // 調用 API 將角色保存到資料庫，並傳遞選擇的圖片 URL
    const character = await finalizeCharacterCreation(flowId.value, user.value, selectedImageUrl);

    // 保存角色資料並顯示成功彈窗
    createdCharacter.value = character;
    isCharacterCreatedModalVisible.value = true;

    // 保存成功後清除暫存資料
    clearStoredCharacterCreationFlowId();
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(SUMMARY_STORAGE_KEY);
        window.sessionStorage.removeItem(GENDER_STORAGE_KEY);
      } catch {}
    }

    // 顯示成功訊息
    showSuccess("角色創建成功！");
  } catch (error) {
    // 顯示錯誤訊息給用戶
    showError(error?.message || "保存角色失敗，請稍後再試");
  }
};

const handleViewCharacter = () => {
  isCharacterCreatedModalVisible.value = false;
  router.replace({ name: "my-characters" });
};

const handleCloseModal = () => {
  isCharacterCreatedModalVisible.value = false;
  router.replace({ name: "my-characters" });
};

const goToCharacterSettings = () => {
  router
    .push({
      name: "character-create-generating",
      query: { step: "settings" },
    })
    .catch((error) => {
    });
};

const isPrimaryDisabled = computed(() => {
  // 只要選擇了語音且不在初始化/同步中，就可以完成
  return (
    !selectedVoiceId.value || isFlowInitializing.value || isSyncingSummary.value
  );
});

watch(
  () => selectedGender.value,
  () => {
    if (suppressGenderWatcher) {
      suppressGenderWatcher = false;
      return;
    }
    if (hasLoadedSummary.value) {
      hasUserAdjustedGenderFilter.value = true;
    }
  }
);

watch(
  () => selectedVoiceId.value,
  (voiceId, previous) => {
    if (suppressSync) {
      return;
    }
    if (voiceId && voiceId !== previous) {
      updateVoiceSelection(voiceId);
    }
    if (!voiceId) {
      const summary = buildSummaryPayload(null);
      persistSummaryToSession(summary);
      scheduleVoiceSync(summary);
    }
  }
);

watch(
  () => filteredVoicePresets.value,
  (presets) => {
    if (!hasLoadedSummary.value || suppressSync) {
      return;
    }
    const exists = presets.some(
      (preset) => preset.id === selectedVoiceId.value
    );
    if (!exists && presets.length) {
      suppressSync = true;
      selectedVoiceId.value = presets[0].id;
      suppressSync = false;
      updateVoiceSelection(presets[0].id);
    }
  },
  { deep: true }
);

onMounted(() => {
  initializeFlowState().finally(() => {
    if (!selectedVoiceId.value && filteredVoicePresets.value.length) {
      suppressSync = true;
      selectedVoiceId.value = filteredVoicePresets.value[0].id;
      suppressSync = false;
      updateVoiceSelection(filteredVoicePresets.value[0].id);
    }
  });
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined" && voiceSyncTimer) {
    window.clearTimeout(voiceSyncTimer);
    voiceSyncTimer = null;
  }
  audioPlayers.forEach((player) => {
    try {
      player.pause();
    } catch {}
  });
  audioPlayers.clear();
});
</script>

<template>
  <div class="voice" :class="{ 'voice--loading': !hasLoadedSummary }">
    <header class="voice__header">
      <button
        type="button"
        class="voice__back"
        aria-label="返回上一頁"
        @click="goToCharacterSettings"
      >
        <ArrowLeftIcon class="voice__back-icon" aria-hidden="true" />
      </button>
      <div>
        <h1 class="voice__title">語音設定</h1>
        <p class="voice__subtitle">
          系統會即時保存你的選擇，就算刷新也不會重新扣款。
        </p>
      </div>
    </header>

    <section class="voice__filters" aria-label="聲線篩選">
      <label class="voice__filter">
        <span>聲線性別</span>
        <select v-model="selectedGender">
          <option
            v-for="option in genderOptions"
            :key="option.id"
            :value="option.id"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
    </section>

    <section class="voice__list" aria-label="可選聲線">
      <article
        v-for="preset in filteredVoicePresets"
        :key="preset.id"
        class="voice__card"
        :class="{ 'voice__card--selected': preset.id === selectedVoiceId }"
        @click="!isGeneratingVoice && (selectedVoiceId = preset.id)"
      >
        <div class="voice__card-main">
          <div class="voice__card-header">
            <h2>{{ preset.label }}</h2>
            <div class="voice__tags">
              <span>{{ formatGender(preset.gender) }}</span>
              <span>{{ formatAgeGroup(preset.ageGroup) }}</span>
            </div>
          </div>
          <p class="voice__card-desc">{{ preset.description }}</p>
        </div>
        <button
          type="button"
          class="voice__preview"
          :disabled="!resolvePreviewUrl(preset.id)"
          @click.stop="toggleVoicePreview(preset.id)"
        >
          <component
            :is="isPlayingId === preset.id ? PauseIcon : PlayIcon"
            aria-hidden="true"
          />
        </button>
      </article>
      <p v-if="!filteredVoicePresets.length" class="voice__empty">
        沒有符合篩選條件的聲線，請調整條件後再試。
      </p>
    </section>

    <footer class="voice__actions">
      <button
        type="button"
        class="voice__button voice__button--primary"
        :disabled="isPrimaryDisabled"
        @click="finalizeCreation"
      >
        完成
      </button>
    </footer>

    <!-- 角色創建成功彈窗 -->
    <CharacterCreatedModal
      v-if="createdCharacter"
      :character="createdCharacter"
      :is-visible="isCharacterCreatedModalVisible"
      @close="handleCloseModal"
      @view-character="handleViewCharacter"
    />
  </div>
</template>

<style scoped>
.voice {
  min-height: 100vh;
  padding: 24px 20px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: radial-gradient(
      140% 120% at 50% 0%,
      rgba(255, 120, 186, 0.18),
      rgba(7, 7, 7, 0.94) 70%
    ),
    #040405;
  color: #ffffff;
}

.voice--loading {
  opacity: 0.6;
}

.voice__header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.voice__back {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.voice__back-icon {
  width: 18px;
  height: 18px;
}

.voice__title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.voice__subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.voice__progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice__progress-track {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.voice__progress-bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff7ac2 0%, #ff4192 100%);
  transition: width 0.3s ease;
}

.voice__progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.voice__status {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.voice__status--error {
  color: #ffabc4;
}

.voice__status--success {
  color: #9fffc7;
}

.voice__filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.voice__filter {
  flex: 0 1 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
}

.voice__filter span {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.voice__filter select {
  appearance: none;
  background-color: rgba(12, 12, 16, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  padding: 10px 38px 10px 14px;
  color: #ffffff;
  font-weight: 600;
  line-height: 1.2;
  transition: border-color 0.2s ease, box-shadow 0.2s ease,
    background-color 0.2s ease;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='white' d='M1 0l4 4 4-4 1 1-5 5-5-5z'/%3E%3C/svg%3E"),
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0));
  background-repeat: no-repeat;
  background-position: right 14px center, 0 0;
  background-size: 12px 8px, 100% 100%;
}

.voice__filter select:hover {
  border-color: rgba(255, 255, 255, 0.32);
  background-color: rgba(16, 16, 24, 0.72);
}

.voice__filter select:focus {
  outline: none;
  border-color: #ff7ac2;
  box-shadow: 0 0 0 3px rgba(255, 122, 194, 0.28);
  background-color: rgba(18, 18, 28, 0.82);
}

.voice__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  height: 139vw;
  padding-top: 1rem;
}

.voice__card {
  display: flex;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.28);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.voice__card--selected {
  border-color: rgba(255, 99, 168, 0.9);
  transform: translateY(-1px);
}

.voice__card-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice__card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.voice__card-header h2 {
  margin: 0;
  font-size: 16px;
}

.voice__tags {
  display: flex;
  gap: 6px;
  font-size: 11px;
}

.voice__tags span {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.voice__card-desc {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.voice__preview {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.35);
  color: #ffffff;
  font-size: 13px;
  svg {
    width: 2rem;
    height: 2rem;
  }
}

.voice__preview:disabled {
  opacity: 0.45;
}

.voice__empty {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.voice__summary {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.28);
  font-size: 13px;
  line-height: 1.6;
}

.voice__summary h2 {
  margin: 0 0 8px;
  font-size: 15px;
}

.voice__summary ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.voice__generation {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
}

.voice__actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.voice__button {
  flex: 1;
  padding: 12px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 15px;
  border: none;
  cursor: pointer;
}

.voice__button--ghost {
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: transparent;
  color: #ffffff;
}

.voice__button--primary {
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  color: #ffffff;
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.voice__button--primary:not(:disabled):hover {
  transform: translateY(-1px);
}

.voice__button:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
