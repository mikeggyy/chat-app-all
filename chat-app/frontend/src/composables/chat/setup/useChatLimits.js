/**
 * Chat 限制服務
 * 管理對話、語音、照片等使用限制
 */

import { useConversationLimit } from '../../useConversationLimit';
import { useVoiceLimit } from '../../useVoiceLimit';
import { usePhotoLimit } from '../../usePhotoLimit';
import { useGuestGuard } from '../../useGuestGuard';
import { useCoins } from '../../useCoins';
import { useUnlockTickets } from '../../useUnlockTickets';

/**
 * 設置所有限制服務
 * @returns {Object} 限制相關的狀態和方法
 */
export function useChatLimits() {
  // Conversation Limit
  const { checkLimit, unlockByAd, getLimitState } = useConversationLimit();

  // Voice Limit
  const {
    checkVoiceLimit,
    unlockVoiceByAd,
    getVoiceLimitState,
    loadVoiceStats,
  } = useVoiceLimit();

  // Photo Limit
  const { checkPhotoLimit, fetchPhotoStats } = usePhotoLimit();

  // Guest Guard
  const {
    isGuest,
    canGuestSendMessage,
    requireLogin,
    incrementGuestMessageCount,
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
    loadTicketsBalance,
  } = useUnlockTickets();

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

    // Guest Guard
    isGuest,
    canGuestSendMessage,
    requireLogin,
    incrementGuestMessageCount,

    // Coins & Balance
    balance,
    loadBalance,

    // Unlock Tickets
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,
    loadTicketsBalance,
  };
}
