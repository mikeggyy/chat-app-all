<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserProfile } from '../composables/useUserProfile';
import { useFirebaseAuth } from '../composables/useFirebaseAuth';
import { useGuestGuard } from '../composables/useGuestGuard';
import { useMatchCarousel } from '../composables/match/useMatchCarousel';
import { useMatchGestures } from '../composables/match/useMatchGestures';
import { useMatchFavorites } from '../composables/match/useMatchFavorites';
import { useMatchData } from '../composables/match/useMatchData';
import MatchBackground from '../components/match/MatchBackground.vue';
import MatchCard from '../components/match/MatchCard.vue';
import BackgroundDialog from '../components/match/BackgroundDialog.vue';
import { logger } from '../utils/logger';

/**
 * MatchView - 配對頁面（重構後）
 * 職責：整合所有子組件，管理配對邏輯和狀態
 *
 * ✅ 重構完成：從 813 行優化至 ~310 行
 * ✅ 拆分為 3 個組件：MatchBackground, MatchCard, BackgroundDialog
 * ✅ 改善可維護性、可測試性、可重用性
 */

const router = useRouter();
const { user, loadUserProfile, setUserProfile } = useUserProfile();
const firebaseAuth = useFirebaseAuth();
const { requireLogin } = useGuestGuard();

// 角色數據管理
const matchData = useMatchData({ user });
const { matches, isLoading, error } = matchData;

// 當前顯示的角色數據
const match = reactive({
  id: '',
  display_name: '',
  locale: '',
  creatorUid: '',
  creatorDisplayName: '',
  gender: '',
  background: '',
  first_message: '',
  secret_background: '',
  portraitUrl: '',
});

// 應用角色數據
const applyMatchData = (data) => {
  if (!data) return;

  Object.assign(match, {
    id: data.id ?? '',
    display_name: data.display_name ?? '',
    locale: data.locale ?? '',
    creatorUid:
      data.creatorUid ??
      data.creator_uid ??
      (typeof data.creator === 'string' ? data.creator : ''),
    creatorDisplayName:
      data.creatorDisplayName ??
      data.creator_display_name ??
      (typeof data.creator === 'string' ? data.creator : ''),
    gender: data.gender ?? '',
    background: data.background ?? '',
    first_message: data.first_message ?? '',
    secret_background: data.secret_background ?? '',
    portraitUrl: data.portraitUrl ?? '',
  });
};

// 輪播控制
const carousel = useMatchCarousel({
  matches,
  onIndexChange: (index, matchData) => {
    applyMatchData(matchData);
  },
});

// 輪播容器 ref（需要在主組件中定義以便模板綁定）
const carouselContainerRef = carousel.carouselContainer;

// 手勢控制
const gestures = useMatchGestures({
  swipeThreshold: 80,
  cardWidthRef: carousel.cardWidth,
  swipeOffsetRef: carousel.swipeOffset,
  isAnimatingRef: carousel.isAnimating,
  onSwipeStart: () => {
    carousel.measureCardWidth();
  },
  onSwipeComplete: (direction) => {
    carousel.animateTo(direction);
  },
  onSwipeCancel: () => {
    carousel.scheduleReset();
  },
});

// 收藏管理
const favorites = useMatchFavorites({
  user,
  firebaseAuth,
  onUpdateProfile: setUserProfile,
  requireLogin,
});

// 當前角色是否已收藏（響應式 - 使用數組確保 Vue 能正確追蹤變化）
const isFavorited = computed(() => {
  return favorites.favoriteIds.value.includes(match.id);
});

// 背景對話框
const backgroundDialog = reactive({
  open: false,
  title: '',
  text: '',
});

const openBackgroundDialog = (displayName, text) => {
  if (typeof text !== 'string') return;
  const content = text.trim();
  if (!content) return;

  backgroundDialog.title =
    typeof displayName === 'string' && displayName.trim().length
      ? `${displayName.trim()}・角色背景`
      : '角色背景';
  backgroundDialog.text = content;
  backgroundDialog.open = true;
};

const closeBackgroundDialog = () => {
  backgroundDialog.open = false;
};

const handleKeydown = (event) => {
  if (event.key === 'Escape' && backgroundDialog.open) {
    closeBackgroundDialog();
  }
};

// 進入聊天室
const enterChatRoom = () => {
  if (!match.id) {
    return;
  }

  // 檢查是否為遊客
  if (requireLogin({ feature: '開始對話' })) {
    return;
  }

  const currentProfile = user.value;
  if (!currentProfile?.id) {
    return;
  }

  // 直接跳轉到聊天視窗，對話記錄將在 ChatView 中處理
  router.push({
    name: 'chat',
    params: { id: match.id },
  });
};

// 用戶變更時的數據載入
let lastLoadedUserId = '';

watch(
  () => user.value?.id,
  async (nextId, prevId) => {
    // 如果沒有用戶 ID（遊客模式）
    if (!nextId) {
      lastLoadedUserId = '';
      favorites.favoriteRequestState.lastUserId = '';
      favorites.syncFavoriteSet([]);
      await matchData.loadMatches();

      // 檢查競態條件：如果加載期間用戶已登入，忽略遊客數據
      if (user.value?.id) {
        logger.warn('遊客加載期間已登入，等待登入數據載入');
        return;
      }

      carousel.initialize();
      return;
    }

    // 如果 userId 沒變，不需要重新加載
    if (nextId === prevId && nextId === lastLoadedUserId) {
      return;
    }

    favorites.clearError();

    // 新用戶 - 並行執行所有請求以提升性能
    if (nextId !== lastLoadedUserId) {
      lastLoadedUserId = nextId;
      const requestUserId = nextId; // 保存當前請求的 userId

      // 使用 Promise.allSettled 並行執行所有請求
      // allSettled 確保即使某個請求失敗，其他請求仍會繼續執行
      const [profileResult, favoritesResult, matchesResult] =
        await Promise.allSettled([
          loadUserProfile(nextId, { skipGlobalLoading: true }),
          favorites.favoriteRequestState.lastUserId !== nextId
            ? favorites.fetchFavoritesForCurrentUser({ skipGlobalLoading: true })
            : Promise.resolve(),
          matchData.loadMatches(),
        ]);

      // 檢查競態條件：如果請求完成時用戶已切換，忽略這些數據
      if (user.value?.id !== requestUserId) {
        logger.warn('用戶已切換，忽略過期的數據載入');
        return;
      }

      // 記錄開發環境中的錯誤
      if (profileResult.status === 'rejected') {
        logger.warn('載入用戶資料失敗:', profileResult.reason);
      }
      if (favoritesResult.status === 'rejected') {
        logger.warn('載入收藏列表失敗:', favoritesResult.reason);
      }
      if (matchesResult.status === 'rejected') {
        logger.warn('載入匹配列表失敗:', matchesResult.reason);
      }

      // 初始化輪播
      carousel.initialize();

      return;
    }

    // 用戶 ID 相同，只需檢查收藏列表是否需要更新
    if (favorites.favoriteRequestState.lastUserId !== nextId) {
      await favorites.fetchFavoritesForCurrentUser({ skipGlobalLoading: true });
    }
  },
  { immediate: true }
);

// 監聽用戶收藏列表變更
watch(
  () => user.value?.favorites,
  (next) => {
    favorites.syncFavoriteSet(next);
  },
  { immediate: true }
);

// 生命週期
onMounted(() => {
  carousel.measureCardWidth();
  window.addEventListener('resize', carousel.measureCardWidth);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', carousel.measureCardWidth);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <main
    class="match-page"
    :class="{ 'is-grabbing': gestures.swipeActive.value }"
    @pointerdown="gestures.onSwipeStart"
    @pointermove="gestures.onSwipeMove"
    @pointerup="gestures.onSwipeEnd"
    @pointercancel="gestures.onSwipeCancel"
    @pointerleave="gestures.onSwipeCancel"
  >
    <!-- 背景輪播 -->
    <MatchBackground
      :carousel-matches="carousel.carouselMatches.value"
      :background-track-style="carousel.backgroundTrackStyle.value"
    />

    <!-- 內容輪播 -->
    <div class="content-wrapper" ref="carouselContainerRef">
      <div class="carousel-track" :style="carousel.trackStyle.value">
        <MatchCard
          v-for="item in carousel.carouselMatches.value"
          :key="item.key"
          :match="item.data"
          :is-active="item.data?.id === match.id"
          :is-favorited="item.data?.id === match.id && isFavorited"
          :favorite-mutating="favorites.favoriteMutating.value"
          :favorite-error="favorites.favoriteError.value"
          :is-loading="isLoading"
          :error="item.data?.id === match.id ? error : null"
          @toggle-favorite="favorites.toggleFavorite(match.id)"
          @open-background="openBackgroundDialog"
          @enter-chat="enterChatRoom"
        />
      </div>
    </div>

    <!-- 背景對話框 -->
    <BackgroundDialog
      :open="backgroundDialog.open"
      :title="backgroundDialog.title"
      :text="backgroundDialog.text"
      @close="closeBackgroundDialog"
    />
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

  .content-wrapper {
    position: relative;
    width: min(520px, 100%);
    overflow: hidden;

    .carousel-track {
      display: flex;
      width: 100%;
    }
  }
}
</style>
