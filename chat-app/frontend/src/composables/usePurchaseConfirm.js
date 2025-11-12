import { ref } from 'vue';

const dialogState = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  resolve: null,
  isProcessing: false, // ✅ 添加處理中狀態，防止重複點擊
});

export function usePurchaseConfirm() {
  const showConfirm = (message, options = {}) => {
    return new Promise((resolve) => {
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

  const handleConfirm = () => {
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
    setTimeout(() => {
      dialogState.value.isProcessing = false;
    }, 1000); // 1 秒冷卻時間
  };

  const handleCancel = () => {
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

  return {
    dialogState,
    showConfirm,
    handleConfirm,
    handleCancel,
  };
}
