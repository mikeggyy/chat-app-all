import { ref } from 'vue';

const dialogState = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  resolve: null,
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
      };
    });
  };

  const handleConfirm = () => {
    if (dialogState.value.resolve) {
      dialogState.value.resolve(true);
    }
    dialogState.value.isOpen = false;
  };

  const handleCancel = () => {
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
