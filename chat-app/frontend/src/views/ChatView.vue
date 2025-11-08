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
import { XMarkIcon } from "@heroicons/vue/24/outline";
import html2canvas from "html2canvas";

// 新的組件
import ChatHeader from "../components/chat/ChatHeader.vue";
import MessageList from "../components/chat/MessageList.vue";
import MessageInput from "../components/chat/MessageInput.vue";

// 原有的模態框組件
import ConversationLimitModal from "../components/ConversationLimitModal.vue";
import VoiceLimitModal from "../components/VoiceLimitModal.vue";
import PhotoLimitModal from "../components/PhotoLimitModal.vue";
import VideoLimitModal from "../components/VideoLimitModal.vue";
import ImageViewerModal from "../components/ImageViewerModal.vue";
import GiftSelectorModal from "../components/GiftSelectorModal.vue";
import GiftAnimation from "../components/GiftAnimation.vue";
import PotionConfirmModal from "../components/PotionConfirmModal.vue";

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

// Utils
import { fallbackMatches } from "../utils/matchFallback";
import { isGuestUser } from "../../../../shared/config/testAccounts";
import { apiJson } from "../utils/api";
import { getRandomSelfieMessage } from "../config/selfieMessages";
import {
  appendCachedHistory,
  writeCachedHistory,
  clearPendingMessages,
} from "../utils/conversationCache";
import { getGiftById } from "../config/gifts";

const router = useRouter();
const route = useRoute();

// User & Auth
const { user, setUserProfile } = useUserProfile();
const firebaseAuth = useFirebaseAuth();
const { success, error: showError } = useToast();

// Favorite State
const isFavorited = computed(() => {
  const favoritesList = Array.isArray(user.value?.favorites)
    ? user.value.favorites
    : [];
  return favoritesList.includes(partnerId.value);
});
const isFavoriteMutating = ref(false);

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
const { loadBalance: loadTicketsBalance } = useUnlockTickets();

// Partner Data
const partnerId = computed(() => route.params.id);
const partner = ref(null);
const isLoadingPartner = ref(false);
const partnerLoadError = ref(null);

// Chat Page Ref (用於截圖)
const chatPageRef = ref(null);

// 从 API 加载角色数据
const loadPartner = async (characterId) => {
  if (!characterId) {
    partner.value = null;
    return;
  }

  isLoadingPartner.value = true;
  partnerLoadError.value = null;

  try {
    const response = await apiJson(
      `/match/${encodeURIComponent(characterId)}`,
      {
        skipGlobalLoading: true,
      }
    );
    partner.value = response?.character || null;
  } catch (error) {
    partnerLoadError.value = error;
    // Fallback 到内存数组
    partner.value = fallbackMatches.find((m) => m.id === characterId) || null;
  } finally {
    isLoadingPartner.value = false;
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
  loadHistoryError,
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
// Local State
// ====================
const draft = ref("");
const messageListRef = ref(null);
const messageInputRef = ref(null);

// Modal States
const showLimitModal = ref(false);
const limitModalData = ref({
  characterName: "",
  remainingMessages: 0,
  dailyAdLimit: 10,
  adsWatchedToday: 0,
  isUnlocked: false,
  characterUnlockCards: 0,
});

const showVoiceLimitModal = ref(false);
const voiceLimitModalData = ref({
  characterName: "",
  usedVoices: 0,
  totalVoices: 10,
  dailyAdLimit: 10,
  adsWatchedToday: 0,
  voiceUnlockCards: 0,
});
const pendingVoiceMessage = ref(null); // ✅ 保存待播放的消息

const showPhotoLimitModal = ref(false);
const photoLimitModalData = ref({
  used: 0,
  remaining: 0,
  total: 0,
  standardTotal: null,
  isTestAccount: false,
  cards: 0,
  tier: "free",
  resetPeriod: "lifetime",
});

const showVideoLimitModal = ref(false);
const videoLimitModalData = ref({
  used: 0,
  remaining: 0,
  total: 0,
  standardTotal: null,
  isTestAccount: false,
  cards: 0,
  tier: "free",
  resetPeriod: "lifetime",
});

const showImageViewer = ref(false);
const viewerImageUrl = ref("");
const viewerImageAlt = ref("");

const showResetConfirm = ref(false);
const isResettingConversation = ref(false);

const showCharacterInfo = ref(false);

// 禮物動畫狀態
const showGiftAnimation = ref(false);
const giftAnimationData = ref({
  emoji: "🎁",
  name: "禮物",
});

// Potion confirmation
const showPotionConfirm = ref(false);
const potionTypeToUse = ref(""); // 'memoryBoost' or 'brainBoost'
const isUsingPotion = ref(false);

// Buff details modal
const showBuffDetails = ref(false);
const buffTypeToView = ref("");

// Active potion effects
const activePotionEffects = ref([]);

// Computed: Active potion effects for current character
const activeMemoryBoost = computed(() => {
  return activePotionEffects.value.find(
    (effect) =>
      effect.potionType === "memory_boost" &&
      effect.characterId === partnerId.value
  );
});

const activeBrainBoost = computed(() => {
  return activePotionEffects.value.find(
    (effect) =>
      effect.potionType === "brain_boost" &&
      effect.characterId === partnerId.value
  );
});

// Computed: Current buff details
const currentBuffDetails = computed(() => {
  if (!buffTypeToView.value) return null;

  const effect = buffTypeToView.value === "memory"
    ? activeMemoryBoost.value
    : buffTypeToView.value === "brain"
    ? activeBrainBoost.value
    : null;

  if (!effect) return null;

  // Calculate remaining time
  const now = new Date();
  const expiresAt = new Date(effect.expiresAt);
  const remainingMs = expiresAt - now;
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  return {
    name: buffTypeToView.value === "memory" ? "記憶增強藥水" : "腦力激盪藥水",
    icon: buffTypeToView.value === "memory" ? "🧠" : "⚡",
    description: buffTypeToView.value === "memory"
      ? `${partnerDisplayName.value}的對話記憶上限增加 10,000 tokens`
      : "AI 模型升級為最高階模型，提供更聰明的對話體驗",
    activatedAt: new Date(effect.activatedAt).toLocaleString("zh-TW"),
    expiresAt: new Date(effect.expiresAt).toLocaleString("zh-TW"),
    remainingDays,
  };
});

// User Assets
const userAssets = ref({
  characterUnlockCards: 0,
  potions: {
    memoryBoost: 0,
    brainBoost: 0,
  },
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
    limitModalData.value = {
      characterName: partnerDisplayName.value,
      remainingMessages: limitCheck.remaining || 0,
      dailyAdLimit: limitCheck.dailyAdLimit || 10,
      adsWatchedToday: limitCheck.adsWatchedToday || 0,
      isUnlocked: limitCheck.isUnlocked || false,
      characterUnlockCards: userAssets.value.characterUnlockCards || 0,
    };
    showLimitModal.value = true;
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
      showResetConfirm.value = true;
      break;
    case "info":
      showCharacterInfo.value = true;
      break;
    case "memory":
    case "memory-boost":
      // 檢查是否有藥水
      if (userAssets.value.potions.memoryBoost <= 0) {
        showError("您沒有記憶增強藥水");
        return;
      }
      potionTypeToUse.value = "memoryBoost";
      showPotionConfirm.value = true;
      break;
    case "brain":
    case "brain-boost":
      // 檢查是否有藥水
      if (userAssets.value.potions.brainBoost <= 0) {
        showError("您沒有腦力激盪藥水");
        return;
      }
      potionTypeToUse.value = "brainBoost";
      showPotionConfirm.value = true;
      break;
    case "share":
      handleShare();
      break;
  }
};

// ====================
// Share Handler
// ====================
const isCapturingScreenshot = ref(false);

const handleShare = async () => {
  if (!chatPageRef.value) {
    showError("無法截圖，請稍後再試。");
    return;
  }

  const characterName = partnerDisplayName.value || "角色";
  const shareText = `我正在與 ${characterName} 聊天！`;
  const shareUrl = window.location.href;

  try {
    isCapturingScreenshot.value = true;

    // 截取聊天畫面
    const canvas = await html2canvas(chatPageRef.value, {
      backgroundColor: "#0f1016",
      scale: 2, // 提高截圖品質
      logging: false,
      useCORS: true, // 允許跨域圖片
      allowTaint: true,
    });

    // 轉換為 Blob
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png", 0.95);
    });

    if (!blob) {
      throw new Error("截圖失敗");
    }

    // 創建 File 物件
    const file = new File([blob], `chat-${characterName}-${Date.now()}.png`, {
      type: "image/png",
    });

    // 檢查是否支援分享檔案
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: "分享聊天",
          text: shareText,
          files: [file],
        });
        success("分享成功！");
      } catch (err) {
        if (err.name !== "AbortError") {
          // 降級為下載圖片
          downloadScreenshot(file);
        }
      }
    } else {
      // 不支援分享檔案，提供下載選項
      downloadScreenshot(file);
    }
  } catch (err) {
    showError("截圖失敗，請稍後再試。");
  } finally {
    isCapturingScreenshot.value = false;
  }
};

// 下載截圖
const downloadScreenshot = (file) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  success("截圖已保存，您可以手動分享！");
};

// ====================
// Favorite Handler
// ====================
const toggleFavorite = async () => {
  const userId = currentUserId.value;
  const matchId = partnerId.value;

  if (!userId || !matchId) return;

  // Check if guest
  if (requireLogin({ feature: "收藏角色" })) {
    return;
  }

  if (isFavoriteMutating.value) return;

  const currentProfile = user.value;
  if (!currentProfile?.id) {
    showError("請登入後才能收藏角色。");
    return;
  }

  isFavoriteMutating.value = true;

  const previousFavorites = Array.isArray(currentProfile.favorites)
    ? [...currentProfile.favorites]
    : [];

  const wasFavorited = previousFavorites.includes(matchId);
  const optimisticSet = new Set(previousFavorites);

  if (wasFavorited) {
    optimisticSet.delete(matchId);
  } else {
    optimisticSet.add(matchId);
  }

  // Optimistic update
  setUserProfile({
    ...currentProfile,
    favorites: Array.from(optimisticSet),
  });

  try {
    const token = await firebaseAuth.getCurrentUserIdToken();
    const endpoint = wasFavorited
      ? `/api/users/${encodeURIComponent(
          userId
        )}/favorites/${encodeURIComponent(matchId)}`
      : `/api/users/${encodeURIComponent(userId)}/favorites`;

    const response = await apiJson(endpoint, {
      method: wasFavorited ? "DELETE" : "POST",
      body: wasFavorited ? undefined : { matchId },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      skipGlobalLoading: true,
    });

    const favoritesList = Array.isArray(response?.favorites)
      ? response.favorites
      : Array.from(optimisticSet);

    setUserProfile({
      ...currentProfile,
      favorites: favoritesList,
    });

    success(wasFavorited ? "已取消收藏" : "已加入收藏");
  } catch (error) {
    // Revert on error
    setUserProfile({
      ...currentProfile,
      favorites: previousFavorites,
    });
    showError(
      error instanceof Error
        ? error.message
        : "更新收藏時發生錯誤，請稍後再試。"
    );
  } finally {
    isFavoriteMutating.value = false;
  }
};

// ====================
// Reset Conversation
// ====================
const confirmResetConversation = async () => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  try {
    isResettingConversation.value = true;
    await resetConversationApi(userId, matchId);

    // Clear pending messages
    clearPendingMessages(userId, matchId);

    // Clear draft
    draft.value = "";

    // Invalidate suggestions
    invalidateSuggestions();

    // 檢查是否需要添加角色的第一句話
    // 條件：沒有消息，或者第一條消息不是角色的 first_message
    const needsFirstMessage =
      partner.value?.first_message &&
      (messages.value.length === 0 ||
        messages.value[0]?.text !== partner.value.first_message.trim());

    if (needsFirstMessage) {
      const firstMessage = {
        id: `msg-first-${Date.now()}`,
        role: "partner",
        text: partner.value.first_message.trim(),
        createdAt: new Date().toISOString(),
      };

      // 添加到消息列表開頭
      messages.value.unshift(firstMessage);

      // 保存到緩存（完整歷史）
      writeCachedHistory(userId, matchId, messages.value);
    }

    showResetConfirm.value = false;
    success("對話已重置");
  } catch (error) {
    showError(error instanceof Error ? error.message : "重置對話失敗");
  } finally {
    isResettingConversation.value = false;
  }
};

const cancelResetConversation = () => {
  showResetConfirm.value = false;
};

// ====================
// Character Info
// ====================
const closeCharacterInfo = () => {
  showCharacterInfo.value = false;
};

// ====================
// Potion Usage
// ====================
const handleClosePotionConfirm = () => {
  showPotionConfirm.value = false;
  potionTypeToUse.value = "";
};

const handleConfirmUsePotion = async () => {
  const userId = currentUserId.value;
  if (!userId) {
    showError("請先登入");
    return;
  }

  isUsingPotion.value = true;

  try {
    if (potionTypeToUse.value === "memoryBoost") {
      // 使用記憶增強藥水
      const result = await apiJson(`/api/potions/use/memory-boost`, {
        method: "POST",
        body: {
          characterId: partnerId.value,
        },
      });

      if (result.success) {
        success(`記憶增強藥水使用成功！效果將持續 ${result.duration} 天`);
        // 重新載入用戶資產和活躍藥水效果
        await loadUserAssets();
        await loadActivePotions();
      }
    } else if (potionTypeToUse.value === "brainBoost") {
      // 使用腦力激盪藥水
      const result = await apiJson(`/api/potions/use/brain-boost`, {
        method: "POST",
        body: {
          characterId: partnerId.value,
        },
      });

      if (result.success) {
        success(`腦力激盪藥水使用成功！效果將持續 ${result.duration} 天`);
        // 重新載入用戶資產和活躍藥水效果
        await loadUserAssets();
        await loadActivePotions();
      }
    }

    handleClosePotionConfirm();
  } catch (error) {
    showError(error.message || "使用藥水失敗");
  } finally {
    isUsingPotion.value = false;
  }
};

// ====================
// Buff Details
// ====================
const handleViewBuffDetails = (buffType) => {
  buffTypeToView.value = buffType;
  showBuffDetails.value = true;
};

const handleCloseBuffDetails = () => {
  showBuffDetails.value = false;
  buffTypeToView.value = "";
};

// ====================
// Voice Handler
// ====================
const handlePlayVoice = async (message) => {
  if (!message) return;

  await playVoice(message, { loadVoiceStats, checkVoiceLimit }, (limitInfo) => {
    // On limit exceeded
    pendingVoiceMessage.value = message; // ✅ 保存待播放的消息
    voiceLimitModalData.value = limitInfo;
    showVoiceLimitModal.value = true;
  });
};

// ====================
// Image Viewer
// ====================
const handleImageClick = ({ url, alt }) => {
  viewerImageUrl.value = url;
  viewerImageAlt.value = alt;
  showImageViewer.value = true;
};

const handleCloseImageViewer = () => {
  showImageViewer.value = false;
  viewerImageUrl.value = "";
  viewerImageAlt.value = "";
};

// ====================
// Selfie Handler
// ====================
const handleRequestSelfie = async () => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  // 檢查遊客權限
  if (requireLogin({ feature: "請求自拍照片" })) {
    return;
  }

  // 先檢查拍照限制，避免發送訊息後才發現限制不足
  const limitCheck = await canGeneratePhoto();

  // ✅ 修復：當免費額度用完時，顯示彈窗讓用戶決定是否使用解鎖卡
  // 彈窗會根據 cards 數量顯示不同按鈕：
  // - cards > 0: 顯示「使用解鎖卡」按鈕
  // - cards = 0: 顯示「次數已達上限」及升級選項
  if (!limitCheck.allowed) {
    photoLimitModalData.value = {
      used: limitCheck.used || 0,
      remaining: limitCheck.remaining || 0,
      total: limitCheck.total || 0,
      standardTotal: limitCheck.standardPhotosLimit || null,
      isTestAccount: limitCheck.isTestAccount || false,
      cards: limitCheck.photoCards || 0,
      tier: limitCheck.tier || "free",
      resetPeriod: limitCheck.resetPeriod || "lifetime",
    };
    showPhotoLimitModal.value = true;
    return;
  }

  // 用於追蹤用戶消息 ID，以便失敗時撤回
  let userMessageId = null;

  try {
    // 1. 先發送一條隨機的拍照請求訊息
    const randomMessage = getRandomSelfieMessage();

    // 創建用戶消息
    const userMessage = {
      id: `msg-selfie-request-${Date.now()}`,
      role: "user",
      text: randomMessage,
      createdAt: new Date().toISOString(),
    };

    // 保存消息 ID 以便失敗時撤回
    userMessageId = userMessage.id;

    // 添加到消息列表
    messages.value.push(userMessage);

    // 滾動到底部
    await nextTick();
    messageListRef.value?.scrollToBottom();

    // 獲取認證權杖
    const token = await firebaseAuth.getCurrentUserIdToken();

    // 發送到後端（只保存訊息，不請求 AI 回覆）
    await apiJson(`/api/conversations/${userId}/${matchId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        id: userMessage.id, // ✅ 傳遞消息 ID，確保前後端一致
        text: randomMessage,
        role: "user",
      },
      skipGlobalLoading: true,
    });

    // 更新緩存
    writeCachedHistory(userId, matchId, messages.value);

    // 2. 然後調用拍照功能
    const photoResult = await requestSelfie(
      { canGeneratePhoto, fetchPhotoStats },
      (limitInfo) => {
        // On limit exceeded
        photoLimitModalData.value = limitInfo;
        showPhotoLimitModal.value = true;
      },
      { usePhotoCard: false } // ✅ 此處僅在有免費額度時才被調用
    );

    // 如果拍照失敗（返回 null），撤回用戶訊息
    if (!photoResult && userMessageId) {
      try {
        // ✅ 先從後端 Firestore 刪除
        await apiJson(`/api/conversations/${userId}/${matchId}/messages`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: {
            messageIds: [userMessageId],
          },
          skipGlobalLoading: true,
        });

        // ✅ 成功後才從前端訊息列表中刪除
        const userMsgIndex = messages.value.findIndex(
          (m) => m.id === userMessageId
        );
        if (userMsgIndex !== -1) {
          messages.value.splice(userMsgIndex, 1);
        }

        // ✅ 更新緩存
        writeCachedHistory(userId, matchId, messages.value);
      } catch (deleteError) {
        showError("撤回訊息失敗，請重新整理頁面");
      }
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "請求自拍失敗");

    // 撤回用戶剛發送的訊息
    if (userMessageId) {
      try {
        const token = await firebaseAuth.getCurrentUserIdToken();

        // ✅ 先從後端 Firestore 刪除
        await apiJson(`/api/conversations/${userId}/${matchId}/messages`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: {
            messageIds: [userMessageId],
          },
          skipGlobalLoading: true,
        });

        // ✅ 成功後才從前端訊息列表中刪除
        const userMsgIndex = messages.value.findIndex(
          (m) => m.id === userMessageId
        );
        if (userMsgIndex !== -1) {
          messages.value.splice(userMsgIndex, 1);
        }

        // ✅ 更新緩存
        writeCachedHistory(userId, matchId, messages.value);
      } catch (deleteError) {
        showError("撤回訊息失敗，請重新整理頁面");
      }
    }
  }
};

// ====================
// Video Handler
// ====================
const isRequestingVideo = ref(false);

// 生成影片的核心邏輯（可重用）
const generateVideo = async (options = {}) => {
  const { useVideoCard = false } = options;
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  isRequestingVideo.value = true;

  // 用於追蹤用戶消息 ID，以便失敗時撤回
  let userMessageId = null;

  try {
    const token = await firebaseAuth.getCurrentUserIdToken();

    // 1. 先發送一條隨機的影片請求訊息
    const videoRequestMessages = [
      "能給我看一段你的影片嗎？",
      "想看看你的影片！",
      "可以拍一段影片給我看嗎？",
      "期待看到你的影片！",
    ];
    const randomMessage =
      videoRequestMessages[
        Math.floor(Math.random() * videoRequestMessages.length)
      ];

    // 創建用戶消息
    const userMessage = {
      id: `msg-video-request-${Date.now()}`,
      role: "user",
      text: randomMessage,
      createdAt: new Date().toISOString(),
    };

    // 保存消息 ID 以便失敗時撤回
    userMessageId = userMessage.id;

    // 添加到消息列表
    messages.value.push(userMessage);

    // 滾動到底部
    await nextTick();
    messageListRef.value?.scrollToBottom();

    // 發送到後端（只保存訊息）
    await apiJson(`/api/conversations/${userId}/${matchId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        id: userMessage.id, // ✅ 傳遞消息 ID，確保前後端一致
        text: randomMessage,
        role: "user",
      },
      skipGlobalLoading: true,
    });

    // 更新緩存
    writeCachedHistory(userId, matchId, messages.value);

    // 2. 生成影片
    success("正在生成影片，請稍候（約需 30-60 秒）...");

    const videoResult = await apiJson(`/api/ai/generate-video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        // userId 從後端認證 token 自動獲取，無需傳遞
        characterId: matchId,
        requestId: `video-${userId}-${matchId}-${Date.now()}`, // 冪等性 ID
        duration: "4s",
        resolution: "720p",
        aspectRatio: "9:16",
        useVideoCard, // 告訴後端是否使用影片卡
      },
    });

    // ✅ 驗證影片生成結果
    if (!videoResult || !videoResult.videoUrl) {
      throw new Error("影片生成失敗：未返回有效的影片 URL");
    }

    // 3. 創建包含影片的 AI 消息
    const aiVideoMessage = {
      id: `msg-video-ai-${Date.now()}`,
      role: "ai",
      text: "這是我為你準備的影片！",
      createdAt: new Date().toISOString(),
      video: {
        url: videoResult.videoUrl,
        duration: videoResult.duration,
        resolution: videoResult.resolution,
      },
    };

    // 用於追蹤 AI 消息 ID，以便失敗時撤回
    let aiMessageId = aiVideoMessage.id;

    try {
      // 添加到消息列表
      messages.value.push(aiVideoMessage);

      // 保存影片消息到後端
      await apiJson(`/api/conversations/${userId}/${matchId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          id: aiVideoMessage.id, // ✅ 傳遞消息 ID
          text: aiVideoMessage.text,
          role: "ai",
          video: aiVideoMessage.video,
        },
        skipGlobalLoading: true,
      });

      // 更新緩存
      writeCachedHistory(userId, matchId, messages.value);

      // 滾動到底部
      await nextTick();
      messageListRef.value?.scrollToBottom();

      success("影片生成成功！");
    } catch (saveError) {
      // ✅ 保存 AI 訊息失敗，撤回前端的 AI 訊息
      const aiMsgIndex = messages.value.findIndex((m) => m.id === aiMessageId);
      if (aiMsgIndex !== -1) {
        messages.value.splice(aiMsgIndex, 1);
      }

      // 重新拋出錯誤，進入外層 catch 處理
      throw new Error("保存影片訊息失敗");
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "生成影片失敗");

    // 撤回用戶剛發送的訊息
    if (userMessageId) {
      try {
        const token = await firebaseAuth.getCurrentUserIdToken();

        // ✅ 先從後端 Firestore 刪除
        await apiJson(`/api/conversations/${userId}/${matchId}/messages`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: {
            messageIds: [userMessageId],
          },
          skipGlobalLoading: true,
        });

        // ✅ 成功後才從前端訊息列表中刪除
        const userMsgIndex = messages.value.findIndex(
          (m) => m.id === userMessageId
        );
        if (userMsgIndex !== -1) {
          messages.value.splice(userMsgIndex, 1);
        }

        // ✅ 更新緩存
        writeCachedHistory(userId, matchId, messages.value);
      } catch (deleteError) {
        showError("撤回訊息失敗，請重新整理頁面");
      }
    }
  } finally {
    isRequestingVideo.value = false;
  }
};

const handleRequestVideo = async () => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  // 檢查遊客權限
  if (requireLogin({ feature: "生成影片" })) {
    return;
  }

  // 防止重複請求
  if (isRequestingVideo.value) {
    showError("影片生成中，請稍候...");
    return;
  }

  try {
    // 獲取認證權杖
    const token = await firebaseAuth.getCurrentUserIdToken();

    // 檢查影片生成權限
    const limitCheck = await apiJson(`/api/ai/video/check/${userId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      skipGlobalLoading: true,
    });

    // ✅ 修復：當免費額度用完時，顯示彈窗讓用戶決定是否使用解鎖卡
    // 彈窗會根據 cards 數量顯示不同按鈕：
    // - cards > 0: 顯示「使用解鎖卡」按鈕
    // - cards = 0: 顯示「次數已達上限」及升級選項
    if (!limitCheck.allowed) {
      videoLimitModalData.value = {
        used: limitCheck.used || 0,
        remaining: limitCheck.remaining || 0,
        total: limitCheck.total || 0,
        standardTotal: limitCheck.standardVideosLimit || null,
        isTestAccount: limitCheck.isTestAccount || false,
        cards: limitCheck.videoCards || 0,
        tier: limitCheck.tier || "free",
        resetPeriod: limitCheck.resetPeriod || "lifetime",
      };
      showVideoLimitModal.value = true;
      return;
    }

    // 生成影片
    await generateVideo({ useVideoCard: false });
  } catch (error) {
    showError(error instanceof Error ? error.message : "檢查影片權限失敗");
  }
};

// ====================
// Gift Handlers
// ====================
const handleOpenGiftSelector = async () => {
  const userId = currentUserId.value;
  if (!userId) return;

  await openGiftSelector(async () => {
    // Load user assets
    await loadBalance(userId);
  });
};

const handleSelectGift = async (giftData) => {
  const userId = currentUserId.value;
  if (!userId) return;

  // 獲取禮物資訊用於動畫
  const gift = getGiftById(giftData.giftId);
  if (gift) {
    giftAnimationData.value = {
      emoji: gift.emoji,
      name: gift.name,
    };

    // 立即顯示禮物動畫
    showGiftAnimation.value = true;

    // 2秒後自動隱藏動畫
    setTimeout(() => {
      showGiftAnimation.value = false;
    }, 2000);
  }

  // 發送禮物（動畫已經在播放）
  await sendGift(giftData, (giftMessage, replyMessage) => {
    // On success - 動畫已經在顯示，不需要再做處理
  });

  // Reload balance
  await loadBalance(userId);
};

// ====================
// Limit Modal Handlers
// ====================
const handleCloseLimitModal = () => {
  showLimitModal.value = false;
};

const handleWatchAd = async (adType) => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  try {
    if (adType === "conversation") {
      await unlockByAd(userId, matchId);
      const state = await getLimitState(userId, matchId);
      limitModalData.value.remainingMessages = state.remaining || 0;
      limitModalData.value.adsWatchedToday = state.adsWatchedToday || 0;
      showLimitModal.value = false;
      success("已解鎖 5 則訊息！");
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "觀看廣告失敗");
  }
};

const handleCloseVoiceLimitModal = () => {
  showVoiceLimitModal.value = false;
};

const handleWatchVoiceAd = async () => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  try {
    await unlockVoiceByAd(userId, matchId);
    await loadVoiceStats(userId);
    showVoiceLimitModal.value = false;
    success("已解鎖 5 次語音！");
  } catch (error) {
    showError(error instanceof Error ? error.message : "觀看廣告失敗");
  }
};

const handleUseVoiceUnlockCard = async () => {
  const message = pendingVoiceMessage.value;

  if (!message) {
    showError("無法使用語音解鎖卡");
    return;
  }

  try {
    // 1. 關閉模態框
    showVoiceLimitModal.value = false;

    // 2. 使用解鎖卡選項播放語音
    // ✅ 正確做法：傳遞 useVoiceUnlockCard 選項給 TTS API
    // API 會先生成音頻，只在成功後才扣除解鎖卡
    const playSuccess = await playVoice(
      message,
      { loadVoiceStats, checkVoiceLimit },
      () => {
        // 如果仍然失敗（例如沒有解鎖卡），顯示錯誤
        showError("使用解鎖卡失敗，請重試");
      },
      undefined, // getVoiceRemaining
      { useVoiceUnlockCard: true } // ✅ 使用解鎖卡選項
    );

    // 3. 清空待播放消息
    pendingVoiceMessage.value = null;

    if (playSuccess) {
      // 4. 重新加載語音統計和解鎖卡數據
      await Promise.all([
        loadVoiceStats(),
        loadTicketsBalance(),
      ]);

      success("語音解鎖卡使用成功！");
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "使用語音解鎖卡失敗");
  }
};

const handleClosePhotoLimitModal = () => {
  showPhotoLimitModal.value = false;
};

// ====================
// Video Limit Modal Handlers
// ====================
const handleCloseVideoLimitModal = () => {
  showVideoLimitModal.value = false;
};

const handleUseVideoUnlockCard = async () => {
  try {
    // 關閉模態框
    showVideoLimitModal.value = false;

    // 使用影片卡生成影片（後端會自動扣除影片卡）
    await generateVideo({ useVideoCard: true });

    // ✅ 重新加載解鎖卡餘額，確保前端顯示最新數據
    const userId = currentUserId.value;
    if (userId) {
      await loadTicketsBalance(userId);
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "使用影片卡失敗");
  }
};

const handleUpgradeFromVideoModal = () => {
  showVideoLimitModal.value = false;
  router.push("/membership");
};

const handleUsePhotoUnlockCard = async () => {
  try {
    // 關閉模態框
    showPhotoLimitModal.value = false;

    // 使用照片卡生成照片
    const result = await requestSelfie(
      { canGeneratePhoto, fetchPhotoStats },
      (limitInfo) => {
        // 如果仍然失敗（例如沒有解鎖卡），顯示錯誤
        showError("使用拍照解鎖卡失敗，請重試");
      },
      { usePhotoCard: true } // 告訴 requestSelfie 使用照片卡
    );

    // 成功後重新加載解鎖卡數據
    if (result) {
      await Promise.all([
        fetchPhotoStats(),
        loadTicketsBalance(),
      ]);

      success("拍照解鎖卡使用成功！");
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "使用照片卡失敗");
  }
};

// ====================
// Navigation
// ====================
const handleBack = () => {
  router.back();
};

// ====================
// Load User Assets
// ====================
const loadUserAssets = async () => {
  const userId = currentUserId.value;
  if (!userId) return;

  try {
    const data = await apiJson(`/api/users/${encodeURIComponent(userId)}/assets`, {
      skipGlobalLoading: true,
    });

    if (data) {
      userAssets.value = {
        characterUnlockCards: data.characterUnlockCards || 0,
        potions: {
          memoryBoost: data.potions?.memoryBoost || 0,
          brainBoost: data.potions?.brainBoost || 0,
        },
      };
    }
  } catch (error) {
    // Silent fail
  }
};

// ====================
// Load Active Potion Effects
// ====================
const loadActivePotions = async () => {
  const userId = currentUserId.value;
  if (!userId) return;

  try {
    const data = await apiJson(`/api/potions/active`, {
      skipGlobalLoading: true,
    });

    if (data && data.potions) {
      activePotionEffects.value = data.potions;
    }
  } catch (error) {
    // Silent fail
  }
};

// Watch partnerId changes
watch(partnerId, (newId) => {
  if (newId) {
    loadPartner(newId);
  }
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

    // Load user assets (potions, unlock cards, etc.)
    await loadUserAssets();

    // Load active potion effects
    await loadActivePotions();

    // Load conversation history
    await loadHistory(userId, matchId);

    // 檢查是否需要添加角色的第一句話
    // 條件：沒有消息，或者第一條消息不是角色的 first_message
    const needsFirstMessage =
      partner.value?.first_message &&
      (messages.value.length === 0 ||
        messages.value[0]?.text !== partner.value.first_message.trim());

    if (needsFirstMessage) {
      const firstMessage = {
        id: `msg-first-${Date.now()}`,
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
      :is-resetting-conversation="isResettingConversation"
      :is-favorited="isFavorited"
      :is-favorite-mutating="isFavoriteMutating"
      :memory-boost-count="userAssets.potions.memoryBoost"
      :brain-boost-count="userAssets.potions.brainBoost"
      :active-memory-boost="activeMemoryBoost"
      :active-brain-boost="activeBrainBoost"
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
      :photo-remaining="photoRemaining"
      @send="handleSendMessage"
      @suggestion-click="handleSuggestionClick"
      @request-suggestions="handleRequestSuggestions"
      @gift-click="handleOpenGiftSelector"
      @selfie-click="handleRequestSelfie"
      @video-click="handleRequestVideo"
    />

    <!-- Modals -->
    <Teleport to="body">
      <!-- Reset Confirmation -->
      <div v-if="showResetConfirm" class="chat-confirm-backdrop">
        <div
          class="chat-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-reset-confirm-title"
        >
          <header class="chat-confirm-header">
            <h2 id="chat-reset-confirm-title">重置對話</h2>
            <button
              type="button"
              class="chat-confirm-close"
              aria-label="關閉"
              @click="cancelResetConversation"
            >
              <XMarkIcon class="icon" aria-hidden="true" />
            </button>
          </header>
          <p>這將清除與此角色的所有聊天紀錄，確認要繼續嗎？</p>
          <footer class="chat-confirm-footer">
            <button
              type="button"
              class="chat-confirm-btn"
              @click="cancelResetConversation"
            >
              取消
            </button>
            <button
              type="button"
              class="chat-confirm-btn is-danger"
              :disabled="isResettingConversation"
              @click="confirmResetConversation"
            >
              {{ isResettingConversation ? "重置中…" : "確定重置" }}
            </button>
          </footer>
        </div>
      </div>

      <!-- Character Info -->
      <div v-if="showCharacterInfo" class="chat-confirm-backdrop">
        <div
          class="chat-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-character-info-title"
        >
          <header class="chat-confirm-header">
            <h2 id="chat-character-info-title">角色資訊</h2>
            <button
              type="button"
              class="chat-confirm-close"
              aria-label="關閉"
              @click="closeCharacterInfo"
            >
              <XMarkIcon class="icon" aria-hidden="true" />
            </button>
          </header>
          <p>{{ partnerBackground }}</p>
        </div>
      </div>

      <!-- Potion Confirmation Modal -->
      <PotionConfirmModal
        :is-open="showPotionConfirm"
        :potion-type="potionTypeToUse"
        :character-name="partnerDisplayName"
        :remaining-count="potionTypeToUse === 'memoryBoost' ? userAssets.potions.memoryBoost : userAssets.potions.brainBoost"
        @close="handleClosePotionConfirm"
        @confirm="handleConfirmUsePotion"
      />

      <!-- Buff Details Modal -->
      <div v-if="showBuffDetails && currentBuffDetails" class="chat-confirm-backdrop">
        <div
          class="chat-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="buff-details-title"
        >
          <header class="chat-confirm-header">
            <div class="buff-details-title">
              <span class="buff-details-icon">{{ currentBuffDetails.icon }}</span>
              <h2 id="buff-details-title">{{ currentBuffDetails.name }}</h2>
            </div>
            <button
              type="button"
              class="chat-confirm-close"
              aria-label="關閉"
              @click="handleCloseBuffDetails"
            >
              <XMarkIcon class="icon" aria-hidden="true" />
            </button>
          </header>
          <div class="buff-details-content">
            <p class="buff-details-description">{{ currentBuffDetails.description }}</p>
            <div class="buff-details-info">
              <div class="detail-item">
                <span class="detail-label">啟用時間：</span>
                <span class="detail-value">{{ currentBuffDetails.activatedAt }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">到期時間：</span>
                <span class="detail-value">{{ currentBuffDetails.expiresAt }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">剩餘時間：</span>
                <span class="detail-value is-highlight">{{ currentBuffDetails.remainingDays }} 天</span>
              </div>
            </div>
          </div>
          <footer class="chat-confirm-footer">
            <button
              type="button"
              class="chat-confirm-btn is-primary"
              @click="handleCloseBuffDetails"
            >
              確定
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Limit Modals -->
    <ConversationLimitModal
      :is-open="showLimitModal"
      :character-name="limitModalData.characterName"
      :remaining-messages="limitModalData.remainingMessages"
      :daily-ad-limit="limitModalData.dailyAdLimit"
      :ads-watched-today="limitModalData.adsWatchedToday"
      :is-unlocked="limitModalData.isUnlocked"
      :character-unlock-cards="limitModalData.characterUnlockCards"
      @close="handleCloseLimitModal"
      @watch-ad="handleWatchAd"
    />

    <VoiceLimitModal
      :is-open="showVoiceLimitModal"
      :character-name="voiceLimitModalData.characterName"
      :used-voices="voiceLimitModalData.usedVoices"
      :total-voices="voiceLimitModalData.totalVoices"
      :daily-ad-limit="voiceLimitModalData.dailyAdLimit"
      :ads-watched-today="voiceLimitModalData.adsWatchedToday"
      :voice-unlock-cards="voiceLimitModalData.voiceUnlockCards || 0"
      @close="handleCloseVoiceLimitModal"
      @watch-ad="handleWatchVoiceAd"
      @use-unlock-card="handleUseVoiceUnlockCard"
    />

    <PhotoLimitModal
      :is-open="showPhotoLimitModal"
      :used="photoLimitModalData.used"
      :remaining="photoLimitModalData.remaining"
      :total="photoLimitModalData.total"
      :standard-total="photoLimitModalData.standardTotal"
      :is-test-account="photoLimitModalData.isTestAccount"
      :cards="photoLimitModalData.cards"
      :tier="photoLimitModalData.tier"
      :reset-period="photoLimitModalData.resetPeriod"
      :photo-unlock-cards="photoLimitModalData.cards"
      @close="handleClosePhotoLimitModal"
      @use-unlock-card="handleUsePhotoUnlockCard"
      @upgrade-membership="handleUpgradeFromVideoModal"
    />

    <VideoLimitModal
      :is-open="showVideoLimitModal"
      :used="videoLimitModalData.used"
      :remaining="videoLimitModalData.remaining"
      :total="videoLimitModalData.total"
      :standard-total="videoLimitModalData.standardTotal"
      :is-test-account="videoLimitModalData.isTestAccount"
      :cards="videoLimitModalData.cards"
      :tier="videoLimitModalData.tier"
      :reset-period="videoLimitModalData.resetPeriod"
      :video-unlock-cards="videoLimitModalData.cards"
      @close="handleCloseVideoLimitModal"
      @use-unlock-card="handleUseVideoUnlockCard"
      @upgrade-membership="handleUpgradeFromVideoModal"
    />

    <ImageViewerModal
      :is-open="showImageViewer"
      :image-url="viewerImageUrl"
      :image-alt="viewerImageAlt"
      @close="handleCloseImageViewer"
    />

    <GiftSelectorModal
      :is-open="showGiftSelector"
      :character-name="partnerDisplayName"
      :balance="balance"
      :membership-tier="user?.membershipTier || 'free'"
      @close="closeGiftSelector"
      @select="handleSelectGift"
    />

    <!-- Gift Animation -->
    <GiftAnimation
      :show="showGiftAnimation"
      :gift-emoji="giftAnimationData.emoji"
      :gift-name="giftAnimationData.name"
    />
  </div>
</template>

<style scoped lang="scss">
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  position: relative;
}

.chat-backdrop {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(15, 23, 42, 0.95),
    rgba(30, 41, 59, 0.95)
  );
  z-index: 0;
}

/* Modal Styles */
.chat-confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1.5rem;
}

.chat-confirm-dialog {
  background: linear-gradient(
    180deg,
    rgba(30, 41, 59, 0.98) 0%,
    rgba(15, 23, 42, 0.98) 100%
  );
  border-radius: 20px;
  max-width: 420px;
  width: 100%;
  padding: 1.8rem;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.chat-confirm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;

  h2 {
    margin: 0;
    color: #f1f5f9;
    font-size: 1.35rem;
    font-weight: 600;
  }
}

.chat-confirm-close {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;

  .icon {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: rgba(148, 163, 184, 0.25);
    color: #f1f5f9;
  }
}

.chat-confirm-dialog p {
  color: rgba(226, 232, 240, 0.85);
  font-size: 0.98rem;
  line-height: 1.65;
  margin: 0 0 1.5rem 0;
}

.chat-confirm-footer {
  display: flex;
  gap: 0.8rem;
  justify-content: flex-end;
}

.chat-confirm-btn {
  padding: 0.7rem 1.5rem;
  border-radius: 12px;
  border: none;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 140ms ease;
  background: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;

  &:hover {
    background: rgba(148, 163, 184, 0.3);
    transform: translateY(-1px);
  }

  &.is-danger {
    background: linear-gradient(135deg, #dc2626, #ef4444);
    color: #fff;

    &:hover {
      background: linear-gradient(135deg, #b91c1c, #dc2626);
      box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  }

  &.is-primary {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #fff;

    &:hover {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  }
}

.memory-boost-content {
  margin-bottom: 1.5rem;

  p {
    margin-bottom: 1.2rem;
  }
}

.memory-boost-details {
  background: rgba(51, 65, 85, 0.4);
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.92rem;

  .detail-label {
    color: rgba(226, 232, 240, 0.7);
  }

  .detail-value {
    color: #f1f5f9;
    font-weight: 500;

    &.insufficient {
      color: #ef4444;
    }

    &.is-highlight {
      color: #fbbf24;
      font-weight: 600;
    }
  }
}

// Buff Details Modal
.buff-details-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.buff-details-icon {
  font-size: 1.75rem;
  line-height: 1;
}

.buff-details-content {
  margin-bottom: 1.5rem;
}

.buff-details-description {
  margin-bottom: 1.5rem;
  font-size: 1rem;
  line-height: 1.6;
}

.buff-details-info {
  background: rgba(51, 65, 85, 0.4);
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

@media (max-width: 540px) {
  .chat-confirm-dialog {
    padding: 1.5rem;
    border-radius: 16px;
  }

  .chat-confirm-header h2 {
    font-size: 1.2rem;
  }
}
</style>
