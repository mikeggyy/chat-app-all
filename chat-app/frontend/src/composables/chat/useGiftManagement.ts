/**
 * useGiftManagement.ts
 * 禮物管理 Composable（TypeScript 版本）
 * 管理禮物選擇和發送功能
 */


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
  sendGift: (giftData: GiftData, onSuccess: () => void, selectedPhotoUrl?: string) => Promise<void>; // ✅ 添加 selectedPhotoUrl 參數
  loadBalance: (userId: string) => Promise<void>;
  showGiftAnimation: (emoji: string, name: string) => void;
  closeGiftAnimation: () => void;
  showPhotoSelector: (forGift: boolean, pendingGift: GiftData) => void; // ✅ 新增:打開照片選擇器
  closeGiftSelector: () => void; // ✅ 新增:關閉禮物選擇器
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
    loadBalance,
    showPhotoSelector, // ✅ 新增
    closeGiftSelector, // ✅ 新增
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
   * 處理選擇禮物（新流程：先選照片再發送）
   * @param giftData - 禮物數據
   */
  const handleSelectGift = async (giftData: GiftData): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) return;

    // ✅ 新流程：關閉禮物選擇器，打開照片選擇器
    closeGiftSelector();

    // ✅ 打開照片選擇器，讓用戶選擇照片（傳遞待發送的禮物數據）
    // 實際的禮物發送會在用戶選擇照片後（handlePhotoSelect）執行
    showPhotoSelector(true, giftData); // forGift=true, pendingGift=giftData
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
