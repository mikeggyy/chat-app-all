<script setup>
import { computed, onMounted, reactive, ref, watch, watchEffect } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeftIcon,
  PhotoIcon,
  ArrowRightIcon,
} from "@heroicons/vue/24/outline";
import { SparklesIcon } from "@heroicons/vue/24/solid";
import AvatarCropperOverlay from "../components/AvatarCropperOverlay.vue";
import {
  generateAppearanceDescription,
  createCharacterCreationFlow,
  storeCharacterCreationFlowId,
  updateCharacterCreationStep,
  generateCharacterImages,
} from "../services/characterCreation.service.js";
import { apiJson } from "../utils/api.js";
import { useFirebaseAuth } from "../composables/useFirebaseAuth.js";
import { useUserProfile } from "../composables/useUserProfile.js";

const router = useRouter();
const firebaseAuth = useFirebaseAuth();
const { user } = useUserProfile();

const appearanceForm = reactive({
  description: "",
  styles: [],
});

const referencePreview = ref("");
const referenceName = ref("");
const referenceSource = ref("");
const referenceFocus = ref("face");
const referenceError = ref("");
const referenceInput = ref(null);
const isCropperOpen = ref(false);
const pendingReferenceBackup = ref(null);

const DESCRIPTION_MAX_LENGTH = 60;
const STYLE_THUMBNAIL_BASE = "/character-create/styles";

// 從 API 動態載入風格選項
const styleOptions = ref([]);
const isLoadingStyles = ref(false);

const savedGender = ref("");
const isGeneratingDescription = ref(false);
const isGenerateConfirmVisible = ref(false);
const referenceFocusOptions = [
  { value: "face", label: "參考臉部" },
  { value: "scene", label: "參考場景" },
];

// AI 魔法師使用次數限制
const AI_MAGICIAN_LIMIT = 3;
const aiMagicianUsageCount = ref(0);
const aiMagicianRemainingUsage = computed(() => {
  return Math.max(0, AI_MAGICIAN_LIMIT - aiMagicianUsageCount.value);
});
const isAIMagicianDisabled = computed(() => {
  return isGeneratingDescription.value || aiMagicianRemainingUsage.value <= 0;
});

// User assets
const userCreateCards = ref(0);
const freeCreationsRemaining = ref(0);
const isLoadingAssets = ref(false);

// 購買提示彈窗
const showPurchaseModal = ref(false);

const sanitizeText = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[&<>"'`]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      case "`":
        return "&#96;";
      default:
        return char;
    }
  });
};

const desanitizeText = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#96;/g, "`")
    .replace(/&amp;/g, "&");
};

const clearCreationState = ({ preserveGender = false } = {}) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!preserveGender) {
      window.sessionStorage.removeItem("characterCreation.gender");
    }
    window.sessionStorage.removeItem("characterCreation.appearance");
  } catch (error) {
  }
};

const saveAppearanceState = (partial) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const existing = window.sessionStorage.getItem(
      "characterCreation.appearance"
    );
    const data = existing ? JSON.parse(existing) : {};
    Object.assign(data, partial);
    window.sessionStorage.setItem(
      "characterCreation.appearance",
      JSON.stringify(data)
    );
  } catch (error) {
  }
};

const loadCharacterStyles = async () => {
  isLoadingStyles.value = true;
  try {
    const response = await apiJson("/api/character-styles", {
      skipGlobalLoading: true,
    });

    if (response?.styles && Array.isArray(response.styles)) {
      // 將 API 資料轉換為前端格式，添加 thumbnail 完整路徑
      styleOptions.value = response.styles.map((style) => ({
        id: style.id,
        label: style.label,
        era: style.era,
        thumbnail: `${STYLE_THUMBNAIL_BASE}/${style.thumbnail}`,
      }));

      // 載入完成後，清理 appearanceForm.styles 中無效的風格 ID
      if (appearanceForm.styles.length > 0) {
        const validStyles = appearanceForm.styles.filter((styleId) =>
          styleOptions.value.some((option) => option.id === styleId)
        );
        if (validStyles.length !== appearanceForm.styles.length) {
          appearanceForm.styles = validStyles;
          // 更新 sessionStorage
          saveAppearanceState({ styles: validStyles });
        }
      }
    }
  } catch (error) {
    // 使用空陣列作為 fallback
    styleOptions.value = [];
  } finally {
    isLoadingStyles.value = false;
  }
};

const loadUserAssets = async () => {
  const userId = user.value?.id;
  if (!userId) {
    return;
  }

  isLoadingAssets.value = true;
  try {
    // 獲取用戶資產（創建卡數量）
    const assetsData = await apiJson(`/api/users/${encodeURIComponent(userId)}/assets`, {
      skipGlobalLoading: true,
    });

    if (assetsData) {
      userCreateCards.value = assetsData.createCards || 0;
    }

    // 獲取免費創建次數（從 limits API）
    const limitsData = await apiJson(`/api/character-creation/limits/${encodeURIComponent(userId)}`, {
      skipGlobalLoading: true,
    });

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

onMounted(async () => {
  // 載入風格選項
  await loadCharacterStyles();

  // 載入用戶資產
  await loadUserAssets();

  // 強制清理舊的風格選擇（版本控制）
  const STYLE_VERSION = "v2"; // 更新版本號會清除所有舊資料
  const storedVersion = typeof window !== "undefined"
    ? window.sessionStorage?.getItem("characterCreation.styleVersion")
    : null;

  if (storedVersion !== STYLE_VERSION) {
    // 清除舊的風格選擇
    appearanceForm.styles = [];
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem("characterCreation.appearance");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.styles = [];
          window.sessionStorage.setItem(
            "characterCreation.appearance",
            JSON.stringify(parsed)
          );
        }
        window.sessionStorage.setItem("characterCreation.styleVersion", STYLE_VERSION);
      } catch (error) {
      }
    }
  }
});

watchEffect(() => {
  try {
    if (typeof window === "undefined") {
      return;
    }
    const storedGender = window.sessionStorage.getItem(
      "characterCreation.gender"
    );
    savedGender.value = storedGender ?? "";

    // 從 sessionStorage 讀取 AI 魔法師使用次數
    // 確保在 savedGender 初始化後讀取
    if (savedGender.value) {
      const sessionKey = `ai-magician-usage-${savedGender.value}`;
      const storedUsage = window.sessionStorage.getItem(sessionKey);
      if (storedUsage) {
        aiMagicianUsageCount.value = parseInt(storedUsage, 10);
      } else {
        aiMagicianUsageCount.value = 0;
      }
    }

    const storedAppearance = window.sessionStorage.getItem(
      "characterCreation.appearance"
    );

    if (storedAppearance) {
      const parsed = JSON.parse(storedAppearance);
      if (typeof parsed.description === "string") {
        appearanceForm.description = desanitizeText(parsed.description).slice(
          0,
          DESCRIPTION_MAX_LENGTH
        );
      }
      if (Array.isArray(parsed.styles)) {
        appearanceForm.styles = parsed.styles.filter((style) =>
          styleOptions.some((option) => option.id === style)
        );
      }
      // 不要從 sessionStorage 讀取大型 base64 圖片
      // referencePreview 和 referenceSource 只在記憶體中保留
      if (typeof parsed.referenceName === "string") {
        referenceName.value = parsed.referenceName;
      }
      if (
        typeof parsed.referenceFocus === "string" &&
        referenceFocusOptions.some(
          (option) => option.value === parsed.referenceFocus
        )
      ) {
        referenceFocus.value = parsed.referenceFocus;
      }
    }
  } catch (error) {
  }
});

watch(
  () => appearanceForm.description,
  (value) => {
    const source = typeof value === "string" ? value : "";
    let normalized = source;
    if (source.length > DESCRIPTION_MAX_LENGTH) {
      normalized = source.slice(0, DESCRIPTION_MAX_LENGTH);
    }
    if (normalized !== appearanceForm.description) {
      appearanceForm.description = normalized;
      return;
    }
    const sanitized = sanitizeText(normalized);
    saveAppearanceState({ description: sanitized });
  }
);

watch(
  () => referenceFocus.value,
  (value) => {
    saveAppearanceState({ referenceFocus: value });
  }
);

const handleClose = () => {
  const fallbackToProfile = () => {
    clearCreationState();
    router.replace({ name: "profile" }).catch((error) => {
    });
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

const handleAIMagician = async () => {
  if (isGeneratingDescription.value) {
    return;
  }

  try {
    isGeneratingDescription.value = true;
    referenceError.value = ""; // 清除之前的錯誤

    // 使用 sessionStorage 追蹤 AI 魔法師使用次數，不創建 flow
    // 只有在真正點擊「生成形象」時才創建 flow
    const sessionKey = `ai-magician-usage-${savedGender.value}`;
    const currentUsage = parseInt(sessionStorage.getItem(sessionKey) || "0", 10);

    // 檢查是否超過使用限制
    if (currentUsage >= AI_MAGICIAN_LIMIT) {
      referenceError.value = "AI 魔法師使用次數已達上限（3次）";
      return;
    }

    const referenceInfo = referencePreview.value
      ? {
          image: referencePreview.value,  // 傳遞 base64 圖片數據
          focus: referenceFocus.value
        }
      : null;

    // 臨時創建一個簡單的請求體，不需要 flowId
    // 後端需要修改 API 以支持無 flowId 的請求（僅用於 AI 魔法師）
    const requestBody = {
      gender: savedGender.value,
      styles: appearanceForm.styles,
      referenceInfo,
    };

    // 直接調用 AI 描述生成 API（不需要 flowId）
    const response = await apiJson("/api/character-creation/ai-description", {
      method: "POST",
      body: requestBody,
      skipGlobalLoading: true,
    });

    const description = response?.description ?? "";

    // 更新使用次數（保存到 sessionStorage）
    const newUsageCount = currentUsage + 1;
    sessionStorage.setItem(sessionKey, newUsageCount.toString());
    aiMagicianUsageCount.value = newUsageCount;

    // 檢測拒絕訊息（同時包含 "抱歉" 和 "無法" 關鍵詞）
    if (description && description.includes("抱歉") && description.includes("無法")) {
      referenceError.value = description;
      return; // 不要填入 input
    }

    if (description) {
      appearanceForm.description = description;
      saveAppearanceState({ description: sanitizeText(description) });
    }
  } catch (error) {
    // 錯誤也顯示在 referenceError 而非 alert
    referenceError.value = error instanceof Error && error.message
      ? error.message
      : "AI 魔法師生成失敗，請稍後再試";
  } finally {
    isGeneratingDescription.value = false;
  }
};

const handleReferenceTrigger = () => {
  referenceInput.value?.click();
};

const handleReferenceChange = (event) => {
  const [file] = Array.from(event.target?.files ?? []);
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === "string" ? reader.result : "";
    if (!result) {
      return;
    }
    pendingReferenceBackup.value = {
      preview: referencePreview.value,
      name: referenceName.value,
      source: referenceSource.value,
      focus: referenceFocus.value,
    };
    referenceName.value = file.name ?? "";
    referenceSource.value = result;
    referenceFocus.value = "face";
    isCropperOpen.value = true;
  };
  reader.readAsDataURL(file);

  if (event.target) {
    event.target.value = "";
  }
};

const handleCropConfirm = (result) => {
  isCropperOpen.value = false;
  if (!result) {
    handleCropCancel();
    return;
  }
  referencePreview.value = result;
  // 不要儲存大型 base64 圖片到 sessionStorage，只儲存元資料
  saveAppearanceState({
    referenceName: referenceName.value,
    referenceFocus: referenceFocus.value,
  });
  pendingReferenceBackup.value = null;
};

const handleCropCancel = () => {
  isCropperOpen.value = false;
  if (pendingReferenceBackup.value) {
    referencePreview.value = pendingReferenceBackup.value.preview;
    referenceName.value = pendingReferenceBackup.value.name;
    referenceSource.value = pendingReferenceBackup.value.source;
    if (typeof pendingReferenceBackup.value.focus === "string") {
      referenceFocus.value = pendingReferenceBackup.value.focus;
    }
    pendingReferenceBackup.value = null;
  }
};

const reopenReferenceCropper = () => {
  if (!referenceSource.value) {
    return;
  }
  pendingReferenceBackup.value = {
    preview: referencePreview.value,
    name: referenceName.value,
    source: referenceSource.value,
    focus: referenceFocus.value,
  };
  isCropperOpen.value = true;
};

const handleReferenceClear = () => {
  referencePreview.value = "";
  referenceName.value = "";
  referenceSource.value = "";
  referenceFocus.value = "face";
  pendingReferenceBackup.value = null;
  // 不要儲存大型 base64 圖片到 sessionStorage
  saveAppearanceState({
    referenceName: "",
    referenceFocus: "face",
  });
};

const toggleStyle = (styleId) => {
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

const isStyleSelected = (styleId) => appearanceForm.styles.includes(styleId);

const descriptionCharCount = computed(() => {
  return appearanceForm.description.length;
});

const isGenerateDisabled = computed(() => {
  const description = appearanceForm.description.trim();
  return description.length === 0;
});

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

const handleGenerateAppearance = () => {
  if (isGenerateDisabled.value) {
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
  router.push({ name: "shop" }).catch((error) => {
  });
};

const handleGoToVIP = () => {
  // 導向 VIP 充值頁面
  showPurchaseModal.value = false;
  router.push({ name: "membership" }).catch((error) => {
  });
};

const confirmGenerate = async () => {
  isGenerateConfirmVisible.value = false;

  // 註：不在這裡扣除創建卡或免費次數
  // 後端會在生成角色圖片成功後才扣除，確保生成失敗時不會扣除用戶的資源

  saveAppearanceState({ styles: [...appearanceForm.styles] });
  const sanitizedDescription = sanitizeText(
    appearanceForm.description.slice(0, DESCRIPTION_MAX_LENGTH)
  );

  const appearanceData = {
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
  } catch (error) {
    if (typeof window !== "undefined") {
      window.alert(
        error instanceof Error && error.message
          ? `保存失敗：${error.message}`
          : "保存角色形象資料失敗，請稍後再試"
      );
    }
    return;
  }

  clearCreationState({ preserveGender: true });
  router.push({ name: "character-create-generating" }).catch((error) => {
  });
};

const cancelGenerate = () => {
  isGenerateConfirmVisible.value = false;
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
      <section class="appearance__card" aria-labelledby="appearance-ref-label">
        <header class="appearance__card-header">
          <div class="appearance__card-titles">
            <h2 id="appearance-ref-label">參考圖片</h2>
            <span class="appearance__card-subtitle">可選</span>
          </div>
          <button
            v-if="referencePreview"
            type="button"
            class="appearance__reference-clear-link"
            @click="handleReferenceClear"
          >
            清空圖片
          </button>
        </header>
        <input
          ref="referenceInput"
          type="file"
          accept="image/*"
          class="appearance__reference-input"
          @change="handleReferenceChange"
        />
        <div v-if="referencePreview" class="appearance__reference-summary">
          <div class="appearance__reference-media">
            <div class="appearance__reference-image">
              <img
                :src="referencePreview"
                :alt="referenceName || '參考圖片預覽'"
              />
            </div>
            <div class="appearance__reference-actions">
              <button
                type="button"
                class="appearance__reference-action"
                @click="handleReferenceTrigger"
              >
                重新選擇圖片
              </button>
              <button
                v-if="referenceSource"
                type="button"
                class="appearance__reference-action"
                @click="reopenReferenceCropper"
              >
                重新裁切
              </button>
            </div>
          </div>

          <div class="appearance__reference-meta">
            <div
              class="appearance__reference-focus"
              role="radiogroup"
              aria-label="參考類型"
            >
              <label
                v-for="option in referenceFocusOptions"
                :key="option.value"
                :class="[
                  'appearance__reference-option',
                  { 'is-active': referenceFocus === option.value },
                ]"
              >
                <input
                  type="radio"
                  class="appearance__reference-option-input"
                  :value="option.value"
                  v-model="referenceFocus"
                />
                <span
                  class="appearance__reference-option-indicator"
                  aria-hidden="true"
                ></span>
                <span class="appearance__reference-option-label">
                  {{ option.label }}
                </span>
              </label>
            </div>

            <div class="appearance__reference-tip">
              <div class="appearance__reference-tip-avatar" aria-hidden="true">
                <img :src="referencePreview" alt="" />
              </div>
              <p class="appearance__reference-tip-text">
                聚焦臉部以提高生圖質量
              </p>
            </div>
          </div>
        </div>
        <div v-else class="appearance__reference-empty">
          <button
            type="button"
            class="appearance__reference-upload"
            @click="handleReferenceTrigger"
          >
            <PhotoIcon aria-hidden="true" />
            <span>上傳/拍攝一張圖片進行參考</span>
          </button>
          <p class="appearance__reference-empty-hint">
            支援常見圖片格式，建議使用 2:3 比例的人像或場景照。
          </p>
        </div>
      </section>

      <section class="appearance__card" aria-labelledby="appearance-desc-label">
        <header class="appearance__card-header">
          <div class="appearance__card-titles">
            <h2 id="appearance-desc-label">形象描述</h2>
          </div>
          <div class="appearance__ai-magician-wrapper">
            <button
              type="button"
              class="appearance__ai-button"
              :disabled="isAIMagicianDisabled"
              @click="handleAIMagician"
            >
              <SparklesIcon aria-hidden="true" />
              <span>{{
                isGeneratingDescription ? "生成中..." : "AI魔法師"
              }}</span>
            </button>
            <div class="appearance__ai-usage" v-if="!isGeneratingDescription">
              <span :class="{ 'appearance__ai-usage--warning': aiMagicianRemainingUsage <= 1 }">
                剩餘 {{ aiMagicianRemainingUsage }}/{{ AI_MAGICIAN_LIMIT }} 次
              </span>
            </div>
          </div>
        </header>

        <!-- 錯誤訊息顯示 -->
        <div v-if="referenceError" class="appearance__ai-error">
          {{ referenceError }}
        </div>

        <div class="appearance__textarea-wrapper">
          <textarea
            v-model="appearanceForm.description"
            class="appearance__textarea"
            rows="5"
            :maxlength="DESCRIPTION_MAX_LENGTH"
            placeholder="描述角色的長相動作、髮型服飾、環境場景等"
          ></textarea>
          <div class="appearance__char-count">
            {{ descriptionCharCount }}/{{ DESCRIPTION_MAX_LENGTH }}
          </div>
        </div>
      </section>

      <section
        class="appearance__card appearance__styles-section"
        aria-labelledby="appearance-style-label"
      >
        <header
          class="appearance__section-header appearance__section-header--compact"
        >
          <div class="appearance__section-title">
            <div
              class="appearance__section-icon appearance__section-icon--rose"
              aria-hidden="true"
            >
              <SparklesIcon />
            </div>
            <div>
              <p class="appearance__section-kicker">角色風格</p>
              <h2 id="appearance-style-label">添加風格</h2>
              <p class="appearance__section-note">可多選</p>
            </div>
          </div>
          <button type="button" class="appearance__section-action">
            <span>全部風格</span>
            <ArrowRightIcon
              class="appearance__section-action-icon"
              aria-hidden="true"
            />
          </button>
        </header>
        <div
          class="appearance__styles-scroll"
          role="listbox"
          aria-label="角色風格"
        >
          <button
            v-for="style in styleOptions"
            :key="style.id"
            type="button"
            class="appearance__style-card"
            :class="{
              'appearance__style-card--selected': isStyleSelected(style.id),
            }"
            role="option"
            :aria-selected="isStyleSelected(style.id)"
            @click="toggleStyle(style.id)"
          >
            <img :src="style.thumbnail" :alt="style.label" />
            <div class="appearance__style-body">
              <h3 class="appearance__style-name">{{ style.label }}</h3>
              <p class="appearance__style-meta">
                {{ isStyleSelected(style.id) ? "已選擇" : "點擊加入" }}
              </p>
            </div>
          </button>
        </div>
      </section>
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

    <AvatarCropperOverlay
      v-if="isCropperOpen && referenceSource"
      :source="referenceSource"
      shape="rounded-rect"
      :aspect-ratio="2 / 3"
      @cancel="handleCropCancel"
      @confirm="handleCropConfirm"
    />

    <Teleport to="body">
      <div
        v-if="isGenerateConfirmVisible"
        class="appearance__confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-confirm-title"
      >
        <div
          class="appearance__confirm-backdrop"
          aria-hidden="true"
          @click="cancelGenerate"
        ></div>
        <div class="appearance__confirm-panel">
          <header class="appearance__confirm-header">
            <h2 id="generate-confirm-title">確認生成角色</h2>
            <p>{{ confirmMessage }}</p>
            <button
              type="button"
              class="appearance__confirm-close"
              aria-label="關閉確認視窗"
              @click="cancelGenerate"
            >
              ×
            </button>
          </header>
          <footer class="appearance__confirm-actions">
            <button
              type="button"
              class="appearance__confirm-action appearance__confirm-action--ghost"
              @click="cancelGenerate"
            >
              取消
            </button>
            <button
              type="button"
              class="appearance__confirm-action appearance__confirm-action--primary"
              @click="confirmGenerate"
            >
              確認生成
            </button>
          </footer>
        </div>
      </div>

      <!-- 購買提示彈窗 -->
      <div
        v-if="showPurchaseModal"
        class="appearance__confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-modal-title"
      >
        <div
          class="appearance__confirm-backdrop"
          aria-hidden="true"
          @click="handleClosePurchaseModal"
        ></div>
        <div class="appearance__confirm-panel">
          <header class="appearance__confirm-header">
            <h2 id="purchase-modal-title">次數不足</h2>
            <p>您的免費創建次數已用完，且沒有剩餘的創建角色卡。</p>
            <button
              type="button"
              class="appearance__confirm-close"
              aria-label="關閉視窗"
              @click="handleClosePurchaseModal"
            >
              ×
            </button>
          </header>
          <div class="appearance__purchase-options">
            <p class="appearance__purchase-subtitle">請選擇以下方式繼續創建角色：</p>
            <button
              type="button"
              class="appearance__purchase-option"
              @click="handleGoToShop"
            >
              <div class="appearance__purchase-option-icon">🎫</div>
              <div class="appearance__purchase-option-content">
                <h3>購買創建角色卡</h3>
                <p>使用創建角色卡立即生成新角色</p>
              </div>
            </button>
            <button
              type="button"
              class="appearance__purchase-option"
              @click="handleGoToVIP"
            >
              <div class="appearance__purchase-option-icon">👑</div>
              <div class="appearance__purchase-option-content">
                <h3>升級 VIP 會員</h3>
                <p>享受更多免費創建次數及專屬權益</p>
              </div>
            </button>
          </div>
          <footer class="appearance__confirm-actions">
            <button
              type="button"
              class="appearance__confirm-action appearance__confirm-action--ghost"
              @click="handleClosePurchaseModal"
            >
              稍後再說
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.appearance {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 24px 20px 32px;
  background: radial-gradient(
      140% 140% at 50% -10%,
      rgba(255, 51, 151, 0.18),
      rgba(10, 10, 10, 0.94) 65%
    ),
    #0b0b0b;
  color: #ffffff;
}

.appearance__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.appearance__icon-button {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: none;
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  transition: background-color 0.2s ease;
}

.appearance__icon-button:hover {
  background-color: rgba(255, 255, 255, 0.16);
}

.appearance__icon-button:focus-visible {
  outline: 2px solid #ff2f92;
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
  gap: 4px;
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
  border-radius: 999px;
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
}

.appearance__header-spacer {
  width: 36px;
  height: 36px;
}

.appearance__body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  height: 173vw;
  padding-bottom: 24px;
}

.appearance__card {
  background: rgba(19, 19, 19, 0.72);
  border-radius: 20px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.appearance__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.appearance__card-titles {
  display: flex;
  align-items: center;
  gap: 8px;
}

.appearance__card-titles h2 {
  font-size: 18px;
  font-weight: 600;
}

.appearance__card-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}

.appearance__reference-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.appearance__reference-clear-link {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  color: #ff7ab8;
  font-size: 14px;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.appearance__reference-clear-link:hover {
  color: #ff94c7;
}

.appearance__reference-summary {
  display: flex;
  gap: 20px;
  align-items: stretch;
}

.appearance__reference-media {
  flex: 0 0 175;
  max-width: 40%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.appearance__reference-image {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.appearance__reference-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.appearance__reference-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.appearance__reference-action {
  flex: 1;
  min-width: 140px;
  padding: 10px 16px;
  border-radius: 999px;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  letter-spacing: 0.04em;
  transition: background-color 0.2s ease, transform 0.2s ease;
  cursor: pointer;
}

.appearance__reference-action:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.appearance__reference-action:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.appearance__reference-meta {
  flex: 1;
  min-width: 40%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.appearance__reference-focus {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.appearance__reference-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease,
    transform 0.2s ease;
}

.appearance__reference-option:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.28);
}

.appearance__reference-option-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.appearance__reference-option-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease;
}

.appearance__reference-option-indicator::after {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.appearance__reference-option-label {
  font-size: 15px;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.88);
}

.appearance__reference-option.is-active {
  border-color: rgba(255, 47, 146, 0.45);
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 10px 24px rgba(255, 47, 146, 0.2);
}

.appearance__reference-option.is-active
  .appearance__reference-option-indicator {
  border-color: rgba(255, 47, 146, 0.9);
}

.appearance__reference-option.is-active
  .appearance__reference-option-indicator::after {
  opacity: 1;
}

.appearance__reference-tip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.appearance__reference-tip-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  flex-shrink: 0;
}

.appearance__reference-tip-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.appearance__reference-tip-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 0.04em;
}

.appearance__reference-error {
  margin-top: 16px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  color: #ff6b6b;
  font-size: 14px;
  line-height: 1.6;
  letter-spacing: 0.04em;
}

.appearance__reference-upload {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  font-size: 14px;
  letter-spacing: 0.04em;
  transition: border-color 0.2s ease, background-color 0.2s ease,
    transform 0.2s ease;
}

.appearance__reference-upload svg {
  width: 18px;
  height: 18px;
}

.appearance__reference-upload:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.32);
  transform: translateY(-1px);
}

.appearance__reference-upload:focus-visible {
  outline: 2px solid #ff2f92;
  outline-offset: 3px;
}

.appearance__reference-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 26px 18px;
  border-radius: 18px;
  border: 2px dashed rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  text-align: center;
}

.appearance__reference-empty-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.6;
}

.appearance__ai-magician-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.appearance__ai-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.appearance__ai-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.appearance__ai-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.appearance__ai-button svg {
  width: 16px;
  height: 16px;
}

.appearance__ai-usage {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.04em;
}

.appearance__ai-usage--warning {
  color: #ff9966;
  font-weight: 600;
}

.appearance__ai-error {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 12px;
  color: #ff6b6b;
  font-size: 13px;
  line-height: 1.6;
  letter-spacing: 0.02em;
}

.appearance__textarea-wrapper {
  position: relative;
}

.appearance__textarea {
  width: 100%;
  min-height: 140px;
  border-radius: 16px;
  border: none;
  padding: 16px;
  padding-bottom: 40px;
  font-size: 15px;
  line-height: 1.6;
  background: rgba(12, 12, 12, 0.72);
  color: #ffffff;
  resize: vertical;
}

.appearance__textarea::placeholder {
  color: rgba(255, 255, 255, 0.48);
}

.appearance__textarea:focus-visible {
  outline: 2px solid #ff2f92;
  outline-offset: 3px;
}

.appearance__char-count {
  position: absolute;
  bottom: 12px;
  right: 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
  letter-spacing: 0.04em;
}

.appearance__styles-section {
  padding: 24px;
}

.appearance__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.appearance__section-header--compact {
  align-items: center;
}

.appearance__section-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.appearance__section-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 47, 146, 0.12);
  color: #ff68b5;
  box-shadow: 0 12px 24px rgba(255, 47, 146, 0.18);
}

.appearance__section-icon svg {
  width: 24px;
  height: 24px;
}

.appearance__section-icon--rose {
  background: linear-gradient(
    135deg,
    rgba(255, 47, 146, 0.2),
    rgba(255, 90, 188, 0.25)
  );
}

.appearance__section-kicker {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.6);
}

.appearance__section-title h2 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.04em;
}

.appearance__section-note {
  margin: 4px 0 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.72);
}

.appearance__section-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  font-size: 14px;
  letter-spacing: 0.04em;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.appearance__section-action:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.24);
  transform: translateX(2px);
}

.appearance__section-action:focus-visible {
  outline: 2px solid #ff2f92;
  outline-offset: 3px;
}

.appearance__section-action-icon {
  width: 16px;
  height: 16px;
}

.appearance__styles-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 8px 6px;
  margin: 0 -8px;
  scroll-snap-type: x mandatory;
}

.appearance__styles-scroll::-webkit-scrollbar {
  height: 6px;
}

.appearance__styles-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
}

.appearance__style-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  text-align: left;
  scroll-snap-align: center;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  min-width: 8rem;
  gap: 0.5rem;
  padding: 0 0 0.5rem 0;
}

.appearance__style-card:hover {
  transform: translateY(-2px);
}

.appearance__style-card:focus-visible {
  outline: 2px solid #ff2f92;
  outline-offset: 3px;
}

.appearance__style-card img {
  width: 100%;
  object-fit: cover;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
}

.appearance__style-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.appearance__style-name {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0.06em;
}

.appearance__style-meta {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

.appearance__style-card--selected {
  border-color: #ff2f92;
  box-shadow: 0 12px 28px rgba(255, 47, 146, 0.2);
  background: rgba(255, 47, 146, 0.12);
}

.appearance__generate {
  width: 100%;
  padding: 14px 20px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.appearance__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.appearance__generate:not(:disabled):hover {
  transform: translateY(-1px);
}

.appearance__generate:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}

@media (min-width: 768px) {
  .appearance {
    padding: 32px 40px 40px;
  }
}

.appearance__confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.appearance__confirm-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(5, 5, 8, 0.85);
  backdrop-filter: blur(6px);
}

.appearance__confirm-panel {
  position: relative;
  width: min(420px, 100%);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 15, 20, 0.98);
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-shadow: 0 20px 50px rgba(4, 4, 10, 0.7);
}

.appearance__confirm-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}

.appearance__confirm-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #ffffff;
}

.appearance__confirm-header p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.04em;
}

.appearance__confirm-close {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.appearance__confirm-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.appearance__confirm-actions {
  display: flex;
  gap: 12px;
}

.appearance__confirm-action {
  flex: 1;
  border-radius: 999px;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
}

.appearance__confirm-action:hover {
  transform: translateY(-1px);
}

.appearance__confirm-action--ghost {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.appearance__confirm-action--ghost:hover {
  background: rgba(255, 255, 255, 0.15);
}

.appearance__confirm-action--primary {
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(255, 47, 146, 0.3);
}

.appearance__confirm-action--primary:hover {
  box-shadow: 0 6px 16px rgba(255, 47, 146, 0.4);
}

/* 購買提示彈窗樣式 */
.appearance__purchase-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.appearance__purchase-subtitle {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.04em;
}

.appearance__purchase-option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.appearance__purchase-option:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.appearance__purchase-option-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.appearance__purchase-option-content {
  flex: 1;
}

.appearance__purchase-option-content h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.04em;
}

.appearance__purchase-option-content p {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}
</style>
