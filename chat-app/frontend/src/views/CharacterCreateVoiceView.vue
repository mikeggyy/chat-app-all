<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Ref, ComputedRef } from "vue";
import { useRouter } from "vue-router";
import { finalizeCharacterCreation } from "../services/characterCreation.service.js";
import { useUserProfile } from "../composables/useUserProfile.js";
import { useToast } from "../composables/useToast.js";
import CharacterCreatedModal from "../components/CharacterCreatedModal.vue";
import VoiceHeader from "../components/voice-selection/VoiceHeader.vue";
import VoiceFilters from "../components/voice-selection/VoiceFilters.vue";
import VoiceCard from "../components/voice-selection/VoiceCard.vue";
import VoiceActions from "../components/voice-selection/VoiceActions.vue";

// Composables
import { useVoiceAudioPlayer } from "../composables/voice-selection/useVoiceAudioPlayer.js";
import { useVoiceFiltering } from "../composables/voice-selection/useVoiceFiltering.js";
import { useFlowSync } from "../composables/voice-selection/useFlowSync.js";
import { useVoiceLoading } from "../composables/voice-selection/useVoiceLoading.js";
import { useDraftFlow } from "../composables/character-creation/useDraftFlow.js";

// Types
interface VoicePreset {
  id: string;
  name?: string;
  gender?: string;
  locale?: string;
  [key: string]: any;
}

interface PersonaSummary {
  name: string;
  tagline: string;
  hiddenProfile: string;
  prompt: string;
}

interface AppearanceSummary {
  image?: string;
  [key: string]: any;
}

interface SummaryData {
  persona?: PersonaSummary;
  appearance?: AppearanceSummary | null;
  voice?: VoicePreset | null;
  gender?: string;
}

interface CreatedCharacter {
  id: string;
  [key: string]: any;
}

const router = useRouter();
const { user } = useUserProfile();
const { success: showSuccess, error: showError } = useToast();

// 語音加載
const {
  voicePresets,
  loadVoicesFromAPI,
  resolvePreviewUrl,
} = useVoiceLoading();

// 語音播放
const { isPlayingId, toggleVoicePreview } = useVoiceAudioPlayer();

// 語音過濾
const {
  selectedGender,
  genderOptions,
  filteredVoicePresets,
  formatGender,
  autoSetGenderFilter,
  setupGenderWatcher,
} = useVoiceFiltering(voicePresets);

// Flow 同步
const {
  flowId,
  isFlowInitializing,
  isSyncingSummary,
  hasLoadedSummary,
  summaryData,
  suppressSync: flowSuppressSync,
  updateVoiceSelection,
  initializeFlowState,
  clearStoredData,
  cleanupTimers,
} = useFlowSync();

// 🔥 草稿管理
const { clearDraft } = useDraftFlow();

// 本地狀態
const selectedVoiceId: Ref<string> = ref("");
let suppressSync: boolean = false;

// 角色創建成功彈窗
const isCharacterCreatedModalVisible: Ref<boolean> = ref(false);
const createdCharacter: Ref<CreatedCharacter | null> = ref(null);

// 計算屬性
const isPrimaryDisabled: ComputedRef<boolean> = computed(() => {
  // 只要選擇了語音且不在初始化/同步中，就可以完成
  return (
    !selectedVoiceId.value || isFlowInitializing.value || isSyncingSummary.value
  );
});

// 方法
const handleToggleVoicePreview = (voiceId: string): void => {
  const url = resolvePreviewUrl(voiceId);
  toggleVoicePreview(voiceId, url);

  // 播放時同時選中該語音
  if (url) {
    selectedVoiceId.value = voiceId;
  }
};

const finalizeCreation = async (): Promise<void> => {
  try {
    // 確保有 flowId
    if (!flowId.value) {
      throw new Error("找不到角色創建流程");
    }

    // 確保有用戶
    if (!user.value) {
      throw new Error("用戶未登入");
    }

    // 獲取用戶選擇的圖片 URL
    const selectedImageUrl = (summaryData.value as SummaryData | null)?.appearance?.image || null;

    console.log('[CharacterCreateVoiceView] 📸 準備創建角色，圖片信息：', {
      selectedImageUrl,
      summaryData: summaryData.value,
      flowId: flowId.value
    });

    // 調用 API 將角色保存到資料庫，並傳遞選擇的圖片 URL
    const character = await finalizeCharacterCreation(
      flowId.value,
      user.value,
      selectedImageUrl
    ) as CreatedCharacter;

    console.log('[CharacterCreateVoiceView] ✅ 角色創建成功，返回數據：', character);

    // 🔥 修復：使用 summaryData 的完整數據來豐富返回的角色資料
    // 確保成功對話框顯示用戶選擇的所有設定
    const enrichedCharacter = {
      ...character,
      // 如果後端沒有返回 portraitUrl 或返回的是錯誤的，使用用戶選擇的圖片
      portraitUrl: character.portraitUrl || selectedImageUrl || character.portrait_url || '/avatars/defult-01.webp',
      // 確保 voice 是完整的物件而非僅 ID
      voice: summaryData.value?.voice || character.voice,
      // 確保 gender 正確顯示
      gender: summaryData.value?.gender || character.gender,
      // 🔥 新增：確保角色設定（tagline）正確傳遞
      background: character.background || summaryData.value?.persona?.tagline || '',
      // 🔥 新增：確保隱藏設定（hiddenProfile）正確傳遞
      secret_background: character.secret_background || summaryData.value?.persona?.hiddenProfile || '',
      // 🔥 新增：確保開場白（prompt）正確傳遞
      first_message: character.first_message || summaryData.value?.persona?.prompt || '',
    };

    console.log('[CharacterCreateVoiceView] 📝 豐富後的角色數據：', enrichedCharacter);

    // 保存角色資料並顯示成功彈窗
    createdCharacter.value = enrichedCharacter;
    isCharacterCreatedModalVisible.value = true;

    // 🔥 修復：保存成功後清除所有暫存資料和草稿
    clearStoredData();  // 清除 flow 相關數據
    clearDraft();       // 清除草稿（防止重複顯示草稿對話框）

    // 🔥 新增：清除 characterCreation store 狀態（包括 AI 魔法師計數）
    const { useCharacterCreationStore } = await import('../stores/characterCreation.js');
    const ccStore = useCharacterCreationStore();
    ccStore.resetFlow();  // 重置整個流程（包括 AI 魔法師計數）
    ccStore.clearSession();  // 清除 sessionStorage

    console.log('[CharacterCreateVoiceView] 已清除所有暫存資料、草稿和 store 狀態');

    // 顯示成功訊息
    showSuccess("角色創建成功！");
  } catch (error: any) {
    // 顯示錯誤訊息給用戶
    showError(error?.message || "保存角色失敗，請稍後再試");
  }
};

const handleViewCharacter = (): void => {
  isCharacterCreatedModalVisible.value = false;
  router.replace({ name: "my-characters" });
};

const handleCloseModal = (): void => {
  isCharacterCreatedModalVisible.value = false;
  router.replace({ name: "my-characters" });
};

const goToCharacterSettings = (): void => {
  router
    .push({
      name: "character-create-generating",
      query: { step: "settings" },
    })
    .catch(() => {});
};

// 監聽器
setupGenderWatcher(hasLoadedSummary);

watch(
  () => selectedVoiceId.value,
  (voiceId, previous) => {
    if (suppressSync || flowSuppressSync) {
      return;
    }
    if (voiceId && voiceId !== previous) {
      const preset = (voicePresets.value as any).find((item: any) => item.id === voiceId);
      if (preset) {
        updateVoiceSelection(preset as any);
      }
    }
    if (!voiceId) {
      updateVoiceSelection(null);
    }
  }
);

watch(
  () => filteredVoicePresets.value,
  (presets: any) => {
    if (!hasLoadedSummary.value || suppressSync || flowSuppressSync) {
      return;
    }
    const exists = presets.some(
      (preset: any) => preset.id === selectedVoiceId.value
    );
    if (!exists && presets.length) {
      suppressSync = true;
      selectedVoiceId.value = presets[0].id;
      suppressSync = false;
      const preset = presets[0];
      updateVoiceSelection(preset as any);
    }
  },
  { deep: true }
);

// 生命週期
onMounted(async () => {
  // 優先載入語音列表
  await loadVoicesFromAPI();

  // 然後初始化流程狀態
  const loadedSummary = await initializeFlowState() as SummaryData | null;

  // 如果有載入的摘要且包含語音，設置選中的語音
  if (loadedSummary?.voice?.id) {
    selectedVoiceId.value = loadedSummary.voice.id;
  }

  // 根據角色性別自動設置聲線性別篩選器
  if (loadedSummary?.gender) {
    autoSetGenderFilter(loadedSummary.gender);
  }

  // 如果還沒有選中語音，默認選擇第一個
  if (!selectedVoiceId.value && filteredVoicePresets.value.length) {
    suppressSync = true;
    selectedVoiceId.value = (filteredVoicePresets.value[0] as any).id;
    suppressSync = false;
    updateVoiceSelection(filteredVoicePresets.value[0] as any);
  }
});

onBeforeUnmount(() => {
  cleanupTimers();
});
</script>

<template>
  <div class="voice" :class="{ 'voice--loading': !hasLoadedSummary }">
    <VoiceHeader
      title="語音設定"
      subtitle="系統會即時保存你的選擇，就算刷新也不會重新扣款。"
      @back="goToCharacterSettings"
    />

    <VoiceFilters
      :selected-gender="selectedGender"
      :gender-options="genderOptions"
      @update:selected-gender="selectedGender = $event"
    />

    <section class="voice__list" aria-label="可選聲線">
      <VoiceCard
        v-for="preset in filteredVoicePresets"
        :key="preset.id"
        :preset="preset"
        :is-selected="preset.id === selectedVoiceId"
        :is-playing="isPlayingId === preset.id"
        :format-gender="formatGender"
        :has-preview-url="Boolean(resolvePreviewUrl(preset.id))"
        @select="selectedVoiceId = $event"
        @toggle-preview="handleToggleVoicePreview"
      />
      <p v-if="!filteredVoicePresets.length" class="voice__empty">
        沒有符合篩選條件的聲線，請調整條件後再試。
      </p>
    </section>

    <VoiceActions
      :is-primary-disabled="isPrimaryDisabled"
      @primary="finalizeCreation"
    />

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
  min-height: 100dvh;
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

.voice__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
  max-height: calc(100dvh - 300px);
  padding-top: 1rem;
}

.voice__empty {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}
</style>
