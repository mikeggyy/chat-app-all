/**
 * useConfirmDialog.ts
 * 確認對話框 Composable（TypeScript 版本）
 * 提供全局確認對話框功能
 */

import { ref, type Ref } from 'vue';

// ==================== 類型定義 ====================

/**
 * 對話框狀態
 */
export interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  resolve: ((value: boolean) => void) | null;
  reject: ((reason?: any) => void) | null;
}

/**
 * confirm 選項
 */
export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

/**
 * useConfirmDialog 返回類型
 */
export interface UseConfirmDialogReturn {
  dialogState: Ref<DialogState>;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

// ==================== 全局狀態 ====================

const dialogState: Ref<DialogState> = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: '確定',
  cancelText: '取消',
  resolve: null,
  reject: null,
});

// ==================== Composable 主函數 ====================

/**
 * 確認對話框 composable
 */
export function useConfirmDialog(): UseConfirmDialogReturn {
  /**
   * 顯示確認對話框
   * @param message - 對話框訊息
   * @param options - 配置選項
   * @returns Promise<boolean> - 用戶確認返回 true，取消返回 false
   */
  const confirm = (message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      dialogState.value = {
        isOpen: true,
        title: options.title || '確認操作',
        message,
        confirmText: options.confirmText || '確定',
        cancelText: options.cancelText || '取消',
        resolve,
        reject,
      };
    });
  };

  /**
   * 處理確認操作
   */
  const handleConfirm = (): void => {
    if (dialogState.value.resolve) {
      dialogState.value.resolve(true);
    }
    dialogState.value.isOpen = false;
  };

  /**
   * 處理取消操作
   */
  const handleCancel = (): void => {
    if (dialogState.value.resolve) {
      dialogState.value.resolve(false);
    }
    dialogState.value.isOpen = false;
  };

  return {
    dialogState,
    confirm,
    handleConfirm,
    handleCancel,
  };
}
