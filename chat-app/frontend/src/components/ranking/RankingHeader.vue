<script setup lang="ts">
// Types

import { ArrowLeftIcon, QuestionMarkCircleIcon } from "@heroicons/vue/24/outline";

defineProps({
  title: {
    type: String,
    default: "熱門列表",
  },
  updateLine: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["back", "help"]);

const handleBack = () => {
  emit("back");
};

const handleHelp = () => {
  emit("help");
};
</script>

<template>
  <header class="top-bar">
    <button class="back-button" type="button" @click="handleBack">
      <ArrowLeftIcon aria-hidden="true" />
    </button>
    <div class="top-title">
      <p class="headline">{{ title }}</p>
      <p v-if="updateLine" class="update-line">- {{ updateLine }} -</p>
    </div>
    <button class="help-button" type="button" aria-label="排行榜說明" @click="handleHelp">
      <QuestionMarkCircleIcon aria-hidden="true" />
    </button>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  gap: clamp(0.8rem, 3vw, 1.2rem);
}

.back-button,
.help-button {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  color: var(--text-primary);
  transition: background 0.2s ease, transform 0.2s ease;
}

.back-button:hover,
.back-button:focus-visible,
.help-button:hover,
.help-button:focus-visible {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.05);
  outline: none;
}

.back-button svg,
.help-button svg {
  width: 22px;
  height: 22px;
}

.top-title {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.headline {
  font-size: clamp(1.35rem, 5vw, 1.65rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  text-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
}

.update-line {
  font-size: 0.7rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.02em;
}

@media (max-width: 720px) {
  .headline {
    font-size: clamp(1.28rem, 6vw, 1.55rem);
  }
}

@media (max-width: 520px) {
  .top-bar {
    gap: 0.6rem;
  }
}
</style>
