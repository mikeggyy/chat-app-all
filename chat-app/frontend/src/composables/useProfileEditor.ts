/**
 * useProfileEditor Composable
 *
 * 負責個人資料編輯表單的狀態管理和邏輯處理
 */

import { ref, reactive, computed, Ref, ComputedRef } from "vue";
import { PROFILE_LIMITS } from "../config/profile";
import { logger } from "../utils/logger";

/**
 * 個人資料物件介面
 */
interface Profile {
  displayName?: string;
  gender?: string;
  age?: number | null;
  defaultPrompt?: string;
}

/**
 * 表單數據介面
 */
interface FormData {
  displayName: string;
  gender: string;
  age: number | null;
  defaultPrompt: string;
}

/**
 * 表單錯誤介面
 */
interface FormErrors {
  displayName: string;
  age: string;
  defaultPrompt: string;
}

/**
 * 驗證結果介面
 */
interface ValidationResult {
  isValid: boolean;
  trimmedName: string;
  trimmedPrompt: string;
}

/**
 * 標準化選項介面
 */
interface NormalizeOptions {
  fallback?: string;
  allowEmpty?: boolean;
}

/**
 * useProfileEditor 返回值介面
 */
interface UseProfileEditorReturn {
  // 狀態
  isOpen: Ref<boolean>;
  isSaving: Ref<boolean>;
  error: Ref<string>;
  form: FormData;
  formErrors: FormErrors;
  inputRef: Ref<HTMLElement | null>;

  // 計算屬性
  isFormDirty: ComputedRef<boolean>;
  displayNameLength: ComputedRef<number>;
  promptLength: ComputedRef<number>;

  // 方法
  open: () => void;
  close: () => void;
  submit: () => Promise<void>;
  applyProfileToForm: () => void;
  resetEditorState: () => void;
  watchFormField: (field: string, value: unknown) => void;
}

/**
 * 文字長度限制處理
 * @param {string} value - 輸入值
 * @param {number} maxLength - 最大長度
 * @returns {string} 限制後的值
 */
const clampTextLength = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

/**
 * 標準化顯示名稱
 * @param {string} value - 輸入值
 * @param {Object} options - 配置選項
 * @returns {string} 標準化後的顯示名稱
 */
const normalizeDisplayName = (
  value: unknown,
  { fallback = "", allowEmpty = false }: NormalizeOptions = {}
): string => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return allowEmpty ? "" : fallback;
  }
  return clampTextLength(trimmed, PROFILE_LIMITS.MAX_NAME_LENGTH);
};

/**
 * 標準化角色設定
 * @param {string} value - 輸入值
 * @returns {string} 標準化後的角色設定
 */
const normalizePrompt = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return clampTextLength(trimmed, PROFILE_LIMITS.MAX_PROMPT_LENGTH);
};

/**
 * 標準化性別
 * @param {string} value - 輸入值
 * @returns {string} 標準化後的性別
 */
const normalizeGender = (value: unknown): string => {
  const validGenders = ["male", "female", "other"];
  if (typeof value !== "string") {
    return "other";
  }
  const trimmed = value.trim();
  return validGenders.includes(trimmed) ? trimmed : "other";
};

/**
 * 驗證年齡
 * @param {number} age - 年齡
 * @returns {boolean} 是否有效
 */
const isValidAge = (age: number): boolean => {
  const ageNum = Number(age);
  return (
    Number.isFinite(ageNum) &&
    ageNum >= PROFILE_LIMITS.MIN_AGE &&
    ageNum <= PROFILE_LIMITS.MAX_AGE
  );
};

/**
 * 建立標準化的個人資料
 * @param {Object} sourceProfile - 來源個人資料
 * @returns {Object} 標準化的個人資料
 */
const buildNormalizedProfile = (sourceProfile: Profile = {}): FormData => ({
  displayName: normalizeDisplayName(sourceProfile.displayName, {
    allowEmpty: true,
  }),
  gender: normalizeGender(sourceProfile.gender),
  age: sourceProfile.age ?? null,
  defaultPrompt: normalizePrompt(sourceProfile.defaultPrompt),
});

/**
 * 個人資料編輯器 Composable
 * @param {Ref<Profile>} profile - 當前個人資料
 * @param {Function} onUpdate - 更新回調函數
 * @returns {UseProfileEditorReturn} 編輯器狀態和方法
 */
export function useProfileEditor(
  profile: Ref<Profile | null>,
  onUpdate: (patch: Partial<FormData>) => Promise<void>
): UseProfileEditorReturn {
  // ==================== 狀態管理 ====================

  const isOpen = ref<boolean>(false);
  const isSaving = ref<boolean>(false);
  const error = ref<string>("");
  const inputRef = ref<HTMLElement | null>(null);

  // 表單數據
  const form = reactive<FormData>({
    displayName: "",
    gender: "other",
    age: null,
    defaultPrompt: "",
  });

  // 表單錯誤
  const formErrors = reactive<FormErrors>({
    displayName: "",
    age: "",
    defaultPrompt: "",
  });

  // 防止響應式觸發
  let suppressFormDirty = false;

  // ==================== 計算屬性 ====================

  // 來源個人資料（標準化）
  const normalizedProfileSource = computed<FormData>(() =>
    buildNormalizedProfile(profile.value || {})
  );

  // 當前表單資料（標準化）
  const normalizedProfileForm = computed<FormData>(() => ({
    displayName: normalizeDisplayName(form.displayName, {
      allowEmpty: true,
      fallback: "",
    }),
    gender: normalizeGender(form.gender),
    age: form.age,
    defaultPrompt: normalizePrompt(form.defaultPrompt),
  }));

  // 表單是否已修改
  const isFormDirty = computed<boolean>(() => {
    const source = normalizedProfileSource.value;
    const current = normalizedProfileForm.value;
    return (
      current.displayName !== source.displayName ||
      current.gender !== source.gender ||
      current.age !== source.age ||
      current.defaultPrompt !== source.defaultPrompt
    );
  });

  // 顯示名稱長度
  const displayNameLength = computed<number>(
    () => normalizedProfileForm.value.displayName.length
  );

  // 角色設定長度
  const promptLength = computed<number>(
    () => normalizedProfileForm.value.defaultPrompt.length
  );

  // ==================== 方法 ====================

  /**
   * 將個人資料應用到表單
   */
  const applyProfileToForm = (): void => {
    suppressFormDirty = true;
    const sourceProfile = normalizedProfileSource.value;
    form.displayName = sourceProfile.displayName;
    form.gender = sourceProfile.gender;
    form.age = sourceProfile.age;
    form.defaultPrompt = sourceProfile.defaultPrompt;
    suppressFormDirty = false;
  };

  /**
   * 重置編輯器狀態
   */
  const resetEditorState = (): void => {
    error.value = "";
    formErrors.displayName = "";
    formErrors.age = "";
    formErrors.defaultPrompt = "";
  };

  /**
   * 驗證表單
   * @returns {ValidationResult} 驗證結果
   */
  const validateForm = (): ValidationResult => {
    let isValid = true;
    const trimmedName = normalizeDisplayName(form.displayName, {
      allowEmpty: true,
      fallback: "",
    });
    const rawNameLength =
      typeof form.displayName === "string"
        ? form.displayName.trim().length
        : 0;

    // 驗證名稱
    if (!trimmedName.length) {
      formErrors.displayName = "請輸入名稱";
      isValid = false;
    } else if (rawNameLength > PROFILE_LIMITS.MAX_NAME_LENGTH) {
      formErrors.displayName = `名稱請勿超過 ${PROFILE_LIMITS.MAX_NAME_LENGTH} 個字`;
      isValid = false;
    } else {
      formErrors.displayName = "";
    }

    // 驗證年齡
    const age = form.age;
    if (age !== null && age !== undefined) {
      const ageNum = Number(age);
      if (!isValidAge(ageNum)) {
        formErrors.age = `年齡必須在 ${PROFILE_LIMITS.MIN_AGE} 到 ${PROFILE_LIMITS.MAX_AGE} 歲之間`;
        isValid = false;
      } else {
        formErrors.age = "";
      }
    } else {
      formErrors.age = "";
    }

    // 驗證角色設定
    const trimmedPrompt = normalizePrompt(form.defaultPrompt);
    const rawPromptLength =
      typeof form.defaultPrompt === "string"
        ? form.defaultPrompt.trim().length
        : 0;

    if (rawPromptLength > PROFILE_LIMITS.MAX_PROMPT_LENGTH) {
      formErrors.defaultPrompt = `角色設定請勿超過 ${PROFILE_LIMITS.MAX_PROMPT_LENGTH} 個字`;
      isValid = false;
    } else {
      formErrors.defaultPrompt = "";
    }

    return {
      isValid,
      trimmedName,
      trimmedPrompt,
    };
  };

  /**
   * 打開編輯器
   */
  const open = (): void => {
    applyProfileToForm();
    resetEditorState();
    isOpen.value = true;
  };

  /**
   * 關閉編輯器
   */
  const close = (): void => {
    if (isSaving.value) return;
    isOpen.value = false;
  };

  /**
   * 監聽表單變化
   */
  const watchFormField = (field: string, value: unknown): void => {
    if (suppressFormDirty) return;

    // 限制長度
    if (field === "displayName") {
      if (typeof value !== "string") {
        suppressFormDirty = true;
        form.displayName = "";
        suppressFormDirty = false;
        return;
      }
      const clamped = clampTextLength(value, PROFILE_LIMITS.MAX_NAME_LENGTH);
      if (clamped !== value) {
        suppressFormDirty = true;
        form.displayName = clamped;
        suppressFormDirty = false;
      }
    }

    if (field === "defaultPrompt") {
      if (typeof value !== "string") {
        suppressFormDirty = true;
        form.defaultPrompt = "";
        suppressFormDirty = false;
        return;
      }
      const clamped = clampTextLength(value, PROFILE_LIMITS.MAX_PROMPT_LENGTH);
      if (clamped !== value) {
        suppressFormDirty = true;
        form.defaultPrompt = clamped;
        suppressFormDirty = false;
      }
    }

    if (field === "gender") {
      const normalized = normalizeGender(value);
      if (normalized !== value) {
        suppressFormDirty = true;
        form.gender = normalized;
        suppressFormDirty = false;
      }
    }

    // 清除錯誤
    if (isOpen.value) {
      error.value = "";
    }
  };

  /**
   * 提交表單
   */
  const submit = async (): Promise<void> => {
    if (isSaving.value) return;
    error.value = "";

    const { isValid, trimmedName, trimmedPrompt } = validateForm();

    if (!isValid) {
      return;
    }

    const normalizedGender = normalizeGender(form.gender);
    const normalizedAge =
      form.age !== null && form.age !== undefined
        ? Number(form.age)
        : null;
    const source = normalizedProfileSource.value;

    // 構建變更數據
    const patch: Partial<FormData> = {};

    if (trimmedName !== source.displayName) {
      patch.displayName = trimmedName;
    }
    if (normalizedGender !== source.gender) {
      patch.gender = normalizedGender;
    }
    if (normalizedAge !== source.age) {
      patch.age = normalizedAge;
    }
    if (trimmedPrompt !== source.defaultPrompt) {
      patch.defaultPrompt = trimmedPrompt;
    }

    if (Object.keys(patch).length === 0) {
      error.value = "未修改任何資料。";
      return;
    }

    isSaving.value = true;

    try {
      await onUpdate(patch);
      isOpen.value = false;
      resetEditorState();
      applyProfileToForm();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "更新個人資料時發生錯誤，請稍後再試。";
      error.value = message;
      logger.error("[useProfileEditor] 更新失敗:", err);
    } finally {
      isSaving.value = false;
    }
  };

  // ==================== 返回 ====================

  return {
    // 狀態
    isOpen,
    isSaving,
    error,
    form,
    formErrors,
    inputRef,

    // 計算屬性
    isFormDirty,
    displayNameLength,
    promptLength,

    // 方法
    open,
    close,
    submit,
    applyProfileToForm,
    resetEditorState,
    watchFormField,
  };
}
