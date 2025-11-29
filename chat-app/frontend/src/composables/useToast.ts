/**
 * useToast.ts
 * Toast 通知系統 Composable（TypeScript 版本）
 */

import { ref, computed, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';

// ==================== 類型定義 ====================

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  title: string;
  isVisible: boolean;
}

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  title?: string;
}

export interface ShowToastExtraOptions {
  title?: string;
  duration?: number;
}

export interface UseToastReturn {
  // State
  toasts: ComputedRef<ToastItem[]>;
  hasToasts: ComputedRef<boolean>;

  // Actions
  showToast: (options: ToastOptions) => number;
  success: (message: string, options?: ShowToastExtraOptions) => number;
  error: (message: string, options?: ShowToastExtraOptions) => number;
  info: (message: string, options?: ShowToastExtraOptions) => number;
  warning: (message: string, options?: ShowToastExtraOptions) => number;
  dismissToast: (id: number) => void;
  dismissAll: () => void;
}

// ==================== 常量 ====================

export const TOAST_TYPES = {
  SUCCESS: 'success' as ToastType,
  ERROR: 'error' as ToastType,
  INFO: 'info' as ToastType,
  WARNING: 'warning' as ToastType,
};

// ==================== 狀態 ====================

const toasts: Ref<ToastItem[]> = ref([]);
let toastIdCounter = 0;

// ✅ 修復：追蹤所有定時器以便清理
const autoCloseTimers = new Map<number, ReturnType<typeof setTimeout>>();
const dismissAnimationTimers = new Map<number, ReturnType<typeof setTimeout>>();
let dismissAllTimer: ReturnType<typeof setTimeout> | null = null;

// ==================== Composable 主函數 ====================

/**
 * Toast 通知系統 composable
 * 用於顯示成功、錯誤、資訊和警告訊息
 */
export function useToast(): UseToastReturn {
  /**
   * 顯示 toast
   * @param options - Toast 選項
   */
  const showToast = (options: ToastOptions): number => {
    const {
      message,
      type = TOAST_TYPES.INFO,
      duration = 3000,
      title = '',
    } = options;

    const id = ++toastIdCounter;
    const toast: ToastItem = {
      id,
      message,
      type,
      title,
      isVisible: true,
    };

    toasts.value.push(toast);

    // 自動關閉
    // ✅ 修復：追蹤定時器
    if (duration > 0) {
      const timerId = setTimeout(() => {
        autoCloseTimers.delete(id);
        dismissToast(id);
      }, duration);
      autoCloseTimers.set(id, timerId);
    }

    return id;
  };

  /**
   * 顯示成功訊息
   * @param message - 訊息內容
   * @param options - 額外選項
   */
  const success = (message: string, options: ShowToastExtraOptions = {}): number => {
    return showToast({
      message,
      type: TOAST_TYPES.SUCCESS,
      title: options.title || '成功',
      duration: options.duration ?? 1000,
    });
  };

  /**
   * 顯示錯誤訊息
   * @param message - 訊息內容
   * @param options - 額外選項
   */
  const error = (message: string, options: ShowToastExtraOptions = {}): number => {
    return showToast({
      message,
      type: TOAST_TYPES.ERROR,
      title: options.title || '錯誤',
      duration: options.duration ?? 5000,
    });
  };

  /**
   * 顯示資訊訊息
   * @param message - 訊息內容
   * @param options - 額外選項
   */
  const info = (message: string, options: ShowToastExtraOptions = {}): number => {
    return showToast({
      message,
      type: TOAST_TYPES.INFO,
      title: options.title || '提示',
      duration: options.duration ?? 3000,
    });
  };

  /**
   * 顯示警告訊息
   * @param message - 訊息內容
   * @param options - 額外選項
   */
  const warning = (message: string, options: ShowToastExtraOptions = {}): number => {
    return showToast({
      message,
      type: TOAST_TYPES.WARNING,
      title: options.title || '警告',
      duration: options.duration ?? 4000,
    });
  };

  /**
   * 關閉指定的 toast
   * @param id - Toast ID
   */
  const dismissToast = (id: number): void => {
    const index = toasts.value.findIndex(toast => toast.id === id);
    if (index !== -1) {
      toasts.value[index].isVisible = false;
      // ✅ 修復：清理自動關閉定時器
      const autoCloseTimer = autoCloseTimers.get(id);
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        autoCloseTimers.delete(id);
      }
      // ✅ 修復：清理之前的動畫定時器（如果存在）
      const existingAnimTimer = dismissAnimationTimers.get(id);
      if (existingAnimTimer) {
        clearTimeout(existingAnimTimer);
      }
      // 延遲移除以允許動畫完成
      // ✅ 修復：追蹤動畫定時器
      const animTimerId = setTimeout(() => {
        dismissAnimationTimers.delete(id);
        toasts.value = toasts.value.filter(toast => toast.id !== id);
      }, 300);
      dismissAnimationTimers.set(id, animTimerId);
    }
  };

  /**
   * 關閉所有 toast
   */
  const dismissAll = (): void => {
    // ✅ 修復：清理所有自動關閉定時器
    autoCloseTimers.forEach((timer) => clearTimeout(timer));
    autoCloseTimers.clear();
    // ✅ 修復：清理所有動畫定時器
    dismissAnimationTimers.forEach((timer) => clearTimeout(timer));
    dismissAnimationTimers.clear();

    toasts.value.forEach(toast => {
      toast.isVisible = false;
    });

    // ✅ 修復：清理之前的 dismissAll 定時器
    if (dismissAllTimer) {
      clearTimeout(dismissAllTimer);
    }
    dismissAllTimer = setTimeout(() => {
      dismissAllTimer = null;
      toasts.value = [];
    }, 300);
  };

  // Computed
  const activeToasts = computed(() => toasts.value);
  const hasToasts = computed(() => toasts.value.length > 0);

  // ✅ 修復：組件卸載時清理所有定時器
  onBeforeUnmount(() => {
    // 清理自動關閉定時器
    autoCloseTimers.forEach((timer) => clearTimeout(timer));
    autoCloseTimers.clear();
    // 清理動畫定時器
    dismissAnimationTimers.forEach((timer) => clearTimeout(timer));
    dismissAnimationTimers.clear();
    // 清理 dismissAll 定時器
    if (dismissAllTimer) {
      clearTimeout(dismissAllTimer);
      dismissAllTimer = null;
    }
  });

  return {
    // State
    toasts: activeToasts,
    hasToasts,

    // Actions
    showToast,
    success,
    error,
    info,
    warning,
    dismissToast,
    dismissAll,
  };
}
