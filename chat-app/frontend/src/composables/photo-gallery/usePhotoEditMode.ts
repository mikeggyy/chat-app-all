import { ref, type Ref } from 'vue';

/**
 * Minimal photo interface for edit mode operations
 * Compatible with both Message and Photo types
 */
export interface PhotoItem {
  id?: string;
}

/**
 * 照片編輯模式 - 相依項接口
 */
export interface PhotoEditModeDependencies {
  // 可選的外部相依項（未來擴展用）
}

/**
 * 照片編輯模式返回類型
 */
export interface PhotoEditModeReturn {
  // 狀態
  isEditMode: Ref<boolean>;
  selectedIds: Ref<Set<string>>;

  // 方法
  enterEditMode: () => void;
  cancelEditMode: () => void;
  toggleSelection: (photoId: string) => void;
  handlePhotoClick: <T extends PhotoItem>(photo: T, onView: (photo: T) => void) => void;
}

/**
 * 照片編輯模式管理
 * 處理編輯模式的進入/退出、選擇邏輯
 */
export function usePhotoEditMode(
  _deps?: PhotoEditModeDependencies
): PhotoEditModeReturn {
  const isEditMode = ref<boolean>(false);
  const selectedIds = ref<Set<string>>(new Set());

  /**
   * 進入編輯模式
   */
  const enterEditMode = (): void => {
    isEditMode.value = true;
    selectedIds.value = new Set();
  };

  /**
   * 取消編輯模式
   */
  const cancelEditMode = (): void => {
    isEditMode.value = false;
    selectedIds.value = new Set();
  };

  /**
   * 切換選擇狀態
   * @param photoId - 照片 ID
   */
  const toggleSelection = (photoId: string): void => {
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
   * @param photo - 照片對象
   * @param onView - 查看照片的回調
   */
  const handlePhotoClick = <T extends PhotoItem>(photo: T, onView: (photo: T) => void): void => {
    if (isEditMode.value && photo.id) {
      toggleSelection(photo.id);
    } else if (!isEditMode.value) {
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
