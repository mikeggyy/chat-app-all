import { ref, computed, onMounted } from "vue";
import type { Ref, ComputedRef } from "vue";
import { useRouter } from "vue-router";
import type { Router } from "vue-router";
import { apiJson } from "../../utils/api.js";
import { useUserProfile } from "../useUserProfile.js";
import {
  createCharacterCreationFlow,
  storeCharacterCreationFlowId,
  updateCharacterCreationStep,
  type CharacterCreationFlow,
} from "../../services/characterCreation.service.js";

// ==================== 類型定義 ====================

/**
 * 用戶資產響應數據
 */
interface UserAssetsResponse {
  createCards?: number;
}

/**
 * 限制數據響應
 */
interface LimitsResponse {
  remainingFreeCreations?: number;
}

/**
 * 角色外觀數據
 */
interface AppearanceData {
  description?: string;
  style?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * 清除狀態回調選項
 */
interface ClearStateOptions {
  preserveGender?: boolean;
}

/**
 * 清除狀態回調函數
 */
type ClearStateCallback = (options?: ClearStateOptions) => void;

/**
 * usePurchaseFlow 組合式函數的返回值
 */
interface UsePurchaseFlowReturn {
  /** 用戶擁有的創建卡數量 */
  userCreateCards: Ref<number>;
  /** 剩餘免費創建次數 */
  freeCreationsRemaining: Ref<number>;
  /** 資產加載狀態 */
  isLoadingAssets: Ref<boolean>;
  /** 生成確認對話框顯示狀態 */
  isGenerateConfirmVisible: Ref<boolean>;
  /** 購買提示彈窗顯示狀態 */
  showPurchaseModal: Ref<boolean>;
  /** 是否需要使用創建卡（無免費次數） */
  needsCreateCard: ComputedRef<boolean>;
  /** 是否可以生成（有免費次數或創建卡） */
  canGenerate: ComputedRef<boolean>;
  /** 確認對話框的提示內容 */
  confirmMessage: ComputedRef<string>;
  /** 加載用戶資產（創建卡和免費次數） */
  loadUserAssets: () => Promise<void>;
  /** 處理生成外觀按鈕點擊 */
  handleGenerateAppearance: (isDescriptionEmpty: boolean) => void;
  /** 關閉購買提示彈窗 */
  handleClosePurchaseModal: () => void;
  /** 跳轉到商店購買創建卡 */
  handleGoToShop: () => void;
  /** 跳轉到 VIP 充值頁面 */
  handleGoToVIP: () => void;
  /** 確認生成角色 */
  confirmGenerate: (appearanceData: AppearanceData, clearStateCallback?: ClearStateCallback) => Promise<void>;
  /** 取消生成 */
  cancelGenerate: () => void;
}

// ==================== 組合式函數 ====================

export function usePurchaseFlow(savedGender: Ref<string>): UsePurchaseFlowReturn {
  const router: Router = useRouter();
  const { user } = useUserProfile();

  const userCreateCards = ref<number>(0);
  const freeCreationsRemaining = ref<number>(0);
  const isLoadingAssets = ref<boolean>(false);
  const isGenerateConfirmVisible = ref<boolean>(false);
  const showPurchaseModal = ref<boolean>(false);

  // 判斷是否需要使用創建卡
  const needsCreateCard = computed<boolean>(() => {
    return freeCreationsRemaining.value <= 0;
  });

  // 判斷是否可以生成（有免費次數或有創建卡）
  const canGenerate = computed<boolean>(() => {
    if (freeCreationsRemaining.value > 0) {
      return true;
    }
    return userCreateCards.value > 0;
  });

  // 確認對話框的內容
  const confirmMessage = computed<string>(() => {
    if (freeCreationsRemaining.value > 0) {
      return `點擊確認後將會使用 1 次免費創建次數（剩餘 ${freeCreationsRemaining.value} 次），且不會返還。`;
    } else if (userCreateCards.value > 0) {
      return `您的免費次數已用完。點擊確認後將會使用 1 張創建角色卡（剩餘 ${userCreateCards.value} 張），且不會返還。`;
    } else {
      return "您沒有剩餘的免費次數或創建角色卡，無法生成角色。";
    }
  });

  const loadUserAssets = async (): Promise<void> => {
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
      ) as UserAssetsResponse;

      if (assetsData) {
        userCreateCards.value = assetsData.createCards || 0;
      }

      // 獲取免費創建次數（從 limits API）
      const limitsData = await apiJson(
        `/api/character-creation/limits/${encodeURIComponent(userId)}`,
        {
          skipGlobalLoading: true,
        }
      ) as LimitsResponse;

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

  const handleGenerateAppearance = (isDescriptionEmpty: boolean): void => {
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

  const handleClosePurchaseModal = (): void => {
    showPurchaseModal.value = false;
  };

  const handleGoToShop = (): void => {
    // 導向商店購買創建角色卡
    showPurchaseModal.value = false;
    router.push({ name: "shop" }).catch((error) => {
      void error;
    });
  };

  const handleGoToVIP = (): void => {
    // 導向 VIP 充值頁面
    showPurchaseModal.value = false;
    router.push({ name: "membership" }).catch((error) => {
      void error;
    });
  };

  const confirmGenerate = async (
    appearanceData: AppearanceData,
    clearStateCallback?: ClearStateCallback
  ): Promise<void> => {
    isGenerateConfirmVisible.value = false;

    // 註：不在這裡扣除創建卡或免費次數
    // 後端會在生成角色圖片成功後才扣除，確保生成失敗時不會扣除用戶的資源

    try {
      // 創建或更新 flow
      let flow: CharacterCreationFlow | null = null;
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
        } catch (updateError: any) {
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
        .catch((error) => {
          void error;
        });
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

  const cancelGenerate = (): void => {
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
