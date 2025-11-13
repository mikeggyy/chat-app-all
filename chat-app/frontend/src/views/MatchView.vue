<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  ChatBubbleBottomCenterTextIcon,
  InformationCircleIcon,
  XMarkIcon,
  HeartIcon as HeartOutline,
} from '@heroicons/vue/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/vue/24/solid';
import { useUserProfile } from '../composables/useUserProfile';
import { useFirebaseAuth } from '../composables/useFirebaseAuth';
import { useGuestGuard } from '../composables/useGuestGuard';
import { useMatchCarousel } from '../composables/match/useMatchCarousel';
import { useMatchGestures } from '../composables/match/useMatchGestures';
import { useMatchFavorites } from '../composables/match/useMatchFavorites';
import { useMatchData } from '../composables/match/useMatchData';
import LazyImage from '../components/common/LazyImage.vue';
import { logger } from '../utils/logger';

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

const isFavorited = computed(() => favorites.isFavorited(match.id));

// 背景對話框
const BIO_MAX_LENGTH = 50;

const backgroundDialog = reactive({
  open: false,
  title: '',
  text: '',
});

const formatBackground = (text) => {
  if (typeof text !== 'string') return '';
  const normalized = text.trim();
  if (normalized.length <= BIO_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, BIO_MAX_LENGTH)}...`;
};

const openBackgroundDialog = (title, text) => {
  if (typeof text !== 'string') return;
  const content = text.trim();
  if (!content) return;

  backgroundDialog.title =
    typeof title === 'string' && title.trim().length
      ? `${title.trim()}・角色背景`
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
    <div class="background-wrapper">
      <div class="background-track" :style="carousel.backgroundTrackStyle.value">
        <div
          v-for="item in carousel.carouselMatches.value"
          :key="`bg-${item.key}`"
          class="background-slide"
        >
          <LazyImage
            :src="item.data?.portraitUrl || ''"
            alt=""
            :root-margin="'300px'"
            :threshold="0"
            image-class="character-portrait"
          />
          <div class="gradient"></div>
        </div>
      </div>
    </div>

    <div class="content-wrapper" ref="carouselContainerRef">
      <div class="carousel-track" :style="carousel.trackStyle.value">
        <section
          v-for="item in carousel.carouselMatches.value"
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
                @click="favorites.toggleFavorite(match.id)"
                :disabled="favorites.favoriteMutating.value"
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
              <span>{{ isLoading ? '尋找配對中…' : '進入聊天室' }}</span>
            </button>
            <p v-if="favorites.favoriteError.value" class="action-error">
              {{ favorites.favoriteError.value }}
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

        // 支持原生 img 和 LazyImage 組件
        img,
        .lazy-image {
          width: 100%;
          height: 100%;
        }

        img,
        .character-portrait {
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
