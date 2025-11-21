import { ref, Ref, onUnmounted } from 'vue';

/**
 * 聊天虛擬滾動配置選項
 */
interface UseChatVirtualScrollOptions {
  /** 初始顯示的消息數量，默認 50 */
  initialCount?: number;
  /** 向上滾動時每次加載的數量，默認 30 */
  incrementCount?: number;
  /** 觸發加載的距離頂部閾值（px），默認 300 */
  scrollThreshold?: number;
  /** 滾動節流間隔（ms），默認 100 */
  throttleMs?: number;
}

/**
 * 聊天消息介面
 */
interface ChatMessage {
  id: string;
  [key: string]: any;
}

/**
 * 聊天虛擬滾動 Composable 返回值介面
 */
interface UseChatVirtualScrollReturn {
  // 狀態
  displayedCount: Ref<number>;
  isLoadingMore: Ref<boolean>;
  containerRef: Ref<HTMLElement | null>;

  // 方法
  getVisibleMessages: (allMessages: ChatMessage[]) => ChatMessage[];
  reset: () => void;
  loadMore: (totalMessages: number) => boolean;
  handleScroll: (event: Event, totalMessages: number) => void;
  hasMore: (totalMessages: number) => boolean;
}

/**
 * 聊天虛擬滾動 Composable
 * 專為聊天消息列表優化，支持從底部開始顯示最新消息
 *
 * @param options - 配置選項
 * @param options.initialCount - 初始顯示的消息數量，默認 50
 * @param options.incrementCount - 向上滾動時每次加載的數量，默認 30
 * @param options.scrollThreshold - 觸發加載的距離頂部閾值（px），默認 300
 * @returns 虛擬滾動狀態和方法
 */
export function useChatVirtualScroll(
  options: UseChatVirtualScrollOptions = {}
): UseChatVirtualScrollReturn {
  const {
    initialCount = 50,
    incrementCount = 30,
    scrollThreshold = 300,
    throttleMs = 100
  } = options;

  // 節流控制變數
  let lastScrollTime = 0;
  let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  // 當前顯示的消息數量（從最新往舊計算）
  const displayedCount: Ref<number> = ref(initialCount);

  // 是否正在加載更多舊消息
  const isLoadingMore: Ref<boolean> = ref(false);

  // 上次滾動位置（用於保持滾動位置）
  const lastScrollHeight: Ref<number> = ref(0);

  // 容器 ref
  const containerRef: Ref<HTMLElement | null> = ref(null);

  /**
   * 計算可見的消息
   * @param allMessages - 所有消息
   * @returns 可見的消息切片
   */
  const getVisibleMessages = (allMessages: ChatMessage[]): ChatMessage[] => {
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
  const reset = (): void => {
    displayedCount.value = initialCount;
    isLoadingMore.value = false;
    lastScrollHeight.value = 0;
    // 清理節流 timer
    if (scrollThrottleTimer) {
      clearTimeout(scrollThrottleTimer);
      scrollThrottleTimer = null;
    }
    lastScrollTime = 0;
  };

  /**
   * 加載更多舊消息
   * @param totalMessages - 總消息數量
   * @returns 是否成功觸發加載
   */
  const loadMore = (totalMessages: number): boolean => {
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
   * 處理滾動事件（帶節流優化）
   * @param event - 滾動事件
   * @param totalMessages - 總消息數量
   */
  const handleScroll = (event: Event, totalMessages: number): void => {
    if (isLoadingMore.value) return;
    if (displayedCount.value >= totalMessages) return;

    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime;

    // 節流：如果距離上次處理時間小於 throttleMs，延遲執行
    if (timeSinceLastScroll < throttleMs) {
      // 清除之前的延遲執行
      if (scrollThrottleTimer) {
        clearTimeout(scrollThrottleTimer);
      }
      // 設置新的延遲執行，確保最後一次滾動也能被處理
      scrollThrottleTimer = setTimeout(() => {
        handleScrollCore(event, totalMessages);
      }, throttleMs - timeSinceLastScroll);
      return;
    }

    handleScrollCore(event, totalMessages);
  };

  /**
   * 核心滾動處理邏輯
   */
  const handleScrollCore = (event: Event, totalMessages: number): void => {
    lastScrollTime = Date.now();

    const container = event.target as HTMLElement;
    const scrollTop = container.scrollTop;

    // 當滾動到距離頂部 scrollThreshold px 時開始加載舊消息
    if (scrollTop < scrollThreshold) {
      loadMore(totalMessages);
    }
  };

  /**
   * 檢查是否有更多舊消息可以加載
   * @param totalMessages - 總消息數量
   * @returns 是否有更多舊消息
   */
  const hasMore = (totalMessages: number): boolean => {
    return displayedCount.value < totalMessages;
  };

  // 組件卸載時清理 timer
  onUnmounted(() => {
    if (scrollThrottleTimer) {
      clearTimeout(scrollThrottleTimer);
      scrollThrottleTimer = null;
    }
  });

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
