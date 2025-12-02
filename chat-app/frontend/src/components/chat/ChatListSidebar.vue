<script setup lang="ts">
import { computed, ref, watch, type Ref, type ComponentPublicInstance } from 'vue';
import { useUserProfile } from '../../composables/useUserProfile';
import { usePaginatedConversations } from '../../composables/usePaginatedConversations';
import { useInfiniteScroll } from '../../composables/useInfiniteScroll';
import { useChatListState } from '../../composables/chat/useChatListState';

// 子組件
import ChatListItem from '../chat-list/ChatListItem.vue';

// Props
const props = defineProps<{
  currentPartnerId?: string;
}>();

// Emits
const emit = defineEmits<{
  (e: 'select', threadId: string): void;
}>();

// ==========================================
// 用戶狀態
// ==========================================
const { user } = useUserProfile();
const userId = computed(() => user.value?.id ?? '');

// ==========================================
// 分頁對話列表
// ==========================================
const {
  conversations: paginatedConversations,
  isLoading: isLoadingConversations,
  isLoadingMore: isLoadingMoreConversations,
  loadInitial,
  loadMore: loadMoreConversations,
} = usePaginatedConversations(userId, 20);

// 無限滾動
const { containerRef } = useInfiniteScroll(loadMoreConversations, {
  threshold: 200,
  enabled: true,
});

// Ref callback function for conditional binding
const setScrollContainerRef = (el: Element | ComponentPublicInstance | null): void => {
  if (el instanceof HTMLElement) {
    containerRef.value = el;
  }
};

// 監聽用戶 ID 變化，載入對話列表
watch(
  userId,
  async (newUserId) => {
    if (newUserId) {
      await loadInitial();
    }
  },
  { immediate: true }
);

// ==========================================
// ChatList 狀態管理
// ==========================================
const {
  conversationThreads,
  isEmpty,
} = useChatListState({
  user,
  conversations: paginatedConversations,
});

// ==========================================
// 滑動手勢管理（簡化版，桌面版不需要完整滑動功能）
// ==========================================
const chatItemRefs: Ref<any[]> = ref([]);
const shouldBlockThreadClick: Ref<boolean> = ref(false);

// ==========================================
// 對話選擇
// ==========================================
interface Thread {
  id: string;
  displayName?: string;
  lastMessage?: string;
  timeLabel?: string;
  [key: string]: any;
}

const handleThreadSelect = (thread: Thread): void => {
  if (shouldBlockThreadClick.value) {
    shouldBlockThreadClick.value = false;
    return;
  }

  if (!thread?.id) return;

  emit('select', thread.id);
};
</script>

<template>
  <aside class="chat-sidebar">
    <!-- 標題 -->
    <div class="chat-sidebar__header">
      <h2 class="chat-sidebar__title">訊息</h2>
    </div>

    <!-- 對話列表 -->
    <div
      v-if="!isEmpty"
      :ref="setScrollContainerRef"
      class="chat-sidebar__list"
      role="list"
    >
      <!-- 載入更多指示器 -->
      <div
        v-if="isLoadingMoreConversations"
        class="chat-sidebar__loading"
      >
        <div class="chat-sidebar__spinner"></div>
      </div>

      <!-- 對話項列表 -->
      <div
        v-for="thread in conversationThreads"
        :key="thread.id"
        class="chat-sidebar__item"
        :class="{ 'chat-sidebar__item--active': thread.id === currentPartnerId }"
        @click="handleThreadSelect(thread)"
      >
        <div class="chat-sidebar__avatar">
          <img
            v-if="thread.photoURL"
            :src="thread.photoURL"
            :alt="thread.displayName || '角色頭像'"
          />
          <div v-else class="chat-sidebar__avatar-placeholder">
            {{ (thread.displayName || '?')[0] }}
          </div>
        </div>
        <div class="chat-sidebar__content">
          <div class="chat-sidebar__name">{{ thread.displayName || '未知角色' }}</div>
          <div class="chat-sidebar__preview">{{ thread.lastMessage || '開始對話' }}</div>
        </div>
        <div class="chat-sidebar__meta">
          <span class="chat-sidebar__time">{{ thread.timeLabel || '' }}</span>
        </div>
      </div>
    </div>

    <!-- 空狀態 -->
    <div v-else class="chat-sidebar__empty">
      <div v-if="isLoadingConversations" class="chat-sidebar__loading">
        <div class="chat-sidebar__spinner"></div>
        <p>載入中...</p>
      </div>
      <div v-else class="chat-sidebar__empty-text">
        <p>尚無對話</p>
        <p class="chat-sidebar__empty-hint">去探索頁面找個角色聊聊吧！</p>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.chat-sidebar {
  display: flex;
  flex-direction: column;
  width: var(--desktop-chat-sidebar-width, 320px);
  height: 100%;
  background: rgba(15, 17, 24, 0.98);
  border-right: 1px solid rgba(148, 163, 184, 0.12);
  overflow: hidden;

  &__header {
    padding: 1.25rem 1rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  &__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: rgba(148, 163, 184, 0.08);
    }

    &--active {
      background: rgba(102, 126, 234, 0.15);
      border-left: 3px solid #667eea;

      &:hover {
        background: rgba(102, 126, 234, 0.2);
      }
    }
  }

  &__avatar {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    font-size: 1.25rem;
    font-weight: 600;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 0.95rem;
    font-weight: 600;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__preview {
    font-size: 0.85rem;
    color: rgba(148, 163, 184, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 0.25rem;
  }

  &__meta {
    flex-shrink: 0;
  }

  &__time {
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.6);
  }

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem;

    p {
      margin: 0;
      font-size: 0.875rem;
      color: rgba(148, 163, 184, 0.7);
    }
  }

  &__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(148, 163, 184, 0.3);
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__empty-text {
    text-align: center;
    padding: 2rem;

    p {
      margin: 0;
      color: rgba(148, 163, 184, 0.7);

      &:first-child {
        font-size: 1rem;
        font-weight: 500;
      }
    }
  }

  &__empty-hint {
    margin-top: 0.5rem !important;
    font-size: 0.875rem !important;
    opacity: 0.7;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
