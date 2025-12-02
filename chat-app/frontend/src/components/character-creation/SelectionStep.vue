<script setup lang="ts">
import { logger } from '../../utils/logger.js';

// Types
interface GeneratedResult {
  id: string;
  image: string;
  alt?: string;
  label?: string;
  [key: string]: any;
}

interface Props {
  selectedResultImage?: string;
  selectedResultAlt?: string;
  generatedResults?: GeneratedResult[];
  selectedResultId?: string;
  isSelectionStep?: boolean;
}

interface Emits {
  (e: "select", resultId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  selectedResultImage: "",
  selectedResultAlt: "生成角色預覽",
  generatedResults: () => [],
  selectedResultId: "",
  isSelectionStep: false,
});

const emit = defineEmits<Emits>();

const isResultSelected = (resultId: string): boolean => {
  const selected = resultId === props.selectedResultId;
  logger.log('[SelectionStep] isResultSelected:', {
    resultId,
    selectedResultId: props.selectedResultId,
    selected
  });
  return selected;
};

const handleResultSelect = (resultId: string): void => {
  emit("select", resultId);
};
</script>

<template>
  <main
    class="generating__body generating__body--complete"
    aria-live="polite"
  >
    <section class="generating__hero" aria-label="生成角色預覽">
      <div class="generating__hero-frame">
        <img
          v-if="selectedResultImage"
          :src="selectedResultImage"
          :alt="selectedResultAlt"
          class="generating__hero-image"
        />
        <div v-else class="generating__hero-empty" aria-hidden="true"></div>
      </div>
    </section>

    <section class="generating__results" aria-label="生成角色風格選擇">
      <div
        class="generating__result-scroll"
        role="listbox"
        aria-label="生成角色風格"
      >
        <button
          v-for="result in generatedResults"
          :key="result.id"
          type="button"
          class="generating__result-button"
          :class="{
            'generating__result-button--selected': isResultSelected(
              result.id
            ),
          }"
          role="option"
          :aria-selected="isResultSelected(result.id)"
          :tabindex="isSelectionStep ? 0 : -1"
          :disabled="!isSelectionStep"
          @click="handleResultSelect(result.id)"
        >
          <img
            :src="result.image"
            :alt="result.alt || result.label"
            class="generating__result-image"
          />
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.generating__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  flex: 1;
  max-height: calc(100dvh - 200px);
}

.generating__body--complete {
  justify-content: flex-end;
  padding: 0;
}

.generating__hero {
  width: 100%;
  margin: 0 auto;
  overflow: hidden;
  position: absolute;
  top: 0;
  bottom: 200px; /* 🔥 為底部縮略圖和按鈕預留空間 */
}

.generating__hero-frame {
  position: relative;
  width: 100%;
  height: 100%;
}

.generating__hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.generating__hero-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  letter-spacing: 0.08em;
}

.generating__results {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0 16px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%);
  position: relative;
  z-index: 10;
}

.generating__result-scroll {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  margin: 0;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  width: 17rem;
  margin-left: 7rem;
}

.generating__result-button {
  border: 2px solid transparent;
  border-radius: 18px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.08);
  transition: border-color 0.2s ease, transform 0.2s ease,
    background-color 0.2s ease;
  scroll-snap-align: center;
  flex: none;
  min-width: 92px;
}

.generating__result-button:focus-visible {
  outline: none;
  border-color: #ff5abc;
}

.generating__result-button--selected {
  border-color: #ff5abc;
  background: rgba(255, 90, 188, 0.18);
}

.generating__result-button:disabled {
  cursor: default;
  opacity: 0.7;
}

.generating__result-image {
  display: block;
  width: 88px;
  height: 120px;
  object-fit: cover;
  border-radius: 14px;
}

.generating__result-scroll::-webkit-scrollbar {
  height: 6px;
}

.generating__result-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
}

@media (min-width: 640px) {
  .generating__body--complete {
    gap: 36px;
  }

  .generating__result-image {
    width: 96px;
    height: 132px;
  }

  .generating__result-button {
    min-width: 100px;
  }
}
</style>
