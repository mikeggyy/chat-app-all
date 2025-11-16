/**
 * Limit Modal 統一操作邏輯
 * 處理購買、升級、導航等常見操作
 */

import { useRouter } from 'vue-router';
import type { Router } from 'vue-router';
import { logger } from '@/utils/logger';

/**
 * 限制信息接口
 */
interface LimitInfo {
  used?: number;
  total?: number;
  remaining?: number;
}

/**
 * 格式化後的限制信息接口
 */
interface FormattedLimitInfo {
  used: number;
  total: number;
  remaining: number;
  percentage: number;
  isExhausted: boolean;
  hasRemaining: boolean;
}

/**
 * 卡片類型映射接口
 */
interface SectionMap {
  [key: string]: string;
}

/**
 * Modal 操作返回對象接口
 */
interface LimitModalActions {
  // 導航方法
  navigateToShop: (section?: string | null) => void;
  navigateToVIP: (tier?: string | null) => void;
  navigateToProfile: () => void;

  // 操作處理方法
  handlePurchaseCards: (cardType: string, closeModal?: () => void) => void;
  handleUpgradeMembership: (recommendedTier: string, closeModal?: () => void) => void;
  handleBuyUnlockCard: (unlockType: string, closeModal?: () => void) => void;
  handleUseUnlockCard: (unlockType: string, onUse?: () => Promise<void>, closeModal?: () => void) => Promise<void>;
  handleWatchAd: (onWatchAd?: () => Promise<void>, closeModal?: () => void) => Promise<void>;

  // 工具方法
  getRecommendedTier: (currentTier: string) => string;
  formatLimitInfo: (limitInfo: LimitInfo) => FormattedLimitInfo;
}

/**
 * 使用 Limit Modal 操作
 * @returns {LimitModalActions} Modal 操作方法
 */
export function useLimitModalActions(): LimitModalActions {
  const router: Router = useRouter();

  /**
   * 導航到商店頁面
   * @param {string | null} section - 商店的特定區域（可選）
   */
  const navigateToShop = (section: string | null = null): void => {
    const route: string = section ? `/shop?section=${section}` : '/shop';
    logger.log('[LimitModal] 導航到商店:', route);
    router.push(route);
  };

  /**
   * 導航到 VIP 頁面
   * @param {string | null} tier - 推薦的會員等級（可選）
   */
  const navigateToVIP = (tier: string | null = null): void => {
    const route: string = tier ? `/vip?recommended=${tier}` : '/vip';
    logger.log('[LimitModal] 導航到 VIP 頁面:', route);
    router.push(route);
  };

  /**
   * 導航到個人資料頁面
   */
  const navigateToProfile = (): void => {
    logger.log('[LimitModal] 導航到個人資料');
    router.push('/profile');
  };

  /**
   * 處理購買卡片
   * @param {string} cardType - 卡片類型（photo, video, voice, character, create）
   * @param {() => void} closeModal - 關閉 Modal 的回調函數
   */
  const handlePurchaseCards = (cardType: string, closeModal?: () => void): void => {
    logger.log('[LimitModal] 購買卡片:', cardType);

    // 關閉當前 Modal
    if (closeModal) {
      closeModal();
    }

    // 導航到商店對應區域
    const sectionMap: SectionMap = {
      photo: 'photo-unlock',
      video: 'video-unlock',
      voice: 'voice-unlock',
      character: 'character-unlock',
      create: 'character-unlock',
    };

    const section: string = sectionMap[cardType] || cardType;
    navigateToShop(section);
  };

  /**
   * 處理升級會員
   * @param {string} recommendedTier - 推薦的會員等級
   * @param {() => void} closeModal - 關閉 Modal 的回調函數
   */
  const handleUpgradeMembership = (recommendedTier: string, closeModal?: () => void): void => {
    logger.log('[LimitModal] 升級會員:', recommendedTier);

    // 關閉當前 Modal
    if (closeModal) {
      closeModal();
    }

    // 導航到 VIP 頁面
    navigateToVIP(recommendedTier);
  };

  /**
   * 處理購買解鎖卡
   * @param {string} unlockType - 解鎖類型（photo, video, voice, character）
   * @param {() => void} closeModal - 關閉 Modal 的回調函數
   */
  const handleBuyUnlockCard = (unlockType: string, closeModal?: () => void): void => {
    logger.log('[LimitModal] 購買解鎖卡:', unlockType);

    // 關閉當前 Modal
    if (closeModal) {
      closeModal();
    }

    // 導航到商店對應區域
    const sectionMap: SectionMap = {
      photo: 'photo-unlock',
      video: 'video-unlock',
      voice: 'voice-unlock',
      character: 'character-unlock',
    };

    const section: string = sectionMap[unlockType] || `${unlockType}-unlock`;
    navigateToShop(section);
  };

  /**
   * 處理使用解鎖卡
   * @param {string} unlockType - 解鎖類型
   * @param {() => Promise<void>} onUse - 使用卡片的回調函數
   * @param {() => void} closeModal - 關閉 Modal 的回調函數
   */
  const handleUseUnlockCard = async (
    unlockType: string,
    onUse?: () => Promise<void>,
    closeModal?: () => void
  ): Promise<void> => {
    logger.log('[LimitModal] 使用解鎖卡:', unlockType);

    try {
      // 執行使用卡片的邏輯
      if (onUse) {
        await onUse();
      }

      // 關閉 Modal
      if (closeModal) {
        closeModal();
      }
    } catch (error) {
      logger.error('[LimitModal] 使用解鎖卡失敗:', error);
      throw error;
    }
  };

  /**
   * 處理觀看廣告
   * @param {() => Promise<void>} onWatchAd - 觀看廣告的回調函數
   * @param {() => void} closeModal - 關閉 Modal 的回調函數
   */
  const handleWatchAd = async (onWatchAd?: () => Promise<void>, closeModal?: () => void): Promise<void> => {
    logger.log('[LimitModal] 觀看廣告');

    try {
      // 執行觀看廣告的邏輯
      if (onWatchAd) {
        await onWatchAd();
      }

      // 關閉 Modal
      if (closeModal) {
        closeModal();
      }
    } catch (error) {
      logger.error('[LimitModal] 觀看廣告失敗:', error);
      throw error;
    }
  };

  /**
   * 獲取推薦的會員等級
   * @param {string} currentTier - 當前會員等級
   * @returns {string} 推薦的會員等級
   */
  const getRecommendedTier = (currentTier: string): string => {
    const tierMap: SectionMap = {
      free: 'vip',
      vip: 'vvip',
      vvip: 'vvip',
    };

    return tierMap[currentTier] || 'vip';
  };

  /**
   * 格式化限制信息
   * @param {LimitInfo} limitInfo - 限制信息
   * @returns {FormattedLimitInfo} 格式化後的限制信息
   */
  const formatLimitInfo = (limitInfo: LimitInfo): FormattedLimitInfo => {
    const { used = 0, total = 0, remaining = 0 } = limitInfo;

    return {
      used,
      total,
      remaining,
      percentage: total > 0 ? Math.round((used / total) * 100) : 0,
      isExhausted: remaining <= 0,
      hasRemaining: remaining > 0,
    };
  };

  return {
    // 導航方法
    navigateToShop,
    navigateToVIP,
    navigateToProfile,

    // 操作處理方法
    handlePurchaseCards,
    handleUpgradeMembership,
    handleBuyUnlockCard,
    handleUseUnlockCard,
    handleWatchAd,

    // 工具方法
    getRecommendedTier,
    formatLimitInfo,
  };
}
