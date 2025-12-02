/**
 * useChatFeatures.ts
 * Chat 功能模塊（TypeScript 版本）
 * 管理禮物、自拍、視頻、藥水、解鎖等功能
 */

import { type Ref, computed } from 'vue';
import { useChatActions, type UseChatActionsReturn } from '../useChatActions.js';
import type { ModalsState, PhotoVideoLimitData, PotionType as ModalPotionType } from '../useModalManager.js';
import { usePotionManagement, type UsePotionManagementReturn, type PotionType } from '../usePotionManagement.js';
import { useSelfieGeneration, type UseSelfieGenerationReturn, type UseSelfieGenerationDeps } from '../useSelfieGeneration.js';
import { useVideoGeneration, type UseVideoGenerationReturn, type UseVideoGenerationDeps } from '../useVideoGeneration.js';
import { useVideoCompletionNotification, type UseVideoCompletionNotificationReturn, type VideoCompletionNotification } from '../useVideoCompletionNotification.js';
import { useGenerationFailureNotification, type UseGenerationFailureNotificationReturn, type GenerationFailure } from '../useGenerationFailureNotification.js';
import { useGiftManagement, type UseGiftManagementReturn, type UseGiftManagementDeps } from '../useGiftManagement.js';
import { useCharacterUnlock, type UseCharacterUnlockReturn } from '../useCharacterUnlock.js';
import { useFavoriteManagement, type UseFavoriteManagementReturn } from '../useFavoriteManagement.js';
import { useVoiceManagement, type UseVoiceManagementReturn, type UseVoiceManagementDeps } from '../useVoiceManagement.js';
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

  // 模態框狀態（✅ 新增）
  modals: ModalsState;

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
  showPotionConfirm: (type: ModalPotionType) => void;
  showPotionLimit: (type: ModalPotionType) => void;
  showUnlockConfirm: () => void;
  showUnlockLimit: () => void;
  showPhotoLimit: (data: Partial<PhotoVideoLimitData> | any) => void;
  showVoiceLimit: (limitInfo: any, pendingMessage?: Message | null) => void;
  showVideoLimit: (data: Partial<PhotoVideoLimitData> | any) => void;
  showPhotoSelector: (useCardOrForGift?: boolean, pendingGift?: any) => void;
  // showGiftSelector 和 closeGiftSelector 從 useChatActions 內部獲取，不需要作為參數
  closePhotoSelector: () => void;
  closeVideoLimit: () => void;
  showGiftAnimation: (emoji: string, name: string) => void;
  closeGiftAnimation: () => void;

  // 狀態管理
  setLoading: (key: string, loading: boolean) => void;
  loadBalance: () => Promise<void>;
  showError: (message: string) => void;
  success: (message: string) => void;
  rollbackUserMessage: (messageId: string) => void;
  createLimitModalData: (limitCheck: any, type?: string) => LimitModalData;
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
  activeCharacterUnlock: UseCharacterUnlockReturn['activeCharacterUnlock'];
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

  // Video Completion Notification - 影片完成通知
  videoNotification: Ref<VideoCompletionNotification | null>;
  showVideoNotification: UseVideoCompletionNotificationReturn['showNotification'];
  hideVideoNotification: UseVideoCompletionNotificationReturn['hideNotification'];
  scrollToVideo: UseVideoCompletionNotificationReturn['scrollToVideo'];

  // Generation Failure Notification - 生成失敗通知
  generationFailures: Ref<GenerationFailure[]>;
  clearGenerationFailure: UseGenerationFailureNotificationReturn['clearFailure'];
  clearAllGenerationFailures: UseGenerationFailureNotificationReturn['clearAllFailures'];
  checkForGenerationFailures: UseGenerationFailureNotificationReturn['checkForFailures'];
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
    modals, // ✅ 新增：模態框狀態
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
    getPotionType: () => modals.potionConfirm.type as PotionType | null, // ✅ 從 modals 獲取藥水類型
    closePotionConfirm,
    setLoading,
    showError,
    showSuccess: success,
  });

  // ==========================================
  // Character Unlock - 角色解鎖
  // ==========================================
  const {
    activeCharacterUnlock,
    isCharacterUnlocked,
    loadActiveUnlocks,
    activeUnlockEffects,
    resetUnlockDataLoadedState,
    handleConfirmUnlockCharacter,
  } = useCharacterUnlock({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getFirebaseAuth: () => firebaseAuth,
    getPartnerDisplayName: () => partner.value?.display_name || '',
    closeUnlockConfirm,
    loadTicketsBalance,
    setLoading,
    showError,
    showSuccess: success,
  });

  // ==========================================
  // Voice Management - 語音管理
  // ==========================================
  // 注意：playVoice 和 checkVoiceLimit 的類型在不同 composable 間有差異
  // 使用類型斷言來橋接這些差異（架構級問題，未來應統一類型定義）
  const {
    handlePlayVoice,
    handleWatchVoiceAd,
    handleUseVoiceUnlockCard,
  } = useVoiceManagement({
    getCurrentUserId: () => currentUserId.value,
    playVoice: playVoice as unknown as UseVoiceManagementDeps['playVoice'],
    loadVoiceStats,
    checkVoiceLimit: checkVoiceLimit as unknown as UseVoiceManagementDeps['checkVoiceLimit'],
    unlockVoiceByAd: (async () => {}) as UseVoiceManagementDeps['unlockVoiceByAd'], // TODO: 從 useChatLimits 獲取
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
  // 適配器函數：將 rollbackUserMessage 包裝為 useSelfieGeneration 期望的類型
  const rollbackUserMessageAdapter: UseSelfieGenerationDeps['rollbackUserMessage'] = async (_userId, _characterId, messageId) => {
    rollbackUserMessage(messageId);
  };

  // 適配器函數：fetchPhotoStats 返回 void
  const fetchPhotoStatsAdapter: UseSelfieGenerationDeps['fetchPhotoStats'] = async () => {
    await fetchPhotoStats();
  };

  // 適配器函數：createLimitModalData
  const createLimitModalDataForSelfie: UseSelfieGenerationDeps['createLimitModalData'] = (limitCheck, type) => {
    return createLimitModalData(limitCheck, type);
  };

  // 適配器：config 轉換為 SelfieGenerationConfig
  const selfieConfig: UseSelfieGenerationDeps['config'] = {
    MESSAGE_ID_PREFIXES: config.MESSAGE_ID_PREFIXES || { selfie: 'selfie-' },
  };

  const {
    handleRequestSelfie,
    handleUsePhotoUnlockCard,
  } = useSelfieGeneration({
    getCurrentUserId: () => currentUserId.value,
    getPartnerId: () => partnerId.value,
    getFirebaseAuth: () => firebaseAuth,
    messages,
    messageListRef: computed(() => chatContentRef.value?.messageListRef),
    rollbackUserMessage: rollbackUserMessageAdapter,
    requireLogin,
    canGeneratePhoto,
    fetchPhotoStats: fetchPhotoStatsAdapter,
    showPhotoLimit,
    createLimitModalData: createLimitModalDataForSelfie,
    requestSelfie,
    closePhotoLimit,
    loadTicketsBalance,
    showError,
    showSuccess: success,
    config: selfieConfig,
    // ✅ 照片生成失敗回調
    onPhotoFailed: (characterId: string, characterName: string, reason?: string) => {
      addGenerationFailure({
        type: 'photo',
        characterId,
        characterName,
        failedAt: new Date().toISOString(),
        reason,
      });
    },
    getPartnerName: () => partner.value?.display_name || '角色',
  });

  // ==========================================
  // Video Completion Notification - 影片完成通知
  // ==========================================
  const {
    notification: videoNotification,
    showNotification: showVideoNotification,
    hideNotification: hideVideoNotification,
    scrollToVideo,
  } = useVideoCompletionNotification();

  // ==========================================
  // Generation Failure Notification - 生成失敗通知
  // ==========================================
  const {
    failures: generationFailures,
    addFailure: addGenerationFailure,
    clearFailure: clearGenerationFailure,
    clearAllFailures: clearAllGenerationFailures,
    checkForFailures: checkForGenerationFailures,
  } = useGenerationFailureNotification();

  // ==========================================
  // Video Generation - 視頻生成
  // ==========================================
  // 適配器函數：將 rollbackUserMessage 包裝為 useVideoGeneration 期望的類型
  const rollbackUserMessageForVideo: UseVideoGenerationDeps['rollbackUserMessage'] = async (_userId, _characterId, messageId) => {
    rollbackUserMessage(messageId);
  };

  // 適配器函數：createLimitModalData
  const createLimitModalDataForVideo: UseVideoGenerationDeps['createLimitModalData'] = (limitCheck, type) => {
    return createLimitModalData(limitCheck, type);
  };

  // 適配器：config 轉換為 VideoGenerationConfig
  // 注意：config 類型在不同 composable 間有差異，使用類型斷言來橋接
  const videoConfig = {
    MESSAGE_ID_PREFIXES: config.MESSAGE_ID_PREFIXES || { video: 'video-' },
    VIDEO_CONFIG: config.VIDEO_CONFIG || {},
    AI_VIDEO_RESPONSE_TEXT: config.AI_VIDEO_RESPONSE_TEXT || '',
    VIDEO_REQUEST_MESSAGES: config.VIDEO_REQUEST_MESSAGES || [],
  } as UseVideoGenerationDeps['config'];

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
    rollbackUserMessage: rollbackUserMessageForVideo,
    requireLogin,
    showVideoLimit,
    showPhotoSelector,
    createLimitModalData: createLimitModalDataForVideo,
    showError,
    showSuccess: success,
    config: videoConfig,
    // ✅ 影片完成回調
    onVideoCompleted: (videoMessageId: string) => {
      const characterName = partner.value?.display_name || '角色';
      showVideoNotification(videoMessageId, characterName);
    },
    // ✅ 影片生成失敗回調
    onVideoFailed: (characterId: string, characterName: string, reason?: string) => {
      addGenerationFailure({
        type: 'video',
        characterId,
        characterName,
        failedAt: new Date().toISOString(),
        reason,
      });
    },
    getPartnerName: () => partner.value?.display_name || '角色',
  });

  // ==========================================
  // Gift Management - 禮物管理
  // ==========================================
  // 適配器函數：將 sendGift 包裝為 useGiftManagement 期望的類型
  const sendGiftAdapter: UseGiftManagementDeps['sendGift'] = async (giftData, onSuccess, selectedPhotoUrl) => {
    await sendGift(giftData, onSuccess ? () => onSuccess() : undefined, selectedPhotoUrl);
  };

  const {
    handleOpenGiftSelector,
    handleSelectGift,
  } = useGiftManagement({
    getCurrentUserId: () => currentUserId.value,
    openGiftSelector,
    sendGift: sendGiftAdapter,
    loadBalance,
    showGiftAnimation,
    closeGiftAnimation,
    showPhotoSelector, // ✅ 新增:打開照片選擇器
    closeGiftSelector: closeGiftSelectorFromActions, // ✅ 新增:關閉禮物選擇器
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
    getPartnerName: () => partner.value?.display_name || '',
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
    activeCharacterUnlock,
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

    // Video Completion Notification - 影片完成通知
    videoNotification,
    showVideoNotification,
    hideVideoNotification,
    scrollToVideo,

    // Generation Failure Notification - 生成失敗通知
    generationFailures,
    clearGenerationFailure,
    clearAllGenerationFailures,
    checkForGenerationFailures,
  };
}
