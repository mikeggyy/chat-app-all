/**
 * useGiftManagement.ts
 * 禮物管理 Composable（TypeScript 版本）
 * 管理禮物選擇和發送功能
 */

import { getGiftById } from '../../config/gifts.js';

// ==================== 類型定義 ====================

/**
 * 禮物數據
 */
export interface GiftData {
  giftId: string;
  [key: string]: any;
}

/**
 * useGiftManagement 依賴項
 */
export interface UseGiftManagementDeps {
  getCurrentUserId: () => string;
  openGiftSelector: (callback: () => Promise<void>) => Promise<void>;
  sendGift: (giftData: GiftData, onSuccess: () => void) => Promise<void>;
  loadBalance: (userId: string) => Promise<void>;
  showGiftAnimation: (emoji: string, name: string) => void;
  closeGiftAnimation: () => void;
}

/**
 * useGiftManagement 返回類型
 */
export interface UseGiftManagementReturn {
  handleOpenGiftSelector: () => Promise<void>;
  handleSelectGift: (giftData: GiftData) => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 創建禮物管理 composable
 * @param deps - 依賴項
 * @returns 禮物管理相關的方法
 */
export function useGiftManagement(deps: UseGiftManagementDeps): UseGiftManagementReturn {
  const {
    getCurrentUserId,
    openGiftSelector,
    sendGift,
    loadBalance,
    showGiftAnimation,
    closeGiftAnimation,
  } = deps;

  // ====================
  // 核心方法
  // ====================

  /**
   * 處理打開禮物選擇器
   */
  const handleOpenGiftSelector = async (): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) return;

    await openGiftSelector(async () => {
      // Load user assets
      await loadBalance(userId);
    });
  };

  /**
   * 處理選擇並發送禮物
   * @param giftData - 禮物數據
   */
  const handleSelectGift = async (giftData: GiftData): Promise<void> => {
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

  // ====================
  // 返回 API
  // ====================
  return {
    // 方法
    handleOpenGiftSelector,
    handleSelectGift,
  };
}
