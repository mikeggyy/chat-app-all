import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { apiJson } from "../../utils/api.js";
import { useUserProfile } from "../useUserProfile.js";
import {
  createCharacterCreationFlow,
  storeCharacterCreationFlowId,
  updateCharacterCreationStep,
} from "../../services/characterCreation.service.js";

export function usePurchaseFlow(savedGender) {
  const router = useRouter();
  const { user } = useUserProfile();

  const userCreateCards = ref(0);
  const freeCreationsRemaining = ref(0);
  const isLoadingAssets = ref(false);
  const isGenerateConfirmVisible = ref(false);
  const showPurchaseModal = ref(false);

  // 判斷是否需要使用創建卡
  const needsCreateCard = computed(() => {
    return freeCreationsRemaining.value <= 0;
  });

  // 判斷是否可以生成（有免費次數或有創建卡）
  const canGenerate = computed(() => {
    if (freeCreationsRemaining.value > 0) {
      return true;
    }
    return userCreateCards.value > 0;
  });

  // 確認對話框的內容
  const confirmMessage = computed(() => {
    if (freeCreationsRemaining.value > 0) {
      return `點擊確認後將會使用 1 次免費創建次數（剩餘 ${freeCreationsRemaining.value} 次），且不會返還。`;
    } else if (userCreateCards.value > 0) {
      return `您的免費次數已用完。點擊確認後將會使用 1 張創建角色卡（剩餘 ${userCreateCards.value} 張），且不會返還。`;
    } else {
      return "您沒有剩餘的免費次數或創建角色卡，無法生成角色。";
    }
  });

  const loadUserAssets = async () => {
    const userId = user.value?.id;
    if (!userId) {
      return;
    }

    isLoadingAssets.value = true;
    try {
      // 獲取用戶資產（創建卡數量）
      const assetsData = await apiJson(
        `/api/users/${encodeURIComponent(userId)}/assets`,
        {
          skipGlobalLoading: true,
        }
      );

      if (assetsData) {
        userCreateCards.value = assetsData.createCards || 0;
      }

      // 獲取免費創建次數（從 limits API）
      const limitsData = await apiJson(
        `/api/character-creation/limits/${encodeURIComponent(userId)}`,
        {
          skipGlobalLoading: true,
        }
      );

      if (limitsData) {
        freeCreationsRemaining.value = limitsData.remainingFreeCreations || 0;
      }
    } catch (error) {
      // 使用預設值
      userCreateCards.value = 0;
      freeCreationsRemaining.value = 0;
    } finally {
      isLoadingAssets.value = false;
    }
  };

  const handleGenerateAppearance = (isDescriptionEmpty) => {
    if (isDescriptionEmpty) {
      return;
    }

    // 檢查是否可以生成
    if (!canGenerate.value) {
      // 顯示購買提示彈窗
      showPurchaseModal.value = true;
      return;
    }

    // 顯示確認對話框
    isGenerateConfirmVisible.value = true;
  };

  const handleClosePurchaseModal = () => {
    showPurchaseModal.value = false;
  };

  const handleGoToShop = () => {
    // 導向商店購買創建角色卡
    showPurchaseModal.value = false;
    router.push({ name: "shop" }).catch((error) => {});
  };

  const handleGoToVIP = () => {
    // 導向 VIP 充值頁面
    showPurchaseModal.value = false;
    router.push({ name: "membership" }).catch((error) => {});
  };

  const confirmGenerate = async (appearanceData, clearStateCallback) => {
    isGenerateConfirmVisible.value = false;

    // 註：不在這裡扣除創建卡或免費次數
    // 後端會在生成角色圖片成功後才扣除，確保生成失敗時不會扣除用戶的資源

    try {
      // 創建或更新 flow
      let flow = null;
      const storedFlowId =
        typeof window !== "undefined"
          ? window.localStorage?.getItem("character-create-flow-id")
          : null;

      if (storedFlowId) {
        // 嘗試更新現有 flow 的 appearance
        try {
          flow = await updateCharacterCreationStep(
            storedFlowId,
            "appearance",
            appearanceData
          );
        } catch (updateError) {
          // 如果更新失敗（例如 404，後端重啟導致 flow 不存在），則創建新的 flow
          if (
            updateError?.status === 404 ||
            updateError?.message?.includes("404")
          ) {
            flow = await createCharacterCreationFlow({
              status: "appearance",
              appearance: appearanceData,
              metadata: {
                gender: savedGender.value,
              },
            });
          } else {
            throw updateError;
          }
        }
      } else {
        // 創建新的 flow
        flow = await createCharacterCreationFlow({
          status: "appearance",
          appearance: appearanceData,
          metadata: {
            gender: savedGender.value,
          },
        });
      }

      // 確保 flowId 被保存（無論是創建還是更新）
      if (flow && flow.id) {
        storeCharacterCreationFlowId(flow.id);
      } else {
        throw new Error("Flow 創建/更新失敗：未返回有效的 flow ID");
      }

      // 清除狀態並導向生成頁面
      if (clearStateCallback) {
        clearStateCallback({ preserveGender: true });
      }

      router
        .push({ name: "character-create-generating" })
        .catch((error) => {});
    } catch (error) {
      if (typeof window !== "undefined") {
        window.alert(
          error instanceof Error && error.message
            ? `保存失敗：${error.message}`
            : "保存角色形象資料失敗，請稍後再試"
        );
      }
    }
  };

  const cancelGenerate = () => {
    isGenerateConfirmVisible.value = false;
  };

  onMounted(async () => {
    await loadUserAssets();
  });

  return {
    userCreateCards,
    freeCreationsRemaining,
    isLoadingAssets,
    isGenerateConfirmVisible,
    showPurchaseModal,
    needsCreateCard,
    canGenerate,
    confirmMessage,
    loadUserAssets,
    handleGenerateAppearance,
    handleClosePurchaseModal,
    handleGoToShop,
    handleGoToVIP,
    confirmGenerate,
    cancelGenerate,
  };
}
