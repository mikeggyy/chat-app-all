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
  activeRequestCount: ComputedRef<number>;
  startLoading: () => void;
  stopLoading: () => void;
  resetLoading: () => void;
  withGlobalLoading: <T>(fn: () => T | Promise<T>, options?: WithGlobalLoadingOptions) => Promise<T>;
  temporarilyDisable: <T>(fn?: () => T | Promise<T>) => Promise<T | void>;
}

// ==================== 全局狀態 ====================

const activeRequests: Ref<number> = ref(0);
const isForcedHidden: Ref<boolean> = ref(false);

// ✅ 修復：添加最大請求數限制，防止計數器失控
const MAX_ACTIVE_REQUESTS = 100;

const isGlobalLoading: ComputedRef<boolean> = computed(
  () => !isForcedHidden.value && activeRequests.value > 0
);

// ✅ 修復：暴露活動請求計數以便調試
const activeRequestCount: ComputedRef<number> = computed(() => activeRequests.value);

// ==================== 工具函數 ====================

/**
 * 開始加載
 * ✅ 修復：添加最大請求數限制，防止計數器失控
 */
const startLoading = (): void => {
  if (activeRequests.value < MAX_ACTIVE_REQUESTS) {
    activeRequests.value += 1;
  } else {
    console.warn('[useGlobalLoading] 達到最大活動請求數限制，可能存在計數器洩漏');
  }
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
 * 重置加載狀態
 * ✅ 修復：提供強制重置功能，用於計數器卡住時的恢復
 */
const resetLoading = (): void => {
  if (activeRequests.value !== 0) {
    console.warn(`[useGlobalLoading] 重置計數器，之前的值: ${activeRequests.value}`);
  }
  activeRequests.value = 0;
  isForcedHidden.value = false;
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
  activeRequestCount,
  startLoading,
  stopLoading,
  resetLoading,
  withGlobalLoading,
  temporarilyDisable,
});

// ==================== 命名導出（向後兼容） ====================

export { isGlobalLoading, activeRequestCount, withGlobalLoading, temporarilyDisable, resetLoading };
