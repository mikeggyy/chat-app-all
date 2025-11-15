/**
 * Chat 頁面統一設置 Composable（TypeScript 版本）
 * 整合所有 Chat 相關的 composables，簡化 ChatView.vue
 *
 * 架構：使用模組化設計，將不同關注點分離到獨立模組
 */

import type { Ref } from 'vue';
import type { Router } from 'vue-router';

// Modular Setup Composables
import { useChatCore, type UseChatCoreReturn } from './setup/useChatCore.js';
import { useChatLimits, type UseChatLimitsReturn } from './setup/useChatLimits.js';
import { useChatModals, type UseChatModalsReturn } from './setup/useChatModals.js';
import { useChatFeatures, type UseChatFeaturesReturn } from './setup/useChatFeatures.js';
import { useChatHandlers, type UseChatHandlersReturn } from './setup/useChatHandlers.js';

// Utils
import {
  rollbackUserMessage,
  createLimitModalData,
} from '../../utils/chat/chatHelpers.js';

// Config
import {
  MESSAGE_ID_PREFIXES,
  VIDEO_REQUEST_MESSAGES,
  VIDEO_CONFIG,
  AI_VIDEO_RESPONSE_TEXT,
} from '../../config/chat/constants.js';

// ==================== 類型定義 ====================

/**
 * useChatSetup 選項參數
 */
export interface UseChatSetupOptions {
  /** Vue Router 實例 */
  router: Router;
  /** ChatContent 組件引用 */
  chatContentRef: Ref<any>;
  /** Chat 頁面引用 */
  chatPageRef: Ref<any>;
  /** 消息草稿 */
  draft: Ref<string>;
}

/**
 * useChatSetup 返回類型
 * 整合所有 Chat 相關的狀態和方法
 */
export interface UseChatSetupReturn {
  // ==================== Core ====================
  user: UseChatCoreReturn['user'];
  partnerId: UseChatCoreReturn['partnerId'];
  partner: UseChatCoreReturn['partner'];
  partnerDisplayName: UseChatCoreReturn['partnerDisplayName'];
  partnerBackground: UseChatCoreReturn['partnerBackground'];
  backgroundStyle: UseChatCoreReturn['backgroundStyle'];
  currentUserId: UseChatCoreReturn['currentUserId'];
  isFavorited: UseChatCoreReturn['isFavorited'];

  // ==================== Messages ====================
  messages: UseChatCoreReturn['messages'];
  isReplying: UseChatCoreReturn['isReplying'];
  isLoadingHistory: UseChatCoreReturn['isLoadingHistory'];

  // ==================== Suggestions ====================
  suggestionOptions: UseChatCoreReturn['suggestionOptions'];
  isLoadingSuggestions: UseChatCoreReturn['isLoadingSuggestions'];
  suggestionError: UseChatCoreReturn['suggestionError'];

  // ==================== Modals ====================
  modals: UseChatModalsReturn['modals'];

  // ==================== Actions ====================
  isRequestingSelfie: UseChatFeaturesReturn['isRequestingSelfie'];
  isSendingGift: UseChatFeaturesReturn['isSendingGift'];
  isRequestingVideo: UseChatFeaturesReturn['isRequestingVideo'];
  showGiftSelector: UseChatFeaturesReturn['showGiftSelector'];
  playingVoiceMessageId: UseChatFeaturesReturn['playingVoiceMessageId'];
  isFavoriteMutating: UseChatFeaturesReturn['isFavoriteMutating'];

  // ==================== Limits ====================
  photoRemaining: UseChatFeaturesReturn['photoRemaining'];

  // ==================== Balance & Tickets ====================
  balance: UseChatLimitsReturn['balance'];
  characterTickets: UseChatLimitsReturn['characterTickets'];
  hasCharacterTickets: UseChatLimitsReturn['hasCharacterTickets'];
  voiceCards: UseChatLimitsReturn['voiceCards'];
  photoCards: UseChatLimitsReturn['photoCards'];
  videoCards: UseChatLimitsReturn['videoCards'];

  // ==================== Potions ====================
  userPotions: UseChatFeaturesReturn['userPotions'];
  activeMemoryBoost: UseChatFeaturesReturn['activeMemoryBoost'];
  activeBrainBoost: UseChatFeaturesReturn['activeBrainBoost'];
  activeCharacterUnlock: UseChatFeaturesReturn['activeCharacterUnlock'];

  // ==================== Character Status ====================
  isCharacterUnlocked: UseChatFeaturesReturn['isCharacterUnlocked'];

  // ==================== Event Handlers ====================
  handleBack: UseChatHandlersReturn['handleBack'];
  handleMenuAction: UseChatHandlersReturn['handleMenuAction'];
  toggleFavorite: UseChatFeaturesReturn['toggleFavorite'];
  handleViewBuffDetails: UseChatHandlersReturn['handleViewBuffDetails'];
  handlePlayVoice: UseChatFeaturesReturn['handlePlayVoice'];
  handleImageClick: UseChatHandlersReturn['handleImageClick'];
  handleSendMessage: UseChatHandlersReturn['handleSendMessage'];
  handleSuggestionClick: UseChatHandlersReturn['handleSuggestionClick'];
  handleRequestSuggestions: UseChatHandlersReturn['handleRequestSuggestions'];
  handleOpenGiftSelector: UseChatFeaturesReturn['handleOpenGiftSelector'];
  handleRequestSelfie: UseChatFeaturesReturn['handleRequestSelfie'];
  handleRequestVideo: UseChatFeaturesReturn['handleRequestVideo'];

  // ==================== Modal Handlers ====================
  cancelResetConversation: UseChatHandlersReturn['cancelResetConversation'];
  confirmResetConversation: UseChatHandlersReturn['confirmResetConversation'];
  closeCharacterInfo: UseChatModalsReturn['closeCharacterInfo'];
  closePotionConfirm: UseChatModalsReturn['closePotionConfirm'];
  handleConfirmUsePotion: UseChatFeaturesReturn['handleConfirmUsePotion'];
  closePotionLimit: UseChatModalsReturn['closePotionLimit'];
  closeUnlockConfirm: UseChatModalsReturn['closeUnlockConfirm'];
  handleConfirmUnlockCharacter: UseChatFeaturesReturn['handleConfirmUnlockCharacter'];
  closeUnlockLimit: UseChatModalsReturn['closeUnlockLimit'];
  closeBuffDetails: UseChatModalsReturn['closeBuffDetails'];
  closeConversationLimit: UseChatModalsReturn['closeConversationLimit'];
  handleWatchAd: UseChatModalsReturn['handleWatchAd'];
  handleUseUnlockCard: UseChatModalsReturn['handleUseUnlockCard'];
  closeVoiceLimit: UseChatModalsReturn['closeVoiceLimit'];
  handleWatchVoiceAd: UseChatFeaturesReturn['handleWatchVoiceAd'];
  handleUseVoiceUnlockCard: UseChatFeaturesReturn['handleUseVoiceUnlockCard'];
  closePhotoLimit: UseChatModalsReturn['closePhotoLimit'];
  handleUsePhotoUnlockCard: UseChatFeaturesReturn['handleUsePhotoUnlockCard'];
  closeVideoLimit: UseChatModalsReturn['closeVideoLimit'];
  handleUseVideoUnlockCard: UseChatHandlersReturn['handleUseVideoUnlockCard'];
  handleUpgradeFromVideoModal: UseChatHandlersReturn['handleUpgradeFromVideoModal'];
  closePhotoSelector: UseChatModalsReturn['closePhotoSelector'];
  handlePhotoSelect: UseChatHandlersReturn['handlePhotoSelect'];
  closeImageViewer: UseChatModalsReturn['closeImageViewer'];
  closeGiftSelector: UseChatFeaturesReturn['closeGiftSelector'];
  handleSelectGift: UseChatFeaturesReturn['handleSelectGift'];

  // ==================== Loaders & Cleanup ====================
  loadPartner: UseChatCoreReturn['loadPartner'];
  loadTicketsBalance: UseChatLimitsReturn['loadTicketsBalance'];
  loadPotions: UseChatFeaturesReturn['loadPotions'];
  loadActivePotions: UseChatFeaturesReturn['loadActivePotions'];
  loadActiveUnlocks: UseChatFeaturesReturn['loadActiveUnlocks'];
  loadHistory: UseChatCoreReturn['loadHistory'];
  loadVoiceStats: UseChatLimitsReturn['loadVoiceStats'];
  fetchPhotoStats: UseChatLimitsReturn['fetchPhotoStats'];
  loadBalance: UseChatLimitsReturn['loadBalance'];
  addConversationHistory: UseChatCoreReturn['addConversationHistory'];
  cleanupMessages: UseChatCoreReturn['cleanupMessages'];
  invalidateSuggestions: UseChatCoreReturn['invalidateSuggestions'];
  resetUnlockDataLoadedState: UseChatFeaturesReturn['resetUnlockDataLoadedState'];

  // ==================== Dependencies for watchers ====================
  activePotionEffects: UseChatFeaturesReturn['activePotionEffects'];
  activeUnlockEffects: UseChatFeaturesReturn['activeUnlockEffects'];
}

// ==================== Composable 主函數 ====================

/**
 * 設置所有 Chat 相關的 composables
 * @param options - 設置選項
 * @param options.router - Vue Router 實例
 * @param options.chatContentRef - ChatContent 組件引用
 * @param options.chatPageRef - Chat 頁面引用
 * @param options.draft - 消息草稿
 * @returns 所有 Chat 相關的狀態和方法
 */
export function useChatSetup({
  router,
  chatContentRef,
  chatPageRef,
  draft,
}: UseChatSetupOptions): UseChatSetupReturn {
  // ====================
  // 1. Core Services (核心服務)
  // ====================
  const core = useChatCore();
  const {
    user,
    partnerId,
    partner,
    partnerDisplayName,
    partnerBackground,
    backgroundStyle,
    currentUserId,
    isFavorited,
    firebaseAuth,
    messages,
    isReplying,
    isLoadingHistory,
    suggestionOptions,
    isLoadingSuggestions,
    suggestionError,
    success,
    showError,
    setUserProfile,
    addConversationHistory,
    loadPartner,
    loadHistory,
    sendMessageToApi,
    resetConversationApi,
    cleanupMessages,
    loadSuggestions,
    invalidateSuggestions,
  } = core;

  // ====================
  // 2. Limits (限制服務)
  // ====================
  const limits = useChatLimits();
  const {
    checkLimit,
    unlockByAd,
    getLimitState,
    checkVoiceLimit,
    unlockVoiceByAd: unlockVoiceByAdFromLimit,
    loadVoiceStats,
    fetchPhotoStats,
    canGeneratePhoto,
    photoRemaining,
    isGuest,
    requireLogin,
    canGuestSendMessage,
    incrementGuestMessageCount,
    guestRemainingMessages,
    balance,
    loadBalance,
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,
    createCards,
    loadTicketsBalance,
  } = limits;

  // ====================
  // 3. Modals (模態框管理)
  // ====================
  const modalsSetup = useChatModals({
    unlockByAd,
    unlockVoiceByAd: unlockVoiceByAdFromLimit,
    loadTicketsBalance,
  });

  const {
    modals,
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
    showResetConfirm,
    closeResetConfirm,
    showPotionConfirm,
    closePotionConfirm,
    showUnlockConfirm,
    closeUnlockConfirm,
    showGiftSelector,
    closeGiftSelector,
    showPhotoSelector,
    closePhotoSelector,
    showImageViewer,
    closeImageViewer,
    showCharacterInfo,
    closeCharacterInfo,
    showBuffDetails,
    closeBuffDetails,
    showGiftAnimation,
    closeGiftAnimation,
    setLoading,
    updateModal,
    handleWatchAd,
    handleUseUnlockCard,
  } = modalsSetup;

  // ====================
  // 4. Features (功能管理)
  // ====================
  const features = useChatFeatures({
    partnerId,
    currentUserId,
    partner,
    firebaseAuth,
    messages,
    chatContentRef,
    modals,
    requireLogin,
    canGeneratePhoto,
    fetchPhotoStats,
    photoRemaining,
    checkVoiceLimit,
    loadVoiceStats,
    loadTicketsBalance,
    closeConversationLimit,
    closeVoiceLimit,
    closePhotoLimit,
    closePotionLimit,
    closeUnlockConfirm,
    closePotionConfirm,
    showPotionConfirm,
    showPotionLimit,
    showUnlockConfirm,
    showUnlockLimit,
    showPhotoLimit,
    showVoiceLimit,
    showVideoLimit,
    showPhotoSelector,
    showGiftSelector,
    closeGiftSelector,
    closePhotoSelector,
    closeVideoLimit,
    showGiftAnimation,
    closeGiftAnimation,
    setLoading,
    loadBalance,
    showError,
    success,
    rollbackUserMessage: (userId: string, matchId: string, messageId: string) =>
      rollbackUserMessage({
        userId,
        matchId,
        messageId,
        firebaseAuth,
        messages,
        showError,
      }),
    createLimitModalData,
    setUserProfile,
    config: {
      MESSAGE_ID_PREFIXES,
      VIDEO_CONFIG,
      AI_VIDEO_RESPONSE_TEXT,
      VIDEO_REQUEST_MESSAGES,
    },
  });

  const {
    userPotions,
    activePotionEffects,
    activeMemoryBoost,
    activeBrainBoost,
    activeUnlockEffects,
    activeCharacterUnlock,
    isCharacterUnlocked,
    playingVoiceMessageId,
    isRequestingSelfie,
    isRequestingVideo,
    isSendingGift,
    showGiftSelector: showGiftSelectorFromFeatures,
    isFavoriteMutating,
    loadPotions,
    loadActivePotions,
    loadActiveUnlocks,
    handleConfirmUsePotion,
    handleConfirmUnlockCharacter,
    resetUnlockDataLoadedState,
    handlePlayVoice,
    handleWatchVoiceAd: watchVoiceAd,
    handleUseVoiceUnlockCard,
    handleRequestSelfie,
    handleUsePhotoUnlockCard,
    generateVideo,
    handleRequestVideo,
    handleOpenGiftSelector,
    handleSelectGift,
    toggleFavorite,
    openGiftSelector,
    closeGiftSelector: closeGiftSelectorFromFeatures,
    requestSelfie,
    playVoice,
    sendGift,
  } = features;

  // ====================
  // 5. Handlers (事件處理器)
  // ====================
  const handlers = useChatHandlers({
    currentUserId,
    partner,
    partnerDisplayName,
    partnerId,
    messages,
    draft,
    chatContentRef,
    characterTickets,
    userPotions,
    hasCharacterTickets,
    isGuest,
    canGuestSendMessage,
    requireLogin,
    incrementGuestMessageCount,
    checkLimit,
    showConversationLimit,
    sendMessageToApi,
    invalidateSuggestions,
    loadSuggestions,
    resetConversationApi,
    showImageViewer,
    showBuffDetails,
    showResetConfirm,
    showCharacterInfo,
    showUnlockLimit,
    showUnlockConfirm,
    showPotionLimit,
    showPotionConfirm,
    closeResetConfirm,
    closePhotoSelector,
    closeVideoLimit,
    setLoading,
    generateVideo,
    loadTicketsBalance,
    showPhotoSelector,
    watchVoiceAd,
    router,
    showError,
    success,
    MESSAGE_ID_PREFIXES,
  });

  const {
    handleSendMessage,
    handleImageClick,
    handleViewBuffDetails,
    handleBack,
    handleSuggestionClick,
    handleRequestSuggestions,
    handleMenuAction,
    cancelResetConversation,
    confirmResetConversation,
    handlePhotoSelect,
    handleUseVideoUnlockCard,
    handleUpgradeFromVideoModal,
    handleShare,
  } = handlers;

  // ====================
  // 返回所有需要的狀態和方法
  // ====================
  return {
    // Core
    user,
    partnerId,
    partner,
    partnerDisplayName,
    partnerBackground,
    backgroundStyle,
    currentUserId,
    isFavorited,

    // Messages
    messages,
    isReplying,
    isLoadingHistory,

    // Suggestions
    suggestionOptions,
    isLoadingSuggestions,
    suggestionError,

    // Modals
    modals,

    // Actions
    isRequestingSelfie,
    isSendingGift,
    isRequestingVideo,
    showGiftSelector: showGiftSelectorFromFeatures,
    playingVoiceMessageId,
    isFavoriteMutating,

    // Limits
    photoRemaining,

    // Balance & Tickets
    balance,
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,

    // Potions
    userPotions,
    activeMemoryBoost,
    activeBrainBoost,
    activeCharacterUnlock,

    // Character Status
    isCharacterUnlocked,

    // Event Handlers
    handleBack,
    handleMenuAction,
    toggleFavorite,
    handleViewBuffDetails,
    handlePlayVoice,
    handleImageClick,
    handleSendMessage,
    handleSuggestionClick,
    handleRequestSuggestions,
    handleOpenGiftSelector,
    handleRequestSelfie,
    handleRequestVideo,

    // Modal Handlers
    cancelResetConversation,
    confirmResetConversation,
    closeCharacterInfo,
    closePotionConfirm,
    handleConfirmUsePotion,
    closePotionLimit,
    closeUnlockConfirm,
    handleConfirmUnlockCharacter,
    closeUnlockLimit,
    closeBuffDetails,
    closeConversationLimit,
    handleWatchAd,
    handleUseUnlockCard,
    closeVoiceLimit,
    handleWatchVoiceAd: watchVoiceAd,
    handleUseVoiceUnlockCard,
    closePhotoLimit,
    handleUsePhotoUnlockCard,
    closeVideoLimit,
    handleUseVideoUnlockCard,
    handleUpgradeFromVideoModal,
    closePhotoSelector,
    handlePhotoSelect,
    closeImageViewer,
    closeGiftSelector: closeGiftSelectorFromFeatures,
    handleSelectGift,

    // Loaders & Cleanup
    loadPartner,
    loadTicketsBalance,
    loadPotions,
    loadActivePotions,
    loadActiveUnlocks,
    loadHistory,
    loadVoiceStats,
    fetchPhotoStats,
    loadBalance,
    addConversationHistory,
    cleanupMessages,
    invalidateSuggestions,
    resetUnlockDataLoadedState,

    // Dependencies for watchers
    activePotionEffects,
    activeUnlockEffects,
  };
}
