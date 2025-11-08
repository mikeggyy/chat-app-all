import { ref, computed } from 'vue';

// Toast 類型
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
};

// Toast 狀態
const toasts = ref([]);
let toastIdCounter = 0;

/**
 * Toast 通知系統 composable
 * 用於顯示成功、錯誤、資訊和警告訊息
 */
export function useToast() {
  /**
   * 顯示 toast
   * @param {object} options - Toast 選項
   * @param {string} options.message - 訊息內容
   * @param {string} options.type - Toast 類型 (success, error, info, warning)
   * @param {number} options.duration - 顯示時長（毫秒），0 表示不自動關閉
   * @param {string} options.title - 標題（可選）
   */
  const showToast = (options) => {
    const {
      message,
      type = TOAST_TYPES.INFO,
      duration = 3000,
      title = '',
    } = options;

    const id = ++toastIdCounter;
    const toast = {
      id,
      message,
      type,
      title,
      isVisible: true,
    };

    toasts.value.push(toast);

    // 自動關閉
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  };

  /**
   * 顯示成功訊息
   * @param {string} message - 訊息內容
   * @param {object} options - 額外選項
   */
  const success = (message, options = {}) => {
    return showToast({
      message,
      type: TOAST_TYPES.SUCCESS,
      title: options.title || '成功',
      duration: options.duration ?? 1000,
    });
  };

  /**
   * 顯示錯誤訊息
   * @param {string} message - 訊息內容
   * @param {object} options - 額外選項
   */
  const error = (message, options = {}) => {
    return showToast({
      message,
      type: TOAST_TYPES.ERROR,
      title: options.title || '錯誤',
      duration: options.duration ?? 5000,
    });
  };

  /**
   * 顯示資訊訊息
   * @param {string} message - 訊息內容
   * @param {object} options - 額外選項
   */
  const info = (message, options = {}) => {
    return showToast({
      message,
      type: TOAST_TYPES.INFO,
      title: options.title || '提示',
      duration: options.duration ?? 3000,
    });
  };

  /**
   * 顯示警告訊息
   * @param {string} message - 訊息內容
   * @param {object} options - 額外選項
   */
  const warning = (message, options = {}) => {
    return showToast({
      message,
      type: TOAST_TYPES.WARNING,
      title: options.title || '警告',
      duration: options.duration ?? 4000,
    });
  };

  /**
   * 關閉指定的 toast
   * @param {number} id - Toast ID
   */
  const dismissToast = (id) => {
    const index = toasts.value.findIndex(toast => toast.id === id);
    if (index !== -1) {
      toasts.value[index].isVisible = false;
      // 延遲移除以允許動畫完成
      setTimeout(() => {
        toasts.value = toasts.value.filter(toast => toast.id !== id);
      }, 300);
    }
  };

  /**
   * 關閉所有 toast
   */
  const dismissAll = () => {
    toasts.value.forEach(toast => {
      toast.isVisible = false;
    });
    setTimeout(() => {
      toasts.value = [];
    }, 300);
  };

  // Computed
  const activeToasts = computed(() => toasts.value);
  const hasToasts = computed(() => toasts.value.length > 0);

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
