<template>
  <div class="background-wrapper">
    <div class="background-track" :style="backgroundTrackStyle">
      <div
        v-for="item in carouselMatches"
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
</template>

<script setup>
import LazyImage from '../common/LazyImage.vue';

/**
 * MatchBackground - 配對頁面背景輪播組件
 * 職責：顯示角色背景圖片輪播效果
 */

// Props
defineProps({
  carouselMatches: {
    type: Array,
    required: true,
  },
  backgroundTrackStyle: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped lang="scss">
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
</style>
