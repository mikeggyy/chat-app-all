<template>
  <div class="background-container">
    <!-- 桌面版：模糊背景層（填滿整個頁面） -->
    <div class="blurred-backdrop" aria-hidden="true">
      <div class="backdrop-track" :style="backgroundTrackStyle">
        <div
          v-for="item in carouselMatches"
          :key="`backdrop-${item.slot}`"
          class="backdrop-slide"
        >
          <img
            v-if="item.data?.portraitUrl"
            :src="item.data.portraitUrl"
            alt=""
            loading="lazy"
          />
        </div>
      </div>
    </div>

    <!-- 主要背景卡片 -->
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
// 最外層容器
.background-container {
  position: absolute;
  inset: 0;
  z-index: 0;

  // 桌面版：允許溢出
  @media (min-width: 1024px) {
    overflow: visible;
  }
}

// 桌面版：模糊背景層（填滿整個頁面）
.blurred-backdrop {
  display: none;

  @media (min-width: 1024px) {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;

    .backdrop-track {
      display: flex;
      height: 100%;
      will-change: transform;
      // 禁用滑動 transform，保持固定
      transform: none !important;
    }

    .backdrop-slide {
      // 只顯示中間（當前）的背景
      display: none;
      position: absolute;
      inset: 0;

      &:nth-child(2) {
        display: block;
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        // 模糊 + 放大 + 降低亮度
        filter: blur(40px) brightness(0.4);
        transform: scale(1.2);
      }
    }
  }
}

.background-wrapper {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  // ✅ 效能優化：限制重排範圍
  contain: strict;
  // 漸層背景填充空白區域（桌面版 contain 時使用）
  background: linear-gradient(
    180deg,
    rgba(30, 41, 59, 0.9) 0%,
    rgba(15, 23, 42, 1) 100%
  );

  // 桌面版：輪播容器樣式
  @media (min-width: 1024px) {
    position: fixed;
    inset: 0;
    background: transparent;
    contain: none;
    overflow: visible;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .background-track {
    display: flex;
    height: 100%;
    will-change: transform;

    // 桌面版：輪播軌道
    @media (min-width: 1024px) {
      height: auto;
      align-items: center;
      gap: 32px;
    }

    @media (min-width: 1440px) {
      gap: 40px;
    }
  }

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

    // 桌面版：卡片樣式
    @media (min-width: 1024px) {
      flex: 0 0 420px;
      width: 420px;
      height: auto;
      aspect-ratio: 3 / 4;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      transition: transform 0.3s ease, opacity 0.3s ease;
      contain: none;

      // 前後卡片：縮小 + 降低透明度
      &:first-child,
      &:last-child {
        transform: scale(0.85);
        opacity: 0.5;
      }

      // 當前卡片：正常大小
      &:nth-child(2) {
        transform: scale(1);
        opacity: 1;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      }

      img,
      .character-portrait {
        object-position: center 20%;
      }
    }

    @media (min-width: 1440px) {
      flex: 0 0 500px;
      width: 500px;
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
</style>
