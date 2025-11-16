<template>
  <div ref="containerRef" class="lazy-image" :class="{ 'is-loaded': isLoaded, 'is-error': hasError }">
    <img
      v-if="isVisible"
      :src="src"
      :srcset="srcset"
      :alt="alt"
      :loading="loading"
      :class="imageClass"
      @load="onLoad"
      @error="onError"
    />
    <div v-else class="lazy-image__placeholder">
      <slot name="placeholder">
        <div class="lazy-image__skeleton"></div>
      </slot>
    </div>
    <div v-if="hasError && showErrorState" class="lazy-image__error">
      <slot name="error">
        <span class="error-icon">⚠️</span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, type Ref } from 'vue';

// Types
type Loading = 'lazy' | 'eager';

interface Props {
  src: string;
  srcset?: string;
  alt?: string;
  loading?: Loading;
  rootMargin?: string;
  threshold?: number;
  imageClass?: string;
  showErrorState?: boolean;
}

interface Emits {
  (e: 'load', event: Event): void;
  (e: 'error', event: Event): void;
}

const props = withDefaults(defineProps<Props>(), {
  srcset: '',
  alt: '',
  loading: 'lazy',
  rootMargin: '50px',
  threshold: 0,
  imageClass: '',
  showErrorState: true,
});

const emit = defineEmits<Emits>();

const containerRef: Ref<HTMLElement | null> = ref(null);
const isVisible: Ref<boolean> = ref(false);
const isLoaded: Ref<boolean> = ref(false);
const hasError: Ref<boolean> = ref(false);
let observer: IntersectionObserver | null = null;

const onLoad = (event: Event): void => {
  isLoaded.value = true;
  emit('load', event);
};

const onError = (event: Event): void => {
  hasError.value = true;
  emit('error', event);
};

const initObserver = (): void => {
  if (!containerRef.value) return;

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        isVisible.value = true;
        // 一旦可見就停止觀察
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    },
    {
      root: null,
      rootMargin: props.rootMargin,
      threshold: props.threshold,
    }
  );

  observer.observe(containerRef.value);
};

const cleanup = (): void => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
};

onMounted(() => {
  initObserver();
});

onBeforeUnmount(() => {
  cleanup();
});

// 監聽 src 變化，重置狀態
// ✅ 修復閃爍問題：不立即重置 isLoaded，讓新圖片可以交叉淡入
watch(() => props.src, () => {
  // 只重置錯誤狀態，保持 isLoaded 讓舊圖保持顯示
  hasError.value = false;

  // 如果圖片還未可見，重新初始化觀察器
  if (!isVisible.value) {
    cleanup();
    initObserver();
  }
  // 圖片已可見時，直接加載新圖片（onLoad 會更新 isLoaded）
});
</script>

<style scoped>
.lazy-image {
  position: relative;
  overflow: hidden;
  background-color: #f0f0f0;
}

.lazy-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  /* ✅ 修復閃爍問題：縮短過渡時間，並改用 ease-out 讓淡入更自然 */
  transition: opacity 0.15s ease-out;
}

.lazy-image.is-loaded img {
  opacity: 1;
}

.lazy-image__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lazy-image__skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.lazy-image__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f8f8;
}

.error-icon {
  font-size: 2rem;
  opacity: 0.5;
}
</style>
