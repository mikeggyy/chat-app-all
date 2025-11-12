import { ref } from 'vue';

/**
 * 照片編輯模式管理
 * 處理編輯模式的進入/退出、選擇邏輯
 */
export function usePhotoEditMode() {
  const isEditMode = ref(false);
  const selectedIds = ref(new Set());

  /**
   * 進入編輯模式
   */
  const enterEditMode = () => {
    isEditMode.value = true;
    selectedIds.value = new Set();
  };

  /**
   * 取消編輯模式
   */
  const cancelEditMode = () => {
    isEditMode.value = false;
    selectedIds.value = new Set();
  };

  /**
   * 切換選擇狀態
   * @param {string} photoId - 照片 ID
   */
  const toggleSelection = (photoId) => {
    const newSet = new Set(selectedIds.value);
    if (newSet.has(photoId)) {
      newSet.delete(photoId);
    } else {
      newSet.add(photoId);
    }
    selectedIds.value = newSet;
  };

  /**
   * 處理照片點擊
   * @param {Object} photo - 照片對象
   * @param {Function} onView - 查看照片的回調
   */
  const handlePhotoClick = (photo, onView) => {
    if (isEditMode.value) {
      toggleSelection(photo.id);
    } else {
      onView(photo);
    }
  };

  return {
    // 狀態
    isEditMode,
    selectedIds,

    // 方法
    enterEditMode,
    cancelEditMode,
    toggleSelection,
    handlePhotoClick,
  };
}
