<script setup lang="ts">
import { PROFILE_LIMITS, GENDER_OPTIONS, generateAgeOptions } from "../../config/profile";
import { computed, type Ref } from "vue";

interface ProfileForm {
  displayName: string;
  gender: string;
  age: number | null;
  defaultPrompt: string;
}

interface FormErrors {
  displayName?: string;
  age?: string;
  defaultPrompt?: string;
}

interface Props {
  isOpen?: boolean;
  isSaving?: boolean;
  error?: string;
  form: ProfileForm;
  formErrors: FormErrors;
  displayNameLength?: number;
  promptLength?: number;
  isFormDirty?: boolean;
  inputRef?: unknown;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  isSaving: false,
  error: "",
  displayNameLength: 0,
  promptLength: 0,
  isFormDirty: false,
  inputRef: null,
});

const emit = defineEmits<{
  close: [];
  submit: [];
  "overlay-click": [];
}>();

const ageOptions = computed(() => generateAgeOptions());

const handleOverlayClick = () => {
  if (props.isSaving) return;
  emit("overlay-click");
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="profile-editor-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-editor-title"
      @click.self="handleOverlayClick"
    >
      <div class="profile-editor-dialog">
        <header class="profile-editor-header">
          <div class="profile-editor-header__text">
            <h2 id="profile-editor-title">編輯個人資料</h2>
            <p class="profile-editor-subtitle">
              更新名稱、性別、年齡與角色設定，展現你的個人風格
            </p>
          </div>
          <button
            type="button"
            class="profile-editor-close"
            aria-label="關閉"
            :disabled="isSaving"
            @click="emit('close')"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form class="profile-editor-form" @submit.prevent="emit('submit')">
          <!-- 名稱欄位 -->
          <div class="profile-editor-field">
            <label class="profile-editor-label" for="profile-editor-name">
              名稱
            </label>
            <input
              id="profile-editor-name"
              :ref="inputRef"
              v-model="form.displayName"
              type="text"
              :maxlength="PROFILE_LIMITS.MAX_NAME_LENGTH"
              class="profile-editor-input"
              :disabled="isSaving"
            />
            <div class="profile-editor-meta">
              <span>{{ displayNameLength }} / {{ PROFILE_LIMITS.MAX_NAME_LENGTH }}</span>
            </div>
            <p
              v-if="formErrors.displayName"
              class="profile-editor-error"
              role="alert"
            >
              {{ formErrors.displayName }}
            </p>
          </div>

          <!-- 性別欄位 -->
          <div class="profile-editor-field">
            <label class="profile-editor-label" for="profile-editor-gender">
              性別
            </label>
            <select
              id="profile-editor-gender"
              v-model="form.gender"
              class="profile-editor-select"
              :disabled="isSaving"
            >
              <option
                v-for="option in GENDER_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <!-- 年齡欄位 -->
          <div class="profile-editor-field">
            <label class="profile-editor-label" for="profile-editor-age">
              年齡
            </label>
            <select
              id="profile-editor-age"
              v-model.number="form.age"
              class="profile-editor-select"
              :disabled="isSaving"
            >
              <option :value="null">請選擇年齡</option>
              <option v-for="age in ageOptions" :key="age" :value="age">
                {{ age }} 歲
              </option>
            </select>
            <p
              v-if="formErrors.age"
              class="profile-editor-error"
              role="alert"
            >
              {{ formErrors.age }}
            </p>
          </div>

          <!-- 角色設定欄位 -->
          <div class="profile-editor-field">
            <label class="profile-editor-label" for="profile-editor-prompt">
              角色設定
            </label>
            <textarea
              id="profile-editor-prompt"
              v-model="form.defaultPrompt"
              :maxlength="PROFILE_LIMITS.MAX_PROMPT_LENGTH"
              class="profile-editor-textarea"
              rows="4"
              :disabled="isSaving"
            ></textarea>
            <div class="profile-editor-meta profile-editor-meta--counter">
              <span>{{ promptLength }} / {{ PROFILE_LIMITS.MAX_PROMPT_LENGTH }}</span>
            </div>
            <p
              v-if="formErrors.defaultPrompt"
              class="profile-editor-error"
              role="alert"
            >
              {{ formErrors.defaultPrompt }}
            </p>
          </div>

          <!-- 全局錯誤 -->
          <p
            v-if="error"
            class="profile-editor-error profile-editor-error--global"
            role="alert"
          >
            {{ error }}
          </p>

          <!-- 操作按鈕 -->
          <footer class="profile-editor-actions">
            <button
              type="button"
              class="btn-unified btn-cancel"
              @click="emit('close')"
              :disabled="isSaving"
            >
              取消
            </button>
            <button
              type="submit"
              class="btn-unified btn-confirm"
              :disabled="isSaving || !isFormDirty"
            >
              {{ isSaving ? "儲存中…" : "儲存變更" }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.profile-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  animation: editor-fade-in 0.2s ease-out;
}

@keyframes editor-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes editor-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.profile-editor-dialog {
  width: min(500px, 90vw);
  max-height: 85vh;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: linear-gradient(
    165deg,
    rgba(30, 33, 48, 0.98),
    rgba(22, 25, 36, 0.98)
  );
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
  animation: editor-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.profile-editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.profile-editor-header__text h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f8fafc;
  line-height: 1.3;
}

.profile-editor-header__text {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.profile-editor-subtitle {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  letter-spacing: 0.01em;
  color: rgba(203, 213, 225, 0.85);
}

.profile-editor-close {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(30, 33, 48, 0.8);
  color: #8b92b0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgba(51, 65, 85, 0.9);
    border-color: rgba(148, 163, 184, 0.5);
    color: #f8f9ff;
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.profile-editor-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-editor-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-editor-label {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #e2e8f0;
}

.profile-editor-input,
.profile-editor-select,
.profile-editor-textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 20, 32, 0.9);
  color: #f8fafc;
  font-size: 0.95rem;
  letter-spacing: 0.01em;
  padding: 0.75rem 1rem;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &::placeholder {
    color: rgba(148, 163, 184, 0.5);
    opacity: 1;
  }

  &:hover:not(:disabled) {
    border-color: rgba(148, 163, 184, 0.4);
  }

  &:focus {
    outline: none;
    border-color: rgba(102, 126, 234, 0.6);
    background: rgba(17, 20, 32, 0.95);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.profile-editor-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23e2e8f0' d='M6 8.5L2 4.5h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  padding-right: 2.75rem;
  cursor: pointer;

  &:focus {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23e2e8f0' d='M6 8.5L2 4.5h8z'/%3E%3C/svg%3E");
  }
}

.profile-editor-select option {
  background: #1a1d2e;
  color: #f8fafc;
  padding: 0.75rem;
}

.profile-editor-textarea {
  min-height: 110px;
  resize: vertical;
  line-height: 1.6;
  font-family: inherit;
}

.profile-editor-meta {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: rgba(148, 163, 184, 0.7);
}

.profile-editor-meta--counter {
  align-self: flex-end;
}

.profile-editor-error {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: #fca5a5;
}

.profile-editor-error--global {
  padding: 0.875rem 1rem;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  line-height: 1.5;
}

.profile-editor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.875rem;
  padding-top: 0.5rem;
  margin-top: 0.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

@media (max-width: 640px) {
  .profile-editor-dialog {
    width: min(500px, 95vw);
    max-height: 90vh;
    padding: 1.5rem 1.25rem;
  }

  .profile-editor-header {
    padding-bottom: 0.875rem;
  }

  .profile-editor-header__text h2 {
    font-size: 1.35rem;
  }

  .profile-editor-subtitle {
    font-size: 0.85rem;
  }

  .profile-editor-close {
    width: 32px;
    height: 32px;
    font-size: 1.35rem;
  }

  .profile-editor-form {
    gap: 1rem;
  }

  .profile-editor-field {
    gap: 0.4rem;
  }

  .profile-editor-label {
    font-size: 0.825rem;
  }

  .profile-editor-input,
  .profile-editor-select,
  .profile-editor-textarea {
    padding: 0.65rem 0.875rem;
    font-size: 0.9rem;
  }

  .profile-editor-textarea {
    min-height: 100px;
  }

  .profile-editor-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
}
</style>
