<script setup>
import { ref } from "vue";
import { ArrowPathIcon } from "@heroicons/vue/24/solid";
import RankingItem from "./RankingItem.vue";

const sentinel = ref(null);

defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
  formatScore: {
    type: Function,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isLoadingMore: {
    type: Boolean,
    default: false,
  },
  isError: {
    type: Boolean,
    default: false,
  },
  isEmpty: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: "",
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["navigate", "retry"]);

const handleNavigate = (entry) => {
  emit("navigate", entry);
};

const handleRetry = () => {
  emit("retry");
};

// 暴露 sentinel ref 給父組件使用（用於 IntersectionObserver）
defineExpose({
  sentinel,
});
</script>

<template>
  <div class="ranking-scroll-container">
    <!-- 初始加載狀態 -->
    <section v-if="isLoading" class="loading-state" aria-live="polite">
      <ArrowPathIcon class="spinner" aria-hidden="true" />
      <span>正在整理排行榜...</span>
    </section>

    <!-- 錯誤狀態 -->
    <section v-else-if="isError" class="error-state" aria-live="polite">
      <p>{{ errorMessage }}</p>
      <button type="button" @click="handleRetry">重新整理</button>
    </section>

    <!-- 空狀態 -->
    <section v-else-if="isEmpty" class="empty-state">
      <p>目前沒有榜單資料，稍後再試一次。</p>
      <button type="button" @click="handleRetry">重新整理</button>
    </section>

    <!-- 排行榜列表 -->
    <ol v-else class="ranking-list">
      <RankingItem
        v-for="entry in entries"
        :key="entry.id"
        :entry="entry"
        :format-score="formatScore"
        @navigate="handleNavigate(entry)"
      />
    </ol>

    <!-- 滾動哨兵 - 用於無限滾動檢測 -->
    <div ref="sentinel" class="scroll-sentinel" aria-hidden="true"></div>

    <!-- 加載更多狀態 -->
    <div v-if="isLoadingMore" class="loading-more" aria-live="polite">
      <ArrowPathIcon class="spinner" aria-hidden="true" />
      <span>載入更多角色...</span>
    </div>

    <!-- 列表底部 -->
    <div
      v-else-if="!hasMore && entries.length"
      class="list-footer"
      aria-live="polite"
    >
      <span>已到底部</span>
    </div>
  </div>
</template>

<style scoped>
.ranking-scroll-container {
  display: flex;
  flex-direction: column;
  gap: clamp(0.7rem, 3vw, 0.9rem);
}

.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(0.7rem, 3vw, 0.9rem);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  padding: clamp(2.5rem, 10vw, 3.5rem) clamp(1.2rem, 5vw, 1.8rem);
  border-radius: 18px;
  background: linear-gradient(
    170deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.03) 100%
  );
  backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.65);
  font-size: clamp(0.9rem, 3.6vw, 1.02rem);
  text-align: center;
}

.loading-state .spinner,
.loading-more .spinner {
  width: 48px;
  height: 48px;
  color: var(--accent-strong);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.error-state p,
.empty-state p {
  margin: 0;
  max-width: 400px;
}

.error-state button,
.empty-state button {
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  color: #310802;
  background: linear-gradient(
    160deg,
    var(--accent-strong) 0%,
    var(--accent-strong-dark) 100%
  );
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.error-state button:hover,
.empty-state button:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}

.scroll-sentinel {
  height: 1px;
  visibility: hidden;
}

.loading-more,
.list-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: clamp(1.2rem, 4vw, 1.6rem);
  font-size: clamp(0.85rem, 3.2vw, 0.95rem);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.loading-more .spinner {
  width: 24px;
  height: 24px;
}
</style>
