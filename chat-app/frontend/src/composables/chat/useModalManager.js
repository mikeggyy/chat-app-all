/**
 * 統一模態框管理 Composable
 *
 * 管理 ChatView 中所有模態框的狀態和數據
 * 減少樣板代碼，提供統一的 API 介面
 */

import { reactive, computed } from 'vue';

export function useModalManager() {
  // ==========================================
  // 統一的模態框狀態管理
  // ==========================================
  const modals = reactive({
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
      pending: null, // 保存待播放的消息
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
      type: '', // 'memoryBoost' or 'brainBoost'
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
      type: '', // 'memoryBoost' or 'brainBoost'
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
      useCard: false, // 是否使用影片卡
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
      type: '', // 'memory', 'brain', 'unlock'
    },

    // ===== E. 動畫類 =====
    giftAnimation: {
      show: false,
      emoji: '🎁',
      name: '禮物',
    },
  });

  // ==========================================
  // 通用方法
  // ==========================================

  /**
   * 打開模態框
   * @param {string} modalName - 模態框名稱
   * @param {object} updates - 要更新的數據
   */
  const open = (modalName, updates = {}) => {
    if (!modals[modalName]) {
      console.warn(`Modal "${modalName}" not found`);
      return;
    }

    modals[modalName].show = true;

    // 更新數據
    if (updates && typeof updates === 'object') {
      Object.keys(updates).forEach(key => {
        if (key === 'show') return; // 忽略 show 屬性

        if (modals[modalName].hasOwnProperty(key)) {
          modals[modalName][key] = updates[key];
        } else if (modals[modalName].data && modals[modalName].data.hasOwnProperty(key)) {
          modals[modalName].data[key] = updates[key];
        }
      });
    }
  };

  /**
   * 關閉模態框
   * @param {string} modalName - 模態框名稱
   * @param {boolean} clearData - 是否清空數據（默認 false）
   */
  const close = (modalName, clearData = false) => {
    if (!modals[modalName]) {
      console.warn(`Modal "${modalName}" not found`);
      return;
    }

    modals[modalName].show = false;

    // 清空 loading 狀態（如果有）
    if (modals[modalName].hasOwnProperty('loading')) {
      modals[modalName].loading = false;
    }

    // 清空數據（可選）
    if (clearData) {
      if (modalName === 'voiceLimit') {
        modals[modalName].pending = null;
      } else if (modalName === 'photoSelector') {
        modals[modalName].selectedUrl = null;
        modals[modalName].useCard = false;
      } else if (modalName === 'imageViewer') {
        modals[modalName].url = '';
        modals[modalName].alt = '';
      } else if (modalName === 'potionConfirm' || modalName === 'potionLimit') {
        modals[modalName].type = '';
      } else if (modalName === 'buffDetails') {
        modals[modalName].type = '';
      }
    }
  };

  /**
   * 更新模態框數據（不影響顯示狀態）
   * @param {string} modalName - 模態框名稱
   * @param {object} updates - 要更新的數據
   */
  const update = (modalName, updates = {}) => {
    if (!modals[modalName]) {
      console.warn(`Modal "${modalName}" not found`);
      return;
    }

    Object.keys(updates).forEach(key => {
      if (key === 'show') return; // 忽略 show 屬性

      if (modals[modalName].hasOwnProperty(key)) {
        modals[modalName][key] = updates[key];
      } else if (modals[modalName].data && modals[modalName].data.hasOwnProperty(key)) {
        modals[modalName].data[key] = updates[key];
      }
    });
  };

  /**
   * 設置 loading 狀態
   * @param {string} modalName - 模態框名稱
   * @param {boolean} loading - loading 狀態
   */
  const setLoading = (modalName, loading) => {
    if (!modals[modalName]) {
      console.warn(`Modal "${modalName}" not found`);
      return;
    }

    if (modals[modalName].hasOwnProperty('loading')) {
      modals[modalName].loading = loading;
    }
  };

  // ==========================================
  // 便捷方法（簡化常用操作）
  // ==========================================

  // === 限制類模態框 ===
  const showConversationLimit = (data) => open('conversationLimit', data);
  const closeConversationLimit = () => close('conversationLimit');

  const showVoiceLimit = (data, pendingMessage = null) => {
    open('voiceLimit', { ...data, pending: pendingMessage });
  };
  const closeVoiceLimit = () => close('voiceLimit', true);

  const showPhotoLimit = (data) => open('photoLimit', data);
  const closePhotoLimit = () => close('photoLimit');

  const showVideoLimit = (data) => open('videoLimit', data);
  const closeVideoLimit = () => close('videoLimit');

  const showPotionLimit = (type) => open('potionLimit', { type });
  const closePotionLimit = () => close('potionLimit', true);

  const showUnlockLimit = () => open('unlockLimit');
  const closeUnlockLimit = () => close('unlockLimit');

  // === 確認類模態框 ===
  const showResetConfirm = () => open('resetConfirm');
  const closeResetConfirm = () => close('resetConfirm');

  const showPotionConfirm = (type) => open('potionConfirm', { type });
  const closePotionConfirm = () => close('potionConfirm', true);

  const showUnlockConfirm = () => open('unlockConfirm');
  const closeUnlockConfirm = () => close('unlockConfirm');

  // === 選擇器類模態框 ===
  const showPhotoSelector = (useCard = false) => open('photoSelector', { useCard });
  const closePhotoSelector = () => close('photoSelector', true);

  // === 查看器類模態框 ===
  const showImageViewer = (url, alt = '') => open('imageViewer', { url, alt });
  const closeImageViewer = () => close('imageViewer', true);

  const showCharacterInfo = () => open('characterInfo');
  const closeCharacterInfo = () => close('characterInfo');

  const showBuffDetails = (type) => open('buffDetails', { type });
  const closeBuffDetails = () => close('buffDetails', true);

  // === 動畫類 ===
  const showGiftAnimation = (emoji, name) => open('giftAnimation', { emoji, name });
  const closeGiftAnimation = () => close('giftAnimation');

  // ==========================================
  // Computed 屬性（提供便捷訪問）
  // ==========================================

  // 是否有任何模態框正在顯示
  const hasOpenModal = computed(() => {
    return Object.values(modals).some(modal => modal.show === true);
  });

  // 是否有任何確認操作正在進行
  const hasLoadingAction = computed(() => {
    return ['resetConfirm', 'potionConfirm', 'unlockConfirm'].some(
      key => modals[key].loading
    );
  });

  // ==========================================
  // 返回 API
  // ==========================================
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
