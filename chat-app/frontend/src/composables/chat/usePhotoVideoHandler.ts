/**
 * 照片和影片處理 Composable
 *
 * 管理照片選擇和影片生成相關的操作，包括：
 * - 照片選擇處理
 * - 影片卡使用
 * - 影片限制處理
 */

/**
 * 照片選擇器模態框數據
 */
export interface PhotoSelectorModal {
  useCard?: boolean;
  visible?: boolean;
}

/**
 * 影片生成選項
 */
export interface VideoGenerationOptions {
  useVideoCard: boolean;
  imageUrl: string;
}

/**
 * usePhotoVideoHandler 的依賴項
 */
export interface UsePhotoVideoHandlerDeps {
  /** 獲取當前用戶 ID */
  getCurrentUserId: () => string | null;
  /** 獲取照片選擇器模態框數據 */
  getPhotoSelectorModal: () => PhotoSelectorModal | null;
  /** 生成影片的方法 */
  generateVideo: (options: VideoGenerationOptions) => Promise<void>;
  /** 重新加載解鎖卡餘額 */
  loadTicketsBalance: (userId: string) => Promise<void>;
  /** 關閉照片選擇器 */
  closePhotoSelector: () => void;
  /** 關閉影片限制彈窗 */
  closeVideoLimit: () => void;
  /** 顯示照片選擇器 */
  showPhotoSelector: (useCard: boolean) => void;
  /** 導航到會員頁面 */
  navigateToMembership: () => void;
  /** 顯示錯誤提示 */
  showError: (message: string) => void;
}

/**
 * usePhotoVideoHandler 的返回類型
 */
export interface UsePhotoVideoHandlerReturn {
  /** 處理用戶選擇照片（從照片選擇器） */
  handlePhotoSelect: (imageUrl: string) => Promise<void>;
  /** 處理使用影片解鎖卡 */
  handleUseVideoUnlockCard: () => Promise<void>;
  /** 處理從影片模態框升級 */
  handleUpgradeFromVideoModal: () => void;
}

/**
 * 創建照片和影片處理 composable
 * @param deps - 依賴項
 * @returns 照片和影片處理相關的方法
 */
export function usePhotoVideoHandler(deps: UsePhotoVideoHandlerDeps): UsePhotoVideoHandlerReturn {
  const {
    getCurrentUserId,
    getPhotoSelectorModal,
    generateVideo,
    loadTicketsBalance,
    closePhotoSelector,
    closeVideoLimit,
    showPhotoSelector,
    navigateToMembership,
    showError,
  } = deps;

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 處理用戶選擇照片（從照片選擇器）
   * @param imageUrl - 圖片 URL
   * @returns {Promise<void>}
   */
  const handlePhotoSelect = async (imageUrl: string): Promise<void> => {
    try {
      // 根據標記決定是否使用影片卡
      const modalData = getPhotoSelectorModal();
      const useCard = modalData?.useCard ?? false;

      // 生成影片
      await generateVideo({
        useVideoCard: useCard,
        imageUrl: imageUrl,
      });

      // 成功後關閉選擇器
      closePhotoSelector();

      // ✅ 如果使用了影片卡，重新加載解鎖卡餘額
      if (useCard) {
        const userId = getCurrentUserId();
        if (userId) {
          await loadTicketsBalance(userId);
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '生成影片失敗');
      closePhotoSelector();
    }
  };

  /**
   * 處理使用影片解鎖卡
   * @returns {Promise<void>}
   */
  const handleUseVideoUnlockCard = async (): Promise<void> => {
    try {
      // 關閉模態框
      closeVideoLimit();

      // ✅ 顯示照片選擇器，讓用戶選擇照片（標記需要使用影片卡）
      // 實際的影片生成會在用戶選擇照片後（handlePhotoSelect）執行
      showPhotoSelector(true); // true = useCard
    } catch (error) {
      showError(error instanceof Error ? error.message : '使用影片卡失敗');
    }
  };

  /**
   * 處理從影片模態框升級
   * @returns {void}
   */
  const handleUpgradeFromVideoModal = (): void => {
    closeVideoLimit();
    navigateToMembership();
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 方法
    handlePhotoSelect,
    handleUseVideoUnlockCard,
    handleUpgradeFromVideoModal,
  };
}
