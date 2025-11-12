/**
 * 排行榜數據管理 Composable
 * 負責數據獲取、狀態管理和元數據處理
 */

import { ref, shallowRef, computed } from 'vue';
import { fetchRanking, RANKING_PAGE_SIZE } from '../../services/ranking.service.js';
import { apiJson } from '../../utils/api.js';
import { fallbackMatches } from '../../utils/matchFallback.js';
import { apiCache, cacheKeys, cacheTTL } from '../../services/apiCache.service.js';
import {
  normalizeIdentifier,
  toPositiveInteger,
  EMPTY_METADATA,
  formatDateLine,
} from '../../utils/rankingUtils.js';

// 預計算常量
const MATCH_ID_BY_AVATAR = fallbackMatches.reduce((map, match) => {
  if (!match || typeof match !== "object") return map;
  const portrait = typeof match.portraitUrl === "string" ? match.portraitUrl.trim() : "";
  const identifier = typeof match.id === "string" ? match.id.trim() : "";
  if (portrait && identifier) {
    map[portrait] = identifier;
  }
  return map;
}, {});

const FALLBACK_CHAT_ID = fallbackMatches
  .find((match) => typeof match?.id === "string" && match.id.trim().length)
  ?.id.trim() ?? null;

const DEFAULT_MATCH_AVATAR = fallbackMatches.find((match) => {
  if (!match || typeof match !== "object") return false;
  const portrait = typeof match.portraitUrl === "string" ? match.portraitUrl.trim() : "";
  return portrait.length > 0;
})?.portraitUrl ?? "";

/**
 * 排行榜數據 Composable
 */
export function useRankingData() {
  // 狀態
  const podium = shallowRef([]);
  const entries = shallowRef([]);
  const updatedAt = ref("");
  const errorMessage = ref("");
  const loading = ref(false);
  const hasMore = ref(true);
  const offset = ref(0);
  const matchMetadata = ref({});

  // 裝飾緩存（避免重複計算）
  const decorationCache = new Map();

  /**
   * 載入角色元數據
   */
  const loadMatchMetadata = async () => {
    try {
      const cacheKey = cacheKeys.matches();
      const cachedData = apiCache.get(cacheKey);

      let matches;
      if (cachedData) {
        matches = cachedData;
      } else {
        matches = await apiJson("/api/characters");
        apiCache.set(cacheKey, matches, cacheTTL.matches);
      }

      assignMatchMetadata(matches);
    } catch (error) {
      console.error("載入角色元數據失敗:", error);
    }
  };

  /**
   * 分配角色元數據到 map
   */
  const assignMatchMetadata = (matches) => {
    const map = {};
    if (Array.isArray(matches)) {
      matches.forEach((match) => {
        if (!match || typeof match !== "object") return;
        const identifier = normalizeIdentifier(match.id);
        if (!identifier) return;

        const displayName =
          normalizeIdentifier(match.display_name) ||
          normalizeIdentifier(match.displayName);
        const portrait =
          typeof match.portraitUrl === "string" ? match.portraitUrl.trim() : "";

        map[identifier] = {
          totalChatUsers: toPositiveInteger(match.totalChatUsers),
          totalFavorites: toPositiveInteger(match.totalFavorites),
          displayName,
          portraitUrl: portrait,
        };
      });
    }
    matchMetadata.value = map;
  };

  /**
   * 解析條目的聊天 ID
   */
  const resolveEntryChatId = (entry) => {
    if (!entry || typeof entry !== "object") {
      return FALLBACK_CHAT_ID;
    }

    const directId = normalizeIdentifier(entry.characterId);
    if (directId) {
      return directId;
    }

    const avatar = typeof entry.avatar === "string" ? entry.avatar.trim() : "";
    if (avatar && MATCH_ID_BY_AVATAR[avatar]) {
      return MATCH_ID_BY_AVATAR[avatar];
    }

    return FALLBACK_CHAT_ID;
  };

  /**
   * 獲取條目元數據
   */
  const getEntryMetadata = (entry) => {
    const chatId = resolveEntryChatId(entry);
    return chatId && matchMetadata.value[chatId]
      ? matchMetadata.value[chatId]
      : EMPTY_METADATA;
  };

  /**
   * 裝飾單個條目（添加元數據）
   */
  const decorateEntry = (entry) => {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const rank = toPositiveInteger(entry.rank);
    const score = toPositiveInteger(entry.score);
    if (rank <= 0 || score <= 0) {
      return null;
    }

    // 檢查緩存
    const cacheKey = `${rank}-${score}`;
    if (decorationCache.has(cacheKey)) {
      return decorationCache.get(cacheKey);
    }

    const metadata = getEntryMetadata(entry);
    const chatId = resolveEntryChatId(entry);

    const decorated = {
      rank,
      score,
      chatId: chatId ?? "",
      displayName: metadata.displayName || entry.name || "未知角色",
      avatar: metadata.portraitUrl || entry.avatar || DEFAULT_MATCH_AVATAR,
      totalChatUsers: metadata.totalChatUsers,
      totalFavorites: metadata.totalFavorites,
    };

    // 緩存結果
    decorationCache.set(cacheKey, decorated);

    return decorated;
  };

  /**
   * 裝飾條目列表
   */
  const decorateEntries = (rawEntries) => {
    if (!Array.isArray(rawEntries)) {
      return [];
    }
    return rawEntries.map(decorateEntry).filter(Boolean);
  };

  /**
   * 格式化更新時間
   */
  const formattedUpdatedAt = computed(() => formatDateLine(updatedAt.value));

  /**
   * 更新時間行
   */
  const updateLine = computed(() =>
    formattedUpdatedAt.value ? `更新於 ${formattedUpdatedAt.value}` : ""
  );

  /**
   * 重置狀態
   */
  const resetState = () => {
    podium.value = [];
    entries.value = [];
    updatedAt.value = "";
    errorMessage.value = "";
    hasMore.value = true;
    offset.value = 0;
    decorationCache.clear();
  };

  /**
   * 載入排行榜數據
   */
  const loadRankings = async (period, { reset = false } = {}) => {
    if (reset) {
      resetState();
    }

    if (!hasMore.value && !reset) {
      return;
    }

    if (loading.value) {
      return;
    }

    loading.value = true;
    errorMessage.value = "";

    try {
      const response = await fetchRanking({
        period,
        limit: RANKING_PAGE_SIZE,
        offset: offset.value,
      });

      if (!response || typeof response !== "object") {
        throw new Error("無效的排行榜回應");
      }

      const { entries: newEntries = [], updatedAt: timestamp } = response;

      if (Array.isArray(newEntries) && newEntries.length > 0) {
        // 前 3 名進入 podium
        const podiumCandidates = newEntries.filter(
          (entry) => toPositiveInteger(entry?.rank) <= 3
        );
        const restEntries = newEntries.filter(
          (entry) => toPositiveInteger(entry?.rank) > 3
        );

        if (offset.value === 0) {
          podium.value = podiumCandidates;
          entries.value = restEntries;
        } else {
          entries.value = [...entries.value, ...restEntries];
        }

        offset.value += newEntries.length;
        hasMore.value = newEntries.length === RANKING_PAGE_SIZE;
      } else {
        hasMore.value = false;
      }

      if (timestamp) {
        updatedAt.value = timestamp;
      }
    } catch (error) {
      console.error("載入排行榜失敗:", error);
      errorMessage.value = error.message || "載入排行榜資料失敗，請稍後再試";
      hasMore.value = false;
    } finally {
      loading.value = false;
    }
  };

  return {
    // 狀態
    podium,
    entries,
    updatedAt,
    errorMessage,
    loading,
    hasMore,
    offset,

    // 計算屬性
    formattedUpdatedAt,
    updateLine,

    // 方法
    loadMatchMetadata,
    decorateEntry,
    decorateEntries,
    resolveEntryChatId,
    resetState,
    loadRankings,
  };
}
