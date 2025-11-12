import { ref, watch, onBeforeUnmount } from "vue";
import { logger } from "../utils/logger";

/**
 * 無限滾動 Composable
 * 監聽滾動容器，在滾動到頂部時觸發載入更多數據
 *
 * @param {Function} loadMore - 載入更多數據的回調函數
 * @param {Object} options - 配置選項
 * @param {number} options.threshold - 觸發距離（像素）
 * @param {boolean} options.enabled - 是否啟用
 * @returns {Object} - { containerRef, isLoadingMore, hasMore }
 */
export function useInfiniteScroll(loadMore, options = {}) {
  const {
    threshold = 100,
    enabled = true,
  } = options;

  const containerRef = ref(null);
  const isLoadingMore = ref(false);
  const hasMore = ref(true);
  let scrollHandler = null;

  const handleScroll = async () => {
    if (!enabled || !containerRef.value || isLoadingMore.value || !hasMore.value) {
      return;
    }

    const scrollTop = containerRef.value.scrollTop;

    // 當滾動到頂部時載入更多
    if (scrollTop <= threshold) {
      isLoadingMore.value = true;

      try {
        const result = await loadMore();

        // 如果 loadMore 返回 false 或 { hasMore: false }，停止載入
        if (result === false || result?.hasMore === false) {
          hasMore.value = false;
        }
      } catch (error) {
        logger.error('[無限滾動] 載入失敗:', error);
      } finally{
        isLoadingMore.value = false;
      }
    }
  };

  // 監聽 containerRef 的變化，當元素掛載後綁定事件
  watch(containerRef, (newEl, oldEl) => {
    // 移除舊元素的事件監聽
    if (oldEl && scrollHandler) {
      oldEl.removeEventListener('scroll', scrollHandler);
    }

    // 為新元素添加事件監聽
    if (newEl) {
      scrollHandler = handleScroll;
      newEl.addEventListener('scroll', handleScroll, { passive: true });
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    if (containerRef.value && scrollHandler) {
      containerRef.value.removeEventListener('scroll', scrollHandler);
    }
  });

  return {
    containerRef,
    isLoadingMore,
    hasMore,
  };
}
