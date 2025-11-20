<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { logger } from "@/utils/logger";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { useGuestGuard } from "../composables/useGuestGuard";
import { useUserProfile } from "../composables/useUserProfile";
import { useUnlockTickets } from "../composables/useUnlockTickets";
import { useDraftFlow } from "../composables/character-creation/useDraftFlow";
import { apiJson } from "../utils/api";
import CharacterCreationLimitModal from "../components/CharacterCreationLimitModal.vue";
import ResumeFlowModal from "../components/ResumeFlowModal.vue";
import {
  clearStoredCharacterCreationFlowId,
  cancelCharacterCreation,
  fetchCharacterCreationFlow,
} from "../services/characterCreation.service.js";

// Types
interface GenderOption {
  value: string;
  label: string;
  portrait: string;
  alt: string;
}

interface CreationLimitResponse {
  // 直接訪問格式（某些舊 API）
  limit?: {
    remaining: number;
    used?: number;
    total?: number;
    standardTotal?: number;
    isTestAccount?: boolean;
    tier?: string;
  };
  // sendSuccess 包裝格式 { success: true, data: {...} }
  data?: {
    limit?: {
      remaining: number;
      used?: number;
      total?: number;
      standardTotal?: number;
      isTestAccount?: boolean;
      tier?: string;
    };
    stats?: any;
    remainingFreeCreations?: number;
  };
}

interface CharacterCreationFlow {
  id?: string;
  status?: string;
  appearance?: any;
  generation?: {
    result?: {
      images?: any[];
    };
  };
}

const router = useRouter();
const { requireLogin } = useGuestGuard();
const { user } = useUserProfile();
const { loadBalance: loadTicketsBalance, createCards } = useUnlockTickets();
const { checkDraft, clearDraft } = useDraftFlow();

const genderOptions: GenderOption[] = [
  {
    value: "male",
    label: "男",
    portrait: "/character-create/gender/male.webp",
    alt: "男性角色範例",
  },
  {
    value: "female",
    label: "女",
    portrait: "/character-create/gender/female.webp",
    alt: "女性角色範例",
  },
  {
    value: "non-binary",
    label: "無性別",
    portrait: "/character-create/gender/non-binary.webp",
    alt: "無性別角色範例",
  },
];

const selectedGender = ref<string>("");
const remainingCreations = ref<number | string>(0);
const usedCreations = ref<number>(0);
const totalLimit = ref<number | string>(0);
const standardTotal = ref<number | string | null>(null);
const isTestAccount = ref<boolean>(false);
const membershipTier = ref<string>("free");
const showLimitModal = ref<boolean>(false);
const showResumeFlowModal = ref<boolean>(false);
const pendingFlow = ref<CharacterCreationFlow | null>(null);

const clearCreationState = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem("characterCreation.gender");
    window.sessionStorage.removeItem("characterCreation.appearance");
  } catch {
    // Silent fail
  }
};

// 統一使用 useUnlockTickets 來獲取創建卡數量
// createCards 已經從 useUnlockTickets 導入，無需再次獲取

const handleResumeFlowConfirm = async (): Promise<void> => {
  showResumeFlowModal.value = false;

  if (!pendingFlow.value) {
    return;
  }

  const flow = pendingFlow.value;
  const status = flow.status || "draft";

  try {
    // 根據狀態跳轉到對應頁面
    if (status === "voice" || status === "persona") {
      await router.replace({ name: "character-create-voice" });
    } else if (status === "generating" || (flow.generation?.result?.images?.length ?? 0) > 0) {
      await router.replace({ name: "character-create-generating" });
    } else if (status === "appearance" || flow.appearance) {
      await router.replace({ name: "character-create-appearance" });
    }
  } catch (_error) {
    // Silent fail
  } finally {
    pendingFlow.value = null;
  }
};

const handleResumeFlowCancel = async (): Promise<void> => {
  showResumeFlowModal.value = false;

  const flowToCancel = pendingFlow.value;
  pendingFlow.value = null;

  // 如果有生成的圖片，調用後端 API 刪除所有圖片
  const imagesLength = flowToCancel?.generation?.result?.images?.length ?? 0;
  if (flowToCancel?.id && imagesLength > 0) {
    try {
      await cancelCharacterCreation(flowToCancel.id);
      logger.log(`[角色創建] 已取消流程並清理 ${imagesLength} 張生成的圖片`);
    } catch (error) {
      logger.error("[角色創建] 取消流程失敗:", error);
      // 即使刪除失敗也繼續清除本地狀態
    }
  }

  // 用戶選擇重新開始，清除所有狀態
  clearStoredCharacterCreationFlowId();
  clearCreationState();

  // ✅ 同時清除草稿
  clearDraft();
};

onMounted(async () => {
  // 檢查是否為遊客，遊客不能創建角色
  if (requireLogin({
    feature: "創建專屬角色"
  })) {
    return;
  }

  // ✅ 檢查是否有未完成的草稿
  const draft = checkDraft();
  if (draft && draft.hasGeneratedImages) {
    // 有草稿，嘗試載入 flow 並顯示恢復對話框
    try {
      const flow = await fetchCharacterCreationFlow(draft.flowId);
      if (flow && flow.generation?.result?.images?.length > 0) {
        // 確認 flow 確實有生成的圖片
        pendingFlow.value = flow;
        showResumeFlowModal.value = true;
        logger.log("[角色創建] 檢測到未完成的角色創建流程，詢問用戶是否繼續");
        return; // 不清除狀態，等待用戶選擇
      } else {
        // flow 不存在或沒有圖片，清除草稿
        clearDraft();
        logger.log("[角色創建] 草稿對應的 flow 無效，已清除");
      }
    } catch (error) {
      // 無法載入 flow，清除草稿
      clearDraft();
      logger.error("[角色創建] 無法載入草稿對應的 flow", error);
    }
  }

  // 沒有草稿或用戶選擇重新開始，強制清除所有舊的創建狀態
  // 這樣可以避免圖片重用問題和創建卡未扣除問題
  clearStoredCharacterCreationFlowId();
  clearCreationState();

  // 查詢角色創建限制
  const userId = user.value?.id;
  if (userId) {
    try {
      const response = await apiJson<CreationLimitResponse>(`/api/character-creation/limits/${userId}`, {
        method: "GET",
        skipGlobalLoading: true,
      });

      // 調試日誌：查看完整的 API 返回數據
      console.log('[角色創建限制] API 返回數據:', response);
      console.log('[角色創建限制] response.limit:', response?.limit);
      console.log('[角色創建限制] response.data:', response?.data);
      console.log('[角色創建限制] response.data?.limit:', response?.data?.limit);

      // 後端使用 sendSuccess() 會將數據包裝為 { success: true, data: {...} }
      const limitData = response?.data?.limit || response?.limit;

      if (limitData) {
        console.log('[角色創建限制] 使用的 limitData:', limitData);

        // 如果 remaining 是 -1 代表無限制
        const newValue = limitData.remaining === -1
          ? "∞"
          : limitData.remaining;
        remainingCreations.value = newValue;

        // 保存已使用次數、總限制和會員等級資訊
        if (limitData.used !== undefined) {
          usedCreations.value = limitData.used;
        }
        // 保存實際限制和標準限制
        if (limitData.total !== undefined) {
          totalLimit.value = limitData.total === -1 ? "∞" : limitData.total;
        }
        if (limitData.standardTotal !== undefined) {
          standardTotal.value = limitData.standardTotal === -1 ? "∞" : limitData.standardTotal;
        }
        if (limitData.isTestAccount !== undefined) {
          isTestAccount.value = limitData.isTestAccount;
        }
        if (limitData.tier) {
          membershipTier.value = limitData.tier;
        }
      }
    } catch {
      // Silent fail
    }

    // 載入用戶資產（解鎖卡數量）- 統一使用 useUnlockTickets
    await loadTicketsBalance(userId, { skipGlobalLoading: true });
  }
});

const isConfirmDisabled = computed<boolean>(() => !selectedGender.value);

const handleOptionSelect = (option: GenderOption | null): void => {
  if (!option?.value) {
    return;
  }
  selectedGender.value = option.value;
};

const handleConfirm = (): void => {
  if (isConfirmDisabled.value) {
    return;
  }

  // 註：不在這裡檢查創建次數
  // 讓用戶進入外觀設定頁面，在點擊「生成形象」時才檢查

  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "characterCreation.gender",
        selectedGender.value
      );
    }
  } catch {
    // Silent fail
  }
  router.push({ name: "character-create-appearance" }).catch(() => {
    // Silent fail
  });
};

const handleCloseLimitModal = (): void => {
  showLimitModal.value = false;
};

const handleUpgrade = (): void => {
  showLimitModal.value = false;
  // 會由彈窗組件自行導向
};

const handleBuyUnlockCard = (): void => {
  showLimitModal.value = false;
  // 會由彈窗組件自行導向商城
};

const handleUseUnlockCard = async (): Promise<void> => {
  // 註：不在這裡扣除創建卡
  // 後端會在生成角色圖片成功後才扣除，確保生成失敗時不會扣除用戶的資源

  // 關閉彈窗並繼續創建流程
  showLimitModal.value = false;

  // 繼續到下一步
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "characterCreation.gender",
        selectedGender.value
      );
    }
  } catch {
    // Silent fail
  }
  router.push({ name: "character-create-appearance" }).catch(() => {
    // Silent fail
  });
};

const navigateBackToProfile = (): void => {
  clearCreationState();
  router.replace({ name: "profile" }).catch(() => {
    // Silent fail
  });
};

const handleClose = (): void => {
  if (typeof window === "undefined") {
    navigateBackToProfile();
    return;
  }

  if (window.history.length > 1) {
    clearCreationState();
    router.back();
    window.setTimeout(() => {
      if (router.currentRoute.value?.name === "character-create-gender") {
        navigateBackToProfile();
      }
    }, 200);
    return;
  }

  navigateBackToProfile();
};
</script>

<template>
  <div class="create-gender" role="dialog" aria-modal="true">
    <header class="create-gender__header">
      <button
        type="button"
        class="create-gender__close"
        aria-label="關閉創建角色"
        @click="handleClose"
      >
        <XMarkIcon class="create-gender__close-icon" aria-hidden="true" />
      </button>
      <div class="create-gender__spacer"></div>
    </header>

    <main class="create-gender__content">
      <h1 class="create-gender__title">選擇角色性別</h1>
      <p class="create-gender__subtitle">剩餘 {{ remainingCreations }} 次</p>

      <ul class="gender-options" role="listbox" aria-label="角色性別">
        <li
          v-for="option in genderOptions"
          :key="option.value"
          class="gender-option"
        >
          <button
            type="button"
            class="gender-option__button"
            :class="{
              'gender-option__button--selected':
                option.value === selectedGender,
            }"
            role="option"
            :aria-selected="option.value === selectedGender"
            @click="handleOptionSelect(option)"
          >
            <span class="gender-option__frame" aria-hidden="true">
              <img
                :src="option.portrait"
                :alt="option.alt"
                class="gender-option__image"
              />
            </span>
            <span class="gender-option__label">{{ option.label }}</span>
          </button>
        </li>
      </ul>
    </main>

    <footer class="create-gender__footer">
      <button
        type="button"
        class="create-gender__confirm"
        :disabled="isConfirmDisabled"
        @click="handleConfirm"
      >
        確認
      </button>
    </footer>

    <!-- 角色創建限制彈窗 -->
    <CharacterCreationLimitModal
      :is-open="showLimitModal"
      :used-creations="usedCreations"
      :total-limit="(totalLimit as any)"
      :standard-total="(standardTotal as any)"
      :is-test-account="isTestAccount"
      :membership-tier="membershipTier"
      :create-cards="createCards"
      @close="handleCloseLimitModal"
      @upgrade="handleUpgrade"
      @buy-unlock-card="handleBuyUnlockCard"
      @use-unlock-card="handleUseUnlockCard"
    />

    <!-- 恢復流程確認彈窗 -->
    <ResumeFlowModal
      :is-visible="showResumeFlowModal"
      @confirm="handleResumeFlowConfirm"
      @cancel="handleResumeFlowCancel"
    />
  </div>
</template>

<style scoped>
.create-gender {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 24px 20px 32px;
  background: radial-gradient(
      120% 120% at 50% 10%,
      rgba(255, 51, 151, 0.16),
      rgba(10, 10, 10, 0.92) 70%
    ),
    #0b0b0b;
  color: #ffffff;
}

.create-gender__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.create-gender__spacer {
  width: 36px;
}

.create-gender__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  transition: background-color 0.2s ease, color 0.2s ease;
  position: relative;
  z-index: 2;
}

.create-gender__close:focus-visible {
  outline: 2px solid #ff2f92;
  outline-offset: 2px;
}

.create-gender__close:hover {
  background-color: rgba(255, 255, 255, 0.18);
}

.create-gender__close-icon {
  width: 22px;
  height: 22px;
}

.create-gender__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 16px;
  margin-top: -32px;
}

.create-gender__title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.create-gender__subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}

.gender-options {
  display: flex;
  align-items: stretch;
  gap: 16px;
  padding: 0;
  margin: 12px 0 0;
  list-style: none;
  width: 100%;
  max-width: 480px;
}

.gender-option {
  flex: 1;
}

.gender-option__button {
  width: 100%;
  border: 2px solid transparent;
  border-radius: 18px;
  padding: 12px 12px 16px;
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.08),
      rgba(255, 255, 255, 0.03)
    ),
    rgba(16, 16, 16, 0.64);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: border-color 0.2s ease, background-color 0.2s ease,
    transform 0.2s ease;
}

.gender-option__button:hover {
  background-color: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.gender-option__button:focus-visible {
  outline: 2px solid #ff2f92;
  outline-offset: 2px;
}

.gender-option__button--selected {
  border-color: #ff2f92;
  box-shadow: 0 0 18px rgba(255, 47, 146, 0.24);
}

.gender-option__frame {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
}

.gender-option__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gender-option__label {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.create-gender__footer {
  margin-top: 32px;
}

.create-gender__confirm {
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

.create-gender__confirm:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.create-gender__confirm:not(:disabled):hover {
  transform: translateY(-1px);
}

.create-gender__confirm:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}

@media (max-width: 600px) {
  .gender-option__button {
    padding: 16px 16px 18px;
  }

  .gender-option__frame {
    aspect-ratio: 4 / 5;
  }
}
</style>
