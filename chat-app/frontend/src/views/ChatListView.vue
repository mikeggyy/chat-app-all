<script setup lang="ts">
import { computed, onBeforeUnmount, onBeforeUpdate, reactive, ref, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserProfile } from '../composables/useUserProfile';
import { useFirebaseAuth } from '../composables/useFirebaseAuth';
import { usePaginatedConversations } from '../composables/usePaginatedConversations';
import { useInfiniteScroll } from '../composables/useInfiniteScroll';
import { useChatListState } from '../composables/chat/useChatListState';
import { useIsMounted } from '../composables/useIsMounted';
import { apiJson } from '../utils/api';

// 子組件
import ChatListHeader from '../components/chat-list/ChatListHeader.vue';
import ChatListBanner from '../components/chat-list/ChatListBanner.vue';
import ChatListItem from '../components/chat-list/ChatListItem.vue';
import ChatListEmpty from '../components/chat-list/ChatListEmpty.vue';
import DeleteConfirmDialog from '../components/chat-list/DeleteConfirmDialog.vue';

// ==========================================
// 類型定義
// ==========================================
interface HiddenThreadMeta {
  lastMessage: string;
  timeLabel: string;
  timestamp: number;
}

interface ActionMessage {
  text: string;
  tone: string;
}

interface DeleteConfirmState {
  open: boolean;
  threadId: string;
  displayName: string;
  lastMessage: string;
  timeLabel: string;
}

interface Thread {
  id: string;
  displayName?: string;
  lastMessage?: string;
  timeLabel?: string;
  [key: string]: any;
}

const router = useRouter();
const { user, setUserProfile } = useUserProfile();
const firebaseAuth = useFirebaseAuth();

// ✅ 追蹤組件掛載狀態，防止快速路由切換時的競態條件
const isMounted = useIsMounted();

// ==========================================
// 分頁對話列表
// ==========================================
const userId = computed(() => user.value?.id ?? '');
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

// 監聽用戶 ID 變化，載入對話列表
watch(
  userId,
  async (newUserId) => {
    if (newUserId) {
      await loadInitial();

      // ✅ 檢查組件是否已卸載
      if (!isMounted.value) {
        return;
      }
    }
  },
  { immediate: true }
);

// ==========================================
// ChatList 狀態管理
// ==========================================
const {
  activeTab,
  isFavoriteTab,
  conversationThreads,
  visibleThreads,
  isEmpty,
  selectTab,
} = useChatListState({
  user,
  conversations: paginatedConversations,
});

// ==========================================
// 隱藏對話管理
// ==========================================
const HIDDEN_THREADS_STORAGE_KEY: string = 'chat-list-hidden-threads';
const hiddenThreads: Map<string, HiddenThreadMeta> = reactive(new Map());
let lastHiddenOwnerId: string = '';

const normalizeId = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length ? trimmed : '';
};

const resolveHiddenThreadsKey = (ownerId: string | undefined = user.value?.id): string => {
  const raw = typeof ownerId === 'string' && ownerId.trim().length ? ownerId.trim() : '';
  return raw.length
    ? `${HIDDEN_THREADS_STORAGE_KEY}:${raw}`
    : `${HIDDEN_THREADS_STORAGE_KEY}:guest`;
};

const isThreadHidden = (id: unknown): boolean => {
  if (typeof id !== 'string') return false;
  return hiddenThreads.has(id);
};

const persistHiddenThreads = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const payload = Array.from(hiddenThreads.entries()).map(([id, meta]) => ({
      id,
      lastMessage: typeof meta?.lastMessage === 'string' ? meta.lastMessage : '',
      timeLabel: typeof meta?.timeLabel === 'string' ? meta.timeLabel : '',
      timestamp: typeof meta?.timestamp === 'number' ? meta.timestamp : Date.now(),
    }));
    window.localStorage.setItem(resolveHiddenThreadsKey(), JSON.stringify(payload));
  } catch {
    // 儲存失敗時靜默處理
  }
};

const loadHiddenThreads = (ownerId: string | undefined): void => {
  if (typeof window === 'undefined') return;
  try {
    const storageKey = resolveHiddenThreadsKey(ownerId);
    const raw = window.localStorage.getItem(storageKey);
    hiddenThreads.clear();
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => {
      const id = normalizeId(entry?.id);
      if (!id) return;
      hiddenThreads.set(id, {
        lastMessage: typeof entry?.lastMessage === 'string' ? entry.lastMessage : '',
        timeLabel: typeof entry?.timeLabel === 'string' ? entry.timeLabel : '',
        timestamp: typeof entry?.timestamp === 'number' ? entry.timestamp : Date.now(),
      });
    });
  } catch {
    // 載入失敗時靜默處理
  }
};

const registerHiddenThread = (id: unknown, meta: Partial<HiddenThreadMeta> = {}): void => {
  const threadId = normalizeId(id);
  if (!threadId) return;
  hiddenThreads.set(threadId, {
    lastMessage: typeof meta?.lastMessage === 'string' ? meta.lastMessage : '',
    timeLabel: typeof meta?.timeLabel === 'string' ? meta.timeLabel : '',
    timestamp: Date.now(),
  });
  persistHiddenThreads();
};

const unregisterHiddenThread = (id: unknown): void => {
  const threadId = normalizeId(id);
  if (!threadId || !hiddenThreads.has(threadId)) return;
  hiddenThreads.delete(threadId);
  persistHiddenThreads();
};

// 初始化隱藏對話
if (typeof window !== 'undefined') {
  loadHiddenThreads(user.value?.id);
}

// 監聽用戶變化，重新載入隱藏對話
watch(
  () => user.value?.id,
  (nextUserId: string | undefined) => {
    const normalizedUserId = normalizeId(nextUserId ?? '');
    if (normalizedUserId !== lastHiddenOwnerId) {
      lastHiddenOwnerId = normalizedUserId;
      loadHiddenThreads(nextUserId);
    }
  }
);

// 過濾隱藏的對話
const visibleThreadsFiltered = computed(() => {
  return visibleThreads.value.filter((thread) => !isThreadHidden(thread?.id));
});

// 優化：使用 Map 和 Set 提升查找效率
const conversationThreadsMap = computed(() => {
  const map = new Map();
  conversationThreads.value.forEach((thread) => {
    const id = normalizeId(thread?.id);
    if (id) {
      map.set(id, thread);
    }
  });
  return map;
});

// 監聽對話變化，自動恢復已更新的隱藏對話
watch(
  conversationThreads,
  () => {
    if (!hiddenThreads.size) return;

    const restoreIds: string[] = [];

    // 優化：使用 computed 的 Map 避免重複創建，O(n) 遍歷而非 O(n*m)
    hiddenThreads.forEach((meta, id) => {
      const thread = conversationThreadsMap.value.get(id);
      if (!thread) return;

      const lastMessage = typeof thread.lastMessage === 'string' ? thread.lastMessage : '';
      const timeLabel = typeof thread.timeLabel === 'string' ? thread.timeLabel : '';

      // 檢查是否有更新
      if ((meta?.lastMessage ?? '') !== lastMessage || (meta?.timeLabel ?? '') !== timeLabel) {
        restoreIds.push(id);
      }
    });

    if (restoreIds.length) {
      restoreIds.forEach((id) => unregisterHiddenThread(id));
    }
  },
  { immediate: true }
);

// ==========================================
// 滑動手勢管理
// ==========================================
const chatItemRefs: Ref<any[]> = ref([]);
const shouldBlockThreadClick: Ref<boolean> = ref(false);
const activeSwipeThreadId: Ref<string | null> = ref(null);

const closeAllSwipes = (): void => {
  chatItemRefs.value.forEach((itemRef) => {
    if (itemRef && typeof itemRef.closeSwipe === 'function') {
      itemRef.closeSwipe();
    }
  });
  shouldBlockThreadClick.value = false;
  activeSwipeThreadId.value = null;
};

const handleSwipeStart = (threadId: string): void => {
  // 關閉所有滑動（包括當前項）
  // 當前項會在子組件的 onSwipeStart 中立即重新開始滑動，所以這不會有副作用
  chatItemRefs.value.forEach((itemRef) => {
    if (itemRef && typeof itemRef.closeSwipe === 'function') {
      itemRef.closeSwipe();
    }
  });
  shouldBlockThreadClick.value = false;
  activeSwipeThreadId.value = threadId;
};

const handleSwipeMove = (_threadId: string, offset: number): void => {
  if (Math.abs(offset) > 6) {
    shouldBlockThreadClick.value = true;
  }
};

const handleSwipeEnd = (threadId: string, isOpen: boolean): void => {
  // 滑動狀態由子組件自己管理，這裡不需要額外操作
  activeSwipeThreadId.value = isOpen ? threadId : null;
};

const handleSwipeCancel = (_threadId: string): void => {
  shouldBlockThreadClick.value = false;
  activeSwipeThreadId.value = null;
};

// 清空 refs（在每次組件更新前）
onBeforeUpdate(() => {
  chatItemRefs.value = [];
});

// 監聽標籤頁變化，關閉所有滑動
watch(activeTab, () => {
  closeAllSwipes();
  if (deleteConfirm.open) {
    cancelDeleteAction();
  }
});

// ==========================================
// 收藏和刪除操作
// ==========================================
const favoriteMutations: Record<string, boolean> = reactive({});
const deleteMutations: Record<string, boolean> = reactive({});

const isFavoriteMutating = (id: string | undefined): boolean => {
  if (!id) return false;
  return Boolean(favoriteMutations[id]);
};

const setFavoriteMutating = (id: string | undefined, value: boolean): void => {
  if (!id) return;
  if (value) {
    favoriteMutations[id] = true;
  } else {
    delete favoriteMutations[id];
  }
};

const isDeletingThread = (id: string | undefined): boolean => {
  if (!id) return false;
  return Boolean(deleteMutations[id]);
};

// ==========================================
// Action Message
// ==========================================
const actionMessage: ActionMessage = reactive({
  text: '',
  tone: '',
});
let actionMessageTimer: number = 0;

const showActionMessage = (text: string, tone: string = 'info'): void => {
  const content = typeof text === 'string' ? text.trim() : '';
  if (!content) {
    actionMessage.text = '';
    actionMessage.tone = '';
    if (actionMessageTimer) {
      clearTimeout(actionMessageTimer);
      actionMessageTimer = 0;
    }
    return;
  }

  actionMessage.text = content;
  actionMessage.tone = tone;

  if (actionMessageTimer) {
    clearTimeout(actionMessageTimer);
  }

  if (typeof window !== 'undefined') {
    actionMessageTimer = window.setTimeout(() => {
      actionMessage.text = '';
      actionMessage.tone = '';
      actionMessageTimer = 0;
    }, 800);
  }
};

onBeforeUnmount(() => {
  if (actionMessageTimer) {
    clearTimeout(actionMessageTimer);
  }
});

// ==========================================
// 收藏操作
// ==========================================
const handleFavoriteAction = async (thread: Thread): Promise<void> => {
  showActionMessage('');
  const threadId = normalizeId(thread?.id);
  const threadName = thread?.displayName || '';
  if (!threadId) return;

  if (isFavoriteMutating(threadId)) return;

  const currentProfile = user.value;
  if (!currentProfile?.id) {
    showActionMessage('請登入後才能收藏角色。', 'error');
    return;
  }

  setFavoriteMutating(threadId, true);

  const previousFavorites = Array.isArray(currentProfile.favorites)
    ? [...currentProfile.favorites]
    : [];

  const wasFavorited = previousFavorites.includes(threadId);
  const optimisticSet = new Set(previousFavorites);

  if (wasFavorited) {
    optimisticSet.delete(threadId);
  } else {
    optimisticSet.add(threadId);
  }

  // 樂觀更新
  setUserProfile({
    ...(user.value ?? currentProfile),
    favorites: Array.from(optimisticSet),
  });

  let token;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (authError) {
    // 回滾
    setUserProfile({
      ...(user.value ?? currentProfile),
      favorites: previousFavorites,
    });
    const message =
      authError instanceof Error
        ? authError.message
        : '取得登入資訊時發生錯誤，請重新登入後再試。';
    showActionMessage(message, 'error');
    setFavoriteMutating(threadId, false);
    return;
  }

  try {
    const endpoint = wasFavorited
      ? `/api/users/${encodeURIComponent(currentProfile.id)}/favorites/${encodeURIComponent(threadId)}`
      : `/api/users/${encodeURIComponent(currentProfile.id)}/favorites`;

    const response = await apiJson(endpoint, {
      method: wasFavorited ? 'DELETE' : 'POST',
      body: wasFavorited ? undefined : { matchId: threadId },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      skipGlobalLoading: true,
    });

    const favoritesList = Array.isArray(response?.favorites)
      ? response.favorites
      : Array.from(optimisticSet);

    setUserProfile({
      ...(user.value ?? currentProfile),
      favorites: favoritesList,
    });

    // 顯示提示消息（統一格式）
    const message = wasFavorited
      ? `已取消收藏${threadName ? ` ${threadName}` : ''}`
      : `已收藏${threadName ? ` ${threadName}` : ''}`;
    showActionMessage(message, 'success');
  } catch (requestError) {
    // 回滾
    setUserProfile({
      ...(user.value ?? currentProfile),
      favorites: previousFavorites,
    });
    const message =
      requestError instanceof Error
        ? requestError.message
        : '更新收藏時發生錯誤，請稍後再試。';
    showActionMessage(message, 'error');
  } finally {
    setFavoriteMutating(threadId, false);
  }
};

// ==========================================
// 刪除確認對話框
// ==========================================
const deleteConfirm: DeleteConfirmState = reactive({
  open: false,
  threadId: '',
  displayName: '',
  lastMessage: '',
  timeLabel: '',
});

const clearDeleteConfirmState = (): void => {
  deleteConfirm.open = false;
  deleteConfirm.threadId = '';
  deleteConfirm.displayName = '';
  deleteConfirm.lastMessage = '';
  deleteConfirm.timeLabel = '';
};

const requestDeleteAction = (thread: Thread): void => {
  showActionMessage('');
  const threadId = normalizeId(thread?.id);
  if (!threadId) return;

  if (isDeletingThread(threadId)) return;

  if (isThreadHidden(threadId)) {
    showActionMessage('對話已隱藏，紀錄依然保留。', 'info');
    return;
  }

  deleteConfirm.threadId = threadId;
  deleteConfirm.displayName = normalizeId(thread?.displayName) || '這則對話';
  deleteConfirm.lastMessage = typeof thread?.lastMessage === 'string' ? thread.lastMessage : '';
  deleteConfirm.timeLabel = typeof thread?.timeLabel === 'string' ? thread.timeLabel : '';
  deleteConfirm.open = true;
};

const cancelDeleteAction = (): void => {
  if (isDeletingThread(deleteConfirm.threadId)) return;
  clearDeleteConfirmState();
};

const confirmDeleteAction = (): void => {
  const threadId = deleteConfirm.threadId;
  if (!threadId) {
    clearDeleteConfirmState();
    return;
  }

  showActionMessage('');

  if (isFavoriteMutating(threadId)) return;

  const threads = conversationThreads.value;
  const targetThread = threads.find((thread) => thread.id === threadId) ?? null;

  registerHiddenThread(threadId, {
    lastMessage: targetThread?.lastMessage ?? deleteConfirm.lastMessage ?? '',
    timeLabel: targetThread?.timeLabel ?? deleteConfirm.timeLabel ?? '',
  });

  clearDeleteConfirmState();
  closeAllSwipes();
  showActionMessage('已隱藏對話，紀錄會保留。', 'success');
};

// ==========================================
// 對話選擇
// ==========================================
const handleThreadSelect = (thread: Thread): void => {
  if (shouldBlockThreadClick.value) {
    shouldBlockThreadClick.value = false;
    return;
  }

  if (!thread?.id) return;

  closeAllSwipes();
  router.push({
    name: 'chat',
    params: { id: thread.id },
  });
};
</script>

<template>
  <main class="chat-list-page">
    <div class="chat-list-backdrop" aria-hidden="true" />

    <!-- 頁面標題 -->
    <div class="chat-list-title-wrapper">
      <h1 class="chat-list-title">訊息</h1>
    </div>

    <!-- 標籤頁切換 -->
    <ChatListHeader
      :active-tab="activeTab"
      @change-tab="selectTab"
    />

    <!-- 操作提示橫幅 -->
    <ChatListBanner :message="actionMessage" />

    <!-- 對話列表 -->
    <section
      v-if="!isEmpty"
      :id="isFavoriteTab ? 'chat-thread-favorite' : 'chat-thread-all'"
      :ref="!isFavoriteTab ? (containerRef as any) : undefined"
      class="chat-thread-scroll chat-thread-list"
      role="list"
    >
      <!-- 載入更多指示器 -->
      <div
        v-if="isLoadingMoreConversations && !isFavoriteTab"
        class="chat-list-loading"
      >
        <div class="chat-list-loading__spinner"></div>
        <p>載入更多對話...</p>
      </div>

      <!-- 對話項列表 -->
      <ChatListItem
        v-for="thread in visibleThreadsFiltered"
        :key="thread.id"
        :ref="(el) => { if (el) chatItemRefs.push(el); }"
        :thread="thread"
        :is-favorite-tab="isFavoriteTab"
        :is-favoriting="isFavoriteMutating(thread.id)"
        :is-deleting="isDeletingThread(thread.id)"
        :should-block-click="shouldBlockThreadClick"
        @select="handleThreadSelect"
        @favorite="handleFavoriteAction"
        @delete="requestDeleteAction"
        @swipe-start="handleSwipeStart"
        @swipe-move="handleSwipeMove"
        @swipe-end="handleSwipeEnd"
        @swipe-cancel="handleSwipeCancel"
      />
    </section>

    <!-- 空狀態 -->
    <ChatListEmpty
      v-else
      :is-loading="isLoadingConversations && !isFavoriteTab"
    />

    <!-- 刪除確認對話框 -->
    <DeleteConfirmDialog
      :open="deleteConfirm.open"
      :display-name="deleteConfirm.displayName"
      :is-deleting="isDeletingThread(deleteConfirm.threadId)"
      @confirm="confirmDeleteAction"
      @cancel="cancelDeleteAction"
    />
  </main>
</template>

<style scoped>
.chat-list-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: transparent;
  overflow: hidden;
}

.chat-list-backdrop {
  position: fixed;
  inset: 0;
  background: radial-gradient(
      circle at top,
      rgba(30, 64, 175, 0.35),
      transparent
    ),
    radial-gradient(circle at bottom, rgba(236, 72, 153, 0.18), transparent),
    #020617;
  z-index: -1;
}

.chat-list-title-wrapper {
  padding: 1rem 1rem 0.5rem;
  background: transparent;
}

.chat-list-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #f8fafc;
}

.chat-thread-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.chat-thread-list {
  /* 底部導航欄高度(~64px) + 額外間距(16px) + 安全區域 */
  padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
}

.chat-list-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
}

.chat-list-loading p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.chat-list-loading__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
