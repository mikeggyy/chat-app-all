import { ref, Ref } from 'vue';

/**
 * 虛擬滾動 Composable 的配置選項
 */
interface UseVirtualScrollOptions {
  /** 初始顯示數量，默認 5 */
  initialCount?: number;
  /** 每次增加的數量，默認 5 */
  incrementCount?: number;
  /** 加載延遲（毫秒），默認 300 */
  loadDelay?: number;
  /** 觸發加載的距離底部閾值（px），默認 200 */
  scrollThreshold?: number;
}

/**
 * 虛擬滾動 Composable 的返回值類型
 */
interface UseVirtualScrollReturn {
  // 狀態
  displayedCount: Ref<number>;
  isLoadingMore: Ref<boolean>;
  containerRef: Ref<HTMLElement | null>;

  // 方法
  reset: () => void;
  loadMore: (onLoadMore?: () => Promise<void>) => Promise<void>;
  handleScroll: (
    event: Event,
    hasMore: boolean,
    onLoadMore?: () => Promise<void>
  ) => void;
}

/**
 * 虛擬滾動 Composable
 * 用於漸進式加載大量列表數據，提升性能
 *
 * @param options - 配置選項
 * @param options.initialCount - 初始顯示數量，默認 5
 * @param options.incrementCount - 每次增加的數量，默認 5
 * @param options.loadDelay - 加載延遲（毫秒），默認 300
 * @param options.scrollThreshold - 觸發加載的距離底部閾值（px），默認 200
 * @returns 虛擬滾動相關的狀態和方法
 */
export function useVirtualScroll(
  options: UseVirtualScrollOptions = {}
): UseVirtualScrollReturn {
  const {
    initialCount = 5,
    incrementCount = 5,
    loadDelay = 300,
    scrollThreshold = 200
  } = options;

  // 當前顯示的記錄數量
  const displayedCount: Ref<number> = ref(initialCount);

  // 是否正在加載更多
  const isLoadingMore: Ref<boolean> = ref(false);

  // 列表容器的 ref
  const containerRef: Ref<HTMLElement | null> = ref(null);

  /**
   * 重置顯示數量為初始值
   */
  const reset = (): void => {
    displayedCount.value = initialCount;
    isLoadingMore.value = false;
  };

  /**
   * 加載更多數據
   * @param onLoadMore - 可選的自定義加載函數（用於 API 調用）
   */
  const loadMore = async (onLoadMore?: () => Promise<void>): Promise<void> => {
    if (isLoadingMore.value) return;

    isLoadingMore.value = true;

    try {
      if (onLoadMore) {
        // 使用自定義加載函數（例如：API 調用）
        await onLoadMore();
      } else {
        // 默認行為：延遲後增加顯示數量（用於本地虛擬滾動）
        await new Promise<void>(resolve => setTimeout(resolve, loadDelay));
        displayedCount.value += incrementCount;
      }
    } finally {
      isLoadingMore.value = false;
    }
  };

  /**
   * 處理滾動事件
   * @param event - 滾動事件
   * @param hasMore - 是否還有更多數據
   * @param onLoadMore - 可選的自定義加載函數
   */
  const handleScroll = (
    event: Event,
    hasMore: boolean,
    onLoadMore?: () => Promise<void>
  ): void => {
    if (!hasMore || isLoadingMore.value) return;

    const container = event.target as HTMLElement;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // 當滾動到距離底部 scrollThreshold px 時開始加載
    if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
      loadMore(onLoadMore);
    }
  };

  return {
    // 狀態
    displayedCount,
    isLoadingMore,
    containerRef,

    // 方法
    reset,
    loadMore,
    handleScroll
  };
}
