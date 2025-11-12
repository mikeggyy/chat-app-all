<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import {
  ChatBubbleBottomCenterTextIcon,
  InformationCircleIcon,
  XMarkIcon,
  HeartIcon as HeartOutline,
} from "@heroicons/vue/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/vue/24/solid";
import { apiJson } from "../utils/api";
import { fallbackMatches } from "../utils/matchFallback";
import { useUserProfile } from "../composables/useUserProfile";
import { useFirebaseAuth } from "../composables/useFirebaseAuth";
import { useGuestGuard } from "../composables/useGuestGuard";
import { apiCache, cacheKeys, cacheTTL } from "../services/apiCache.service";

const router = useRouter();
const { user, loadUserProfile, setUserProfile } = useUserProfile();
const firebaseAuth = useFirebaseAuth();
const { requireLogin } = useGuestGuard();
const isLoading = ref(false);
const error = ref("");
const conversationError = ref("");
const favoriteIds = ref(new Set());
const favoriteMutating = ref(false);
const favoriteError = ref("");
const favoriteRequestState = reactive({
  loading: false,
  lastUserId: "",
});
const matches = ref([]);
const currentIndex = ref(0);
const swipeOffset = ref(0);
const swipeActive = ref(false);
const swipeStartX = ref(0);
const swipeStartY = ref(0);
const isAnimating = ref(false);
const carouselContainer = ref(null);
const cardWidth = ref(0);
const swipeThreshold = 80;
const interactiveElementSelector =
  "button, [role='button'], a, input, textarea, select, label";
let resetTimerId;
let activePointerId = null;
let activePointerTarget = null;

const BIO_MAX_LENGTH = 50;

const match = reactive({
  id: "",
  display_name: "",
  locale: "",
  creatorUid: "",
  creatorDisplayName: "",
  gender: "",
  background: "",
  first_message: "",
  secret_background: "",
  portraitUrl: "",
});

const backgroundDialog = reactive({
  open: false,
  title: "",
  text: "",
});

const formatBackground = (text) => {
  if (typeof text !== "string") return "";
  const normalized = text.trim();
  if (normalized.length <= BIO_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, BIO_MAX_LENGTH)}...`;
};

const openBackgroundDialog = (title, text) => {
  if (typeof text !== "string") return;
  const content = text.trim();
  if (!content) return;

  backgroundDialog.title =
    typeof title === "string" && title.trim().length
      ? `${title.trim()}・角色背景`
      : "角色背景";
  backgroundDialog.text = content;
  backgroundDialog.open = true;
};

const closeBackgroundDialog = () => {
  backgroundDialog.open = false;
};

const syncFavoriteSet = (favorites) => {
  const list = Array.isArray(favorites) ? favorites : [];
  favoriteIds.value = new Set(list);
};

let lastLoadedUserId = "";

const fetchFavoritesForCurrentUser = async (options = {}) => {
  const targetProfile = user.value;
  const targetUserId = targetProfile?.id;
  if (!targetUserId) {
    return;
  }

  if (favoriteRequestState.loading) {
    return;
  }

  favoriteRequestState.loading = true;

  let headers = {};
  try {
    const token = await firebaseAuth.getCurrentUserIdToken();
    headers = {
      Authorization: `Bearer ${token}`,
    };
  } catch (tokenError) {
    const currentProfile = user.value;
    const profileMismatch =
      !currentProfile?.id || currentProfile.id !== targetUserId;

    if (profileMismatch) {
      favoriteRequestState.loading = false;
      return;
    }

    const expectedUnauthenticated =
      (tokenError instanceof Error &&
        tokenError.message.includes("尚未登入")) ||
      (typeof tokenError?.code === "string" &&
        tokenError.code.includes("auth/"));

    if (!expectedUnauthenticated && import.meta.env.DEV) {
    }
  }

  try {
    const response = await apiJson(
      `/api/users/${encodeURIComponent(targetUserId)}/favorites`,
      {
        method: "GET",
        headers: Object.keys(headers).length ? headers : undefined,
        skipGlobalLoading: options.skipGlobalLoading ?? true,
      }
    );

    const favorites = Array.isArray(response?.favorites)
      ? response.favorites
      : [];

    const currentProfile = user.value;
    if (currentProfile?.id !== targetUserId) {
      return;
    }

    const existingFavorites = Array.isArray(currentProfile.favorites)
      ? currentProfile.favorites
      : [];

    const isSameFavorites =
      existingFavorites.length === favorites.length &&
      existingFavorites.every((value, index) => value === favorites[index]);

    favoriteRequestState.lastUserId = targetUserId;

    syncFavoriteSet(favorites);

    if (!isSameFavorites) {
      setUserProfile({
        ...currentProfile,
        favorites,
      });
    }
  } catch (err) {
    if (err?.status === 404) {
      favoriteRequestState.lastUserId = targetUserId;
      syncFavoriteSet([]);
      const currentProfile = user.value;
      if (currentProfile?.id === targetUserId) {
        setUserProfile({
          ...currentProfile,
          favorites: [],
        });
      }
      return;
    }
    if (import.meta.env.DEV) {
    }
  } finally {
    favoriteRequestState.loading = false;
  }
};

const handleKeydown = (event) => {
  if (event.key === "Escape" && backgroundDialog.open) {
    closeBackgroundDialog();
  }
};

const isFavorited = computed(() => favoriteIds.value.has(match.id));

const carouselMatches = computed(() => {
  const list = matches.value;
  const len = list.length;
  if (!len) return [];

  const wrapIndex = (offset) => (currentIndex.value + offset + len) % len;
  const build = (offset, slot) => {
    const idx = wrapIndex(offset);
    const data = list[idx];
    return {
      slot,
      index: idx,
      data,
      key: `${data?.id ?? "match"}-${slot}-${currentIndex.value}`,
    };
  };

  if (len === 1) {
    return [build(0, "current")];
  }

  if (len === 2) {
    return [build(-1, "prev"), build(0, "current"), build(1, "next")];
  }

  return [build(-1, "prev"), build(0, "current"), build(1, "next")];
});

const translateValue = computed(() => {
  const hasLoop = carouselMatches.value.length > 1;
  const base = hasLoop ? "-100%" : "0px";
  const offset = `${swipeOffset.value}px`;
  return hasLoop ? `calc(${base} + ${offset})` : offset;
});

const trackStyle = computed(() => ({
  transform: `translateX(${translateValue.value})`,
  transition: isAnimating.value ? "transform 0.22s ease-out" : "none",
}));

const backgroundTrackStyle = computed(() => ({
  transform: `translateX(${translateValue.value})`,
  transition: isAnimating.value ? "transform 0.28s ease-out" : "none",
}));

const measureCardWidth = () => {
  cardWidth.value = carouselContainer.value?.offsetWidth ?? 0;
};

const clearAnimationTimer = () => {
  if (resetTimerId) {
    clearTimeout(resetTimerId);
    resetTimerId = undefined;
  }
};

const capturePointer = (event) => {
  if (!(event instanceof PointerEvent)) return;
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  try {
    target.setPointerCapture(event.pointerId);
    activePointerId = event.pointerId;
    activePointerTarget = target;
  } catch {
    activePointerId = null;
    activePointerTarget = null;
  }
};

const releaseCapturedPointer = (event) => {
  const pointerId =
    event instanceof PointerEvent ? event.pointerId : activePointerId;
  const target =
    event instanceof PointerEvent && event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : activePointerTarget;

  if (pointerId == null || !target) {
    activePointerId = null;
    activePointerTarget = null;
    return;
  }

  try {
    target.releasePointerCapture(pointerId);
  } catch {
    // 忽略無法釋放的例外
  } finally {
    if (activePointerId === pointerId) {
      activePointerId = null;
      activePointerTarget = null;
    }
  }
};

const scheduleReset = () => {
  clearAnimationTimer();
  isAnimating.value = true;
  swipeOffset.value = 0;
  resetTimerId = window.setTimeout(() => {
    isAnimating.value = false;
    resetTimerId = undefined;
  }, 220);
};

const applyMatchData = (data) => {
  if (!data) return;

  Object.assign(match, {
    id: data.id ?? "",
    display_name: data.display_name ?? "",
    locale: data.locale ?? "",
    creatorUid:
      data.creatorUid ??
      data.creator_uid ??
      (typeof data.creator === "string" ? data.creator : ""),
    creatorDisplayName:
      data.creatorDisplayName ??
      data.creator_display_name ??
      (typeof data.creator === "string" ? data.creator : ""),
    gender: data.gender ?? "",
    background: data.background ?? "",
    first_message: data.first_message ?? "",
    secret_background: data.secret_background ?? "",
    portraitUrl: data.portraitUrl ?? "",
  });
};

const showMatchByIndex = (index) => {
  if (!matches.value.length) return;
  const normalized = (index + matches.value.length) % matches.value.length;
  currentIndex.value = normalized;
  applyMatchData(matches.value[normalized]);
};

const goToNext = () => {
  if (!matches.value.length) return;
  showMatchByIndex(currentIndex.value + 1);
};

const goToPrevious = () => {
  if (!matches.value.length) return;
  showMatchByIndex(currentIndex.value - 1);
};

const animateTo = (direction) => {
  clearAnimationTimer();
  if (!cardWidth.value) {
    measureCardWidth();
  }

  const width =
    cardWidth.value ||
    carouselContainer.value?.offsetWidth ||
    window.innerWidth ||
    1;

  isAnimating.value = true;
  swipeOffset.value = direction === "next" ? -width : width;

  resetTimerId = window.setTimeout(() => {
    if (direction === "next") {
      showMatchByIndex(currentIndex.value + 1);
    } else {
      showMatchByIndex(currentIndex.value - 1);
    }

    isAnimating.value = false;
    swipeOffset.value = 0;
  }, 220);
};

const readPoint = (event) => {
  if ("touches" in event && event.touches.length) return event.touches[0];
  if ("changedTouches" in event && event.changedTouches.length)
    return event.changedTouches[0];
  return event;
};

const onSwipeStart = (event) => {
  if (
    event instanceof PointerEvent &&
    event.pointerType === "mouse" &&
    event.button !== 0
  ) {
    return;
  }

  const target = event.target;
  if (
    target instanceof Element &&
    (target.closest(".actions") ||
      target.closest(".bio-card-header") ||
      target.closest(interactiveElementSelector))
  ) {
    return;
  }

  if (event instanceof PointerEvent && event.cancelable) {
    event.preventDefault();
  }

  measureCardWidth();

  capturePointer(event);

  const point = readPoint(event);
  swipeActive.value = true;
  swipeStartX.value = point.clientX;
  swipeStartY.value = point.clientY;
  swipeOffset.value = 0;
  isAnimating.value = false;
};

const onSwipeMove = (event) => {
  if (!swipeActive.value) return;
  const point = readPoint(event);
  const offsetX = point.clientX - swipeStartX.value;
  const offsetY = Math.abs(point.clientY - swipeStartY.value);

  if (offsetY > 90) {
    onSwipeCancel();
    return;
  }

  swipeOffset.value = offsetX;
};

const onSwipeEnd = (event) => {
  if (!swipeActive.value) return;
  releaseCapturedPointer(event);
  const point = readPoint(event);
  const diffX = point.clientX - swipeStartX.value;
  const diffY = Math.abs(point.clientY - swipeStartY.value);
  swipeActive.value = false;

  if (Math.abs(diffX) > swipeThreshold && diffY < 90) {
    animateTo(diffX < 0 ? "next" : "prev");
  } else {
    scheduleReset();
  }
};

const onSwipeCancel = (event) => {
  releaseCapturedPointer(event);
  if (!swipeActive.value) return;
  swipeActive.value = false;
  scheduleReset();
};

const toggleFavorite = async () => {
  favoriteError.value = "";

  if (favoriteMutating.value || !match.id) {
    return;
  }

  // 檢查是否為遊客
  if (requireLogin({ feature: "收藏角色" })) {
    return;
  }

  const currentProfile = user.value;
  if (!currentProfile?.id) {
    favoriteError.value = "請登入後才能收藏角色。";
    return;
  }

  let token;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (authError) {
    favoriteError.value =
      authError instanceof Error
        ? authError.message
        : "取得登入資訊時發生錯誤，請重新登入後再試。";
    return;
  }

  favoriteMutating.value = true;
  const targetId = match.id;
  const wasFavorited = favoriteIds.value.has(targetId);
  const previousSet = new Set(favoriteIds.value);
  const optimisticSet = new Set(previousSet);

  if (wasFavorited) {
    optimisticSet.delete(targetId);
  } else {
    optimisticSet.add(targetId);
  }

  favoriteIds.value = optimisticSet;

  try {
    const endpoint = wasFavorited
      ? `/api/users/${encodeURIComponent(
          currentProfile.id
        )}/favorites/${encodeURIComponent(targetId)}`
      : `/api/users/${encodeURIComponent(currentProfile.id)}/favorites`;

    const response = await apiJson(endpoint, {
      method: wasFavorited ? "DELETE" : "POST",
      body: wasFavorited ? undefined : { matchId: targetId },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      skipGlobalLoading: true,
    });

    const favoritesList = Array.isArray(response?.favorites)
      ? response.favorites
      : [];

    favoriteIds.value = new Set(favoritesList);
    setUserProfile({
      ...currentProfile,
      favorites: favoritesList,
    });
  } catch (requestError) {
    favoriteIds.value = previousSet;
    favoriteError.value =
      requestError instanceof Error
        ? requestError.message
        : "更新收藏時發生錯誤，請稍後再試。";
    if (import.meta.env.DEV) {
    }
  } finally {
    favoriteMutating.value = false;
  }
};

const loadMatches = async () => {
  isLoading.value = true;
  error.value = "";

  try {
    const currentUserId = user.value?.id;
    const endpoint = currentUserId
      ? `/match/all?userId=${encodeURIComponent(currentUserId)}`
      : "/match/all";

    // 使用 API 緩存服務，5 分鐘緩存
    const data = await apiCache.fetch(
      cacheKeys.matches({ userId: currentUserId || 'guest' }),
      () => apiJson(endpoint, { skipGlobalLoading: true }),
      cacheTTL.MATCHES
    );

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("尚未建立配對角色資料");
    }

    matches.value = data;
    measureCardWidth();
    showMatchByIndex(0);
  } catch (err) {
    const fallbackData = Array.isArray(fallbackMatches)
      ? fallbackMatches.map((item) => ({ ...item }))
      : [];

    if (fallbackData.length) {
      matches.value = fallbackData;
      measureCardWidth();
      showMatchByIndex(0);
      error.value = "暫時無法連線至配對服務，已載入示範角色資料。";
      if (import.meta.env.DEV) {
        console.error('載入匹配列表失敗:', err);
      }
    } else {
      matches.value = [];
      error.value =
        err instanceof Error ? err.message : "取得配對資料時發生錯誤";
    }
  } finally {
    isLoading.value = false;
  }
};

// Watch for favorites changes
watch(
  () => user.value?.favorites,
  (next) => {
    syncFavoriteSet(next);
  },
  { immediate: true }
);

// Watch for user ID changes and load matches
watch(
  () => user.value?.id,
  async (nextId, prevId) => {
    // 如果沒有用戶 ID（遊客模式）
    if (!nextId) {
      lastLoadedUserId = "";
      favoriteRequestState.lastUserId = "";
      syncFavoriteSet([]);
      loadMatches();
      return;
    }

    // 如果 userId 沒變，不需要重新加載
    if (nextId === prevId && nextId === lastLoadedUserId) {
      return;
    }

    favoriteError.value = "";

    // 新用戶 - 並行執行所有請求以提升性能
    if (nextId !== lastLoadedUserId) {
      lastLoadedUserId = nextId;

      // 使用 Promise.allSettled 並行執行所有請求
      // allSettled 確保即使某個請求失敗，其他請求仍會繼續執行
      const [profileResult, favoritesResult, matchesResult] = await Promise.allSettled([
        loadUserProfile(nextId, { skipGlobalLoading: true }),
        favoriteRequestState.lastUserId !== nextId
          ? fetchFavoritesForCurrentUser({ skipGlobalLoading: true })
          : Promise.resolve(),
        loadMatches()
      ]);

      // 記錄開發環境中的錯誤
      if (import.meta.env.DEV) {
        if (profileResult.status === 'rejected') {
          console.warn('載入用戶資料失敗:', profileResult.reason);
        }
        if (favoritesResult.status === 'rejected') {
          console.warn('載入收藏列表失敗:', favoritesResult.reason);
        }
        if (matchesResult.status === 'rejected') {
          console.warn('載入匹配列表失敗:', matchesResult.reason);
        }
      }

      return;
    }

    // 用戶 ID 相同，只需檢查收藏列表是否需要更新
    if (favoriteRequestState.lastUserId !== nextId) {
      await fetchFavoritesForCurrentUser({ skipGlobalLoading: true });
    }
  },
  { immediate: true }
);

const enterChatRoom = () => {
  conversationError.value = "";

  if (!match.id) {
    return;
  }

  const currentProfile = user.value;
  if (!currentProfile?.id) {
    conversationError.value = "請登入後才能開始對話。";
    return;
  }

  // 直接跳轉到聊天視窗，對話記錄將在 ChatView 中處理
  router.push({
    name: "chat",
    params: { id: match.id },
  });
};

onMounted(() => {
  measureCardWidth();
  window.addEventListener("resize", measureCardWidth);
  window.addEventListener("keydown", handleKeydown);
  // ⚠️ 不在這裡調用 fetchFavoritesForCurrentUser 和 loadMatches
  // 因為 watch(user.value?.id) 已經會自動執行（immediate: true）
});

onBeforeUnmount(() => {
  clearAnimationTimer();
  releaseCapturedPointer();
  window.removeEventListener("resize", measureCardWidth);
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <main
    class="match-page"
    :class="{ 'is-grabbing': swipeActive }"
    @pointerdown="onSwipeStart"
    @pointermove="onSwipeMove"
    @pointerup="onSwipeEnd"
    @pointercancel="onSwipeCancel"
    @pointerleave="onSwipeCancel"
  >
    <div class="background-wrapper">
      <div class="background-track" :style="backgroundTrackStyle">
        <div
          v-for="item in carouselMatches"
          :key="`bg-${item.key}`"
          class="background-slide"
        >
          <img :src="item.data?.portraitUrl" alt="" aria-hidden="true" />
          <div class="gradient"></div>
        </div>
      </div>
    </div>

    <div class="content-wrapper" ref="carouselContainer">
      <div class="carousel-track" :style="trackStyle">
        <section
          v-for="item in carouselMatches"
          :key="item.key"
          class="content"
          :class="{ 'is-active': item.data?.id === match.id }"
        >
          <header>
            <div v-if="item.data?.display_name" class="header-title">
              <h1>{{ item.data.display_name }}</h1>
              <button
                v-if="item.data?.id === match.id"
                type="button"
                class="btn-favorite-icon"
                @click="toggleFavorite"
                :disabled="favoriteMutating"
                :aria-label="isFavorited ? '取消收藏' : '加入收藏'"
              >
                <HeartSolid
                  v-if="isFavorited"
                  class="icon"
                  aria-hidden="true"
                />
                <HeartOutline v-else class="icon" aria-hidden="true" />
              </button>
            </div>
            <p v-if="item.data?.id === match.id && error" class="error-banner">
              {{ error }}
            </p>
          </header>

          <section v-if="item.data?.background" class="bio-card">
            <div class="bio-card-header">
              <h2>角色背景</h2>
              <button
                type="button"
                class="bio-info-btn"
                aria-label="檢視完整角色背景"
                @click.stop="
                  openBackgroundDialog(
                    item.data?.display_name,
                    item.data.background
                  )
                "
              >
                <InformationCircleIcon class="icon" aria-hidden="true" />
              </button>
            </div>
            <p>{{ formatBackground(item.data.background) }}</p>
          </section>

          <div v-if="item.data?.id === match.id" class="actions single">
            <button
              type="button"
              class="btn primary"
              @click="enterChatRoom"
              :disabled="isLoading"
            >
              <ChatBubbleBottomCenterTextIcon class="icon" aria-hidden="true" />
              <span>{{ isLoading ? "尋找配對中…" : "進入聊天室" }}</span>
            </button>
            <p v-if="favoriteError" class="action-error">
              {{ favoriteError }}
            </p>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="backgroundDialog.open"
        class="bio-dialog-backdrop"
        @click="closeBackgroundDialog"
      >
        <div
          class="bio-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="backgroundDialog.title"
          @click.stop
        >
          <header class="bio-dialog-header">
            <h3>{{ backgroundDialog.title }}</h3>
            <button
              type="button"
              class="bio-dialog-close"
              aria-label="關閉視窗"
              @click="closeBackgroundDialog"
            >
              <XMarkIcon class="icon" aria-hidden="true" />
            </button>
          </header>
          <p class="bio-dialog-body">
            {{ backgroundDialog.text }}
          </p>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped lang="scss">
.match-page {
  position: relative;
  min-height: calc(100vh - var(--bottom-nav-offset, 0px));
  min-height: calc(100dvh - var(--bottom-nav-offset, 0px));
  display: flex;
  justify-content: center;
  align-items: flex-end;
  color: #f8fafc;
  overflow: hidden;
  touch-action: pan-y;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;

  &.is-grabbing {
    cursor: grabbing;
  }

  .background-wrapper {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;

    .background-track {
      display: flex;
      height: 100%;
      will-change: transform;

      .background-slide {
        position: relative;
        flex: 0 0 100%;
        height: 100%;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .gradient {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(15, 23, 42, 0.25) 45%,
            rgba(15, 23, 42, 0.75) 100%
          );
        }
      }
    }
  }

  .content-wrapper {
    position: relative;
    width: min(520px, 100%);
    overflow: hidden;

    .carousel-track {
      display: flex;
      width: 100%;

      .content {
        position: relative;
        z-index: 1;
        flex: 0 0 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 2rem;
        opacity: 0.4;
        transition: opacity 0.22s ease;
        padding: 2rem 1.5rem 3rem;

        &.is-active {
          opacity: 1;
        }

        header {
          .label {
            font-size: 1rem;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            color: rgba(226, 232, 240, 0.75);
            margin-bottom: 0.5rem;
          }

          .header-title {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          h1 {
            font-size: 2.8rem;
            margin: 0;
            font-weight: 600;
          }
        }

        .error-banner {
          margin-top: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          background: rgba(248, 113, 113, 0.2);
          border: 1px solid rgba(248, 113, 113, 0.4);
          color: #fecaca;
          font-size: 0.95rem;
          max-width: 360px;
        }

        .action-error {
          grid-column: 1 / -1;
          margin: 0.35rem 0 0;
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          color: #fecaca;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;

          &.compact {
            max-width: 360px;
          }

          &.single {
            grid-template-columns: 1fr;
            max-width: 360px;
          }
        }

        .bio-card {
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 24px;
          padding: 1.5rem 1.75rem;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.35);
          backdrop-filter: blur(20px);
          color: #e2e8f0;

          .bio-card-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0 0 0.75rem;

            h2 {
              margin: 0;
              font-size: 1.25rem;
              letter-spacing: 0.08em;
            }
          }

          .bio-info-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.5);
            background: rgba(15, 23, 42, 0.4);
            color: #e2e8f0;
            padding: 0;
            cursor: pointer;
            transition: background 150ms ease, border-color 150ms ease,
              transform 150ms ease;

            &:hover {
              background: rgba(148, 163, 184, 0.25);
              border-color: rgba(226, 232, 240, 0.7);
              transform: translateY(-1px);
            }

            .icon {
              width: 18px;
              height: 18px;
            }
          }

          p {
            margin: 0;
            line-height: 1.7;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            max-height: calc(1.7em * 2);
          }
        }

        @media (max-width: 540px) {
          gap: 1.75rem;

          header {
            .header-title {
              gap: 0.5rem;
            }

            h1 {
              font-size: 2.2rem;
            }
          }

          .actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));

            &.compact {
              max-width: none;
            }

            &.single {
              max-width: none;
            }
          }

          .bio-card {
            padding: 1.25rem 1.5rem;

            .bio-info-btn {
              width: 32px;
              height: 32px;
            }
          }
        }
      }
    }
  }
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
  will-change: transform;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
  }

  &.favorite {
    background: rgba(248, 250, 252, 0.35);
    color: #fdf2f8;
    border: 1px solid rgba(248, 250, 252, 0.3);

    &:not(:disabled):hover {
      background: rgba(248, 250, 252, 0.25);
    }
  }

  &.primary {
    background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
    color: #fff;
    box-shadow: 0 12px 28px rgba(255, 77, 143, 0.35);

    &:not(:disabled):hover {
      box-shadow: 0 16px 36px rgba(255, 77, 143, 0.45);
    }
  }

  @media (max-width: 540px) {
    font-size: 0.95rem;
  }
}

.icon {
  width: 20px;
  height: 20px;
}

.btn-favorite-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: none;
  background: rgba(248, 250, 252, 0.15);
  color: #fdf2f8;
  padding: 0;
  cursor: pointer;
  transition: transform 150ms ease, background 150ms ease;
  flex-shrink: 0;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
    background: rgba(248, 250, 252, 0.25);
  }

  .icon {
    width: 22px;
    height: 22px;
  }

  @media (max-width: 540px) {
    width: 38px;
    height: 38px;

    .icon {
      width: 20px;
      height: 20px;
    }
  }
}

.bio-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 2000;

  .bio-dialog {
    width: min(520px, 100%);
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(15, 23, 42, 0.97);
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.5);
    padding: 2rem;
    color: #e2e8f0;

    .bio-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 0 0 1.25rem;

      h3 {
        margin: 0;
        font-size: 1.15rem;
        letter-spacing: 0.08em;
      }

      .bio-dialog-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.5);
        background: rgba(15, 23, 42, 0.4);
        color: #e2e8f0;
        padding: 0;
        cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease;

        &:hover {
          background: rgba(148, 163, 184, 0.28);
          border-color: rgba(226, 232, 240, 0.65);
        }

        .icon {
          width: 20px;
          height: 20px;
        }
      }
    }

    .bio-dialog-body {
      margin: 0;
      line-height: 1.8;
      white-space: pre-wrap;
    }

    @media (max-width: 540px) {
      padding: 1.75rem 1.5rem;
    }
  }
}
</style>
