/**
 * useChatHandlers.ts
 * Chat 事件處理器（TypeScript 版本）
 * 管理各種用戶交互事件的處理
 */

import { useSendMessage } from '../useSendMessage.js';
import { useEventHandlers } from '../useEventHandlers.js';
import { useMenuActions } from '../useMenuActions.js';
import { useConversationReset } from '../useConversationReset.js';
import { usePhotoVideoHandler } from '../usePhotoVideoHandler.js';
import { useShareFunctionality } from '../useShareFunctionality.js';
import type { Ref, ComputedRef } from 'vue';
import type { Router } from 'vue-router';
import type { Partner, Message, LimitCheckResult } from '../../../types';
import type { ShowConversationLimitOptions, RequireLoginOptions } from '../useSendMessage.js';
import type { MessageIdPrefixes } from '../useConversationReset.js';

// ==================== 類型定義 ====================

/**
 * Modal 管理器介面
 */
export interface ModalManager {
  showResetConfirm: () => void;
  showCharacterInfo: () => void;
  showUnlockLimit: () => void;
  showUnlockConfirm: () => void;
  showPotionLimit: () => void;
  showPotionConfirm: () => void;
}

/**
 * 用戶藥水資料
 */
export interface UserPotions {
  hasConversationBoost?: boolean;
  [key: string]: any;
}

/**
 * 解鎖券資料
 */
export interface UnlockTickets {
  hasCharacterTickets: Ref<boolean> | ComputedRef<boolean>;
  characterTickets: Ref<number> | ComputedRef<number>;
}

/**
 * 照片選擇器模態框資料
 */
export interface PhotoSelectorModal {
  isVisible: boolean;
  useCard?: boolean;
  [key: string]: any;
}

/**
 * 消息輸入 Ref
 */
export interface MessageInputRef {
  focus: () => void;
}

/**
 * useChatHandlers 參數
 */
export interface UseChatHandlersParams {
  // User & Partner
  currentUserId: Ref<string>;
  partner: Ref<Partner | null>;
  partnerDisplayName: Ref<string>;
  partnerId: Ref<string>;
  messages: Ref<Message[]>;
  draft: Ref<string>;
  chatContentRef: Ref<{ messageInputRef: MessageInputRef | null } | null>;

  // User Assets
  characterTickets: Ref<number>;
  userPotions: UserPotions;
  hasCharacterTickets: Ref<boolean> | ComputedRef<boolean>;

  // Guest Checks
  isGuest: Ref<boolean> | ComputedRef<boolean>;
  canGuestSendMessage: Ref<boolean> | ComputedRef<boolean>;
  requireLogin: (options: RequireLoginOptions) => boolean;
  incrementGuestMessageCount: () => void;

  // Limit Checks
  checkLimit: (userId: string, characterId: string) => Promise<LimitCheckResult>;
  showConversationLimit: (options: ShowConversationLimitOptions) => void;

  // API Actions
  sendMessageToApi: (text: string) => Promise<void>;
  invalidateSuggestions: () => void;
  loadSuggestions: () => Promise<void>;
  resetConversationApi: (userId: string, characterId: string) => Promise<void>;

  // Modal Actions
  showImageViewer: (url: string, alt?: string) => void;
  showBuffDetails: (buffType: string) => void;
  showResetConfirm: () => void;
  showCharacterInfo: () => void;
  showUnlockLimit: () => void;
  showUnlockConfirm: () => void;
  showPotionLimit: () => void;
  showPotionConfirm: () => void;
  closeResetConfirm: () => void;
  closePhotoSelector: () => void;
  closeVideoLimit: () => void;

  // Loading States
  setLoading: (key: string, loading: boolean) => void;

  // Video & Photo
  generateVideo: (options: { useVideoCard: boolean; imageUrl: string }) => Promise<void>;
  loadTicketsBalance: (userId: string) => Promise<void>;
  showPhotoSelector: () => void;

  // Ads
  watchVoiceAd: (userId: string, characterId: string) => Promise<void>;

  // Navigation
  router: Router;

  // Toast
  showError: (message: string) => void;
  success: (message: string) => void;

  // Config
  MESSAGE_ID_PREFIXES: MessageIdPrefixes;
}

/**
 * useChatHandlers 返回類型
 */
export interface UseChatHandlersReturn {
  // Send Message
  handleSendMessage: (text: string) => Promise<void>;

  // Event Handlers
  handleImageClick: (params: { url: string; alt?: string }) => void;
  handleViewBuffDetails: (buffType: string) => void;
  handleBack: () => void;
  handleWatchVoiceAd: () => Promise<void>;
  handleSuggestionClick: (suggestion: string) => Promise<void>;
  handleRequestSuggestions: () => Promise<void>;

  // Menu Actions
  handleMenuAction: ((action: string) => void) & { handleShare?: () => Promise<void> };

  // Conversation Reset
  cancelResetConversation: () => void;
  confirmResetConversation: () => Promise<void>;

  // Photo Video
  handlePhotoSelect: (imageUrl: string) => Promise<void>;
  handleUseVideoUnlockCard: () => Promise<void>;
  handleUpgradeFromVideoModal: () => void;

  // Share
  handleShare: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 設置所有事件處理器
 * @param options - 選項
 * @returns 事件處理器方法
 */
export function useChatHandlers(options: UseChatHandlersParams): UseChatHandlersReturn {
  const {
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
  } = options;

  // Send Message Handler
  const { handleSendMessage } = useSendMessage({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partner.value?.id || '',
    getPartnerDisplayName: () => partnerDisplayName.value,
    getDraft: () => draft.value,
    setDraft: (value: string) => { draft.value = value; },
    getMessageInputRef: () => chatContentRef.value?.messageInputRef || null,
    getCharacterTickets: () => characterTickets.value,
    isGuest,
    canGuestSendMessage,
    requireLogin,
    incrementGuestMessageCount,
    checkLimit,
    showConversationLimit,
    sendMessageToApi,
    invalidateSuggestions,
    showError,
  });

  // Event Handlers
  const {
    handleImageClick,
    handleViewBuffDetails,
    handleBack,
    handleWatchVoiceAd,
    handleSuggestionClick,
    handleRequestSuggestions,
  } = useEventHandlers({
    showImageViewer,
    showBuffDetails,
    router,
    watchVoiceAd,
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partner.value?.id || '',
    loadSuggestions,
    handleSendMessage,
  });

  // Menu Actions
  const { handleMenuAction } = useMenuActions({
    modals: {
      showResetConfirm,
      showCharacterInfo,
      showUnlockLimit,
      showUnlockConfirm,
      showPotionLimit,
      showPotionConfirm,
    },
    userPotions,
    unlockTickets: {
      hasCharacterTickets,
      characterTickets,
    },
    handleShare: () => Promise.resolve(), // 暫時空實現，後面設置
  });

  // Conversation Reset
  const {
    cancelResetConversation,
    confirmResetConversation,
  } = useConversationReset({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partner.value?.id || '',
    getPartner: () => partner.value,
    getMessages: () => messages.value,
    getDraft: () => draft.value,
    setDraft: (value: string) => { draft.value = value; },
    resetConversationApi,
    invalidateSuggestions,
    closeResetConfirm,
    setLoading,
    showError,
    showSuccess: success,
    config: { MESSAGE_ID_PREFIXES },
  });

  // Photo Video Handler
  const {
    handlePhotoSelect,
    handleUseVideoUnlockCard,
    handleUpgradeFromVideoModal,
  } = usePhotoVideoHandler({
    getCurrentUserId: () => currentUserId.value,
    getPhotoSelectorModal: (): PhotoSelectorModal => ({ isVisible: false }), // 從 modals 獲取
    generateVideo,
    loadTicketsBalance,
    closePhotoSelector,
    closeVideoLimit,
    showPhotoSelector,
    navigateToMembership: () => router.push('/membership'),
    showError,
  });

  // Share Functionality
  const { handleShare } = useShareFunctionality({
    partner,
    messages,
    currentUserId,
    router,
  });

  // 更新 handleMenuAction 的 handleShare
  handleMenuAction.handleShare = handleShare;

  return {
    // Send Message
    handleSendMessage,

    // Event Handlers
    handleImageClick,
    handleViewBuffDetails,
    handleBack,
    handleWatchVoiceAd,
    handleSuggestionClick,
    handleRequestSuggestions,

    // Menu Actions
    handleMenuAction,

    // Conversation Reset
    cancelResetConversation,
    confirmResetConversation,

    // Photo Video
    handlePhotoSelect,
    handleUseVideoUnlockCard,
    handleUpgradeFromVideoModal,

    // Share
    handleShare,
  };
}
