/**
 * useChatActions.ts
 * 管理聊天操作功能（TypeScript 版本）：拍照、禮物、語音播放
 */

import { ref, nextTick, onBeforeUnmount, unref, type Ref, type ComputedRef } from 'vue';
import { apiJson } from '../../utils/api.js';
import { writeCachedHistory } from '../../utils/conversationCache.js';
import { getGiftById } from '../../config/gifts.js';
import { generateVoiceRequestId, generatePhotoRequestId, generateGiftRequestId } from '../../utils/requestId.js';
import { giftQueue } from '../../utils/requestQueue.js';
import type { Message, Partner, FirebaseAuthService } from '../../types';

// ==================== 類型定義 ====================

/**
 * 禮物接口
 */
export interface Gift {
  id: string;
  name: string;
  emoji: string;
  price: number;
  rarity?: string;
}

/**
 * Toast 通知接口
 */
export interface Toast {
  success: (message: string) => void;
  error: (message: string) => void;
  info?: (message: string) => void;
}

/**
 * 拍照限制信息
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
 * 拍照限制檢查器
 */
export interface PhotoLimitChecker {
  canGeneratePhoto: () => Promise<{ allowed: boolean; used?: number; remaining?: number; total?: number; standardPhotosLimit?: number | null; isTestAccount?: boolean; cards?: number; tier?: string; resetPeriod?: string }>;
  fetchPhotoStats: () => Promise<any>;
}

/**
 * 語音限制信息
 */
export interface VoiceLimitInfo {
  characterName: string;
  usedVoices: number;
  totalVoices: number;
  dailyAdLimit: number;
  adsWatchedToday: number;
  voiceUnlockCards: number;
}

/**
 * 語音限制檢查器
 */
export interface VoiceLimitChecker {
  loadVoiceStats: (userId: string) => Promise<any>;
  checkVoiceLimit: (userId: string, characterId: string) => Promise<{ allowed: boolean; used?: number; total?: number; dailyAdLimit?: number; adsWatchedToday?: number; voiceUnlockCards?: number }>;
}

/**
 * 禮物數據
 */
export interface GiftData {
  giftId: string;
  gift?: Gift;
  priceInfo?: any;
}

/**
 * 拍照選項
 */
export interface RequestSelfieOptions {
  usePhotoCard?: boolean;
}

/**
 * 播放語音選項
 */
export interface PlayVoiceOptions {
  useVoiceUnlockCard?: boolean;
}

/**
 * useChatActions 參數
 */
export interface UseChatActionsParams {
  messages: Ref<Message[]>;
  partner: Ref<Partner | null>;
  currentUserId: Ref<string> | ComputedRef<string>;
  firebaseAuth: FirebaseAuthService;
  toast: Toast;
  requireLogin: (options: { feature: string }) => boolean;
  scrollToBottom?: () => void;
  appendCachedHistory?: (messages: Message[]) => void;
}

/**
 * useChatActions 返回類型
 */
export interface UseChatActionsReturn {
  // 拍照相關
  isRequestingSelfie: Ref<boolean>;
  requestSelfie: (photoLimitChecker: PhotoLimitChecker, onLimitExceeded?: (info: PhotoLimitInfo) => void, options?: RequestSelfieOptions) => Promise<Message | null>;

  // 禮物相關
  showGiftSelector: Ref<boolean>;
  isSendingGift: Ref<boolean>;
  openGiftSelector: (loadUserAssets?: (userId: string) => Promise<any>) => Promise<void>;
  closeGiftSelector: () => void;
  sendGift: (giftData: GiftData, onSuccess?: (giftMessage: Message, replyMessage: Message | null) => void) => Promise<boolean>;

  // 語音相關
  playingVoiceMessageId: Ref<string | null>;
  playVoice: (message: Message, voiceLimitChecker: VoiceLimitChecker, onLimitExceeded?: (info: VoiceLimitInfo) => void, getVoiceRemaining?: () => number, options?: PlayVoiceOptions) => Promise<boolean>;
  stopVoice: () => void;
}

// ==================== Composable 主函數 ====================

/**
 * 聊天操作 Composable
 * @param params - 配置選項
 */
export function useChatActions(params: UseChatActionsParams): UseChatActionsReturn {
  const {
    messages,
    partner,
    currentUserId,
    firebaseAuth,
    toast,
    requireLogin,
    scrollToBottom,
    appendCachedHistory,
  } = params;

  // ==================== 拍照功能 ====================

  const isRequestingSelfie = ref(false);

  /**
   * 請求自拍照片
   * @param photoLimitChecker - 拍照限制檢查器
   * @param onLimitExceeded - 限制超出回調
   * @param options - 選項
   * @returns 生成的消息或 null
   */
  const requestSelfie = async (
    photoLimitChecker: PhotoLimitChecker,
    onLimitExceeded?: (info: PhotoLimitInfo) => void,
    options: RequestSelfieOptions = {}
  ): Promise<Message | null> => {
    const { usePhotoCard = false } = options;
    // 檢查遊客
    if (requireLogin({ feature: '請求自拍照片' })) {
      return null;
    }

    // 防止重複請求
    if (isRequestingSelfie.value) {
      return null;
    }

    const matchId = partner.value?.id ?? '';
    const userId = unref(currentUserId) ?? '';

    if (!matchId || !userId) {
      toast.error('無法請求自拍');
      return null;
    }

    // 如果使用解鎖卡，跳過限制檢查
    if (!usePhotoCard) {
      // 檢查拍照限制
      const limitCheck = await photoLimitChecker.canGeneratePhoto();
      if (!limitCheck.allowed) {
        if (onLimitExceeded) {
          onLimitExceeded({
            used: limitCheck.used || 0,
            remaining: limitCheck.remaining || 0,
            total: limitCheck.total || 0,
            standardTotal: limitCheck.standardPhotosLimit || null,
            isTestAccount: limitCheck.isTestAccount || false,
            cards: limitCheck.cards || 0,
            tier: limitCheck.tier || 'free',
            resetPeriod: limitCheck.resetPeriod || 'lifetime',
          });
        }
        return null;
      }
    }

    try {
      isRequestingSelfie.value = true;

      // 創建臨時消息顯示 loading
      const tempMessageId = `temp-selfie-${Date.now()}`;
      const tempMessage: Message = {
        id: tempMessageId,
        role: 'partner',
        text: '',
        imageUrl: 'loading',
        createdAt: new Date().toISOString(),
        state: 'pending',
      };

      messages.value.push(tempMessage);
      await nextTick();
      if (scrollToBottom) scrollToBottom();

      // 生成請求ID
      const requestId = generatePhotoRequestId(userId, matchId);

      // 調用後端 API（包含請求ID）
      // 使用 apiJson 自動處理 CSRF Token 和認證
      let response;
      try {
        response = await apiJson('/api/ai/generate-selfie', {
          method: 'POST',
          body: {
            characterId: matchId,
            requestId,
            usePhotoCard,
          },
          skipGlobalLoading: true, // ✅ 不顯示全局 loading，允許用戶繼續聊天
        });
      } catch (error: any) {
        // 移除臨時消息
        const tempIndex = messages.value.findIndex((m) => m.id === tempMessageId);
        if (tempIndex !== -1) {
          messages.value.splice(tempIndex, 1);
        }

        // 處理限制錯誤 (403 錯誤)
        if (error.status === 403 && error.data?.limitExceeded) {
          if (onLimitExceeded) {
            const limitInfo = error.data.limitInfo || {};
            onLimitExceeded({
              used: limitInfo.used || 0,
              remaining: limitInfo.remaining || 0,
              total: limitInfo.total || 0,
              standardTotal: limitInfo.standardPhotosLimit || null,
              isTestAccount: limitInfo.isTestAccount || false,
              cards: limitInfo.cards || 0,
              tier: limitInfo.tier || 'free',
              resetPeriod: limitInfo.resetPeriod || 'lifetime',
            });
          }
          return null;
        }

        throw new Error(error.message || '生成自拍失敗');
      }

      // ✅ 修復：apiJson 返回 { success: true, data: {...} }
      // 後端的 sendSuccess 將 generateSelfieForCharacter 的結果包裝在 data 中
      const data = response.data || response;

      // 替換臨時消息
      if (data.message) {
        const tempIndex = messages.value.findIndex((m) => m.id === tempMessageId);
        if (tempIndex !== -1) {
          messages.value.splice(tempIndex, 1, data.message);
        } else {
          messages.value.push(data.message);
        }

        // 更新緩存
        if (appendCachedHistory) {
          appendCachedHistory([data.message]);
        }

        await nextTick();
        if (scrollToBottom) scrollToBottom();

        // 更新拍照統計
        await photoLimitChecker.fetchPhotoStats();

        return data.message;
      }

      return null;
    } catch (error) {
      // 移除臨時消息
      const tempIndex = messages.value.findIndex((m) => m.imageUrl === 'loading');
      if (tempIndex !== -1) {
        messages.value.splice(tempIndex, 1);
      }
      toast.error(error instanceof Error ? error.message : '請求自拍失敗');
      return null;
    } finally {
      isRequestingSelfie.value = false;
    }
  };

  // ==================== 禮物功能 ====================

  const showGiftSelector = ref(false);
  const isSendingGift = ref(false);

  /**
   * 打開禮物選擇器
   * @param loadUserAssets - 載入用戶資產函數
   */
  const openGiftSelector = async (loadUserAssets?: (userId: string) => Promise<any>): Promise<void> => {
    // 檢查遊客
    if (requireLogin({ feature: '送禮物' })) {
      return;
    }

    const userId = unref(currentUserId) ?? '';
    if (!userId) {
      toast.error('無法打開禮物選擇器');
      return;
    }

    // 載入用戶資產（金幣餘額）
    if (loadUserAssets) {
      await loadUserAssets(userId);
    }

    showGiftSelector.value = true;
  };

  /**
   * 關閉禮物選擇器
   */
  const closeGiftSelector = (): void => {
    showGiftSelector.value = false;
  };

  /**
   * 發送禮物
   * @param giftData - 禮物資料
   * @param onSuccess - 成功回調
   * @returns 是否成功
   */
  const sendGift = async (
    giftData: GiftData,
    onSuccess?: (giftMessage: Message, replyMessage: Message | null) => void
  ): Promise<boolean> => {
    const matchId = partner.value?.id ?? '';
    const userId = unref(currentUserId) ?? '';

    if (!matchId || !userId) {
      toast.error('無法送出禮物');
      return false;
    }

    if (isSendingGift.value) {
      return false;
    }

    try {
      isSendingGift.value = true;
      showGiftSelector.value = false;

      // 從 giftId 獲取完整禮物資料
      const gift = getGiftById(giftData.giftId);
      if (!gift) {
        throw new Error('找不到禮物資料');
      }

      // 生成請求ID
      const requestId = generateGiftRequestId(userId, matchId, giftData.giftId);

      // ✅ 使用請求隊列確保送禮操作順序執行，避免並發金幣扣款衝突
      const sendResult = await giftQueue.enqueue(async () => {
        return await apiJson('/api/gifts/send', {
          method: 'POST',
          body: {
            characterId: matchId,
            giftId: giftData.giftId,
            requestId,
          },
          skipGlobalLoading: true,
        });
      });

      if (!sendResult || !sendResult.success) {
        throw new Error(sendResult?.message || '送出禮物失敗');
      }

      // 創建禮物消息（帶 emoji）
      const giftMessageId = `msg-gift-${Date.now()}`;
      const characterName = partner.value?.display_name || (partner.value as any)?.name || '對方';
      const giftMessage: Message = {
        id: giftMessageId,
        role: 'user',
        text: `(送給了${characterName}${gift.emoji}${gift.name})`,
        createdAt: new Date().toISOString(),
      };

      messages.value.push(giftMessage);

      await nextTick();
      if (scrollToBottom) scrollToBottom();

      // 獲取認證權杖
      const token = await firebaseAuth.getCurrentUserIdToken();

      // 1. 保存禮物消息到後端
      const giftMessageResult = await apiJson(
        `/api/conversations/${userId}/${matchId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            text: giftMessage.text,
            role: 'user',
          },
          skipGlobalLoading: true,
        }
      );

      // 更新緩存（使用完整歷史）
      if (writeCachedHistory && giftMessageResult?.messages) {
        writeCachedHistory(userId, matchId, giftMessageResult.messages);
      }

      // 2. 生成禮物照片（帶 loading 狀態）
      const tempPhotoId = `temp-photo-${Date.now()}`;
      const tempPhoto: Message = {
        id: tempPhotoId,
        role: 'partner',
        text: '',
        imageUrl: 'loading',
        createdAt: new Date().toISOString(),
        state: 'pending',
      };

      messages.value.push(tempPhoto);
      await nextTick();
      if (scrollToBottom) scrollToBottom();

      try {
        // 使用禮物回應 API
        const giftResponse = await apiJson('/api/gifts/response', {
          method: 'POST',
          body: {
            characterData: {
              id: matchId,
              display_name: partner.value?.display_name || (partner.value as any)?.name,
              background: partner.value?.background,
              portraitUrl: partner.value?.portraitUrl,
            },
            giftId: giftData.giftId,
            generatePhoto: true,
          },
          skipGlobalLoading: true,
        });

        // 移除臨時消息
        const tempPhotoIndex = messages.value.findIndex((m) => m.id === tempPhotoId);
        if (tempPhotoIndex !== -1) {
          messages.value.splice(tempPhotoIndex, 1);
        }

        if (giftResponse?.success) {
          // 添加感謝訊息
          if (giftResponse.thankYouMessage) {
            messages.value.push(giftResponse.thankYouMessage);
            if (appendCachedHistory) {
              appendCachedHistory([giftResponse.thankYouMessage]);
            }
          }

          // 添加照片訊息
          if (giftResponse.photoMessage) {
            messages.value.push(giftResponse.photoMessage);
            if (appendCachedHistory) {
              appendCachedHistory([giftResponse.photoMessage]);
            }

            if (onSuccess) {
              onSuccess(giftMessage, giftResponse.photoMessage);
            }
          } else {
            if (onSuccess) {
              onSuccess(giftMessage, null);
            }
          }

          await nextTick();
          if (scrollToBottom) scrollToBottom();
        } else {
          toast.error('禮物回應生成失敗');
          if (onSuccess) {
            onSuccess(giftMessage, null);
          }
        }
      } catch (photoError) {
        const tempPhotoIndex = messages.value.findIndex((m) => m.id === tempPhotoId);
        if (tempPhotoIndex !== -1) {
          messages.value.splice(tempPhotoIndex, 1);
        }

        if (onSuccess) {
          onSuccess(giftMessage, null);
        }
      }

      return true;
    } catch (error) {
      const tempIndex = messages.value.findIndex((m) => m.state === 'pending' && m.role === 'partner');
      if (tempIndex !== -1) {
        messages.value.splice(tempIndex, 1);
      }
      toast.error(error instanceof Error ? error.message : '送出禮物失敗');
      return false;
    } finally {
      isSendingGift.value = false;
    }
  };

  // ==================== 語音播放功能 ====================

  const playingVoiceMessageId: Ref<string | null> = ref(null);
  const currentAudio: Ref<HTMLAudioElement | null> = ref(null);
  const currentAudioUrl: Ref<string | null> = ref(null);

  /**
   * 清理音頻資源
   */
  const cleanupAudio = (): void => {
    if (currentAudio.value) {
      currentAudio.value.onended = null;
      currentAudio.value.onerror = null;

      try {
        currentAudio.value.pause();
        currentAudio.value.currentTime = 0;
      } catch (error) {
        // 忽略停止播放時的錯誤
      }

      currentAudio.value = null;
    }

    if (currentAudioUrl.value) {
      try {
        URL.revokeObjectURL(currentAudioUrl.value);
      } catch (error) {
        // 忽略 URL 釋放錯誤
      }
      currentAudioUrl.value = null;
    }
  };

  // 組件卸載時清理音頻資源
  onBeforeUnmount(() => {
    cleanupAudio();
  });

  /**
   * 播放語音
   * @param message - 消息物件
   * @param voiceLimitChecker - 語音限制檢查器
   * @param onLimitExceeded - 限制超出回調
   * @param getVoiceRemaining - 獲取剩餘次數函數
   * @param options - 播放選項
   * @returns 是否成功播放
   */
  const playVoice = async (
    message: Message,
    voiceLimitChecker: VoiceLimitChecker,
    onLimitExceeded?: (info: VoiceLimitInfo) => void,
    getVoiceRemaining?: () => number,
    options: PlayVoiceOptions = {}
  ): Promise<boolean> => {
    // getVoiceRemaining 參數保留用於未來擴展，目前未使用
    void getVoiceRemaining; // 標記參數已被認知

    // 檢查遊客
    if (requireLogin({ feature: '語音播放' })) {
      return false;
    }

    // 確保消息有 ID（用於防止重複播放）
    const messageId = message.id ?? `temp-${Date.now()}`;

    // 防止重複播放
    if (playingVoiceMessageId.value === messageId) {
      return false;
    }

    const text = message.text;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return false;
    }

    try {
      const matchId = partner.value?.id ?? '';
      const userId = unref(currentUserId) ?? '';

      if (!matchId || !userId) {
        toast.error('無法播放語音');
        return false;
      }

      // 如果使用解鎖卡，跳過限制檢查
      if (!options.useVoiceUnlockCard) {
        if (voiceLimitChecker?.checkVoiceLimit) {
          const limitCheck = await voiceLimitChecker.checkVoiceLimit(userId, matchId);
          if (!limitCheck.allowed) {
            if (onLimitExceeded) {
              onLimitExceeded({
                characterName: partner.value?.display_name || '角色',
                usedVoices: limitCheck.used || 0,
                totalVoices: limitCheck.total || 10,
                dailyAdLimit: limitCheck.dailyAdLimit || 10,
                adsWatchedToday: limitCheck.adsWatchedToday || 0,
                voiceUnlockCards: limitCheck.voiceUnlockCards || 0,
              });
            }
            return false;
          }
        }
      }

      // 生成請求ID
      const requestId = generateVoiceRequestId(userId, matchId, messageId);

      // 立即設置播放狀態
      playingVoiceMessageId.value = messageId;

      const token = await firebaseAuth.getCurrentUserIdToken();

      // 獲取 CSRF Token
      const getCsrfToken = (): string | null => {
        const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : null;
      };

      // 調用後端 TTS API（需要 CSRF Token）
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/ai/tts`,
        {
          method: 'POST',
          headers,
          credentials: 'include', // 包含 Cookie
          body: JSON.stringify({
            text: text.trim(),
            characterId: matchId,
            requestId,
            useVoiceUnlockCard: options.useVoiceUnlockCard || false,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json();
          if (errorData.limitExceeded) {
            playingVoiceMessageId.value = null;

            if (onLimitExceeded) {
              onLimitExceeded({
                characterName: partner.value?.display_name || '角色',
                usedVoices: errorData.used || 0,
                totalVoices: errorData.total || 10,
                dailyAdLimit: errorData.dailyAdLimit || 10,
                adsWatchedToday: errorData.adsWatchedToday || 0,
                voiceUnlockCards: errorData.voiceUnlockCards || 0,
              });
            }
            return false;
          }
        }

        playingVoiceMessageId.value = null;
        throw new Error('語音生成失敗');
      }

      // 播放前清理舊資源
      cleanupAudio();

      // 播放音頻
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      currentAudio.value = audio;
      currentAudioUrl.value = audioUrl;

      audio.onended = () => {
        playingVoiceMessageId.value = null;
        cleanupAudio();
      };

      audio.onerror = () => {
        playingVoiceMessageId.value = null;
        toast.error('語音播放失敗');
        cleanupAudio();
      };

      await audio.play();

      // 更新語音統計
      if (voiceLimitChecker?.loadVoiceStats) {
        await voiceLimitChecker.loadVoiceStats(userId);
      }

      return true;
    } catch (error) {
      playingVoiceMessageId.value = null;
      toast.error(error instanceof Error ? error.message : '語音播放失敗');
      return false;
    }
  };

  /**
   * 停止語音播放
   */
  const stopVoice = (): void => {
    playingVoiceMessageId.value = null;
    cleanupAudio();
  };

  return {
    // 拍照相關
    isRequestingSelfie,
    requestSelfie,

    // 禮物相關
    showGiftSelector,
    isSendingGift,
    openGiftSelector,
    closeGiftSelector,
    sendGift,

    // 語音相關
    playingVoiceMessageId,
    playVoice,
    stopVoice,
  };
}
