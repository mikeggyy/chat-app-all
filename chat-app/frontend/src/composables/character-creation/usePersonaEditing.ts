import { reactive, computed } from "vue";
import type { ComputedRef } from "vue";
import { CHARACTER_CREATION_LIMITS } from "../../config/characterCreation.js";

/**
 * Persona 表單數據
 */
export interface PersonaForm {
  name: string;
  tagline: string;
  hiddenProfile: string;
  prompt: string;
}

/**
 * usePersonaEditing
 *
 * 管理角色 Persona 表單的編輯邏輯
 *
 * @returns Persona 編輯相關狀態和方法
 */
export function usePersonaEditing() {
  // ===== 常量 =====

  const MAX_NAME_LENGTH = CHARACTER_CREATION_LIMITS.MAX_NAME_LENGTH;
  const MAX_TAGLINE_LENGTH = CHARACTER_CREATION_LIMITS.MAX_TAGLINE_LENGTH;
  const MAX_PROMPT_LENGTH = CHARACTER_CREATION_LIMITS.MAX_PROMPT_LENGTH;
  const MAX_HIDDEN_PROFILE_LENGTH =
    CHARACTER_CREATION_LIMITS.MAX_HIDDEN_PROFILE_LENGTH;

  // ===== 狀態 =====

  /**
   * 表單數據
   */
  const personaForm: PersonaForm = reactive({
    name: "",
    tagline: "",
    hiddenProfile: "",
    prompt: "",
  });

  // ===== Computed =====

  /**
   * 角色名長度
   */
  const nameLength: ComputedRef<number> = computed(() => {
    return personaForm.name.length;
  });

  /**
   * 標語長度
   */
  const taglineLength: ComputedRef<number> = computed(() => {
    return personaForm.tagline.length;
  });

  /**
   * 隱藏設定長度
   */
  const hiddenProfileLength: ComputedRef<number> = computed(() => {
    return personaForm.hiddenProfile.length;
  });

  /**
   * 開場白長度
   */
  const promptLength: ComputedRef<number> = computed(() => {
    return personaForm.prompt.length;
  });

  /**
   * 是否有編輯過的內容
   */
  const hasEditedContent: ComputedRef<boolean> = computed(() => {
    return (
      personaForm.name.trim().length > 0 ||
      personaForm.tagline.trim().length > 0 ||
      personaForm.hiddenProfile.trim().length > 0 ||
      personaForm.prompt.trim().length > 0
    );
  });

  /**
   * 表單是否完整（所有必填欄位都已填寫）
   */
  const isFormComplete: ComputedRef<boolean> = computed(() => {
    return (
      personaForm.name.trim().length > 0 &&
      personaForm.tagline.trim().length > 0 &&
      personaForm.hiddenProfile.trim().length > 0 &&
      personaForm.prompt.trim().length > 0
    );
  });

  // ===== 方法 =====

  /**
   * 更新角色名
   *
   * @param value - 新的角色名
   */
  const updateName = (value: string): void => {
    personaForm.name = value.slice(0, MAX_NAME_LENGTH);
  };

  /**
   * 更新標語
   *
   * @param value - 新的標語
   */
  const updateTagline = (value: string): void => {
    personaForm.tagline = value.slice(0, MAX_TAGLINE_LENGTH);
  };

  /**
   * 更新隱藏設定
   *
   * @param value - 新的隱藏設定
   */
  const updateHiddenProfile = (value: string): void => {
    personaForm.hiddenProfile = value.slice(0, MAX_HIDDEN_PROFILE_LENGTH);
  };

  /**
   * 更新開場白
   *
   * @param value - 新的開場白
   */
  const updatePrompt = (value: string): void => {
    personaForm.prompt = value.slice(0, MAX_PROMPT_LENGTH);
  };

  /**
   * 批量設置 Persona 數據（從 AI 生成或後端加載）
   *
   * @param data - Persona 數據
   */
  const setPersonaData = (data: Partial<PersonaForm>): void => {
    if (data.name !== undefined) {
      personaForm.name = data.name.slice(0, MAX_NAME_LENGTH);
    }
    if (data.tagline !== undefined) {
      personaForm.tagline = data.tagline.slice(0, MAX_TAGLINE_LENGTH);
    }
    if (data.hiddenProfile !== undefined) {
      personaForm.hiddenProfile = data.hiddenProfile.slice(
        0,
        MAX_HIDDEN_PROFILE_LENGTH
      );
    }
    if (data.prompt !== undefined) {
      personaForm.prompt = data.prompt.slice(0, MAX_PROMPT_LENGTH);
    }
  };

  /**
   * 清空表單
   */
  const clearForm = (): void => {
    personaForm.name = "";
    personaForm.tagline = "";
    personaForm.hiddenProfile = "";
    personaForm.prompt = "";
  };

  /**
   * 驗證表單（檢查長度限制）
   *
   * @returns 驗證結果和錯誤訊息
   */
  const validateForm = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (personaForm.name.length > MAX_NAME_LENGTH) {
      errors.push(`角色名不能超過 ${MAX_NAME_LENGTH} 個字`);
    }
    if (personaForm.tagline.length > MAX_TAGLINE_LENGTH) {
      errors.push(`角色設定不能超過 ${MAX_TAGLINE_LENGTH} 個字`);
    }
    if (personaForm.hiddenProfile.length > MAX_HIDDEN_PROFILE_LENGTH) {
      errors.push(`隱藏設定不能超過 ${MAX_HIDDEN_PROFILE_LENGTH} 個字`);
    }
    if (personaForm.prompt.length > MAX_PROMPT_LENGTH) {
      errors.push(`開場白不能超過 ${MAX_PROMPT_LENGTH} 個字`);
    }

    if (!isFormComplete.value) {
      errors.push("所有欄位都必須填寫");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  /**
   * 獲取表單數據的副本（用於提交）
   *
   * @returns 表單數據副本
   */
  const getFormData = (): PersonaForm => {
    return {
      name: personaForm.name.trim(),
      tagline: personaForm.tagline.trim(),
      hiddenProfile: personaForm.hiddenProfile.trim(),
      prompt: personaForm.prompt.trim(),
    };
  };

  // ===== 返回 =====

  return {
    // 常量
    MAX_NAME_LENGTH,
    MAX_TAGLINE_LENGTH,
    MAX_PROMPT_LENGTH,
    MAX_HIDDEN_PROFILE_LENGTH,

    // 狀態
    personaForm,

    // Computed
    nameLength,
    taglineLength,
    hiddenProfileLength,
    promptLength,
    hasEditedContent,
    isFormComplete,

    // 方法
    updateName,
    updateTagline,
    updateHiddenProfile,
    updatePrompt,
    setPersonaData,
    clearForm,
    validateForm,
    getFormData,
  };
}

/**
 * usePersonaEditing 返回類型
 */
export type UsePersonaEditingReturn = ReturnType<typeof usePersonaEditing>;
