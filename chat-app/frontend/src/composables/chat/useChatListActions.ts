/**
 * ChatList 操作管理 Composable (TypeScript)
 *
 * 負責管理對話列表的收藏、刪除操作和操作提示訊息
 */

import { reactive } from 'vue';
import type { Ref } from 'vue';
import { apiJson } from '../../utils/api.js';
import type { User } from '../../types';

// ==================== 類型定義 ====================

export interface ChatThread {
  id: string;
  displayName: string;
  portrait: string;
  lastMessage: string;
  timeLabel: string;
  isFavorite: boolean;
}

export interface ActionMessage {
  text: string;
  tone: 'info' | 'success' | 'error' | '';
}

export interface DeleteConfirmState {
  open: boolean;
  threadId: string;
  displayName: string;
  lastMessage: string;
  timeLabel: string;
}

export interface FirebaseAuthService {
  getCurrentUserIdToken: () => Promise<string>;
}

export interface UseChatListActionsDeps {
  user: Ref<User | null>;
  setUserProfile: (profile: User) => void;
  firebaseAuth: FirebaseAuthService;
}

export interface UseChatListActionsReturn {
  // 收藏狀態
  favoriteMutations: Record<string, boolean>;
  isFavoriteMutating: (id: string) => boolean;

  // 刪除狀態
  deleteMutations: Record<string, boolean>;
  isDeletingThread: (id: string) => boolean;

  // 操作訊息
  actionMessage: ActionMessage;
  showActionMessage: (text: string, tone?: 'info' | 'success' | 'error') => void;

  // 刪除確認
  deleteConfirm: DeleteConfirmState;
  requestDeleteAction: (thread: ChatThread) => void;
  cancelDeleteAction: () => void;
  confirmDeleteAction: (registerHidden: (id: string, meta: { lastMessage: string; timeLabel: string }) => void) => void;
  clearDeleteConfirmState: () => void;

  // 收藏操作
  handleFavoriteAction: (thread: ChatThread) => Promise<void>;

  // 清理
  cleanup: () => void;
}

// ==================== 工具函數 ====================

const normalizeId = (value: any): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length ? trimmed : '';
};

// ==================== Composable ====================

/**
 * 創建 ChatList 操作管理
 * @param deps - 依賴項
 * @returns 操作狀態和方法
 */
export function useChatListActions(deps: UseChatListActionsDeps): UseChatListActionsReturn {
  const { user, setUserProfile, firebaseAuth } = deps;

  // ==========================================
  // 收藏和刪除狀態
  // ==========================================
  const favoriteMutations = reactive<Record<string, boolean>>({});
  const deleteMutations = reactive<Record<string, boolean>>({});

  const isFavoriteMutating = (id: string): boolean => {
    if (!id) return false;
    return Boolean(favoriteMutations[id]);
  };

  const setFavoriteMutating = (id: string, value: boolean): void => {
    if (!id) return;
    if (value) {
      favoriteMutations[id] = true;
    } else {
      delete favoriteMutations[id];
    }
  };

  const isDeletingThread = (id: string): boolean => {
    if (!id) return false;
    return Boolean(deleteMutations[id]);
  };

  // ==========================================
  // Action Message
  // ==========================================
  const actionMessage = reactive<ActionMessage>({
    text: '',
    tone: '',
  });

  let actionMessageTimer = 0;

  const showActionMessage = (text: string, tone: 'info' | 'success' | 'error' = 'info'): void => {
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

  // ==========================================
  // 收藏操作
  // ==========================================
  const handleFavoriteAction = async (thread: ChatThread): Promise<void> => {
    showActionMessage('');
    const threadId = normalizeId(thread?.id);
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

    let token: string;
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

      showActionMessage(
        wasFavorited ? '已取消收藏對話。' : '已加入收藏對話。',
        'success'
      );
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
  const deleteConfirm = reactive<DeleteConfirmState>({
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

  const requestDeleteAction = (thread: ChatThread): void => {
    showActionMessage('');
    const threadId = normalizeId(thread?.id);
    if (!threadId) return;

    if (isDeletingThread(threadId)) return;

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

  const confirmDeleteAction = (
    registerHidden: (id: string, meta: { lastMessage: string; timeLabel: string }) => void
  ): void => {
    const threadId = deleteConfirm.threadId;
    if (!threadId) {
      clearDeleteConfirmState();
      return;
    }

    showActionMessage('');

    if (isFavoriteMutating(threadId)) return;

    registerHidden(threadId, {
      lastMessage: deleteConfirm.lastMessage ?? '',
      timeLabel: deleteConfirm.timeLabel ?? '',
    });

    clearDeleteConfirmState();
    showActionMessage('已隱藏對話，紀錄會保留。', 'success');
  };

  // ==========================================
  // 清理
  // ==========================================
  const cleanup = (): void => {
    if (actionMessageTimer) {
      clearTimeout(actionMessageTimer);
      actionMessageTimer = 0;
    }
  };

  // ==========================================
  // 返回
  // ==========================================
  return {
    // 收藏狀態
    favoriteMutations,
    isFavoriteMutating,

    // 刪除狀態
    deleteMutations,
    isDeletingThread,

    // 操作訊息
    actionMessage,
    showActionMessage,

    // 刪除確認
    deleteConfirm,
    requestDeleteAction,
    cancelDeleteAction,
    confirmDeleteAction,
    clearDeleteConfirmState,

    // 收藏操作
    handleFavoriteAction,

    // 清理
    cleanup,
  };
}
