/**
 * 統一的聊天上下文管理 Composable
 *
 * 將常用的狀態、方法和依賴集中管理，減少重複代碼和參數傳遞
 * 提升 ChatView 組件的性能和可維護性
 */

import { computed, provide, inject } from 'vue';
import { useUserProfile } from '../useUserProfile';
import { useFirebaseAuth } from '../useFirebaseAuth';
import { useToast } from '../useToast';
import { useGuestGuard } from '../useGuestGuard';
import { useCoins } from '../useCoins';
import { useUnlockTickets } from '../useUnlockTickets';

// Context Key
const CHAT_CONTEXT_KEY = Symbol('chat-context');

/**
 * 創建聊天上下文（在 ChatView 中使用）
 */
export function useChatContext() {
  // ====================
  // 核心狀態和服務
  // ====================
  const { user, setUserProfile, addConversationHistory } = useUserProfile();
  const firebaseAuth = useFirebaseAuth();
  const { success, error: showError } = useToast();

  // Guest Guard
  const {
    isGuest,
    requireLogin,
    canGuestSendMessage,
    incrementGuestMessageCount,
    guestRemainingMessages,
  } = useGuestGuard();

  // Coins
  const { balance, loadBalance } = useCoins();

  // Unlock Tickets
  const {
    loadBalance: loadTicketsBalance,
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,
    createCards,
  } = useUnlockTickets();

  // ====================
  // Context 對象
  // ====================
  const context = {
    // 用戶相關
    user,
    setUserProfile,
    addConversationHistory,
    isGuest,

    // 認證
    firebaseAuth,

    // Toast 通知
    success,
    showError,

    // Guest 保護
    requireLogin,
    canGuestSendMessage,
    incrementGuestMessageCount,
    guestRemainingMessages,

    // 虛擬貨幣
    balance,
    loadBalance,

    // 解鎖券
    loadTicketsBalance,
    characterTickets,
    hasCharacterTickets,
    voiceCards,
    photoCards,
    videoCards,
    createCards,

    // Computed - 當前用戶 ID
    currentUserId: computed(() => user.value?.id || ''),
  };

  // 提供 context 給子組件
  provide(CHAT_CONTEXT_KEY, context);

  return context;
}

/**
 * 使用聊天上下文（在 子 composable 中使用）
 */
export function useInjectChatContext() {
  const context = inject(CHAT_CONTEXT_KEY);

  if (!context) {
    throw new Error('useChatContext must be called within a component that uses useChatContext');
  }

  return context;
}

/**
 * 創建標準化的 composable 配置
 * 用於減少重複的參數傳遞
 */
export function createComposableConfig(overrides = {}) {
  const context = inject(CHAT_CONTEXT_KEY);

  if (!context) {
    throw new Error('createComposableConfig must be called within a component that uses useChatContext');
  }

  return {
    getCurrentUserId: () => context.currentUserId.value,
    getFirebaseAuth: () => context.firebaseAuth,
    showError: context.showError,
    showSuccess: context.success,
    requireLogin: context.requireLogin,
    loadBalance: context.loadBalance,
    loadTicketsBalance: context.loadTicketsBalance,
    ...overrides,
  };
}
