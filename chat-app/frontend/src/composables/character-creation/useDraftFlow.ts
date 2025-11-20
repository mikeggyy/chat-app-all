/**
 * 管理未完成的角色創建流程（草稿）
 */
import { ref, type Ref } from "vue";

const DRAFT_FLOW_KEY = "character-creation-draft-flow";

export interface DraftFlow {
  flowId: string;
  createdAt: string;
  step: "generating" | "settings" | "voice"; // 當前進度
  hasGeneratedImages: boolean; // 是否已經生成圖片（已扣錢）
}

/**
 * useDraftFlow - 管理未完成的角色創建草稿
 */
export function useDraftFlow() {
  const hasDraft: Ref<boolean> = ref(false);
  const draftFlow: Ref<DraftFlow | null> = ref(null);

  /**
   * 檢查是否有未完成的草稿
   */
  const checkDraft = (): DraftFlow | null => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const stored = localStorage.getItem(DRAFT_FLOW_KEY);
      if (!stored) {
        hasDraft.value = false;
        draftFlow.value = null;
        return null;
      }

      const draft = JSON.parse(stored) as DraftFlow;

      // 檢查草稿是否過期（24小時）
      const createdTime = new Date(draft.createdAt).getTime();
      const now = Date.now();
      const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24小時

      if (now - createdTime > EXPIRY_TIME) {
        // 草稿已過期，清除
        clearDraft();
        return null;
      }

      hasDraft.value = true;
      draftFlow.value = draft;
      return draft;
    } catch (error) {
      console.error("[useDraftFlow] 檢查草稿失敗", error);
      clearDraft();
      return null;
    }
  };

  /**
   * 保存草稿
   */
  const saveDraft = (flow: DraftFlow): void => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(DRAFT_FLOW_KEY, JSON.stringify(flow));
      hasDraft.value = true;
      draftFlow.value = flow;
      console.log("[useDraftFlow] 草稿已保存", flow);
    } catch (error) {
      console.error("[useDraftFlow] 保存草稿失敗", error);
    }
  };

  /**
   * 清除草稿
   */
  const clearDraft = (): void => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.removeItem(DRAFT_FLOW_KEY);
      hasDraft.value = false;
      draftFlow.value = null;
      console.log("[useDraftFlow] 草稿已清除");
    } catch (error) {
      console.error("[useDraftFlow] 清除草稿失敗", error);
    }
  };

  /**
   * 更新草稿的步驟
   */
  const updateDraftStep = (step: DraftFlow["step"]): void => {
    if (!draftFlow.value) {
      return;
    }

    const updated = {
      ...draftFlow.value,
      step,
    };

    saveDraft(updated);
  };

  return {
    hasDraft,
    draftFlow,
    checkDraft,
    saveDraft,
    clearDraft,
    updateDraftStep,
  };
}
