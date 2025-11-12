<script setup>
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/vue/24/outline";

defineProps({
  currentStep: {
    type: String,
    required: true,
  },
  settingsStepValue: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["back"]);

const handleBack = () => {
  emit("back");
};
</script>

<template>
  <header class="generating__header">
    <button
      type="button"
      class="generating__back"
      :class="{ 'generating__back--close': currentStep !== settingsStepValue }"
      :aria-label="
        currentStep === settingsStepValue ? '返回上一個步驟' : '取消角色創建'
      "
      @click="handleBack"
    >
      <XMarkIcon
        v-if="currentStep !== settingsStepValue"
        class="generating__back-icon"
        aria-hidden="true"
      />
      <ArrowLeftIcon
        v-else
        class="generating__back-icon"
        aria-hidden="true"
      />
    </button>
    <div v-if="title" class="generating__step-title">
      {{ title }}
    </div>
  </header>
</template>

<style scoped>
.generating__header {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.generating__step-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.78);
}

.generating__back {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.generating__back:hover {
  border-color: rgba(255, 255, 255, 0.36);
  background-color: rgba(255, 255, 255, 0.08);
}

.generating__back-icon {
  width: 18px;
  height: 18px;
}
</style>
