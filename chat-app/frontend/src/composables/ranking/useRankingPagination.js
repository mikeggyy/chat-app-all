/**
 * 排行榜分頁和無限滾動 Composable
 */

import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';

/**
 * 排行榜分頁 Composable
 */
export function useRankingPagination(loadRankings, loading, hasMore) {
  const sentinelRef = ref(null);
  let observer = null;

  /**
   * 是否正在載入初始數據
   */
  const isInitialLoading = computed(
    () =>
      loading.value &&
      !hasMore.value === false &&
      sentinelRef.value === null
  );

  /**
   * 是否正在載入更多
   */
  const isLoadingMore = computed(
    () => loading.value && hasMore.value && sentinelRef.value !== null
  );

  /**
   * 分離 Observer
   */
  const detachObserver = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  /**
   * 附加 Observer（無限滾動）
   */
  const attachObserver = () => {
    detachObserver();

    if (!sentinelRef.value) {
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
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
  const reattachObserver = async () => {
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
