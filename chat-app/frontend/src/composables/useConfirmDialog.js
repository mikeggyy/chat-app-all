import { ref } from 'vue';

const dialogState = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: '確定',
  cancelText: '取消',
  resolve: null,
  reject: null,
});

export function useConfirmDialog() {
  const confirm = (message, options = {}) => {
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
    confirm,
    handleConfirm,
    handleCancel,
  };
}
