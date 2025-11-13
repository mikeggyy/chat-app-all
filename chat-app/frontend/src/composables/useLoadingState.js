/**
 * 加載狀態管理 Composable
 * 提供細粒度的加載狀態追蹤，支援多個並發操作
 */

import { ref, computed } from 'vue';

/**
 * 創建加載狀態管理器
 * @param {Object} options - 選項
 * @param {Object} options.initialStates - 初始加載狀態（可選）
 * @returns {Object} 加載狀態管理器
 */
export function useLoadingState(options = {}) {
  const { initialStates = {} } = options;

  // 加載狀態 Map
  const loadingStates = ref(new Map(Object.entries(initialStates)));

  /**
   * 設置加載狀態
   * @param {string} key - 狀態鍵
   * @param {boolean} isLoading - 是否加載中
   */
  const setLoading = (key, isLoading) => {
    loadingStates.value.set(key, isLoading);
  };

  /**
   * 開始加載
   * @param {string} key - 狀態鍵
   */
  const startLoading = (key) => {
    setLoading(key, true);
  };

  /**
   * 停止加載
   * @param {string} key - 狀態鍵
   */
  const stopLoading = (key) => {
    setLoading(key, false);
  };

  /**
   * 檢查是否正在加載
   * @param {string} key - 狀態鍵
   * @returns {boolean}
   */
  const isLoading = (key) => {
    return loadingStates.value.get(key) || false;
  };

  /**
   * 檢查任意一個是否正在加載
   * @param {Array<string>} keys - 狀態鍵數組
   * @returns {boolean}
   */
  const isAnyLoading = (...keys) => {
    return keys.some((key) => isLoading(key));
  };

  /**
   * 檢查所有是否都在加載
   * @param {Array<string>} keys - 狀態鍵數組
   * @returns {boolean}
   */
  const isAllLoading = (...keys) => {
    return keys.every((key) => isLoading(key));
  };

  /**
   * 包裝異步函數，自動管理加載狀態
   * @param {string} key - 狀態鍵
   * @param {Function} asyncFn - 異步函數
   * @param {Object} options - 選項
   * @param {Function} options.onError - 錯誤處理回調
   * @param {Function} options.onSuccess - 成功回調
   * @param {Function} options.onFinally - 完成回調（無論成功失敗）
   * @returns {Function} 包裝後的函數
   */
  const withLoading = (key, asyncFn, options = {}) => {
    const { onError = null, onSuccess = null, onFinally = null } = options;

    return async (...args) => {
      startLoading(key);

      try {
        const result = await asyncFn(...args);

        if (onSuccess && typeof onSuccess === 'function') {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        if (onError && typeof onError === 'function') {
          onError(error);
        } else {
          throw error; // 如果沒有錯誤處理，重新拋出
        }
      } finally {
        stopLoading(key);

        if (onFinally && typeof onFinally === 'function') {
          onFinally();
        }
      }
    };
  };

  /**
   * 清除所有加載狀態
   */
  const clearAll = () => {
    loadingStates.value.clear();
  };

  /**
   * 清除指定的加載狀態
   * @param {Array<string>} keys - 要清除的狀態鍵
   */
  const clearStates = (...keys) => {
    keys.forEach((key) => {
      loadingStates.value.delete(key);
    });
  };

  // Computed: 是否有任何加載中的狀態
  const hasAnyLoading = computed(() => {
    return Array.from(loadingStates.value.values()).some((value) => value === true);
  });

  // Computed: 正在加載的狀態數量
  const loadingCount = computed(() => {
    return Array.from(loadingStates.value.values()).filter((value) => value === true).length;
  });

  return {
    // State
    loadingStates,
    hasAnyLoading,
    loadingCount,

    // Methods
    setLoading,
    startLoading,
    stopLoading,
    isLoading,
    isAnyLoading,
    isAllLoading,
    withLoading,
    clearAll,
    clearStates,
  };
}

/**
 * 創建按鈕加載狀態管理器（簡化版）
 * @returns {Object} 按鈕加載狀態管理器
 */
export function useButtonLoading() {
  const loading = useLoadingState();

  /**
   * 包裝按鈕點擊處理函數
   * @param {string} buttonId - 按鈕ID
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   * @returns {Function} 包裝後的處理函數
   */
  const wrapHandler = (buttonId, handler, options = {}) => {
    return loading.withLoading(buttonId, handler, options);
  };

  /**
   * 創建帶加載狀態的按鈕屬性
   * @param {string} buttonId - 按鈕ID
   * @returns {Object} { disabled, loading }
   */
  const getButtonProps = (buttonId) => {
    return {
      disabled: loading.isLoading(buttonId),
      loading: loading.isLoading(buttonId),
    };
  };

  return {
    isLoading: loading.isLoading,
    wrapHandler,
    getButtonProps,
  };
}

/**
 * 創建數據加載管理器
 * @returns {Object} 數據加載管理器
 */
export function useDataLoading() {
  const loading = useLoadingState();
  const errors = ref(new Map());
  const data = ref(new Map());

  /**
   * 加載數據
   * @param {string} key - 數據鍵
   * @param {Function} fetcher - 數據獲取函數
   * @param {Object} options - 選項
   * @param {boolean} options.cache - 是否緩存（默認 true）
   * @param {boolean} options.force - 是否強制重新加載（默認 false）
   * @returns {Promise} 數據
   */
  const loadData = async (key, fetcher, options = {}) => {
    const { cache = true, force = false } = options;

    // 檢查緩存
    if (!force && cache && data.value.has(key)) {
      return data.value.get(key);
    }

    // 清除之前的錯誤
    errors.value.delete(key);

    const wrappedFetcher = loading.withLoading(key, fetcher, {
      onSuccess: (result) => {
        if (cache) {
          data.value.set(key, result);
        }
      },
      onError: (error) => {
        errors.value.set(key, error);
        throw error;
      },
    });

    return wrappedFetcher();
  };

  /**
   * 獲取數據
   * @param {string} key - 數據鍵
   * @returns {*} 數據或 undefined
   */
  const getData = (key) => {
    return data.value.get(key);
  };

  /**
   * 獲取錯誤
   * @param {string} key - 數據鍵
   * @returns {Error|undefined} 錯誤或 undefined
   */
  const getError = (key) => {
    return errors.value.get(key);
  };

  /**
   * 清除數據和錯誤
   * @param {string} key - 數據鍵
   */
  const clearData = (key) => {
    data.value.delete(key);
    errors.value.delete(key);
  };

  /**
   * 刷新數據
   * @param {string} key - 數據鍵
   * @param {Function} fetcher - 數據獲取函數
   * @returns {Promise} 數據
   */
  const refreshData = (key, fetcher) => {
    return loadData(key, fetcher, { force: true });
  };

  return {
    loadData,
    getData,
    getError,
    clearData,
    refreshData,
    isLoading: loading.isLoading,
    hasError: (key) => errors.value.has(key),
    hasData: (key) => data.value.has(key),
  };
}

/**
 * 創建分頁加載管理器
 * @returns {Object} 分頁加載管理器
 */
export function usePaginatedLoading() {
  const loading = useLoadingState();
  const currentPage = ref(1);
  const hasMore = ref(true);
  const items = ref([]);

  /**
   * 加載下一頁
   * @param {Function} fetcher - 數據獲取函數，接收 (page) 參數
   * @param {Object} options - 選項
   * @param {boolean} options.append - 是否追加到現有項目（默認 true）
   * @param {boolean} options.reset - 是否重置列表（默認 false）
   * @returns {Promise} 數據
   */
  const loadNextPage = async (fetcher, options = {}) => {
    const { append = true, reset = false } = options;

    if (reset) {
      currentPage.value = 1;
      hasMore.value = true;
      items.value = [];
    }

    if (!hasMore.value) {
      return [];
    }

    const wrappedFetcher = loading.withLoading('page-load', async () => {
      const result = await fetcher(currentPage.value);

      // 假設 result 包含 { items, hasMore } 或直接是數組
      const newItems = Array.isArray(result) ? result : result.items || [];
      const hasMoreData = Array.isArray(result) ? newItems.length > 0 : result.hasMore !== false;

      if (append) {
        items.value.push(...newItems);
      } else {
        items.value = newItems;
      }

      hasMore.value = hasMoreData;
      currentPage.value += 1;

      return newItems;
    });

    return wrappedFetcher();
  };

  /**
   * 重新加載（從第一頁開始）
   * @param {Function} fetcher - 數據獲取函數
   * @returns {Promise} 數據
   */
  const reload = (fetcher) => {
    return loadNextPage(fetcher, { reset: true, append: false });
  };

  return {
    items,
    currentPage,
    hasMore,
    isLoading: () => loading.isLoading('page-load'),
    loadNextPage,
    reload,
  };
}

export default {
  useLoadingState,
  useButtonLoading,
  useDataLoading,
  usePaginatedLoading,
};
