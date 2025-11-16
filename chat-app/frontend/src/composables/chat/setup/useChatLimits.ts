// @ts-nocheck
/**
 * Chat 限制服務
 * 管理對話、語音、照片等使用限制
 */

import type { Ref, ComputedRef } from 'vue';
import { useConversationLimit } from '../../useConversationLimit.js';
import { useVoiceLimit } from '../../useVoiceLimit.js';
import { usePhotoLimit } from '../../usePhotoLimit.js';
import { useGuestGuard } from '../../useGuestGuard.js';
import { useCoins } from '../../useCoins.js';
import { useUnlockTickets } from '../../useUnlockTickets.js';

// ==================== 類型定義 ====================

/**
 * 解鎖券狀態
 */
export interface TicketsState {
  characterUnlockCards: number;
  photoUnlockCards: number;
  videoUnlockCards: number;
  voiceUnlockCards: number;
  createCards: number;
  usageHistory: any[];
}

/**
 * 格式化的解鎖券數量
 */
export interface FormattedTickets {
  character: string;
  photo: string;
  video: string;
  voice: string;
  create: string;
  total: string;
}

/**
 * 解鎖券系統選項
 */
export interface TicketOptions {
  skipGlobalLoading?: boolean;
}

/**
 * 解鎖券系統返回類型
 */
export interface UseUnlockTicketsReturn {
  // State
  tickets: Ref<TicketsState>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;

  // Actions
  loadBalance: (userId?: string, options?: TicketOptions) => Promise<any>;
  useCharacterTicket: (userId: string, characterId: string, options?: TicketOptions) => Promise<any>;
  usePhotoCard: (userId: string, characterId?: string, options?: TicketOptions) => Promise<any>;
  useVideoCard: (userId: string, characterId?: string, options?: TicketOptions) => Promise<any>;
  checkTicketAvailability: (userId: string, ticketType: string, options?: TicketOptions) => Promise<boolean>;
  loadHistory: (userId?: string, options?: TicketOptions) => Promise<any>;

  // Computed
  characterTickets: ComputedRef<number>;
  photoCards: ComputedRef<number>;
  videoCards: ComputedRef<number>;
  voiceCards: ComputedRef<number>;
  createCards: ComputedRef<number>;
  usageHistory: ComputedRef<any[]>;
  hasCharacterTickets: ComputedRef<boolean>;
  hasPhotoCards: ComputedRef<boolean>;
  hasVideoCards: ComputedRef<boolean>;
  hasVoiceCards: ComputedRef<boolean>;
  hasCreateCards: ComputedRef<boolean>;
  totalTickets: ComputedRef<number>;
  formattedTickets: ComputedRef<FormattedTickets>;
}

/**
 * 限制檢查結果
 */
export interface LimitCheckResult {
  allowed: boolean;
  remaining: number;
  total: number;
  used?: number;
  resetTime?: Date | string;
}

/**
 * 每角色限制數據
 */
export interface PerCharacterLimitData {
  [characterId: string]: LimitCheckResult;
}

/**
 * 照片限制資訊
 */
export interface PhotoLimitInfo {
  used: number;
  remaining: number;
  total: number;
  standardTotal: number | null;
  isTestAccount: boolean;
  cards: number;
  tier: string;
  resetPeriod?: string;
}

/**
 * 照片檢查結果
 */
export interface PhotoCheckResult extends LimitCheckResult {
  tier?: string;
  cards?: number;
  resetPeriod?: string;
}

/**
 * 廣告解鎖結果
 */
export interface AdUnlockResult {
  success: boolean;
  remaining: number;
  message?: string;
  adId?: string;
}

/**
 * useChatLimits 返回類型
 * 聚合所有限制相關的 composables
 */
export interface UseChatLimitsReturn {
  // Conversation Limit
  checkLimit: (userId?: string, characterId?: string, options?: any) => Promise<LimitCheckResult | null>;
  unlockByAd: (userId: string, characterId: string, adId?: string, options?: any) => Promise<AdUnlockResult>;
  getLimitState: (userId?: string, characterId?: string) => LimitCheckResult | null;

  // Voice Limit
  checkVoiceLimit: (userId?: string, characterId?: string, options?: any) => Promise<LimitCheckResult | null>;
  unlockVoiceByAd: (userId: string, characterId?: string | null, adId?: string, options?: any) => Promise<any>;
  getVoiceLimitState: (characterId: string) => ComputedRef<LimitCheckResult | null>;
  loadVoiceStats: (userId?: string, options?: any) => Promise<any>;

  // Photo Limit
  checkPhotoLimit: () => Promise<PhotoCheckResult | LimitCheckResult>;
  fetchPhotoStats: () => Promise<any>;
  canGeneratePhoto: () => Promise<PhotoCheckResult | LimitCheckResult>;
  photoRemaining: ComputedRef<number>;

  // Guest Guard
  isGuest: ComputedRef<boolean>;
  canGuestSendMessage: () => boolean;
  requireLogin: (options?: any) => boolean;
  incrementGuestMessageCount: () => void;
  guestRemainingMessages: ComputedRef<number | null>;

  // Coins & Balance
  balance: ComputedRef<number>;
  loadBalance: (userId?: string, options?: any) => Promise<any>;

  // Unlock Tickets
  characterTickets: ComputedRef<number>;
  hasCharacterTickets: ComputedRef<boolean>;
  voiceCards: ComputedRef<number>;
  photoCards: ComputedRef<number>;
  videoCards: ComputedRef<number>;
  createCards: ComputedRef<number>;
  loadTicketsBalance: (userId?: string, options?: any) => Promise<any>;
}

// ==================== Composable 主函數 ====================

/**
 * 設置所有限制服務
 * 整合對話、語音、照片限制，以及訪客守衛、金幣和解鎖券系統
 *
 * @returns 限制相關的狀態和方法
 */
export function useChatLimits(): UseChatLimitsReturn {
  // Conversation Limit
  const { checkLimit, unlockByAd, getLimitState } = useConversationLimit();

  // Voice Limit
  const {
    checkVoiceLimit,
    unlockByAd: unlockVoiceByAd,
    getCharacterVoiceStatus: getVoiceLimitState,
    loadVoiceStats,
  } = useVoiceLimit();

  // Photo Limit
  const {
    checkPhotoLimit,
    fetchPhotoStats,
    canGeneratePhoto,
    remaining: photoRemaining,
  } = usePhotoLimit();

  // Guest Guard
  const {
    isGuest,
    canGuestSendMessage,
    requireLogin,
    incrementGuestMessageCount,
    guestRemainingMessages,
  } = useGuestGuard();

  // Coins & Balance
  const { balance, loadBalance } = useCoins();

  // Unlock Tickets
  const {
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,
    createCards,
    loadBalance: loadTicketsBalance,
  } = useUnlockTickets() as UseUnlockTicketsReturn;

  return {
    // Conversation Limit
    checkLimit,
    unlockByAd,
    getLimitState,

    // Voice Limit
    checkVoiceLimit,
    unlockVoiceByAd,
    getVoiceLimitState,
    loadVoiceStats,

    // Photo Limit
    checkPhotoLimit,
    fetchPhotoStats,
    canGeneratePhoto,
    photoRemaining,

    // Guest Guard
    isGuest,
    canGuestSendMessage,
    requireLogin,
    incrementGuestMessageCount,
    guestRemainingMessages,

    // Coins & Balance
    balance,
    loadBalance,

    // Unlock Tickets
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,
    createCards,
    loadTicketsBalance,
  };
}
