/**
 * 影片生成 Composable
 *
 * 管理 AI 角色影片的生成邏輯，包括：
 * - 影片生成核心邏輯
 * - 權限檢查和限制處理
 * - 消息發送和錯誤處理
 */

import { ref, nextTick } from 'vue';
import { apiJson } from '../../utils/api';
import { writeCachedHistory } from '../../utils/conversationCache';

/**
 * 創建影片生成 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.getPartnerId - 獲取角色 ID
 * @param {Function} deps.getFirebaseAuth - 獲取 Firebase Auth 實例
 * @param {Object} deps.messages - 消息列表 ref
 * @param {Object} deps.messageListRef - 消息列表組件 ref
 * @param {Function} deps.rollbackUserMessage - 撤回用戶消息的方法
 * @param {Function} deps.requireLogin - 遊客登錄檢查
 * @param {Function} deps.showVideoLimit - 顯示影片限制彈窗
 * @param {Function} deps.showPhotoSelector - 顯示照片選擇器
 * @param {Function} deps.createLimitModalData - 創建限制彈窗數據
 * @param {Function} deps.showError - 顯示錯誤提示
 * @param {Function} deps.showSuccess - 顯示成功提示
 * @param {Object} deps.config - 配置
 * @param {Object} deps.config.MESSAGE_ID_PREFIXES - 消息 ID 前綴
 * @param {Object} deps.config.VIDEO_CONFIG - 影片配置
 * @param {string} deps.config.AI_VIDEO_RESPONSE_TEXT - AI 影片回覆文字
 * @param {Array} deps.config.VIDEO_REQUEST_MESSAGES - 影片請求消息列表
 * @returns {Object} 影片生成相關的狀態和方法
 */
export function useVideoGeneration(deps) {
  const {
    getCurrentUserId,
    getPartnerId,
    getFirebaseAuth,
    messages,
    messageListRef,
    rollbackUserMessage,
    requireLogin,
    showVideoLimit,
    showPhotoSelector,
    createLimitModalData,
    showError,
    showSuccess,
    config,
  } = deps;

  const {
    MESSAGE_ID_PREFIXES,
    VIDEO_CONFIG,
    AI_VIDEO_RESPONSE_TEXT,
    VIDEO_REQUEST_MESSAGES,
  } = config;

  // ==========================================
  // 狀態
  // ==========================================
  const isRequestingVideo = ref(false);

  // ==========================================
  // 輔助方法
  // ==========================================

  /**
   * 獲取隨機的影片請求消息
   * @returns {string} 隨機消息
   */
  const getRandomVideoRequestMessage = () => {
    return VIDEO_REQUEST_MESSAGES[
      Math.floor(Math.random() * VIDEO_REQUEST_MESSAGES.length)
    ];
  };

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 生成影片的核心邏輯
   * @param {Object} options - 選項
   * @param {boolean} options.useVideoCard - 是否使用影片卡
   * @param {string} options.imageUrl - 自定義圖片 URL
   * @returns {Promise<void>}
   */
  const generateVideo = async (options = {}) => {
    const { useVideoCard = false, imageUrl = null } = options;
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    isRequestingVideo.value = true;

    // 用於追蹤用戶消息 ID，以便失敗時撤回
    let userMessageId = null;

    try {
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();

      // 1. 先發送一條隨機的影片請求訊息
      const randomMessage = getRandomVideoRequestMessage();

      // 創建用戶消息
      const userMessage = {
        id: `${MESSAGE_ID_PREFIXES.VIDEO_REQUEST}${Date.now()}`,
        role: 'user',
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
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          id: userMessage.id, // ✅ 傳遞消息 ID，確保前後端一致
          text: randomMessage,
          role: 'user',
        },
        skipGlobalLoading: true,
      });

      // 更新緩存
      writeCachedHistory(userId, matchId, messages.value);

      // 2. 創建臨時影片消息顯示 loading
      const tempVideoMessageId = `temp-video-${Date.now()}`;
      const tempVideoMessage = {
        id: tempVideoMessageId,
        role: 'ai',
        text: '',
        video: 'loading', // ⭐ 關鍵：設為 'loading'
        createdAt: new Date().toISOString(),
        state: 'pending',
      };

      messages.value.push(tempVideoMessage);
      await nextTick();
      messageListRef.value?.scrollToBottom();

      // 3. 生成影片
      showSuccess('角色正在錄製影片給你，稍等一下下哦～');

      const videoResult = await apiJson(`/api/ai/generate-video`, {
        method: 'POST',
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
        throw new Error('影片生成失敗：未返回有效的影片 URL');
      }

      // 4. 創建包含影片的 AI 消息
      const aiVideoMessage = {
        id: `${MESSAGE_ID_PREFIXES.VIDEO_AI}${Date.now()}`,
        role: 'ai',
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
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: {
            id: aiVideoMessage.id, // ✅ 傳遞消息 ID
            text: aiVideoMessage.text,
            role: 'ai',
            video: aiVideoMessage.video,
          },
          skipGlobalLoading: true,
        });

        // 更新緩存
        writeCachedHistory(userId, matchId, messages.value);

        // 滾動到底部
        await nextTick();
        messageListRef.value?.scrollToBottom();

        showSuccess('影片錄好了！快來看看吧 ✨');
      } catch (saveError) {
        // ✅ 保存 AI 訊息失敗，撤回前端的 AI 訊息
        const aiMsgIndex = messages.value.findIndex((m) => m.id === aiMessageId);
        if (aiMsgIndex !== -1) {
          messages.value.splice(aiMsgIndex, 1);
        }

        // 重新拋出錯誤，進入外層 catch 處理
        throw new Error('保存影片訊息失敗');
      }
    } catch (error) {
      // 移除臨時影片消息
      const tempIndex = messages.value.findIndex((m) => m.video === 'loading');
      if (tempIndex !== -1) {
        messages.value.splice(tempIndex, 1);
      }

      showError(error instanceof Error ? error.message : '生成影片失敗');

      // 撤回用戶剛發送的訊息
      if (userMessageId) {
        await rollbackUserMessage(userId, matchId, userMessageId);
      }
    } finally {
      isRequestingVideo.value = false;
    }
  };

  /**
   * 處理影片請求（入口函數）
   * @returns {Promise<void>}
   */
  const handleRequestVideo = async () => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    // 檢查遊客權限
    if (requireLogin({ feature: '生成影片' })) {
      return;
    }

    // 防止重複請求
    if (isRequestingVideo.value) {
      showError('影片生成中，請稍候...');
      return;
    }

    try {
      // 獲取認證權杖
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();

      // 先檢查影片生成權限
      const limitCheck = await apiJson(`/api/ai/video/check/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        skipGlobalLoading: true,
      });

      // 如果免費額度用完，顯示彈窗讓用戶決定是否使用解鎖卡
      if (!limitCheck.allowed) {
        showVideoLimit(createLimitModalData(limitCheck, 'video'));
        return;
      }

      // ✅ 權限檢查通過，顯示照片選擇器
      showPhotoSelector();
    } catch (error) {
      showError(error instanceof Error ? error.message : '檢查影片權限失敗');
    }
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 狀態
    isRequestingVideo,

    // 方法
    generateVideo,
    handleRequestVideo,
  };
}
