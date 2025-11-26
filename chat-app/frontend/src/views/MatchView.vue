<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserProfile } from '../composables/useUserProfile';
import { useFirebaseAuth } from '../composables/useFirebaseAuth';
import { useGuestGuard } from '../composables/useGuestGuard';
import { useMatchCarousel } from '../composables/match/useMatchCarousel';
import { useMatchGestures } from '../composables/match/useMatchGestures';
import { useMatchFavorites } from '../composables/match/useMatchFavorites';
import { useMatchData } from '../composables/match/useMatchData';
import { useToast } from '../composables/useToast';
import { useIsMounted } from '../composables/useIsMounted';
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

// ==================== 類型定義 ====================

interface Match {
  id: string;
  display_name: string;
  locale: string;
  creatorUid: string;
  creatorDisplayName: string;
  gender: string;
  background: string;
  first_message: string;
  secret_background: string;
  portraitUrl: string;
}

interface BackgroundDialog {
  open: boolean;
  title: string;
  text: string;
}

// ==================== 初始化 ====================

const router = useRouter();
const { user, loadUserProfile, setUserProfile } = useUserProfile();
const firebaseAuth = useFirebaseAuth();
const { requireLogin } = useGuestGuard();
const toast = useToast();

// ✅ 追蹤組件掛載狀態，防止快速路由切換時的競態條件
const isMounted = useIsMounted();

// 角色數據管理
const matchData = useMatchData({ user });
const { matches, isLoading, error } = matchData;

// ✅ 效能優化：使用 shallowRef 替代 reactive，減少深度追蹤開銷
// 當前顯示的角色數據
const match = shallowRef<Match>({
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

// 應用角色數據（原子更新，觸發一次 reactivity）
const applyMatchData = (data: any): void => {
  if (!data) return;

  // 創建新物件，觸發單次更新
  match.value = {
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
  };
};

// 輪播控制
const carousel = useMatchCarousel({
  matches,
  onIndexChange: (_index, matchData) => {
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

// ✅ 效能優化：使用 Set 進行 O(1) 查找，而非 O(n) 的 includes()
const favoriteIdSet = computed(() => new Set(favorites.favoriteIds.value));

// 當前角色是否已收藏
const isFavorited = computed(() => {
  return favoriteIdSet.value.has(match.value.id);
});

// 背景對話框
const backgroundDialog: BackgroundDialog = reactive<BackgroundDialog>({
  open: false,
  title: '',
  text: '',
});

const openBackgroundDialog = (displayName: string | null | undefined, text: string | null | undefined): void => {
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

const closeBackgroundDialog = (): void => {
  backgroundDialog.open = false;
};

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && backgroundDialog.open) {
    closeBackgroundDialog();
  }
};

// 處理收藏操作
const handleToggleFavorite = async (): Promise<void> => {
  const matchId = match.value.id;
  const matchName = match.value.display_name;
  const wasFavorited = favorites.favoriteIds.value.includes(matchId);

  const success = await favorites.toggleFavorite(matchId);

  if (success) {
    // 顯示提示消息（統一使用成功提示）
    if (wasFavorited) {
      toast.success(`已取消收藏 ${matchName}`, { duration: 1000 });
    } else {
      toast.success(`已收藏 ${matchName}`, { duration: 1000 });
    }
  }
};

// 進入聊天室
const enterChatRoom = (): void => {
  if (!match.value.id) {
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
    params: { id: match.value.id },
  });
};

// 用戶變更時的數據載入
let lastLoadedUserId: string = '';

watch(
  () => user.value?.id,
  async (nextId: string | undefined, prevId: string | undefined) => {
    // 如果沒有用戶 ID（遊客模式）
    if (!nextId) {
      lastLoadedUserId = '';
      favorites.favoriteRequestState.lastUserId = '';
      favorites.syncFavoriteSet([]);
      await matchData.loadMatches();

      // ✅ 檢查競態條件：如果組件已卸載或加載期間用戶已登入，忽略遊客數據
      if (!isMounted.value) {
        logger.warn('組件已卸載，忽略遊客數據載入');
        return;
      }

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

      // ✅ 檢查競態條件：如果組件已卸載或用戶已切換，忽略這些數據
      if (!isMounted.value) {
        logger.warn('組件已卸載，忽略數據載入');
        return;
      }

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
  (next: string[] | undefined) => {
    favorites.syncFavoriteSet(next ?? []);
  },
  { immediate: true }
);

// ✅ 效能優化：resize 事件節流（debounce），避免頻繁重排
let resizeTimeoutId: number | undefined;
const debouncedMeasureCardWidth = () => {
  if (resizeTimeoutId !== undefined) {
    clearTimeout(resizeTimeoutId);
  }
  resizeTimeoutId = window.setTimeout(() => {
    carousel.measureCardWidth();
    resizeTimeoutId = undefined;
  }, 150);
};

// 生命週期
onMounted(() => {
  carousel.measureCardWidth();
  window.addEventListener('resize', debouncedMeasureCardWidth);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', debouncedMeasureCardWidth);
  window.removeEventListener('keydown', handleKeydown);
  // 清理待處理的 debounce
  if (resizeTimeoutId !== undefined) {
    clearTimeout(resizeTimeoutId);
  }
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
      :is-image-loaded="carousel.isImageLoaded"
    />

    <!-- 內容輪播 -->
    <div class="content-wrapper" ref="carouselContainerRef">
      <div class="carousel-track" :style="carousel.trackStyle.value as any">
        <!-- ✅ 修復閃爍問題：使用穩定的 slot 作為 key，重用 DOM 元素 -->
        <MatchCard
          v-for="item in carousel.carouselMatches.value"
          :key="`card-${item.slot}`"
          :match="item.data"
          :is-active="item.data?.id === match.id"
          :is-favorited="item.data?.id === match.id && isFavorited"
          :favorite-mutating="favorites.favoriteMutating.value"
          :favorite-error="favorites.favoriteError.value"
          :is-loading="isLoading"
          :error="item.data?.id === match.id ? error : undefined"
          @toggle-favorite="handleToggleFavorite"
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
  // ✅ 效能優化：CSS containment 限制重排範圍
  contain: layout style;

  &.is-grabbing {
    cursor: grabbing;
  }

  .content-wrapper {
    position: relative;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    overflow: hidden;
    // ✅ 效能優化：限制重排範圍
    contain: layout;

    .carousel-track {
      display: flex;
      width: 100%;
      // ✅ 效能優化：提示 GPU 加速 transform
      will-change: transform;
    }
  }
}
</style>
