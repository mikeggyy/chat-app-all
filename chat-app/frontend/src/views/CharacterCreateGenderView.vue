<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { useGuestGuard } from "../composables/useGuestGuard";
import { useUserProfile } from "../composables/useUserProfile";
import { apiJson } from "../utils/api";
import CharacterCreationLimitModal from "../components/CharacterCreationLimitModal.vue";
import ResumeFlowModal from "../components/ResumeFlowModal.vue";
import {
  readStoredCharacterCreationFlowId,
  fetchCharacterCreationFlow,
  clearStoredCharacterCreationFlowId,
} from "../services/characterCreation.service.js";

const router = useRouter();
const { requireLogin } = useGuestGuard();
const { user } = useUserProfile();

const genderOptions = [
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

const selectedGender = ref("");
const remainingCreations = ref(0);
const usedCreations = ref(0);
const totalLimit = ref(0);
const standardTotal = ref(null);
const isTestAccount = ref(false);
const membershipTier = ref("free");
const showLimitModal = ref(false);
const createCards = ref(0);
const showResumeFlowModal = ref(false);
const pendingFlow = ref(null);

const clearCreationState = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem("characterCreation.gender");
    window.sessionStorage.removeItem("characterCreation.appearance");
  } catch (error) {
  }
};

const loadUserAssets = async (userId) => {
  if (!userId) return;
  try {
    const data = await apiJson(`/api/users/${userId}/assets`, {
      skipGlobalLoading: true,
    });
    createCards.value = data.createCards || 0;
  } catch (err) {

  }
};

const checkAndResumeFlow = async () => {
  // 檢查是否有未完成的 flow
  const storedFlowId = readStoredCharacterCreationFlowId();
  if (!storedFlowId) {
    return false;
  }

  try {
    // 嘗試從後端獲取 flow 資料
    const flow = await fetchCharacterCreationFlow(storedFlowId);

    if (!flow) {
      // Flow 不存在，清除狀態
      clearStoredCharacterCreationFlowId();
      clearCreationState();
      return false;
    }

    // 根據 flow 狀態決定跳轉到哪個頁面
    const status = flow.status || "draft";

    if (status === "completed") {
      // 已完成，清除狀態並開始新流程
      clearStoredCharacterCreationFlowId();
      clearCreationState();
      return false;
    }

    // 有未完成的 flow，顯示確認彈窗
    pendingFlow.value = flow;
    showResumeFlowModal.value = true;
    return true;
  } catch (error) {
    // 發生錯誤，清除狀態並重新開始
    clearStoredCharacterCreationFlowId();
    clearCreationState();
    return false;
  }
};

const handleResumeFlowConfirm = async () => {
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
    } else if (status === "generating" || flow.generation?.result?.images?.length > 0) {
      await router.replace({ name: "character-create-generating" });
    } else if (status === "appearance" || flow.appearance) {
      await router.replace({ name: "character-create-appearance" });
    }
  } catch (error) {
  } finally {
    pendingFlow.value = null;
  }
};

const handleResumeFlowCancel = () => {
  showResumeFlowModal.value = false;
  pendingFlow.value = null;

  // 用戶選擇重新開始，清除所有狀態
  clearStoredCharacterCreationFlowId();
  clearCreationState();
};

onMounted(async () => {
  // 檢查是否為遊客，遊客不能創建角色
  if (requireLogin({
    feature: "創建專屬角色"
  })) {
    return;
  }

  // 檢查並恢復未完成的流程
  const resumed = await checkAndResumeFlow();
  if (resumed) {
    // 已跳轉到其他頁面，不繼續執行
    return;
  }

  clearCreationState();

  // 查詢角色創建限制
  const userId = user.value?.id;
  if (userId) {
    try {
      const response = await apiJson(`/api/character-creation/limits/${userId}`, {
        method: "GET",
        skipGlobalLoading: true,
      });

      if (response?.limit) {
        // 調試日誌：查看完整的 API 返回數據

        // 如果 remaining 是 -1 代表無限制
        const newValue = response.limit.remaining === -1
          ? "∞"
          : response.limit.remaining;
        remainingCreations.value = newValue;

        // 保存已使用次數、總限制和會員等級資訊
        if (response.limit.used !== undefined) {
          usedCreations.value = response.limit.used;
        }
        // 保存實際限制和標準限制
        if (response.limit.total !== undefined) {
          totalLimit.value = response.limit.total === -1 ? "∞" : response.limit.total;
        }
        if (response.limit.standardTotal !== undefined) {
          standardTotal.value = response.limit.standardTotal === -1 ? "∞" : response.limit.standardTotal;
        }
        if (response.limit.isTestAccount !== undefined) {
          isTestAccount.value = response.limit.isTestAccount;
        }
        if (response.limit.tier) {
          membershipTier.value = response.limit.tier;
        }
      }
    } catch (error) {
    }

    // 載入用戶資產（解鎖卡數量）
    await loadUserAssets(userId);
  }
});

const isConfirmDisabled = computed(() => !selectedGender.value);

const handleOptionSelect = (option) => {
  if (!option?.value) {
    return;
  }
  selectedGender.value = option.value;
};

const handleConfirm = () => {
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
  } catch (error) {
  }
  router.push({ name: "character-create-appearance" }).catch((error) => {
  });
};

const handleCloseLimitModal = () => {
  showLimitModal.value = false;
};

const handleUpgrade = () => {
  showLimitModal.value = false;
  // 會由彈窗組件自行導向
};

const handleBuyUnlockCard = () => {
  showLimitModal.value = false;
  // 會由彈窗組件自行導向商城
};

const handleUseUnlockCard = async () => {
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
  } catch (error) {
  }
  router.push({ name: "character-create-appearance" }).catch((error) => {
  });
};

const navigateBackToProfile = () => {
  clearCreationState();
  router.replace({ name: "profile" }).catch((error) => {
  });
};

const handleClose = () => {
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
      :total-limit="totalLimit"
      :standard-total="standardTotal"
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
