// @ts-nocheck
import { ref, watch, onBeforeUnmount, Ref } from "vue";
import { logger } from "../utils/logger.js";

/**
 * 無限滾動加載更多數據的結果類型
 */
interface LoadMoreResult {
  hasMore?: boolean;
}

/**
 * 無限滾動配置選項
 */
interface InfiniteScrollOptions {
  /**
   * 觸發載入的距離閾值（像素）
   * @default 100
   */
  threshold?: number;

  /**
   * 是否啟用無限滾動
   * @default true
   */
  enabled?: boolean;
}

/**
 * 無限滾動 Composable 的返回類型
 */
interface UseInfiniteScrollReturn {
  /**
   * 滾動容器的 ref，應綁定到需要監聽滾動的 DOM 元素
   */
  containerRef: Ref<HTMLElement | null>;

  /**
   * 是否正在載入更多數據
   */
  isLoadingMore: Ref<boolean>;

  /**
   * 是否還有更多數據可以載入
   */
  hasMore: Ref<boolean>;
}

/**
 * 載入更多數據的回調函數類型
 */
type LoadMoreCallback = () => Promise<LoadMoreResult | boolean | void>;

/**
 * 無限滾動 Composable
 * 監聽滾動容器，在滾動到頂部時觸發載入更多數據
 *
 * @param {LoadMoreCallback} loadMore - 載入更多數據的回調函數
 * @param {InfiniteScrollOptions} options - 配置選項
 * @returns {UseInfiniteScrollReturn} - { containerRef, isLoadingMore, hasMore }
 *
 * @example
 * const { containerRef, isLoadingMore, hasMore } = useInfiniteScroll(
 *   async () => {
 *     // 載入更多數據的邏輯
 *     const data = await fetchMoreData();
 *     return { hasMore: data.length > 0 };
 *   },
 *   { threshold: 150 }
 * );
 */
export function useInfiniteScroll(
  loadMore: LoadMoreCallback,
  options: InfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const {
    threshold = 100,
    enabled = true,
  } = options;

  const containerRef: Ref<HTMLElement | null> = ref(null);
  const isLoadingMore: Ref<boolean> = ref(false);
  const hasMore: Ref<boolean> = ref(true);
  let scrollHandler: ((this: HTMLElement, ev: Event) => any) | null = null;

  /**
   * 滾動事件處理函數
   * 檢查是否到達閾值，如果是則觸發 loadMore 回調
   */
  const handleScroll = async (): Promise<void> => {
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
        if (result === false || (result && typeof result === 'object' && result.hasMore === false)) {
          hasMore.value = false;
        }
      } catch (error) {
        logger.error('[無限滾動] 載入失敗:', error);
      } finally {
        isLoadingMore.value = false;
      }
    }
  };

  // 監聽 containerRef 的變化，當元素掛載後綁定事件
  watch(containerRef, (newEl: HTMLElement | null, oldEl: HTMLElement | null) => {
    // 移除舊元素的事件監聽
    if (oldEl && scrollHandler) {
      oldEl.removeEventListener('scroll', scrollHandler);
    }

    // 為新元素添加事件監聽
    if (newEl) {
      scrollHandler = handleScroll as any;
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
