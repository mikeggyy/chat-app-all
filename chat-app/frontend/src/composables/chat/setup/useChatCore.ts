// @ts-nocheck
/**
 * Chat 核心狀態和服務（TypeScript 版本）
 * 管理用戶、角色、消息等核心數據
 */

import { computed, type ComputedRef, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useUserProfile } from '../../useUserProfile.js';
import { useFirebaseAuth } from '../../useFirebaseAuth.js';
import { useToast } from '../../useToast.js';
import { usePartner } from '../usePartner.js';
import { useChatMessages } from '../useChatMessages.js';
import { useSuggestions } from '../useSuggestions.js';
import type { User, Partner, Message, FirebaseAuthService } from '../../../types';

// ==================== 類型定義 ====================

/**
 * useChatCore 返回類型
 */
export interface UseChatCoreReturn {
  // Core User & Auth
  user: ComputedRef<User | null>;
  firebaseAuth: FirebaseAuthService;
  currentUserId: ComputedRef<string>;
  setUserProfile: (profile: Partial<User>) => void;
  addConversationHistory: (characterId: string) => Promise<User>;

  // Toast
  success: (message: string) => void;
  showError: (message: string) => void;

  // Partner
  partnerId: ComputedRef<string>;
  partner: Ref<Partner | null>;
  partnerDisplayName: ComputedRef<string>;
  partnerBackground: ComputedRef<string>;
  backgroundStyle: ComputedRef<Record<string, string>>;
  isFavorited: ComputedRef<boolean>;
  loadPartner: (characterId: string) => Promise<void>;

  // Messages
  messages: Ref<Message[]>;
  isReplying: Ref<boolean>;
  isLoadingHistory: Ref<boolean>;
  loadHistory: () => Promise<void>;
  sendMessageToApi: (messageText: string, messageId: string) => Promise<void>;
  resetConversationApi: (userId: string, characterId: string) => Promise<void>;
  cleanupMessages: () => void;

  // Suggestions
  suggestionOptions: Ref<string[]>;
  isLoadingSuggestions: Ref<boolean>;
  suggestionError: Ref<string | null>;
  loadSuggestions: () => Promise<void>;
  invalidateSuggestions: () => void;
}

// ==================== Composable 主函數 ====================

/**
 * 設置 Chat 核心服務
 * @returns 核心狀態和方法
 */
export function useChatCore(): UseChatCoreReturn {
  const route = useRoute();

  // Core Services
  const { user, setUserProfile, addConversationHistory } = useUserProfile();
  const firebaseAuth = useFirebaseAuth();
  const { success, error: showError } = useToast();

  // Partner Data
  const partnerId = computed(() => route.params.id as string);
  const {
    partner,
    partnerDisplayName,
    partnerBackground,
    backgroundStyle,
    loadPartner,
  } = usePartner({ partnerId });

  const currentUserId = computed(() => user.value?.id || '');

  // Favorite State
  const isFavorited = computed(() => {
    const favoritesList = Array.isArray(user.value?.favorites)
      ? user.value.favorites
      : [];
    return favoritesList.includes(partnerId.value);
  });

  // Messages
  const {
    messages,
    isReplying,
    isLoadingHistory,
    loadHistory,
    sendMessageToApi,
    resetConversationApi,
    cleanupMessages,
  } = useChatMessages(partnerId);

  // Suggestions
  const {
    suggestionOptions,
    isLoadingSuggestions,
    suggestionError,
    loadSuggestions,
    invalidateSuggestions,
  } = useSuggestions(messages, partner, firebaseAuth, currentUserId);

  return {
    // Core User & Auth
    user,
    firebaseAuth,
    currentUserId,
    setUserProfile,
    addConversationHistory,

    // Toast
    success,
    showError,

    // Partner
    partnerId,
    partner,
    partnerDisplayName,
    partnerBackground,
    backgroundStyle,
    isFavorited,
    loadPartner,

    // Messages
    messages,
    isReplying,
    isLoadingHistory,
    loadHistory,
    sendMessageToApi,
    resetConversationApi,
    cleanupMessages,

    // Suggestions
    suggestionOptions,
    isLoadingSuggestions,
    suggestionError,
    loadSuggestions,
    invalidateSuggestions,
  };
}
