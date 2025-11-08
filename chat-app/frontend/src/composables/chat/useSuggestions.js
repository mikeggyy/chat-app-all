/**
 * useSuggestions.js
 * 管理 AI 建議回覆功能
 */

import { ref, computed } from 'vue';
import { requestAiSuggestions } from '../../utils/conversation';

// 常量配置
const MAX_SUGGESTION_ITEMS = 3;
const SUGGESTION_SIGNATURE_WINDOW = 6;

const FALLBACK_SUGGESTIONS = [
  '可以多分享你的感受嗎？',
  '最近有發生什麼讓你印象深刻的事嗎？',
  '我很好奇你的想法，再聊聊吧！',
];

/**
 * 建議回覆 Composable
 * @param {Ref} messages - 消息列表
 * @param {Ref} partner - 聊天對象資料
 * @param {Object} firebaseAuth - Firebase 認證物件
 * @param {Ref} currentUserId - 當前用戶 ID
 */
export function useSuggestions(messages, partner, firebaseAuth, currentUserId) {
  // 狀態
  const suggestionOptions = ref([]);
  const isLoadingSuggestions = ref(false);
  const suggestionError = ref(null);
  const suggestionSignature = ref(null);

  // 內部計數器用於取消過期請求
  let suggestionRequestId = 0;

  /**
   * 正規化建議項目
   * @param {Array} source - 原始建議資料
   * @returns {Array} - 正規化後的建議文字陣列
   */
  const normalizeSuggestionItems = (source) => {
    if (!Array.isArray(source)) {
      return [];
    }

    const seen = new Set();
    const results = [];

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
   * 基於最近 N 條消息和聊天對象 ID
   * @returns {string}
   */
  const createSuggestionSignature = () => {
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
   * @param {number} requestId - 請求 ID
   * @param {Array} options - 建議選項
   * @param {string} message - 錯誤或提示訊息
   * @param {string} signature - 建議簽名
   * @param {boolean} persistSignature - 是否保存簽名
   */
  const finalizeSuggestionState = (
    requestId,
    options,
    message,
    signature,
    persistSignature = true
  ) => {
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
  const invalidateSuggestions = () => {
    suggestionRequestId += 1;
    isLoadingSuggestions.value = false;
    suggestionOptions.value = [];
    suggestionError.value = null;
    suggestionSignature.value = null;
  };

  /**
   * 載入建議選項
   */
  const loadSuggestions = async () => {
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
   * @param {string} suggestion - 選中的建議文字
   */
  const selectSuggestion = (suggestion) => {
    return suggestion;
  };

  /**
   * 是否有建議快取
   */
  const hasCachedSuggestions = computed(() => {
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
