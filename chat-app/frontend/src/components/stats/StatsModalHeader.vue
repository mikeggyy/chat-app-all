<template>
  <header class="modal-header">
    <div class="modal-title-section">
      <BoltIcon class="title-icon" aria-hidden="true" />
      <h2 id="stats-modal-title" class="modal-title">我的資產</h2>
    </div>
    <button
      type="button"
      class="close-button"
      aria-label="關閉"
      @click="$emit('close')"
    >
      <XMarkIcon class="icon" aria-hidden="true" />
    </button>
  </header>
</template>

<script setup>
import { XMarkIcon, BoltIcon } from '@heroicons/vue/24/outline';

defineEmits(['close']);
</script>

<style scoped>
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.modal-title-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-icon {
  width: 28px;
  height: 28px;
  color: #fbbf24;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #f8f9ff;
}

.close-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 17, 28, 0.5);
  color: rgba(226, 232, 240, 0.85);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms ease, border-color 150ms ease;
  flex-shrink: 0;
}

.close-button:hover {
  background: rgba(148, 163, 184, 0.2);
  border-color: rgba(148, 163, 184, 0.45);
}

.close-button .icon {
  width: 20px;
  height: 20px;
}
</style>
