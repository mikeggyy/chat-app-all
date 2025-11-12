<script setup>
import { ref } from "vue";
import { PhotoIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  referencePreview: {
    type: String,
    default: "",
  },
  referenceName: {
    type: String,
    default: "",
  },
  referenceFocus: {
    type: String,
    default: "face",
  },
  referenceFocusOptions: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits([
  "trigger-upload",
  "clear-reference",
  "reopen-cropper",
  "update:referenceFocus",
]);

const referenceInput = ref(null);

const handleTrigger = () => {
  emit("trigger-upload");
};

const handleClear = () => {
  emit("clear-reference");
};

const handleReopenCropper = () => {
  emit("reopen-cropper");
};

const handleFocusChange = (value) => {
  emit("update:referenceFocus", value);
};
</script>

<template>
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
        @click="handleClear"
      >
        清空圖片
      </button>
    </header>

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
            @click="handleTrigger"
          >
            重新選擇圖片
          </button>
          <button
            type="button"
            class="appearance__reference-action"
            @click="handleReopenCropper"
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
              :checked="referenceFocus === option.value"
              @change="handleFocusChange(option.value)"
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
        @click="handleTrigger"
      >
        <PhotoIcon aria-hidden="true" />
        <span>上傳/拍攝一張圖片進行參考</span>
      </button>
      <p class="appearance__reference-empty-hint">
        支援常見圖片格式，建議使用 2:3 比例的人像或場景照。
      </p>
    </div>
  </section>
</template>

<style scoped>
.appearance__card {
  background: var(--bg-card);
  border-radius: var(--radius-2xl);
  padding: 18px;
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.appearance__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
}

.appearance__card-titles {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.appearance__card-titles h2 {
  font-size: 18px;
  font-weight: 600;
}

.appearance__card-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.appearance__reference-clear-link {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary-lighter);
  font-size: 14px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: color var(--transition-fast);
}

.appearance__reference-clear-link:hover {
  color: var(--color-primary-lightest);
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
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--bg-overlay);
  border: 1px solid var(--border-medium);
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
  padding: 10px var(--spacing-lg);
  border-radius: var(--radius-full);
  border: none;
  background: var(--bg-overlay-medium);
  color: var(--text-primary);
  font-size: 13px;
  letter-spacing: 0.04em;
  transition: background-color var(--transition-fast),
    transform var(--transition-fast);
  cursor: pointer;
}

.appearance__reference-action:hover {
  background: var(--bg-overlay-strong);
  transform: translateY(-1px);
}

.appearance__reference-action:focus-visible {
  outline: 2px solid var(--color-white);
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
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--bg-overlay-option);
  border: 1px solid var(--bg-overlay-medium);
  cursor: pointer;
  transition: border-color var(--transition-fast),
    background-color var(--transition-fast), transform var(--transition-fast);
}

.appearance__reference-option:hover {
  transform: translateY(-1px);
  border-color: var(--border-hover);
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
  border: 2px solid var(--border-highlight);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--transition-fast);
}

.appearance__reference-option-indicator::after {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff4d8f, var(--color-primary-lighter));
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.appearance__reference-option-label {
  font-size: 15px;
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.appearance__reference-option.is-active {
  border-color: var(--color-primary-border-active);
  background: var(--bg-overlay-medium);
  box-shadow: var(--color-primary-shadow-light);
}

.appearance__reference-option.is-active
  .appearance__reference-option-indicator {
  border-color: var(--color-primary-border-strong);
}

.appearance__reference-option.is-active
  .appearance__reference-option-indicator::after {
  opacity: 1;
}

.appearance__reference-tip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--bg-overlay-option);
  border: 1px solid var(--bg-overlay-medium);
}

.appearance__reference-tip-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-overlay-hover-strong);
  border: 1px solid var(--border-medium);
  flex-shrink: 0;
}

.appearance__reference-tip-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.appearance__reference-tip-text {
  font-size: 14px;
  color: var(--text-soft);
  letter-spacing: 0.04em;
}

.appearance__reference-upload {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: var(--spacing-md) 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
  background: var(--bg-overlay-option);
  color: var(--color-white);
  font-size: 14px;
  letter-spacing: 0.04em;
  transition: border-color var(--transition-fast),
    background-color var(--transition-fast), transform var(--transition-fast);
  cursor: pointer;
}

.appearance__reference-upload svg {
  width: 18px;
  height: 18px;
}

.appearance__reference-upload:hover {
  background: var(--bg-overlay-medium);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.appearance__reference-upload:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.appearance__reference-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  padding: 26px 18px;
  border-radius: var(--radius-xl);
  border: 2px dashed var(--border-medium);
  background: var(--bg-overlay-light);
  text-align: center;
}

.appearance__reference-empty-hint {
  font-size: 13px;
  color: var(--text-hint);
  line-height: 1.6;
}
</style>
