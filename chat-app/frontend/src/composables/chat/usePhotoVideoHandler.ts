/**
 * 照片和影片處理 Composable
 *
 * 管理照片選擇和影片生成相關的操作，包括：
 * - 照片選擇處理
 * - 影片卡使用
 * - 影片限制處理
 */

import { onBeforeUnmount } from 'vue';

/**
 * 照片選擇器模態框數據
 */
export interface PhotoSelectorModal {
  useCard?: boolean;
  visible?: boolean;
  forGift?: boolean; // ✅ 標記是否用於送禮物
  pendingGift?: GiftData | null; // ✅ 待發送的禮物數據
}

/**
 * 影片生成選項
 */
export interface VideoGenerationOptions {
  useVideoCard: boolean;
  imageUrl: string;
}

/**
 * 禮物數據
 */
export interface GiftData {
  giftId: string;
  [key: string]: any;
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

  // ✅ 新增:禮物相關依賴
  /** 發送禮物 */
  sendGift: (giftData: GiftData, onSuccess: () => void, selectedPhotoUrl?: string) => Promise<void>;
  /** 重新加載用戶餘額 */
  loadBalance: (userId: string) => Promise<void>;
  /** 顯示禮物動畫 */
  showGiftAnimation: (emoji: string, name: string) => void;
  /** 關閉禮物動畫 */
  closeGiftAnimation: () => void;
  /** 根據 ID 獲取禮物 */
  getGiftById: (giftId: string) => any;
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
    // ✅ 新增:禮物相關依賴
    sendGift,
    loadBalance,
    showGiftAnimation,
    closeGiftAnimation,
    getGiftById,
  } = deps;

  // ✅ 修復：追蹤禮物動畫定時器以便清理
  let giftAnimationTimer: ReturnType<typeof setTimeout> | null = null;

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 處理用戶選擇照片（從照片選擇器）
   * 支援兩種模式：影片生成 和 禮物照片選擇
   * @param imageUrl - 圖片 URL
   * @returns {Promise<void>}
   */
  const handlePhotoSelect = async (imageUrl: string): Promise<void> => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        showError('用戶未登入');
        closePhotoSelector();
        return;
      }

      // 獲取模態框數據
      const modalData = getPhotoSelectorModal();
      const forGift = modalData?.forGift ?? false;
      const pendingGift = modalData?.pendingGift;
      const useCard = modalData?.useCard ?? false;

      // ✅ 禮物模式：發送禮物並使用選擇的照片
      if (forGift && pendingGift) {
        // 獲取禮物資訊用於動畫
        const gift = getGiftById(pendingGift.giftId);
        if (gift) {
          // 立即顯示禮物動畫
          showGiftAnimation(gift.emoji, gift.name);

          // ✅ 修復：清理之前的定時器（如果存在）
          if (giftAnimationTimer) {
            clearTimeout(giftAnimationTimer);
          }
          // 2秒後自動隱藏動畫
          // ✅ 修復：追蹤定時器
          giftAnimationTimer = setTimeout(() => {
            giftAnimationTimer = null;
            closeGiftAnimation();
          }, 2000);
        }

        // 發送禮物（帶選擇的照片 URL）
        await sendGift(
          pendingGift,
          () => {
            // On success - 動畫已經在顯示，不需要再做處理
          },
          imageUrl // ✅ 傳遞選擇的照片 URL
        );

        // 重新加載餘額
        await loadBalance(userId);

        // 關閉照片選擇器
        closePhotoSelector();
      }
      // ✅ 影片模式：生成影片
      else {
        // 生成影片
        await generateVideo({
          useVideoCard: useCard,
          imageUrl: imageUrl,
        });

        // 成功後關閉選擇器
        closePhotoSelector();

        // 如果使用了影片卡，重新加載解鎖卡餘額
        if (useCard) {
          await loadTicketsBalance(userId);
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '操作失敗');
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

  // ✅ 修復：組件卸載時清理定時器
  onBeforeUnmount(() => {
    if (giftAnimationTimer) {
      clearTimeout(giftAnimationTimer);
      giftAnimationTimer = null;
    }
  });

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
