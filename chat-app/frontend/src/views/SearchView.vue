<script setup>
import { useRouter } from "vue-router";
import { useUserProfile } from "../composables/useUserProfile";
import { useSearchLogic } from "../composables/search/useSearchLogic";
import { useRecentConversations } from "../composables/search/useRecentConversations";
import { usePopularRanking } from "../composables/search/usePopularRanking";
import { useRecordDetail } from "../composables/search/useRecordDetail";

// 組件
import SearchBar from "../components/search/SearchBar.vue";
import RecentConversationsPanel from "../components/search/RecentConversationsPanel.vue";
import PopularRankingPanel from "../components/search/PopularRankingPanel.vue";
import SearchResults from "../components/search/SearchResults.vue";
import RecordDetailPanel from "../components/search/RecordDetailPanel.vue";

const router = useRouter();
const { user } = useUserProfile();

// 搜尋邏輯
const {
  searchQuery,
  hasSubmittedQuery,
  displayedResults,
  isFallbackResult,
  handleSearch,
  resetSearch,
} = useSearchLogic();

// 最近對話
const { recentConversations, isLoadingRecent, recentlyViewed } =
  useRecentConversations(user);

// 人氣排行
const {
  popularCharacters,
  isLoadingPopular,
  popularHasMore,
  popularRanking,
  fetchPopularCharacters,
} = usePopularRanking();

// 記錄詳情面板
const {
  panel,
  recentRecordEntries,
  hasMoreRecords,
  isLoadingMoreRecords,
  recordsListRef,
  openRecentRecords,
  closeRecentRecords,
  handleRecordsScroll,
  openChatForEntry,
} = useRecordDetail(
  recentConversations,
  popularCharacters,
  popularHasMore,
  fetchPopularCharacters
);

// 打開聊天
const openChat = (profile) => {
  if (!profile?.matchId) return;
  router.push({ name: "chat", params: { id: profile.matchId } });
};
</script>

<template>
  <main class="search-page">
    <!-- 頁面標題與搜尋欄 -->
    <header class="page-header">
      <div>
        <p class="page-kicker">探索推薦</p>
        <h1>搜尋你心中的理想夥伴</h1>
      </div>
      <p class="page-subtitle">
        根據你的收藏、對話紀錄與當前趨勢，這裡整理出最適合開啟聊聊的角色組合。
      </p>
      <SearchBar v-model="searchQuery" @submit="handleSearch" />
    </header>

    <!-- 內容區域 -->
    <div class="scroll-container">
      <!-- 未搜尋時顯示推薦面板 -->
      <template v-if="!hasSubmittedQuery">
        <!-- 最近對話面板 -->
        <RecentConversationsPanel
          :conversations="recentlyViewed"
          :is-loading="isLoadingRecent"
          :show-empty="user?.id && recentConversations.length === 0"
          @open-panel="openRecentRecords"
          @character-click="openChat"
        />

        <!-- 人氣排行面板 -->
        <PopularRankingPanel
          :characters="popularRanking"
          :is-loading="isLoadingPopular"
          @open-panel="openRecentRecords"
          @character-click="openChat"
        />
      </template>

      <!-- 搜尋結果 -->
      <template v-else>
        <SearchResults
          :results="displayedResults"
          :query="searchQuery"
          :is-fallback="isFallbackResult"
          @reset="resetSearch"
          @result-click="openChat"
        />
      </template>
    </div>

    <!-- 記錄詳情面板（彈窗） -->
    <RecordDetailPanel
      :is-open="panel.isOpen.value"
      :panel-type="panel.currentType.value"
      :hero-image="panel.heroImage.value || panel.DEFAULT_HERO_FALLBACK"
      :badge-label="panel.badgeLabel.value || '重連精選'"
      :badge-icon="panel.badgeIcon.value"
      :description="panel.description.value"
      :records="recentRecordEntries"
      :has-more="hasMoreRecords"
      :is-loading="isLoadingMoreRecords"
      @close="closeRecentRecords"
      @scroll="handleRecordsScroll"
      @entry-click="openChatForEntry"
    />
  </main>
</template>

<style scoped lang="scss">
.search-page {
  position: relative;
  height: calc(100vh - var(--bottom-nav-offset, 0px));
  height: calc(100dvh - var(--bottom-nav-offset, 0px));
  background: radial-gradient(
      circle at top,
      rgba(30, 64, 175, 0.35),
      transparent
    ),
    radial-gradient(circle at bottom, rgba(236, 72, 153, 0.18), transparent),
    #020617;
  color: #e2e8f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(520px, 100%);
  margin: 0 auto;
  padding: clamp(1.75rem, 6vw, 2.5rem) clamp(1.25rem, 5vw, 2rem)
    clamp(0.9rem, 3vw, 1.4rem);

  h1 {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    letter-spacing: 0.02em;
    color: #f8fafc;
  }

  .page-kicker {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .page-subtitle {
    margin: 0;
    color: rgba(226, 232, 240, 0.6);
    font-size: 0.95rem;
    line-height: 1.6;
  }
}

.scroll-container {
  position: relative;
  z-index: 1;
  width: min(520px, 100%);
  flex: 1 1 auto;
  margin: 0 auto;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 4vw, 2.25rem);
  overflow-y: auto;
  scrollbar-width: thin;
}

.scroll-container::-webkit-scrollbar {
  width: 6px;
}

.scroll-container::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 999px;
}

.scroll-container::-webkit-scrollbar-track {
  background: transparent;
}
</style>
