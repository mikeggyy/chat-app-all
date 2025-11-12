<script setup>
defineProps({
  isPrimaryDisabled: {
    type: Boolean,
    default: false,
  },
  primaryLabel: {
    type: String,
    default: "完成",
  },
});

const emit = defineEmits(["primary"]);

const handlePrimary = () => {
  emit("primary");
};
</script>

<template>
  <footer class="voice__actions">
    <button
      type="button"
      class="voice__button voice__button--primary"
      :disabled="isPrimaryDisabled"
      @click="handlePrimary"
    >
      {{ primaryLabel }}
    </button>
  </footer>
</template>

<style scoped>
.voice__actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.voice__button {
  flex: 1;
  padding: 12px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 15px;
  border: none;
  cursor: pointer;
}

.voice__button--primary {
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  color: #ffffff;
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.voice__button--primary:not(:disabled):hover {
  transform: translateY(-1px);
}

.voice__button:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
