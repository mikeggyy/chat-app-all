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
  background: rgba(2, 6, 23, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
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
  color: rgba(226, 232, 240, 0.6);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.chat-list-tab:hover {
  color: rgba(226, 232, 240, 0.9);
  background: rgba(226, 232, 240, 0.08);
}

.chat-list-tab--active {
  color: #f8fafc;
  background: rgba(236, 72, 153, 0.12);
  border-bottom-color: #ec4899;
}

.chat-list-tab--active::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #ec4899, #f472b6);
  box-shadow: 0 0 8px rgba(236, 72, 153, 0.5);
}

.chat-list-tab:focus-visible {
  outline: 2px solid var(--primary-color, #3b82f6);
  outline-offset: -2px;
}
</style>
