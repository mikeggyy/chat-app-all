/**
 * useVideoGeneration.ts
 * 影片生成 Composable（TypeScript 版本）
 * 管理 AI 角色影片的生成邏輯
 */

import { ref, nextTick, type Ref } from 'vue';
import { apiJson } from '../../utils/api.js';
import { writeCachedHistory } from '../../utils/conversationCache.js';
import { logger } from '../../utils/logger.js';
import type { Message, FirebaseAuthService } from '../../types';

// ==================== 類型定義 ====================

/**
 * 影片配置
 */
export interface VideoConfig {
  DURATION: number;
  RESOLUTION: string;
  ASPECT_RATIO: string;
}

/**
 * 消息 ID 前綴配置
 */
export interface MessageIdPrefixes {
  VIDEO_REQUEST: string;
  VIDEO_AI: string;
  [key: string]: string;
}

/**
 * 影片生成配置
 */
export interface VideoGenerationConfig {
  MESSAGE_ID_PREFIXES: MessageIdPrefixes;
  VIDEO_CONFIG: VideoConfig;
  AI_VIDEO_RESPONSE_TEXT: string;
  VIDEO_REQUEST_MESSAGES: string[];
}

/**
 * 影片限制檢查結果
 */
export interface VideoLimitCheckResult {
  allowed: boolean;
  remaining?: number;
  cards?: number;
  reason?: string;
  [key: string]: any;
}

/**
 * 生成影片選項
 */
export interface GenerateVideoOptions {
  useVideoCard?: boolean;
  imageUrl?: string | null;
}

/**
 * 影片 API 回應格式
 * API 可能返回直接的 { videoUrl } 或包裝的 { data: { videoUrl } }
 */
interface VideoApiResponse {
  videoUrl?: string;
  duration?: string;
  resolution?: string;
  data?: {
    videoUrl?: string;
    duration?: string;
    resolution?: string;
    [key: string]: any;
  };
}

/**
 * useVideoGeneration 依賴項
 */
export interface UseVideoGenerationDeps {
  getCurrentUserId: () => string;
  getPartnerId: () => string;
  getFirebaseAuth: () => FirebaseAuthService;
  messages: Ref<Message[]>;
  messageListRef: Ref<{ scrollToBottom: () => void } | null>;
  rollbackUserMessage: (userId: string, characterId: string, messageId: string) => Promise<void>;
  requireLogin: (options: { feature: string }) => boolean;
  showVideoLimit: (limitInfo: any) => void;
  showPhotoSelector: () => void;
  createLimitModalData: (limitCheck: VideoLimitCheckResult, type: string) => any;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  onVideoCompleted?: (videoMessageId: string) => void; // 影片生成完成回調
  onVideoFailed?: (characterId: string, characterName: string, reason?: string) => void; // ✅ 影片生成失敗回調
  getPartnerName?: () => string; // ✅ 獲取角色名稱
  config: VideoGenerationConfig;
}

/**
 * useVideoGeneration 返回類型
 */
export interface UseVideoGenerationReturn {
  isRequestingVideo: Ref<boolean>;
  generateVideo: (options?: GenerateVideoOptions) => Promise<void>;
  handleRequestVideo: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 創建影片生成 composable
 * @param deps - 依賴項
 * @returns 影片生成相關的狀態和方法
 */
export function useVideoGeneration(deps: UseVideoGenerationDeps): UseVideoGenerationReturn {
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

  // ====================
  // 狀態
  // ====================
  const isRequestingVideo: Ref<boolean> = ref(false);
  const VIDEO_GENERATION_TIMEOUT_MS = 5 * 60 * 1000; // ✅ 增加到 5 分鐘（Hailuo 02 可能需要更長時間）

  // ====================
  // 輔助方法
  // ====================

  /**
   * 獲取隨機的影片請求消息
   */
  const getRandomVideoRequestMessage = (): string => {
    return VIDEO_REQUEST_MESSAGES[
      Math.floor(Math.random() * VIDEO_REQUEST_MESSAGES.length)
    ];
  };

  // ====================
  // 核心方法
  // ====================

  /**
   * 生成影片的核心邏輯
   * @param options - 選項
   */
  const generateVideo = async (options: GenerateVideoOptions = {}): Promise<void> => {
    let { useVideoCard = false, imageUrl = null } = options;
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    if (isRequestingVideo.value) {
      logger.warn('[VideoGeneration] 已有影片請求進行中，忽略新的請求', {
        matchId,
        pending: true,
      });
      showError('影片生成中，請稍候...');
      return;
    }

    isRequestingVideo.value = true;
    logger.log('[VideoGeneration] 開始生成影片', {
      matchId,
      initialUseVideoCard: useVideoCard,
      imageUrl,
    });

    // 用於追蹤用戶消息 ID，以便失敗時撤回
    let userMessageId: string | undefined = undefined;

    try {
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();

      // ✅ 關鍵修復：檢查權限並自動決定是否使用影片卡
      const limitCheckResponse: any = await apiJson(`/api/ai/video/check/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        skipGlobalLoading: true,
      });
      const limitCheck: VideoLimitCheckResult = limitCheckResponse.data || limitCheckResponse;
      logger.debug('[VideoGeneration] Limit check result', {
        allowed: limitCheck.allowed,
        videoCards: limitCheck.videoCards,
        remaining: limitCheck.remaining,
      });

      // 如果沒有基礎額度但有影片卡，自動使用影片卡
      if (!limitCheck.allowed && limitCheck.videoCards > 0) {
        useVideoCard = true;
      }

      // 1. 先發送一條隨機的影片請求訊息
      const randomMessage = getRandomVideoRequestMessage();

      // 創建用戶消息
      const userMessage: Message = {
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
      const tempVideoMessage: Message = {
        id: tempVideoMessageId,
        role: 'ai',
        text: '',
        video: 'loading', // ⭐ 關鍵：設為 'loading'
        createdAt: new Date().toISOString(),
        state: 'pending',
      } as Message;

      messages.value.push(tempVideoMessage);
      await nextTick();
      messageListRef.value?.scrollToBottom();

      // 3. 生成影片
      showSuccess('角色正在錄製影片給你，稍等一下下哦～');
      logger.log('[VideoGeneration] 已送出影片請求訊息並建立 loading 卡', {
        requestMessageId: userMessage.id,
        matchId,
      });

      const requestId = userMessage.id;

      // ✅ 將相對路徑轉換為完整 URL（供後端 API 使用）
      let fullImageUrl = imageUrl;
      if (imageUrl && imageUrl.startsWith('/')) {
        // 相對路徑，轉換為完整 URL
        fullImageUrl = `${window.location.origin}${imageUrl}`;
        logger.log('[VideoGeneration] 轉換相對路徑為完整 URL', {
          originalUrl: imageUrl,
          fullUrl: fullImageUrl,
        });
      }

      const requestBody = {
        characterId: matchId,
        requestId,
        duration: VIDEO_CONFIG.DURATION,
        resolution: VIDEO_CONFIG.RESOLUTION,
        aspectRatio: VIDEO_CONFIG.ASPECT_RATIO,
        useVideoCard,
        imageUrl: fullImageUrl,
      };

      logger.log('[VideoGeneration] 發送影片生成 API 請求', {
        requestBody,
        timeoutMs: VIDEO_GENERATION_TIMEOUT_MS,
      });

      const videoResult = await apiJson(`/api/ai/generate-video`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: requestBody,
        timeoutMs: VIDEO_GENERATION_TIMEOUT_MS,
        skipGlobalLoading: true, // ✅ 允許用戶繼續聊天
      });

      const typedVideoResult = videoResult as VideoApiResponse | null;
      const normalizedResult =
        typedVideoResult && typeof typedVideoResult === 'object' && 'videoUrl' in typedVideoResult
          ? typedVideoResult
          : typedVideoResult?.data || null;

      logger.log('[VideoGeneration] 影片 API 回應', {
        requestId,
        hasData: Boolean(normalizedResult),
        normalizedResult,
        videoUrl: normalizedResult?.videoUrl,
      });

      if (!normalizedResult || !normalizedResult.videoUrl) {
        // 移除臨時消息
        const tempIndex = messages.value.findIndex((m) => m.id === tempVideoMessageId);
        if (tempIndex !== -1) {
          messages.value.splice(tempIndex, 1);
        }

        // ✅ 更新緩存（確保刷新頁面後訊息不會再出現）
        writeCachedHistory(userId, matchId, messages.value);

        throw new Error('影片生成失敗：未返回有效的影片 URL');
      }

      // 4. 創建包含影片的 AI 消息
      const aiVideoMessage: Message = {
        id: `${MESSAGE_ID_PREFIXES.VIDEO_AI}${Date.now()}`,
        role: 'ai',
        text: AI_VIDEO_RESPONSE_TEXT,
        createdAt: new Date().toISOString(),
        video: {
          url: normalizedResult.videoUrl,
          duration: normalizedResult.duration,
          resolution: normalizedResult.resolution,
        },
      };

      // 用於追蹤 AI 消息 ID，以便失敗時撤回
      const aiMessageId = aiVideoMessage.id;

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

        // ✅ 觸發影片完成通知（不使用 toast）
        if (deps.onVideoCompleted && aiVideoMessage.id) {
          deps.onVideoCompleted(aiVideoMessage.id);
        }

        logger.log('[VideoGeneration] 影片訊息已顯示於聊天室', {
          messageId: aiVideoMessage.id,
          matchId,
        });
      } catch (saveError) {
        // ✅ 保存 AI 訊息失敗，撤回前端的 AI 訊息
        const aiMsgIndex = messages.value.findIndex((m) => m.id === aiMessageId);
        if (aiMsgIndex !== -1) {
          messages.value.splice(aiMsgIndex, 1);
        }

        // 重新拋出錯誤，進入外層 catch 處理
        logger.error('[VideoGeneration] 保存影片訊息失敗', saveError);
        throw new Error('保存影片訊息失敗');
      }
    } catch (error: any) {
      // 移除臨時影片消息
      const tempIndex = messages.value.findIndex((m) => m.video === 'loading');
      if (tempIndex !== -1) {
        messages.value.splice(tempIndex, 1);
      }

      // ✅ 更新緩存（確保刷新頁面後訊息不會再出現）
      writeCachedHistory(userId, matchId, messages.value);

      logger.error('[VideoGeneration] 影片生成流程失敗', error);
      const errorMessage = error instanceof Error ? error.message : '生成影片失敗';
      showError(errorMessage);

      // ✅ 觸發影片生成失敗回調（記錄失敗信息）
      if (deps.onVideoFailed) {
        const characterName = deps.getPartnerName ? deps.getPartnerName() : '角色';
        deps.onVideoFailed(matchId, characterName, errorMessage);
      }

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
   */
  const handleRequestVideo = async (): Promise<void> => {
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
      const response: any = await apiJson(`/api/ai/video/check/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        skipGlobalLoading: true,
      });

      // ✅ 解包 sendSuccess 的響應格式 { success: true, data: {...} }
      const limitCheck: VideoLimitCheckResult = response.data || response;
      const videoCards = limitCheck.videoCards || limitCheck.videoUnlockCards || limitCheck.cards || 0;

      // ✅ 2025-11-25 修復：如果有影片卡，顯示彈窗讓用戶選擇是否使用影片卡
      // 無論是否有免費額度，都應該顯示彈窗讓用戶知道可以使用影片卡
      if (videoCards > 0) {
        const modalData = {
          ...createLimitModalData(limitCheck, 'video'),
          videoUnlockCards: videoCards,
          // 讓彈窗知道用戶還有免費額度可用
          allowed: limitCheck.allowed,
          remaining: limitCheck.remaining,
        };
        showVideoLimit(modalData);
        return;
      }

      // 如果免費額度用完且沒有卡片，顯示彈窗
      if (!limitCheck.allowed) {
        const modalData = {
          ...createLimitModalData(limitCheck, 'video'),
          videoUnlockCards: 0,
        };
        showVideoLimit(modalData);
        return;
      }

      // ✅ 權限檢查通過且沒有影片卡，直接顯示照片選擇器
      showPhotoSelector();
    } catch (error: any) {
      showError(error instanceof Error ? error.message : '檢查影片權限失敗');
    }
  };

  // ====================
  // 返回 API
  // ====================
  return {
    // 狀態
    isRequestingVideo,

    // 方法
    generateVideo,
    handleRequestVideo,
  };
}
