/**
 * Chat 核心狀態和服務
 * 管理用戶、角色、消息等核心數據
 */

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUserProfile } from '../../useUserProfile';
import { useFirebaseAuth } from '../../useFirebaseAuth';
import { useToast } from '../../useToast';
import { usePartner } from '../usePartner';
import { useChatMessages } from '../useChatMessages';
import { useSuggestions } from '../useSuggestions';

/**
 * 設置 Chat 核心服務
 * @param {Object} options - 選項
 * @returns {Object} 核心狀態和方法
 */
export function useChatCore() {
  const route = useRoute();

  // Core Services
  const { user, setUserProfile, addConversationHistory } = useUserProfile();
  const firebaseAuth = useFirebaseAuth();
  const { success, error: showError } = useToast();

  // Partner Data
  const partnerId = computed(() => route.params.id);
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
  } = useSuggestions();

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
