<template>
  <footer class="chat-input">
    <!-- 輸入欄位 -->
    <div class="chat-input__field">
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        placeholder="輸入訊息..."
        autocomplete="off"
        :disabled="disabled"
        @keydown.enter.prevent="handleSend"
      />

      <!-- 建議回覆按鈕與選單 -->
      <div class="chat-input__suggestion-wrapper">
        <button
          ref="suggestionButtonRef"
          type="button"
          class="chat-input__send chat-input__suggestion"
          :aria-expanded="isSuggestionMenuOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          aria-label="取得建議回覆"
          @click="handleToggleSuggestionMenu"
        >
          <SparklesIcon class="icon" aria-hidden="true" />
        </button>

        <!-- 建議回覆選單 -->
        <div
          v-if="isSuggestionMenuOpen"
          ref="suggestionMenuRef"
          class="chat-suggestion-menu"
          role="menu"
          aria-label="建議回覆"
        >
          <!-- 載入中狀態 -->
          <div
            v-if="isLoadingSuggestions"
            class="chat-suggestion-menu__loading"
          >
            <span class="chat-suggestion-loader" aria-hidden="true">
              <span class="chat-suggestion-loader__dot"></span>
              <span class="chat-suggestion-loader__dot"></span>
              <span class="chat-suggestion-loader__dot"></span>
            </span>
            <p class="chat-suggestion-menu__state">生成建議中…</p>
          </div>

          <!-- 建議列表或錯誤狀態 -->
          <template v-else>
            <p
              v-if="suggestionError"
              class="chat-suggestion-menu__state chat-suggestion-menu__state--error"
            >
              {{ suggestionError }}
            </p>
            <button
              v-for="item in suggestions"
              :key="item"
              type="button"
              class="chat-suggestion-menu__item"
              role="menuitem"
              @click="handleSuggestionClick(item)"
            >
              {{ item }}
            </button>
            <p
              v-if="!suggestions.length && !suggestionError"
              class="chat-suggestion-menu__empty"
            >
              目前沒有建議內容
            </p>
          </template>
        </div>
      </div>
    </div>

    <!-- 發送按鈕 -->
    <button
      type="button"
      class="chat-input__send"
      :class="{ 'is-disabled': !hasContent || disabled }"
      :disabled="!hasContent || disabled"
      aria-label="送出訊息"
      @click="handleSend"
    >
      <PaperAirplaneIcon class="icon" aria-hidden="true" />
    </button>

    <!-- 禮物按鈕 -->
    <button
      type="button"
      class="chat-input__send chat-input__gift"
      :disabled="isSendingGift || isRequestingSelfie || isRequestingVideo"
      aria-label="傳送禮物"
      @click="$emit('gift-click')"
    >
      <GiftIcon class="icon" aria-hidden="true" />
    </button>

    <!-- 拍照/影片選單按鈕 -->
    <div class="chat-input__media-wrapper">
      <button
        ref="mediaButtonRef"
        type="button"
        class="chat-input__send chat-input__media"
        :class="{ 'is-loading': isRequestingSelfie || isRequestingVideo }"
        :disabled="isRequestingSelfie || isSendingGift || isRequestingVideo"
        :aria-expanded="isMediaMenuOpen ? 'true' : 'false'"
        aria-haspopup="menu"
        :aria-label="
          photoRemaining !== null && photoRemaining > 0
            ? `媒體功能 (剩餘 ${photoRemaining} 次)`
            : '媒體功能'
        "
        @click="handleToggleMediaMenu"
      >
        <EllipsisHorizontalIcon class="icon" aria-hidden="true" />
      </button>

      <!-- 媒體選單 -->
      <div
        v-if="isMediaMenuOpen"
        ref="mediaMenuRef"
        class="chat-media-menu"
        role="menu"
        aria-label="媒體選項"
      >
        <button
          type="button"
          class="chat-media-menu__item"
          role="menuitem"
          @click="handleMediaAction('selfie')"
        >
          <CameraIcon class="chat-media-menu__icon" aria-hidden="true" />
          <span>請求自拍照片</span>
        </button>
        <button
          type="button"
          class="chat-media-menu__item"
          role="menuitem"
          @click="handleMediaAction('video')"
        >
          <VideoCameraIcon class="chat-media-menu__icon" aria-hidden="true" />
          <span>生成影片</span>
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import {
  PaperAirplaneIcon,
  GiftIcon,
  SparklesIcon,
  CameraIcon,
  VideoCameraIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/vue/24/outline";

// Props
const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  suggestions: {
    type: Array,
    default: () => [],
  },
  isLoadingSuggestions: {
    type: Boolean,
    default: false,
  },
  suggestionError: {
    type: String,
    default: null,
  },
  isSendingGift: {
    type: Boolean,
    default: false,
  },
  isRequestingSelfie: {
    type: Boolean,
    default: false,
  },
  isRequestingVideo: {
    type: Boolean,
    default: false,
  },
  photoRemaining: {
    type: Number,
    default: null,
  },
});

// Emits
const emit = defineEmits([
  "update:modelValue",
  "send",
  "suggestion-click",
  "request-suggestions",
  "gift-click",
  "selfie-click",
  "video-click",
]);

// Refs
const inputRef = ref(null);
const suggestionButtonRef = ref(null);
const suggestionMenuRef = ref(null);
const isSuggestionMenuOpen = ref(false);
const mediaButtonRef = ref(null);
const mediaMenuRef = ref(null);
const isMediaMenuOpen = ref(false);

// Computed
const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const hasContent = computed(() => {
  return inputValue.value && inputValue.value.trim().length > 0;
});

/**
 * 發送訊息
 */
const handleSend = () => {
  if (!hasContent.value || props.disabled) return;
  emit("send", inputValue.value.trim());
};

/**
 * 切換建議選單
 */
const handleToggleSuggestionMenu = () => {
  isSuggestionMenuOpen.value = !isSuggestionMenuOpen.value;

  // 如果打開選單且沒有建議，請求新建議
  if (
    isSuggestionMenuOpen.value &&
    !props.suggestions.length &&
    !props.isLoadingSuggestions
  ) {
    emit("request-suggestions");
  }
};

/**
 * 選擇建議回覆
 */
const handleSuggestionClick = (suggestion) => {
  emit("suggestion-click", suggestion);
  isSuggestionMenuOpen.value = false;
};

/**
 * 切換媒體選單
 */
const handleToggleMediaMenu = () => {
  isMediaMenuOpen.value = !isMediaMenuOpen.value;
};

/**
 * 選擇媒體操作
 */
const handleMediaAction = (action) => {
  if (action === 'selfie') {
    emit('selfie-click');
  } else if (action === 'video') {
    emit('video-click');
  }
  isMediaMenuOpen.value = false;
};

/**
 * 點擊外部關閉選單
 */
const handleClickOutside = (event) => {
  // 關閉建議選單
  if (isSuggestionMenuOpen.value) {
    const clickedInsideButton = suggestionButtonRef.value?.contains(event.target);
    const clickedInsideMenu = suggestionMenuRef.value?.contains(event.target);

    if (!clickedInsideButton && !clickedInsideMenu) {
      isSuggestionMenuOpen.value = false;
    }
  }

  // 關閉媒體選單
  if (isMediaMenuOpen.value) {
    const clickedInsideMediaButton = mediaButtonRef.value?.contains(event.target);
    const clickedInsideMediaMenu = mediaMenuRef.value?.contains(event.target);

    if (!clickedInsideMediaButton && !clickedInsideMediaMenu) {
      isMediaMenuOpen.value = false;
    }
  }
};

/**
 * 聚焦輸入框（暴露給父組件）
 */
const focus = () => {
  nextTick(() => {
    inputRef.value?.focus();
  });
};

// Lifecycle
onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});

// 暴露方法給父組件
defineExpose({
  focus,
});
</script>

<style scoped lang="scss">
.chat-input {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  gap: 0.6rem;
  padding: 1.5rem;
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.15) 0%,
    rgba(15, 23, 42, 0.85) 100%
  );
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  backdrop-filter: blur(8px);
}

.chat-input__field {
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 0.5rem 0.5rem 0.5rem 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  outline: none;

  &:focus-within {
    outline: none;
    box-shadow: none;
  }

  input {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    background: transparent;
    border: none;
    color: #e2e8f0;
    font-size: 0.95rem;
    letter-spacing: 0.02em;
    outline: none;
    -webkit-appearance: none;
    box-shadow: none;

    &::placeholder {
      color: rgba(226, 232, 240, 0.4);
    }

    &:focus,
    &:focus-visible,
    &:focus-within {
      outline: none;
      box-shadow: none;
    }
  }
}

.chat-input__send {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  color: #fff;
  box-shadow: 0 12px 22px rgba(255, 77, 143, 0.35);
  transition: transform 140ms ease, box-shadow 140ms ease;
  position: relative;

  .icon {
    width: 20px;
    height: 20px;
  }

  &:hover:not(:disabled):not(.is-disabled) {
    transform: translateY(-2px);
    box-shadow: 0 16px 28px rgba(255, 77, 143, 0.45);
  }

  &:disabled,
  &.is-disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
}

.chat-input__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: #fff;
  color: #ff4d8f;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

.chat-input__suggestion-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-input__suggestion {
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  box-shadow: 0 12px 22px rgba(99, 102, 241, 0.35);
  width: 44px;
  height: 44px;

  &:hover:not(:disabled) {
    box-shadow: 0 16px 28px rgba(99, 102, 241, 0.45);
  }
}

.chat-input__gift {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  box-shadow: 0 12px 22px rgba(245, 158, 11, 0.35);

  &:hover:not(:disabled) {
    box-shadow: 0 16px 28px rgba(245, 158, 11, 0.45);
  }
}

.chat-input__media-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

.chat-input__media {
  background: linear-gradient(135deg, #a78bfa, #c084fc);
  box-shadow: 0 12px 22px rgba(167, 139, 250, 0.35);

  &:hover:not(:disabled) {
    box-shadow: 0 16px 28px rgba(167, 139, 250, 0.45);
  }

  &.is-loading {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }
}

/* 建議選單樣式 */
.chat-suggestion-menu {
  position: absolute;
  left: 1rem;
  bottom: 5.5rem;
  width: min(320px, 75vw);
  padding: 0.85rem;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(8px);
  z-index: 1500;
}

.chat-suggestion-menu__state {
  margin: 0;
  border-radius: 12px;
  padding: 0.6rem 0.75rem;
  font-size: 0.86rem;
  letter-spacing: 0.02em;
  color: rgba(226, 232, 240, 0.75);
  background: rgba(51, 65, 85, 0.55);
}

.chat-suggestion-menu__state--error {
  color: rgba(248, 113, 113, 0.85);
  background: rgba(248, 113, 113, 0.18);
}

.chat-suggestion-menu__empty {
  margin: 0;
  border-radius: 12px;
  padding: 0.6rem 0.75rem;
  font-size: 0.86rem;
  letter-spacing: 0.02em;
  color: rgba(226, 232, 240, 0.5);
  background: rgba(51, 65, 85, 0.55);
  text-align: center;
}

.chat-suggestion-menu__loading {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0.75rem;
  border-radius: 12px;
  background: rgba(51, 65, 85, 0.55);

  .chat-suggestion-menu__state {
    background: transparent;
    padding: 0;
    margin: 0;
  }
}

.chat-suggestion-loader {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.chat-suggestion-loader__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.9);
  animation: chat-suggestion-bounce 0.9s infinite ease-in-out;

  &:nth-child(2) {
    animation-delay: 0.12s;
  }

  &:nth-child(3) {
    animation-delay: 0.24s;
  }
}

@keyframes chat-suggestion-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.75;
  }
  40% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

.chat-suggestion-menu__item {
  border: none;
  border-radius: 12px;
  padding: 0.65rem 0.75rem;
  background: rgba(51, 65, 85, 0.75);
  color: #e2e8f0;
  text-align: left;
  font-size: 0.88rem;
  letter-spacing: 0.02em;
  line-height: 1.55;
  cursor: pointer;
  transition: background 140ms ease, transform 140ms ease, box-shadow 140ms ease;

  &:hover {
    background: rgba(59, 130, 246, 0.45);
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.35);
  }

  &:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.65);
    outline-offset: 2px;
  }
}

/* 媒體選單樣式 */
.chat-media-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.75rem);
  min-width: 180px;
  padding: 0.6rem;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(8px);
  z-index: 1500;
}

.chat-media-menu__item {
  border: none;
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  background: rgba(51, 65, 85, 0.75);
  color: #e2e8f0;
  text-align: left;
  font-size: 0.9rem;
  letter-spacing: 0.02em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
  transition: background 140ms ease, transform 140ms ease, box-shadow 140ms ease;

  &:hover {
    background: rgba(167, 139, 250, 0.45);
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.35);
  }

  &:focus-visible {
    outline: 2px solid rgba(167, 139, 250, 0.65);
    outline-offset: 2px;
  }
}

.chat-media-menu__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.chat-media-menu__badge {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: linear-gradient(135deg, #a78bfa, #c084fc);
  color: #fff;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

@media (max-width: 540px) {
  .chat-input {
    padding: 1.25rem;
    gap: 0.55rem;
  }

  .chat-input__send {
    width: 42px;
    height: 42px;

    .icon {
      width: 18px;
      height: 18px;
    }
  }

  .chat-input__suggestion {
    width: 40px;
    height: 40px;
  }

  .chat-suggestion-menu {
    left: 0.75rem;
    bottom: 5rem;
    width: min(300px, 80vw);
  }
}
</style>
