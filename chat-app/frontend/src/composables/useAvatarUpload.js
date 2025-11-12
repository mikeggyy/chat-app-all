/**
 * useAvatarUpload Composable
 *
 * 負責頭像上傳和更新的邏輯處理
 */

import { ref } from "vue";
import { FALLBACK_USER } from "../config/profile";
import { logger } from "../utils/logger";

/**
 * 頭像上傳 Composable
 * @param {Object} options - 配置選項
 * @param {Function} options.onUpdate - 更新頭像回調函數
 * @param {Object} options.avatarPreview - 頭像預覽 ref
 * @returns {Object} 頭像上傳狀態和方法
 */
export function useAvatarUpload({ onUpdate, avatarPreview }) {
  // ==================== 狀態管理 ====================

  const isModalOpen = ref(false);
  const isSaving = ref(false);
  const isImageLoading = ref(true);

  // ==================== 方法 ====================

  /**
   * 打開頭像編輯器
   */
  const openEditor = () => {
    isModalOpen.value = true;
  };

  /**
   * 關閉頭像編輯器
   */
  const closeEditor = () => {
    isModalOpen.value = false;
  };

  /**
   * 處理頭像更新
   * @param {string} nextUrl - 新頭像 URL
   */
  const handleUpdate = async (nextUrl) => {
    if (isSaving.value) return;
    if (typeof nextUrl !== "string" || !nextUrl.length) {
      closeEditor();
      return;
    }

    const previousPhoto = avatarPreview.value;
    isImageLoading.value = true;
    avatarPreview.value = nextUrl;

    const isDataUrl = nextUrl.startsWith("data:");

    // 如果是 data URL，直接顯示預覽並關閉編輯器
    if (isDataUrl) {
      closeEditor();
      return;
    }

    // 保存到服務器
    isSaving.value = true;

    try {
      const updated = await onUpdate(nextUrl);
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
  const handleLoad = () => {
    isImageLoading.value = false;
  };

  /**
   * 處理頭像載入錯誤
   */
  const handleError = () => {
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
