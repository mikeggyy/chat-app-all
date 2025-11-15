/**
 * useGlobalLoading.ts
 * 全局加載狀態 Composable（TypeScript 版本）
 * 管理全局加載指示器的顯示和隱藏
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue';

// ==================== 類型定義 ====================

/**
 * withGlobalLoading 選項
 */
export interface WithGlobalLoadingOptions {
  skipGlobalLoading?: boolean;
}

/**
 * useGlobalLoading 返回類型
 */
export interface UseGlobalLoadingReturn {
  isGlobalLoading: ComputedRef<boolean>;
  startLoading: () => void;
  stopLoading: () => void;
  withGlobalLoading: <T>(fn: () => T | Promise<T>, options?: WithGlobalLoadingOptions) => Promise<T>;
  temporarilyDisable: <T>(fn?: () => T | Promise<T>) => Promise<T | void>;
}

// ==================== 全局狀態 ====================

const activeRequests: Ref<number> = ref(0);
const isForcedHidden: Ref<boolean> = ref(false);

const isGlobalLoading: ComputedRef<boolean> = computed(
  () => !isForcedHidden.value && activeRequests.value > 0
);

// ==================== 工具函數 ====================

/**
 * 開始加載
 */
const startLoading = (): void => {
  activeRequests.value += 1;
};

/**
 * 停止加載
 */
const stopLoading = (): void => {
  if (activeRequests.value > 0) {
    activeRequests.value -= 1;
  }
};

/**
 * 包裝函數並自動管理加載狀態
 * @param fn - 要執行的函數
 * @param options - 選項
 * @returns 函數執行結果
 */
const withGlobalLoading = async <T>(
  fn: () => T | Promise<T>,
  options: WithGlobalLoadingOptions = {}
): Promise<T> => {
  const { skipGlobalLoading } = options;

  if (skipGlobalLoading) {
    return Promise.resolve(fn());
  }

  startLoading();
  try {
    return await fn();
  } finally {
    stopLoading();
  }
};

/**
 * 暫時禁用全局加載指示器
 * @param fn - 要執行的函數
 * @returns 函數執行結果
 */
const temporarilyDisable = async <T>(
  fn?: () => T | Promise<T>
): Promise<T | void> => {
  isForcedHidden.value = true;
  try {
    return fn ? await fn() : undefined;
  } finally {
    isForcedHidden.value = false;
  }
};

// ==================== Composable 主函數 ====================

/**
 * 全局加載狀態 composable
 */
export const useGlobalLoading = (): UseGlobalLoadingReturn => ({
  isGlobalLoading,
  startLoading,
  stopLoading,
  withGlobalLoading,
  temporarilyDisable,
});

// ==================== 命名導出（向後兼容） ====================

export { isGlobalLoading, withGlobalLoading, temporarilyDisable };
