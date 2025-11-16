// @ts-nocheck
/**
 * useChatFeatures.ts
 * Chat 功能模塊（TypeScript 版本）
 * 管理禮物、自拍、視頻、藥水、解鎖等功能
 */

import { type Ref, computed } from 'vue';
import { useChatActions, type UseChatActionsReturn } from '../useChatActions.js';
import { usePotionManagement, type UsePotionManagementReturn } from '../usePotionManagement.js';
import { useSelfieGeneration, type UseSelfieGenerationReturn } from '../useSelfieGeneration.js';
import { useVideoGeneration, type UseVideoGenerationReturn } from '../useVideoGeneration.js';
import { useGiftManagement, type UseGiftManagementReturn } from '../useGiftManagement.js';
import { useCharacterUnlock, type UseCharacterUnlockReturn } from '../useCharacterUnlock.js';
import { useFavoriteManagement, type UseFavoriteManagementReturn } from '../useFavoriteManagement.js';
import { useVoiceManagement, type UseVoiceManagementReturn } from '../useVoiceManagement.js';
import type { Message, Partner, FirebaseAuthService, User, PhotoLimitInfo } from '../../../types';

// ==================== 類型定義 ====================

/**
 * 限制模態框數據
 */
export interface LimitModalData {
  type: string;
  title: string;
  description: string;
  [key: string]: any;
}

/**
 * 配置對象
 */
export interface ChatFeaturesConfig {
  [key: string]: any;
}

/**
 * useChatFeatures 依賴項
 */
export interface UseChatFeaturesDeps {
  // 核心標識
  partnerId: Ref<string>;
  currentUserId: Ref<string>;
  partner: Ref<Partner | null>;
  user: Ref<User | null>;
  firebaseAuth: FirebaseAuthService;

  // 消息和引用
  messages: Ref<Message[]>;
  chatContentRef: Ref<any>;

  // 功能函數
  requireLogin: () => boolean;
  canGeneratePhoto: () => Promise<{ allowed: boolean; used?: number; remaining?: number; total?: number; standardPhotosLimit?: number | null; isTestAccount?: boolean; cards?: number; tier?: string; resetPeriod?: string }>;
  fetchPhotoStats: () => Promise<PhotoLimitInfo>;
  photoRemaining: Ref<number>;
  checkVoiceLimit: (userId: string, characterId: string) => Promise<{ allowed: boolean; used?: number; total?: number; dailyAdLimit?: number; adsWatchedToday?: number; voiceUnlockCards?: number }>;
  loadVoiceStats: (userId: string) => Promise<any>;
  loadTicketsBalance: () => Promise<void>;

  // 彈窗控制
  closeConversationLimit: () => void;
  closeVoiceLimit: () => void;
  closePhotoLimit: () => void;
  closePotionLimit: () => void;
  closeUnlockConfirm: () => void;
  closePotionConfirm: () => void;
  showPotionConfirm: () => void;
  showPotionLimit: () => void;
  showUnlockConfirm: () => void;
  showUnlockLimit: () => void;
  showPhotoLimit: () => void;
  showVoiceLimit: () => void;
  showVideoLimit: () => void;
  showPhotoSelector: () => void;
  showGiftSelector: () => void;
  closeGiftSelector: () => void;
  closePhotoSelector: () => void;
  closeVideoLimit: () => void;
  showGiftAnimation: (gift: any) => void;
  closeGiftAnimation: () => void;

  // 狀態管理
  setLoading: (key: string, loading: boolean) => void;
  loadBalance: () => Promise<void>;
  showError: (message: string) => void;
  success: (message: string) => void;
  rollbackUserMessage: (messageId: string) => void;
  createLimitModalData: (type: string, data?: any) => LimitModalData;
  setUserProfile: (profile: User) => void;

  // 配置
  config: ChatFeaturesConfig;
}

/**
 * useChatFeatures 返回類型
 */
export interface UseChatFeaturesReturn {
  // Potion - 藥水相關
  userPotions: UsePotionManagementReturn['userPotions'];
  activeMemoryBoost: UsePotionManagementReturn['activeMemoryBoost'];
  activeBrainBoost: UsePotionManagementReturn['activeBrainBoost'];
  loadPotions: UsePotionManagementReturn['loadPotions'];
  loadActivePotions: UsePotionManagementReturn['loadActivePotions'];
  activePotionEffects: UsePotionManagementReturn['activePotionEffects'];
  handleConfirmUsePotion: UsePotionManagementReturn['handleConfirmUsePotion'];

  // Character Unlock - 角色解鎖
  isCharacterUnlocked: UseCharacterUnlockReturn['isCharacterUnlocked'];
  loadActiveUnlocks: UseCharacterUnlockReturn['loadActiveUnlocks'];
  activeUnlockEffects: UseCharacterUnlockReturn['activeUnlockEffects'];
  resetUnlockDataLoadedState: UseCharacterUnlockReturn['resetUnlockDataLoadedState'];
  handleConfirmUnlockCharacter: UseCharacterUnlockReturn['handleConfirmUnlockCharacter'];

  // Voice - 語音
  playingVoiceMessageId: UseChatActionsReturn['playingVoiceMessageId'];
  handlePlayVoice: UseVoiceManagementReturn['handlePlayVoice'];
  handleWatchVoiceAd: UseVoiceManagementReturn['handleWatchVoiceAd'];
  handleUseVoiceUnlockCard: UseVoiceManagementReturn['handleUseVoiceUnlockCard'];
  playVoice: UseChatActionsReturn['playVoice'];

  // Selfie - 自拍照片
  isRequestingSelfie: UseChatActionsReturn['isRequestingSelfie'];
  photoRemaining: Ref<number>;
  handleRequestSelfie: UseSelfieGenerationReturn['handleRequestSelfie'];
  handleUsePhotoUnlockCard: UseSelfieGenerationReturn['handleUsePhotoUnlockCard'];
  requestSelfie: UseChatActionsReturn['requestSelfie'];

  // Video - 視頻
  isRequestingVideo: UseVideoGenerationReturn['isRequestingVideo'];
  handleRequestVideo: UseVideoGenerationReturn['handleRequestVideo'];
  generateVideo: UseVideoGenerationReturn['generateVideo'];

  // Gift - 禮物
  isSendingGift: UseChatActionsReturn['isSendingGift'];
  showGiftSelector: UseChatActionsReturn['showGiftSelector'];
  handleOpenGiftSelector: UseGiftManagementReturn['handleOpenGiftSelector'];
  handleSelectGift: UseGiftManagementReturn['handleSelectGift'];
  openGiftSelector: UseChatActionsReturn['openGiftSelector'];
  closeGiftSelector: UseChatActionsReturn['closeGiftSelector'];
  sendGift: UseChatActionsReturn['sendGift'];

  // Favorite - 收藏
  isFavoriteMutating: UseFavoriteManagementReturn['isFavoriteMutating'];
  toggleFavorite: UseFavoriteManagementReturn['toggleFavorite'];
}

// ==================== Composable 主函數 ====================

/**
 * 設置所有 Chat 功能
 * @param options - 選項配置
 * @returns 功能相關的狀態和方法
 */
export function useChatFeatures(options: UseChatFeaturesDeps): UseChatFeaturesReturn {
  const {
    partnerId,
    currentUserId,
    partner,
    user,
    firebaseAuth,
    messages,
    chatContentRef,
    requireLogin,
    canGeneratePhoto,
    fetchPhotoStats,
    photoRemaining,
    checkVoiceLimit,
    loadVoiceStats,
    loadTicketsBalance,
    // closeConversationLimit, // 未使用
    closeVoiceLimit,
    closePhotoLimit,
    // closePotionLimit, // 未使用
    closeUnlockConfirm,
    closePotionConfirm,
    // showPotionConfirm, // 未使用
    // showPotionLimit, // 未使用
    // showUnlockConfirm, // 未使用
    // showUnlockLimit, // 未使用
    showPhotoLimit,
    showVoiceLimit,
    showVideoLimit,
    showPhotoSelector,
    // showGiftSelector, // 未使用（從 chatActions 獲取）
    // closeGiftSelector, // 未使用（從 chatActions 獲取）
    // closePhotoSelector, // 未使用
    // closeVideoLimit, // 未使用
    showGiftAnimation,
    closeGiftAnimation,
    setLoading,
    loadBalance,
    showError,
    success,
    rollbackUserMessage,
    createLimitModalData,
    setUserProfile,
    config,
  } = options;

  // ==========================================
  // 創建 Chat Actions（核心動作函數）
  // ==========================================
  const chatActions = useChatActions({
    messages,
    partner,
    currentUserId,
    firebaseAuth,
    toast: {
      success,
      error: showError,
    },
    requireLogin,
    scrollToBottom: () => chatContentRef.value?.scrollToBottom?.(),
    appendCachedHistory: () => {}, // TODO: 如果需要可以從 options 傳入
  });

  const {
    isRequestingSelfie,
    requestSelfie,
    playVoice,
    showGiftSelector: showGiftSelectorState,
    isSendingGift,
    openGiftSelector,
    closeGiftSelector: closeGiftSelectorFromActions,
    sendGift,
    playingVoiceMessageId,
  } = chatActions;

  // ==========================================
  // Potion Management - 藥水管理
  // ==========================================
  const {
    userPotions,
    activeMemoryBoost,
    activeBrainBoost,
    loadPotions,
    loadActivePotions,
    activePotionEffects,
    handleConfirmUsePotion,
  } = usePotionManagement({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getPotionType: () => null, // TODO: 從 modals 或其他地方獲取
    closePotionConfirm,
    setLoading,
    showError,
    showSuccess: success,
  });

  // ==========================================
  // Character Unlock - 角色解鎖
  // ==========================================
  const {
    isCharacterUnlocked,
    loadActiveUnlocks,
    activeUnlockEffects,
    resetUnlockDataLoadedState,
    handleConfirmUnlockCharacter,
  } = useCharacterUnlock({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getFirebaseAuth: () => firebaseAuth,
    getPartnerDisplayName: () => partner.value?.display_name,
    closeUnlockConfirm,
    loadTicketsBalance,
    setLoading,
    showError,
    showSuccess: success,
  });

  // ==========================================
  // Voice Management - 語音管理
  // ==========================================
  const {
    handlePlayVoice,
    handleWatchVoiceAd,
    handleUseVoiceUnlockCard,
  } = useVoiceManagement({
    getCurrentUserId: () => currentUserId.value,
    playVoice,
    loadVoiceStats,
    checkVoiceLimit,
    unlockVoiceByAd: () => {}, // TODO: 從 useChatLimits 獲取
    loadTicketsBalance,
    showVoiceLimit,
    closeVoiceLimit,
    getVoiceLimitPendingMessage: () => null, // TODO: 實現
    showError,
    showSuccess: success,
  });

  // ==========================================
  // Selfie Generation - 自拍照片生成
  // ==========================================
  const {
    handleRequestSelfie,
    handleUsePhotoUnlockCard,
  } = useSelfieGeneration({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getFirebaseAuth: () => firebaseAuth,
    messages,
    messageListRef: computed(() => chatContentRef.value?.messageListRef),
    rollbackUserMessage,
    requireLogin,
    canGeneratePhoto,
    fetchPhotoStats,
    showPhotoLimit,
    createLimitModalData,
    requestSelfie,
    closePhotoLimit,
    loadTicketsBalance,
    showError,
    showSuccess: success,
    config,
  });

  // ==========================================
  // Video Generation - 視頻生成
  // ==========================================
  const {
    isRequestingVideo,
    handleRequestVideo,
    generateVideo,
  } = useVideoGeneration({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getFirebaseAuth: () => firebaseAuth,
    messages,
    messageListRef: computed(() => chatContentRef.value?.messageListRef),
    rollbackUserMessage,
    requireLogin,
    showVideoLimit,
    showPhotoSelector,
    createLimitModalData,
    showError,
    showSuccess: success,
    config,
  });

  // ==========================================
  // Gift Management - 禮物管理
  // ==========================================
  const {
    handleOpenGiftSelector,
    handleSelectGift,
  } = useGiftManagement({
    getCurrentUserId: () => currentUserId.value,
    openGiftSelector,
    sendGift,
    loadBalance,
    showGiftAnimation,
    closeGiftAnimation,
  });

  // ==========================================
  // Favorite Management - 收藏管理
  // ==========================================
  const {
    isFavoriteMutating,
    toggleFavorite,
  } = useFavoriteManagement({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getPartnerName: () => partner.value?.displayName || partner.value?.display_name || '',
    getUser: () => user.value,
    getFirebaseAuth: () => firebaseAuth,
    setUserProfile,
    requireLogin,
    showError,
    showSuccess: success,
  });

  // ==========================================
  // 返回所有功能狀態和方法
  // ==========================================
  return {
    // Potion - 藥水相關
    userPotions,
    activeMemoryBoost,
    activeBrainBoost,
    loadPotions,
    loadActivePotions,
    activePotionEffects,
    handleConfirmUsePotion,

    // Character Unlock - 角色解鎖
    isCharacterUnlocked,
    loadActiveUnlocks,
    activeUnlockEffects,
    resetUnlockDataLoadedState,
    handleConfirmUnlockCharacter,

    // Voice - 語音
    playingVoiceMessageId,
    handlePlayVoice,
    handleWatchVoiceAd,
    handleUseVoiceUnlockCard,
    playVoice, // 底層函數

    // Selfie - 自拍照片
    isRequestingSelfie, // 從 chatActions
    photoRemaining, // 從 options
    handleRequestSelfie, // 從 useSelfieGeneration
    handleUsePhotoUnlockCard, // 從 useSelfieGeneration
    requestSelfie, // 底層函數從 chatActions

    // Video - 視頻
    isRequestingVideo,
    handleRequestVideo,
    generateVideo,

    // Gift - 禮物
    isSendingGift, // 從 chatActions
    showGiftSelector: showGiftSelectorState, // 從 chatActions (ref 狀態)
    handleOpenGiftSelector, // 從 useGiftManagement
    handleSelectGift, // 從 useGiftManagement
    openGiftSelector, // 底層函數從 chatActions
    closeGiftSelector: closeGiftSelectorFromActions, // 底層函數從 chatActions
    sendGift, // 底層函數從 chatActions

    // Favorite - 收藏
    isFavoriteMutating,
    toggleFavorite,
  };
}
