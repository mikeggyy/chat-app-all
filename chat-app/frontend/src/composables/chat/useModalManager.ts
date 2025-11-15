/**
 * useModalManager.ts
 * 統一模態框管理 Composable（TypeScript 版本）
 * 管理 ChatView 中所有模態框的狀態和數據
 */

import { reactive, computed, type ComputedRef } from 'vue';
import { logger } from '../../utils/logger.js';
import type { Message } from '../../types';

// ==================== 類型定義 ====================

/**
 * 對話限制數據
 */
export interface ConversationLimitData {
  characterName: string;
  remainingMessages: number;
  dailyAdLimit: number;
  adsWatchedToday: number;
  isUnlocked: boolean;
  characterUnlockCards: number;
}

/**
 * 語音限制數據
 */
export interface VoiceLimitData {
  characterName: string;
  usedVoices: number;
  totalVoices: number;
  dailyAdLimit: number;
  adsWatchedToday: number;
  voiceUnlockCards: number;
}

/**
 * 照片/影片限制數據
 */
export interface PhotoVideoLimitData {
  used: number;
  remaining: number;
  total: number;
  standardTotal: number | null;
  isTestAccount: boolean;
  cards: number;
  tier: string;
  resetPeriod: string;
}

/**
 * 藥水類型
 */
export type PotionType = 'memoryBoost' | 'brainBoost' | '';

/**
 * Buff 類型
 */
export type BuffType = 'memory' | 'brain' | 'unlock' | '';

/**
 * 模態框狀態集合
 */
export interface ModalsState {
  conversationLimit: {
    show: boolean;
    data: ConversationLimitData;
  };
  voiceLimit: {
    show: boolean;
    data: VoiceLimitData;
    pending: Message | null;
  };
  photoLimit: {
    show: boolean;
    data: PhotoVideoLimitData;
  };
  videoLimit: {
    show: boolean;
    data: PhotoVideoLimitData;
  };
  potionLimit: {
    show: boolean;
    type: PotionType;
  };
  unlockLimit: {
    show: boolean;
  };
  resetConfirm: {
    show: boolean;
    loading: boolean;
  };
  potionConfirm: {
    show: boolean;
    type: PotionType;
    loading: boolean;
  };
  unlockConfirm: {
    show: boolean;
    loading: boolean;
  };
  photoSelector: {
    show: boolean;
    selectedUrl: string | null;
    useCard: boolean;
  };
  imageViewer: {
    show: boolean;
    url: string;
    alt: string;
  };
  characterInfo: {
    show: boolean;
  };
  buffDetails: {
    show: boolean;
    type: BuffType;
  };
  giftAnimation: {
    show: boolean;
    emoji: string;
    name: string;
  };
}

/**
 * useModalManager 返回類型
 */
export interface UseModalManagerReturn {
  // 狀態
  modals: ModalsState;

  // 通用方法
  open: (modalName: keyof ModalsState, updates?: Record<string, any>) => void;
  close: (modalName: keyof ModalsState, clearData?: boolean) => void;
  update: (modalName: keyof ModalsState, updates?: Record<string, any>) => void;
  setLoading: (modalName: keyof ModalsState, loading: boolean) => void;

  // 便捷方法 - 限制類
  showConversationLimit: (data: Partial<ConversationLimitData>) => void;
  closeConversationLimit: () => void;
  showVoiceLimit: (data: Partial<VoiceLimitData>, pendingMessage?: Message | null) => void;
  closeVoiceLimit: () => void;
  showPhotoLimit: (data: Partial<PhotoVideoLimitData>) => void;
  closePhotoLimit: () => void;
  showVideoLimit: (data: Partial<PhotoVideoLimitData>) => void;
  closeVideoLimit: () => void;
  showPotionLimit: (type: PotionType) => void;
  closePotionLimit: () => void;
  showUnlockLimit: () => void;
  closeUnlockLimit: () => void;

  // 便捷方法 - 確認類
  showResetConfirm: () => void;
  closeResetConfirm: () => void;
  showPotionConfirm: (type: PotionType) => void;
  closePotionConfirm: () => void;
  showUnlockConfirm: () => void;
  closeUnlockConfirm: () => void;

  // 便捷方法 - 選擇器類
  showPhotoSelector: (useCard?: boolean) => void;
  closePhotoSelector: () => void;

  // 便捷方法 - 查看器類
  showImageViewer: (url: string, alt?: string) => void;
  closeImageViewer: () => void;
  showCharacterInfo: () => void;
  closeCharacterInfo: () => void;
  showBuffDetails: (type: BuffType) => void;
  closeBuffDetails: () => void;

  // 便捷方法 - 動畫類
  showGiftAnimation: (emoji: string, name: string) => void;
  closeGiftAnimation: () => void;

  // Computed
  hasOpenModal: ComputedRef<boolean>;
  hasLoadingAction: ComputedRef<boolean>;
}

// ==================== Composable 主函數 ====================

/**
 * 創建模態框管理 composable
 */
export function useModalManager(): UseModalManagerReturn {
  // ====================
  // 統一的模態框狀態管理
  // ====================
  const modals: ModalsState = reactive({
    // ===== A. 限制類模態框 =====
    conversationLimit: {
      show: false,
      data: {
        characterName: '',
        remainingMessages: 0,
        dailyAdLimit: 10,
        adsWatchedToday: 0,
        isUnlocked: false,
        characterUnlockCards: 0,
      },
    },

    voiceLimit: {
      show: false,
      data: {
        characterName: '',
        usedVoices: 0,
        totalVoices: 10,
        dailyAdLimit: 10,
        adsWatchedToday: 0,
        voiceUnlockCards: 0,
      },
      pending: null,
    },

    photoLimit: {
      show: false,
      data: {
        used: 0,
        remaining: 0,
        total: 0,
        standardTotal: null,
        isTestAccount: false,
        cards: 0,
        tier: 'free',
        resetPeriod: 'lifetime',
      },
    },

    videoLimit: {
      show: false,
      data: {
        used: 0,
        remaining: 0,
        total: 0,
        standardTotal: null,
        isTestAccount: false,
        cards: 0,
        tier: 'free',
        resetPeriod: 'lifetime',
      },
    },

    potionLimit: {
      show: false,
      type: '',
    },

    unlockLimit: {
      show: false,
    },

    // ===== B. 確認類模態框 =====
    resetConfirm: {
      show: false,
      loading: false,
    },

    potionConfirm: {
      show: false,
      type: '',
      loading: false,
    },

    unlockConfirm: {
      show: false,
      loading: false,
    },

    // ===== C. 選擇器類模態框 =====
    photoSelector: {
      show: false,
      selectedUrl: null,
      useCard: false,
    },

    // ===== D. 查看器類模態框 =====
    imageViewer: {
      show: false,
      url: '',
      alt: '',
    },

    characterInfo: {
      show: false,
    },

    buffDetails: {
      show: false,
      type: '',
    },

    // ===== E. 動畫類 =====
    giftAnimation: {
      show: false,
      emoji: '🎁',
      name: '禮物',
    },
  });

  // ====================
  // 通用方法
  // ====================

  /**
   * 打開模態框
   * @param modalName - 模態框名稱
   * @param updates - 要更新的數據
   */
  const open = (modalName: keyof ModalsState, updates: Record<string, any> = {}): void => {
    if (!modals[modalName]) {
      logger.warn(`Modal "${modalName}" not found`);
      return;
    }

    (modals[modalName] as any).show = true;

    // 更新數據
    if (updates && typeof updates === 'object') {
      Object.keys(updates).forEach(key => {
        if (key === 'show') return; // 忽略 show 屬性

        const modal = modals[modalName] as any;
        if (modal.hasOwnProperty(key)) {
          modal[key] = updates[key];
        } else if (modal.data && modal.data.hasOwnProperty(key)) {
          modal.data[key] = updates[key];
        }
      });
    }
  };

  /**
   * 關閉模態框
   * @param modalName - 模態框名稱
   * @param clearData - 是否清空數據（默認 false）
   */
  const close = (modalName: keyof ModalsState, clearData: boolean = false): void => {
    if (!modals[modalName]) {
      logger.warn(`Modal "${modalName}" not found`);
      return;
    }

    (modals[modalName] as any).show = false;

    const modal = modals[modalName] as any;

    // 清空 loading 狀態（如果有）
    if (modal.hasOwnProperty('loading')) {
      modal.loading = false;
    }

    // 清空數據（可選）
    if (clearData) {
      if (modalName === 'voiceLimit') {
        modals.voiceLimit.pending = null;
      } else if (modalName === 'photoSelector') {
        modals.photoSelector.selectedUrl = null;
        modals.photoSelector.useCard = false;
      } else if (modalName === 'imageViewer') {
        modals.imageViewer.url = '';
        modals.imageViewer.alt = '';
      } else if (modalName === 'potionConfirm' || modalName === 'potionLimit') {
        (modals[modalName] as any).type = '';
      } else if (modalName === 'buffDetails') {
        modals.buffDetails.type = '';
      }
    }
  };

  /**
   * 更新模態框數據（不影響顯示狀態）
   * @param modalName - 模態框名稱
   * @param updates - 要更新的數據
   */
  const update = (modalName: keyof ModalsState, updates: Record<string, any> = {}): void => {
    if (!modals[modalName]) {
      logger.warn(`Modal "${modalName}" not found`);
      return;
    }

    Object.keys(updates).forEach(key => {
      if (key === 'show') return; // 忽略 show 屬性

      const modal = modals[modalName] as any;
      if (modal.hasOwnProperty(key)) {
        modal[key] = updates[key];
      } else if (modal.data && modal.data.hasOwnProperty(key)) {
        modal.data[key] = updates[key];
      }
    });
  };

  /**
   * 設置 loading 狀態
   * @param modalName - 模態框名稱
   * @param loading - loading 狀態
   */
  const setLoading = (modalName: keyof ModalsState, loading: boolean): void => {
    if (!modals[modalName]) {
      logger.warn(`Modal "${modalName}" not found`);
      return;
    }

    const modal = modals[modalName] as any;
    if (modal.hasOwnProperty('loading')) {
      modal.loading = loading;
    }
  };

  // ====================
  // 便捷方法（簡化常用操作）
  // ====================

  // === 限制類模態框 ===
  const showConversationLimit = (data: Partial<ConversationLimitData>): void => open('conversationLimit', data);
  const closeConversationLimit = (): void => close('conversationLimit');

  const showVoiceLimit = (data: Partial<VoiceLimitData>, pendingMessage: Message | null = null): void => {
    open('voiceLimit', { ...data, pending: pendingMessage });
  };
  const closeVoiceLimit = (): void => close('voiceLimit', true);

  const showPhotoLimit = (data: Partial<PhotoVideoLimitData>): void => open('photoLimit', data);
  const closePhotoLimit = (): void => close('photoLimit');

  const showVideoLimit = (data: Partial<PhotoVideoLimitData>): void => open('videoLimit', data);
  const closeVideoLimit = (): void => close('videoLimit');

  const showPotionLimit = (type: PotionType): void => open('potionLimit', { type });
  const closePotionLimit = (): void => close('potionLimit', true);

  const showUnlockLimit = (): void => open('unlockLimit');
  const closeUnlockLimit = (): void => close('unlockLimit');

  // === 確認類模態框 ===
  const showResetConfirm = (): void => open('resetConfirm');
  const closeResetConfirm = (): void => close('resetConfirm');

  const showPotionConfirm = (type: PotionType): void => open('potionConfirm', { type });
  const closePotionConfirm = (): void => close('potionConfirm', true);

  const showUnlockConfirm = (): void => open('unlockConfirm');
  const closeUnlockConfirm = (): void => close('unlockConfirm');

  // === 選擇器類模態框 ===
  const showPhotoSelector = (useCard: boolean = false): void => open('photoSelector', { useCard });
  const closePhotoSelector = (): void => close('photoSelector', true);

  // === 查看器類模態框 ===
  const showImageViewer = (url: string, alt: string = ''): void => open('imageViewer', { url, alt });
  const closeImageViewer = (): void => close('imageViewer', true);

  const showCharacterInfo = (): void => open('characterInfo');
  const closeCharacterInfo = (): void => close('characterInfo');

  const showBuffDetails = (type: BuffType): void => open('buffDetails', { type });
  const closeBuffDetails = (): void => close('buffDetails', true);

  // === 動畫類 ===
  const showGiftAnimation = (emoji: string, name: string): void => open('giftAnimation', { emoji, name });
  const closeGiftAnimation = (): void => close('giftAnimation');

  // ====================
  // Computed 屬性（提供便捷訪問）
  // ====================

  // 是否有任何模態框正在顯示
  const hasOpenModal = computed(() => {
    return Object.values(modals).some((modal: any) => modal.show === true);
  });

  // 是否有任何確認操作正在進行
  const hasLoadingAction = computed(() => {
    return ['resetConfirm', 'potionConfirm', 'unlockConfirm'].some(
      key => (modals[key as keyof ModalsState] as any).loading
    );
  });

  // ====================
  // 返回 API
  // ====================
  return {
    // 狀態
    modals,

    // 通用方法
    open,
    close,
    update,
    setLoading,

    // 便捷方法 - 限制類
    showConversationLimit,
    closeConversationLimit,
    showVoiceLimit,
    closeVoiceLimit,
    showPhotoLimit,
    closePhotoLimit,
    showVideoLimit,
    closeVideoLimit,
    showPotionLimit,
    closePotionLimit,
    showUnlockLimit,
    closeUnlockLimit,

    // 便捷方法 - 確認類
    showResetConfirm,
    closeResetConfirm,
    showPotionConfirm,
    closePotionConfirm,
    showUnlockConfirm,
    closeUnlockConfirm,

    // 便捷方法 - 選擇器類
    showPhotoSelector,
    closePhotoSelector,

    // 便捷方法 - 查看器類
    showImageViewer,
    closeImageViewer,
    showCharacterInfo,
    closeCharacterInfo,
    showBuffDetails,
    closeBuffDetails,

    // 便捷方法 - 動畫類
    showGiftAnimation,
    closeGiftAnimation,

    // Computed
    hasOpenModal,
    hasLoadingAction,
  };
}
