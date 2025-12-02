/**
 * 排行榜數據管理 Composable
 * 負責數據獲取、狀態管理和元數據處理
 */

import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from 'vue';
import { fetchRanking, RANKING_PAGE_SIZE } from '../../services/ranking.service.js';
import { apiJson } from '../../utils/api.js';
import { fallbackMatches } from '../../utils/matchFallback.js';
import { cacheKeys, apiCache } from '../../services/apiCache.service.js';
import { logger } from '../../utils/logger.js';
import {
  normalizeIdentifier,
  toPositiveInteger,
  EMPTY_METADATA,
  formatDateLine,
} from '../../utils/rankingUtils.js';

// 類型定義
interface MatchMetadata {
  totalChatUsers: number;
  totalFavorites: number;
  displayName: string;
  portraitUrl: string;
}

interface RawRankingEntry {
  rank?: number | string;
  score?: number | string;
  characterId?: string;
  name?: string;
  avatar?: string;
}

interface DecoratedRankingEntry {
  rank: number;
  score: number;
  chatId: string;
  displayName: string;
  avatar: string;
  totalChatUsers: number;
  totalFavorites: number;
}

interface RankingResponse {
  entries?: RawRankingEntry[];
  updatedAt?: string;
}

interface MatchData {
  id?: string;
  display_name?: string;
  displayName?: string;
  portraitUrl?: string;
  totalChatUsers?: number | string;
  totalFavorites?: number | string;
  [key: string]: any;
}

interface LoadRankingsOptions {
  reset?: boolean;
}

interface FetchRankingParams {
  period: string;
  limit: number;
  offset: number;
}

interface UseRankingDataReturn {
  // 狀態
  podium: ShallowRef<RawRankingEntry[]>;
  entries: ShallowRef<RawRankingEntry[]>;
  updatedAt: Ref<string>;
  errorMessage: Ref<string>;
  loading: Ref<boolean>;
  hasMore: Ref<boolean>;
  offset: Ref<number>;

  // 計算屬性
  formattedUpdatedAt: ComputedRef<string>;
  updateLine: ComputedRef<string>;

  // 方法
  loadMatchMetadata: () => Promise<void>;
  decorateEntry: (entry: RawRankingEntry | null | undefined) => DecoratedRankingEntry | null;
  decorateEntries: (rawEntries: any) => DecoratedRankingEntry[];
  resolveEntryChatId: (entry: RawRankingEntry | null | undefined) => string | null;
  resetState: () => void;
  loadRankings: (period: string, options?: LoadRankingsOptions) => Promise<void>;
}

// 預計算常量
const MATCH_ID_BY_AVATAR: Record<string, string> = fallbackMatches.reduce((map, match) => {
  if (!match || typeof match !== "object") return map;
  const portrait = typeof match.portraitUrl === "string" ? match.portraitUrl.trim() : "";
  const identifier = typeof match.id === "string" ? match.id.trim() : "";
  if (portrait && identifier) {
    map[portrait] = identifier;
  }
  return map;
}, {} as Record<string, string>);

const FALLBACK_CHAT_ID: string | null = fallbackMatches
  .find((match) => typeof match?.id === "string" && match.id.trim().length)
  ?.id.trim() ?? null;

const DEFAULT_MATCH_AVATAR: string = fallbackMatches.find((match) => {
  if (!match || typeof match !== "object") return false;
  const portrait = typeof match.portraitUrl === "string" ? match.portraitUrl.trim() : "";
  return portrait.length > 0;
})?.portraitUrl ?? "";

/**
 * 排行榜數據 Composable
 */
export function useRankingData(): UseRankingDataReturn {
  // 狀態
  const podium = shallowRef<RawRankingEntry[]>([]);
  const entries = shallowRef<RawRankingEntry[]>([]);
  const updatedAt = ref<string>("");
  const errorMessage = ref<string>("");
  const loading = ref<boolean>(false);
  const hasMore = ref<boolean>(true);
  const offset = ref<number>(0);
  const matchMetadata = ref<Record<string, MatchMetadata>>({});

  // 裝飾緩存（避免重複計算）
  const decorationCache = new Map<string, DecoratedRankingEntry>();

  /**
   * 載入角色元數據
   */
  const loadMatchMetadata = async (): Promise<void> => {
    try {
      const cacheKey: string = cacheKeys.matches();
      const cachedData: any = apiCache.get(cacheKey);

      let matches: any;
      if (cachedData) {
        matches = cachedData;
      } else {
        matches = await apiJson("/api/characters");
        apiCache.set(cacheKey, matches);
      }

      assignMatchMetadata(matches);
    } catch (error) {
      logger.error("載入角色元數據失敗:", error);
    }
  };

  /**
   * 分配角色元數據到 map
   */
  const assignMatchMetadata = (matches: any): void => {
    const map: Record<string, MatchMetadata> = {};
    if (Array.isArray(matches)) {
      matches.forEach((match: MatchData) => {
        if (!match || typeof match !== "object") return;
        const identifier: string = normalizeIdentifier(match.id);
        if (!identifier) return;

        const displayName: string =
          normalizeIdentifier(match.display_name) ||
          normalizeIdentifier(match.displayName);
        const portrait: string =
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
  const resolveEntryChatId = (entry: RawRankingEntry | null | undefined): string | null => {
    if (!entry || typeof entry !== "object") {
      return FALLBACK_CHAT_ID;
    }

    const directId: string = normalizeIdentifier(entry.characterId);
    if (directId) {
      return directId;
    }

    const avatar: string = typeof entry.avatar === "string" ? entry.avatar.trim() : "";
    if (avatar && MATCH_ID_BY_AVATAR[avatar]) {
      return MATCH_ID_BY_AVATAR[avatar];
    }

    return FALLBACK_CHAT_ID;
  };

  /**
   * 獲取條目元數據
   */
  const getEntryMetadata = (entry: RawRankingEntry): MatchMetadata => {
    const chatId: string | null = resolveEntryChatId(entry);
    return chatId && matchMetadata.value[chatId]
      ? matchMetadata.value[chatId]
      : EMPTY_METADATA;
  };

  /**
   * 裝飾單個條目（添加元數據）
   */
  const decorateEntry = (entry: RawRankingEntry | null | undefined): DecoratedRankingEntry | null => {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const rank: number = toPositiveInteger(entry.rank);
    const score: number = toPositiveInteger(entry.score);
    if (rank <= 0 || score <= 0) {
      return null;
    }

    // 檢查緩存
    const cacheKey: string = `${rank}-${score}`;
    if (decorationCache.has(cacheKey)) {
      return decorationCache.get(cacheKey)!;
    }

    const metadata: MatchMetadata = getEntryMetadata(entry);
    const chatId: string | null = resolveEntryChatId(entry);

    const decorated: DecoratedRankingEntry = {
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
  const decorateEntries = (rawEntries: any): DecoratedRankingEntry[] => {
    if (!Array.isArray(rawEntries)) {
      return [];
    }
    return rawEntries.map(decorateEntry).filter(Boolean) as DecoratedRankingEntry[];
  };

  /**
   * 格式化更新時間
   */
  const formattedUpdatedAt = computed<string>(() => formatDateLine(updatedAt.value));

  /**
   * 更新時間行
   */
  const updateLine = computed<string>(() =>
    formattedUpdatedAt.value ? `更新於 ${formattedUpdatedAt.value}` : ""
  );

  /**
   * 重置狀態
   */
  const resetState = (): void => {
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
  const loadRankings = async (period: string, { reset = false }: LoadRankingsOptions = {}): Promise<void> => {
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
      const response: RankingResponse = await fetchRanking({
        period,
        limit: RANKING_PAGE_SIZE,
        offset: offset.value,
      } as FetchRankingParams);

      if (!response || typeof response !== "object") {
        throw new Error("無效的排行榜回應");
      }

      const { entries: newEntries = [], updatedAt: timestamp } = response;

      if (Array.isArray(newEntries) && newEntries.length > 0) {
        // 前 3 名進入 podium
        const podiumCandidates: RawRankingEntry[] = newEntries.filter(
          (entry: RawRankingEntry) => toPositiveInteger(entry?.rank) <= 3
        );
        const restEntries: RawRankingEntry[] = newEntries.filter(
          (entry: RawRankingEntry) => toPositiveInteger(entry?.rank) > 3
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
    } catch (error: any) {
      logger.error("載入排行榜失敗:", error);
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
