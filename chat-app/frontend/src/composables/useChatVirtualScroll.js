import { ref, computed } from 'vue';

/**
 * 聊天虛擬滾動 Composable
 * 專為聊天消息列表優化，支持從底部開始顯示最新消息
 *
 * @param {Object} options - 配置選項
 * @param {number} options.initialCount - 初始顯示的消息數量，默認 50
 * @param {number} options.incrementCount - 向上滾動時每次加載的數量，默認 30
 * @param {number} options.scrollThreshold - 觸發加載的距離頂部閾值（px），默認 300
 */
export function useChatVirtualScroll(options = {}) {
  const {
    initialCount = 50,
    incrementCount = 30,
    scrollThreshold = 300
  } = options;

  // 當前顯示的消息數量（從最新往舊計算）
  const displayedCount = ref(initialCount);

  // 是否正在加載更多舊消息
  const isLoadingMore = ref(false);

  // 上次滾動位置（用於保持滾動位置）
  const lastScrollHeight = ref(0);

  // 容器 ref
  const containerRef = ref(null);

  /**
   * 計算可見的消息
   * @param {Array} allMessages - 所有消息
   * @returns {Array} 可見的消息切片
   */
  const getVisibleMessages = (allMessages) => {
    if (!allMessages || allMessages.length === 0) return [];

    // 如果總消息數少於要顯示的數量，返回全部
    if (allMessages.length <= displayedCount.value) {
      return allMessages;
    }

    // 從最新的消息開始，向前取 displayedCount 條
    return allMessages.slice(-displayedCount.value);
  };

  /**
   * 重置顯示數量
   */
  const reset = () => {
    displayedCount.value = initialCount;
    isLoadingMore.value = false;
    lastScrollHeight.value = 0;
  };

  /**
   * 加載更多舊消息
   * @param {number} totalMessages - 總消息數量
   */
  const loadMore = (totalMessages) => {
    if (isLoadingMore.value) return false;

    // 如果已經顯示所有消息，不再加載
    if (displayedCount.value >= totalMessages) return false;

    isLoadingMore.value = true;

    // 保存當前滾動高度（用於恢復滾動位置）
    if (containerRef.value) {
      lastScrollHeight.value = containerRef.value.scrollHeight;
    }

    // 增加顯示數量
    const newCount = Math.min(
      displayedCount.value + incrementCount,
      totalMessages
    );
    displayedCount.value = newCount;

    // 下一個 tick 恢復滾動位置
    setTimeout(() => {
      if (containerRef.value) {
        const newScrollHeight = containerRef.value.scrollHeight;
        const scrollDiff = newScrollHeight - lastScrollHeight.value;
        containerRef.value.scrollTop = scrollDiff;
      }
      isLoadingMore.value = false;
    }, 0);

    return true;
  };

  /**
   * 處理滾動事件
   * @param {Event} event - 滾動事件
   * @param {number} totalMessages - 總消息數量
   */
  const handleScroll = (event, totalMessages) => {
    if (isLoadingMore.value) return;
    if (displayedCount.value >= totalMessages) return;

    const container = event.target;
    const scrollTop = container.scrollTop;

    // 當滾動到距離頂部 scrollThreshold px 時開始加載舊消息
    if (scrollTop < scrollThreshold) {
      loadMore(totalMessages);
    }
  };

  /**
   * 檢查是否有更多舊消息可以加載
   * @param {number} totalMessages - 總消息數量
   * @returns {boolean}
   */
  const hasMore = (totalMessages) => {
    return displayedCount.value < totalMessages;
  };

  return {
    // 狀態
    displayedCount,
    isLoadingMore,
    containerRef,

    // 方法
    getVisibleMessages,
    reset,
    loadMore,
    handleScroll,
    hasMore
  };
}
