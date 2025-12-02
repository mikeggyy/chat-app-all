/**
 * 加載狀態管理 Composable
 * 提供細粒度的加載狀態追蹤，支援多個並發操作
 */

import { ref, computed, Ref, ComputedRef } from 'vue';
import { logger } from '../utils/logger.js';

/**
 * 加載狀態管理選項
 */
interface LoadingStateOptions {
  initialStates?: Record<string, boolean>;
}

/**
 * 加載狀態管理器返回類型
 */
interface UseLoadingStateReturn {
  // State
  loadingStates: Ref<Map<string, boolean>>;
  hasAnyLoading: ComputedRef<boolean>;
  loadingCount: ComputedRef<number>;

  // Methods
  setLoading: (key: string, isLoading: boolean) => void;
  startLoading: (key: string) => void;
  stopLoading: (key: string) => void;
  isLoading: (key: string) => boolean;
  isAnyLoading: (...keys: string[]) => boolean;
  isAllLoading: (...keys: string[]) => boolean;
  withLoading: <T, Args extends any[]>(
    key: string,
    asyncFn: (...args: Args) => Promise<T>,
    options?: WithLoadingOptions<T>
  ) => (...args: Args) => Promise<T>;
  clearAll: () => void;
  clearStates: (...keys: string[]) => void;
}

/**
 * withLoading 函數的選項
 */
interface WithLoadingOptions<T> {
  onError?: ((error: Error) => void) | null;
  onSuccess?: ((result: T) => void) | null;
  onFinally?: (() => void) | null;
}

/**
 * 按鈕加載狀態管理器返回類型
 */
interface UseButtonLoadingReturn {
  isLoading: (buttonId: string) => boolean;
  wrapHandler: <T, Args extends any[]>(
    buttonId: string,
    handler: (...args: Args) => Promise<T>,
    options?: WithLoadingOptions<T>
  ) => (...args: Args) => Promise<T>;
  getButtonProps: (
    buttonId: string
  ) => {
    disabled: boolean;
    loading: boolean;
  };
}

/**
 * 數據加載管理器選項
 */
interface DataLoadingOptions {
  cache?: boolean;
  force?: boolean;
}

/**
 * 數據加載管理器返回類型
 */
interface UseDataLoadingReturn {
  loadData: <T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: DataLoadingOptions
  ) => Promise<T>;
  getData: <T = any>(key: string) => T | undefined;
  getError: (key: string) => Error | undefined;
  clearData: (key: string) => void;
  refreshData: <T>(key: string, fetcher: () => Promise<T>) => Promise<T>;
  isLoading: (key: string) => boolean;
  hasError: (key: string) => boolean;
  hasData: (key: string) => boolean;
}

/**
 * 分頁加載結果類型
 */
interface PaginatedLoadResult<T> {
  items: T[];
  hasMore?: boolean;
}

/**
 * 分頁加載選項
 */
interface PaginatedLoadingOptions {
  append?: boolean;
  reset?: boolean;
}

/**
 * 分頁加載管理器返回類型
 */
interface UsePaginatedLoadingReturn<T = any> {
  items: Ref<T[]>;
  currentPage: Ref<number>;
  hasMore: Ref<boolean>;
  isLoading: () => boolean;
  loadNextPage: (
    fetcher: (page: number) => Promise<T[] | PaginatedLoadResult<T>>,
    options?: PaginatedLoadingOptions
  ) => Promise<T[]>;
  reload: (
    fetcher: (page: number) => Promise<T[] | PaginatedLoadResult<T>>
  ) => Promise<T[]>;
}

/**
 * 創建加載狀態管理器
 * @param {LoadingStateOptions} options - 選項
 * @returns {UseLoadingStateReturn} 加載狀態管理器
 */
export function useLoadingState(
  options: LoadingStateOptions = {}
): UseLoadingStateReturn {
  const { initialStates = {} } = options;

  // 加載狀態 Map
  const loadingStates: Ref<Map<string, boolean>> = ref(
    new Map(Object.entries(initialStates))
  );

  /**
   * 設置加載狀態
   */
  const setLoading = (key: string, isLoading: boolean): void => {
    loadingStates.value.set(key, isLoading);
  };

  /**
   * 開始加載
   */
  const startLoading = (key: string): void => {
    setLoading(key, true);
  };

  /**
   * 停止加載
   */
  const stopLoading = (key: string): void => {
    setLoading(key, false);
  };

  /**
   * 檢查是否正在加載
   */
  const isLoading = (key: string): boolean => {
    return loadingStates.value.get(key) || false;
  };

  /**
   * 檢查任意一個是否正在加載
   */
  const isAnyLoading = (...keys: string[]): boolean => {
    return keys.some((key) => isLoading(key));
  };

  /**
   * 檢查所有是否都在加載
   */
  const isAllLoading = (...keys: string[]): boolean => {
    return keys.every((key) => isLoading(key));
  };

  /**
   * 包裝異步函數，自動管理加載狀態
   */
  const withLoading = <T, Args extends any[]>(
    key: string,
    asyncFn: (...args: Args) => Promise<T>,
    options: WithLoadingOptions<T> = {}
  ): ((...args: Args) => Promise<T>) => {
    const { onError = null, onSuccess = null, onFinally = null } = options;

    return async (...args: Args): Promise<T> => {
      startLoading(key);

      try {
        const result = await asyncFn(...args);

        if (onSuccess && typeof onSuccess === 'function') {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        // ✅ 修復：統一錯誤處理邏輯，使行為更清晰
        // onError 是可選的錯誤回調，用於日誌記錄等副作用
        // 錯誤始終會被重新拋出，讓調用者能夠處理
        if (onError && typeof onError === 'function') {
          try {
            onError(error as Error);
          } catch (callbackError) {
            logger.error('[useLoadingState] onError callback threw:', callbackError);
          }
        }
        throw error;
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
  const clearAll = (): void => {
    loadingStates.value.clear();
  };

  /**
   * 清除指定的加載狀態
   */
  const clearStates = (...keys: string[]): void => {
    keys.forEach((key) => {
      loadingStates.value.delete(key);
    });
  };

  // Computed: 是否有任何加載中的狀態
  const hasAnyLoading: ComputedRef<boolean> = computed(() => {
    return Array.from(loadingStates.value.values()).some((value) => value === true);
  });

  // Computed: 正在加載的狀態數量
  const loadingCount: ComputedRef<number> = computed(() => {
    return Array.from(loadingStates.value.values()).filter(
      (value) => value === true
    ).length;
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
 * @returns {UseButtonLoadingReturn} 按鈕加載狀態管理器
 */
export function useButtonLoading(): UseButtonLoadingReturn {
  const loading = useLoadingState();

  /**
   * 包裝按鈕點擊處理函數
   */
  const wrapHandler = <T, Args extends any[]>(
    buttonId: string,
    handler: (...args: Args) => Promise<T>,
    options: WithLoadingOptions<T> = {}
  ): ((...args: Args) => Promise<T>) => {
    return loading.withLoading(buttonId, handler, options);
  };

  /**
   * 創建帶加載狀態的按鈕屬性
   */
  const getButtonProps = (
    buttonId: string
  ): {
    disabled: boolean;
    loading: boolean;
  } => {
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
 * @returns {UseDataLoadingReturn} 數據加載管理器
 */
export function useDataLoading(): UseDataLoadingReturn {
  const loading = useLoadingState();
  const errors: Ref<Map<string, Error>> = ref(new Map());
  const data: Ref<Map<string, any>> = ref(new Map());

  /**
   * 加載數據
   */
  const loadData = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options: DataLoadingOptions = {}
  ): Promise<T> => {
    const { cache = true, force = false } = options;

    // 檢查緩存
    if (!force && cache && data.value.has(key)) {
      return data.value.get(key) as T;
    }

    // 清除之前的錯誤
    errors.value.delete(key);

    const wrappedFetcher = loading.withLoading(key, fetcher, {
      onSuccess: (result: T) => {
        if (cache) {
          data.value.set(key, result);
        }
      },
      // ✅ 修復：onError 只用於記錄錯誤，不再重複 throw
      // withLoading 會自動重新拋出錯誤
      onError: (error: Error) => {
        errors.value.set(key, error);
      },
    });

    return wrappedFetcher();
  };

  /**
   * 獲取數據
   */
  const getData = <T = any>(key: string): T | undefined => {
    return data.value.get(key) as T | undefined;
  };

  /**
   * 獲取錯誤
   */
  const getError = (key: string): Error | undefined => {
    return errors.value.get(key);
  };

  /**
   * 清除數據和錯誤
   */
  const clearData = (key: string): void => {
    data.value.delete(key);
    errors.value.delete(key);
  };

  /**
   * 刷新數據
   */
  const refreshData = <T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> => {
    return loadData(key, fetcher, { force: true });
  };

  return {
    loadData,
    getData,
    getError,
    clearData,
    refreshData,
    isLoading: loading.isLoading,
    hasError: (key: string): boolean => errors.value.has(key),
    hasData: (key: string): boolean => data.value.has(key),
  };
}

/**
 * 創建分頁加載管理器
 * @returns {UsePaginatedLoadingReturn} 分頁加載管理器
 */
export function usePaginatedLoading<T = any>(): UsePaginatedLoadingReturn<T> {
  const loading = useLoadingState();
  const currentPage: Ref<number> = ref(1);
  const hasMore: Ref<boolean> = ref(true);
  const items: Ref<T[]> = ref([]);

  /**
   * 加載下一頁
   */
  const loadNextPage = async (
    fetcher: (page: number) => Promise<T[] | PaginatedLoadResult<T>>,
    options: PaginatedLoadingOptions = {}
  ): Promise<T[]> => {
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
      const newItems: T[] = Array.isArray(result)
        ? result
        : (result.items || []);
      const hasMoreData: boolean = Array.isArray(result)
        ? newItems.length > 0
        : (result.hasMore !== false);

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
   */
  const reload = (
    fetcher: (page: number) => Promise<T[] | PaginatedLoadResult<T>>
  ): Promise<T[]> => {
    return loadNextPage(fetcher, { reset: true, append: false });
  };

  return {
    items,
    currentPage,
    hasMore,
    isLoading: (): boolean => loading.isLoading('page-load'),
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
