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
        聊天
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

<script setup lang="ts">
// Types
type Tab = 'all' | 'favorite';

interface Props {
  activeTab: Tab;
}

interface Emits {
  (e: 'change-tab', tab: Tab): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
.chat-list-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(2, 6, 23, 0.4);
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

/* 桌面版樣式優化 - 大膽設計 */
@media (min-width: 1024px) {
  .chat-list-header {
    position: relative;
    display: flex;
    justify-content: center;
    background: transparent;
    backdrop-filter: none;
    border-bottom: none;
    margin-bottom: 1.5rem;
  }

  .chat-list-tabs {
    display: inline-flex;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 14px;
    padding: 6px;
    border: 1px solid rgba(148, 163, 184, 0.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .chat-list-tab {
    flex: none;
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 10px;
    border-bottom: none;
    color: rgba(226, 232, 240, 0.7);
    transition: all 0.2s ease;
  }

  .chat-list-tab:hover {
    background: rgba(226, 232, 240, 0.08);
    color: #fff;
  }

  .chat-list-tab--active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.4), rgba(118, 75, 162, 0.4));
    color: #fff;
    border-bottom: none;
    box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3);
  }

  .chat-list-tab--active::before {
    display: none;
  }
}

/* 寬螢幕進一步優化 */
@media (min-width: 1440px) {
  .chat-list-header {
    margin-bottom: 2rem;
  }

  .chat-list-tab {
    padding: 0.875rem 2.5rem;
    font-size: 1.0625rem;
  }
}
</style>
