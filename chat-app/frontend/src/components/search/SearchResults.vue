<script setup lang="ts">
// Types

import LazyImage from '@/components/common/LazyImage.vue';

const props = defineProps({
  results: {
    type: Array,
    default: () => [],
  },
  query: {
    type: String,
    default: "",
  },
  isFallback: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["reset", "result-click"]);

const handleReset = () => {
  emit("reset");
};

const handleResultClick = (profile) => {
  emit("result-click", profile);
};

const handleKeyup = (event, profile) => {
  if (event.key === "Enter") {
    handleResultClick(profile);
  }
};
</script>

<template>
  <div class="search-results">
    <!-- 搜尋結果頭部 -->
    <section class="results-header">
      <div class="results-meta">
        <p class="results-kicker">搜尋結果</p>
        <h2>
          {{
            isFallback
              ? "未找到完全符合的角色"
              : `找到 ${results.length} 位角色`
          }}
        </h2>
        <p class="results-query">關鍵字:{{ query }}</p>
        <p v-if="isFallback" class="results-note">
          以下為相近的角色推薦,或嘗試使用不同關鍵字。
        </p>
      </div>
      <button type="button" class="search-reset" @click="handleReset">
        重新搜尋
      </button>
    </section>

    <!-- 搜尋結果列表 -->
    <section v-if="results.length" class="results-list">
      <article
        v-for="profile in results"
        :key="profile.id"
        class="result-card"
        role="button"
        tabindex="0"
        @click="handleResultClick(profile)"
        @keyup.enter="(e) => handleKeyup(e, profile)"
      >
        <div class="result-media">
          <LazyImage
            :src="profile.image"
            :alt="profile.name"
            root-margin="100px"
            image-class="result-image"
          />
        </div>
        <div class="result-body">
          <header class="result-header">
            <h3>{{ profile.name }}</h3>
            <span class="result-handle">{{ profile.author }}</span>
          </header>
          <p class="result-description">{{ profile.description }}</p>
        </div>
      </article>
    </section>

    <!-- 空狀態 -->
    <section v-else class="results-empty">
      <h3>沒有找到符合的角色</h3>
      <p>試著調整搜尋字詞,或點選上方按鈕重新搜尋。</p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.search-results {
  display: flex;
  flex-direction: column;
  gap: clamp(1.1rem, 3vw, 1.4rem);
}

.results-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: clamp(1.35rem, 4vw, 1.75rem);
  box-shadow: 0 28px 54px rgba(2, 6, 23, 0.48);
  backdrop-filter: blur(18px);

  .results-meta {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .results-kicker {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.78rem;
    color: rgba(226, 232, 240, 0.55);
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #f8fafc;
  }

  .results-query {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(148, 163, 184, 0.75);
  }

  .results-note {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(244, 114, 182, 0.78);
  }
}

.search-reset {
  align-self: center;
  padding: 0.55rem 1.2rem;
  border-radius: 999px;
  border: 1px solid rgba(236, 72, 153, 0.45);
  background: rgba(30, 41, 59, 0.8);
  color: #fdf2f8;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  transition: border-color 160ms ease, background 160ms ease,
    transform 160ms ease;

  &:hover {
    border-color: rgba(244, 114, 182, 0.65);
    background: rgba(236, 72, 153, 0.4);
    transform: translateY(-1px);
  }
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: clamp(1.1rem, 3vw, 1.4rem);
}

.result-card {
  display: flex;
  gap: clamp(1rem, 3vw, 1.2rem);
  background: rgba(15, 23, 42, 0.68);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: clamp(1rem, 3.2vw, 1.35rem);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.45);
  transition: transform 160ms ease, border-color 160ms ease,
    box-shadow 160ms ease;
  cursor: pointer;
  outline: none;

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(236, 72, 153, 0.32);
    box-shadow: 0 18px 36px rgba(236, 72, 153, 0.25);
  }

  &:focus-visible {
    border-color: rgba(96, 165, 250, 0.75);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35);
    transform: translateY(-2px);
  }

  .result-media {
    flex: 0 0 92px;
    height: 92px;
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 1px 0 rgba(248, 250, 252, 0.08);

    // ✅ P1 優化（2025-01）：LazyImage 支援
    :deep(.lazy-image) {
      width: 100%;
      height: 100%;
    }

    :deep(.result-image) {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .result-body {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    color: #f8fafc;
  }

  .result-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;

    h3 {
      margin: 0;
      font-size: 1.05rem;
      color: #f8fafc;
    }

    .result-handle {
      font-size: 0.82rem;
      color: rgba(148, 163, 184, 0.75);
    }
  }

  .result-description {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.6;
    color: rgba(226, 232, 240, 0.75);
    text-align: left;
  }
}

.results-empty {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: clamp(1.7rem, 4vw, 2.1rem);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.42);
  text-align: center;
  color: #e2e8f0;

  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #f8fafc;
  }

  p {
    margin: 0.75rem 0 0;
    font-size: 0.86rem;
    color: rgba(226, 232, 240, 0.65);
  }
}

@media (max-width: 520px) {
  .results-header {
    flex-direction: column;
    align-items: stretch;

    .search-reset {
      width: 100%;
      text-align: center;
    }
  }

  .result-card {
    flex-direction: column;
    align-items: center;
    text-align: center;

    .result-media {
      width: 100%;
      flex: 0 0 auto;
      height: auto;
      padding-top: 100%;
      border-radius: 16px;

      :deep(.result-image) {
        position: absolute;
        inset: 0;
      }
    }

    .result-body {
      align-items: center;
    }

    .result-header {
      justify-content: center;
    }
  }
}
</style>
