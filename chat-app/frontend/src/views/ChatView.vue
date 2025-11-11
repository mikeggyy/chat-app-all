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
import PotionLimitModal from "../components/PotionLimitModal.vue";
import CharacterUnlockConfirmModal from "../components/CharacterUnlockConfirmModal.vue";
import CharacterUnlockLimitModal from "../components/CharacterUnlockLimitModal.vue";
import PhotoSelectorModal from "../components/chat/PhotoSelectorModal.vue";

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

// Active potion effects (保留在外部，因為與 Potion Management 相關)
const activePotionEffects = ref([]);

// Active unlock effects (保留在外部，因為與 Unlock Management 相關)
const activeUnlockEffects = ref([]);

// 控制是否允許顯示解鎖效果（避免初始閃爍）
const isUnlockDataLoaded = ref(false);

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

// Computed: Active character unlock for current character
const activeCharacterUnlock = computed(() => {
  // 只有在數據加載完成後才返回結果，避免閃爍
  if (!isUnlockDataLoaded.value) {
    return null;
  }

  return activeUnlockEffects.value.find(
    (unlock) =>
      unlock.unlockType === "character" &&
      unlock.characterId === partnerId.value
  );
});

// Computed: Is character unlocked (based on active unlock)
const isCharacterUnlocked = computed(() => {
  // 在數據未加載時，預設視為"已解鎖"（從而隱藏解鎖按鈕，避免閃爍）
  if (!isUnlockDataLoaded.value) {
    return true;
  }
  return !!activeCharacterUnlock.value;
});

// Computed: Current buff details
const currentBuffDetails = computed(() => {
  const buffType = modals.buffDetails.type;
  if (!buffType) return null;

  // Determine which effect to display
  let effect = null;
  let name = "";
  let icon = "";
  let description = "";

  if (buffType === "memory") {
    effect = activeMemoryBoost.value;
    name = "記憶增強藥水";
    icon = "🧠";
    description = `${partnerDisplayName.value}的對話記憶上限增加 10,000 tokens`;
  } else if (buffType === "brain") {
    effect = activeBrainBoost.value;
    name = "腦力激盪藥水";
    icon = "⚡";
    description = "AI 模型升級為最高階模型，提供更聰明的對話體驗";
  } else if (buffType === "unlock") {
    effect = activeCharacterUnlock.value;
    name = "角色解鎖卡";
    icon = "🎫";
    description = `與「${partnerDisplayName.value}」暢聊無限次，無需消耗對話次數`;
  }

  if (!effect) return null;

  // Calculate remaining time
  const now = new Date();
  const expiresAt = new Date(effect.expiresAt || effect.unlockUntil);
  const remainingMs = expiresAt - now;
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  return {
    name,
    icon,
    description,
    activatedAt: new Date(effect.activatedAt || effect.unlockUntil).toLocaleString("zh-TW"),
    expiresAt: expiresAt.toLocaleString("zh-TW"),
    remainingDays,
  };
});

// User Assets (Potions only - other assets moved to useUnlockTickets)
const userPotions = ref({
  memoryBoost: 0,
  brainBoost: 0,
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
const getRandomVideoRequestMessage = () => {
  return VIDEO_REQUEST_MESSAGES[
    Math.floor(Math.random() * VIDEO_REQUEST_MESSAGES.length)
  ];
};

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
const handleShare = async () => {
  if (!chatPageRef.value) {
    showError("無法截圖，請稍後再試。");
    return;
  }

  const characterName = partnerDisplayName.value || "角色";
  const shareText = `我正在與 ${characterName} 聊天！`;
  const shareUrl = window.location.href;

  try {
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
    setLoading('resetConfirm', true);
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

    closeResetConfirm();
    success("對話已重置");
  } catch (error) {
    showError(error instanceof Error ? error.message : "重置對話失敗");
  } finally {
    setLoading('resetConfirm', false);
  }
};

const cancelResetConversation = () => {
  closeResetConfirm();
};

// ====================
// Character Info
// ====================
// closeCharacterInfo 由 useModalManager 提供

// ====================
// Potion Usage
// ====================
// handleClosePotionConfirm 由 closePotionConfirm 替代

const handleConfirmUsePotion = async () => {
  const userId = currentUserId.value;
  if (!userId) {
    showError("請先登入");
    return;
  }

  const potionType = modals.potionConfirm.type;
  setLoading('potionConfirm', true);

  try {
    if (potionType === "memoryBoost") {
      // 使用記憶增強藥水
      const result = await apiJson(`/api/potions/use/memory-boost`, {
        method: "POST",
        body: {
          characterId: partnerId.value,
        },
      });

      if (result.success) {
        success(`記憶增強藥水使用成功！效果將持續 ${result.duration} 天`);
        // 重新載入活躍藥水效果和藥水數量
        await Promise.all([loadActivePotions(), loadPotions()]);
      }
    } else if (potionType === "brainBoost") {
      // 使用腦力激盪藥水
      const result = await apiJson(`/api/potions/use/brain-boost`, {
        method: "POST",
        body: {
          characterId: partnerId.value,
        },
      });

      if (result.success) {
        success(`腦力激盪藥水使用成功！效果將持續 ${result.duration} 天`);
        // 重新載入活躍藥水效果和藥水數量
        await Promise.all([loadActivePotions(), loadPotions()]);
      }
    }

    closePotionConfirm();
  } catch (error) {
    showError(error.message || "使用藥水失敗");
  } finally {
    setLoading('potionConfirm', false);
  }
};

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
const handlePlayVoice = async (message) => {
  if (!message) return;

  await playVoice(message, { loadVoiceStats, checkVoiceLimit }, (limitInfo) => {
    // On limit exceeded - 保存待播放的消息並顯示限制彈窗
    showVoiceLimit(limitInfo, message);
  });
};

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
    showPhotoLimit(createLimitModalData(limitCheck, "photo"));
    return;
  }

  // 用於追蹤用戶消息 ID，以便失敗時撤回
  let userMessageId = null;

  try {
    // 1. 先發送一條隨機的拍照請求訊息
    const randomMessage = getRandomSelfieMessage();

    // 創建用戶消息
    const userMessage = {
      id: `${MESSAGE_ID_PREFIXES.SELFIE_REQUEST}${Date.now()}`,
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
        showPhotoLimit(limitInfo);
      },
      { usePhotoCard: false } // ✅ 此處僅在有免費額度時才被調用
    );

    // 如果拍照失敗（返回 null），撤回用戶訊息
    if (!photoResult && userMessageId) {
      await rollbackUserMessage(userId, matchId, userMessageId);
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "請求自拍失敗");

    // 撤回用戶剛發送的訊息
    if (userMessageId) {
      await rollbackUserMessage(userId, matchId, userMessageId);
    }
  }
};

// ====================
// Video Handler
// ====================
const isRequestingVideo = ref(false);

// 生成影片的核心邏輯（可重用）
const generateVideo = async (options = {}) => {
  const { useVideoCard = false, imageUrl = null } = options;
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  isRequestingVideo.value = true;

  // 用於追蹤用戶消息 ID，以便失敗時撤回
  let userMessageId = null;

  try {
    const token = await firebaseAuth.getCurrentUserIdToken();

    // 1. 先發送一條隨機的影片請求訊息
    const randomMessage = getRandomVideoRequestMessage();

    // 創建用戶消息
    const userMessage = {
      id: `${MESSAGE_ID_PREFIXES.VIDEO_REQUEST}${Date.now()}`,
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

    // 2. 創建臨時影片消息顯示 loading
    const tempVideoMessageId = `temp-video-${Date.now()}`;
    const tempVideoMessage = {
      id: tempVideoMessageId,
      role: "ai",
      text: "",
      video: "loading", // ⭐ 關鍵：設為 'loading'
      createdAt: new Date().toISOString(),
      state: "pending",
    };

    messages.value.push(tempVideoMessage);
    await nextTick();
    messageListRef.value?.scrollToBottom();

    // 3. 生成影片
    success("角色正在錄製影片給你，稍等一下下哦～");

    const videoResult = await apiJson(`/api/ai/generate-video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        // userId 從後端認證 token 自動獲取，無需傳遞
        characterId: matchId,
        requestId: `video-${userId}-${matchId}-${Date.now()}`, // 冪等性 ID
        duration: VIDEO_CONFIG.DURATION,
        resolution: VIDEO_CONFIG.RESOLUTION,
        aspectRatio: VIDEO_CONFIG.ASPECT_RATIO,
        useVideoCard, // 告訴後端是否使用影片卡
        imageUrl, // 🎨 自定義圖片 URL（從相簿選擇）
      },
      skipGlobalLoading: true, // ✅ 允許用戶繼續聊天
    });

    // ✅ 驗證影片生成結果
    if (!videoResult || !videoResult.videoUrl) {
      // 移除臨時消息
      const tempIndex = messages.value.findIndex((m) => m.id === tempVideoMessageId);
      if (tempIndex !== -1) {
        messages.value.splice(tempIndex, 1);
      }
      throw new Error("影片生成失敗：未返回有效的影片 URL");
    }

    // 4. 創建包含影片的 AI 消息
    const aiVideoMessage = {
      id: `${MESSAGE_ID_PREFIXES.VIDEO_AI}${Date.now()}`,
      role: "ai",
      text: AI_VIDEO_RESPONSE_TEXT,
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
      // 替換臨時消息
      const tempIndex = messages.value.findIndex((m) => m.id === tempVideoMessageId);
      if (tempIndex !== -1) {
        messages.value.splice(tempIndex, 1, aiVideoMessage);
      } else {
        messages.value.push(aiVideoMessage);
      }

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

      success("影片錄好了！快來看看吧 ✨");
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
    // 移除臨時影片消息
    const tempIndex = messages.value.findIndex((m) => m.video === "loading");
    if (tempIndex !== -1) {
      messages.value.splice(tempIndex, 1);
    }

    showError(error instanceof Error ? error.message : "生成影片失敗");

    // 撤回用戶剛發送的訊息
    if (userMessageId) {
      await rollbackUserMessage(userId, matchId, userMessageId);
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

    // 先檢查影片生成權限
    const limitCheck = await apiJson(`/api/ai/video/check/${userId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      skipGlobalLoading: true,
    });

    // 如果免費額度用完，顯示彈窗讓用戶決定是否使用解鎖卡
    if (!limitCheck.allowed) {
      showVideoLimit(createLimitModalData(limitCheck, "video"));
      return;
    }

    // ✅ 權限檢查通過，顯示照片選擇器
    showPhotoSelector();
  } catch (error) {
    showError(error instanceof Error ? error.message : "檢查影片權限失敗");
  }
};

// 處理用戶選擇照片（從照片選擇器）
const handlePhotoSelect = async (imageUrl) => {
  try {
    // 根據標記決定是否使用影片卡
    const useCard = modals.photoSelector.useCard;

    // 生成影片
    await generateVideo({
      useVideoCard: useCard,
      imageUrl: imageUrl
    });

    // 成功後關閉選擇器
    closePhotoSelector();

    // ✅ 如果使用了影片卡，重新加載解鎖卡餘額
    if (useCard) {
      const userId = currentUserId.value;
      if (userId) {
        await loadTicketsBalance(userId);
      }
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "生成影片失敗");
    closePhotoSelector();
  }
};

// handleClosePhotoSelector 由 closePhotoSelector 替代

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
    // 立即顯示禮物動畫
    showGiftAnimation(gift.emoji, gift.name);

    // 2秒後自動隱藏動畫
    setTimeout(() => {
      closeGiftAnimation();
    }, 2000);
  }

  // 發送禮物（動畫已經在播放）
  await sendGift(giftData, () => {
    // On success - 動畫已經在顯示，不需要再做處理
  });

  // Reload balance
  await loadBalance(userId);
};

// ====================
// Limit Modal Handlers
// ====================
// handleCloseLimitModal 由 closeConversationLimit 替代

const handleWatchAd = async (adType) => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  try {
    if (adType === "conversation") {
      await unlockByAd(userId, matchId);
      const state = await getLimitState(userId, matchId);
      updateModal('conversationLimit', {
        remainingMessages: state.remaining || 0,
        adsWatchedToday: state.adsWatchedToday || 0,
      });
      closeConversationLimit();
      success("已解鎖 5 則訊息！");
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "觀看廣告失敗");
  }
};

const handleUseUnlockCard = async () => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  try {
    // 獲取認證權杖
    const token = await firebaseAuth.getCurrentUserIdToken();

    // 調用後端 API 使用解鎖卡
    const result = await apiJson("/api/unlock-tickets/use/character", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        characterId: matchId,
      },
      skipGlobalLoading: true,
    });

    if (result.success) {
      // 關閉模態框
      closeConversationLimit();

      // 重新加載解鎖卡數量
      await loadTicketsBalance(userId);

      // 顯示解鎖成功訊息（包含到期時間）
      const unlockDays = result.unlockDays || 7;
      const characterName = partnerDisplayName.value || "角色";
      success(`解鎖成功！與「${characterName}」可暢聊 ${unlockDays} 天 🎉`);
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "使用解鎖卡失敗");
  }
};

// handleCloseVoiceLimitModal 由 closeVoiceLimit 替代

const handleWatchVoiceAd = async () => {
  const userId = currentUserId.value;
  const matchId = partner.value?.id;

  if (!userId || !matchId) return;

  try {
    await unlockVoiceByAd(userId, matchId);
    await loadVoiceStats(userId);
    closeVoiceLimit();
    success("已解鎖 5 次語音！");
  } catch (error) {
    showError(error instanceof Error ? error.message : "觀看廣告失敗");
  }
};

const handleUseVoiceUnlockCard = async () => {
  const message = modals.voiceLimit.pending;

  if (!message) {
    showError("無法使用語音解鎖卡");
    return;
  }

  try {
    // 1. 關閉模態框
    closeVoiceLimit();

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

    if (playSuccess) {
      // 4. 重新加載語音統計和解鎖卡數據
      await Promise.all([loadVoiceStats(), loadTicketsBalance()]);

      success("語音解鎖卡使用成功！");
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "使用語音解鎖卡失敗");
  }
};

// handleClosePhotoLimitModal 由 closePhotoLimit 替代

// ====================
// Video Limit Modal Handlers
// ====================
// handleCloseVideoLimitModal 由 closeVideoLimit 替代

const handleUseVideoUnlockCard = async () => {
  try {
    // 關閉模態框
    closeVideoLimit();

    // ✅ 顯示照片選擇器，讓用戶選擇照片（標記需要使用影片卡）
    // 實際的影片生成會在用戶選擇照片後（handlePhotoSelect）執行
    showPhotoSelector(true); // true = useCard
  } catch (error) {
    showError(error instanceof Error ? error.message : "使用影片卡失敗");
  }
};

const handleUpgradeFromVideoModal = () => {
  closeVideoLimit();
  router.push("/membership");
};

const handleUsePhotoUnlockCard = async () => {
  try {
    // 關閉模態框
    closePhotoLimit();

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
      await Promise.all([fetchPhotoStats(), loadTicketsBalance()]);

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
// Load Potions Only (卡片統一由 useUnlockTickets 管理)
// ====================
const loadPotions = async () => {
  const userId = currentUserId.value;
  if (!userId) return;

  try {
    const data = await apiJson(
      `/api/users/${encodeURIComponent(userId)}/assets`,
      {
        skipGlobalLoading: true,
      }
    );

    if (data?.potions) {
      userPotions.value = {
        memoryBoost: data.potions.memoryBoost || 0,
        brainBoost: data.potions.brainBoost || 0,
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

  // 先清空舊數據，避免閃爍
  activePotionEffects.value = [];

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

// ====================
// Load Active Unlock Effects
// ====================
const loadActiveUnlocks = async () => {
  const userId = currentUserId.value;
  if (!userId) return;

  // 先清空舊數據，避免閃爍
  activeUnlockEffects.value = [];

  try {
    const data = await apiJson(`/api/unlock-tickets/active`, {
      skipGlobalLoading: true,
    });

    if (data && data.unlocks) {
      activeUnlockEffects.value = data.unlocks;
    }
  } catch (error) {
    // Silent fail
  } finally {
    // 數據加載完成，允許顯示圖標
    isUnlockDataLoaded.value = true;
  }
};

// ====================
// Character Unlock Handlers
// ====================
// handleCloseUnlockConfirm 由 closeUnlockConfirm 替代
// handleCloseUnlockLimit 由 closeUnlockLimit 替代

const handleConfirmUnlockCharacter = async () => {
  const userId = currentUserId.value;
  const matchId = partnerId.value;

  if (!userId || !matchId) return;

  setLoading('unlockConfirm', true);

  try {
    // 獲取認證權杖
    const token = await firebaseAuth.getCurrentUserIdToken();

    // 調用後端 API 使用解鎖卡
    const result = await apiJson("/api/unlock-tickets/use/character", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        characterId: matchId,
      },
      skipGlobalLoading: true,
    });

    if (result.success) {
      // 關閉模態框
      closeUnlockConfirm();

      // 重新加載解鎖卡餘額和活躍解鎖效果
      await Promise.all([loadTicketsBalance(userId), loadActiveUnlocks()]);

      // 顯示解鎖成功訊息
      const unlockDays = result.unlockDays || 7;
      const characterName = partnerDisplayName.value || "角色";
      success(`解鎖成功！與「${characterName}」可暢聊 ${unlockDays} 天 🎉`);
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "使用解鎖卡失敗");
  } finally {
    setLoading('unlockConfirm', false);
  }
};

// Watch partnerId changes
watch(partnerId, (newId) => {
  if (newId) {
    // 立即隱藏解鎖圖標，避免顯示閃爍
    isUnlockDataLoaded.value = false;

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
        console.warn("記錄對話歷史失敗:", error);
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

    <!-- Modals -->
    <Teleport to="body">
      <!-- Reset Confirmation -->
      <div v-if="modals.resetConfirm.show" class="chat-confirm-backdrop">
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
              :disabled="modals.resetConfirm.loading"
              @click="confirmResetConversation"
            >
              {{ modals.resetConfirm.loading ? "重置中…" : "確定重置" }}
            </button>
          </footer>
        </div>
      </div>

      <!-- Character Info -->
      <div v-if="modals.characterInfo.show" class="chat-confirm-backdrop">
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
        :is-open="modals.potionConfirm.show"
        :potion-type="modals.potionConfirm.type"
        :character-name="partnerDisplayName"
        :remaining-count="
          modals.potionConfirm.type === 'memoryBoost'
            ? userPotions.memoryBoost
            : userPotions.brainBoost
        "
        @close="closePotionConfirm"
        @confirm="handleConfirmUsePotion"
      />

      <!-- Potion Limit Modal (No Potion Available) -->
      <PotionLimitModal
        :is-open="modals.potionLimit.show"
        :potion-type="modals.potionLimit.type"
        :character-name="partnerDisplayName"
        @close="closePotionLimit"
      />

      <!-- Character Unlock Confirm Modal -->
      <CharacterUnlockConfirmModal
        :is-open="modals.unlockConfirm.show"
        :character-name="partnerDisplayName"
        :remaining-cards="characterTickets"
        :is-using="modals.unlockConfirm.loading"
        @close="closeUnlockConfirm"
        @confirm="handleConfirmUnlockCharacter"
      />

      <!-- Character Unlock Limit Modal (No Card Available) -->
      <CharacterUnlockLimitModal
        :is-open="modals.unlockLimit.show"
        :character-name="partnerDisplayName"
        @close="closeUnlockLimit"
      />

      <!-- Buff Details Modal -->
      <div
        v-if="modals.buffDetails.show && currentBuffDetails"
        class="chat-confirm-backdrop"
      >
        <div
          class="chat-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="buff-details-title"
        >
          <header class="chat-confirm-header">
            <div class="buff-details-title">
              <span class="buff-details-icon">{{
                currentBuffDetails.icon
              }}</span>
              <h2 id="buff-details-title">{{ currentBuffDetails.name }}</h2>
            </div>
            <button
              type="button"
              class="chat-confirm-close"
              aria-label="關閉"
              @click="closeBuffDetails"
            >
              <XMarkIcon class="icon" aria-hidden="true" />
            </button>
          </header>
          <div class="buff-details-content">
            <p class="buff-details-description">
              {{ currentBuffDetails.description }}
            </p>
            <div class="buff-details-info">
              <div class="detail-item">
                <span class="detail-label">啟用時間：</span>
                <span class="detail-value">{{
                  currentBuffDetails.activatedAt
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">到期時間：</span>
                <span class="detail-value">{{
                  currentBuffDetails.expiresAt
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">剩餘時間：</span>
                <span class="detail-value is-highlight"
                  >{{ currentBuffDetails.remainingDays }} 天</span
                >
              </div>
            </div>
          </div>
          <footer class="chat-confirm-footer">
            <button
              type="button"
              class="chat-confirm-btn is-primary"
              @click="closeBuffDetails"
            >
              確定
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Limit Modals -->
    <ConversationLimitModal
      :is-open="modals.conversationLimit.show"
      :character-name="modals.conversationLimit.data.characterName"
      :remaining-messages="modals.conversationLimit.data.remainingMessages"
      :daily-ad-limit="modals.conversationLimit.data.dailyAdLimit"
      :ads-watched-today="modals.conversationLimit.data.adsWatchedToday"
      :is-unlocked="modals.conversationLimit.data.isUnlocked"
      :character-unlock-cards="characterTickets"
      @close="closeConversationLimit"
      @watch-ad="handleWatchAd"
      @use-unlock-card="handleUseUnlockCard"
    />

    <VoiceLimitModal
      :is-open="modals.voiceLimit.show"
      :character-name="modals.voiceLimit.data.characterName"
      :used-voices="modals.voiceLimit.data.usedVoices"
      :total-voices="modals.voiceLimit.data.totalVoices"
      :daily-ad-limit="modals.voiceLimit.data.dailyAdLimit"
      :ads-watched-today="modals.voiceLimit.data.adsWatchedToday"
      :voice-unlock-cards="voiceCards"
      @close="closeVoiceLimit"
      @watch-ad="handleWatchVoiceAd"
      @use-unlock-card="handleUseVoiceUnlockCard"
    />

    <PhotoLimitModal
      :is-open="modals.photoLimit.show"
      :used="modals.photoLimit.data.used"
      :remaining="modals.photoLimit.data.remaining"
      :total="modals.photoLimit.data.total"
      :standard-total="modals.photoLimit.data.standardTotal"
      :is-test-account="modals.photoLimit.data.isTestAccount"
      :cards="modals.photoLimit.data.cards"
      :tier="modals.photoLimit.data.tier"
      :reset-period="modals.photoLimit.data.resetPeriod"
      :photo-unlock-cards="photoCards"
      @close="closePhotoLimit"
      @use-unlock-card="handleUsePhotoUnlockCard"
      @upgrade-membership="handleUpgradeFromVideoModal"
    />

    <VideoLimitModal
      :is-open="modals.videoLimit.show"
      :used="modals.videoLimit.data.used"
      :remaining="modals.videoLimit.data.remaining"
      :total="modals.videoLimit.data.total"
      :standard-total="modals.videoLimit.data.standardTotal"
      :is-test-account="modals.videoLimit.data.isTestAccount"
      :cards="modals.videoLimit.data.cards"
      :tier="modals.videoLimit.data.tier"
      :reset-period="modals.videoLimit.data.resetPeriod"
      :video-unlock-cards="videoCards"
      @close="closeVideoLimit"
      @use-unlock-card="handleUseVideoUnlockCard"
      @upgrade-membership="handleUpgradeFromVideoModal"
    />

    <PhotoSelectorModal
      :is-open="modals.photoSelector.show"
      :character-id="partnerId"
      :character-photo-url="partner?.photoUrl || partner?.avatarUrl || partner?.imageUrl || partner?.portraitUrl || ''"
      @close="closePhotoSelector"
      @select="handlePhotoSelect"
    />

    <ImageViewerModal
      :is-open="modals.imageViewer.show"
      :image-url="modals.imageViewer.url"
      :image-alt="modals.imageViewer.alt"
      @close="closeImageViewer"
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
      :show="modals.giftAnimation.show"
      :gift-emoji="modals.giftAnimation.emoji"
      :gift-name="modals.giftAnimation.name"
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
   Modal Base Styles
   =================== */
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

  p {
    color: rgba(226, 232, 240, 0.85);
    font-size: 0.98rem;
    line-height: 1.65;
    margin: 0 0 1.5rem 0;
  }
}

/* Modal Header */
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

/* Modal Close Button */
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

/* Modal Footer */
.chat-confirm-footer {
  display: flex;
  gap: 0.8rem;
  justify-content: flex-end;
}

/* ===================
   Modal Buttons
   =================== */
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

/* ===================
   Detail Items
   =================== */
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

/* ===================
   Buff Details Modal
   =================== */
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

/* ===================
   Responsive Styles
   =================== */
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
