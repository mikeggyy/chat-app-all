<script setup lang="ts">
import { ref, computed, reactive, watchEffect } from "vue";
import type { Ref, ComputedRef } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeftIcon } from "@heroicons/vue/24/outline";
import AvatarCropperOverlay from "../components/AvatarCropperOverlay.vue";
import StyleSelector from "../components/character-creation/StyleSelector.vue";
import ReferenceImageUploader from "../components/character-creation/ReferenceImageUploader.vue";
import AppearanceDescriptionEditor from "../components/character-creation/AppearanceDescriptionEditor.vue";
import PurchaseModal from "../components/character-creation/PurchaseModal.vue";
import { useStyleSelection } from "../composables/character-creation/useStyleSelection.js";
import { useReferenceImage } from "../composables/character-creation/useReferenceImage.js";
import { useAIMagician } from "../composables/character-creation/useAIMagician.js";
import { useAppearanceDescription } from "../composables/character-creation/useAppearanceDescription.js";
import { usePurchaseFlow } from "../composables/character-creation/usePurchaseFlow.js";
import { logger } from "../utils/logger.js";

// Types
interface AppearanceForm {
  description: string;
  styles: string[];
}

interface ReferenceInfo {
  image: string;
  name: string;
  source: string;
  focus: string;
}

interface AppearanceData {
  description: string;
  styles: string[];
  referenceInfo: ReferenceInfo | null;
}

interface ClearCreationStateOptions {
  preserveGender?: boolean;
}

interface CropResult {
  croppedImage: string;
  [key: string]: any;
}

interface StoredAppearance {
  description?: string;
  styles?: string[];
  referencePreview?: string;
  referenceName?: string;
  referenceSource?: string;
  referenceFocus?: string;
  [key: string]: any;
}

const router = useRouter();

// 保存的性別資料
const savedGender: Ref<string> = ref("");

// Session Storage 管理
const clearCreationState = ({ preserveGender = false }: ClearCreationStateOptions = {}): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!preserveGender) {
      window.sessionStorage.removeItem("characterCreation.gender");
    }
    window.sessionStorage.removeItem("characterCreation.appearance");
  } catch (error) {
    logger.warn('[角色創建] 清除 sessionStorage 失敗，可能是隱私模式或儲存空間已滿', error);
  }
};

const saveAppearanceState = (partial: Partial<StoredAppearance>): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const existing = window.sessionStorage.getItem(
      "characterCreation.appearance"
    );
    const data: StoredAppearance = existing ? JSON.parse(existing) : {};
    Object.assign(data, partial);
    window.sessionStorage.setItem(
      "characterCreation.appearance",
      JSON.stringify(data)
    );
  } catch (error) {
    logger.warn('[角色創建] 保存外觀設定到 sessionStorage 失敗', error);
  }
};

// 風格選擇
const {
  styleOptions,
  isLoadingStyles,
} = useStyleSelection();

const appearanceForm: AppearanceForm = reactive({
  description: "",
  styles: [],
});

// 參考圖片
const {
  referencePreview,
  referenceName,
  referenceSource,
  referenceFocus,
  referenceInput,
  isCropperOpen,
  referenceFocusOptions,
  handleReferenceTrigger,
  handleReferenceChange,
  handleCropConfirm,
  handleCropCancel,
  reopenReferenceCropper,
  handleReferenceClear,
  loadReferenceFromStorage,
} = useReferenceImage();

// 形象描述
const {
  description,
  maxLength: DESCRIPTION_MAX_LENGTH,
  loadDescriptionFromStorage,
  updateDescription,
  sanitizeText,
  desanitizeText,
} = useAppearanceDescription(saveAppearanceState);

// 將 description 綁定到 appearanceForm
watchEffect(() => {
  appearanceForm.description = description.value;
});

// AI 魔法師
const {
  aiMagicianUsage,
  isGeneratingDescription,
  referenceError,
  handleAIMagician: callAIMagician,
} = useAIMagician(savedGender);

// 購買流程
const {
  isGenerateConfirmVisible,
  showPurchaseModal,
  confirmMessage,
  handleGenerateAppearance: triggerGenerate,
  handleClosePurchaseModal,
  handleGoToShop,
  handleGoToVIP,
  confirmGenerate: executeGenerate,
  cancelGenerate,
} = usePurchaseFlow(savedGender);

// 從 sessionStorage 載入資料
watchEffect(() => {
  try {
    if (typeof window === "undefined") {
      return;
    }
    const storedGender = window.sessionStorage.getItem(
      "characterCreation.gender"
    );
    savedGender.value = storedGender ?? "";

    const storedAppearance = window.sessionStorage.getItem(
      "characterCreation.appearance"
    );

    if (storedAppearance) {
      const parsed: StoredAppearance = JSON.parse(storedAppearance);

      // 載入描述
      loadDescriptionFromStorage(parsed);

      // 載入風格
      if (Array.isArray(parsed.styles)) {
        appearanceForm.styles = parsed.styles;
      }

      // 載入參考圖片元資料
      loadReferenceFromStorage(parsed);
    }
  } catch (error) {
    logger.warn('[角色創建] 載入外觀設定失敗，將使用預設值', error);
  }
});

// 風格選擇處理
const toggleStyle = (styleId: string): void => {
  if (!styleId) {
    return;
  }
  const index = appearanceForm.styles.indexOf(styleId);
  if (index >= 0) {
    appearanceForm.styles.splice(index, 1);
  } else {
    appearanceForm.styles.push(styleId);
  }
  saveAppearanceState({ styles: [...appearanceForm.styles] });
};

// AI 魔法師處理
const handleAIMagicianClick = async (): Promise<void> => {
  const result = await callAIMagician(
    appearanceForm.styles as any,
    referencePreview.value,
    referenceFocus.value as any
  );

  if (result) {
    updateDescription(result);
  }
};

// 生成處理
// 🔥 允許空描述：後端會自動生成隨機描述
const isGenerateDisabled: ComputedRef<boolean> = computed(() => {
  // 不再檢查描述是否為空，用戶可以完全隨機生成
  return false;
});

const handleGenerateAppearance = (): void => {
  triggerGenerate(isGenerateDisabled.value);
};

const confirmGenerate = async (): Promise<void> => {
  saveAppearanceState({ styles: [...appearanceForm.styles] });
  const sanitizedDescription = sanitizeText(
    description.value.slice(0, DESCRIPTION_MAX_LENGTH)
  );

  const appearanceData: AppearanceData = {
    description: desanitizeText(sanitizedDescription),
    styles: [...appearanceForm.styles],
    referenceInfo: referencePreview.value
      ? {
          image: referencePreview.value,
          name: referenceName.value,
          source: referenceSource.value,
          focus: referenceFocus.value,
        }
      : null,
  };

  await executeGenerate(appearanceData, clearCreationState);
};

// 處理關閉
const handleClose = (): void => {
  const fallbackToProfile = (): void => {
    clearCreationState();
    router.replace({ name: "profile" }).catch(() => {});
  };

  if (typeof window === "undefined") {
    fallbackToProfile();
    return;
  }

  if (window.history.length > 1) {
    clearCreationState();
    router.back();
    window.setTimeout(() => {
      if (router.currentRoute.value?.name === "character-create-appearance") {
        fallbackToProfile();
      }
    }, 200);
    return;
  }

  fallbackToProfile();
};

// 參考圖片處理（包裝 composable 函數）
const handleCropConfirmWrapper = (result: string | CropResult): void => {
  const cropResult = typeof result === 'string' ? { croppedImage: result } : result;
  handleCropConfirm(cropResult as any, saveAppearanceState);
};

const handleReferenceClearWrapper = (): void => {
  handleReferenceClear(saveAppearanceState);
};

const handleReferenceFocusUpdate = (value: string): void => {
  referenceFocus.value = value;
  saveAppearanceState({ referenceFocus: value });
};
</script>

<template>
  <div class="appearance" role="dialog" aria-modal="true">
    <header class="appearance__header">
      <button
        type="button"
        class="appearance__icon-button"
        aria-label="返回上一步"
        @click="handleClose"
      >
        <ArrowLeftIcon aria-hidden="true" />
      </button>
      <div class="appearance__title">
        <h1>角色形象</h1>
        <span class="appearance__step-indicator"></span>
      </div>
      <div class="appearance__header-spacer"></div>
    </header>

    <main class="appearance__body">
      <ReferenceImageUploader
        :reference-preview="referencePreview"
        :reference-name="referenceName"
        :reference-focus="referenceFocus"
        :reference-focus-options="referenceFocusOptions"
        @trigger-upload="handleReferenceTrigger"
        @clear-reference="handleReferenceClearWrapper"
        @reopen-cropper="reopenReferenceCropper"
        @update:referenceFocus="handleReferenceFocusUpdate"
      />

      <AppearanceDescriptionEditor
        :description="description"
        :max-length="DESCRIPTION_MAX_LENGTH"
        :is-generating="isGeneratingDescription"
        :ai-magician-usage="aiMagicianUsage"
        :error-message="referenceError"
        @update:description="updateDescription"
        @ai-magician="handleAIMagicianClick"
      />

      <StyleSelector
        :style-options="styleOptions"
        :selected-styles="appearanceForm.styles"
        :is-loading="isLoadingStyles"
        @toggle-style="toggleStyle"
        @show-all="() => {}"
      />
    </main>

    <footer class="appearance__footer">
      <button
        type="button"
        class="appearance__generate"
        :disabled="isGenerateDisabled"
        @click="handleGenerateAppearance"
      >
        生成形象
      </button>
    </footer>

    <!-- 隱藏的文件輸入 -->
    <input
      ref="referenceInput"
      type="file"
      accept="image/*"
      class="appearance__reference-input"
      @change="handleReferenceChange"
    />

    <AvatarCropperOverlay
      v-if="isCropperOpen && referenceSource"
      :source="referenceSource"
      shape="rounded-rect"
      :aspect-ratio="2 / 3"
      @cancel="handleCropCancel"
      @confirm="handleCropConfirmWrapper"
    />

    <PurchaseModal
      :show="isGenerateConfirmVisible"
      type="confirm"
      :confirm-message="confirmMessage"
      @close="cancelGenerate"
      @confirm="confirmGenerate"
    />

    <PurchaseModal
      :show="showPurchaseModal"
      type="purchase"
      @close="handleClosePurchaseModal"
      @go-to-shop="handleGoToShop"
      @go-to-vip="handleGoToVIP"
    />
  </div>
</template>

<style scoped>
/* 全局 CSS 變數定義在原始文件中已經存在於 :root，這裡只需要組件特定樣式 */
.appearance {
  /* 顏色變數 */
  --color-white: #ffffff;
  --color-primary: #ff2f92;
  --color-primary-lighter: #ff77c3;
  --color-primary-lightest: #ffb3db;
  --text-secondary: rgba(255, 255, 255, 0.72);

  /* 背景變數 */
  --bg-card: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.08),
      rgba(255, 255, 255, 0.03)
    ),
    rgba(16, 16, 16, 0.64);
  --bg-overlay: rgba(255, 255, 255, 0.08);
  --bg-overlay-hover: rgba(255, 255, 255, 0.18);

  /* 邊框變數 */
  --border-light: rgba(255, 255, 255, 0.12);

  /* 漸變變數 */
  --gradient-primary: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);

  /* 圓角變數 */
  --radius-full: 999px;
  --radius-2xl: 18px;

  /* 間距變數 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-lg: 16px;
  --spacing-xl: 20px;
  --spacing-2xl: 24px;

  /* 過渡變數 */
  --transition-fast: 0.2s ease;

  /* 額外的邊框和背景變數 */
  --border-medium: rgba(255, 255, 255, 0.2);
  --border-dashed: rgba(255, 255, 255, 0.3);
  --bg-overlay-light: rgba(255, 255, 255, 0.05);
  --bg-overlay-medium: rgba(255, 255, 255, 0.15);
  --text-tertiary: rgba(255, 255, 255, 0.5);
  --radius-lg: 12px;

  /* 漸變和陰影 */
  --color-primary-bg-section: rgba(255, 47, 146, 0.15);
  --color-primary-shadow-icon: 0 4px 12px rgba(255, 47, 146, 0.2);
  --gradient-section-rose: linear-gradient(135deg, rgba(255, 47, 146, 0.2), rgba(255, 90, 188, 0.15));

  /* 文字顏色變數 */
  --text-primary: rgba(255, 255, 255, 0.95);
  --text-dim: rgba(255, 255, 255, 0.5);

  /* 更多背景和邊框變數 */
  --bg-overlay-strong: rgba(255, 255, 255, 0.2);
  --bg-overlay-option: rgba(255, 255, 255, 0.04);
  --border-hover: rgba(255, 255, 255, 0.35);
  --border-highlight: rgba(255, 255, 255, 0.25);
  --color-primary-border-active: var(--color-primary);
  --color-primary-border-strong: var(--color-primary);
  --color-primary-shadow-light: 0 0 0 3px rgba(255, 47, 146, 0.15);

  /* 應用樣式 */
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-2xl) var(--spacing-xl) 32px;
  background: radial-gradient(
      120% 120% at 50% 10%,
      rgba(255, 51, 151, 0.16),
      rgba(10, 10, 10, 0.92) 70%
    ),
    #0b0b0b;
  color: var(--color-white);
}

.appearance__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.appearance__icon-button {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: none;
  background-color: var(--bg-overlay);
  color: var(--color-white);
  transition: background-color var(--transition-fast);
}

.appearance__icon-button:hover {
  background-color: var(--bg-overlay-hover);
}

.appearance__icon-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.appearance__icon-button svg {
  width: 22px;
  height: 22px;
}

.appearance__title {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  flex: 1;
  text-align: center;
}

.appearance__title h1 {
  font-size: 22px;
  font-weight: 700;
}

.appearance__step-indicator {
  width: 48px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--gradient-primary);
}

.appearance__header-spacer {
  width: 36px;
  height: 36px;
}

.appearance__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  overflow-y: auto;
  flex: 1;
  max-height: calc(100dvh - 240px);
  padding-bottom: var(--spacing-2xl);
}

.appearance__footer {
  margin-top: 2rem;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.appearance__generate {
  width: 100%;
  padding: 14px var(--spacing-xl);
  border-radius: var(--radius-full);
  border: none;
  background: var(--gradient-primary);
  color: var(--color-white);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  cursor: pointer;
}

.appearance__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.appearance__generate:not(:disabled):hover {
  transform: translateY(-1px);
}

.appearance__generate:focus-visible {
  outline: 2px solid var(--color-white);
  outline-offset: 3px;
}

.appearance__reference-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

@media (min-width: 768px) {
  .appearance {
    padding: 32px 40px 40px;
  }
}
</style>
