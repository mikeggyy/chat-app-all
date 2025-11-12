const MAX_CACHED_MESSAGES = 200;

const memoryHistoryStore = new Map();
const memoryPendingStore = new Map();

let storageAvailable = undefined;

const getStorage = () => {
  if (storageAvailable === false) {
    return null;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    storageAvailable = false;
    return null;
  }

  if (storageAvailable === undefined) {
    try {
      const testKey = "__conversation_cache_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      storageAvailable = true;
    } catch (error) {

      storageAvailable = false;
    }
  }

  return storageAvailable ? window.localStorage : null;
};

const buildKey = (prefix, userId, characterId) => {
  const safeUser = typeof userId === "string" ? userId.trim() : "";
  const safeCharacter = typeof characterId === "string" ? characterId.trim() : "";
  return `${prefix}::${safeUser}::${safeCharacter}`;
};

const readFromStore = (store, key) => {
  if (store instanceof Map) {
    return store.get(key);
  }
  const raw = store.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const sanitizeForStorage = (value) => {
  // 如果是消息陣列，移除 base64 圖片數據以節省空間
  if (Array.isArray(value)) {
    return value.map(msg => {
      if (!msg || typeof msg !== 'object') return msg;

      // 如果消息包含 imageUrl 且是 base64 格式，將其替換為佔位符
      if (msg.imageUrl && typeof msg.imageUrl === 'string' && msg.imageUrl.startsWith('data:image/')) {
        return {
          ...msg,
          imageUrl: '__BASE64_IMAGE_REMOVED__', // 標記有圖片但不存儲數據
          hadImage: true, // 標記原本有圖片
        };
      }

      return msg;
    });
  }
  return value;
};

const writeToStore = (store, key, value) => {
  if (store instanceof Map) {
    if (value === null) {
      store.delete(key);
    } else {
      store.set(key, value);
    }
    return;
  }

  if (value === null) {
    store.removeItem(key);
    return;
  }

  try {
    // 清理大型數據後再存儲
    const sanitized = sanitizeForStorage(value);
    store.setItem(key, JSON.stringify(sanitized));
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('[conversationCache] QuotaExceededError: localStorage 空間不足，嘗試清理...');

      // ✅ 更激進的清理策略：清理所有類型的緩存
      try {
        const keysToRemove = [];
        for (let i = 0; i < store.length; i++) {
          const storageKey = store.key(i);
          if (storageKey) {
            // 清理所有對話相關緩存（history、pending、hidden-threads）
            const shouldRemove =
              storageKey.startsWith('history::') ||
              storageKey.startsWith('pending::') ||
              storageKey.startsWith('chat-list-hidden-threads:');

            if (shouldRemove) {
              keysToRemove.push(storageKey);
            }
          }
        }

        console.log(`[conversationCache] 找到 ${keysToRemove.length} 個緩存項，準備清理...`);

        // 優先清理：移除非當前對話的緩存
        let removedCount = 0;
        for (const oldKey of keysToRemove) {
          if (oldKey !== key) {
            try {
              store.removeItem(oldKey);
              removedCount++;
            } catch (e) {
              console.error('[conversationCache] 清理緩存失敗:', oldKey, e);
            }
          }
        }

        console.log(`[conversationCache] 已清理 ${removedCount} 個緩存項`);

        // 再次嘗試存儲
        const sanitized = sanitizeForStorage(value);
        store.setItem(key, JSON.stringify(sanitized));
        console.log('[conversationCache] 清理後重新存儲成功');
      } catch (retryError) {
        console.error('[conversationCache] 清理後仍然失敗，禁用 localStorage:', retryError);
        storageAvailable = false; // 禁用 localStorage，改用內存存儲
      }
    } else {
      console.error('[conversationCache] localStorage 存儲失敗:', error);
      throw error; // 其他錯誤繼續拋出
    }
  }
};

const clipMessages = (messages = []) => {
  if (!Array.isArray(messages)) {
    return [];
  }
  if (messages.length <= MAX_CACHED_MESSAGES) {
    return messages;
  }
  return messages.slice(-MAX_CACHED_MESSAGES);
};

export const readCachedHistory = (userId, characterId) => {
  if (!userId || !characterId) return [];
  const key = buildKey("history", userId, characterId);
  const storage = getStorage();
  const store = storage ?? memoryHistoryStore;
  const payload = readFromStore(store, key);
  return Array.isArray(payload) ? payload : [];
};

export const writeCachedHistory = (userId, characterId, messages) => {
  if (!userId || !characterId) return;
  const key = buildKey("history", userId, characterId);
  const storage = getStorage();
  const store = storage ?? memoryHistoryStore;
  const clipped = clipMessages(messages);
  writeToStore(store, key, clipped);
};

export const appendCachedHistory = (userId, characterId, messages) => {
  if (!userId || !characterId) return;
  const existing = readCachedHistory(userId, characterId);
  const nextMessages = clipMessages([
    ...existing,
    ...(Array.isArray(messages) ? messages : [messages]).filter(Boolean),
  ]);
  writeCachedHistory(userId, characterId, nextMessages);
};

export const readPendingMessages = (userId, characterId) => {
  if (!userId || !characterId) return [];
  const key = buildKey("pending", userId, characterId);
  const storage = getStorage();
  const store = storage ?? memoryPendingStore;
  const payload = readFromStore(store, key);
  return Array.isArray(payload) ? payload : [];
};

const uniqueById = (messages) => {
  const map = new Map();
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const id = typeof message.id === "string" ? message.id : "";
    if (!id) continue;
    map.set(id, message);
  }
  return Array.from(map.values());
};

export const enqueuePendingMessages = (userId, characterId, messages) => {
  if (!userId || !characterId) return;
  const key = buildKey("pending", userId, characterId);
  const current = readPendingMessages(userId, characterId);
  const nextMessages = uniqueById([
    ...current,
    ...(Array.isArray(messages) ? messages : [messages]).filter(Boolean),
  ]);
  const storage = getStorage();
  const store = storage ?? memoryPendingStore;
  writeToStore(store, key, clipMessages(nextMessages));
};

export const removePendingMessagesById = (userId, characterId, ids = []) => {
  if (!userId || !characterId) return;
  const key = buildKey("pending", userId, characterId);
  const current = readPendingMessages(userId, characterId);
  if (!current.length) return;
  const idSet = new Set(
    (Array.isArray(ids) ? ids : [ids]).map((value) =>
      typeof value === "string" ? value : ""
    )
  );
  if (!idSet.size) return;
  const nextMessages = current.filter((message) => {
    const id = typeof message?.id === "string" ? message.id : "";
    return !idSet.has(id);
  });
  const storage = getStorage();
  const store = storage ?? memoryPendingStore;
  writeToStore(store, key, nextMessages.length ? nextMessages : null);
};

export const clearPendingMessages = (userId, characterId) => {
  if (!userId || !characterId) return;
  const key = buildKey("pending", userId, characterId);
  const storage = getStorage();
  const store = storage ?? memoryPendingStore;
  writeToStore(store, key, null);
};

/**
 * ✅ 新增：清理所有對話緩存（激進清理）
 * 用於手動釋放 localStorage 空間
 */
export const clearAllConversationCaches = () => {
  const storage = getStorage();
  if (!storage) {
    console.log('[conversationCache] localStorage 不可用，無需清理');
    return;
  }

  try {
    let removedCount = 0;
    const keysToRemove = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        // 清理所有對話相關緩存
        const shouldRemove =
          key.startsWith('history::') ||
          key.startsWith('pending::') ||
          key.startsWith('chat-list-hidden-threads:');

        if (shouldRemove) {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      try {
        storage.removeItem(key);
        removedCount++;
      } catch (e) {
        console.error('[conversationCache] 清理緩存失敗:', key, e);
      }
    }

    // 清理內存緩存
    memoryHistoryStore.clear();
    memoryPendingStore.clear();

    console.log(`[conversationCache] 清理完成，已移除 ${removedCount} 個緩存項`);
    return removedCount;
  } catch (error) {
    console.error('[conversationCache] 清理所有緩存失敗:', error);
    return 0;
  }
};

/**
 * ✅ 新增：估算 localStorage 使用量
 * 返回值以 KB 為單位
 */
export const estimateLocalStorageUsage = () => {
  const storage = getStorage();
  if (!storage) {
    return { total: 0, conversation: 0, other: 0 };
  }

  let totalBytes = 0;
  let conversationBytes = 0;

  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        const value = storage.getItem(key);
        const bytes = (key.length + (value?.length || 0)) * 2; // UTF-16 每字符 2 bytes

        totalBytes += bytes;

        // 統計對話相關緩存
        const isConversation =
          key.startsWith('history::') ||
          key.startsWith('pending::') ||
          key.startsWith('chat-list-hidden-threads:');

        if (isConversation) {
          conversationBytes += bytes;
        }
      }
    }

    return {
      total: Math.round(totalBytes / 1024), // KB
      conversation: Math.round(conversationBytes / 1024), // KB
      other: Math.round((totalBytes - conversationBytes) / 1024), // KB
    };
  } catch (error) {
    console.error('[conversationCache] 估算 localStorage 使用量失敗:', error);
    return { total: 0, conversation: 0, other: 0 };
  }
};

/**
 * ✅ 新增：檢查 localStorage 使用情況並預防性清理
 * 當對話緩存超過指定閾值時自動清理
 * @param {number} thresholdKB - 閾值（KB），預設 2048 (2MB)
 */
export const checkAndCleanIfNeeded = (thresholdKB = 2048) => {
  const usage = estimateLocalStorageUsage();

  console.log(
    `[conversationCache] localStorage 使用情況: 總計 ${usage.total}KB, 對話 ${usage.conversation}KB, 其他 ${usage.other}KB`
  );

  if (usage.conversation > thresholdKB) {
    console.warn(
      `[conversationCache] 對話緩存超過閾值 ${thresholdKB}KB，開始預防性清理...`
    );
    const removed = clearAllConversationCaches();
    console.log(`[conversationCache] 預防性清理完成，釋放了 ${removed} 個緩存項`);
    return true;
  }

  return false;
};
