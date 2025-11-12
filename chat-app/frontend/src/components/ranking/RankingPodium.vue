<template>
  <section v-if="isReady" class="podium-section">
    <!-- 第二名 -->
    <article
      v-if="podiumByRank.second"
      class="podium-card podium-second"
      role="button"
      tabindex="0"
      :aria-label="`查看 ${podiumByRank.second?.name || '角色'} 的聊天室`"
      @click="handleClick(podiumByRank.second)"
      @keydown.enter.prevent="handleClick(podiumByRank.second)"
      @keydown.space.prevent="handleClick(podiumByRank.second)"
    >
      <div class="podium-rank">2</div>
      <div class="avatar-wrap">
        <LazyImage
          :src="podiumByRank.second.avatar"
          :alt="`${podiumByRank.second.name} 頭像`"
          :root-margin="'200px'"
          :threshold="0"
          image-class="podium-avatar"
        />
      </div>
      <p class="podium-name">{{ podiumByRank.second.name }}</p>
      <p class="podium-handle">
        {{ getSubtitle(podiumByRank.second) }}
      </p>
      <p class="podium-score">
        {{ formatScore(podiumByRank.second.score) }}
      </p>
    </article>

    <!-- 第一名 -->
    <article
      v-if="podiumByRank.first"
      class="podium-card podium-first"
      role="button"
      tabindex="0"
      :aria-label="`查看 ${podiumByRank.first?.name || '角色'} 的聊天室`"
      @click="handleClick(podiumByRank.first)"
      @keydown.enter.prevent="handleClick(podiumByRank.first)"
      @keydown.space.prevent="handleClick(podiumByRank.first)"
    >
      <div class="podium-rank">1</div>
      <div class="avatar-wrap">
        <LazyImage
          :src="podiumByRank.first.avatar"
          :alt="`${podiumByRank.first.name} 頭像`"
          :root-margin="'200px'"
          :threshold="0"
          image-class="podium-avatar"
        />
      </div>
      <p class="podium-name">{{ podiumByRank.first.name }}</p>
      <p class="podium-handle">
        {{ getSubtitle(podiumByRank.first) }}
      </p>
      <p class="podium-score">
        {{ formatScore(podiumByRank.first.score) }}
      </p>
    </article>

    <!-- 第三名 -->
    <article
      v-if="podiumByRank.third"
      class="podium-card podium-third"
      role="button"
      tabindex="0"
      :aria-label="`查看 ${podiumByRank.third?.name || '角色'} 的聊天室`"
      @click="handleClick(podiumByRank.third)"
      @keydown.enter.prevent="handleClick(podiumByRank.third)"
      @keydown.space.prevent="handleClick(podiumByRank.third)"
    >
      <div class="podium-rank">3</div>
      <div class="avatar-wrap">
        <LazyImage
          :src="podiumByRank.third.avatar"
          :alt="`${podiumByRank.third.name} 頭像`"
          :root-margin="'200px'"
          :threshold="0"
          image-class="podium-avatar"
        />
      </div>
      <p class="podium-name">{{ podiumByRank.third.name }}</p>
      <p class="podium-handle">
        {{ getSubtitle(podiumByRank.third) }}
      </p>
      <p class="podium-score">
        {{ formatScore(podiumByRank.third.score) }}
      </p>
    </article>
  </section>

  <!-- 加載中佔位 -->
  <section v-else class="podium-placeholder" aria-hidden="true">
    <div class="placeholder-card"></div>
    <div class="placeholder-card primary"></div>
    <div class="placeholder-card"></div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import LazyImage from '../common/LazyImage.vue';
import { formatScore } from '../../utils/rankingUtils.js';

const props = defineProps({
  podium: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['navigate']);

/**
 * 計算 Podium 排序（第一名居中）
 */
const podiumByRank = computed(() => {
  const entries = props.podium || [];

  const first = entries.find((e) => e?.rank === 1) || null;
  const second = entries.find((e) => e?.rank === 2) || null;
  const third = entries.find((e) => e?.rank === 3) || null;

  return {
    first: first ? { ...first, name: first.displayName || '未知角色' } : null,
    second: second ? { ...second, name: second.displayName || '未知角色' } : null,
    third: third ? { ...third, name: third.displayName || '未知角色' } : null,
  };
});

/**
 * Podium 是否準備好
 */
const isReady = computed(() =>
  Array.isArray(props.podium) && props.podium.length > 0
);

/**
 * 獲取副標題
 */
const getSubtitle = (entry) => {
  return entry?.subtitle || entry?.handle || entry?.title || '';
};

/**
 * 處理點擊事件
 */
const handleClick = (entry) => {
  emit('navigate', entry);
};
</script>

<!-- 樣式從原 RankingView.vue 繼承 -->
