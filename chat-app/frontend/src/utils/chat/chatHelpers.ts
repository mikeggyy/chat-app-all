/**
 * Chat 相關的輔助函數
 * 從 ChatView.vue 提取，便於測試和重用
 */

import { apiJson } from '../api.js';
import { writeCachedHistory } from '../conversationCache.js';
import type { Ref } from 'vue';

/**
 * 訊息介面
 */
interface Message {
  id: string;
  [key: string]: unknown;
}

/**
 * Firebase Auth 介面
 */
interface FirebaseAuth {
  getCurrentUserIdToken: () => Promise<string>;
}

/**
 * 撤回訊息參數介面
 */
interface RollbackUserMessageParams {
  userId: string;
  matchId: string;
  messageId: string;
  firebaseAuth: FirebaseAuth;
  messages: Ref<Message[]>;
  showError: (message: string) => void;
}

/**
 * 限制檢查結果介面
 */
interface LimitCheck {
  used?: number;
  remaining?: number;
  total?: number;
  standardPhotosLimit?: number;
  standardVideosLimit?: number;
  isTestAccount?: boolean;
  photoCards?: number;
  videoCards?: number;
  tier?: string;
  resetPeriod?: string;
}

/**
 * 限制 Modal 數據介面
 */
interface LimitModalData {
  used: number;
  remaining: number;
  total: number;
  standardTotal: number | null;
  isTestAccount: boolean;
  cards: number;
  tier: string;
  resetPeriod: string;
}

/**
 * 對話上下文參數介面
 */
interface ConversationContextParams {
  matchId: string | undefined;
  currentUserId: string | undefined;
}

/**
 * 對話上下文介面
 */
interface ConversationContext {
  matchId: string;
  currentUserId: string;
}

/**
 * 撤回用戶消息（從後端和前端同時刪除）
 * @param params - 參數對象
 * @returns - 是否成功撤回
 */
export const rollbackUserMessage = async ({
  userId,
  matchId,
  messageId,
  firebaseAuth,
  messages,
  showError,
}: RollbackUserMessageParams): Promise<boolean> => {
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
 * @param limitCheck - 限制檢查結果
 * @param type - 限制類型 ('photo' 或 'video')
 * @returns Modal 數據對象
 */
export const createLimitModalData = (
  limitCheck: LimitCheck,
  type: 'photo' | 'video' = "photo"
): LimitModalData => {
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1) as 'Photo' | 'Video';
  return {
    used: limitCheck.used || 0,
    remaining: limitCheck.remaining || 0,
    total: limitCheck.total || 0,
    standardTotal: limitCheck[`standard${capitalizedType}sLimit` as keyof LimitCheck] as number | null || null,
    isTestAccount: limitCheck.isTestAccount || false,
    cards: limitCheck[`${type}Cards` as keyof LimitCheck] as number || 0,
    tier: limitCheck.tier || "free",
    resetPeriod: limitCheck.resetPeriod || "lifetime",
  };
};

/**
 * 獲取對話上下文
 * @param params - 參數對象
 * @returns 對話上下文對象
 */
export const getConversationContext = ({
  matchId,
  currentUserId,
}: ConversationContextParams): ConversationContext => {
  return {
    matchId: matchId ?? "",
    currentUserId: currentUserId ?? "",
  };
};
