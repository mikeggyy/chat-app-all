<script setup>
import { computed } from 'vue';

const props = defineProps({
  src: {
    type: String,
    required: true,
  },
  alt: {
    type: String,
    default: '',
  },
  sizes: {
    type: String,
    default: '(max-width: 640px) 200px, (max-width: 1024px) 400px, 800px',
  },
  loading: {
    type: String,
    default: 'lazy',
    validator: (value) => ['lazy', 'eager'].includes(value),
  },
  fetchpriority: {
    type: String,
    default: 'auto',
    validator: (value) => ['high', 'low', 'auto'].includes(value),
  },
  // 是否使用優化後的圖片（需要先運行 npm run optimize-images）
  useOptimized: {
    type: Boolean,
    default: false,
  },
});

/**
 * 生成 srcset 屬性
 * 如果使用優化後的圖片，會生成多個尺寸的圖片源
 */
const srcset = computed(() => {
  if (!props.useOptimized) {
    return undefined;
  }

  // 提取原始路徑和文件名
  const pathParts = props.src.split('/');
  const fileName = pathParts.pop();
  const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  const basePath = pathParts.join('/');

  // 生成不同尺寸的圖片路徑
  return [
    `${basePath}/optimized/${fileNameWithoutExt}-sm.webp 200w`,
    `${basePath}/optimized/${fileNameWithoutExt}-md.webp 400w`,
    `${basePath}/optimized/${fileNameWithoutExt}-lg.webp 800w`,
  ].join(', ');
});

/**
 * 圖片源（如果使用優化圖片，使用優化版本作為預設）
 */
const imageSrc = computed(() => {
  if (!props.useOptimized) {
    return props.src;
  }

  const pathParts = props.src.split('/');
  const fileName = pathParts.pop();
  const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  const basePath = pathParts.join('/');

  return `${basePath}/optimized/${fileNameWithoutExt}.webp`;
});
</script>

<template>
  <img
    :src="imageSrc"
    :srcset="srcset"
    :sizes="sizes"
    :alt="alt"
    :loading="loading"
    :fetchpriority="fetchpriority"
  />
</template>

<style scoped>
img {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
