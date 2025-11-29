<template>
  <div class="background-wrapper">
    <div class="background-track" :style="backgroundTrackStyle">
      <!-- ✅ 修復閃爍問題：使用穩定的 slot 作為 key，重用 DOM 元素 -->
      <div
        v-for="item in carouselMatches"
        :key="`bg-${item.slot}`"
        class="background-slide"
        :class="{ 'is-loading': !isUrlLoaded(item.data?.portraitUrl) }"
      >
        <!-- ✅ 效能優化：首屏圖片（current）使用 eager loading，其他使用 lazy loading -->
        <LazyImage
          :src="item.data?.portraitUrl || ''"
          alt=""
          :root-margin="'300px'"
          :threshold="0"
          :loading="item.slot === 'current' ? 'eager' : 'lazy'"
          image-class="character-portrait"
          @load="onImageLoad(item.data?.portraitUrl)"
        />
        <!-- ✅ 效能優化：圖片載入中時顯示模糊佔位效果 -->
        <div
          v-if="!isUrlLoaded(item.data?.portraitUrl)"
          class="loading-placeholder"
        ></div>
        <div class="gradient"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, type CSSProperties } from 'vue';
import LazyImage from '../common/LazyImage.vue';

/**
 * MatchBackground - 配對頁面背景輪播組件
 * 職責：顯示角色背景圖片輪播效果
 *
 * ✅ P3 優化：追蹤圖片載入狀態，快速滑動時顯示佔位效果而非前一張圖片
 */

// 類型定義
interface CarouselMatchData {
  portraitUrl?: string;
  [key: string]: any;
}

interface CarouselMatchItem {
  slot: string;
  data?: CarouselMatchData;
}

interface Props {
  carouselMatches: CarouselMatchItem[];
  backgroundTrackStyle: CSSProperties;
  isImageLoaded?: ((url: string) => boolean) | null;
}

// Props
const props = withDefaults(defineProps<Props>(), {
  isImageLoaded: null,
});

// 本地追蹤已載入的圖片 URL
const localLoadedUrls = ref<Set<string>>(new Set());

/**
 * 檢查圖片是否已載入
 * 優先使用父組件提供的預加載狀態，否則使用本地狀態
 */
const isUrlLoaded = (url: string | undefined): boolean => {
  if (!url) return false;
  // 優先檢查父組件的預加載狀態
  if (props.isImageLoaded && props.isImageLoaded(url)) {
    return true;
  }
  // 檢查本地已載入狀態
  return localLoadedUrls.value.has(url);
};

/**
 * 圖片載入完成回調
 */
const onImageLoad = (url: string | undefined): void => {
  if (url) {
    localLoadedUrls.value.add(url);
  }
};
</script>

<style scoped lang="scss">
.background-wrapper {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  // ✅ 效能優化：限制重排範圍
  contain: strict;

  .background-track {
    display: flex;
    height: 100%;
    will-change: transform;

    .background-slide {
      position: relative;
      flex: 0 0 100%;
      height: 100%;
      // ✅ 效能優化：限制每個幻燈片的重排
      contain: layout paint;

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

      // ✅ 圖片載入中時隱藏舊圖片
      &.is-loading {
        .lazy-image {
          opacity: 0;
        }
      }

      // ✅ 載入中佔位效果：漸層模糊背景
      .loading-placeholder {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          180deg,
          rgba(30, 41, 59, 0.8) 0%,
          rgba(15, 23, 42, 0.95) 100%
        );
        // 柔和的脈動動畫
        animation: pulse-bg 1.5s ease-in-out infinite;
      }

      @keyframes pulse-bg {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
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
</style>
