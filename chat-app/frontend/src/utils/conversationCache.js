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

      // 嘗試清理舊的對話緩存
      try {
        const keysToRemove = [];
        for (let i = 0; i < store.length; i++) {
          const storageKey = store.key(i);
          if (storageKey && storageKey.startsWith('history::')) {
            keysToRemove.push(storageKey);
          }
        }

        // 只保留當前對話，移除其他對話緩存
        for (const oldKey of keysToRemove) {
          if (oldKey !== key) {
            store.removeItem(oldKey);
          }
        }

        // 再次嘗試存儲
        const sanitized = sanitizeForStorage(value);
        store.setItem(key, JSON.stringify(sanitized));
      } catch (retryError) {

        storageAvailable = false; // 禁用 localStorage，改用內存存儲
      }
    } else {
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
