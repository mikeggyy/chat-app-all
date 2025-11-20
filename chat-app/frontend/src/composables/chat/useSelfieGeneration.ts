/**
 * useSelfieGeneration.ts
 * Selfie 生成 Composable（TypeScript 版本）
 * 管理 AI 角色自拍照片的生成邏輯
 */

import { nextTick, type Ref } from 'vue';
import { apiJson } from '../../utils/api.js';
import { getRandomSelfieMessage } from '../../config/selfieMessages.js';
import { writeCachedHistory } from '../../utils/conversationCache.js';
import type { Message, FirebaseAuthService } from '../../types';

// ==================== 類型定義 ====================

/**
 * 照片限制檢查結果
 */
export interface PhotoLimitCheckResult {
  allowed: boolean;
  remaining?: number;
  cards?: number;
  reason?: string;
  [key: string]: any;
}

/**
 * 照片限制檢查器
 */
export interface PhotoLimitChecker {
  canGeneratePhoto: () => Promise<PhotoLimitCheckResult>;
  fetchPhotoStats: () => Promise<void>;
}

/**
 * 請求自拍選項
 */
export interface RequestSelfieOptions {
  usePhotoCard?: boolean;
}

/**
 * 消息 ID 前綴配置
 */
export interface MessageIdPrefixes {
  SELFIE_REQUEST: string;
  [key: string]: string;
}

/**
 * 配置對象
 */
export interface SelfieGenerationConfig {
  MESSAGE_ID_PREFIXES: MessageIdPrefixes;
}

/**
 * useSelfieGeneration 依賴項
 */
export interface UseSelfieGenerationDeps {
  getCurrentUserId: () => string;
  getPartnerId: () => string;
  getFirebaseAuth: () => FirebaseAuthService;
  messages: Ref<Message[]>;
  messageListRef: Ref<{ scrollToBottom: () => void } | null>;
  rollbackUserMessage: (userId: string, characterId: string, messageId: string) => Promise<void>;
  requireLogin: (options: { feature: string }) => boolean;
  canGeneratePhoto: () => Promise<PhotoLimitCheckResult>;
  fetchPhotoStats: () => Promise<void>;
  showPhotoLimit: (limitInfo: any) => void;
  createLimitModalData: (limitCheck: PhotoLimitCheckResult, type: string) => any;
  requestSelfie: (
    checker: PhotoLimitChecker,
    onLimitExceeded?: (info: any) => void,
    options?: RequestSelfieOptions
  ) => Promise<any>;
  closePhotoLimit: () => void;
  loadTicketsBalance: (userId: string) => Promise<void>;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  onPhotoFailed?: (characterId: string, characterName: string, reason?: string) => void; // ✅ 照片生成失敗回調
  getPartnerName?: () => string; // ✅ 獲取角色名稱
  config: SelfieGenerationConfig;
}

/**
 * useSelfieGeneration 返回類型
 */
export interface UseSelfieGenerationReturn {
  handleRequestSelfie: () => Promise<void>;
  handleUsePhotoUnlockCard: () => Promise<void>;
}

// ==================== Composable 主函數 ====================

/**
 * 創建 Selfie 生成 composable
 * @param deps - 依賴項
 * @returns Selfie 生成相關的狀態和方法
 */
export function useSelfieGeneration(deps: UseSelfieGenerationDeps): UseSelfieGenerationReturn {
  const {
    getCurrentUserId,
    getPartnerId,
    getFirebaseAuth,
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
    showSuccess,
    config,
  } = deps;

  const { MESSAGE_ID_PREFIXES } = config;

  // ====================
  // 核心方法
  // ====================

  /**
   * 處理自拍請求（入口函數）
   */
  const handleRequestSelfie = async (): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    // 檢查遊客權限
    if (requireLogin({ feature: '請求自拍照片' })) {
      return;
    }

    // 先檢查拍照限制
    const limitCheck = await canGeneratePhoto();

    // ✅ 當免費額度用完時，顯示彈窗讓用戶決定是否使用解鎖卡
    // 彈窗會根據 cards 數量顯示不同按鈕：
    // - cards > 0: 顯示「使用解鎖卡」按鈕
    // - cards = 0: 顯示「次數已達上限」及升級選項
    if (!limitCheck.allowed) {
      showPhotoLimit(createLimitModalData(limitCheck, 'photo'));
      return;
    }

    // 用於追蹤用戶消息 ID，以便失敗時撤回
    let userMessageId: string | undefined = undefined;

    try {
      // 1. 有免費額度時，發送一條隨機的拍照請求訊息
      const randomMessage = getRandomSelfieMessage();

      // 創建用戶消息
      const userMessage: Message = {
        id: `${MESSAGE_ID_PREFIXES.SELFIE_REQUEST}${Date.now()}`,
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

      // 獲取認證權杖
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();

      // 發送到後端（只保存訊息，不請求 AI 回覆）
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

      // 2. 調用拍照功能
      const photoResult = await requestSelfie(
        { canGeneratePhoto, fetchPhotoStats },
        (limitInfo) => {
          // On limit exceeded
          showPhotoLimit(limitInfo);
        },
        { usePhotoCard: false } // ✅ 此處使用免費額度
      );

      // 如果拍照失敗（返回 null），撤回用戶訊息
      if (!photoResult && userMessageId) {
        await rollbackUserMessage(userId, matchId, userMessageId);

        // ✅ 觸發照片生成失敗回調（記錄失敗信息）
        if (deps.onPhotoFailed) {
          const characterName = deps.getPartnerName ? deps.getPartnerName() : '角色';
          deps.onPhotoFailed(matchId, characterName, '照片生成失敗');
        }
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : '請求自拍失敗';
      showError(errorMessage);

      // ✅ 觸發照片生成失敗回調（記錄失敗信息）
      if (deps.onPhotoFailed) {
        const characterName = deps.getPartnerName ? deps.getPartnerName() : '角色';
        deps.onPhotoFailed(matchId, characterName, errorMessage);
      }

      // 撤回用戶剛發送的訊息
      if (userMessageId) {
        await rollbackUserMessage(userId, matchId, userMessageId);
      }
    }
  };

  /**
   * 使用照片卡生成照片
   */
  const handleUsePhotoUnlockCard = async (): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    // 用於追蹤用戶消息 ID，以便失敗時撤回
    let userMessageId: string | undefined = undefined;

    try {
      // 關閉模態框
      closePhotoLimit();

      // 1. 先發送一條隨機的拍照請求訊息
      const randomMessage = getRandomSelfieMessage();

      // 創建用戶消息
      const userMessage: Message = {
        id: `${MESSAGE_ID_PREFIXES.SELFIE_REQUEST}${Date.now()}`,
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

      // 獲取認證權杖
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();

      // 發送到後端（只保存訊息，不請求 AI 回覆）
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

      // 2. 使用照片卡生成照片
      const result = await requestSelfie(
        { canGeneratePhoto, fetchPhotoStats },
        (limitInfo) => {
          void limitInfo; // 參數保留供未來使用
          // 如果仍然失敗（例如沒有解鎖卡），顯示錯誤
          showError('使用拍照解鎖卡失敗，請重試');
        },
        { usePhotoCard: true } // 告訴 requestSelfie 使用照片卡
      );

      // 如果照片生成失敗，撤回用戶訊息
      if (!result && userMessageId) {
        await rollbackUserMessage(userId, matchId, userMessageId);

        // ✅ 觸發照片生成失敗回調（記錄失敗信息）
        if (deps.onPhotoFailed) {
          const characterName = deps.getPartnerName ? deps.getPartnerName() : '角色';
          deps.onPhotoFailed(matchId, characterName, '使用照片卡失敗');
        }
        return;
      }

      // 成功後重新加載解鎖卡數據
      if (result && userId) {
        await Promise.all([fetchPhotoStats(), loadTicketsBalance(userId)]);

        showSuccess('拍照解鎖卡使用成功！');
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : '使用照片卡失敗';
      showError(errorMessage);

      // ✅ 觸發照片生成失敗回調（記錄失敗信息）
      if (deps.onPhotoFailed) {
        const characterName = deps.getPartnerName ? deps.getPartnerName() : '角色';
        deps.onPhotoFailed(matchId, characterName, errorMessage);
      }

      // 撤回用戶剛發送的訊息
      if (userMessageId) {
        await rollbackUserMessage(userId, matchId, userMessageId);
      }
    }
  };

  // ====================
  // 返回 API
  // ====================
  return {
    // 方法
    handleRequestSelfie,
    handleUsePhotoUnlockCard,
  };
}
