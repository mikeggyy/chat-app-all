import { ref, Ref, onBeforeUnmount } from 'vue';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 購買確認對話框狀態接口
 */
interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  resolve: ((value: boolean) => void) | null;
  isProcessing: boolean;
}

/**
 * 購買確認對話框選項接口
 */
interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

/**
 * usePurchaseConfirm 組合式的返回類型
 */
interface UsePurchaseConfirmReturn {
  dialogState: Ref<DialogState>;
  showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

// ============================================================================
// State
// ============================================================================

const dialogState: Ref<DialogState> = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  resolve: null,
  isProcessing: false, // ✅ 添加處理中狀態，防止重複點擊
});

// ============================================================================
// Composable
// ============================================================================

/**
 * 購買確認對話框組合式
 *
 * 提供購買前確認功能，包含防抖機制防止重複點擊
 *
 * @returns {UsePurchaseConfirmReturn} 包含對話框狀態和操作函數
 *
 * @example
 * ```typescript
 * import { usePurchaseConfirm } from '@/composables/usePurchaseConfirm';
 *
 * const { dialogState, showConfirm, handleConfirm, handleCancel } = usePurchaseConfirm();
 *
 * // 顯示確認對話框
 * const confirmed = await showConfirm('確定要購買這個禮物嗎？', {
 *   title: '購買禮物',
 *   confirmText: '購買',
 *   cancelText: '取消'
 * });
 *
 * if (confirmed) {
 *   // 執行購買邏輯
 * }
 * ```
 */
export function usePurchaseConfirm(): UsePurchaseConfirmReturn {
  // ✅ 修復：追蹤定時器以便清理
  let processingTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 顯示購買確認對話框
   *
   * 返回 Promise，當用戶確認時解析為 true，取消時解析為 false
   *
   * @param message - 對話框顯示的消息
   * @param options - 對話框配置選項
   * @returns Promise 解析為用戶的確認結果
   */
  const showConfirm = (message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve: (value: boolean) => void) => {
      dialogState.value = {
        isOpen: true,
        title: options.title || '確認購買',
        message,
        confirmText: options.confirmText || '確認購買',
        cancelText: options.cancelText || '取消',
        resolve,
        isProcessing: false, // 初始化為未處理
      };
    });
  };

  /**
   * 處理確認按鈕點擊
   *
   * 包含防抖機制：
   * - 如果正在處理中，忽略重複點擊
   * - 設置 1 秒冷卻時間，防止快速重複打開對話框
   */
  const handleConfirm = (): void => {
    // ✅ 防抖：如果正在處理，直接返回，防止重複點擊
    if (dialogState.value.isProcessing) {
      console.warn('[usePurchaseConfirm] 正在處理中，忽略重複點擊');
      return;
    }

    // 設置為處理中
    dialogState.value.isProcessing = true;

    if (dialogState.value.resolve) {
      dialogState.value.resolve(true);
    }

    // 關閉對話框（實際購買操作由調用方處理）
    dialogState.value.isOpen = false;

    // ✅ 延遲重置處理狀態，防止快速重複打開對話框
    // 給予足夠時間讓購買請求發送
    // ✅ 修復：清理之前的定時器並追蹤新定時器
    if (processingTimer) {
      clearTimeout(processingTimer);
    }
    processingTimer = setTimeout((): void => {
      processingTimer = null;
      dialogState.value.isProcessing = false;
    }, 1000); // 1 秒冷卻時間
  };

  /**
   * 處理取消按鈕點擊
   *
   * 取消時也檢查是否正在處理，防止在處理中取消
   */
  const handleCancel = (): void => {
    // ✅ 取消時也檢查是否正在處理
    if (dialogState.value.isProcessing) {
      console.warn('[usePurchaseConfirm] 正在處理中，無法取消');
      return;
    }

    if (dialogState.value.resolve) {
      dialogState.value.resolve(false);
    }
    dialogState.value.isOpen = false;
  };

  // ✅ 修復：組件卸載時清理定時器
  onBeforeUnmount(() => {
    if (processingTimer) {
      clearTimeout(processingTimer);
      processingTimer = null;
    }
  });

  return {
    dialogState,
    showConfirm,
    handleConfirm,
    handleCancel,
  };
}
