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

<script setup>
defineProps({
  message: {
    type: Object,
    required: true,
    validator: (value) => {
      return (
        typeof value.text === 'string' &&
        (!value.tone || ['info', 'error', 'success'].includes(value.tone))
      );
    },
  },
});
</script>

<style scoped>
.chat-list-banner {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  text-align: center;
  background: var(--info-bg, #dbeafe);
  color: var(--info-text, #1e40af);
  border-bottom: 1px solid var(--info-border, #93c5fd);
  margin: 0;
  animation: slideDown 0.3s ease-out;
}

.chat-list-banner.is-error {
  background: var(--error-bg, #fee2e2);
  color: var(--error-text, #991b1b);
  border-bottom-color: var(--error-border, #fca5a5);
}

.chat-list-banner.is-success {
  background: var(--success-bg, #d1fae5);
  color: var(--success-text, #065f46);
  border-bottom-color: var(--success-border, #6ee7b7);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
