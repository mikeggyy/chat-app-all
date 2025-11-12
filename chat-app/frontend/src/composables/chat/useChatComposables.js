/**
 * 統一的聊天 Composables 管理器
 *
 * 集中管理所有 chat 相關的 composables，優化初始化性能
 * 將 composables 分為核心和擴展兩類，實現按需加載
 */

import { ref, shallowRef, computed } from 'vue';

// 核心 Composables（立即加載）
import { useConversationLimit } from '../useConversationLimit';
import { useVoiceLimit } from '../useVoiceLimit';
import { usePhotoLimit } from '../usePhotoLimit';
import { useChatMessages } from './useChatMessages';
import { useSuggestions } from './useSuggestions';
import { useChatActions } from './useChatActions';
import { useModalManager } from './useModalManager';

// 擴展 Composables（延遲加載的引用）
let videoGenerationModule = null;
let potionManagementModule = null;
let selfieGenerationModule = null;
let characterUnlockModule = null;
let voiceManagementModule = null;
let conversationLimitActionsModule = null;
let giftManagementModule = null;
let favoriteManagementModule = null;
let shareFunctionalityModule = null;
let conversationResetModule = null;
let photoVideoHandlerModule = null;

/**
 * 核心 Composables 集合
 * 這些是聊天頁面必需的基礎功能，立即初始化
 */
export function useCoreComposables(options) {
  const {
    partnerId,
    partner,
    currentUserId,
    firebaseAuth,
    toast,
    messageListRef,
  } = options;

  // ====================
  // 限制服務
  // ====================
  const conversationLimit = useConversationLimit();
  const voiceLimit = useVoiceLimit();
  const photoLimit = usePhotoLimit();

  // ====================
  // Modal 管理
  // ====================
  const modalManager = useModalManager();

  // ====================
  // 消息管理
  // ====================
  const chatMessages = useChatMessages(partnerId);

  // ====================
  // 建議系統
  // ====================
  const suggestions = useSuggestions(
    chatMessages.messages,
    partner,
    firebaseAuth,
    currentUserId
  );

  // ====================
  // 聊天操作
  // ====================
  const chatActions = useChatActions({
    messages: chatMessages.messages,
    partner,
    currentUserId,
    firebaseAuth,
    toast,
    requireLogin: options.requireLogin,
    scrollToBottom: () => messageListRef.value?.scrollToBottom(),
    appendCachedHistory: options.appendCachedHistory,
  });

  return {
    // 限制服務
    conversationLimit,
    voiceLimit,
    photoLimit,

    // Modal 管理
    modalManager,

    // 消息管理
    chatMessages,

    // 建議系統
    suggestions,

    // 聊天操作
    chatActions,
  };
}

/**
 * 延遲加載的擴展功能
 * 只在需要時才加載，提升初始化性能
 */
export const extendedComposables = {
  /**
   * 視頻生成
   */
  async videoGeneration(config) {
    if (!videoGenerationModule) {
      const module = await import('./useVideoGeneration');
      videoGenerationModule = module.useVideoGeneration;
    }
    return videoGenerationModule(config);
  },

  /**
   * 藥水管理
   */
  async potionManagement(config) {
    if (!potionManagementModule) {
      const module = await import('./usePotionManagement');
      potionManagementModule = module.usePotionManagement;
    }
    return potionManagementModule(config);
  },

  /**
   * 自拍生成
   */
  async selfieGeneration(config) {
    if (!selfieGenerationModule) {
      const module = await import('./useSelfieGeneration');
      selfieGenerationModule = module.useSelfieGeneration;
    }
    return selfieGenerationModule(config);
  },

  /**
   * 角色解鎖
   */
  async characterUnlock(config) {
    if (!characterUnlockModule) {
      const module = await import('./useCharacterUnlock');
      characterUnlockModule = module.useCharacterUnlock;
    }
    return characterUnlockModule(config);
  },

  /**
   * 語音管理
   */
  async voiceManagement(config) {
    if (!voiceManagementModule) {
      const module = await import('./useVoiceManagement');
      voiceManagementModule = module.useVoiceManagement;
    }
    return voiceManagementModule(config);
  },

  /**
   * 對話限制操作
   */
  async conversationLimitActions(config) {
    if (!conversationLimitActionsModule) {
      const module = await import('./useConversationLimitActions');
      conversationLimitActionsModule = module.useConversationLimitActions;
    }
    return conversationLimitActionsModule(config);
  },

  /**
   * 禮物管理
   */
  async giftManagement(config) {
    if (!giftManagementModule) {
      const module = await import('./useGiftManagement');
      giftManagementModule = module.useGiftManagement;
    }
    return giftManagementModule(config);
  },

  /**
   * 收藏管理
   */
  async favoriteManagement(config) {
    if (!favoriteManagementModule) {
      const module = await import('./useFavoriteManagement');
      favoriteManagementModule = module.useFavoriteManagement;
    }
    return favoriteManagementModule(config);
  },

  /**
   * 分享功能
   */
  async shareFunctionality(config) {
    if (!shareFunctionalityModule) {
      const module = await import('./useShareFunctionality');
      shareFunctionalityModule = module.useShareFunctionality;
    }
    return shareFunctionalityModule(config);
  },

  /**
   * 對話重置
   */
  async conversationReset(config) {
    if (!conversationResetModule) {
      const module = await import('./useConversationReset');
      conversationResetModule = module.useConversationReset;
    }
    return conversationResetModule(config);
  },

  /**
   * 照片視頻處理
   */
  async photoVideoHandler(config) {
    if (!photoVideoHandlerModule) {
      const module = await import('./usePhotoVideoHandler');
      photoVideoHandlerModule = module.usePhotoVideoHandler;
    }
    return photoVideoHandlerModule(config);
  },
};

/**
 * 批量初始化擴展 composables
 * 在組件掛載後延遲初始化，避免阻塞初始渲染
 */
export async function initExtendedComposables(configs) {
  const results = {};

  // 使用 Promise.all 並行加載所有擴展模塊
  const [
    videoGeneration,
    potionManagement,
    selfieGeneration,
    characterUnlock,
    voiceManagement,
    conversationLimitActions,
    giftManagement,
    favoriteManagement,
    shareFunctionality,
    conversationReset,
    photoVideoHandler,
  ] = await Promise.all([
    extendedComposables.videoGeneration(configs.videoGeneration),
    extendedComposables.potionManagement(configs.potionManagement),
    extendedComposables.selfieGeneration(configs.selfieGeneration),
    extendedComposables.characterUnlock(configs.characterUnlock),
    extendedComposables.voiceManagement(configs.voiceManagement),
    extendedComposables.conversationLimitActions(configs.conversationLimitActions),
    extendedComposables.giftManagement(configs.giftManagement),
    extendedComposables.favoriteManagement(configs.favoriteManagement),
    extendedComposables.shareFunctionality(configs.shareFunctionality),
    extendedComposables.conversationReset(configs.conversationReset),
    extendedComposables.photoVideoHandler(configs.photoVideoHandler),
  ]);

  return {
    videoGeneration,
    potionManagement,
    selfieGeneration,
    characterUnlock,
    voiceManagement,
    conversationLimitActions,
    giftManagement,
    favoriteManagement,
    shareFunctionality,
    conversationReset,
    photoVideoHandler,
  };
}
