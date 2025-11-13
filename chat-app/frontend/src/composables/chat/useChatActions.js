/**
 * useChatActions.js
 * 管理聊天操作功能：拍照、禮物、語音播放
 */

import { ref, nextTick, onBeforeUnmount } from 'vue';
import { apiJson } from '../../utils/api';
import { writeCachedHistory } from '../../utils/conversationCache';
import { requestAiReply } from '../../utils/conversation';
import { getGiftById } from '../../config/gifts';
import { generateVoiceRequestId, generatePhotoRequestId, generateGiftRequestId } from '../../utils/requestId';
import { giftQueue } from '../../utils/requestQueue';

/**
 * 聊天操作 Composable
 * @param {Object} options - 配置選項
 * @param {Ref} options.messages - 消息列表
 * @param {Ref} options.partner - 聊天對象
 * @param {Ref} options.currentUserId - 當前用戶 ID
 * @param {Object} options.firebaseAuth - Firebase 認證物件
 * @param {Object} options.toast - Toast 通知 { success, error }
 * @param {Function} options.requireLogin - 遊客檢查函數
 * @param {Function} options.scrollToBottom - 滾動到底部函數
 * @param {Function} options.appendCachedHistory - 添加緩存歷史函數
 */
export function useChatActions({
  messages,
  partner,
  currentUserId,
  firebaseAuth,
  toast,
  requireLogin,
  scrollToBottom,
  appendCachedHistory,
}) {
  // ==================== 拍照功能 ====================

  const isRequestingSelfie = ref(false);

  /**
   * 請求自拍照片
   * @param {Object} photoLimitChecker - 拍照限制檢查器 { canGeneratePhoto, fetchPhotoStats }
   * @param {Function} onLimitExceeded - 限制超出回調 (limitInfo) => void
   * @param {Object} options - 選項 { usePhotoCard: boolean }
   * @returns {Promise<Object|null>} 生成的消息或 null
   */
  const requestSelfie = async (photoLimitChecker, onLimitExceeded, options = {}) => {
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
    const userId = currentUserId.value ?? '';

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
      const tempMessage = {
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

      const token = await firebaseAuth.getCurrentUserIdToken();

      // 調用後端 API（包含請求ID）
      // userId 現在從後端認證 token 自動獲取
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/ai/generate-selfie`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            characterId: matchId,
            requestId, // 包含請求ID
            usePhotoCard, // 告訴後端是否使用照片卡
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        // 移除臨時消息
        const tempIndex = messages.value.findIndex((m) => m.id === tempMessageId);
        if (tempIndex !== -1) {
          messages.value.splice(tempIndex, 1);
        }

        // 處理限制錯誤
        if (response.status === 403 && errorData.limitExceeded) {
          if (onLimitExceeded) {
            const limitInfo = errorData.limitInfo || {};
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

        throw new Error(errorData.message || '生成自拍失敗');
      }

      const data = await response.json();

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
        // 拍照成功不顯示 toast，只在失敗時顯示

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
   * @param {Function} loadUserAssets - 載入用戶資產函數
   */
  const openGiftSelector = async (loadUserAssets) => {
    // 檢查遊客
    if (requireLogin({ feature: '送禮物' })) {
      return;
    }

    const userId = currentUserId.value ?? '';
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
  const closeGiftSelector = () => {
    showGiftSelector.value = false;
  };

  /**
   * 發送禮物
   * @param {Object} giftData - 禮物資料 { giftId, gift, priceInfo }
   * @param {Function} onSuccess - 成功回調 (giftMessage, replyMessage) => void
   * @returns {Promise<boolean>} 是否成功
   */
  const sendGift = async (giftData, onSuccess) => {
    const matchId = partner.value?.id ?? '';
    const userId = currentUserId.value ?? '';

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
        // 發送禮物到後端（包含請求ID）
        // userId 現在從後端認證 token 自動獲取
        return await apiJson('/api/gifts/send', {
          method: 'POST',
          body: {
            characterId: matchId,
            giftId: giftData.giftId,
            requestId, // 包含請求ID
          },
          skipGlobalLoading: true,
        });
      });

      if (!sendResult || !sendResult.success) {
        throw new Error(sendResult?.message || '送出禮物失敗');
      }

      // 送禮成功不顯示 toast，只在失敗時顯示

      // 創建禮物消息（帶 emoji）
      const giftMessageId = `msg-gift-${Date.now()}`;
      const characterName = partner.value?.display_name || partner.value?.name || '對方';
      const giftMessage = {
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

      // 2. 生成禮物照片（帶 loading 狀態，參照自拍樣式）
      const tempPhotoId = `temp-photo-${Date.now()}`;
      const tempPhoto = {
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
        // 使用禮物回應 API（後端會直接保存感謝訊息和照片到對話歷史）
        // userId 現在從後端認證 token 自動獲取
        const giftResponse = await apiJson('/api/gifts/response', {
          method: 'POST',
          body: {
            characterData: {
              id: matchId,
              display_name: partner.value?.display_name || partner.value?.name,
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

        // 後端已經保存，直接添加到前端顯示（參照自拍邏輯）
        if (giftResponse?.success) {
          // 添加感謝訊息
          if (giftResponse.thankYouMessage) {
            messages.value.push(giftResponse.thankYouMessage);

            // 更新緩存
            if (appendCachedHistory) {
              appendCachedHistory([giftResponse.thankYouMessage]);
            }
          }

          // 添加照片訊息
          if (giftResponse.photoMessage) {
            messages.value.push(giftResponse.photoMessage);

            // 更新緩存
            if (appendCachedHistory) {
              appendCachedHistory([giftResponse.photoMessage]);
            }

            // 照片生成成功，調用成功回調
            if (onSuccess) {
              onSuccess(giftMessage, giftResponse.photoMessage);
            }
          } else {
            // 沒有照片，只有感謝訊息
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
        // 移除臨時照片消息
        const tempPhotoIndex = messages.value.findIndex((m) => m.id === tempPhotoId);
        if (tempPhotoIndex !== -1) {
          messages.value.splice(tempPhotoIndex, 1);
        }

        // 照片生成失敗，也調用成功回調（禮物本身已送出）
        if (onSuccess) {
          onSuccess(giftMessage, null);
        }
      }

      return true;
    } catch (error) {
      // 移除臨時消息
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

  const playingVoiceMessageId = ref(null);

  // ✅ 音頻元素引用，用於清理
  const currentAudio = ref(null);
  const currentAudioUrl = ref(null);

  /**
   * 清理音頻資源
   * 移除事件監聽器、停止播放、釋放 blob URL
   */
  const cleanupAudio = () => {
    if (currentAudio.value) {
      // 移除事件監聽器
      currentAudio.value.onended = null;
      currentAudio.value.onerror = null;

      // 停止播放
      try {
        currentAudio.value.pause();
        currentAudio.value.currentTime = 0;
      } catch (error) {
        // 忽略停止播放時的錯誤
      }

      currentAudio.value = null;
    }

    // 釋放 blob URL
    if (currentAudioUrl.value) {
      try {
        URL.revokeObjectURL(currentAudioUrl.value);
      } catch (error) {
        // 忽略 URL 釋放錯誤
      }
      currentAudioUrl.value = null;
    }
  };

  // ✅ 組件卸載時清理音頻資源，防止內存洩漏
  onBeforeUnmount(() => {
    cleanupAudio();
  });

  /**
   * 播放語音
   * @param {Object} message - 消息物件
   * @param {Object} voiceLimitChecker - 語音限制檢查器 { loadVoiceStats, checkVoiceLimit }
   * @param {Function} onLimitExceeded - 限制超出回調 (limitInfo) => void
   * @param {Function} getVoiceRemaining - 獲取剩餘次數函數
   * @param {Object} options - 播放選項 { useVoiceUnlockCard: boolean }
   * @returns {Promise<boolean>} 是否成功播放
   */
  const playVoice = async (message, voiceLimitChecker, onLimitExceeded, getVoiceRemaining, options = {}) => {
    // 檢查遊客
    if (requireLogin({ feature: '語音播放' })) {
      return false;
    }

    // 防止重複播放
    if (playingVoiceMessageId.value === message.id) {
      return false;
    }

    const text = message.text;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return false;
    }

    try {
      const matchId = partner.value?.id ?? '';
      const userId = currentUserId.value ?? '';

      if (!matchId || !userId) {
        toast.error('無法播放語音');
        return false;
      }

      // 如果使用解鎖卡，跳過限制檢查
      if (!options.useVoiceUnlockCard) {
        // 先檢查語音限制，避免發送無謂的 API 請求
        if (voiceLimitChecker?.checkVoiceLimit) {
          const limitCheck = await voiceLimitChecker.checkVoiceLimit(userId, matchId);
          if (!limitCheck.allowed) {
            // 限制超出，顯示彈窗
            if (onLimitExceeded) {
              onLimitExceeded({
                characterName: partner.value?.display_name || '角色',
                usedVoices: limitCheck.used || 0,
                totalVoices: limitCheck.total || 10,
                dailyAdLimit: limitCheck.dailyAdLimit || 10,
                adsWatchedToday: limitCheck.adsWatchedToday || 0,
                voiceUnlockCards: limitCheck.voiceUnlockCards || 0, // ✅ 添加語音解鎖卡數量
              });
            }
            return false;
          }
        }
      }

      // 生成請求ID（使用消息ID保證冪等性）
      const requestId = generateVoiceRequestId(userId, matchId, message.id);

      // 立即設置播放狀態，顯示動畫
      playingVoiceMessageId.value = message.id;

      const token = await firebaseAuth.getCurrentUserIdToken();

      // 調用後端 TTS API（包含請求ID和解鎖卡選項）
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/ai/tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: text.trim(),
            characterId: matchId,
            requestId, // 包含請求ID
            useVoiceUnlockCard: options.useVoiceUnlockCard || false, // ✅ 添加解鎖卡選項
          }),
        }
      );

      if (!response.ok) {
        // 處理限制錯誤
        if (response.status === 403) {
          const errorData = await response.json();
          if (errorData.limitExceeded) {
            // 清除播放狀態，停止動畫
            playingVoiceMessageId.value = null;

            if (onLimitExceeded) {
              onLimitExceeded({
                characterName: partner.value?.display_name || '角色',
                usedVoices: errorData.used || 0,
                totalVoices: errorData.total || 10,
                dailyAdLimit: errorData.dailyAdLimit || 10,
                adsWatchedToday: errorData.adsWatchedToday || 0,
                voiceUnlockCards: errorData.voiceUnlockCards || 0, // ✅ 添加語音解鎖卡數量
              });
            }
            return false;
          }
        }

        // 清除播放狀態
        playingVoiceMessageId.value = null;
        throw new Error('語音生成失敗');
      }

      // ✅ 播放音頻前先清理舊的音頻資源
      cleanupAudio();

      // 播放音頻
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // ✅ 存儲音頻引用和 URL，以便後續清理
      currentAudio.value = audio;
      currentAudioUrl.value = audioUrl;

      audio.onended = () => {
        playingVoiceMessageId.value = null;
        // ✅ 播放結束後清理資源
        cleanupAudio();
      };

      audio.onerror = () => {
        playingVoiceMessageId.value = null;
        toast.error('語音播放失敗');
        // ✅ 播放錯誤後清理資源
        cleanupAudio();
      };

      await audio.play();

      // 更新語音統計
      if (voiceLimitChecker?.loadVoiceStats) {
        await voiceLimitChecker.loadVoiceStats(userId);
      }

      // 語音播放成功不顯示 toast，只在失敗時顯示

      return true;
    } catch (error) {
      playingVoiceMessageId.value = null;
      toast.error(error instanceof Error ? error.message : '語音播放失敗');
      return false;
    }
  };

  /**
   * 停止語音播放
   * ✅ 修復：現在會真正停止音頻並清理資源
   */
  const stopVoice = () => {
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
