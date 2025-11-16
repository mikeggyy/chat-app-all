/**
 * ChatList 狀態管理 Composable
 *
 * 負責管理對話列表的狀態、computed 屬性和數據規範化
 */

import { computed, ref, watch } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { apiJson } from '../../utils/api.js';
import { fallbackMatches } from '../../utils/matchFallback.js';
import type { User } from '../../types';

// ==================== 類型定義 ====================

/**
 * 角色/匹配對象
 */
interface Match {
  id: string;
  display_name?: string;
  name?: string;
  portraitUrl?: string;
  avatar?: string;
  first_message?: string;
  [key: string]: any;
}

/**
 * 對話來源數據
 */
interface ConversationSource {
  conversationId?: string;
  characterId?: string;
  matchId?: string;
  id?: string;
  character?: Match;
  lastMessage?: string;
  partnerLastMessage?: string;
  preview?: string;
  last_message?: string;
  partnerLastRepliedAt?: string;
  updatedAt?: string;
  lastMessageAt?: string;
  isFavorite?: boolean;
  favorite?: boolean;
  [key: string]: any;
}

/**
 * 規範化的對話線程
 */
export interface ConversationThread {
  id: string;
  displayName: string;
  portrait: string;
  lastMessage: string;
  timeLabel: string;
  isFavorite: boolean;
}

/**
 * Tab 選項
 */
export type TabType = 'all' | 'favorite';

/**
 * API 收藏響應
 */
interface FavoritesResponse {
  matches?: Match[];
  [key: string]: any;
}

/**
 * useChatListState 選項
 */
export interface UseChatListStateOptions {
  user: Ref<User | null>;
  conversations: Ref<(string | ConversationSource)[]>;
}

/**
 * useChatListState 返回類型
 */
export interface UseChatListStateReturn {
  // 狀態
  activeTab: Ref<TabType>;
  isFavoriteTab: ComputedRef<boolean>;

  // Computed
  favoriteIds: ComputedRef<string[]>;
  conversationThreads: ComputedRef<ConversationThread[]>;
  favoriteThreads: ComputedRef<ConversationThread[]>;
  visibleThreads: ComputedRef<ConversationThread[]>;
  isEmpty: ComputedRef<boolean>;

  // 方法
  selectTab: (tab: TabType) => void;
}

// ==================== 常量 ====================

const DEFAULT_TIMES = ['14:26', '13:58', '11:42', '09:15'];
const FALLBACK_PREVIEW = '願上帝憐憫你的心靈～(溫柔的微笑)';

// ==================== 工具函數 ====================

/**
 * 規範化 ID
 * @param value - 要規範化的 ID
 * @returns 規範化後的 ID
 */
const normalizeId = (value: any): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : '';
};

/**
 * 規範化對話線程
 * @param source - 原始對話數據
 * @param index - 索引（用於生成預設時間）
 * @returns 規範化後的對話對象
 */
const normalizeThread = (
  source: ConversationSource | null | undefined,
  index: number = 0
): ConversationThread | null => {
  const safeIndex = Number.isFinite(index) ? index : 0;

  if (!source || typeof source !== 'object') {
    return null;
  }

  const character = source.character ?? source;

  // 提取 ID（優先級：conversationId > characterId > matchId > id）
  const id =
    normalizeId(source.conversationId) ||
    normalizeId(source.characterId) ||
    normalizeId(source.matchId) ||
    normalizeId(source.id) ||
    normalizeId(character.id);

  if (!id) {
    return null;
  }

  // 提取頭像
  const portrait =
    normalizeId(character.portraitUrl) ||
    normalizeId(character.avatar) ||
    '/ai-role/match-role-01.webp';

  // 提取顯示名稱
  const displayName =
    normalizeId(character.display_name) ||
    normalizeId(character.name) ||
    '神聖的艾米莉雅';

  // 提取最後一條消息
  const lastMessage =
    normalizeId(source.lastMessage) ||
    normalizeId(source.partnerLastMessage) ||
    normalizeId(source.preview) ||
    normalizeId(source.last_message) ||
    normalizeId(character.first_message) ||
    FALLBACK_PREVIEW;

  // 提取更新時間
  const updatedAt =
    normalizeId(source.partnerLastRepliedAt) ||
    normalizeId(source.updatedAt) ||
    normalizeId(source.lastMessageAt);

  // 是否收藏
  const isFavorite = Boolean(source.isFavorite ?? source.favorite);

  // 生成時間標籤
  const timeLabel = (() => {
    if (updatedAt) {
      try {
        const date = new Date(updatedAt);
        if (!Number.isNaN(date.getTime())) {
          const now = new Date();
          const isSameDay =
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();
          const hours = `${date.getHours()}`.padStart(2, '0');
          const minutes = `${date.getMinutes()}`.padStart(2, '0');
          if (isSameDay) {
            return `${hours}:${minutes}`;
          }
          const month = `${date.getMonth() + 1}`.padStart(2, '0');
          const day = `${date.getDate()}`.padStart(2, '0');
          return `${month}/${day}`;
        }
      } catch {
        // 日期解析失敗時使用預設時間
      }
    }
    return DEFAULT_TIMES[safeIndex % DEFAULT_TIMES.length];
  })();

  return {
    id,
    displayName,
    portrait,
    lastMessage,
    timeLabel,
    isFavorite,
  };
};

// ==================== 主函數 ====================

/**
 * 創建 ChatList 狀態管理
 * @param options - 配置選項
 * @returns 狀態和方法
 */
export function useChatListState(options: UseChatListStateOptions): UseChatListStateReturn {
  const { user, conversations } = options;

  // 狀態
  const activeTab = ref<TabType>('all');
  const favoriteMatches = ref<Match[]>([]);
  let favoriteRequestToken = 0;

  // 計算屬性
  const isFavoriteTab = computed(() => activeTab.value === 'favorite');

  // 收藏 ID 列表
  const favoriteIds = computed<string[]>(() => {
    const favorites = Array.isArray(user.value?.favorites)
      ? user.value.favorites
      : [];
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const value of favorites) {
      const id = normalizeId(value);
      if (id && !seen.has(id)) {
        seen.add(id);
        normalized.push(id);
      }
    }

    return normalized;
  });

  // 可用的匹配列表（包括收藏和預設）
  const availableMatches = computed<Match[]>(() => {
    const list: Match[] = [];
    const seen = new Set<string>();

    const append = (match: Match | null | undefined) => {
      if (!match || typeof match !== 'object') {
        return;
      }
      const id = normalizeId(match.id);
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      list.push(match);
    };

    favoriteMatches.value.forEach(append);

    if (Array.isArray(fallbackMatches)) {
      fallbackMatches.forEach(append);
    }

    return list;
  });

  // 匹配查找 Map
  const matchLookup = computed<Map<string, Match>>(() => {
    const map = new Map<string, Match>();
    availableMatches.value.forEach((match) => {
      const id = normalizeId(match?.id);
      if (id && !map.has(id)) {
        map.set(id, match);
      }
    });
    return map;
  });

  // 對話線程列表
  const conversationThreads = computed<ConversationThread[]>(() => {
    const conversationList = conversations.value || [];
    const favoritesSet = new Set(favoriteIds.value);

    if (!conversationList.length) {
      return [];
    }

    const normalized = conversationList
      .map((entry, index) => {
        // 處理字符串類型的條目（僅 ID）
        if (typeof entry === 'string') {
          const match = matchLookup.value.get(entry);
          if (match) {
            return normalizeThread(
              {
                ...match,
                matchId: entry,
                conversationId: entry,
                isFavorite: favoritesSet.has(entry),
              },
              index
            );
          }
          return normalizeThread(
            {
              id: entry,
              matchId: entry,
              conversationId: entry,
              isFavorite: favoritesSet.has(entry),
            },
            index
          );
        }

        // 處理對象類型的條目
        if (entry && typeof entry === 'object') {
          const identifier =
            normalizeId(entry.characterId) ||
            normalizeId(entry.conversationId) ||
            normalizeId(entry.matchId) ||
            normalizeId(entry.id);

          const match = identifier && matchLookup.value.size
            ? matchLookup.value.get(identifier)
            : null;

          if (match) {
            return normalizeThread(
              {
                ...entry,
                matchId: identifier,
                character: {
                  ...match,
                  ...(entry.character ?? {}),
                },
                isFavorite: favoritesSet.has(identifier) || entry.isFavorite,
              },
              index
            );
          }

          return normalizeThread(
            {
              ...entry,
              matchId: identifier || entry.matchId,
              isFavorite: favoritesSet.has(identifier) || entry.isFavorite,
            },
            index
          );
        }

        return null;
      })
      .filter((thread): thread is ConversationThread => thread !== null);

    if (!normalized.length) {
      return [];
    }

    // 確保收藏狀態正確
    return normalized.map((thread) => ({
      ...thread,
      isFavorite: favoritesSet.has(thread.id) || thread.isFavorite,
    }));
  });

  // 收藏線程列表
  const favoriteThreads = computed<ConversationThread[]>(() => {
    const favorites = favoriteIds.value;
    const threads = conversationThreads.value;
    const byId = new Map(threads.map((thread) => [thread.id, thread]));
    const result: ConversationThread[] = [];
    const processed = new Set<string>();

    // 按收藏順序處理
    favorites.forEach((favoriteId, index) => {
      const existingThread = byId.get(favoriteId);
      if (existingThread) {
        result.push({ ...existingThread, isFavorite: true });
        processed.add(favoriteId);
        return;
      }

      // 如果對話列表中沒有，創建一個 fallback
      const match = matchLookup.value.get(favoriteId);

      const fallbackThread = normalizeThread(
        match
          ? {
              id: favoriteId,
              matchId: favoriteId,
              conversationId: favoriteId,
              character: match,
              lastMessage: match.first_message,
              isFavorite: true,
            }
          : {
              id: favoriteId,
              matchId: favoriteId,
              conversationId: favoriteId,
              character: {
                id: favoriteId,
                display_name: '收藏角色',
                name: '收藏角色',
                portraitUrl: '/ai-role/match-role-01.webp',
                avatar: '/ai-role/match-role-01.webp',
                first_message: FALLBACK_PREVIEW,
              },
              lastMessage: FALLBACK_PREVIEW,
              isFavorite: true,
            },
        index
      );

      if (fallbackThread) {
        result.push({ ...fallbackThread, isFavorite: true });
        processed.add(favoriteId);
      }
    });

    // 添加對話列表中已收藏但不在收藏列表中的項目
    threads.forEach((thread) => {
      if (thread.isFavorite && !processed.has(thread.id)) {
        result.push({ ...thread, isFavorite: true });
        processed.add(thread.id);
      }
    });

    return result;
  });

  // 當前可見的線程（根據標籤頁過濾）
  const visibleThreads = computed<ConversationThread[]>(() => {
    return isFavoriteTab.value
      ? favoriteThreads.value
      : conversationThreads.value;
  });

  // 是否為空
  const isEmpty = computed(() => visibleThreads.value.length === 0);

  // 監聽用戶和收藏變化，加載收藏匹配數據
  watch(
    [() => user.value?.id, () => favoriteIds.value.join('|')],
    async ([nextUserId]) => {
      const token = ++favoriteRequestToken;

      if (!nextUserId || favoriteIds.value.length === 0) {
        favoriteMatches.value = [];
        return;
      }

      try {
        const response = await apiJson(
          `/api/users/${encodeURIComponent(
            nextUserId
          )}/favorites?include=matches`,
          { skipGlobalLoading: true }
        ) as any;

        if (favoriteRequestToken !== token) {
          return;
        }

        // ✅ 修復：處理包裝在 data 字段中的響應
        const data = response?.data || response;
        const matches = Array.isArray(data?.matches) ? data.matches : [];
        favoriteMatches.value = matches;
      } catch (error) {
        if (favoriteRequestToken !== token) {
          return;
        }

        favoriteMatches.value = [];
      }
    },
    { immediate: true }
  );

  // 方法
  const selectTab = (tab: TabType) => {
    activeTab.value = tab;
  };

  return {
    // 狀態
    activeTab,
    isFavoriteTab,

    // Computed
    favoriteIds,
    conversationThreads,
    favoriteThreads,
    visibleThreads,
    isEmpty,

    // 方法
    selectTab,
  };
}
