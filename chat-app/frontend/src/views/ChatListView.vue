<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useUserProfile } from "../composables/useUserProfile";
import { useFirebaseAuth } from "../composables/useFirebaseAuth";
import { usePaginatedConversations } from "../composables/usePaginatedConversations";
import { useInfiniteScroll } from "../composables/useInfiniteScroll";
import { fallbackMatches } from "../utils/matchFallback";
import { apiJson } from "../utils/api";

const router = useRouter();
const { user, setUserProfile } = useUserProfile();
const firebaseAuth = useFirebaseAuth();

// 分頁對話列表
const userId = computed(() => user.value?.id);
const {
  conversations: paginatedConversations,
  hasMore: hasMoreConversations,
  isLoading: isLoadingConversations,
  isLoadingMore: isLoadingMoreConversations,
  loadInitial,
  loadMore: loadMoreConversations,
  reload: reloadConversations,
} = usePaginatedConversations(userId, 20);

// 無限滾動
const { containerRef } = useInfiniteScroll(loadMoreConversations, {
  threshold: 200,
  enabled: true,
});

const activeTab = ref("all");
const isFavoriteTab = computed(() => activeTab.value === "favorite");

const DEFAULT_TIMES = ["14:26", "13:58", "11:42", "09:15"];
const FALLBACK_PREVIEW = "願上帝憐憫你的心靈～(溫柔的微笑)";

const favoriteMatches = ref([]);
let favoriteRequestToken = 0;
const favoriteMutations = reactive({});
const deleteMutations = reactive({});
const actionMessage = reactive({
  text: "",
  tone: "",
});
let actionMessageTimer = 0;
const deleteConfirm = reactive({
  open: false,
  threadId: "",
  displayName: "",
  lastMessage: "",
  timeLabel: "",
});
const HIDDEN_THREADS_STORAGE_KEY = "chat-list-hidden-threads";
const hiddenThreads = reactive(new Map());

const SWIPE_ACTION_WIDTH = 140;
const SWIPE_TRIGGER_THRESHOLD = 48;
const SWIPE_MAX_RIGHT_OFFSET = 22;
const swipeOffsets = reactive({});
const swipeMeta = reactive({
  activeId: null,
  startX: 0,
  pointerId: null,
  dragging: false,
});
const shouldBlockThreadClick = ref(false);
let lastVisibleThreadsKey = "";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getSwipeOffset = (id) => swipeOffsets[id] ?? 0;

const isSwiping = (id) => swipeMeta.dragging && swipeMeta.activeId === id;

const ensureSwipeEntry = (id) => {
  if (typeof swipeOffsets[id] !== "number") {
    swipeOffsets[id] = 0;
  }
};

const closeAllSwipes = () => {
  Object.keys(swipeOffsets).forEach((key) => {
    if (swipeOffsets[key] !== 0) {
      swipeOffsets[key] = 0;
    }
  });
  shouldBlockThreadClick.value = false;
};

const closeOtherSwipes = (id) => {
  Object.keys(swipeOffsets).forEach((key) => {
    if (key !== id && swipeOffsets[key] !== 0) {
      swipeOffsets[key] = 0;
    }
  });
};

const resetSwipeMeta = () => {
  swipeMeta.activeId = null;
  swipeMeta.startX = 0;
  swipeMeta.pointerId = null;
  swipeMeta.dragging = false;
};

const normalizeId = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

const resolveHiddenThreadsKey = (ownerId = user.value?.id) => {
  const raw =
    typeof ownerId === "string" && ownerId.trim().length ? ownerId.trim() : "";
  return raw.length
    ? `${HIDDEN_THREADS_STORAGE_KEY}:${raw}`
    : `${HIDDEN_THREADS_STORAGE_KEY}:guest`;
};

const isThreadHidden = (id) => {
  if (typeof id !== "string") return false;
  return hiddenThreads.has(id);
};

const persistHiddenThreads = () => {
  if (typeof window === "undefined") return;
  try {
    const payload = Array.from(hiddenThreads.entries()).map(([id, meta]) => ({
      id,
      lastMessage:
        typeof meta?.lastMessage === "string" ? meta.lastMessage : "",
      timeLabel: typeof meta?.timeLabel === "string" ? meta.timeLabel : "",
      timestamp:
        typeof meta?.timestamp === "number" ? meta.timestamp : Date.now(),
    }));
    window.localStorage.setItem(
      resolveHiddenThreadsKey(),
      JSON.stringify(payload)
    );
  } catch {
    // 儲存失敗時靜默處理
  }
};

const loadHiddenThreads = (ownerId) => {
  if (typeof window === "undefined") return;
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
          typeof entry?.lastMessage === "string" ? entry.lastMessage : "",
        timeLabel: typeof entry?.timeLabel === "string" ? entry.timeLabel : "",
        timestamp:
          typeof entry?.timestamp === "number" ? entry.timestamp : Date.now(),
      });
    });
  } catch {
    // 載入失敗時靜默處理
  }
};

const registerHiddenThread = (id, meta = {}) => {
  const threadId = normalizeId(id);
  if (!threadId) return;
  hiddenThreads.set(threadId, {
    lastMessage: typeof meta?.lastMessage === "string" ? meta.lastMessage : "",
    timeLabel: typeof meta?.timeLabel === "string" ? meta.timeLabel : "",
    timestamp: Date.now(),
  });
  persistHiddenThreads();
};

const unregisterHiddenThread = (id) => {
  const threadId = normalizeId(id);
  if (!threadId || !hiddenThreads.has(threadId)) return;
  hiddenThreads.delete(threadId);
  persistHiddenThreads();
};

if (typeof window !== "undefined") {
  loadHiddenThreads(user.value?.id);
}

let lastHiddenOwnerId = normalizeId(user.value?.id ?? "");

const isFavoriteMutating = (id) => {
  if (!id) return false;
  return Boolean(favoriteMutations[id]);
};

const setFavoriteMutating = (id, value) => {
  if (!id) return;
  if (value) {
    favoriteMutations[id] = true;
  } else {
    delete favoriteMutations[id];
  }
};

const isDeletingThread = (id) => {
  if (!id) return false;
  return Boolean(deleteMutations[id]);
};

const setDeletingThread = (id, value) => {
  if (!id) return;
  if (value) {
    deleteMutations[id] = true;
  } else {
    delete deleteMutations[id];
  }
};

const clearActionMessageTimer = () => {
  if (actionMessageTimer) {
    if (typeof window !== "undefined") {
      window.clearTimeout(actionMessageTimer);
    }
    actionMessageTimer = 0;
  }
};

const showActionMessage = (text, tone = "info") => {
  const content = typeof text === "string" ? text.trim() : "";
  if (!content) {
    actionMessage.text = "";
    actionMessage.tone = "";
    clearActionMessageTimer();
    return;
  }

  actionMessage.text = content;
  actionMessage.tone = tone;
  clearActionMessageTimer();

  if (typeof window !== "undefined") {
    actionMessageTimer = window.setTimeout(() => {
      actionMessage.text = "";
      actionMessage.tone = "";
      actionMessageTimer = 0;
    }, 800);
  }
};

onBeforeUnmount(() => {
  clearActionMessageTimer();
});

const clearDeleteConfirmState = () => {
  deleteConfirm.open = false;
  deleteConfirm.threadId = "";
  deleteConfirm.displayName = "";
  deleteConfirm.lastMessage = "";
  deleteConfirm.timeLabel = "";
};

const truncatePreview = (text, maxLength = 15) => {
  if (typeof text !== "string") {
    return "";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const normalizeThread = (source, index = 0) => {
  const safeIndex = Number.isFinite(index) ? index : 0;

  if (!source || typeof source !== "object") {
    return null;
  }

  const character = source.character ?? source;

  const id =
    typeof source.conversationId === "string" && source.conversationId.trim()
      ? source.conversationId.trim()
      : typeof source.characterId === "string" && source.characterId.trim()
      ? source.characterId.trim()
      : typeof source.matchId === "string" && source.matchId.trim()
      ? source.matchId.trim()
      : typeof source.id === "string" && source.id.trim()
      ? source.id.trim()
      : typeof character.id === "string" && character.id.trim()
      ? character.id.trim()
      : "";

  if (!id) {
    return null;
  }

  const portrait =
    typeof character.portraitUrl === "string" && character.portraitUrl.trim()
      ? character.portraitUrl
      : typeof character.avatar === "string" && character.avatar.trim()
      ? character.avatar
      : "/ai-role/match-role-01.webp";

  const displayName =
    typeof character.display_name === "string" && character.display_name.trim()
      ? character.display_name.trim()
      : typeof character.name === "string" && character.name.trim()
      ? character.name.trim()
      : "神聖的艾米莉雅";

  const lastMessage =
    typeof source.lastMessage === "string" && source.lastMessage.trim()
      ? source.lastMessage.trim()
      : typeof source.partnerLastMessage === "string" &&
        source.partnerLastMessage.trim()
      ? source.partnerLastMessage.trim()
      : typeof source.preview === "string" && source.preview.trim()
      ? source.preview.trim()
      : typeof source.last_message === "string" && source.last_message.trim()
      ? source.last_message.trim()
      : typeof character.first_message === "string" &&
        character.first_message.trim()
      ? character.first_message.trim()
      : FALLBACK_PREVIEW;

  const updatedAt =
    typeof source.partnerLastRepliedAt === "string" &&
    source.partnerLastRepliedAt.trim()
      ? source.partnerLastRepliedAt
      : typeof source.updatedAt === "string" && source.updatedAt.trim()
      ? source.updatedAt
      : typeof source.lastMessageAt === "string" && source.lastMessageAt.trim()
      ? source.lastMessageAt
      : null;

  const isFavorite = Boolean(source.isFavorite ?? source.favorite);

  const timeLabel = (() => {
    if (updatedAt) {
      try {
        const date = new Date(updatedAt);
        if (!Number.isNaN(date.getTime())) {
          const now = new Date();
          const isSameDay =
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();
          const hours = `${date.getHours()}`.padStart(2, "0");
          const minutes = `${date.getMinutes()}`.padStart(2, "0");
          if (isSameDay) {
            return `${hours}:${minutes}`;
          }
          const month = `${date.getMonth() + 1}`.padStart(2, "0");
          const day = `${date.getDate()}`.padStart(2, "0");
          return `${month}/${day}`;
        }
      } catch {
        // 日期解析失敗時使用預設時間
      }
    }
    return DEFAULT_TIMES[safeIndex % DEFAULT_TIMES.length];
  })();

  return {
    id,
    displayName,
    portrait,
    lastMessage,
    timeLabel,
    isFavorite,
  };
};

const favoriteIds = computed(() => {
  const favorites = Array.isArray(user.value?.favorites)
    ? user.value.favorites
    : [];
  const seen = new Set();
  const normalized = [];

  for (const value of favorites) {
    const id = normalizeId(value);
    if (id && !seen.has(id)) {
      seen.add(id);
      normalized.push(id);
    }
  }

  return normalized;
});

const availableMatches = computed(() => {
  const list = [];
  const seen = new Set();

  const append = (match) => {
    if (!match || typeof match !== "object") {
      return;
    }
    const id = normalizeId(match.id);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    list.push(match);
  };

  favoriteMatches.value.forEach(append);

  if (Array.isArray(fallbackMatches)) {
    fallbackMatches.forEach(append);
  }

  return list;
});

const matchLookup = computed(() => {
  const map = new Map();
  availableMatches.value.forEach((match) => {
    const id = normalizeId(match?.id);
    if (id && !map.has(id)) {
      map.set(id, match);
    }
  });
  return map;
});

watch(
  [() => user.value?.id, () => favoriteIds.value.join("|")],
  async ([nextUserId]) => {
    const normalizedUserId = normalizeId(nextUserId ?? "");
    if (normalizedUserId !== lastHiddenOwnerId) {
      lastHiddenOwnerId = normalizedUserId;
      loadHiddenThreads(nextUserId);
    }
    const token = ++favoriteRequestToken;

    if (!nextUserId || favoriteIds.value.length === 0) {
      favoriteMatches.value = [];
      return;
    }

    try {
      const response = await apiJson(
        `/api/users/${encodeURIComponent(
          nextUserId
        )}/favorites?include=matches`,
        { skipGlobalLoading: true }
      );

      if (favoriteRequestToken !== token) {
        return;
      }

      const matches = Array.isArray(response?.matches) ? response.matches : [];
      favoriteMatches.value = matches;
    } catch (error) {
      if (favoriteRequestToken !== token) {
        return;
      }

      favoriteMatches.value = [];
    }
  },
  { immediate: true }
);

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

const conversationThreads = computed(() => {
  const conversations = paginatedConversations.value || [];
  const favoritesSet = new Set(favoriteIds.value);

  if (!conversations.length) {
    return [];
  }

  const normalized = conversations
    .map((entry, index) => {
      if (typeof entry === "string") {
        const match = matchLookup.value.get(entry);
        if (match) {
          return normalizeThread(
            {
              ...match,
              matchId: entry,
              conversationId: entry,
              isFavorite: favoritesSet.has(entry),
            },
            index
          );
        }
        return normalizeThread(
          {
            id: entry,
            matchId: entry,
            conversationId: entry,
            isFavorite: favoritesSet.has(entry),
          },
          index
        );
      }
      if (entry && typeof entry === "object") {
        const identifier =
          (typeof entry.characterId === "string" && entry.characterId.trim()) ||
          (typeof entry.conversationId === "string" &&
            entry.conversationId.trim()) ||
          (typeof entry.matchId === "string" && entry.matchId.trim()) ||
          (typeof entry.id === "string" && entry.id.trim()) ||
          "";
        const match =
          identifier && matchLookup.value.size
            ? matchLookup.value.get(identifier)
            : null;
        if (match) {
          return normalizeThread(
            {
              ...entry,
              matchId: identifier,
              character: {
                ...match,
                ...(entry.character ?? {}),
              },
              isFavorite: favoritesSet.has(identifier) || entry.isFavorite,
            },
            index
          );
        }
        return normalizeThread(
          {
            ...entry,
            matchId: identifier || entry.matchId,
            isFavorite: favoritesSet.has(identifier) || entry.isFavorite,
          },
          index
        );
      }
      return null;
    })
    .filter(Boolean);

  if (!normalized.length) {
    return [];
  }

  return normalized.map((thread) => ({
    ...thread,
    isFavorite: favoritesSet.has(thread.id) || thread.isFavorite,
  }));
});

const favoriteThreads = computed(() => {
  const favorites = favoriteIds.value;
  const threads = conversationThreads.value;
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  const result = [];
  const processed = new Set();

  favorites.forEach((favoriteId, index) => {
    const existingThread = byId.get(favoriteId);
    if (existingThread) {
      result.push({ ...existingThread, isFavorite: true });
      processed.add(favoriteId);
      return;
    }

    const match = matchLookup.value.get(favoriteId);

    const fallbackThread = normalizeThread(
      match
        ? {
            id: favoriteId,
            matchId: favoriteId,
            conversationId: favoriteId,
            character: match,
            lastMessage: match.first_message,
            isFavorite: true,
          }
        : {
            id: favoriteId,
            matchId: favoriteId,
            conversationId: favoriteId,
            character: {
              id: favoriteId,
              display_name: "收藏角色",
              name: "收藏角色",
              portraitUrl: "/ai-role/match-role-01.webp",
              avatar: "/ai-role/match-role-01.webp",
              first_message: FALLBACK_PREVIEW,
            },
            lastMessage: FALLBACK_PREVIEW,
            isFavorite: true,
          },
      index
    );

    if (fallbackThread) {
      result.push({ ...fallbackThread, isFavorite: true });
      processed.add(favoriteId);
    }
  });

  threads.forEach((thread) => {
    if (thread.isFavorite && !processed.has(thread.id)) {
      result.push({ ...thread, isFavorite: true });
      processed.add(thread.id);
    }
  });

  return result;
});

const filterHiddenThreads = (threads) =>
  threads.filter((thread) => !isThreadHidden(thread?.id));

const visibleThreads = computed(() => {
  const base = isFavoriteTab.value
    ? favoriteThreads.value
    : conversationThreads.value;
  return filterHiddenThreads(base);
});

watch(activeTab, () => {
  closeAllSwipes();
  if (deleteConfirm.open) {
    cancelDeleteAction();
  }
});

watch(visibleThreads, (threads) => {
  const idList = threads
    .map((thread) => thread?.id)
    .filter((id) => typeof id === "string" && id);
  const ids = new Set(idList);
  Object.keys(swipeOffsets).forEach((key) => {
    if (!ids.has(key)) {
      delete swipeOffsets[key];
    }
  });
  const fingerprint = idList.join("|");
  if (fingerprint !== lastVisibleThreadsKey) {
    closeAllSwipes();
  }
  lastVisibleThreadsKey = fingerprint;
});

watch(
  conversationThreads,
  (threads) => {
    if (!hiddenThreads.size) {
      return;
    }
    const byId = new Map();
    threads.forEach((thread) => {
      const id = normalizeId(thread?.id);
      if (id) {
        byId.set(id, thread);
      }
    });
    const restoreIds = [];
    hiddenThreads.forEach((meta, id) => {
      const thread = byId.get(id);
      if (!thread) {
        return;
      }
      const lastMessage =
        typeof thread.lastMessage === "string" ? thread.lastMessage : "";
      const timeLabel =
        typeof thread.timeLabel === "string" ? thread.timeLabel : "";
      if (
        (meta?.lastMessage ?? "") !== lastMessage ||
        (meta?.timeLabel ?? "") !== timeLabel
      ) {
        restoreIds.push(id);
      }
    });
    if (restoreIds.length) {
      restoreIds.forEach((id) => unregisterHiddenThread(id));
    }
  },
  { immediate: true }
);

const isEmpty = computed(() => visibleThreads.value.length === 0);

const selectTab = (tab) => {
  activeTab.value = tab;
};

const handleSwipeStart = (event, threadId) => {
  if (!threadId) {
    return;
  }

  shouldBlockThreadClick.value = false;
  ensureSwipeEntry(threadId);
  closeOtherSwipes(threadId);

  swipeMeta.activeId = threadId;
  const startX =
    typeof event.clientX === "number" ? event.clientX : swipeMeta.startX;
  swipeMeta.startX = startX;
  swipeMeta.pointerId =
    typeof event.pointerId === "number" ? event.pointerId : null;
  swipeMeta.dragging = true;

  const target = event.currentTarget;
  if (
    target &&
    typeof target.setPointerCapture === "function" &&
    swipeMeta.pointerId !== null
  ) {
    target.setPointerCapture(swipeMeta.pointerId);
  }
};

const handleSwipeMove = (event, threadId) => {
  if (!swipeMeta.dragging || swipeMeta.activeId !== threadId) {
    return;
  }

  const pointX =
    typeof event.clientX === "number" ? event.clientX : swipeMeta.startX;
  const delta = pointX - swipeMeta.startX;

  if (!shouldBlockThreadClick.value && Math.abs(delta) > 6) {
    shouldBlockThreadClick.value = true;
  }

  const offset = clamp(delta, -SWIPE_ACTION_WIDTH, SWIPE_MAX_RIGHT_OFFSET);
  swipeOffsets[threadId] = offset;

  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }
};

const handleSwipeEnd = (event, threadId) => {
  if (swipeMeta.activeId !== threadId) {
    return;
  }

  const pointX =
    typeof event.clientX === "number" ? event.clientX : swipeMeta.startX;
  const delta = pointX - swipeMeta.startX;
  const currentOffset = getSwipeOffset(threadId);
  const shouldOpen =
    delta < -SWIPE_TRIGGER_THRESHOLD ||
    currentOffset <= -SWIPE_TRIGGER_THRESHOLD;

  swipeOffsets[threadId] = shouldOpen ? -SWIPE_ACTION_WIDTH : 0;

  const target = event.currentTarget;
  if (
    target &&
    typeof target.releasePointerCapture === "function" &&
    swipeMeta.pointerId !== null
  ) {
    target.releasePointerCapture(swipeMeta.pointerId);
  }

  resetSwipeMeta();
};

const handleSwipeCancel = (event, threadId) => {
  if (swipeMeta.activeId !== threadId) {
    return;
  }

  swipeOffsets[threadId] = 0;

  const target = event.currentTarget;
  if (
    target &&
    typeof target.releasePointerCapture === "function" &&
    swipeMeta.pointerId !== null
  ) {
    target.releasePointerCapture(swipeMeta.pointerId);
  }

  resetSwipeMeta();
  shouldBlockThreadClick.value = false;
};

const handleFavoriteAction = async (thread) => {
  showActionMessage("");
  const threadId = normalizeId(thread?.id);
  if (!threadId) {
    return;
  }

  if (isFavoriteMutating(threadId)) {
    return;
  }

  const currentProfile = user.value;
  if (!currentProfile?.id) {
    showActionMessage("請登入後才能收藏角色。", "error");
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

  setUserProfile({
    ...(user.value ?? currentProfile),
    favorites: Array.from(optimisticSet),
  });

  let token;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (authError) {
    setUserProfile({
      ...(user.value ?? currentProfile),
      favorites: previousFavorites,
    });
    const message =
      authError instanceof Error
        ? authError.message
        : "取得登入資訊時發生錯誤，請重新登入後再試。";
    showActionMessage(message, "error");
    setFavoriteMutating(threadId, false);
    return;
  }

  try {
    const endpoint = wasFavorited
      ? `/api/users/${encodeURIComponent(
          currentProfile.id
        )}/favorites/${encodeURIComponent(threadId)}`
      : `/api/users/${encodeURIComponent(currentProfile.id)}/favorites`;

    const response = await apiJson(endpoint, {
      method: wasFavorited ? "DELETE" : "POST",
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
      wasFavorited ? "已取消收藏對話。" : "已加入收藏對話。",
      "success"
    );
  } catch (requestError) {
    setUserProfile({
      ...(user.value ?? currentProfile),
      favorites: previousFavorites,
    });
    const message =
      requestError instanceof Error
        ? requestError.message
        : "更新收藏時發生錯誤，請稍後再試。";
    showActionMessage(message, "error");
  } finally {
    setFavoriteMutating(threadId, false);
  }
};

const requestDeleteAction = (thread) => {
  showActionMessage("");
  const threadId = normalizeId(thread?.id);
  if (!threadId) {
    return;
  }

  if (isDeletingThread(threadId)) {
    return;
  }

  if (isThreadHidden(threadId)) {
    showActionMessage("對話已隱藏，紀錄依然保留。", "info");
    return;
  }

  deleteConfirm.threadId = threadId;
  deleteConfirm.displayName = normalizeId(thread?.displayName) || "這則對話";
  deleteConfirm.lastMessage =
    typeof thread?.lastMessage === "string" ? thread.lastMessage : "";
  deleteConfirm.timeLabel =
    typeof thread?.timeLabel === "string" ? thread.timeLabel : "";
  deleteConfirm.open = true;
};

const cancelDeleteAction = () => {
  if (isDeletingThread(deleteConfirm.threadId)) {
    return;
  }
  clearDeleteConfirmState();
};

const confirmDeleteAction = () => {
  const threadId = deleteConfirm.threadId;
  if (!threadId) {
    clearDeleteConfirmState();
    return;
  }

  showActionMessage("");

  if (isFavoriteMutating(threadId)) {
    return;
  }

  const threads = conversationThreads.value;
  const targetThread = threads.find((thread) => thread.id === threadId) ?? null;

  registerHiddenThread(threadId, {
    lastMessage: targetThread?.lastMessage ?? deleteConfirm.lastMessage ?? "",
    timeLabel: targetThread?.timeLabel ?? deleteConfirm.timeLabel ?? "",
  });

  delete swipeOffsets[threadId];
  if (swipeMeta.activeId === threadId) {
    resetSwipeMeta();
  }
  clearDeleteConfirmState();
  closeAllSwipes();
  showActionMessage("已隱藏對話，紀錄會保留。", "success");
};

const handleThreadSelect = (thread) => {
  if (shouldBlockThreadClick.value) {
    shouldBlockThreadClick.value = false;
    return;
  }

  if (!thread?.id) return;

  if (getSwipeOffset(thread.id) < 0) {
    closeAllSwipes();
    return;
  }

  closeAllSwipes();
  router.push({
    name: "chat",
    params: { id: thread.id },
  });
};
</script>

<template>
  <main class="chat-list-page">
    <div class="chat-list-backdrop" aria-hidden="true" />

    <header class="chat-list-header">
      <h1 class="chat-list-title">訊息</h1>
      <nav class="chat-list-tabs" role="tablist" aria-label="聊天分類">
        <button
          type="button"
          class="chat-list-tab"
          :class="{ 'is-active': !isFavoriteTab }"
          role="tab"
          :aria-selected="!isFavoriteTab"
          aria-controls="chat-thread-all"
          @click="selectTab('all')"
        >
          聊天
        </button>
        <button
          type="button"
          class="chat-list-tab"
          :class="{ 'is-active': isFavoriteTab }"
          role="tab"
          :aria-selected="isFavoriteTab"
          aria-controls="chat-thread-favorite"
          @click="selectTab('favorite')"
        >
          喜歡
        </button>
      </nav>
    </header>

    <p
      v-if="actionMessage.text"
      :class="[
        'chat-list-banner',
        {
          'is-error': actionMessage.tone === 'error',
          'is-success': actionMessage.tone === 'success',
        },
      ]"
      :role="actionMessage.tone === 'error' ? 'alert' : 'status'"
      :aria-live="actionMessage.tone === 'error' ? 'assertive' : 'polite'"
    >
      {{ actionMessage.text }}
    </p>

    <section
      v-if="!isEmpty"
      :id="isFavoriteTab ? 'chat-thread-favorite' : 'chat-thread-all'"
      :ref="!isFavoriteTab ? containerRef : undefined"
      class="chat-thread-scroll chat-thread-list"
      role="list"
    >
      <!-- 載入更多指示器（顯示在頂部） -->
      <div
        v-if="isLoadingMoreConversations && !isFavoriteTab"
        class="chat-list-loading"
      >
        <div class="chat-list-loading__spinner"></div>
        <p>載入更多對話...</p>
      </div>
      <article
        v-for="thread in visibleThreads"
        :key="thread.id"
        class="chat-thread"
        :class="{
          'chat-thread--active': getSwipeOffset(thread.id) < 0,
          'chat-thread--dragging': isSwiping(thread.id),
        }"
        role="listitem"
        @pointerdown="handleSwipeStart($event, thread.id)"
        @pointermove="handleSwipeMove($event, thread.id)"
        @pointerup="handleSwipeEnd($event, thread.id)"
        @pointercancel="handleSwipeCancel($event, thread.id)"
        @click="handleThreadSelect(thread)"
      >
        <div
          class="chat-thread__content"
          :style="{
            '--chat-thread-offset': `${getSwipeOffset(thread.id)}px`,
          }"
        >
          <div class="chat-thread__avatar">
            <img :src="thread.portrait" :alt="`${thread.displayName} 的頭像`" />
          </div>
          <div class="chat-thread__body">
            <header class="chat-thread__header">
              <h2>{{ thread.displayName }}</h2>
              <time :dateTime="thread.timeLabel">{{ thread.timeLabel }}</time>
            </header>
            <p class="chat-thread__preview">
              {{ truncatePreview(thread.lastMessage) }}
            </p>
          </div>
        </div>
        <div
          class="chat-thread__actions"
          :style="{
            transform: `translate3d(${
              SWIPE_ACTION_WIDTH + getSwipeOffset(thread.id)
            }px, 0, 0)`,
          }"
          aria-hidden="true"
        >
          <div class="chat-thread__actions-inner">
            <button
              type="button"
              :class="[
                'chat-thread__action',
                'chat-thread__action--favorite',
                { 'is-active': thread.isFavorite },
              ]"
              aria-label="收藏對話"
              :aria-pressed="thread.isFavorite ? 'true' : 'false'"
              :aria-busy="
                isFavoriteMutating(thread.id) ||
                (!isFavoriteTab && isDeletingThread(thread.id))
                  ? 'true'
                  : 'false'
              "
              :disabled="
                isFavoriteMutating(thread.id) ||
                (!isFavoriteTab && isDeletingThread(thread.id))
              "
              @pointerdown.stop
              @click.stop="handleFavoriteAction(thread)"
            >
              <svg
                class="chat-thread__icon"
                viewBox="0 0 24 24"
                focusable="false"
                aria-hidden="true"
              >
                <path
                  v-if="thread.isFavorite"
                  d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"
                  fill="currentColor"
                />
                <path
                  v-else
                  d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <button
              v-if="!isFavoriteTab"
              type="button"
              class="chat-thread__action chat-thread__action--delete"
              aria-label="隱藏對話"
              :aria-busy="isDeletingThread(thread.id) ? 'true' : 'false'"
              :disabled="
                isDeletingThread(thread.id) || isFavoriteMutating(thread.id)
              "
              @pointerdown.stop
              @click.stop="requestDeleteAction(thread)"
            >
              <svg
                class="chat-thread__icon"
                viewBox="0 0 24 24"
                focusable="false"
                aria-hidden="true"
              >
                <path
                  d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3.46-6.88a.75.75 0 0 1 1.06.02L12 13.59l1.48-1.45a.75.75 0 0 1 1.04 1.08L13.09 14.5l1.43 1.47a.75.75 0 0 1-1.08 1.04L12 15.56l-1.44 1.45a.75.75 0 0 1-1.07-1.05l1.44-1.47-1.39-1.35a.75.75 0 0 1-.02-1.02zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"
                />
              </svg>
            </button>
          </div>
        </div>
      </article>
    </section>

    <section
      v-else-if="isLoadingConversations && !isFavoriteTab"
      :id="isFavoriteTab ? 'chat-thread-favorite' : 'chat-thread-all'"
      class="chat-thread-scroll chat-thread-empty"
      aria-live="polite"
    >
      <div class="chat-list-loading">
        <div class="chat-list-loading__spinner"></div>
        <p>載入對話列表...</p>
      </div>
    </section>

    <section
      v-else
      :id="isFavoriteTab ? 'chat-thread-favorite' : 'chat-thread-all'"
      class="chat-thread-scroll chat-thread-empty"
      aria-live="polite"
    >
      <p>目前沒有聊天紀錄，試著從配對開始新的對話吧。</p>
    </section>

    <div
      v-if="deleteConfirm.open"
      class="chat-list-dialog-backdrop"
      aria-hidden="true"
      @click="cancelDeleteAction"
    />
    <section
      v-if="deleteConfirm.open"
      class="chat-list-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-delete-title"
    >
      <h2 id="chat-delete-title" class="chat-list-dialog__title">隱藏對話</h2>
      <p class="chat-list-dialog__message">
        確定要隱藏
        <strong>{{ deleteConfirm.displayName }}</strong>
        嗎？對話紀錄會保留，隨時都能重新開啟。
      </p>
      <div class="chat-list-dialog__actions">
        <button
          type="button"
          class="chat-list-dialog__btn chat-list-dialog__btn--secondary"
          :disabled="isDeletingThread(deleteConfirm.threadId)"
          @click="cancelDeleteAction"
        >
          取消
        </button>
        <button
          type="button"
          class="chat-list-dialog__btn chat-list-dialog__btn--danger"
          :disabled="
            isDeletingThread(deleteConfirm.threadId) ||
            isFavoriteMutating(deleteConfirm.threadId)
          "
          @click="confirmDeleteAction"
        >
          確認隱藏
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.chat-list-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: clamp(1.6rem, 6vw, 2.2rem) clamp(1.1rem, 5vw, 2rem)
    calc(var(--bottom-nav-offset, 4rem) + 2.5rem);
  background: linear-gradient(180deg, rgba(13, 14, 20, 0.96), #050507 65%);
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
}

.chat-list-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
      circle at 20% 0%,
      rgba(255, 122, 184, 0.18),
      transparent 55%
    ),
    radial-gradient(circle at 80% 0%, rgba(86, 139, 255, 0.12), transparent 60%),
    radial-gradient(
      circle at 50% 85%,
      rgba(255, 77, 143, 0.12),
      transparent 70%
    );
  opacity: 0.9;
  z-index: 0;
}

.chat-list-header {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  margin-bottom: 1.25rem;
}

.chat-list-title {
  margin: 0;
  font-size: clamp(1.4rem, 5vw, 1.75rem);
  letter-spacing: 0.08em;
  color: #ffffff;
}

.chat-list-tabs {
  display: inline-flex;
  align-items: center;
  gap: clamp(1.4rem, 6vw, 2.4rem);
}

.chat-list-tab {
  position: relative;
  border: none;
  background: none;
  padding: 0;
  font-size: clamp(1rem, 4vw, 1.1rem);
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.65);
  cursor: pointer;
  transition: color 160ms ease;
}

.chat-list-tab::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -0.9rem;
  width: 0;
  height: 3px;
  border-radius: 999px;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  opacity: 0;
  transition: width 200ms ease, opacity 200ms ease;
}

.chat-list-tab.is-active {
  color: #ffffff;
}

.chat-list-tab.is-active::after {
  width: clamp(40px, 10vw, 60px);
  opacity: 1;
}

.chat-list-banner {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  font-size: clamp(0.88rem, 3.2vw, 1rem);
  letter-spacing: 0.03em;
  padding: 0.55rem 0.92rem;
  border-radius: 14px;
  background: rgba(18, 21, 34, 0.92);
  box-shadow: 0 16px 40px rgba(5, 6, 10, 0.4);
  color: rgba(226, 232, 240, 0.96);
  pointer-events: none;
  z-index: 32;
  max-width: min(80vw, 320px);
  text-align: center;
}

.chat-list-banner.is-success {
  color: rgba(134, 239, 172, 0.96);
  text-shadow: 0 0 18px rgba(134, 239, 172, 0.42);
}

.chat-list-banner.is-error {
  color: rgba(248, 113, 113, 0.96);
  text-shadow: 0 0 18px rgba(248, 113, 113, 0.4);
}

.chat-list-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 16, 0.72);
  backdrop-filter: blur(2px);
  z-index: 36;
}

.chat-list-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(88vw, 320px);
  padding: 1.2rem 1.4rem;
  border-radius: 18px;
  background: rgba(15, 17, 28, 0.95);
  box-shadow: 0 28px 64px rgba(5, 6, 10, 0.55);
  z-index: 38;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  text-align: center;
}

.chat-list-dialog__title {
  margin: 0;
  font-size: clamp(1.02rem, 4vw, 1.14rem);
  letter-spacing: 0.08em;
  color: #ffffff;
}

.chat-list-dialog__message {
  margin: 0;
  font-size: clamp(0.9rem, 3vw, 0.98rem);
  color: rgba(226, 232, 240, 0.86);
  line-height: 1.55;
}

.chat-list-dialog__message strong {
  color: #ffffff;
}

.chat-list-dialog__actions {
  display: flex;
  justify-content: center;
  gap: 0.85rem;
  margin-top: 0.3rem;
}

.chat-list-dialog__btn {
  min-width: 110px;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  border: none;
  font-size: clamp(0.88rem, 3vw, 0.96rem);
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease,
    background-color 160ms ease, color 160ms ease;
}

.chat-list-dialog__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.chat-list-dialog__btn:not(:disabled):focus-visible,
.chat-list-dialog__btn:not(:disabled):hover {
  transform: translateY(-1px);
}

.chat-list-dialog__btn--secondary {
  background: rgba(30, 34, 48, 0.92);
  color: rgba(209, 213, 219, 0.92);
  box-shadow: 0 10px 26px rgba(7, 9, 14, 0.35);
}

.chat-list-dialog__btn--secondary:not(:disabled):focus-visible,
.chat-list-dialog__btn--secondary:not(:disabled):hover {
  background: rgba(42, 46, 64, 0.96);
}

.chat-list-dialog__btn--danger {
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  color: #ffffff;
  box-shadow: 0 14px 32px rgba(255, 122, 184, 0.38);
}

.chat-list-dialog__btn--danger:not(:disabled):focus-visible,
.chat-list-dialog__btn--danger:not(:disabled):hover {
  background: linear-gradient(135deg, #ff3f82, #ff6fae);
}

.chat-list-tab:focus-visible {
  outline: none;
  color: #ffffff;
}

.chat-thread-scroll {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  margin-top: clamp(1.5rem, 6vw, 2rem);
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-right: 0.25rem;
}

.chat-thread-list {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  height: 42rem;
}

.chat-thread {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  touch-action: pan-y;
}

.chat-thread__content {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  padding: 0.85rem 1rem;
  border-radius: 18px 0 0 18px;
  background: linear-gradient(
    135deg,
    rgba(20, 22, 36, 0.88) 0%,
    rgba(15, 17, 28, 0.82) 100%
  );
  box-shadow: 0 8px 24px rgba(5, 6, 10, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease,
    background 160ms ease, box-shadow 160ms ease;
  transform: translate3d(
    var(--chat-thread-offset, 0),
    var(--chat-thread-hover, 0),
    0
  );
  will-change: transform;
}

.chat-thread:hover .chat-thread__content {
  --chat-thread-hover: -2px;
  background: linear-gradient(
    135deg,
    rgba(25, 27, 42, 0.92) 0%,
    rgba(18, 20, 32, 0.88) 100%
  );
  border-color: rgba(255, 122, 184, 0.15);
  box-shadow: 0 12px 32px rgba(5, 6, 10, 0.5),
    0 0 20px rgba(255, 122, 184, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.chat-thread:active .chat-thread__content {
  --chat-thread-hover: 0;
}

.chat-thread--dragging .chat-thread__content {
  transition: border-color 160ms ease, background 160ms ease,
    box-shadow 160ms ease;
}

.chat-thread__actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(20, 22, 36, 0.88) 0%,
    rgba(15, 17, 28, 0.82) 100%
  );
  pointer-events: none;
  will-change: transform;
}

.chat-thread__actions-inner {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.chat-thread__action {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: none;
  background: transparent;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.85);
  transition: color 160ms ease, transform 160ms ease,
    background-color 160ms ease;
  pointer-events: auto;
  cursor: pointer;
}

.chat-thread__action:focus-visible,
.chat-thread__action:hover {
  outline: none;
  background-color: rgba(30, 32, 44, 0.95);
  color: rgba(255, 122, 184, 0.95);
  transform: translateY(-1px);
}

.chat-thread__action--favorite {
  color: rgba(255, 214, 94, 0.9);
}

.chat-thread__action--favorite.is-active {
  color: rgba(255, 214, 94, 1);
}

.chat-thread__action[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.chat-thread__action--delete {
  color: rgba(248, 113, 113, 0.9);
}

.chat-thread__action--delete:focus-visible,
.chat-thread__action--delete:hover {
  color: rgba(248, 100, 116, 0.95);
}

.chat-thread__icon {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.chat-thread__avatar {
  width: clamp(52px, 16vw, 62px);
  height: clamp(52px, 16vw, 62px);
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 18px rgba(5, 6, 10, 0.45);
  margin-right: 1rem;
}

.chat-thread__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.chat-thread__body {
  display: flex;
  flex-direction: column;
  grid-column: 2;
  grid-row: 1;
  gap: 0.5rem;
}

.chat-thread__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.chat-thread__header h2 {
  margin: 0;
  font-size: clamp(1.02rem, 4vw, 1.1rem);
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.92);
}

.chat-thread__header time {
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.75);
}

.chat-thread__preview {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  letter-spacing: 0.04em;
  color: rgba(148, 163, 184, 0.95);
  display: block;
  width: 100%;
  grid-column: 1 / -1;
  grid-row: 2;
}

.chat-thread-empty {
  margin-top: clamp(3rem, 10vw, 4rem);
  padding: 2rem 1.5rem;
  border-radius: 20px;
  border: 1px dashed rgba(148, 163, 184, 0.75);
  background: rgba(15, 17, 28, 0.6);
  text-align: center;
  color: rgba(148, 163, 184, 0.85);
  letter-spacing: 0.06em;
  font-size: 0.95rem;
}

.chat-list-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  color: rgba(148, 163, 184, 0.85);
  font-size: 0.9rem;
}

.chat-list-loading__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(148, 163, 184, 0.2);
  border-top-color: #ff4d8f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chat-list-loading p {
  margin: 0;
  letter-spacing: 0.05em;
}

@media (min-width: 768px) {
  .chat-list-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-inline: clamp(2rem, 12vw, 3.5rem);
  }

  .chat-thread-scroll {
    width: min(600px, 100%);
    align-self: center;
  }
}
</style>
