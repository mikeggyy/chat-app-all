<script setup>
import { computed } from "vue";
import AIMagicianButton from "./AIMagicianButton.vue";

const props = defineProps({
  description: {
    type: String,
    required: true,
  },
  maxLength: {
    type: Number,
    default: 60,
  },
  isGenerating: {
    type: Boolean,
    default: false,
  },
  aiMagicianUsage: {
    type: Object,
    required: true,
  },
  errorMessage: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:description", "ai-magician"]);

const charCount = computed(() => props.description.length);

const handleInput = (event) => {
  emit("update:description", event.target.value);
};

const handleAIMagician = () => {
  emit("ai-magician");
};
</script>

<template>
  <section class="appearance__card" aria-labelledby="appearance-desc-label">
    <header class="appearance__card-header">
      <div class="appearance__card-titles">
        <h2 id="appearance-desc-label">形象描述</h2>
      </div>
      <AIMagicianButton
        :is-generating="isGenerating"
        :remaining-usage="aiMagicianUsage.remaining"
        :total-usage="aiMagicianUsage.total"
        @click="handleAIMagician"
      />
    </header>

    <!-- 錯誤訊息顯示 -->
    <div v-if="errorMessage" class="appearance__ai-error">
      {{ errorMessage }}
    </div>

    <div class="appearance__textarea-wrapper">
      <textarea
        :value="description"
        class="appearance__textarea"
        rows="5"
        :maxlength="maxLength"
        placeholder="描述角色的長相動作、髮型服飾、環境場景等"
        @input="handleInput"
      ></textarea>
      <div class="appearance__char-count">
        {{ charCount }}/{{ maxLength }}
      </div>
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

.appearance__ai-error {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  border-radius: var(--radius-sm);
  color: var(--color-error);
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
  border-radius: var(--radius-lg);
  border: none;
  padding: var(--spacing-lg);
  padding-bottom: 40px;
  font-size: 15px;
  line-height: 1.6;
  background: var(--bg-input);
  color: var(--color-white);
  resize: vertical;
}

.appearance__textarea::placeholder {
  color: var(--text-placeholder);
}

.appearance__textarea:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.appearance__char-count {
  position: absolute;
  bottom: var(--spacing-md);
  right: var(--spacing-lg);
  font-size: 13px;
  color: var(--text-dim);
  pointer-events: none;
  letter-spacing: 0.04em;
}
</style>
