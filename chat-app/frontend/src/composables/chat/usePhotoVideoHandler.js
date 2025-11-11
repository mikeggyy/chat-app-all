/**
 * 照片和影片處理 Composable
 *
 * 管理照片選擇和影片生成相關的操作，包括：
 * - 照片選擇處理
 * - 影片卡使用
 * - 影片限制處理
 */

/**
 * 創建照片和影片處理 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.getPhotoSelectorModal - 獲取照片選擇器模態框數據
 * @param {Function} deps.generateVideo - 生成影片的方法
 * @param {Function} deps.loadTicketsBalance - 重新加載解鎖卡餘額
 * @param {Function} deps.closePhotoSelector - 關閉照片選擇器
 * @param {Function} deps.closeVideoLimit - 關閉影片限制彈窗
 * @param {Function} deps.showPhotoSelector - 顯示照片選擇器
 * @param {Function} deps.navigateToMembership - 導航到會員頁面
 * @param {Function} deps.showError - 顯示錯誤提示
 * @returns {Object} 照片和影片處理相關的方法
 */
export function usePhotoVideoHandler(deps) {
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
   * @param {string} imageUrl - 圖片 URL
   * @returns {Promise<void>}
   */
  const handlePhotoSelect = async (imageUrl) => {
    try {
      // 根據標記決定是否使用影片卡
      const modalData = getPhotoSelectorModal();
      const useCard = modalData?.useCard;

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
  const handleUseVideoUnlockCard = async () => {
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
  const handleUpgradeFromVideoModal = () => {
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
