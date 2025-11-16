/**
 * useSuggestions.ts
 * 管理 AI 建議回覆功能（TypeScript 版本）
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { requestAiSuggestions } from '../../utils/conversation.js';
import { SUGGESTION_CONFIG } from '../../config/chat.js';
import type { Message, Partner, FirebaseAuthService } from '../../types';

// ✅ 使用集中化配置
const MAX_SUGGESTION_ITEMS = SUGGESTION_CONFIG.MAX_ITEMS;
const SUGGESTION_SIGNATURE_WINDOW = SUGGESTION_CONFIG.SIGNATURE_WINDOW;
const FALLBACK_SUGGESTIONS = SUGGESTION_CONFIG.FALLBACK_SUGGESTIONS;

/**
 * 建議回覆 Composable 返回類型
 */
export interface UseSuggestionsReturn {
  suggestionOptions: Ref<string[]>;
  isLoadingSuggestions: Ref<boolean>;
  suggestionError: Ref<string | null>;
  hasCachedSuggestions: ComputedRef<boolean>;
  loadSuggestions: () => Promise<void>;
  selectSuggestion: (suggestion: string) => string;
  invalidateSuggestions: () => void;
}

/**
 * 建議回覆 Composable
 * @param messages - 消息列表
 * @param partner - 聊天對象資料
 * @param firebaseAuth - Firebase 認證物件
 * @param currentUserId - 當前用戶 ID
 */
export function useSuggestions(
  messages: Ref<Message[]>,
  partner: Ref<Partner | null>,
  firebaseAuth: FirebaseAuthService,
  currentUserId: Ref<string> | ComputedRef<string>
): UseSuggestionsReturn {
  // 狀態
  const suggestionOptions = ref<string[]>([]);
  const isLoadingSuggestions: Ref<boolean> = ref(false);
  const suggestionError = ref<string | null>(null);
  const suggestionSignature = ref<string | null>(null);

  // 內部計數器用於取消過期請求
  let suggestionRequestId = 0;

  /**
   * 正規化建議項目
   */
  const normalizeSuggestionItems = (source: any[]): string[] => {
    if (!Array.isArray(source)) {
      return [];
    }

    const seen = new Set<string>();
    const results: string[] = [];

    for (const entry of source) {
      let text = '';

      if (typeof entry === 'string') {
        text = entry;
      } else if (entry && typeof entry === 'object') {
        // 嘗試多個可能的欄位名稱
        const candidates = ['text', 'message', 'content', 'value'];
        for (const key of candidates) {
          if (typeof entry[key] === 'string' && entry[key].trim().length) {
            text = entry[key];
            break;
          }
        }
      }

      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed.length || seen.has(trimmed)) {
        continue;
      }

      // 限制長度為 200 字
      const clamped = trimmed.slice(0, 200);
      if (!clamped.length) {
        continue;
      }

      seen.add(trimmed);
      results.push(clamped);

      if (results.length >= MAX_SUGGESTION_ITEMS) {
        break;
      }
    }

    return results;
  };

  /**
   * 建立建議簽名（用於快取識別）
   */
  const createSuggestionSignature = (): string => {
    const recent = messages.value
      .slice(-SUGGESTION_SIGNATURE_WINDOW)
      .map((item) => {
        const id = typeof item.id === 'string' ? item.id : '';
        const role = item.role === 'user' ? 'u' : 'p';
        const text = typeof item.text === 'string' ? item.text.slice(0, 80) : '';
        return `${id}|${role}|${text}`;
      })
      .join('||');

    const matchId = partner.value?.id ?? '';
    return `${matchId}::${messages.value.length}::${recent}`;
  };

  /**
   * 完成建議狀態更新
   */
  const finalizeSuggestionState = (
    requestId: number,
    options: string[],
    message: string | null,
    signature: string,
    persistSignature = true
  ): void => {
    // 檢查是否為最新請求
    if (suggestionRequestId !== requestId) {
      return;
    }

    suggestionOptions.value = Array.isArray(options) ? options : [];
    suggestionError.value =
      typeof message === 'string' && message.trim().length ? message.trim() : null;
    isLoadingSuggestions.value = false;

    if (persistSignature && typeof signature === 'string') {
      suggestionSignature.value = signature;
    }
  };

  /**
   * 清除建議狀態
   */
  const invalidateSuggestions = (): void => {
    suggestionRequestId += 1;
    isLoadingSuggestions.value = false;
    suggestionOptions.value = [];
    suggestionError.value = null;
    suggestionSignature.value = null;
  };

  /**
   * 載入建議選項
   */
  const loadSuggestions = async (): Promise<void> => {
    const signature = createSuggestionSignature();

    // 如果簽名相同且已有建議，直接返回
    if (suggestionSignature.value === signature && suggestionOptions.value.length) {
      isLoadingSuggestions.value = false;
      return;
    }

    const requestId = ++suggestionRequestId;
    isLoadingSuggestions.value = true;
    suggestionError.value = null;

    const fallback = [...FALLBACK_SUGGESTIONS];
    const matchId = partner.value?.id ?? '';
    const userId = currentUserId.value ?? '';

    // 驗證基本條件
    if (!matchId) {
      finalizeSuggestionState(
        requestId,
        fallback,
        '目前尚未選擇聊天對象，已提供預設選項。',
        signature
      );
      return;
    }

    if (!userId) {
      finalizeSuggestionState(
        requestId,
        fallback,
        '請登入後才能取得智慧建議。',
        signature
      );
      return;
    }

    try {
      const token = await firebaseAuth.getCurrentUserIdToken();
      const response = await requestAiSuggestions(userId, matchId, {
        token,
        count: MAX_SUGGESTION_ITEMS,
      });

      const normalized = normalizeSuggestionItems(response?.suggestions ?? []);
      const message =
        response?.fallback && typeof response?.message === 'string'
          ? response.message
          : null;

      if (normalized.length) {
        finalizeSuggestionState(requestId, normalized, message, signature);
        return;
      }

      finalizeSuggestionState(
        requestId,
        fallback,
        message ?? '暫時沒有合適的建議，已提供預設選項。',
        signature
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : '生成建議回覆時發生錯誤，已提供預設選項。';
      finalizeSuggestionState(requestId, fallback, message, signature);
    }
  };

  /**
   * 選擇建議（供父組件使用）
   */
  const selectSuggestion = (suggestion: string): string => {
    return suggestion;
  };

  /**
   * 是否有建議快取
   */
  const hasCachedSuggestions = computed<boolean>(() => {
    return suggestionOptions.value.length > 0;
  });

  return {
    // 狀態
    suggestionOptions,
    isLoadingSuggestions,
    suggestionError,
    hasCachedSuggestions,

    // 方法
    loadSuggestions,
    selectSuggestion,
    invalidateSuggestions,
  };
}
