import { ref } from 'vue';

/**
 * 虛擬滾動 Composable
 * 用於漸進式加載大量列表數據，提升性能
 *
 * @param {Object} options - 配置選項
 * @param {number} options.initialCount - 初始顯示數量，默認 5
 * @param {number} options.incrementCount - 每次增加的數量，默認 5
 * @param {number} options.loadDelay - 加載延遲（毫秒），默認 300
 * @param {number} options.scrollThreshold - 觸發加載的距離底部閾值（px），默認 200
 */
export function useVirtualScroll(options = {}) {
  const {
    initialCount = 5,
    incrementCount = 5,
    loadDelay = 300,
    scrollThreshold = 200
  } = options;

  // 當前顯示的記錄數量
  const displayedCount = ref(initialCount);

  // 是否正在加載更多
  const isLoadingMore = ref(false);

  // 列表容器的 ref
  const containerRef = ref(null);

  /**
   * 重置顯示數量為初始值
   */
  const reset = () => {
    displayedCount.value = initialCount;
    isLoadingMore.value = false;
  };

  /**
   * 加載更多數據
   * @param {Function} onLoadMore - 可選的自定義加載函數（用於 API 調用）
   */
  const loadMore = async (onLoadMore) => {
    if (isLoadingMore.value) return;

    isLoadingMore.value = true;

    try {
      if (onLoadMore) {
        // 使用自定義加載函數（例如：API 調用）
        await onLoadMore();
      } else {
        // 默認行為：延遲後增加顯示數量（用於本地虛擬滾動）
        await new Promise(resolve => setTimeout(resolve, loadDelay));
        displayedCount.value += incrementCount;
      }
    } finally {
      isLoadingMore.value = false;
    }
  };

  /**
   * 處理滾動事件
   * @param {Event} event - 滾動事件
   * @param {boolean} hasMore - 是否還有更多數據
   * @param {Function} onLoadMore - 可選的自定義加載函數
   */
  const handleScroll = (event, hasMore, onLoadMore) => {
    if (!hasMore || isLoadingMore.value) return;

    const container = event.target;
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
