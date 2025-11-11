/**
 * 禮物管理 Composable
 *
 * 管理禮物選擇和發送功能，包括：
 * - 打開禮物選擇器
 * - 發送禮物
 * - 顯示禮物動畫
 */

import { getGiftById } from '../../config/gifts';

/**
 * 創建禮物管理 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.openGiftSelector - 打開禮物選擇器（來自 useChatActions）
 * @param {Function} deps.sendGift - 發送禮物（來自 useChatActions）
 * @param {Function} deps.loadBalance - 重新加載金幣餘額
 * @param {Function} deps.showGiftAnimation - 顯示禮物動畫
 * @param {Function} deps.closeGiftAnimation - 關閉禮物動畫
 * @returns {Object} 禮物管理相關的方法
 */
export function useGiftManagement(deps) {
  const {
    getCurrentUserId,
    openGiftSelector,
    sendGift,
    loadBalance,
    showGiftAnimation,
    closeGiftAnimation,
  } = deps;

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 處理打開禮物選擇器
   * @returns {Promise<void>}
   */
  const handleOpenGiftSelector = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    await openGiftSelector(async () => {
      // Load user assets
      await loadBalance(userId);
    });
  };

  /**
   * 處理選擇並發送禮物
   * @param {Object} giftData - 禮物數據
   * @returns {Promise<void>}
   */
  const handleSelectGift = async (giftData) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    // 獲取禮物資訊用於動畫
    const gift = getGiftById(giftData.giftId);
    if (gift) {
      // 立即顯示禮物動畫
      showGiftAnimation(gift.emoji, gift.name);

      // 2秒後自動隱藏動畫
      setTimeout(() => {
        closeGiftAnimation();
      }, 2000);
    }

    // 發送禮物（動畫已經在播放）
    await sendGift(giftData, () => {
      // On success - 動畫已經在顯示，不需要再做處理
    });

    // Reload balance
    await loadBalance(userId);
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 方法
    handleOpenGiftSelector,
    handleSelectGift,
  };
}
