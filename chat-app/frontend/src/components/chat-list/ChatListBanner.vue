<template>
  <p
    v-if="message.text"
    :class="[
      'chat-list-banner',
      {
        'is-error': message.tone === 'error',
        'is-success': message.tone === 'success',
      },
    ]"
    :role="message.tone === 'error' ? 'alert' : 'status'"
    :aria-live="message.tone === 'error' ? 'assertive' : 'polite'"
  >
    {{ message.text }}
  </p>
</template>

<script setup lang="ts">
// Types
interface Message {
  text: string;
  tone?: 'info' | 'error' | 'success';
}

interface Props {
  message: Message;
}

defineProps<Props>();
</script>

<style scoped>
.chat-list-banner {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  padding: 0.875rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  text-align: center;
  background: rgba(30, 41, 59, 0.95);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 12px;
  margin: 0;
  min-width: 200px;
  max-width: 90%;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
              0 0 0 1px rgba(255, 255, 255, 0.05);
  animation: slideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.chat-list-banner.is-error {
  background: rgba(30, 41, 59, 0.95);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  box-shadow: 0 8px 32px rgba(239, 68, 68, 0.3),
              0 0 0 1px rgba(255, 255, 255, 0.05);
}

.chat-list-banner.is-success {
  background: rgba(30, 41, 59, 0.95);
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.3);
  box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3),
              0 0 0 1px rgba(255, 255, 255, 0.05);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
</style>
