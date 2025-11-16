<script setup lang="ts">
import { useGlobalLoading } from '../composables/useGlobalLoading.js'

const { isGlobalLoading } = useGlobalLoading()
</script>

<template>
  <transition name="global-loader">
    <div v-if="isGlobalLoading" class="loading-overlay" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p>連線中，請稍候…</p>
    </div>
  </transition>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(12px);
  z-index: 999;
  color: #f8fafc;
  text-align: center;
  pointer-events: all;
}

.spinner {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 4px solid rgba(248, 250, 252, 0.35);
  border-top-color: #ff4d8f;
  animation: spin 0.9s linear infinite;
  margin-bottom: 1rem;
}

p {
  font-size: 1rem;
  letter-spacing: 0.08em;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.global-loader-enter-active,
.global-loader-leave-active {
  transition: opacity 0.18s ease;
}

.global-loader-enter-from,
.global-loader-leave-to {
  opacity: 0;
}
</style>
