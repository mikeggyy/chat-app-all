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

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps({
  src: {
    type: String,
    required: true,
  },
  srcset: {
    type: String,
    default: '',
  },
  alt: {
    type: String,
    default: '',
  },
  loading: {
    type: String,
    default: 'lazy',
    validator: (value) => ['lazy', 'eager'].includes(value),
  },
  rootMargin: {
    type: String,
    default: '50px',
  },
  threshold: {
    type: Number,
    default: 0,
  },
  imageClass: {
    type: String,
    default: '',
  },
  showErrorState: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['load', 'error']);

const containerRef = ref(null);
const isVisible = ref(false);
const isLoaded = ref(false);
const hasError = ref(false);
let observer = null;

const onLoad = (event) => {
  isLoaded.value = true;
  emit('load', event);
};

const onError = (event) => {
  hasError.value = true;
  emit('error', event);
};

const initObserver = () => {
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

const cleanup = () => {
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
watch(() => props.src, () => {
  isLoaded.value = false;
  hasError.value = false;
  if (!isVisible.value) {
    cleanup();
    initObserver();
  }
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
  transition: opacity 0.3s ease-in-out;
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
