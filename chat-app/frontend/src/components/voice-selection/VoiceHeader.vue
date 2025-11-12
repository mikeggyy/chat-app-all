<script setup>
import { ArrowLeftIcon } from "@heroicons/vue/24/outline";

defineProps({
  title: {
    type: String,
    default: "語音設定",
  },
  subtitle: {
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
  <header class="voice__header">
    <button
      type="button"
      class="voice__back"
      aria-label="返回上一頁"
      @click="handleBack"
    >
      <ArrowLeftIcon class="voice__back-icon" aria-hidden="true" />
    </button>
    <div>
      <h1 class="voice__title">{{ title }}</h1>
      <p v-if="subtitle" class="voice__subtitle">{{ subtitle }}</p>
    </div>
  </header>
</template>

<style scoped>
.voice__header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.voice__back {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.voice__back-icon {
  width: 18px;
  height: 18px;
}

.voice__title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.voice__subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}
</style>
