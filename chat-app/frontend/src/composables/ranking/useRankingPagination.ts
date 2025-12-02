/**
 * 排行榜分頁和無限滾動 Composable
 */

import { ref, computed, onMounted, onBeforeUnmount, nextTick, Ref, ComputedRef } from 'vue';

/**
 * 載入排行榜函數類型
 */
type LoadRankingsFunction = (options: { reset: boolean }) => void | Promise<void>;

/**
 * Composable 返回類型
 */
interface RankingPaginationReturn {
  /** Sentinel 元素引用（用於 IntersectionObserver） */
  sentinelRef: Ref<HTMLElement | null>;
  /** 是否正在載入初始數據 */
  isInitialLoading: ComputedRef<boolean>;
  /** 是否正在載入更多數據 */
  isLoadingMore: ComputedRef<boolean>;
  /** 附加 Observer */
  attachObserver: () => void;
  /** 重新附加 Observer */
  reattachObserver: () => Promise<void>;
  /** 分離 Observer */
  detachObserver: () => void;
}

/**
 * 排行榜分頁 Composable
 *
 * @param loadRankings - 載入排行榜數據的函數
 * @param loading - 載入狀態（響應式引用）
 * @param hasMore - 是否有更多數據（響應式引用）
 * @returns 分頁相關的狀態和方法
 */
export function useRankingPagination(
  loadRankings: LoadRankingsFunction,
  loading: Ref<boolean>,
  hasMore: Ref<boolean>
): RankingPaginationReturn {
  const sentinelRef = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | null = null;

  /**
   * 是否正在載入初始數據
   */
  // ✅ 修復：邏輯錯誤 - `!hasMore.value === false` 會被解析為 `(!hasMore.value) === false`
  // 正確邏輯：初始載入時 hasMore 應該為 false（還沒有加載過數據）
  const isInitialLoading = computed<boolean>(
    () =>
      loading.value &&
      hasMore.value === false &&
      sentinelRef.value === null
  );

  /**
   * 是否正在載入更多
   */
  const isLoadingMore = computed<boolean>(
    () => loading.value && hasMore.value && sentinelRef.value !== null
  );

  /**
   * 分離 Observer
   */
  const detachObserver = (): void => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  /**
   * 附加 Observer（無限滾動）
   */
  const attachObserver = (): void => {
    detachObserver();

    if (!sentinelRef.value) {
      return;
    }

    observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        const entry = entries[0];
        if (
          entry &&
          entry.isIntersecting &&
          hasMore.value &&
          !loading.value
        ) {
          loadRankings({ reset: false });
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      }
    );

    observer.observe(sentinelRef.value);
  };

  /**
   * 重新附加 Observer（當內容更新時調用）
   */
  const reattachObserver = async (): Promise<void> => {
    await nextTick();
    attachObserver();
  };

  /**
   * 掛載時附加 Observer
   */
  onMounted(() => {
    nextTick(() => {
      attachObserver();
    });
  });

  /**
   * 卸載時清理 Observer
   */
  onBeforeUnmount(() => {
    detachObserver();
  });

  return {
    sentinelRef,
    isInitialLoading,
    isLoadingMore,
    attachObserver,
    reattachObserver,
    detachObserver,
  };
}
