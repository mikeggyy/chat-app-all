<script setup>
defineProps({
  confirmButtonLabel: {
    type: String,
    default: "確認",
  },
  isConfirmDisabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["confirm"]);

const handleConfirm = () => {
  emit("confirm");
};
</script>

<template>
  <footer class="generating__footer">
    <button
      type="button"
      class="generating__confirm"
      :disabled="isConfirmDisabled"
      :aria-disabled="isConfirmDisabled"
      @click="handleConfirm"
    >
      {{ confirmButtonLabel }}
    </button>
  </footer>
</template>

<style scoped>
:root {
  --gradient-primary: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
}

.generating__footer {
  display: flex;
  justify-content: center;
  padding-top: 5vw;
}

.generating__confirm {
  width: min(420px, 100%);
  padding: 14px 20px;
  border: none;
  border-radius: 999px;
  background: var(--gradient-primary);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.generating__confirm:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.generating__confirm:not(:disabled):hover {
  transform: translateY(-1px);
}

.generating__confirm:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}
</style>
