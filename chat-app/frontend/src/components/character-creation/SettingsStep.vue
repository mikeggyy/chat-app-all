<script setup lang="ts">
import { computed } from "vue";
import AIMagicianButton from "./AIMagicianButton.vue";
import { useCharacterCreationStore } from "@/stores/characterCreation";

// Types
interface PersonaForm {
  name: string;
  tagline: string;
  hiddenProfile: string;
  prompt: string;
  [key: string]: any;
}

interface Props {
  selectedResultImage?: string;
  selectedResultAlt?: string;
  personaForm: PersonaForm;
  nameLength: number;
  taglineLength: number;
  hiddenProfileLength: number;
  promptLength: number;
  maxNameLength: number;
  maxTaglineLength: number;
  maxHiddenProfileLength: number;
  maxPromptLength: number;
}

interface Emits {
  (e: "open-ai-magician"): void;
  (e: "update:name", value: string): void;
  (e: "update:tagline", value: string): void;
  (e: "update:hiddenProfile", value: string): void;
  (e: "update:prompt", value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  selectedResultImage: "",
  selectedResultAlt: "生成角色預覽",
});

const emit = defineEmits<Emits>();

// 使用 store
const store = useCharacterCreationStore();
const AI_MAGICIAN_LIMIT = 3;

const handleAIMagician = (): void => {
  emit("open-ai-magician");
};

const handleNameInput = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  emit("update:name", target.value);
};

const handleTaglineInput = (event: Event): void => {
  const target = event.target as HTMLTextAreaElement;
  emit("update:tagline", target.value);
};

const handleHiddenProfileInput = (event: Event): void => {
  const target = event.target as HTMLTextAreaElement;
  emit("update:hiddenProfile", target.value);
};

const handlePromptInput = (event: Event): void => {
  const target = event.target as HTMLTextAreaElement;
  emit("update:prompt", target.value);
};
</script>

<template>
  <main class="generating__settings" aria-live="polite" aria-label="角色設定">
    <section class="generating__settings-hero">
      <div class="generating__settings-portrait">
        <img
          v-if="selectedResultImage"
          :src="selectedResultImage"
          :alt="selectedResultAlt"
        />
        <div v-else class="generating__settings-portrait-empty">預覽載入中</div>
      </div>
    </section>

    <section class="generating__settings-card">
      <div class="generating__field">
        <div class="generating__field-header">
          <label class="generating__field-label" for="generating-name">
            角色名
          </label>
          <AIMagicianButton
            :is-generating="store.isAIMagicianLoading"
            :remaining-usage="store.aiMagicianRemainingUsage"
            :total-usage="AI_MAGICIAN_LIMIT"
            @click="handleAIMagician"
          />
        </div>
        <input
          id="generating-name"
          :value="personaForm.name"
          @input="handleNameInput"
          type="text"
          class="generating__input"
          :maxlength="maxNameLength"
          placeholder="請輸入角色名，例如：星野未來"
          required
          aria-required="true"
        />
        <div class="generating__field-meta">
          <span>{{ nameLength }} / {{ maxNameLength }}</span>
        </div>
        <div
          v-if="store.error"
          class="generating__field-error"
          role="alert"
        >
          {{ store.error }}
        </div>
      </div>
      <div class="generating__field">
        <label class="generating__field-label" for="generating-tagline">
          角色設定
        </label>
        <textarea
          id="generating-tagline"
          :value="personaForm.tagline"
          @input="handleTaglineInput"
          class="generating__textarea"
          :maxlength="maxTaglineLength"
          rows="4"
          placeholder="輸入角色設定，將對外展示"
          required
          aria-required="true"
        ></textarea>
        <div class="generating__field-meta generating__field-meta--end">
          <span>{{ taglineLength }} / {{ maxTaglineLength }}</span>
        </div>
      </div>
      <div class="generating__field">
        <label class="generating__field-label" for="generating-hidden">
          隱藏設定
        </label>
        <textarea
          id="generating-hidden"
          :value="personaForm.hiddenProfile"
          @input="handleHiddenProfileInput"
          class="generating__textarea"
          :maxlength="maxHiddenProfileLength"
          rows="4"
          placeholder="輸入隱藏設定，僅內部查看，不對外展示"
          required
          aria-required="true"
        ></textarea>
        <div class="generating__field-meta generating__field-meta--end">
          <span>{{ hiddenProfileLength }} / {{ maxHiddenProfileLength }}</span>
        </div>
      </div>
      <div class="generating__field">
        <label class="generating__field-label" for="generating-prompt">
          開場白
        </label>
        <textarea
          id="generating-prompt"
          :value="personaForm.prompt"
          @input="handlePromptInput"
          class="generating__textarea"
          :maxlength="maxPromptLength"
          rows="5"
          placeholder="輸入開場白，會成為角色對用戶說的第一句話"
          required
          aria-required="true"
        ></textarea>
        <div class="generating__field-meta generating__field-meta--end">
          <span>{{ promptLength }} / {{ maxPromptLength }}</span>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.generating__settings {
  /* CSS 變數定義 - 與 appearance 頁面保持一致 */
  --gradient-primary: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  --color-white: #ffffff;
  --text-tertiary: rgba(255, 255, 255, 0.5);
  --color-warning: #ffa500;
  --radius-full: 999px;
  --transition-fast: 0.2s ease;
  --focus-border-color: rgba(255, 119, 195, 0.95);
  --focus-shadow: 0 0 0 3px rgba(255, 119, 195, 0.24);

  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 12px;
  overflow-y: auto;
  flex: 1;
  max-height: calc(100dvh - 150px);
}

.generating__settings-hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  height: 11rem;
  width: 8rem;
  margin: auto;
}

.generating__settings-portrait {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
}

.generating__settings-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.generating__settings-portrait-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.08em;
}

.generating__settings-card {
  border-radius: 22px;
  padding: 20px 18px;
  background: rgba(14, 14, 20, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.04);
  box-shadow: 0 14px 40px rgba(6, 6, 12, 0.42);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.generating__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.generating__field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.generating__field-label {
  font-size: 14px;
  letter-spacing: 0.07em;
  color: rgba(255, 255, 255, 0.78);
}

.generating__field-error {
  font-size: 13px;
  color: #ff6b6b;
  padding: 6px 12px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 107, 107, 0.2);
}

.generating__input:focus-visible,
.generating__textarea:focus-visible {
  border-color: var(--focus-border-color);
  outline: none;
  box-shadow: var(--focus-shadow);
}

.generating__input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(14, 14, 22, 0.9);
  color: #ffffff;
  font-size: 16px;
  letter-spacing: 0.04em;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.generating__field-meta {
  display: flex;
  justify-content: flex-end;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.48);
}

.generating__field-meta--end {
  margin-top: -6px;
}

.generating__textarea {
  width: 100%;
  resize: vertical;
  min-height: 140px;
  border-radius: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 12, 18, 0.9);
  color: #ffffff;
  font-size: 15px;
  line-height: 1.6;
  letter-spacing: 0.05em;
}

@media (min-width: 768px) {
  .generating__settings {
    gap: 28px;
  }

  .generating__settings-hero {
    flex-direction: row;
    align-items: stretch;
  }

  .generating__settings-portrait {
    flex: 1 1 48%;
    min-height: 260px;
  }
}
</style>
