<template>
  <header class="chat-list-header">
    <nav class="chat-list-tabs" role="tablist" aria-label="對話分類">
      <button
        type="button"
        :class="[
          'chat-list-tab',
          { 'chat-list-tab--active': activeTab === 'all' },
        ]"
        role="tab"
        :aria-selected="activeTab === 'all'"
        aria-controls="chat-thread-all"
        @click="$emit('change-tab', 'all')"
      >
        全部
      </button>
      <button
        type="button"
        :class="[
          'chat-list-tab',
          { 'chat-list-tab--active': activeTab === 'favorite' },
        ]"
        role="tab"
        :aria-selected="activeTab === 'favorite'"
        aria-controls="chat-thread-favorite"
        @click="$emit('change-tab', 'favorite')"
      >
        喜歡
      </button>
    </nav>
  </header>
</template>

<script setup>
defineProps({
  activeTab: {
    type: String,
    required: true,
    validator: (value) => ['all', 'favorite'].includes(value),
  },
});

defineEmits(['change-tab']);
</script>

<style scoped>
.chat-list-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-primary, #ffffff);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.chat-list-tabs {
  display: flex;
  gap: 0;
}

.chat-list-tab {
  flex: 1;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-list-tab:hover {
  color: var(--text-primary, #111827);
  background: var(--bg-hover, #f9fafb);
}

.chat-list-tab--active {
  color: var(--primary-color, #3b82f6);
  border-bottom-color: var(--primary-color, #3b82f6);
}

.chat-list-tab:focus-visible {
  outline: 2px solid var(--primary-color, #3b82f6);
  outline-offset: -2px;
}
</style>
