/**
 * useAvatarUpload Composable
 *
 * 負責頭像上傳和更新的邏輯處理
 */

import { ref, Ref } from "vue";
import { FALLBACK_USER } from "../config/profile";
import { logger } from "../utils/logger";

/**
 * 頭像更新回調函數的返回類型
 */
interface AvatarUpdateResult {
  photoURL?: string;
  [key: string]: unknown;
}

/**
 * useAvatarUpload Composable 的配置選項
 */
interface UseAvatarUploadOptions {
  onUpdate: (url: string) => Promise<AvatarUpdateResult>;
  avatarPreview: Ref<string>;
}

/**
 * 頭像上傳 Composable 的返回類型
 */
interface UseAvatarUploadReturn {
  // 狀態
  isModalOpen: Ref<boolean>;
  isSaving: Ref<boolean>;
  isImageLoading: Ref<boolean>;

  // 方法
  openEditor: () => void;
  closeEditor: () => void;
  handleUpdate: (nextUrl: string) => Promise<void>;
  handleLoad: () => void;
  handleError: () => void;
}

/**
 * 頭像上傳 Composable
 * @param {Object} options - 配置選項
 * @param {Function} options.onUpdate - 更新頭像回調函數
 * @param {Object} options.avatarPreview - 頭像預覽 ref
 * @returns {Object} 頭像上傳狀態和方法
 */
export function useAvatarUpload({
  onUpdate,
  avatarPreview,
}: UseAvatarUploadOptions): UseAvatarUploadReturn {
  // ==================== 狀態管理 ====================

  const isModalOpen: Ref<boolean> = ref(false);
  const isSaving: Ref<boolean> = ref(false);
  const isImageLoading: Ref<boolean> = ref(true);

  // ==================== 方法 ====================

  /**
   * 打開頭像編輯器
   */
  const openEditor = (): void => {
    isModalOpen.value = true;
  };

  /**
   * 關閉頭像編輯器
   */
  const closeEditor = (): void => {
    isModalOpen.value = false;
  };

  /**
   * 處理頭像更新
   * @param {string} nextUrl - 新頭像 URL
   */
  const handleUpdate = async (nextUrl: string): Promise<void> => {
    if (isSaving.value) return;
    if (typeof nextUrl !== "string" || !nextUrl.length) {
      closeEditor();
      return;
    }

    const previousPhoto: string = avatarPreview.value;
    isImageLoading.value = true;
    avatarPreview.value = nextUrl;

    const isDataUrl: boolean = nextUrl.startsWith("data:");

    // 如果是 data URL，直接顯示預覽並關閉編輯器
    if (isDataUrl) {
      // ✅ 修復：data URL 不需要網路載入，直接設置為載入完成
      isImageLoading.value = false;
      closeEditor();
      return;
    }

    // 保存到服務器
    isSaving.value = true;

    try {
      const updated: AvatarUpdateResult = await onUpdate(nextUrl);
      if (updated?.photoURL && updated.photoURL !== avatarPreview.value) {
        isImageLoading.value = true;
        avatarPreview.value = updated.photoURL;
      }
      closeEditor();
    } catch (error) {
      avatarPreview.value = previousPhoto;
      isImageLoading.value = false;
      logger.error("[useAvatarUpload] 更新失敗:", error);
      throw error;
    } finally {
      isSaving.value = false;
    }
  };

  /**
   * 處理頭像載入完成
   */
  const handleLoad = (): void => {
    isImageLoading.value = false;
  };

  /**
   * 處理頭像載入錯誤
   */
  const handleError = (): void => {
    if (avatarPreview.value !== FALLBACK_USER.photoURL) {
      isImageLoading.value = true;
      avatarPreview.value = FALLBACK_USER.photoURL;
      return;
    }
    isImageLoading.value = false;
  };

  // ==================== 返回 ====================

  return {
    // 狀態
    isModalOpen,
    isSaving,
    isImageLoading,

    // 方法
    openEditor,
    closeEditor,
    handleUpdate,
    handleLoad,
    handleError,
  };
}
