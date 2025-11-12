<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";

// Chat 組件
import ChatHeader from "../components/chat/ChatHeader.vue";
import MessageList from "../components/chat/MessageList.vue";
import MessageInput from "../components/chat/MessageInput.vue";
import ChatModals from "../components/chat/ChatModals.vue";

// Composables
import { useUserProfile } from "../composables/useUserProfile";
import { useFirebaseAuth } from "../composables/useFirebaseAuth";
import { useConversationLimit } from "../composables/useConversationLimit";
import { useVoiceLimit } from "../composables/useVoiceLimit";
import { usePhotoLimit } from "../composables/usePhotoLimit";
import { useToast } from "../composables/useToast";
import { useGuestGuard } from "../composables/useGuestGuard";
import { useCoins } from "../composables/useCoins";
import { useUnlockTickets } from "../composables/useUnlockTickets";

// 新的 Chat Composables
import { useChatMessages } from "../composables/chat/useChatMessages";
import { useSuggestions } from "../composables/chat/useSuggestions";
import { useChatActions } from "../composables/chat/useChatActions";
import { useModalManager } from "../composables/chat/useModalManager";
import { useVideoGeneration } from "../composables/chat/useVideoGeneration";
import { usePotionManagement } from "../composables/chat/usePotionManagement";
import { useSelfieGeneration } from "../composables/chat/useSelfieGeneration";
import { useCharacterUnlock } from "../composables/chat/useCharacterUnlock";
import { useVoiceManagement } from "../composables/chat/useVoiceManagement";
import { useConversationLimitActions } from "../composables/chat/useConversationLimitActions";
import { useGiftManagement } from "../composables/chat/useGiftManagement";
import { useFavoriteManagement } from "../composables/chat/useFavoriteManagement";
import { useShareFunctionality } from "../composables/chat/useShareFunctionality";
import { useConversationReset } from "../composables/chat/useConversationReset";
import { usePhotoVideoHandler } from "../composables/chat/usePhotoVideoHandler";

// Utils
import { fallbackMatches } from "../utils/matchFallback";
import { isGuestUser } from "../../../../shared/config/testAccounts";
import { apiJson } from "../utils/api";
import { appendCachedHistory } from "../utils/conversationCache";
import { logger } from "@/utils/logger";

const router = useRouter();
const route = useRoute();

// ====================
// Constants
// ====================
const MESSAGE_ID_PREFIXES = {
  SELFIE_REQUEST: "msg-selfie-request-",
  VIDEO_REQUEST: "msg-video-request-",
  VIDEO_AI: "msg-video-ai-",
  FIRST: "msg-first-",
};

const VIDEO_REQUEST_MESSAGES = [
  "能給我看一段你的影片嗎？",
  "想看看你的影片！",
  "可以拍一段影片給我看嗎？",
  "期待看到你的影片！",
];

const VIDEO_CONFIG = {
  DURATION: "4s",
  RESOLUTION: "720p",
  ASPECT_RATIO: "9:16",
};

const AI_VIDEO_RESPONSE_TEXT = "這是我為你準備的影片！";

// ====================
// User & Auth
// ====================
const { user, setUserProfile, addConversationHistory } = useUserProfile();
const firebaseAuth = useFirebaseAuth();
const { success, error: showError } = useToast();

// Favorite State
const isFavorited = computed(() => {
  const favoritesList = Array.isArray(user.value?.favorites)
    ? user.value.favorites
    : [];
  return favoritesList.includes(partnerId.value);
});

// Limits
const { checkLimit, unlockByAd, getLimitState } = useConversationLimit();
const {
  checkVoiceLimit,
  unlockByAd: unlockVoiceByAd,
  loadVoiceStats,
} = useVoiceLimit();
const {
  fetchPhotoStats,
  canGeneratePhoto,
  remaining: photoRemaining,
} = usePhotoLimit();

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

// Partner Data
const partnerId = computed(() => route.params.id);
const partner = ref(null);

// Chat Page Ref (用於截圖)
const chatPageRef = ref(null);

// 从 API 加载角色数据
const loadPartner = async (characterId) => {
  if (!characterId) {
    partner.value = null;
    return;
  }

  try {
    const response = await apiJson(
      `/match/${encodeURIComponent(characterId)}`,
      {
        skipGlobalLoading: true,
      }
    );
    partner.value = response?.character || null;
  } catch (error) {
    // Fallback 到内存数组
    partner.value = fallbackMatches.find((m) => m.id === characterId) || null;
  }
};

const partnerDisplayName = computed(() => {
  return partner.value?.display_name || "未知角色";
});

const partnerBackground = computed(() => {
  return partner.value?.background || "";
});

// Background Style
const backgroundStyle = computed(() => {
  if (!partner.value?.portraitUrl) return {};
  return {
    backgroundImage: `url(${partner.value.portraitUrl})`,
  };
});

// Current User ID
const currentUserId = computed(() => user.value?.id || "");

// ====================
// Chat Messages (useChatMessages)
// ====================
const {
  messages,
  isReplying,
  isLoadingHistory,
  loadHistory,
  sendMessage: sendMessageToApi,
  requestReply,
  resetConversation: resetConversationApi,
  cleanup: cleanupMessages,
} = useChatMessages(partnerId);

// ====================
// Suggestions (useSuggestions)
// ====================
const {
  suggestionOptions,
  isLoadingSuggestions,
  suggestionError,
  loadSuggestions,
  invalidateSuggestions,
} = useSuggestions(messages, partner, firebaseAuth, currentUserId);

// ====================
// Chat Actions (useChatActions)
// ====================
const {
  // Selfie
  isRequestingSelfie,
  requestSelfie,

  // Gift
  showGiftSelector,
  isSendingGift,
  openGiftSelector,
  closeGiftSelector,
  sendGift,

  // Voice
  playingVoiceMessageId,
  playVoice,
} = useChatActions({
  messages,
  partner,
  currentUserId,
  firebaseAuth,
  toast: { success, error: showError },
  requireLogin,
  scrollToBottom: () => messageListRef.value?.scrollToBottom(),
  appendCachedHistory: (entries) => {
    const matchId = partner.value?.id ?? "";
    const userId = currentUserId.value ?? "";
    if (!matchId || !userId) return;
    appendCachedHistory(userId, matchId, entries);
  },
});

// ====================
// Video Generation
// ====================
const {
  isRequestingVideo,
  generateVideo,
  handleRequestVideo,
} = useVideoGeneration({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partner.value?.id,
  getFirebaseAuth: () => firebaseAuth,
  messages,
  messageListRef,
  rollbackUserMessage,
  requireLogin,
  showVideoLimit,
  showPhotoSelector,
  createLimitModalData,
  showError,
  showSuccess: success,
  config: {
    MESSAGE_ID_PREFIXES,
    VIDEO_CONFIG,
    AI_VIDEO_RESPONSE_TEXT,
    VIDEO_REQUEST_MESSAGES,
  },
});

// ====================
// Local State
// ====================
const draft = ref("");
const messageListRef = ref(null);
const messageInputRef = ref(null);

// ====================
// Modal Manager
// ====================
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
  update: updateModal,
} = useModalManager();

// ====================
// Potion Management
// ====================
const {
  userPotions,
  activePotionEffects,
  activeMemoryBoost,
  activeBrainBoost,
  loadPotions,
  loadActivePotions,
  handleConfirmUsePotion,
} = usePotionManagement({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getPotionType: () => modals.potionConfirm.type,
  closePotionConfirm,
  setLoading,
  showError,
  showSuccess: success,
});

// ====================
// Selfie Generation
// ====================
const {
  handleRequestSelfie,
  handleUsePhotoUnlockCard,
} = useSelfieGeneration({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getFirebaseAuth: () => firebaseAuth,
  messages,
  messageListRef,
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
  config: {
    MESSAGE_ID_PREFIXES,
  },
});

// ====================
// Character Unlock Management
// ====================
const {
  activeUnlockEffects,
  activeCharacterUnlock,
  isCharacterUnlocked,
  loadActiveUnlocks,
  handleConfirmUnlockCharacter,
  resetUnlockDataLoadedState,
} = useCharacterUnlock({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getFirebaseAuth: () => firebaseAuth,
  getPartnerDisplayName: () => partnerDisplayName.value,
  closeUnlockConfirm,
  loadTicketsBalance,
  setLoading,
  showError,
  showSuccess: success,
});

// ====================
// Voice Management
// ====================
const {
  handlePlayVoice,
  handleWatchVoiceAd: watchVoiceAd,
  handleUseVoiceUnlockCard,
} = useVoiceManagement({
  getCurrentUserId: () => currentUserId.value,
  playVoice,
  loadVoiceStats,
  checkVoiceLimit,
  unlockVoiceByAd,
  loadTicketsBalance,
  showVoiceLimit,
  closeVoiceLimit,
  getVoiceLimitPendingMessage: () => modals.voiceLimit.pending,
  showError,
  showSuccess: success,
});

// ====================
// Conversation Limit Actions
// ====================
const {
  handleWatchAd,
  handleUseUnlockCard,
} = useConversationLimitActions({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partner.value?.id,
  getPartnerDisplayName: () => partnerDisplayName.value,
  getFirebaseAuth: () => firebaseAuth,
  unlockByAd,
  getLimitState,
  loadTicketsBalance,
  closeConversationLimit,
  updateModal,
  showError,
  showSuccess: success,
});

// ====================
// Gift Management
// ====================
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

// ====================
// Favorite Management
// ====================
const {
  isFavoriteMutating,
  toggleFavorite,
} = useFavoriteManagement({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partnerId.value,
  getUser: () => user.value,
  getFirebaseAuth: () => firebaseAuth,
  setUserProfile,
  requireLogin,
  showError,
  showSuccess: success,
});

// ====================
// Share Functionality
// ====================
const {
  handleShare,
} = useShareFunctionality({
  getChatPageRef: () => chatPageRef.value,
  getPartnerDisplayName: () => partnerDisplayName.value,
  showError,
  showSuccess: success,
});

// ====================
// Conversation Reset
// ====================
const {
  confirmResetConversation,
  cancelResetConversation,
} = useConversationReset({
  getCurrentUserId: () => currentUserId.value,
  getPartnerId: () => partner.value?.id,
  getPartner: () => partner.value,
  getMessages: () => messages.value,
  getDraft: () => draft.value,
  setDraft: (value) => { draft.value = value; },
  resetConversationApi,
  invalidateSuggestions,
  closeResetConfirm,
  setLoading,
  showError,
  showSuccess: success,
  config: { MESSAGE_ID_PREFIXES },
});

// ====================
// Photo Video Handler
// ====================
const {
  handlePhotoSelect,
  handleUseVideoUnlockCard,
  handleUpgradeFromVideoModal,
} = usePhotoVideoHandler({
  getCurrentUserId: () => currentUserId.value,
  getPhotoSelectorModal: () => modals.photoSelector,
  generateVideo,
  loadTicketsBalance,
  closePhotoSelector,
  closeVideoLimit,
  showPhotoSelector,
  navigateToMembership: () => router.push('/membership'),
  showError,
});

// ====================
// Conversation Context
// ====================
const getConversationContext = () => {
  return {
    matchId: partner.value?.id ?? "",
    currentUserId: currentUserId.value ?? "",
  };
};

// ====================
// Helper Functions
// ====================

/**
 * 撤回用戶消息（從後端和前端同時刪除）
 * @param {string} userId - 用戶 ID
 * @param {string} matchId - 角色 ID
 * @param {string} messageId - 消息 ID
 * @returns {Promise<boolean>} - 是否成功撤回
 */
const rollbackUserMessage = async (userId, matchId, messageId) => {
  if (!userId || !matchId || !messageId) {
    return false;
  }

  try {
    const token = await firebaseAuth.getCurrentUserIdToken();

    // ✅ 先從後端 Firestore 刪除
    await apiJson(`/api/conversations/${userId}/${matchId}/messages`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        messageIds: [messageId],
      },
      skipGlobalLoading: true,
    });

    // ✅ 成功後才從前端訊息列表中刪除
    const msgIndex = messages.value.findIndex((m) => m.id === messageId);
    if (msgIndex !== -1) {
      messages.value.splice(msgIndex, 1);
    }

    // ✅ 更新緩存
    writeCachedHistory(userId, matchId, messages.value);

    return true;
  } catch (error) {
    showError("撤回訊息失敗，請重新整理頁面");
    return false;
  }
};

/**
 * 創建限制 Modal 的數據結構
 * @param {Object} limitCheck - 限制檢查結果
 * @param {string} type - 限制類型 ('photo' 或 'video')
 * @returns {Object} Modal 數據對象
 */
const createLimitModalData = (limitCheck, type = "photo") => {
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
  return {
    used: limitCheck.used || 0,
    remaining: limitCheck.remaining || 0,
    total: limitCheck.total || 0,
    standardTotal: limitCheck[`standard${capitalizedType}sLimit`] || null,
    isTestAccount: limitCheck.isTestAccount || false,
    cards: limitCheck[`${type}Cards`] || 0,
    tier: limitCheck.tier || "free",
    resetPeriod: limitCheck.resetPeriod || "lifetime",
  };
};

// ====================
// Send Message Handler
// ====================
const handleSendMessage = async (text) => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId || !text) return;

  // Guest message limit check
  if (isGuest.value && !canGuestSendMessage.value) {
    requireLogin({ feature: "發送訊息" });
    return;
  }

  // Check conversation limit
  const limitCheck = await checkLimit(userId, matchId);
  if (!limitCheck.allowed) {
    showConversationLimit({
      characterName: partnerDisplayName.value,
      remainingMessages: limitCheck.remaining || 0,
      dailyAdLimit: limitCheck.dailyAdLimit || 10,
      adsWatchedToday: limitCheck.adsWatchedToday || 0,
      isUnlocked: limitCheck.isUnlocked || false,
      characterUnlockCards: characterTickets.value || 0,
    });
    return;
  }

  // Clear draft immediately
  draft.value = "";

  try {
    // Send message (sendMessage only takes text parameter)
    await sendMessageToApi(text);

    // Invalidate suggestions
    invalidateSuggestions();

    // Increment guest message count
    if (isGuest.value) {
      incrementGuestMessageCount();
    }

    // Focus input
    await nextTick();
    messageInputRef.value?.focus();
  } catch (error) {
    showError(error instanceof Error ? error.message : "發送消息失敗");
  }
};

// ====================
// Suggestion Handlers
// ====================
const handleSuggestionClick = async (suggestion) => {
  // 直接送出建議訊息
  if (suggestion && suggestion.trim()) {
    await handleSendMessage(suggestion.trim());
  }
};

const handleRequestSuggestions = async () => {
  await loadSuggestions();
};

// ====================
// Menu Action Handler
// ====================
const handleMenuAction = (action) => {
  switch (action) {
    case "reset":
      showResetConfirm();
      break;
    case "info":
      showCharacterInfo();
      break;
    case "unlock-character":
      // 檢查是否有解鎖卡
      if (!hasCharacterTickets.value || characterTickets.value <= 0) {
        // 顯示商城引導彈窗
        showUnlockLimit();
        return;
      }
      // 顯示確認彈窗
      showUnlockConfirm();
      break;
    case "memory":
    case "memory-boost":
      // 檢查是否有藥水
      if (userPotions.value.memoryBoost <= 0) {
        // 顯示商城引導彈窗
        showPotionLimit("memoryBoost");
        return;
      }
      showPotionConfirm("memoryBoost");
      break;
    case "brain":
    case "brain-boost":
      // 檢查是否有藥水
      if (userPotions.value.brainBoost <= 0) {
        // 顯示商城引導彈窗
        showPotionLimit("brainBoost");
        return;
      }
      showPotionConfirm("brainBoost");
      break;
    case "share":
      handleShare();
      break;
  }
};

// ====================
// Share Handler
// ====================
// handleShare 由 useShareFunctionality 提供
// downloadScreenshot 由 useShareFunctionality 內部處理

// ====================
// Favorite Handler
// ====================
// toggleFavorite 由 useFavoriteManagement 提供

// ====================
// Reset Conversation
// ====================
// confirmResetConversation 由 useConversationReset 提供
// cancelResetConversation 由 useConversationReset 提供

// ====================
// Character Info
// ====================
// closeCharacterInfo 由 useModalManager 提供

// ====================
// Potion Usage
// ====================
// handleClosePotionConfirm 由 closePotionConfirm 替代
// handleConfirmUsePotion 由 confirmUsePotion (來自 usePotionManagement) 替代

// ====================
// Buff Details
// ====================
const handleViewBuffDetails = (buffType) => {
  showBuffDetails(buffType);
};

// handleCloseBuffDetails 由 closeBuffDetails 替代

// ====================
// Voice Handler
// ====================
// handlePlayVoice 由 useVoiceManagement 提供

// ====================
// Image Viewer
// ====================
const handleImageClick = ({ url, alt }) => {
  showImageViewer(url, alt);
};

// handleCloseImageViewer 由 closeImageViewer 替代

// ====================
// Selfie Handler
// ====================
// handleRequestSelfie 由 useSelfieGeneration 提供
// handlePhotoSelect 由 usePhotoVideoHandler 提供

// handleClosePhotoSelector 由 closePhotoSelector 替代

// ====================
// Gift Handlers
// ====================
// handleOpenGiftSelector 由 useGiftManagement 提供
// handleSelectGift 由 useGiftManagement 提供

// ====================
// Limit Modal Handlers
// ====================
// handleCloseLimitModal 由 closeConversationLimit 替代
// handleWatchAd 由 useConversationLimitActions 提供
// handleUseUnlockCard 由 useConversationLimitActions 提供

// handleCloseVoiceLimitModal 由 closeVoiceLimit 替代

// 包裝函數：觀看語音廣告（從 template 調用）
const handleWatchVoiceAd = async () => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;
  await watchVoiceAd(userId, matchId);
};

// handleUseVoiceUnlockCard 由 useVoiceManagement 提供（直接使用）

// handleClosePhotoLimitModal 由 closePhotoLimit 替代

// ====================
// Video Limit Modal Handlers
// ====================
// handleCloseVideoLimitModal 由 closeVideoLimit 替代
// handleUseVideoUnlockCard 由 usePhotoVideoHandler 提供
// handleUpgradeFromVideoModal 由 usePhotoVideoHandler 提供

// handleUsePhotoUnlockCard 由 useSelfieGeneration 提供

// ====================
// Navigation
// ====================
const handleBack = () => {
  router.back();
};

// ====================
// Character Unlock Handlers
// ====================
// handleCloseUnlockConfirm 由 closeUnlockConfirm 替代
// handleCloseUnlockLimit 由 closeUnlockLimit 替代
// loadActiveUnlocks 由 useCharacterUnlock 提供
// handleConfirmUnlockCharacter 由 useCharacterUnlock 提供

// Watch partnerId changes
watch(partnerId, (newId) => {
  if (newId) {
    // 立即隱藏解鎖圖標，避免顯示閃爍
    resetUnlockDataLoadedState();

    // 清空舊角色的效果數據
    activePotionEffects.value = [];
    activeUnlockEffects.value = [];

    loadPartner(newId);
  }
}, {
  flush: 'sync', // 同步執行，確保在 computed 重新計算前就清空數據
});

// ====================
// Initialization
// ====================
onMounted(async () => {
  const userId = currentUserId.value;
  const matchId = partnerId.value;

  if (!userId || !matchId) return;

  try {
    // Load partner data first
    await loadPartner(matchId);

    // Load unlock tickets (統一管道獲取所有卡片)
    await loadTicketsBalance(userId, { skipGlobalLoading: true });

    // Load potions
    await loadPotions();

    // Load active potion effects
    await loadActivePotions();

    // Load active unlock effects
    await loadActiveUnlocks();

    // Load conversation history
    await loadHistory(userId, matchId);

    // 記錄對話歷史（靜默失敗，不影響聊天功能）
    try {
      await addConversationHistory(matchId);
    } catch (error) {
      // 靜默失敗，不影響用戶體驗
      if (import.meta.env.DEV) {
        logger.warn("記錄對話歷史失敗:", error);
      }
    }

    // 檢查是否需要添加角色的第一句話
    // 條件：沒有消息，或者第一條消息不是角色的 first_message
    const needsFirstMessage =
      partner.value?.first_message &&
      (messages.value.length === 0 ||
        messages.value[0]?.text !== partner.value.first_message.trim());

    if (needsFirstMessage) {
      const firstMessage = {
        id: `${MESSAGE_ID_PREFIXES.FIRST}${Date.now()}`,
        role: "partner",
        text: partner.value.first_message.trim(),
        createdAt: new Date().toISOString(),
      };

      // 添加到消息列表開頭
      messages.value.unshift(firstMessage);

      // 保存到緩存（完整歷史）
      writeCachedHistory(userId, matchId, messages.value);
    }

    // Load voice stats
    if (!isGuestUser(userId)) {
      await loadVoiceStats(userId, { skipGlobalLoading: true });
    }

    // Load photo stats
    await fetchPhotoStats();

    // Load balance
    await loadBalance(userId, { skipGlobalLoading: true });

    // Scroll to bottom
    await nextTick();
    messageListRef.value?.scrollToBottom(false);
  } catch (error) {
    // Silent fail
  }
});

// ====================
// Cleanup
// ====================
onBeforeUnmount(() => {
  cleanupMessages();
});

// ====================
// Watch message changes to invalidate suggestions
// ====================
watch(
  () => messages.value.length,
  () => {
    invalidateSuggestions();
  }
);
</script>

<template>
  <div ref="chatPageRef" class="chat-page" :style="backgroundStyle">
    <!-- Chat Header -->
    <ChatHeader
      :partner-name="partnerDisplayName"
      :is-resetting-conversation="modals.resetConfirm.loading"
      :is-favorited="isFavorited"
      :is-favorite-mutating="isFavoriteMutating"
      :memory-boost-count="userPotions.memoryBoost"
      :brain-boost-count="userPotions.brainBoost"
      :active-memory-boost="activeMemoryBoost"
      :active-brain-boost="activeBrainBoost"
      :active-character-unlock="activeCharacterUnlock"
      :character-unlock-cards="characterTickets"
      :is-character-unlocked="isCharacterUnlocked"
      @back="handleBack"
      @menu-action="handleMenuAction"
      @toggle-favorite="toggleFavorite"
      @view-buff-details="handleViewBuffDetails"
    />

    <!-- Message List -->
    <MessageList
      ref="messageListRef"
      :messages="messages"
      :partner-name="partnerDisplayName"
      :partner-background="partnerBackground"
      :is-replying="isReplying"
      :playing-voice-message-id="playingVoiceMessageId"
      @play-voice="handlePlayVoice"
      @image-click="handleImageClick"
    />

    <!-- Message Input -->
    <MessageInput
      ref="messageInputRef"
      v-model="draft"
      :disabled="isLoadingHistory || isReplying"
      :suggestions="suggestionOptions"
      :is-loading-suggestions="isLoadingSuggestions"
      :suggestion-error="suggestionError"
      :is-sending-gift="isSendingGift"
      :is-requesting-selfie="isRequestingSelfie"
      :is-requesting-video="isRequestingVideo"
      :photo-remaining="photoRemaining"
      @send="handleSendMessage"
      @suggestion-click="handleSuggestionClick"
      @request-suggestions="handleRequestSuggestions"
      @gift-click="handleOpenGiftSelector"
      @selfie-click="handleRequestSelfie"
      @video-click="handleRequestVideo"
    />

    <!-- 快速解鎖角色懸浮按鈕 -->
    <button
      v-if="!isCharacterUnlocked"
      type="button"
      class="unlock-fab"
      :class="{ 'has-cards': hasCharacterTickets }"
      :title="
        hasCharacterTickets
          ? `使用解鎖卡（擁有 ${characterTickets} 張）`
          : '購買解鎖卡'
      "
      @click="handleMenuAction('unlock-character')"
    >
      <span class="unlock-fab__icon">🎫</span>
      <span v-if="hasCharacterTickets" class="unlock-fab__count">{{
        characterTickets
      }}</span>
    </button>

    <!-- All Modals -->
    <ChatModals
      :modals="modals"
      :partner-display-name="partnerDisplayName"
      :partner-background="partnerBackground"
      :partner-id="partnerId"
      :partner="partner"
      :user-potions="userPotions"
      :active-memory-boost="activeMemoryBoost"
      :active-brain-boost="activeBrainBoost"
      :active-character-unlock="activeCharacterUnlock"
      :character-tickets="characterTickets"
      :voice-cards="voiceCards"
      :photo-cards="photoCards"
      :video-cards="videoCards"
      :show-gift-selector="showGiftSelector"
      :balance="balance"
      :membership-tier="user?.membershipTier || 'free'"
      @cancel-reset="cancelResetConversation"
      @confirm-reset="confirmResetConversation"
      @close-character-info="closeCharacterInfo"
      @close-potion-confirm="closePotionConfirm"
      @confirm-use-potion="handleConfirmUsePotion"
      @close-potion-limit="closePotionLimit"
      @close-unlock-confirm="closeUnlockConfirm"
      @confirm-unlock-character="handleConfirmUnlockCharacter"
      @close-unlock-limit="closeUnlockLimit"
      @close-buff-details="closeBuffDetails"
      @close-conversation-limit="closeConversationLimit"
      @watch-ad="handleWatchAd"
      @use-unlock-card="handleUseUnlockCard"
      @close-voice-limit="closeVoiceLimit"
      @watch-voice-ad="handleWatchVoiceAd"
      @use-voice-unlock-card="handleUseVoiceUnlockCard"
      @close-photo-limit="closePhotoLimit"
      @use-photo-unlock-card="handleUsePhotoUnlockCard"
      @close-video-limit="closeVideoLimit"
      @use-video-unlock-card="handleUseVideoUnlockCard"
      @upgrade-membership="handleUpgradeFromVideoModal"
      @close-photo-selector="closePhotoSelector"
      @photo-select="handlePhotoSelect"
      @close-image-viewer="closeImageViewer"
      @close-gift-selector="closeGiftSelector"
      @select-gift="handleSelectGift"
    />
  </div>
</template>

<style scoped lang="scss">
/* ===================
   Main Container
   =================== */
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  position: relative;
}

/* ===================
   快速解鎖角色懸浮按鈕
   =================== */
.unlock-fab {
  position: fixed;
  top: 140px;
  right: 1.5rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 1000;
  overflow: visible;

  // 旋轉光環（外圈）- 預設就顯示
  &::before {
    content: "";
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      rgba(34, 197, 94, 0.6) 90deg,
      transparent 180deg,
      rgba(34, 197, 94, 0.6) 270deg,
      transparent 360deg
    );
    animation: rotate 3s linear infinite;
    opacity: 0.7;
    transition: opacity 0.3s ease;
  }

  // 發光光暈（中圈）- 預設就顯示
  &::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(34, 197, 94, 0.4) 0%,
      transparent 70%
    );
    animation: pulse-glow 2s ease-in-out infinite;
    opacity: 0.5;
    transition: opacity 0.3s ease;
  }

  // 按鈕本身也有脈動動畫
  animation: pulse-shadow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  // icon 預設就閃爍
  &__icon {
    font-size: 1.75rem;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    position: relative;
    z-index: 1;
    animation: sparkle 3s ease-in-out infinite;
  }

  &:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 12px 32px rgba(34, 197, 94, 0.5);

    &::before,
    &::after {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(-2px) scale(1.02);
  }

  &__count {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 11px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #0f1016;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 2;
    animation: bounce-subtle 2s ease-in-out infinite;
  }

  // 有卡時增強效果
  &.has-cards {
    &::before,
    &::after {
      opacity: 1;
    }
  }
}

// 旋轉動畫
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// 脈動陰影
@keyframes pulse-shadow {
  0%,
  100% {
    box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
  }
  50% {
    box-shadow: 0 12px 40px rgba(34, 197, 94, 0.8),
      0 0 30px rgba(34, 197, 94, 0.5);
  }
}

// 光暈脈動
@keyframes pulse-glow {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.6;
  }
}

// 閃爍效果
@keyframes sparkle {
  0%,
  100% {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) brightness(1);
  }
  50% {
    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))
      drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) brightness(1.3);
  }
}

// 徽章彈跳
@keyframes bounce-subtle {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.05);
  }
}
</style>
