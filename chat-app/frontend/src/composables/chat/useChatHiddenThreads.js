/**
 * 聊天隱藏對話 Composable
 * 處理 localStorage 中的隱藏對話記錄
 */

import { reactive, watch } from 'vue';
import { logger } from '@/utils/logger';

const HIDDEN_THREADS_STORAGE_KEY = 'chat-list-hidden-threads';

export function useChatHiddenThreads(user) {
  const hiddenThreads = reactive(new Map());

  /**
   * 標準化 ID
   */
  const normalizeId = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : '';
  };

  /**
   * 解析隱藏對話的 storage key
   */
  const resolveHiddenThreadsKey = (ownerId) => {
    const raw =
      typeof ownerId === 'string' && ownerId.trim().length
        ? ownerId.trim()
        : '';
    return raw.length
      ? `${HIDDEN_THREADS_STORAGE_KEY}:${raw}`
      : `${HIDDEN_THREADS_STORAGE_KEY}:guest`;
  };

  /**
   * 檢查對話是否被隱藏
   */
  const isThreadHidden = (id) => {
    if (typeof id !== 'string') return false;
    return hiddenThreads.has(id);
  };

  /**
   * 持久化隱藏對話到 localStorage
   */
  const persistHiddenThreads = (ownerId) => {
    if (typeof window === 'undefined') return;
    try {
      const payload = Array.from(hiddenThreads.entries()).map(
        ([id, meta]) => ({
          id,
          lastMessage:
            typeof meta?.lastMessage === 'string' ? meta.lastMessage : '',
          timeLabel: typeof meta?.timeLabel === 'string' ? meta.timeLabel : '',
          timestamp:
            typeof meta?.timestamp === 'number' ? meta.timestamp : Date.now(),
        })
      );
      window.localStorage.setItem(
        resolveHiddenThreadsKey(ownerId),
        JSON.stringify(payload)
      );
      logger.log('[ChatHidden] 持久化隱藏對話', { count: payload.length });
    } catch (error) {
      logger.error('[ChatHidden] 儲存隱藏對話失敗', error);
    }
  };

  /**
   * 從 localStorage 載入隱藏對話
   */
  const loadHiddenThreads = (ownerId) => {
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
          lastMessage:
            typeof entry?.lastMessage === 'string' ? entry.lastMessage : '',
          timeLabel:
            typeof entry?.timeLabel === 'string' ? entry.timeLabel : '',
          timestamp:
            typeof entry?.timestamp === 'number'
              ? entry.timestamp
              : Date.now(),
        });
      });

      logger.log('[ChatHidden] 載入隱藏對話', { count: entries.length });
    } catch (error) {
      logger.error('[ChatHidden] 載入隱藏對話失敗', error);
    }
  };

  /**
   * 註冊隱藏對話
   */
  const registerHiddenThread = (id, meta = {}, ownerId) => {
    const threadId = normalizeId(id);
    if (!threadId) return;

    hiddenThreads.set(threadId, {
      lastMessage:
        typeof meta?.lastMessage === 'string' ? meta.lastMessage : '',
      timeLabel: typeof meta?.timeLabel === 'string' ? meta.timeLabel : '',
      timestamp: Date.now(),
    });

    persistHiddenThreads(ownerId);
    logger.log('[ChatHidden] 註冊隱藏對話', { threadId });
  };

  /**
   * 取消註冊隱藏對話
   */
  const unregisterHiddenThread = (id, ownerId) => {
    const threadId = normalizeId(id);
    if (!threadId || !hiddenThreads.has(threadId)) return;

    hiddenThreads.delete(threadId);
    persistHiddenThreads(ownerId);
    logger.log('[ChatHidden] 取消隱藏對話', { threadId });
  };

  /**
   * 清空所有隱藏對話
   */
  const clearHiddenThreads = (ownerId) => {
    hiddenThreads.clear();
    persistHiddenThreads(ownerId);
    logger.log('[ChatHidden] 清空所有隱藏對話');
  };

  // 初始載入
  if (typeof window !== 'undefined' && user.value?.id) {
    loadHiddenThreads(user.value.id);
  }

  // 監聽用戶變更，重新載入隱藏對話
  watch(
    () => user.value?.id,
    (newUserId, oldUserId) => {
      if (newUserId && newUserId !== oldUserId) {
        loadHiddenThreads(newUserId);
      }
    }
  );

  return {
    hiddenThreads,
    isThreadHidden,
    registerHiddenThread,
    unregisterHiddenThread,
    clearHiddenThreads,
    loadHiddenThreads,
  };
}
